import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso, plusTage } from '../time.js';
import { cleanText, shorten, normalizeArt, detectSorte } from '../normalize.js';

export const name = 'kufa';

const QUELLE = 'Kulturfabrik Hoyerswerda';
const ORT = 'Kulturfabrik, Hoyerswerda';
const BESCHREIBUNG_MAX = 300;
// Diese Kategorien nennt oft weder Titel noch Text; sie stehen dann vor der Beschreibung, damit die Einordnung sie sieht.
const KLEINKUNST = /^(?:comedy|kabarett)$/i;

/** Liest eine Seite der Übersicht: je Veranstaltung Titel, Link und alle Tage mit Uhrzeit. Die Bilder bleiben ungelesen. */
function leseListe(html, listUrl) {
  const $ = cheerio.load(html);
  return $('.archiveBlockItem').toArray().map((el) => {
    const e = $(el);
    const titel = cleanText(e.find('.itemTitle').first().text());
    const href = e.find('a.itemLink[href]').first().attr('href');
    if (!titel || !href) return null;
    const tage = e.find('.itemDates .itemDateTime').toArray().map((d) => {
      const [, t, m, j] = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec($(d).find('.date').text()) ?? [];
      const [, h, min] = /(\d{1,2})[:.](\d{2})/.exec($(d).find('.time').text()) ?? [];
      return j ? { tag: `${j}-${m.padStart(2, '0')}-${t.padStart(2, '0')}`, uhr: h ? `${h.padStart(2, '0')}:${min}` : null } : null;
    }).filter(Boolean);
    return tage.length ? { title: titel, url: new URL(href, listUrl).href, tage } : null;
  }).filter(Boolean);
}

/** Von der Veranstaltungsseite nur die kurze Beschreibung und die Kategorie aus der Brotkrume ("Kultur > Jazz > Titel"). */
function leseDetail(html) {
  const $ = cheerio.load(html);
  const pfad = $('.breadcrumb a').toArray().map((a) => cleanText($(a).text()));
  const kategorie = pfad.slice(pfad.indexOf('Kultur') + 1).at(-1) ?? '';
  const text = cleanText($('.postHeader p.description').first().html() ?? '');
  return { kategorie: pfad.includes('Kultur') ? kategorie : '', text };
}

/** Kurze Beschreibung und Unterpunkt-Hinweis aus den Angaben der Veranstaltungsseite. */
function angaben({ kategorie, text }, art) {
  const kleinkunst = KLEINKUNST.test(kategorie);
  const ganz = [kleinkunst ? `${kategorie}.` : '', text].filter(Boolean).join(' ');
  return { beschreibung: ganz ? shorten(ganz, BESCHREIBUNG_MAX) : null, genre: kleinkunst ? 'kabarett' : detectSorte(art, kategorie) };
}

/** Alle Seiten der Übersicht. Die erste muss antworten; danach beendet eine fehlende Seite (404) das Blättern. */
async function alleSeiten(http, config, opts, letzterTag) {
  const eintraege = [];
  for (let seite = 1; seite <= (config.maxPages ?? 8); seite += 1) {
    const url = seite === 1 ? config.listUrl : new URL(`page/${seite}/`, config.listUrl).href;
    let body;
    try {
      ({ body } = await http.get(url, opts));
    } catch (err) {
      if (seite > 1 && err?.status === 404) break;
      throw err;
    }
    const gefunden = leseListe(body, config.listUrl);
    if (!gefunden.length) break;
    eintraege.push(...gefunden);
    // Die Übersicht ist nach dem nächsten Tag geordnet: liegt eine ganze Seite hinter dem Fenster, ist Schluss.
    if (gefunden.every((e) => e.tage[0].tag > letzterTag)) break;
  }
  return eintraege;
}

/**
 * Programm der Kulturfabrik Hoyerswerda, Übersicht "Kultur" mit Folgeseiten und je Veranstaltung deren Seite.
 * Zusage vom 26.11.2026 auf eine Anfrage, die nennt: Titel, Datum, Uhrzeit, Ort, eine kurze Beschreibung und den Link
 * zur Veranstaltungsseite; keine Bilder. Abstand je Abruf mindestens 3 Sekunden.
 */
export async function fetchEvents({ http, today, config }) {
  const opts = { as: 'text', minDelayMs: Math.max(config.minDelayMs ?? 3000, 3000) };
  const letzterTag = plusTage(today, config.horizonDays ?? 120);
  const eintraege = await alleSeiten(http, config, opts, letzterTag);
  if (!eintraege.length) throw new Error('Kulturfabrik: keine Termine in der Übersicht gefunden');

  const events = [];
  const gesehen = new Set();
  let abrufe = 0;
  for (const e of eintraege) {
    const tage = e.tage.filter((t) => t.tag >= today && t.tag <= letzterTag);
    if (!tage.length || gesehen.has(e.url)) continue;
    gesehen.add(e.url);
    let detail = { kategorie: '', text: '' };
    if (abrufe < (config.maxDetailPages ?? 40)) {
      abrufe += 1;
      try {
        detail = leseDetail((await http.get(e.url, opts)).body);
      } catch { /* Termin bleibt mit den Angaben der Übersicht */ }
    }
    const art = normalizeArt(detail.kategorie, e.title);
    const { beschreibung, genre } = angaben(detail, art);
    for (const { tag, uhr } of tage) {
      const start = berlinIso(tag, uhr);
      events.push(makeEvent({
        sourceName: QUELLE,
        sourceId: `${e.url}#${start}`,
        sourceUrl: e.url,
        title: e.title,
        art,
        genre,
        start,
        hasTime: Boolean(uhr),
        placeName: ORT,
        contact: { url: e.url },
        description: beschreibung,
      }));
    }
  }
  return events;
}
