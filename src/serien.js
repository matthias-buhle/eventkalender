import { createHash } from 'node:crypto';
import { fold, resolvePlace, distanceKm } from './geo.js';

/** Mehr als so viele Tage zwischen zwei Terminen trennen eine Serie. */
export const SERIEN_LUECKE_TAGE = 42;
/** Diese Rubriken bilden nie Serien. */
export const OHNE_SERIE = Object.freeze(['theater', 'konzert']);

/** Einträge mit Koordinaten, die weiter als so viele Meter auseinander liegen, sind verschiedene Spielstätten (verschiedene Serien). */
export const SERIEN_ORT_METER = 300;

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

/** Kennung der Serie; die erste Stätte einer Gruppe wie bisher, jede weitere mit ihrer laufenden Nummer. */
function kennung(schluessel, ersterTag, nummer) {
  const text = nummer === 1 ? `${schluessel}|${ersterTag}` : `${schluessel}|${ersterTag}|${nummer}`;
  return `s${createHash('sha1').update(text).digest('hex').slice(0, 10)}`;
}

const hatKoordinaten = (e) => Number.isFinite(e.lat) && Number.isFinite(e.lon);
const tagVon = (e) => e.start.slice(0, 10);

/**
 * Verteilt die Einträge einer Schlüsselgruppe (Indizes, nach start sortiert) auf Spielstätten.
 * Mit Koordinaten: die erste Stätte, deren Bezugspunkt höchstens SERIEN_ORT_METER entfernt ist.
 * Ohne Koordinaten: die erste Stätte mit gleichem gefaltetem placeName. Sonst eröffnet der Eintrag eine neue Stätte.
 */
function nachStaetten(events, indizes) {
  const staetten = [];
  for (const i of indizes) {
    const e = events[i];
    const name = fold(e.placeName);
    let st;
    if (hatKoordinaten(e)) {
      st = staetten.find((s) => s.punkt && distanceKm(s.punkt, e) * 1000 <= SERIEN_ORT_METER)
        ?? staetten.find((s) => !s.punkt && s.namen.has(name));
      if (st && !st.punkt) st.punkt = { lat: e.lat, lon: e.lon };
    } else {
      st = staetten.find((s) => s.namen.has(name));
    }
    if (!st) {
      st = { punkt: hatKoordinaten(e) ? { lat: e.lat, lon: e.lon } : null, namen: new Set(), indizes: [] };
      staetten.push(st);
    }
    st.namen.add(name);
    st.indizes.push(i);
  }
  return staetten.map((s) => s.indizes);
}

/**
 * Erkennt Serien: gleicher Titel, Ort, Rubrik und Unterpunkt, Lücken bis SERIEN_LUECKE_TAGE Tage; mehrere
 * Spielstätten eines Orts (weiter als SERIEN_ORT_METER auseinander) bilden getrennte Serien.
 * Gibt Kopien mit Feldern serie (Kennung oder null) und endeOffen zurück, in der Reihenfolge der Eingabe; die Eingabe bleibt unverändert.
 * endeOffen: das Ende der Serie ist unbekannt, weil die Terminliste der Quelle voll ist oder die Serie bis an den Rand
 * reicht, den die Quelle vorausschaut (letzter Tag + größter Abstand liegt hinter dem spätesten Tag der Quelle).
 * @param {import('./model.js').Event[]} events
 * @returns {{events: (import('./model.js').Event)[], serien: number, termine: number, offen: number}}
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
  const ketten = [];
  for (const [k, indizes] of gruppen) {
    indizes.sort((a, b) => events[a].start.localeCompare(events[b].start));
    nachStaetten(events, indizes).forEach((staette, nr) => {
      let kette = [];
      const schliesse = () => {
        if (kette.length >= 2) {
          const id = kennung(k, tagVon(events[kette[0]]), nr + 1);
          for (const i of kette) kennungen[i] = id;
          ketten.push(kette);
        }
        kette = [];
      };
      for (const i of staette) {
        const letzter = kette[kette.length - 1];
        if (letzter !== undefined && tageszahl(events[i].start) - tageszahl(events[letzter].start) > SERIEN_LUECKE_TAGE) schliesse();
        kette.push(i);
      }
      schliesse();
    });
  }

  // Spätester Starttag je Quellenname über die ganze Eingabe: so weit schaut die Quelle voraus.
  const quellenEnde = new Map();
  for (const e of events) {
    const tag = tageszahl(e.start);
    for (const q of e.sources ?? []) {
      if (q?.name && !(quellenEnde.get(q.name) >= tag)) quellenEnde.set(q.name, tag);
    }
  }
  const offen = new Array(events.length).fill(false);
  let offeneKetten = 0;
  for (const kette of ketten) {
    const tage = [...new Set(kette.map((i) => tageszahl(events[i].start)))].sort((a, b) => a - b);
    const letzterTag = tage.at(-1);
    const voll = kette.some((i) => tageszahl(events[i].start) === letzterTag && events[i].terminlisteVoll === true);
    let istOffen = voll;
    if (!istOffen && tage.length >= 2) {
      const abstand = Math.max(...tage.slice(1).map((t, j) => t - tage[j]));
      const enden = kette.flatMap((i) => (events[i].sources ?? []).map((q) => quellenEnde.get(q?.name))).filter((x) => x !== undefined);
      istOffen = enden.length > 0 && letzterTag + abstand > Math.max(...enden);
    }
    if (istOffen) {
      offeneKetten += 1;
      for (const i of kette) offen[i] = true;
    }
  }

  return {
    events: events.map((e, i) => ({ ...e, serie: kennungen[i], endeOffen: offen[i] })),
    serien: ketten.length,
    termine: ketten.reduce((n, kette) => n + kette.length, 0),
    offen: offeneKetten,
  };
}
