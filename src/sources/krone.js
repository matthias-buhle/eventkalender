import * as cheerio from 'cheerio';
import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { cleanText, normalizeArt } from '../normalize.js';

export const name = 'krone';

const QUELLE = 'Stadthalle Krone Bautzen';
const ORT = 'Stadthalle Krone, Bautzen';
const NICHT_OEFFENTLICH = /nicht\s+öffentlich|geschlossene\s+veranstaltung/i;

/** Liest die Liste: Titel, Tag (TT.MM.JJJJ), Link und "ausverkauft" aus der Klasse des Bildkastens. Bilder und Texte bleiben ungelesen. */
function leseListe(html, listUrl) {
  const $ = cheerio.load(html);
  const gesehen = new Set();
  return $('article.link-item').map((_, el) => {
    const e = $(el);
    const titel = cleanText(e.find('h3').first().text());
    const [, t, m, j] = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(e.find('span').first().text()) ?? [];
    const href = e.find('a[href]').first().attr('href');
    if (!titel || !j || !href) return null;
    if (NICHT_OEFFENTLICH.test(e.find('.content > p').first().text())) return null;
    const url = new URL(href, listUrl).href;
    if (gesehen.has(url)) return null;
    gesehen.add(url);
    return {
      title: titel,
      tag: `${j}-${m.padStart(2, '0')}-${t.padStart(2, '0')}`,
      url,
      ausverkauft: /event_Ausverkauft/i.test(e.find('.imageholder').attr('class') ?? ''),
    };
  }).get().filter(Boolean);
}

/** "2026-12-05 20:00:00" (JSON-LD ohne Zeitzone, Berliner Ortszeit) in Tag und Uhrzeit zerlegen. */
function tagUndUhr(text) {
  const [, tag, uhr] = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(text ?? '')) ?? [];
  return tag ? { tag, uhr } : null;
}

/** Aus "Stadthalle Krone Bautzen, Steinstraße 9, 02625 Bautzen" bleibt der Ort der Halle; ein anderer Spielort wird als "Name, Stadt" übernommen. */
function ortVon(text) {
  const t = cleanText(text);
  if (!t || /krone/i.test(t)) return ORT;
  const [, spielort, stadt] = /^([^,]+),.*?\d{5}\s+(.+)$/.exec(t) ?? [];
  return spielort ? `${spielort.trim()}, ${stadt.trim()}` : t;
}

/**
 * Von der Detailseite nur Uhrzeit (JSON-LD, sonst "Beginn:"), Ende, Kategorie ("KONZERT", "KABARETT") und Spielort.
 * Beschreibung, Bilder und Ticketlinks werden bewusst nicht gelesen.
 */
function leseDetail(html, tag) {
  const $ = cheerio.load(html);
  const roh = extractSchemaEvents(html).find((e) => e.startDate);
  const start = tagUndUhr(roh?.startDate);
  const ende = tagUndUhr(roh?.endDate);
  let uhr = start?.tag === tag ? start.uhr : null;
  let bis = uhr && ende && ende.tag === tag && ende.uhr > uhr ? ende.uhr : null;
  if (!uhr) {
    const [, h, min] = /Beginn:\s*(\d{1,2})[:.](\d{2})/.exec($('main').text()) ?? [];
    uhr = h ? `${h.padStart(2, '0')}:${min}` : null;
    bis = null;
  }
  // Über dem Text stehen zwei Überschriften: das Datum und die Kategorie.
  const kategorie = $('main h3.wp-block-heading').map((_, h) => cleanText($(h).text())).get()
    .find((t) => t && !/\d{1,2}\.\d{1,2}\.\d{4}/.test(t)) ?? '';
  const ortAbsatz = $('main p').filter((_, p) => /^\s*Ort:/.test($(p).text())).first().text().replace(/^\s*Ort:/, '');
  return { uhr, bis, kategorie: kategorie.length <= 30 ? kategorie : '', ort: ortVon(ortAbsatz) };
}

function zuEvent(e, detail) {
  const uhr = detail?.uhr ?? null;
  return makeEvent({
    sourceName: QUELLE,
    sourceId: e.url,
    sourceUrl: e.url,
    title: e.title,
    art: normalizeArt(detail?.kategorie ?? '', e.title),
    start: berlinIso(e.tag, uhr),
    end: uhr && detail.bis ? berlinIso(e.tag, detail.bis) : null,
    hasTime: Boolean(uhr),
    placeName: detail?.ort ?? ORT,
    contact: { url: e.url },
    ticketStatus: e.ausverkauft ? 'ausverkauft' : null,
    description: null,
  });
}

/**
 * Programm der Stadthalle Krone in Bautzen: eine Liste (Titel, Datum), die Uhrzeit steht nur auf den Detailseiten.
 * Aufgenommen wird jede Veranstaltung ab heute; Detailseiten werden für die ersten maxDetailPages Termine geladen
 * (mit Abstand minDelayMs, mindestens 3 Sekunden). Die übrigen bleiben ohne Uhrzeit, ebenso Termine, deren Detailseite ausfällt.
 * Es werden nur Titel, Datum, Uhrzeit, Ort und Link übernommen, nie Bilder oder Beschreibungstexte.
 */
export async function fetchEvents({ http, today, config }) {
  const opts = { as: 'text', minDelayMs: Math.max(config.minDelayMs ?? 3000, 3000) };
  const { body, url } = await http.get(config.listUrl, opts);
  const eintraege = leseListe(body, config.listUrl ?? url).filter((e) => e.tag >= today);
  if (!eintraege.length) throw new Error('Krone Bautzen: keine Termine in der Liste gefunden');
  eintraege.sort((a, b) => a.tag.localeCompare(b.tag));
  const events = [];
  for (const [i, e] of eintraege.entries()) {
    let detail = null;
    if (i < (config.maxDetailPages ?? 40)) {
      try {
        detail = leseDetail((await http.get(e.url, opts)).body, e.tag);
      } catch { /* Termin bleibt mit den Listenangaben, ohne Uhrzeit */ }
    }
    events.push(zuEvent(e, detail));
  }
  return events;
}
