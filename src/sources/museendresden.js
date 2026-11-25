import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { cleanText, normalizeArt, shorten } from '../normalize.js';

export const name = 'museendresden';

const QUELLE = 'Museen der Stadt Dresden';
const KALENDER = 'https://museen-dresden.de/programm/kalender';
const MONATE = { jan: 1, feb: 2, 'mär': 3, mrz: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12 };
const pad = (n) => String(n).padStart(2, '0');

/**
 * Datum aus "Mi / 25. Nov" oder "Mi / 13. Jan 27". Ohne Jahr gilt das nächste Vorkommen ab heute
 * (die Liste enthält nur kommende Termine); mit zweistelligem Jahr steht es dort.
 */
function leseTag(text, today) {
  const m = /(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]{3,4})\.?(?:\s+(\d{2,4}))?\s*$/.exec(cleanText(text));
  const monat = MONATE[m?.[2]?.toLowerCase().slice(0, 3)];
  if (!m || !monat) return null;
  const tag = Number(m[1]);
  let jahr = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
  if (jahr < 100) jahr += 2000;
  let datum = `${jahr}-${pad(monat)}-${pad(tag)}`;
  if (!m[3] && datum < today) datum = `${jahr + 1}-${pad(monat)}-${pad(tag)}`;
  return datum;
}

/** "11:00 & 14:00" oder "15:00, 15:45 & 16:15" ergibt mehrere Uhrzeiten; ohne Zeitangabe eine leere Liste. */
function leseZeiten(text) {
  return [...cleanText(text).matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => `${m[1].padStart(2, '0')}:${m[2]}`);
}

/**
 * Spielort aus dem Kartenlink ("maps?q=Stadtmuseum Dresden", "q=Striezelmarkt , 01067 Dresden"):
 * ohne Postleitzahl, immer mit ", Dresden" am Ende. Ohne Kartenlink gilt der Name des Hauses.
 */
function leseOrt(kartenLink, haus) {
  let q = '';
  try { q = decodeURIComponent(new URL(kartenLink, KALENDER).searchParams.get('q') ?? ''); } catch { /* ohne Ort */ }
  q = cleanText(q || haus)
    .replace(/\s*,\s*\d{5}\s+Dresden$/, '')
    .replace(/\s+Dresden$/, '')
    .replace(/\s+,/g, ',')
    .trim();
  return q ? `${q}, Dresden` : 'Dresden';
}

/**
 * Link zur Veranstaltung: "Mehr erfahren" der Karte, sonst die Adresse des iCal-Eintrags ohne ".ics"
 * (die Einzelseiten liegen auf der Seite des jeweiligen Hauses, z. B. stadtmuseum-dresden.de/programm/kalender/...).
 * Ohne beides bleibt der gemeinsame Kalender.
 */
function leseLink($, $e) {
  const links = $e.find('a[href]').map((_, a) => a.attribs.href).get();
  const detail = $e.find('a.event-list__link').filter((_, a) => /mehr erfahren/i.test(cleanText($(a).text()))).attr('href');
  const ics = links.find((h) => /\/programm\/kalender\/[^/?#]+\.ics$/.test(h));
  const roh = detail ?? ics?.replace(/\.ics$/, '');
  try { return new URL(roh, KALENDER).href; } catch { return KALENDER; }
}

function leseKarten(html, today) {
  const $ = cheerio.load(html);
  const termine = [];
  for (const el of $('.event-list__event').toArray()) {
    const e = $(el);
    const titel = cleanText(e.find('.event-list__title').first().text());
    const tag = leseTag(e.find('.event-list__date').first().clone().children().remove().end().text(), today);
    if (!titel || !tag) continue;
    const haus = cleanText(e.find('.breadcrumb a').first().text());
    // Eine Vernissage ist die Eröffnung einer Ausstellung; das Wort allein ordnet normalizeArt sonst nirgends zu.
    const kategorien = e.find('.breadcrumb a').slice(1).map((_, a) => cleanText($(a).text()).replace(/^Vernissage$/i, 'Vernissage Ausstellung')).get().filter(Boolean);
    termine.push({
      id: e.attr('id') ?? null,
      titel,
      untertitel: cleanText(e.find('.event-list__subtitle').first().text()),
      tag,
      zeiten: leseZeiten(e.find('.event-list__time').first().text()),
      haus,
      kategorien,
      ort: leseOrt(e.find('a[href*="maps?q="]').first().attr('href'), haus),
      status: cleanText(e.find('.event-list__status-info').first().text()),
      url: leseLink($, e),
    });
  }
  return termine;
}

function zuEvents(t) {
  const zeiten = t.zeiten.length ? t.zeiten : [null];
  return zeiten.map((zeit) => makeEvent({
    sourceName: QUELLE,
    sourceId: `${t.id ?? t.url}#${t.tag}${zeit ? `T${zeit}` : ''}`,
    sourceUrl: t.url,
    title: t.titel,
    art: normalizeArt(t.kategorien.join(' '), `${t.titel} ${t.untertitel}`),
    start: berlinIso(t.tag, zeit),
    end: null,
    hasTime: zeit !== null,
    placeName: t.ort,
    contact: { url: t.url },
    ticketStatus: /ausgebucht|ausverkauft/i.test(t.status) ? 'ausverkauft' : null,
    // nur die Zeile unter dem Titel ("Konzert mit Harfe und Gesang"), keine Programmtexte
    description: shorten(t.untertitel, 160) || null,
  }));
}

/**
 * Gemeinsamer Kalender der Museen der Stadt Dresden (Stadtmuseum, Städtische Galerie, Technische Sammlungen,
 * Kunsthaus u. a.). Die Seite zeigt nur zwölf Termine und lädt den Rest per "Mehr anzeigen" nach; dieselbe Liste
 * kommt als fertiges HTML-Stück von `/?ajax=events&limit=N`. Ein Abruf mit großem limit liefert alle kommenden
 * Termine ohne Skript. Es werden nur Titel, Datum, Uhrzeit, Haus/Ort und der Link übernommen (Absprache mit den Museen).
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url ?? `https://museen-dresden.de/?ajax=events&limit=${config.limit ?? 300}`, { as: 'text' });
  const karten = leseKarten(body, today);
  if (!karten.length) throw new Error('Museen Dresden: keine Termine in der Liste gefunden');
  return karten.flatMap(zuEvents).filter((e) => e.start.slice(0, 10) >= today);
}
