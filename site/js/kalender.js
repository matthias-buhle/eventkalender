// Reine Kalenderlogik für die Filterseite (Monatsansicht). Kein Zugriff auf window oder document.
import { applyFilters, berlinDay, lastDay, tagPlus, zeitfenster } from './filter.js';

/** Wie viele Tage der Kalender nach heute noch Termine zeigt. */
export const HORIZONT_TAGE = 400;

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/**
 * Die Tage (JJJJ-MM-TT), an denen mindestens ein Termin läuft, der alle Filter außer dem Zeitraum erfüllt.
 * Nie vor heute, höchstens HORIZONT_TAGE Tage danach; ein mehrtägiger Termin zählt an jedem Tag von max(Start, heute) bis lastDay.
 * @returns {Set<string>}
 */
export function tageMitTerminen(events, prefs, nowIso, orte = {}) {
  const heute = berlinDay(nowIso);
  const letzter = tagPlus(heute, HORIZONT_TAGE);
  const tage = new Set();
  for (const e of applyFilters(events, prefs, nowIso, orte, { ohneZeit: true })) {
    const start = e.start.slice(0, 10);
    const ende = lastDay(e);
    const bis = ende < letzter ? ende : letzter;
    for (let tag = start > heute ? start : heute; tag <= bis; tag = tagPlus(tag, 1)) tage.add(tag);
  }
  return tage;
}

/** Die Monate (JJJJ-MM) aufsteigend, in denen es Tage mit Terminen gibt; der Monat von heute ist immer dabei. */
export function monateMitTerminen(tage, heute) {
  const monate = new Set([heute.slice(0, 7)]);
  for (const tag of tage) monate.add(tag.slice(0, 7));
  return [...monate].sort();
}

/** Die 42 Zellen (6 Wochen ab Montag) eines Monats JJJJ-MM: Tage als JJJJ-MM-TT, davor und danach null. */
export function monatsRaster(monat) {
  const erster = new Date(`${monat}-01T00:00:00Z`);
  const davor = (erster.getUTCDay() + 6) % 7; // Montag = 0
  const tageImMonat = new Date(Date.UTC(erster.getUTCFullYear(), erster.getUTCMonth() + 1, 0)).getUTCDate();
  const zellen = Array(davor).fill(null);
  for (let t = 1; t <= tageImMonat; t += 1) zellen.push(`${monat}-${String(t).padStart(2, '0')}`);
  while (zellen.length < 42) zellen.push(null);
  return zellen;
}

/** "November 2026" für "2026-11". */
export function monatsName(monat) {
  return `${MONATE[Number(monat.slice(5, 7)) - 1]} ${monat.slice(0, 4)}`;
}

/**
 * Die neue Tage-Auswahl nach dem Antippen eines Tages. Ein Einzeltag ist zeit 'tage' mit von === bis.
 * Zweiter Tipp auf einen späteren Tag bei einem Einzeltag ergibt den Zeitraum von … bis; in allen anderen Fällen
 * (erster Tipp, früherer Tag, schon ein Zeitraum, offenes Ende) wird der Tag ein neuer Einzeltag. Derselbe Tag bleibt Einzeltag.
 * Vergangene Tage werden nicht beschnitten; die Oberfläche sperrt sie.
 */
export function tagWaehlen(prefs, tag) {
  const einzeltag = prefs.zeit === 'tage' && typeof prefs.von === 'string' && prefs.von === prefs.bis;
  if (einzeltag && tag > prefs.von) return { zeit: 'tage', von: prefs.von, bis: tag };
  return { zeit: 'tage', von: tag, bis: tag };
}

/**
 * Das Fenster {von, bis} der Zeitwahl für die Hervorhebung im Kalender; null bei 'alle' (nichts zu markieren).
 * Eine Tage-Auswahl mit offenem Ende reicht bis zum Kalenderende (heute plus HORIZONT_TAGE), `bis` ist also nie null.
 */
export function markierterBereich(prefs, heute) {
  if (prefs.zeit === 'alle' || !prefs.zeit) return null;
  const { von, bis } = zeitfenster(prefs, heute);
  return { von, bis: bis ?? tagPlus(heute, HORIZONT_TAGE) };
}
