// Reine Funktionen für Filter, Zähler, Gruppierung und gespeicherte Einstellungen. Kein Zugriff auf window oder document.
import { RUBRIKEN, SORTEN, rubrikVon, rubrikName, sorteFilter } from './arten.js';

/**
 * rubriken: gewählte Rubriken (Schlüssel aus arten.js); leer heißt alle.
 * hiddenGenres: ausgeblendete Unterarten (siehe SORTEN in arten.js); sie wirken nur für gewählte Rubriken. Auf der Seite heißt
 *   das „Alle“ (nichts ausgeblendet) oder eine Auswahl einzelner Unterarten, siehe gewaehlteSorten und sorteWaehlen.
 * maxKm: Umkreis, eine der Stufen in UMKREISE. ort: Mitte des Umkreises (Name aus dem Ortsverzeichnis) oder null für Sebnitz.
 * zeit: 'alle' | 'heute' | 'wochenende' | '7' | '30' (Tage ab heute) | 'tage' (eigener Zeitraum von … bis, bis null = offen).
 * zeit, von, bis und suche werden nicht gespeichert; nach dem Laden gilt immer das Wochenende.
 * @typedef {{rubriken:string[], hiddenGenres:string[], hiddenTags:string[], maxKm:10|25|50|75, showCZ:boolean, ort:string|null,
 *   zeit:'alle'|'heute'|'wochenende'|'7'|'30'|'tage', von:string|null, bis:string|null, suche:string}} Prefs
 */

const SCHLUESSEL = 'eventkalender.prefs';
export const UMKREISE = Object.freeze([10, 25, 50, 75]);
export const ZEITEN = Object.freeze(['alle', 'heute', 'wochenende', '7', '30', 'tage']);
const RUBRIK_KEYS = RUBRIKEN.map((r) => r.key);

/** Der Standard; eingefroren (auch die Listen). loadPrefs liefert davon stets eine eigene, veränderbare Kopie. @type {Readonly<Prefs>} */
export const DEFAULT_PREFS = Object.freeze({
  rubriken: Object.freeze([]), hiddenGenres: Object.freeze([]), hiddenTags: Object.freeze([]), maxKm: 75, showCZ: true, ort: null,
  zeit: 'wochenende', von: null, bis: null, suche: '',
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
 * Ein abgelaufener eigener Zeitraum (siehe zeitAbgelaufen) gilt wie der Standard 'wochenende'; `bis` ist nie vor `von`.
 */
export function zeitfenster(prefs, heute) {
  if (zeitAbgelaufen(prefs, heute)) return zeitfenster({ zeit: DEFAULT_PREFS.zeit }, heute);
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
      let anfang = typeof prefs.von === 'string' ? prefs.von : null;
      let ende = typeof prefs.bis === 'string' ? prefs.bis : null;
      if (anfang && ende && ende < anfang) [anfang, ende] = [ende, anfang]; // verdrehte Angabe: nie bis < von
      return { von: anfang && anfang > heute ? anfang : heute, bis: ende };
    }
    default: return { von: heute, bis: null };
  }
}

/**
 * Ist die Zeitwahl ein eigener Zeitraum, dessen letzter Tag schon vor `heute` liegt? Das passiert, wenn die Seite über
 * Nacht im Hintergrund stand. (Ein Zeitraum mit offenem Ende läuft nie ab.)
 */
export function zeitAbgelaufen(prefs, heute) {
  return prefs?.zeit === 'tage' && typeof prefs.bis === 'string' && prefs.bis < heute;
}

/**
 * Entscheidung, wenn die Seite wieder sichtbar wird: Neu zeichnen nur, wenn seit dem letzten Zeichnen ein neuer
 * (Berliner) Tag begonnen hat; dann wird ein abgelaufener Zeitraum auf den Standard zurückgesetzt.
 * @param {Prefs} prefs
 * @param {string|null} letzterTag Tag (JJJJ-MM-TT) beim letzten Zeichnen
 * @param {string} heute
 * @returns {{neuZeichnen:boolean, zeitZuruecksetzen:boolean}}
 */
export function nachRueckkehr(prefs, letzterTag, heute) {
  const neuZeichnen = letzterTag !== heute;
  return { neuZeichnen, zeitZuruecksetzen: neuZeichnen && zeitAbgelaufen(prefs, heute) };
}

/** Die Einstellungen mit der Zeitwahl des Standards (zeit, von, bis); alles andere bleibt. */
export function zeitZurueckgesetzt(prefs) {
  return { ...prefs, zeit: DEFAULT_PREFS.zeit, von: DEFAULT_PREFS.von, bis: DEFAULT_PREFS.bis };
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

/**
 * Neue Rubrikwahl nach dem Antippen einer Rubrik: sie kommt dazu oder geht wieder (Reihenfolge wie RUBRIKEN).
 * Leer heißt alle; sind am Ende alle 14 gewählt, heißt das ebenfalls alle (leere Liste). Unbekanntes ändert nichts.
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

/** Text des Knopfes im Filterfenster: wie viele Veranstaltungen die Filter gerade zeigen. */
export function anzeigeText(anzahl) {
  if (anzahl === 0) return 'Keine Veranstaltungen gefunden';
  return anzahl === 1 ? '1 Veranstaltung anzeigen' : `${anzahl} Veranstaltungen anzeigen`;
}

/** Schlüssel einer Serie; leer für Einzeltermine und Daten ohne das Feld serie. */
const serieVon = (e) => (typeof e.serie === 'string' && e.serie !== '' ? e.serie : null);

/** Zahl der Veranstaltungen: jeder Termin ohne Serie zählt 1, jede Serie zusammen 1. */
export function zaehleVeranstaltungen(events) {
  const serien = new Set();
  let einzeln = 0;
  for (const e of events) {
    const s = serieVon(e);
    if (s === null) einzeln += 1;
    else serien.add(s);
  }
  return einzeln + serien.size;
}

/** Alle Unterart-Schlüssel einer Rubrik in Knopfreihenfolge, am Ende der für "sonstige"; ohne Unterarten leer. */
export function sortenSchluessel(rubrik) {
  const def = Object.hasOwn(SORTEN, rubrik) ? SORTEN[rubrik] : null;
  return def ? [...Object.keys(def.liste), def.sonstige] : [];
}

/**
 * Die gewählten Unterarten einer Rubrik (Knopfreihenfolge); null heißt "Alle": von dieser Rubrik ist nichts ausgeblendet.
 * @param {string[]|undefined} hiddenGenres
 * @returns {string[]|null}
 */
export function gewaehlteSorten(hiddenGenres, rubrik) {
  const aus = hiddenGenres ?? [];
  const alle = sortenSchluessel(rubrik);
  const gewaehlt = alle.filter((k) => !aus.includes(k));
  return gewaehlt.length === alle.length ? null : gewaehlt;
}

/**
 * Neue Liste hiddenGenres nach dem Antippen einer Unterart: aus "Alle" wird genau diese eine; sonst kommt sie dazu oder geht
 * wieder. Ist danach keine oder jede gewählt, gilt wieder "Alle". `schluessel` null heißt: der Knopf "Alle".
 * Die Unterarten anderer Rubriken bleiben; ein Schlüssel, der nicht zur Rubrik gehört, ändert nichts.
 */
export function sorteWaehlen(hiddenGenres, rubrik, schluessel) {
  const bisher = hiddenGenres ?? [];
  const alle = sortenSchluessel(rubrik);
  const rest = bisher.filter((k) => !alle.includes(k));
  if (schluessel == null) return rest;
  if (!alle.includes(schluessel)) return [...bisher];
  const gewaehlt = gewaehlteSorten(bisher, rubrik);
  let neu;
  if (gewaehlt === null) neu = [schluessel];
  else neu = gewaehlt.includes(schluessel) ? gewaehlt.filter((k) => k !== schluessel) : [...gewaehlt, schluessel];
  if (!neu.length || neu.length === alle.length) return rest;
  return [...rest, ...alle.filter((k) => !neu.includes(k))];
}

/**
 * Rubrikwahl und Unterarten nach dem Antippen einer Kachel: die Rubrik kommt dazu oder geht (siehe rubrikWaehlen); ihre
 * Unterarten beginnen dabei wieder bei "Alle". Übrig bleiben nur Unterarten von Rubriken, die weiter gewählt sind.
 * @returns {{rubriken:string[], hiddenGenres:string[]}}
 */
export function rubrikGetippt(prefs, key) {
  const rubriken = rubrikWaehlen(prefs.rubriken ?? [], key);
  const bleibt = new Set(rubriken.filter((r) => r !== key).flatMap(sortenSchluessel));
  return { rubriken, hiddenGenres: (prefs.hiddenGenres ?? []).filter((g) => bleibt.has(g)) };
}

/** Die ausgeblendeten Unterarten, die gerade wirken: nur die der gewählten Rubriken (ohne Rubrikwahl keine). */
export function wirksameSorten(prefs) {
  const erlaubt = new Set((prefs.rubriken ?? []).flatMap(sortenSchluessel));
  return (prefs.hiddenGenres ?? []).filter((g) => erlaubt.has(g));
}

/**
 * Filtert nach Einstellungen und entfernt Vergangenes. Ein Termin von heute bleibt bis Tagesende (Berliner Zeit).
 * Ein mehrtägiger Termin gilt an jedem Tag von Start bis lastDay. Termine ohne Koordinaten bzw. ohne distanceKm
 * bleiben bei jedem Umkreis sichtbar.
 * @param {any[]} events
 * @param {Prefs} prefs
 * @param {string} nowIso
 * @param {Record<string,{lat:number,lon:number}>} [orte] Koordinaten der wählbaren Orte (für die Mitte des Umkreises)
 * @param {{ohneRubrik?:boolean, ohneZeit?:boolean}} [optionen] einzelne Filter auslassen (für die Zähler);
 *   ohneRubrik lässt auch die Unterfilter aus, ohneZeit behält das Entfernen von Vergangenem.
 */
export function applyFilters(events, prefs, nowIso, orte = {}, optionen = {}) {
  const heute = berlinDay(nowIso);
  const rubriken = optionen.ohneRubrik ? [] : (prefs.rubriken ?? []);
  const sortenAus = optionen.ohneRubrik ? [] : wirksameSorten(prefs);
  const fenster = optionen.ohneZeit ? { von: heute, bis: null } : zeitfenster(prefs, heute);
  const tagsAus = prefs.hiddenTags ?? [];
  const mitte = prefs.ort && orte && Object.hasOwn(orte, prefs.ort) ? orte[prefs.ort] : null;
  const woerter = glatt(prefs.suche).split(/\s+/).filter(Boolean);
  return events.filter((e) => {
    if (lastDay(e) < fenster.von) return false;
    if (fenster.bis && e.start.slice(0, 10) > fenster.bis) return false;
    if (!passtZurSuche(e, woerter)) return false;
    if (rubriken.length && !rubriken.includes(rubrikVon(e))) return false;
    if (sortenAus.length && sortenAus.includes(sorteFilter(e))) return false;
    if ((e.tags ?? []).some((t) => tagsAus.includes(t))) return false;
    if (mitte) {
      if (Number.isFinite(e.lat) && Number.isFinite(e.lon) && luftlinieKm(mitte, e) > prefs.maxKm) return false;
    } else if (e.distanceKm != null && e.distanceKm > prefs.maxKm) return false;
    if (!prefs.showCZ && e.country === 'CZ') return false;
    return true;
  });
}

/** Veranstaltungen je Rubrik (alle 14 Schlüssel, 0 für leere) unter allen Filtern außer der Rubrikwahl und ihren Unterfiltern; eine Serie zählt einmal. */
export function zaehleRubriken(events, prefs, nowIso, orte = {}) {
  const zahlen = Object.fromEntries(RUBRIK_KEYS.map((k) => [k, 0]));
  const gesehen = new Set();
  for (const e of applyFilters(events, prefs, nowIso, orte, { ohneRubrik: true })) {
    const s = serieVon(e);
    if (s !== null) {
      if (gesehen.has(s)) continue;
      gesehen.add(s);
    }
    zahlen[rubrikVon(e)] += 1;
  }
  return zahlen;
}

/** Alle Unterpunkt-Schlüssel aller Rubriken, auch die Sammelpunkte. */
const ALLE_SORTEN = Object.keys(SORTEN).flatMap(sortenSchluessel);

/** Veranstaltungen je Unterpunkt (alle Schlüssel aller Rubriken, 0 für leere) unter denselben Filtern wie zaehleRubriken; eine Serie zählt einmal. */
export function zaehleSorten(events, prefs, nowIso, orte = {}) {
  const zahlen = Object.fromEntries(ALLE_SORTEN.map((k) => [k, 0]));
  const gesehen = new Set();
  for (const e of applyFilters(events, prefs, nowIso, orte, { ohneRubrik: true })) {
    const serie = serieVon(e);
    if (serie !== null) {
      if (gesehen.has(serie)) continue;
      gesehen.add(serie);
    }
    const s = sorteFilter(e);
    if (s !== null) zahlen[s] += 1;
  }
  return zahlen;
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** "Sa 28.11." für 2026-11-28. */
function tagKurz(tag) {
  const d = new Date(`${tag}T00:00:00Z`);
  return `${WOCHENTAGE[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

/** "Konzerte" oder, mit gewählten Unterarten, "Konzerte (Jazz & Blues)"; ab drei Unterarten "Konzerte (3 Sorten)". */
function rubrikMitSorten(prefs, key) {
  const name = rubrikName(key);
  const gewaehlt = gewaehlteSorten(prefs.hiddenGenres, key);
  if (gewaehlt === null) return name;
  if (!gewaehlt.length) return `${name} (keine Sorte)`;
  if (gewaehlt.length > 2) return `${name} (${gewaehlt.length} Sorten)`;
  const def = SORTEN[key];
  return `${name} (${gewaehlt.map((k) => (k === def.sonstige ? def.sonstigeText : def.liste[k])).join(', ')})`;
}

const ZEIT_TEXT = { alle: 'Alle Termine', heute: 'Heute', wochenende: 'Wochenende', 7: '7 Tage', 30: '30 Tage' };

/**
 * Eine Zeile über die aktuelle Wahl, Teile mit " · ": Zeit, Rubriken (mit gewählten Unterarten), Ort mit Umkreis, Tschechien.
 * z. B. "Wochenende · Konzerte (Jazz & Blues) · Görlitz 25 km".
 */
export function zusammenfassung(prefs, heute) {
  let zeit;
  if (zeitAbgelaufen(prefs, heute)) zeit = ZEIT_TEXT[DEFAULT_PREFS.zeit]; // wie zeitfenster: gilt als Wochenende
  else if (prefs.zeit === 'tage') {
    const { von, bis } = zeitfenster(prefs, heute);
    if (!bis) zeit = `ab ${tagKurz(von)}`;
    else zeit = von === bis ? tagKurz(von) : `${tagKurz(von)} – ${tagKurz(bis)}`;
  } else zeit = Object.hasOwn(ZEIT_TEXT, prefs.zeit) ? ZEIT_TEXT[prefs.zeit] : ZEIT_TEXT.alle;
  const rubriken = prefs.rubriken ?? [];
  let was;
  if (!rubriken.length) was = 'Alle Rubriken';
  else if (rubriken.length <= 2) was = rubriken.map((r) => rubrikMitSorten(prefs, r)).join(', ');
  else was = `${rubriken.length} Rubriken`;
  const teile = [zeit, was];
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
 * (hiddenArt, advent, zeit "60" …) werden übergangen; zeit ist nach dem Laden immer 'wochenende', von/bis null, suche leer.
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
      // Eine Auswahl aus der Zeit vor Stand 2 meinte andere Unterpunkte und wird einmal zurückgesetzt.
      hiddenGenres: roh.stand === 2 ? stringListe(roh.hiddenGenres).filter((g) => ALLE_SORTEN.includes(g)) : [],
      hiddenTags: stringListe(roh.hiddenTags),
      maxKm: umkreisStufe(roh.maxKm),
      showCZ: typeof roh.showCZ === 'boolean' ? roh.showCZ : DEFAULT_PREFS.showCZ,
      ort: typeof roh.ort === 'string' && roh.ort ? roh.ort : null,
    };
  } catch {
    return standard();
  }
}

/** Speichert die Einstellungen ohne Zeitraum und Suche (die gelten nur für die offene Seite); ein Fehler bleibt folgenlos. */
export function savePrefs(storage, prefs) {
  try {
    const { suche, zeit, von, bis, ...gemerkt } = prefs;
    storage?.setItem(SCHLUESSEL, JSON.stringify({ ...gemerkt, stand: 2 }));
  } catch { /* Einstellungen gelten dann nur für diese Sitzung */ }
}
