import { createHash } from 'node:crypto';
import { fold, resolvePlace } from './geo.js';

/** Mehr als so viele Tage zwischen zwei Terminen trennen eine Serie. */
export const SERIEN_LUECKE_TAGE = 42;
/** Diese Rubriken bilden nie Serien. */
export const OHNE_SERIE = Object.freeze(['theater', 'konzert']);

const TAG_MS = 24 * 60 * 60 * 1000;

/** Kalendertag (JJJJ-MM-TT) als Tageszahl, unabhängig von Zeitzone und Sommerzeit. */
function tageszahl(start) {
  const [j, m, t] = start.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(j, m - 1, t) / TAG_MS);
}

function gruppenSchluessel(e) {
  if (!e.rubrik || OHNE_SERIE.includes(e.rubrik)) return null;
  const ort = typeof e.placeName === 'string' ? e.placeName.trim() : '';
  if (!ort) return null;
  const ortName = resolvePlace(ort)?.name ?? ort;
  return `${fold(e.title)}|${fold(ortName)}|${e.rubrik}|${e.genre ?? ''}`;
}

function kennung(schluessel, ersterTag) {
  return `s${createHash('sha1').update(`${schluessel}|${ersterTag}`).digest('hex').slice(0, 10)}`;
}

/**
 * Erkennt Serien: gleicher Titel, Ort, Rubrik und Unterpunkt, Lücken bis SERIEN_LUECKE_TAGE Tage.
 * Gibt Kopien mit Feld serie (Kennung oder null) in der Reihenfolge der Eingabe zurück; die Eingabe bleibt unverändert.
 * @param {import('./model.js').Event[]} events
 * @returns {{events: (import('./model.js').Event)[], serien: number, termine: number}}
 */
export function markiereSerien(events) {
  const gruppen = new Map();
  events.forEach((e, i) => {
    const k = gruppenSchluessel(e);
    if (k === null) return;
    const liste = gruppen.get(k) ?? [];
    liste.push(i);
    gruppen.set(k, liste);
  });

  const kennungen = new Array(events.length).fill(null);
  let serien = 0;
  let termine = 0;
  for (const [k, indizes] of gruppen) {
    indizes.sort((a, b) => events[a].start.localeCompare(events[b].start));
    let kette = [];
    const schliesse = () => {
      if (kette.length >= 2) {
        const id = kennung(k, events[kette[0]].start.slice(0, 10));
        for (const i of kette) kennungen[i] = id;
        serien += 1;
        termine += kette.length;
      }
      kette = [];
    };
    for (const i of indizes) {
      const letzter = kette[kette.length - 1];
      if (letzter !== undefined && tageszahl(events[i].start) - tageszahl(events[letzter].start) > SERIEN_LUECKE_TAGE) schliesse();
      kette.push(i);
    }
    schliesse();
  }

  return { events: events.map((e, i) => ({ ...e, serie: kennungen[i] })), serien, termine };
}
