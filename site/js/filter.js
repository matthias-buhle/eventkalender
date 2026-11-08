// Reine Funktionen für Filter, Gruppierung und gespeicherte Einstellungen. Kein Zugriff auf window oder document.

/** @typedef {{hiddenArt:string[], hiddenTags:string[], maxKm:number, showCZ:boolean}} Prefs */

const SCHLUESSEL = 'eventkalender.prefs';

/** @type {Prefs} */
export const DEFAULT_PREFS = Object.freeze({ hiddenArt: [], hiddenTags: [], maxKm: 75, showCZ: true });

const berlinTag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Der Kalendertag (JJJJ-MM-TT) eines Zeitpunkts in Berliner Zeit. */
export function berlinDay(nowIso) {
  return berlinTag.format(new Date(nowIso));
}

function tagDavor(tag) {
  const d = new Date(`${tag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Letzter Kalendertag eines Termins. Ein Ende genau um 00:00 Uhr (mit Uhrzeit) gehört noch zum Vortag. */
export function lastDay(ev) {
  const start = ev.start.slice(0, 10);
  if (!ev.end) return start;
  const ende = ev.end.slice(0, 10);
  const mitternacht = ev.hasTime && ev.end.slice(11, 16) === '00:00' && ende > start;
  return mitternacht ? tagDavor(ende) : ende;
}

/**
 * Filtert nach Einstellungen und entfernt Vergangenes. Ein Termin von heute bleibt bis Tagesende (Berliner Zeit).
 * @param {any[]} events
 * @param {Prefs} prefs
 * @param {string} nowIso
 */
export function applyFilters(events, prefs, nowIso) {
  const heute = berlinDay(nowIso);
  return events.filter((e) => {
    if (lastDay(e) < heute) return false;
    if (prefs.hiddenArt.includes(e.art)) return false;
    if ((e.tags ?? []).some((t) => prefs.hiddenTags.includes(t))) return false;
    if (e.distanceKm != null && e.distanceKm > prefs.maxKm) return false;
    if (!prefs.showCZ && e.country === 'CZ') return false;
    return true;
  });
}

/**
 * Gruppiert nach Starttag, aufsteigend. Mit `fromDay` rutschen schon laufende Termine auf diesen Tag.
 * @param {any[]} events
 * @param {string} [fromDay]
 * @returns {{day:string, events:any[]}[]}
 */
export function groupByDay(events, fromDay) {
  const gruppen = new Map();
  for (const e of [...events].sort((a, b) => a.start.localeCompare(b.start))) {
    let tag = e.start.slice(0, 10);
    if (fromDay && tag < fromDay) tag = fromDay;
    if (!gruppen.has(tag)) gruppen.set(tag, []);
    gruppen.get(tag).push(e);
  }
  return [...gruppen.keys()].sort().map((day) => ({ day, events: gruppen.get(day) }));
}

const stringListe = (wert) => (Array.isArray(wert) ? wert.filter((x) => typeof x === 'string') : []);

/**
 * Liest die Einstellungen; bei fehlendem, gesperrtem oder kaputtem Speicher gilt der Standard.
 * @returns {Prefs}
 */
export function loadPrefs(storage) {
  try {
    const roh = JSON.parse(storage?.getItem(SCHLUESSEL) ?? 'null');
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ...DEFAULT_PREFS, hiddenArt: [], hiddenTags: [] };
    return {
      hiddenArt: stringListe(roh.hiddenArt),
      hiddenTags: stringListe(roh.hiddenTags),
      maxKm: Number.isFinite(roh.maxKm) && roh.maxKm > 0 ? Math.min(roh.maxKm, DEFAULT_PREFS.maxKm) : DEFAULT_PREFS.maxKm,
      showCZ: typeof roh.showCZ === 'boolean' ? roh.showCZ : DEFAULT_PREFS.showCZ,
    };
  } catch {
    return { ...DEFAULT_PREFS, hiddenArt: [], hiddenTags: [] };
  }
}

/** Speichert die Einstellungen; ein Fehler (voll, gesperrt, privater Modus) bleibt folgenlos. */
export function savePrefs(storage, prefs) {
  try {
    storage?.setItem(SCHLUESSEL, JSON.stringify(prefs));
  } catch { /* Einstellungen gelten dann nur für diese Sitzung */ }
}
