// Reine Funktionen für Filter, Zähler, Gruppierung und gespeicherte Einstellungen. Kein Zugriff auf window oder document.
import { RUBRIKEN, SORTEN, rubrikVon, rubrikName, sorteFilter } from './arten.js';

/**
 * rubriken: gewählte Rubriken (Schlüssel aus arten.js); leer heißt alle.
 * hiddenGenres: ausgeblendete Unterarten (siehe SORTEN in arten.js); sie wirken nur, wenn genau eine Rubrik gewählt ist.
 * maxKm: Umkreis, eine der Stufen in UMKREISE. ort: Mitte des Umkreises (Name aus dem Ortsverzeichnis) oder null für Sebnitz.
 * advent: nur Termine mit advent === true.
 * zeit: 'alle' | 'heute' | 'wochenende' | '7' | '30' (Tage ab heute) | 'tage' (eigener Zeitraum von … bis, bis null = offen).
 * zeit, von, bis und suche werden nicht gespeichert; nach dem Laden gilt immer das Wochenende.
 * @typedef {{rubriken:string[], hiddenGenres:string[], hiddenTags:string[], maxKm:10|25|50|75, showCZ:boolean, ort:string|null,
 *   advent:boolean, zeit:'alle'|'heute'|'wochenende'|'7'|'30'|'tage', von:string|null, bis:string|null, suche:string}} Prefs
 */

const SCHLUESSEL = 'eventkalender.prefs';
export const UMKREISE = Object.freeze([10, 25, 50, 75]);
export const ZEITEN = Object.freeze(['alle', 'heute', 'wochenende', '7', '30', 'tage']);
const RUBRIK_KEYS = RUBRIKEN.map((r) => r.key);

/** Der Standard; eingefroren (auch die Listen). loadPrefs liefert davon stets eine eigene, veränderbare Kopie. @type {Readonly<Prefs>} */
export const DEFAULT_PREFS = Object.freeze({
  rubriken: Object.freeze([]), hiddenGenres: Object.freeze([]), hiddenTags: Object.freeze([]), maxKm: 75, showCZ: true, ort: null,
  advent: false, zeit: 'wochenende', von: null, bis: null, suche: '',
});

/** @returns {Prefs} eine frische Kopie des Standards */
const standard = () => ({ ...DEFAULT_PREFS, rubriken: [], hiddenGenres: [], hiddenTags: [] });

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;

/** Luftlinie in km (Haversine); dieselbe Rechnung wie src/geo.js, das die Seite nicht laden kann. */
function luftlinieKm(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Der Kalendertag (JJJJ-MM-TT) n Tage nach `tag` (n darf negativ sein); gerechnet in UTC, daher ohne Sommerzeitsprünge. */
export function tagPlus(tag, n) {
  const d = new Date(`${tag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Das Tagesfenster {von, bis} (bis null = offen) einer Zeitraum-Einstellung. `von` ist nie vor heute.
 * Wochenende heißt Freitag bis Sonntag; am Wochenende selbst gilt der Rest davon.
 * 'tage' nimmt prefs.von (frühestens heute) bis prefs.bis; ein unbekannter Wert gilt wie 'alle'.
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
    case 'tage': {
      const von = typeof prefs.von === 'string' && prefs.von > heute ? prefs.von : heute;
      return { von, bis: typeof prefs.bis === 'string' ? prefs.bis : null };
    }
    default: return { von: heute, bis: null };
  }
}

const berlinTag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Der Kalendertag (JJJJ-MM-TT) eines Zeitpunkts in Berliner Zeit. */
export function berlinDay(nowIso) {
  return berlinTag.format(new Date(nowIso));
}

/** Letzter Kalendertag eines Termins. Ein Ende genau um 00:00 Uhr (mit Uhrzeit) gehört noch zum Vortag. */
export function lastDay(ev) {
  const start = ev.start.slice(0, 10);
  if (!ev.end) return start;
  const ende = ev.end.slice(0, 10);
  const mitternacht = ev.hasTime && ev.end.slice(11, 16) === '00:00' && ende > start;
  return mitternacht ? tagPlus(ende, -1) : ende;
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

/** Die Rubrik, wenn genau eine (bekannte) gewählt ist (nur dann gibt es Unterfilter), sonst null. */
export function einzelneRubrik(rubriken) {
  return Array.isArray(rubriken) && rubriken.length === 1 && RUBRIK_KEYS.includes(rubriken[0]) ? rubriken[0] : null;
}

/**
 * Neue Rubrikwahl nach dem Antippen einer Rubrik: sie kommt dazu oder geht wieder (Reihenfolge wie RUBRIKEN).
 * Leer heißt alle; sind am Ende alle 13 gewählt, heißt das ebenfalls alle (leere Liste). Unbekanntes ändert nichts.
 */
export function rubrikWaehlen(rubriken, key) {
  const jetzt = new Set(rubriken);
  if (RUBRIK_KEYS.includes(key)) {
    if (jetzt.has(key)) jetzt.delete(key);
    else jetzt.add(key);
  }
  const neu = RUBRIK_KEYS.filter((k) => jetzt.has(k));
  return neu.length === RUBRIK_KEYS.length ? [] : neu;
}

/** Text des Knopfes im Filterfenster: wie viele Termine die Filter gerade zeigen. */
export function anzeigeText(anzahl) {
  if (anzahl === 0) return 'Keine Termine gefunden';
  return anzahl === 1 ? '1 Termin anzeigen' : `${anzahl} Termine anzeigen`;
}

/** Die ausgeblendeten Unterarten, die gerade wirken: nur bei genau einer Rubrik, und nur deren eigene Schlüssel. */
export function wirksameSorten(prefs) {
  const rubrik = einzelneRubrik(prefs.rubriken);
  const def = rubrik && Object.hasOwn(SORTEN, rubrik) ? SORTEN[rubrik] : null;
  if (!def) return [];
  return (prefs.hiddenGenres ?? []).filter((g) => g === def.sonstige || Object.hasOwn(def.liste, g));
}

/**
 * Filtert nach Einstellungen und entfernt Vergangenes. Ein Termin von heute bleibt bis Tagesende (Berliner Zeit).
 * Ein mehrtägiger Termin gilt an jedem Tag von Start bis lastDay. Termine ohne Koordinaten bzw. ohne distanceKm
 * bleiben bei jedem Umkreis sichtbar.
 * @param {any[]} events
 * @param {Prefs} prefs
 * @param {string} nowIso
 * @param {Record<string,{lat:number,lon:number}>} [orte] Koordinaten der wählbaren Orte (für die Mitte des Umkreises)
 * @param {{ohneRubrik?:boolean, ohneZeit?:boolean, ohneAdvent?:boolean}} [optionen] einzelne Filter auslassen (für die Zähler);
 *   ohneRubrik lässt auch die Unterfilter aus, ohneZeit behält das Entfernen von Vergangenem.
 */
export function applyFilters(events, prefs, nowIso, orte = {}, optionen = {}) {
  const heute = berlinDay(nowIso);
  const rubriken = optionen.ohneRubrik ? [] : (prefs.rubriken ?? []);
  const sortenAus = optionen.ohneRubrik ? [] : wirksameSorten(prefs);
  const fenster = optionen.ohneZeit ? { von: heute, bis: null } : zeitfenster(prefs, heute);
  const nurAdvent = Boolean(prefs.advent) && !optionen.ohneAdvent;
  const tagsAus = prefs.hiddenTags ?? [];
  const mitte = prefs.ort && orte && Object.hasOwn(orte, prefs.ort) ? orte[prefs.ort] : null;
  const woerter = glatt(prefs.suche).split(/\s+/).filter(Boolean);
  return events.filter((e) => {
    if (lastDay(e) < fenster.von) return false;
    if (fenster.bis && e.start.slice(0, 10) > fenster.bis) return false;
    if (!passtZurSuche(e, woerter)) return false;
    if (rubriken.length && !rubriken.includes(rubrikVon(e))) return false;
    if (sortenAus.length && sortenAus.includes(sorteFilter(e))) return false;
    if (nurAdvent && e.advent !== true) return false;
    if ((e.tags ?? []).some((t) => tagsAus.includes(t))) return false;
    if (mitte) {
      if (Number.isFinite(e.lat) && Number.isFinite(e.lon) && luftlinieKm(mitte, e) > prefs.maxKm) return false;
    } else if (e.distanceKm != null && e.distanceKm > prefs.maxKm) return false;
    if (!prefs.showCZ && e.country === 'CZ') return false;
    return true;
  });
}

/** Termine je Rubrik (alle 13 Schlüssel, 0 für leere) unter allen Filtern außer der Rubrikwahl und ihren Unterfiltern. */
export function zaehleRubriken(events, prefs, nowIso, orte = {}) {
  const zahlen = Object.fromEntries(RUBRIK_KEYS.map((k) => [k, 0]));
  for (const e of applyFilters(events, prefs, nowIso, orte, { ohneRubrik: true })) zahlen[rubrikVon(e)] += 1;
  return zahlen;
}

/** Advent-Termine unter allen Filtern außer dem Advent-Schalter selbst. */
export function zaehleAdvent(events, prefs, nowIso, orte = {}) {
  return applyFilters(events, prefs, nowIso, orte, { ohneAdvent: true }).filter((e) => e.advent === true).length;
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** "Sa 28.11." für 2026-11-28. */
function tagKurz(tag) {
  const d = new Date(`${tag}T00:00:00Z`);
  return `${WOCHENTAGE[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

const ZEIT_TEXT = { alle: 'Alle Termine', heute: 'Heute', wochenende: 'Wochenende', 7: '7 Tage', 30: '30 Tage' };

/**
 * Eine Zeile über die aktuelle Wahl, Teile mit " · ": Zeit, Rubriken, Advent, Ort mit Umkreis, Tschechien.
 * z. B. "Wochenende · Konzerte · Advent · Görlitz 25 km".
 */
export function zusammenfassung(prefs, heute) {
  let zeit;
  if (prefs.zeit === 'tage') {
    const { von, bis } = zeitfenster(prefs, heute);
    if (!bis) zeit = `ab ${tagKurz(von)}`;
    else zeit = von === bis ? tagKurz(von) : `${tagKurz(von)} – ${tagKurz(bis)}`;
  } else zeit = Object.hasOwn(ZEIT_TEXT, prefs.zeit) ? ZEIT_TEXT[prefs.zeit] : ZEIT_TEXT.alle;
  const rubriken = prefs.rubriken ?? [];
  let was;
  if (!rubriken.length) was = 'Alle Rubriken';
  else if (rubriken.length <= 2) was = rubriken.map(rubrikName).join(', ');
  else was = `${rubriken.length} Rubriken`;
  const teile = [zeit, was];
  if (prefs.advent) teile.push('Advent');
  teile.push(`${prefs.ort ?? 'Sebnitz'} ${prefs.maxKm} km`);
  if (prefs.showCZ === false) teile.push('ohne Tschechien');
  return teile.join(' · ');
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

/** Die kleinste Umkreisstufe, die den Wert fasst; über 75 oder ungültig: 75. */
function umkreisStufe(wert) {
  if (!Number.isFinite(wert) || wert <= 0) return DEFAULT_PREFS.maxKm;
  return UMKREISE.find((s) => s >= wert) ?? DEFAULT_PREFS.maxKm;
}

/**
 * Liest die Einstellungen; bei fehlendem, gesperrtem oder kaputtem Speicher gilt der Standard. Unbekannte alte Felder
 * (hiddenArt, zeit "60" …) werden übergangen; zeit ist nach dem Laden immer 'wochenende', von/bis null, suche leer.
 * @returns {Prefs}
 */
export function loadPrefs(storage) {
  try {
    const roh = JSON.parse(storage?.getItem(SCHLUESSEL) ?? 'null');
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return standard();
    const gewaehlt = new Set(stringListe(roh.rubriken));
    const rubriken = RUBRIK_KEYS.filter((k) => gewaehlt.has(k));
    return {
      ...standard(),
      rubriken: rubriken.length === RUBRIK_KEYS.length ? [] : rubriken,
      hiddenGenres: stringListe(roh.hiddenGenres),
      hiddenTags: stringListe(roh.hiddenTags),
      maxKm: umkreisStufe(roh.maxKm),
      showCZ: typeof roh.showCZ === 'boolean' ? roh.showCZ : DEFAULT_PREFS.showCZ,
      ort: typeof roh.ort === 'string' && roh.ort ? roh.ort : null,
      advent: roh.advent === true,
    };
  } catch {
    return standard();
  }
}

/** Speichert die Einstellungen ohne Zeitraum und Suche (die gelten nur für die offene Seite); ein Fehler bleibt folgenlos. */
export function savePrefs(storage, prefs) {
  try {
    const { suche, zeit, von, bis, ...gemerkt } = prefs;
    storage?.setItem(SCHLUESSEL, JSON.stringify(gemerkt));
  } catch { /* Einstellungen gelten dann nur für diese Sitzung */ }
}
