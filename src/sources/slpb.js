import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso, imFenster, plusTage } from '../time.js';
import { cleanText, normalizeArt, shorten } from '../normalize.js';

export const name = 'slpb';

const QUELLE = 'Sächsische Landeszentrale für politische Bildung';
const LISTE = 'https://www.slpb.de/veranstaltungen';
// Orte, die keine sind: Termine im Netz stehen mit "online" im Ortsfeld, manche ohne jede Ortsangabe.
const IM_NETZ = /^(?:online|digital|virtuell|im netz|im internet|zoom|webinar)\b/i;

/**
 * Zerlegt die Zeitangabe der Karte in Start und Ende. Gesehen sind
 * "25.11.2026, 19:00 – 21:00 Uhr" (ein Tag mit Uhrzeit) und "03.09.2026 – 20.12.2026" (Zeitraum ohne Uhrzeit);
 * "01.12.2026, 10:00 Uhr – 02.12.2026, 16:00 Uhr" wird mitgelesen.
 */
export function leseZeit(text) {
  const teile = [];
  for (const m of String(text ?? '').matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})|(\d{1,2}):(\d{2})/g)) {
    if (m[3]) teile.push({ tag: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, zeiten: [] });
    else if (teile.length) teile.at(-1).zeiten.push(`${m[4].padStart(2, '0')}:${m[5]}`);
  }
  if (!teile.length) return null;
  const [von, bis] = teile;
  const start = { tag: von.tag, zeit: von.zeiten[0] ?? null };
  let ende = null;
  if (bis && bis.tag !== von.tag) ende = { tag: bis.tag, zeit: bis.zeiten[0] ?? null };
  else if (von.zeiten[1]) ende = { tag: von.tag, zeit: von.zeiten[1] };
  else if (bis?.zeiten[0]) ende = { tag: von.tag, zeit: bis.zeiten[0] };
  return { start, ende };
}

/** "Crimmitschau, Tuchfabrik" (Ort zuerst) wird "Tuchfabrik, Crimmitschau"; ein bloßer Ortsname bleibt, wie er ist. */
function ortAlsName(roh) {
  const t = cleanText(roh);
  const komma = t.indexOf(',');
  if (komma < 0) return t;
  const stadt = t.slice(0, komma).trim();
  const haus = t.slice(komma + 1).trim();
  return haus ? `${haus}, ${stadt}` : stadt;
}

/** Der Typ ("Vortrag mit Diskussion", "Lesung", "Bildungsreise / Exkursion / Führung") als kurzer Titelzusatz. */
function typZusatz(typ) {
  const erster = cleanText(typ).split(/\s+\/\s+/)[0];
  return /^begleitveranstaltung\b/i.test(erster) ? 'Begleitveranstaltung' : erster;
}

/** Liest die Karten einer Listenseite: Titel, Link, Zeit, Ort, Typ und Kurztext. */
export function leseListe(html, listUrl) {
  const $ = cheerio.load(html);
  const karten = $('.event-list-items .card').map((_, el) => {
    const karte = $(el);
    const a = karte.find('h3 a[href]').first();
    const href = a.attr('href')?.trim();
    const titel = cleanText(a.text()).replace(/\s*:$/, '');
    const zeit = leseZeit(cleanText(karte.find('.card-body p').first().find('strong').first().text()));
    if (!href || !titel || !zeit) return null;

    // Ort und Typ stehen in einem span, getrennt durch einen Punkt (span.dot): "Ort, Haus • Typ".
    const ortSpan = karte.find('.card-body p').first().children('span').last();
    let ort = '';
    let typ = '';
    let hinterPunkt = false;
    for (const knoten of ortSpan.contents().toArray()) {
      if (knoten.type === 'tag' && $(knoten).hasClass('dot')) { hinterPunkt = true; continue; }
      const text = $(knoten).text();
      if (hinterPunkt) typ += ` ${text}`; else ort += ` ${text}`;
    }
    const teaser = cleanText(karte.find('.card-body').contents().toArray().filter((n) => n.type === 'text').map((n) => $(n).text()).join(' '));
    return {
      title: titel,
      url: new URL(href, listUrl).href,
      zeit,
      ort: cleanText(ort),
      typ: cleanText(typ),
      teaser,
    };
  }).get().filter(Boolean);

  const weiter = $('.f3-widget-paginator a.next-button[href]').not('.disabled').attr('href');
  return { karten, naechsteSeite: weiter ? new URL(weiter, listUrl).href : null };
}

function zuEvent(k) {
  const { start, ende } = k.zeit;
  const hatZeit = start.zeit !== null;
  const zusatz = k.typ ? typZusatz(k.typ) : '';
  const titel = zusatz && !k.title.toLowerCase().includes(zusatz.toLowerCase()) ? `${k.title} (${zusatz})` : k.title;
  // Begleitgespräche zu einer Ausstellung sind keine Schau: "Ausstellung" im Titel zählt dort nicht für die Art.
  const artTitel = /^Begleitveranstaltung$/.test(zusatz) ? k.title.replace(/ausstellung\w*/gi, '') : k.title;
  const startIso = berlinIso(start.tag, start.zeit);
  const endeIso = ende ? berlinIso(ende.tag, ende.zeit) : null;
  return makeEvent({
    sourceName: QUELLE,
    sourceId: k.url,
    sourceUrl: k.url,
    title: titel,
    art: normalizeArt(zusatz, artTitel),
    start: startIso,
    end: endeIso && endeIso > startIso ? endeIso : null,
    hasTime: hatZeit,
    placeName: ortAlsName(k.ort),
    contact: { url: k.url },
    description: shorten(k.teaser, 300) || null,
  });
}

/**
 * Veranstaltungskalender der Sächsischen Landeszentrale für politische Bildung (sachsenweit, rund 9 Karten je Seite,
 * nach Beginn sortiert). Die Karte nennt schon Tag, Uhrzeit, Ort und Typ; Einzelseiten werden deshalb nicht geladen.
 * Geblättert wird über den Link "nächste" (die Seite ist ein TYPO3-Plugin, die Adresse trägt cHash), höchstens
 * maxPages Seiten und nur, solange noch Termine innerhalb von horizonDays zu erwarten sind. Termine im Netz und
 * solche ohne Ort fallen heraus.
 */
export async function fetchEvents({ http, today, config }) {
  const opts = { as: 'text', minDelayMs: config.minDelayMs ?? 2000 };
  const maxSeiten = config.maxPages ?? 8;
  const letzterTag = plusTage(today, config.horizonDays ?? 90);
  const gesehen = new Set();
  const events = [];
  let adresse = config.url ?? LISTE;
  for (let seite = 1; adresse && seite <= maxSeiten; seite++) {
    const { body } = await http.get(adresse, opts);
    const { karten, naechsteSeite } = leseListe(body, adresse);
    if (seite === 1 && !karten.length) throw new Error('SLpB: keine Termine in der Seite gefunden');
    for (const k of karten) {
      if (gesehen.has(k.url)) continue;
      gesehen.add(k.url);
      if (!k.ort || IM_NETZ.test(k.ort)) continue;
      const { start, ende } = k.zeit;
      if (!imFenster(start.tag, ende?.tag ?? null, today, letzterTag)) continue;
      events.push(zuEvent(k));
    }
    // Die Liste läuft nach Beginn: liegt der letzte Termin dieser Seite hinter dem Fenster, folgt nichts Passendes mehr.
    const letzter = karten.at(-1);
    adresse = letzter && letzter.zeit.start.tag > letzterTag ? null : naechsteSeite;
  }
  return events;
}
