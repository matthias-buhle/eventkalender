// Reine Funktionen für Filter, Gruppierung und gespeicherte Einstellungen. Kein Zugriff auf window oder document.
import { sorteFilter } from './arten.js';

/**
 * ort: Mitte des Umkreises (Name aus dem Ortsverzeichnis) oder null für Sebnitz.
 * zeit: 'alle' | 'heute' | 'wochenende' | '7' | '30' | '60' (Tage ab heute).
 * hiddenGenres: ausgeblendete Unterarten (Genres der Konzerte, Sorten der Märkte und Schauen), siehe arten.js.
 * suche: Suchtext (wird nicht gespeichert).
 * @typedef {{hiddenArt:string[], hiddenGenres:string[], hiddenTags:string[], maxKm:number, showCZ:boolean, ort:string|null, zeit:string, suche:string}} Prefs
 */

const SCHLUESSEL = 'eventkalender.prefs';
export const ZEITEN = ['alle', 'heute', 'wochenende', '7', '30', '60'];

/** @type {Prefs} */
export const DEFAULT_PREFS = Object.freeze({ hiddenArt: [], hiddenGenres: [], hiddenTags: [], maxKm: 75, showCZ: true, ort: null, zeit: 'alle', suche: '' });

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
    case '60': return { von: heute, bis: tagPlus(heute, 59) };
    case 'wochenende': {
      const wochentag = new Date(`${heute}T00:00:00Z`).getUTCDay(); // 0 = Sonntag
      if (wochentag === 0) return { von: heute, bis: heute };
      if (wochentag === 6) return { von: heute, bis: tagPlus(heute, 1) };
      const freitag = tagPlus(heute, 5 - wochentag);
      return { von: freitag, bis: tagPlus(freitag, 2) };
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
 * Vergleichsform für die Suche: Kleinschreibung ohne Akzente und Umlautpunkte, ß als ss, ae/oe/ue als a/o/u.
 * Beide Seiten werden gleich behandelt, daher findet "goerlitz" ebenso "Görlitz" wie "gorlitz".
 */
function glatt(text) {
  return String(text ?? '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/([aou])e/g, '$1');
}

/** Passt jedes Wort der Suche irgendwo in Titel, Ort oder Beschreibung? Eine leere Suche passt immer. */
function passtZurSuche(e, woerter) {
  if (!woerter.length) return true;
  const heu = glatt(`${e.title} ${e.placeName} ${e.description}`);
  return woerter.every((w) => heu.includes(w));
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
  const woerter = glatt(prefs.suche).split(/\s+/).filter(Boolean);
  return events.filter((e) => {
    if (lastDay(e) < fenster.von) return false;
    if (fenster.bis && e.start.slice(0, 10) > fenster.bis) return false;
    if (!passtZurSuche(e, woerter)) return false;
    if (prefs.hiddenArt.includes(e.art)) return false;
    if (prefs.hiddenGenres.includes(sorteFilter(e))) return false;
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
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ...DEFAULT_PREFS, hiddenArt: [], hiddenGenres: [], hiddenTags: [] };
    return {
      hiddenArt: stringListe(roh.hiddenArt),
      hiddenGenres: stringListe(roh.hiddenGenres),
      hiddenTags: stringListe(roh.hiddenTags),
      maxKm: Number.isFinite(roh.maxKm) && roh.maxKm > 0 ? Math.min(roh.maxKm, DEFAULT_PREFS.maxKm) : DEFAULT_PREFS.maxKm,
      showCZ: typeof roh.showCZ === 'boolean' ? roh.showCZ : DEFAULT_PREFS.showCZ,
      ort: typeof roh.ort === 'string' && roh.ort ? roh.ort : null,
      zeit: ZEITEN.includes(roh.zeit) ? roh.zeit : 'alle',
      suche: '',
    };
  } catch {
    return { ...DEFAULT_PREFS, hiddenArt: [], hiddenGenres: [], hiddenTags: [] };
  }
}

/** Speichert die Einstellungen; ein Fehler (voll, gesperrt, privater Modus) bleibt folgenlos. */
export function savePrefs(storage, prefs) {
  try {
    const { suche, ...gemerkt } = prefs; // der Suchtext gilt nur für die offene Seite
    storage?.setItem(SCHLUESSEL, JSON.stringify(gemerkt));
  } catch { /* Einstellungen gelten dann nur für diese Sitzung */ }
}
