import * as cheerio from 'cheerio';
import { makeEvent } from '../model.js';
import { berlinIso, imFenster, plusTage } from '../time.js';
import { cleanText, detectStatus, normalizeArt, shorten } from '../normalize.js';

export const name = 'schmalspurbahn';

const QUELLE = 'Zittauer Schmalspurbahn';
const BESCHREIBUNG_MAX = 300;
// Die Seiten nennen keinen Veranstaltungsort; die Züge gehen in Zittau ab.
const ABFAHRT = { placeName: 'Zittauer Schmalspurbahn, Zittau' };
const OYBIN = { placeName: 'Bahnhof Oybin, Oybin', lat: 50.842, lon: 14.744, country: 'DE' };
// Hinweise zum Fahrplan, keine Veranstaltungen.
const FAHRPLAN = /^zusätzliche .*züge$/i;
// Der Stand der Karten steht vor dem Titel: "Ausverkauft - Silvesterzug".
const STAND_VORNE = /^(?:ausverkauft|abgesagt|ausgebucht)\s*[-–:]\s*/i;

const iso = (t, m, j) => `${j}-${m}-${t}`;

/** Je Eintrag der Übersicht: Titel, erster und letzter Tag, Veranstaltungsseite. */
function leseListe(html, listUrl) {
  const $ = cheerio.load(html);
  return $('a.results-event-wrapper').toArray().map((el) => {
    const e = $(el);
    const roh = cleanText(e.find('.results-event-title').text());
    const id = /[?&]event=(\d+)/.exec(e.attr('href') ?? '')?.[1];
    const [von, bis] = [...e.find('.results-event-date').text().matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)].map(([, t, m, j]) => iso(t, m, j));
    if (!roh || !id || !von) return null;
    return {
      id,
      title: roh.replace(STAND_VORNE, ''),
      status: detectStatus(roh),
      url: new URL(`?event=${id}`, listUrl).href,
      tag: von,
      endTag: bis && bis > von ? bis : null,
    };
  }).filter(Boolean);
}

/** Nur die Absätze vor der ersten Zwischenüberschrift; danach folgen Lagepläne, Buchung und Telefon. Bilder bleiben ungelesen. */
function leseBeschreibung(html) {
  const $ = cheerio.load(html);
  const absaetze = [];
  for (const el of $('.results-details-content').children().toArray()) {
    if (/^h\d$/i.test(el.tagName)) break;
    if (el.tagName === 'p') absaetze.push(cleanText($(el).html() ?? ''));
  }
  const text = absaetze.filter(Boolean).join(' ');
  return text ? shorten(text, BESCHREIBUNG_MAX) : null;
}

function zuEvent(t, beschreibung) {
  return makeEvent({
    sourceName: QUELLE,
    sourceId: t.id,
    sourceUrl: t.url,
    title: t.title,
    art: normalizeArt('', t.title),
    start: berlinIso(t.tag, null),
    end: t.endTag ? berlinIso(t.endTag, null) : null,
    hasTime: false,
    ...(/bahnhof oybin/i.test(t.title) ? OYBIN : ABFAHRT),
    contact: { url: t.url },
    ticketStatus: t.status,
    description: beschreibung,
  });
}

/**
 * Veranstaltungskalender der Zittauer Schmalspurbahn: eine Übersicht, dazu je Titel eine Veranstaltungsseite.
 * Zusage vom 27.11.2026 auf eine Anfrage, die nennt: Titel, Datum, Uhrzeit, Ort, eine kurze Beschreibung und den Link;
 * keine Bilder. Die Zusage bittet nur um Nachsicht, falls sich ihr Provider meldet: darum wenige Abrufe mit Abstand.
 */
export async function fetchEvents({ http, today, config }) {
  const opts = { as: 'text', minDelayMs: Math.max(config.minDelayMs ?? 5000, 5000) };
  const alle = leseListe((await http.get(config.listUrl, opts)).body, config.listUrl);
  if (!alle.length) throw new Error('Schmalspurbahn: keine Termine in der Übersicht gefunden');
  const letzterTag = plusTage(today, config.horizonDays ?? 120);
  const termine = alle.filter((t) => !FAHRPLAN.test(t.title) && imFenster(t.tag, t.endTag, today, letzterTag));

  // Die Wiederholungen eines Titels haben denselben Text: eine Seite reicht für alle.
  const texte = new Map();
  const events = [];
  for (const t of termine) {
    if (!texte.has(t.title)) {
      let text = null;
      if (texte.size < (config.maxDetailPages ?? 15)) {
        try {
          text = leseBeschreibung((await http.get(t.url, opts)).body);
        } catch { /* Termin bleibt mit den Angaben der Übersicht */ }
      }
      texte.set(t.title, text);
    }
    events.push(zuEvent(t, texte.get(t.title)));
  }
  return events;
}
