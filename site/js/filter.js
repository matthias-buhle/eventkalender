// Reine Funktionen für Filter, Gruppierung und gespeicherte Einstellungen. Kein Zugriff auf window oder document.

/**
 * ort: Mitte des Umkreises (Name aus dem Ortsverzeichnis) oder null für Sebnitz.
 * zeit: 'alle' | 'heute' | 'wochenende' | '7' | '30' | 'bereich' (dann gelten von/bis, JJJJ-MM-TT).
 * @typedef {{hiddenArt:string[], hiddenTags:string[], maxKm:number, showCZ:boolean, ort:string|null, zeit:string, von:string|null, bis:string|null}} Prefs
 */

const SCHLUESSEL = 'eventkalender.prefs';
export const ZEITEN = ['alle', 'heute', 'wochenende', '7', '30', 'bereich'];
const TAG = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** @type {Prefs} */
export const DEFAULT_PREFS = Object.freeze({ hiddenArt: [], hiddenTags: [], maxKm: 75, showCZ: true, ort: null, zeit: 'alle', von: null, bis: null });

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;

/** Luftlinie in km (Haversine); dieselbe Rechnung wie src/geo.js, das die Seite nicht laden kann. */
function luftlinieKm(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function tagPlus(tag, n) {
  const d = new Date(`${tag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Das Tagesfenster {von, bis} (bis null = offen) einer Zeitraum-Einstellung. `von` ist nie vor heute.
 * Wochenende heißt Freitag bis Sonntag; am Wochenende selbst gilt der Rest davon.
 */
export function zeitfenster(prefs, heute) {
  switch (prefs.zeit) {
    case 'heute': return { von: heute, bis: heute };
    case '7': return { von: heute, bis: tagPlus(heute, 6) };
    case '30': return { von: heute, bis: tagPlus(heute, 29) };
    case 'wochenende': {
      const wochentag = new Date(`${heute}T00:00:00Z`).getUTCDay(); // 0 = Sonntag
      if (wochentag === 0) return { von: heute, bis: heute };
      if (wochentag === 6) return { von: heute, bis: tagPlus(heute, 1) };
      const freitag = tagPlus(heute, 5 - wochentag);
      return { von: freitag, bis: tagPlus(freitag, 2) };
    }
    case 'bereich': {
      let [von, bis] = [prefs.von, prefs.bis];
      if (von && bis && von > bis) [von, bis] = [bis, von];
      return { von: von && von > heute ? von : heute, bis: bis ?? null };
    }
    default: return { von: heute, bis: null };
  }
}

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
 * @param {Record<string,{lat:number,lon:number}>} [orte] Koordinaten der wählbaren Orte (für die Mitte des Umkreises)
 */
export function applyFilters(events, prefs, nowIso, orte = {}) {
  const heute = berlinDay(nowIso);
  const fenster = zeitfenster(prefs, heute);
  const mitte = prefs.ort ? orte[prefs.ort] : null;
  return events.filter((e) => {
    if (lastDay(e) < fenster.von) return false;
    if (fenster.bis && e.start.slice(0, 10) > fenster.bis) return false;
    if (prefs.hiddenArt.includes(e.art)) return false;
    if ((e.tags ?? []).some((t) => prefs.hiddenTags.includes(t))) return false;
    if (mitte) {
      if (Number.isFinite(e.lat) && Number.isFinite(e.lon) && luftlinieKm(mitte, e) > prefs.maxKm) return false;
    } else if (e.distanceKm != null && e.distanceKm > prefs.maxKm) return false;
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
      ort: typeof roh.ort === 'string' && roh.ort ? roh.ort : null,
      zeit: ZEITEN.includes(roh.zeit) ? roh.zeit : 'alle',
      von: TAG.test(roh.von) ? roh.von : null,
      bis: TAG.test(roh.bis) ? roh.bis : null,
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
