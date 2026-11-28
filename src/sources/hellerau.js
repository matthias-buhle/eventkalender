import { makeEvent } from '../model.js';
import { berlinIso, plusTage } from '../time.js';
import { cleanText, detectStatus } from '../normalize.js';

export const name = 'hellerau';

const QUELLE = 'HELLERAU';
// Räume des Festspielhauses und seines Geländes; alles andere (tjg., Staatsschauspiel) ist ein fremdes Haus.
const EIGENER_RAUM = /saal|festspielhaus|besucherzentrum|kulturgarten|portikus|seitenbühne|ostflügel|\bOG\b|dalcroze/i;

/** Die Spielstätte, mit "HELLERAU" davor, wenn es ein eigener Raum ist; die Gemeinde steht hinten. */
function ortVon(venue) {
  const raum = cleanText(venue).replace(/^Treff:\s*/i, '').replace(/^HELLERAU,\s*/i, '');
  if (!raum) return 'HELLERAU, Dresden';
  if (/^auswärts$/i.test(raum)) return 'HELLERAU (auswärts), Dresden';
  return EIGENER_RAUM.test(raum) ? `HELLERAU, ${raum}, Dresden` : `${raum}, Dresden`;
}

/** Die Seite liefert alle Termine als Liste im Quelltext: `window.calendarEvents = [ … ];`. */
function leseListe(html) {
  const treffer = /window\.calendarEvents\s*=\s*(\[[\s\S]*?\])\s*;\s*(?:window\.|<\/script>)/.exec(html);
  if (!treffer) return [];
  return JSON.parse(treffer[1]);
}

/** Übernommen wird nur, was zugesagt ist; Untertitel, Mitwirkende, Preis, Bild und Kartenlink bleiben bei HELLERAU. */
function zuEvent(roh) {
  const title = cleanText(roh.title);
  const uhr = /^\d{2}:\d{2}$/.test(roh.time ?? '') ? roh.time : null;
  const start = berlinIso(roh.date, uhr);
  return makeEvent({
    // Dasselbe Stück läuft an vielen Abenden: erst Link plus Beginn macht den Termin eindeutig.
    sourceName: QUELLE,
    sourceId: `${roh.uri}#${start}`,
    sourceUrl: roh.uri,
    title,
    art: 'sonstiges',
    start,
    hasTime: Boolean(uhr),
    placeName: ortVon(roh.venue),
    contact: { url: roh.uri },
    ticketStatus: detectStatus(title),
    description: null,
  });
}

/**
 * Spielplan von HELLERAU – Europäisches Zentrum der Künste (eine Seite, ein Abruf). Zusage vom 27.11.2026 auf eine
 * Anfrage, die nennt: Titel, Datum, Uhrzeit, Spielstätte und den Link zur Veranstaltung; eine Beschreibung nur mit
 * Erlaubnis, keine Bilder. Eine ausdrückliche Erlaubnis für Beschreibungen gab es nicht, darum bleiben sie weg.
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url, { as: 'text' });
  const alle = leseListe(body).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r?.date ?? '') && cleanText(r.title) && r.uri);
  if (!alle.length) throw new Error('HELLERAU: keine Termine in der Seite gefunden');
  const letzterTag = plusTage(today, config.horizonDays ?? 120);
  return alle.filter((r) => r.date >= today && r.date <= letzterTag).map(zuEvent);
}
