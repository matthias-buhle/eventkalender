import { makeEvent } from '../model.js';
import { berlinIso, berlinIsoAt } from '../time.js';
import { cleanText, detectStatus } from '../normalize.js';
import { leseIcal } from './flohmarkt.js';

export const name = 'bluenote';

const QUELLE = 'Blue Note Dresden';
const HAUS = 'https://bluenote-dresden.de/';
const ORT = 'Blue Note Dresden, Dresden';
const MAX_TERMINE = 400;

/** Löst die iCal-Escape-Zeichen (\n, \, \; \\) auf (wie in flohmarkt.js, dort nicht exportiert). */
function entschluesseln(wert) {
  return wert.replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
}

/**
 * Wandelt DTSTART in { tag, zeit, iso } (Logik wie leseZeit in flohmarkt.js, dort nicht exportiert). Der Feed liefert
 * UTC mit "Z" (19:00Z = 20:00 Uhr im Winter, 21:00 Uhr im Sommer); das wird zur Berliner Ortszeit. Ohne Z gilt
 * Berliner Ortszeit; ohne Uhrzeit (VALUE=DATE) ist zeit null.
 */
function leseZeit(feld) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(feld?.wert?.trim() ?? '');
  if (!m) return null;
  const tag = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] === undefined) return { tag, zeit: null, iso: berlinIso(tag, null) };
  if (m[7]) {
    const iso = berlinIsoAt(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return { tag: iso.slice(0, 10), zeit: iso.slice(11, 16), iso };
  }
  const zeit = `${m[4]}:${m[5]}`;
  return { tag, zeit, iso: berlinIso(tag, zeit) };
}

/** Der Link zur Veranstaltung: die URL aus dem Feed, wenn sie auf der Seite des Hauses liegt, sonst die Startseite des Hauses. */
function terminLink(wert) {
  try {
    const u = new URL(String(wert ?? '').trim());
    if ((u.protocol === 'https:' || u.protocol === 'http:') && /(^|\.)bluenote-dresden\.de$/i.test(u.hostname)) return u.href;
  } catch { /* leer oder keine Adresse */ }
  return HAUS;
}

/**
 * Hinweis für den Unterpunkt des Konzerts. Beschreibungen werden bewusst nicht gelesen; das Haus ist ein Jazzclub,
 * deshalb gilt "jazz", außer die Adresse der Veranstaltung nennt die Songwriter-Reihe ("Take Note Songwriter
 * Sessions": Rock & Pop) oder eine offene Bühne (Open Mic: kein Hinweis, die Einordnung bleibt offen).
 */
function genreHinweis(link) {
  const pfad = new URL(link).pathname.toLowerCase();
  if (/songwriter/.test(pfad)) return 'rock-pop';
  if (/open-mic/.test(pfad)) return null;
  return 'jazz';
}

function zuEvent(roh) {
  const titel = roh.SUMMARY ? cleanText(entschluesseln(roh.SUMMARY.wert)) : '';
  const start = leseZeit(roh.DTSTART);
  if (!titel || !start) return null;
  const link = terminLink(roh.URL?.wert);
  const uid = roh.UID?.wert?.trim() || `${link}#${start.iso}`;
  return makeEvent({
    sourceName: QUELLE,
    sourceId: uid,
    sourceUrl: link,
    title: titel,
    art: 'konzert',
    genre: genreHinweis(link),
    start: start.iso,
    // Das Ende fehlt bei einem Teil der Termine, bei allen anderen steht es genau zwei Stunden nach dem Beginn
    // (ein Platzhalter): nur der Beginn wird übernommen.
    end: null,
    hasTime: start.zeit !== null,
    placeName: ORT,
    contact: { url: link },
    ticketStatus: /^CANCELLED$/i.test(roh.STATUS?.wert?.trim() ?? '') ? 'abgesagt' : detectStatus(titel),
    // Zugesagt: nur Titel, Datum und Uhrzeit, Ort und Link; keine Beschreibung, keine Bilder.
    description: null,
  });
}

/**
 * Konzerte des Blue Note Dresden (Jazzclub) aus dem iCal-Feed des Hauses, ein Abruf pro Lauf. Der Feed reicht rund ein
 * Jahr voraus und enthält auch bereits vergangene Termine; übernommen werden die ab heute, höchstens 400.
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url, { as: 'text' });
  const roh = leseIcal(body);
  if (!roh.length) throw new Error('bluenote: keine Termine im iCal-Feed gefunden');
  const bekannt = new Set();
  const events = [];
  for (const r of roh) {
    const e = zuEvent(r);
    if (!e || bekannt.has(e.id)) continue;
    bekannt.add(e.id);
    if (e.start.slice(0, 10) >= today) events.push(e);
  }
  return events.slice(0, MAX_TERMINE);
}
