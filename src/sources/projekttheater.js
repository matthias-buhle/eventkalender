import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso, parseGermanDate } from '../time.js';
import { cleanText, shorten } from '../normalize.js';

export const name = 'projekttheater';

const QUELLE = 'projekttheater dresden';
const ORT = 'projekttheater dresden, Dresden';

// Die Kategorie der Seite (tanz, theater, musik, ausstellung) bestimmt nur dort die Art, wo sie eindeutig ist;
// Theater und Tanz bleiben "sonstiges" und werden über den Spielort "projekttheater" einsortiert.
const ART = { musik: 'konzert', ausstellung: 'schau' };

/** Monate (`{ jahr, monat }`), in denen laut der JavaScript-Liste der Seite Termine liegen. */
function leseMonate(html) {
  const m = /const\s+veranstaltungen\s*=\s*(\[[\s\S]*?\])\s*;/.exec(html);
  if (!m) return [];
  let liste;
  try { liste = JSON.parse(m[1]); } catch { return []; }
  const monate = new Map();
  for (const eintrag of Array.isArray(liste) ? liste : []) {
    const tag = parseGermanDate(eintrag?.[0]);
    if (tag) monate.set(tag.slice(0, 7), { jahr: Number(tag.slice(0, 4)), monat: Number(tag.slice(5, 7)) });
  }
  return [...monate.values()].sort((a, b) => a.jahr - b.jahr || a.monat - b.monat);
}

/** Liest die Terminzeilen einer Monatsansicht: Datum, Uhrzeit, Titel, Untertitel, Kategorie, Links. */
function leseMonat(html, basis) {
  const $ = cheerio.load(html);
  return $('.va-liste > div').map((_, el) => {
    const block = $(el);
    const datumBox = block.find('.va-datum').first();
    const tag = parseGermanDate(datumBox.clone().children().remove().end().text());
    const a = block.find('.va-info h3 a').first();
    const href = a.attr('href')?.trim();
    const titel = cleanText(a.text());
    if (!tag || !href || !titel) return null;
    const zeit = /(\d{1,2}):(\d{2})/.exec(datumBox.find('div').text());
    const kategorie = cleanText(block.find('.va-kategorie').first().clone().find('.premiere').remove().end().text()).toLowerCase();
    const ticket = block.find('a.va.btn').filter((__, b) => /ticket/i.test($(b).text())).attr('href')?.trim();
    return {
      tag,
      zeit: zeit ? `${zeit[1].padStart(2, '0')}:${zeit[2]}` : null,
      title: titel,
      url: new URL(href, basis).href,
      untertitel: cleanText(block.find('.va-info p').first().html()?.replace(/<br\s*\/?>/gi, ' · ')),
      kategorie,
      ticketUrl: ticket ? new URL(ticket, basis).href : null,
    };
  }).get().filter(Boolean);
}

/** Beschreibung und Saal der Inszenierungsseite. */
function leseDetail(html) {
  const $ = cheerio.load(html);
  return {
    text: cleanText($('.inhalt').first().html()),
    saal: cleanText($('.vaort').first().text()),
  };
}

function zuEvent(eintrag, detail) {
  const beschreibung = [eintrag.untertitel, detail?.text].filter(Boolean).join(' – ');
  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${eintrag.url}#${eintrag.tag}T${eintrag.zeit ?? ''}`,
    sourceUrl: eintrag.url,
    title: eintrag.title,
    art: ART[eintrag.kategorie] ?? 'sonstiges',
    start: berlinIso(eintrag.tag, eintrag.zeit),
    hasTime: Boolean(eintrag.zeit),
    placeName: ORT,
    contact: { url: eintrag.url },
    ticketUrl: eintrag.ticketUrl,
    description: shorten(beschreibung, 300) || null,
  });
}

/**
 * Spielplan des projekttheaters dresden. Die Seite zeigt je Monat alle Termine mit Datum, Uhrzeit, Titel und Kategorie;
 * eine JavaScript-Liste in der Seite verrät, in welchen Monaten es Termine gibt. Geladen werden die Startseite des Spielplans,
 * dazu jeder weitere Monat mit Terminen (höchstens maxMonths) und je Inszenierung einmal die Einzelseite für den Text
 * (höchstens maxDetailPages). Alle Abrufe mit Abstand minDelayMs.
 */
export async function fetchEvents({ http, today, config }) {
  const opts = { as: 'text', minDelayMs: config.minDelayMs ?? 5000 };
  const { body } = await http.get(config.listUrl, opts);
  const monate = leseMonate(body);
  let eintraege = leseMonat(body, config.listUrl);
  if (!eintraege.length && !monate.length) throw new Error('projekttheater: keine Termine in der Seite gefunden');

  // Die Startseite zeigt einen Monat; weil nur Monate mit Terminen in der Liste stehen, genügt es, die Monate ihrer Termine zu kennen.
  const abgedeckt = new Set(eintraege.map((e) => e.tag.slice(0, 7)));
  const weitere = monate
    .map(({ jahr, monat }) => `${jahr}-${String(monat).padStart(2, '0')}`)
    .filter((m) => m >= today.slice(0, 7) && !abgedeckt.has(m))
    .slice(0, config.maxMonths ?? 12);
  for (const m of weitere) {
    try {
      const url = new URL(config.listUrl);
      url.searchParams.set('start_month', String(Number(m.slice(5, 7))));
      url.searchParams.set('start_year', m.slice(0, 4));
      const antwort = await http.get(url.href, opts);
      eintraege.push(...leseMonat(antwort.body, config.listUrl));
    } catch { /* ein Monat fehlt, die übrigen bleiben */ }
  }

  const bekannt = new Set();
  eintraege = eintraege
    .filter((e) => e.tag >= today)
    .filter((e) => {
      const schluessel = `${e.url}#${e.tag}T${e.zeit}`;
      if (bekannt.has(schluessel)) return false;
      bekannt.add(schluessel);
      return true;
    })
    .sort((a, b) => `${a.tag}T${a.zeit ?? ''}`.localeCompare(`${b.tag}T${b.zeit ?? ''}`));

  // Höchstens ein Abruf je Inszenierung, nur für Termine, die bleiben.
  const details = new Map();
  for (const url of [...new Set(eintraege.map((e) => e.url))].slice(0, config.maxDetailPages ?? 40)) {
    try {
      details.set(url, leseDetail((await http.get(url, opts)).body));
    } catch { /* Termin bleibt mit dem Untertitel der Liste */ }
  }
  return eintraege.map((e) => zuEvent(e, details.get(e.url)));
}
