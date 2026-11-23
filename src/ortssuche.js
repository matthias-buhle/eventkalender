import { CENTER, RADIUS_KM, distanceKm } from './geo.js';
import { ortskandidaten } from './ortsname.js';

/**
 * Feinsuche der Orte über Nominatim (OpenStreetMap): Termine, die nur den Mittelpunkt der Region ihrer Quelle tragen
 * (ortRegionKm), oder gar keine Koordinaten haben, werden nachgeschlagen. Jede Antwort, auch „kein Treffer“, wandert
 * in einen Zwischenspeicher, der von Lauf zu Lauf weitergereicht wird; dieselbe Frage wird so nie zweimal gestellt.
 * Bewusst fehlertolerant: keine Ausnahme verlässt ergaenzeOrte, ein Termin ohne Antwort bleibt, wie er war.
 *
 * Nicht über createPoliteClient: die robots.txt von nominatim.openstreetmap.org sperrt /search für alle Crawler, die
 * Programmierschnittstelle unterliegt aber der Nutzungsrichtlinie von Nominatim (höchstens 1 Anfrage je Sekunde,
 * kennzeichnender User-Agent, Ergebnisse zwischenspeichern), daher ein eigener Abruf mit 1100 ms Abstand.
 */

export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const ABSTAND_MS = 1100;
const MAX_FEHLER_IN_FOLGE = 5;
const AUFBEWAHREN_TAGE = 120;
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ein echter Abruf für ergaenzeOrte: GET mit User-Agent und Accept-Language: de, Zeitlimit; wirft bei HTTP-Fehlern
 * (auch 429 und 5xx), sonst die Antwort als JSON.
 * @param {{userAgent:string, timeoutMs?:number, fetchImpl?:typeof fetch}} opt
 * @returns {(url:string)=>Promise<any>}
 */
export function erzeugeAbruf({ userAgent, timeoutMs = 20000, fetchImpl = fetch }) {
  return async (url) => {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': userAgent, 'Accept-Language': 'de' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    return res.json();
  };
}

/** Adresse der Suche: nur Deutschland, nur im Kasten um Sebnitz (±1,1° Länge, ±0,7° Breite), ein Ergebnis. */
export function suchUrl(text) {
  const viewbox = [CENTER.lon - 1.1, CENTER.lat + 0.7, CENTER.lon + 1.1, CENTER.lat - 0.7].map((z) => z.toFixed(4)).join(',');
  const p = new URLSearchParams({ q: text, format: 'jsonv2', limit: '1', countrycodes: 'de', viewbox, bounded: '1' });
  return `${NOMINATIM}?${p}`;
}

/** Zerlegt "<Spielstätte>, Raum <Region>" bzw. "Raum <Region>" (siehe culturebase.js ortVon). */
function regionsteile(placeName) {
  const name = String(placeName ?? '').trim();
  const i = name.lastIndexOf(', Raum ');
  if (i >= 0) return { spielstaette: name.slice(0, i).trim(), region: name.slice(i + ', Raum '.length).trim() };
  if (name.startsWith('Raum ')) return { spielstaette: '', region: name.slice('Raum '.length).trim() };
  return null;
}

/**
 * Die Fragen an Nominatim für einen Termin, in der Reihenfolge, in der sie gestellt werden.
 * @param {import('./model.js').Event} e
 * @returns {string[]}
 */
export function suchtexteFuer(e) {
  if (e.ortRegionKm != null) {
    const teile = regionsteile(e.placeName);
    if (!teile || !teile.spielstaette || !teile.region) return [];
    return [`${teile.spielstaette}, ${teile.region}`];
  }
  if (e.lat == null) {
    const voll = String(e.placeName ?? '').trim();
    if (!voll) return [];
    const { hauptort } = ortskandidaten(voll);
    return [...new Set([voll, hauptort].filter(Boolean))];
  }
  return [];
}

/** Mittelpunkt und Radius, in dem ein Treffer für diesen Termin gilt. */
function annahme(e) {
  return e.ortRegionKm != null && e.lat != null && e.lon != null
    ? { mitte: { lat: e.lat, lon: e.lon }, km: e.ortRegionKm }
    : { mitte: CENTER, km: RADIUS_KM };
}

/** Wertet eine Nominatim-Antwort aus; wirft, wenn sie keine Liste ist. */
function auswerten(antwort, e) {
  if (!Array.isArray(antwort)) throw new Error('Nominatim: unerwartete Antwort');
  const lat = Number.parseFloat(antwort[0]?.lat);
  const lon = Number.parseFloat(antwort[0]?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { lat: null, lon: null };
  const { mitte, km } = annahme(e);
  return distanceKm(mitte, { lat, lon }) <= km ? { lat, lon } : { lat: null, lon: null };
}

/** Ein brauchbarer Eintrag: Koordinaten als endliche Zahlen oder lat:null (endgültig kein Treffer). */
function gueltig(v) {
  if (!v || typeof v !== 'object') return false;
  return v.lat === null || (Number.isFinite(v.lat) && Number.isFinite(v.lon));
}

/** Liegt ein gemerkter Treffer im Annahmeradius dieses Termins? Der Eintrag gilt je Suchtext, der Radius je Termin. */
function imRadius(eintrag, e) {
  const { mitte, km } = annahme(e);
  return distanceKm(mitte, eintrag) <= km;
}

/**
 * Schlägt die Orte der Termine nach (siehe suchtexteFuer) und übernimmt Treffer im Annahmeradius.
 * Statistik: treffer = mit frischer Antwort neu verortete Termine, ohneTreffer = frische Antworten ohne brauchbaren
 * Treffer, ausCache = aus dem mitgegebenen Zwischenspeicher beantwortete Fragen, fehler = gescheiterte Anfragen,
 * offen = Termine, deren Fragen wegen maxAnfragen oder gehäufter Fehler nicht gestellt wurden.
 * @param {import('./model.js').Event[]} events
 * @param {{abruf:(url:string)=>Promise<any>, cache?:Record<string,{lat:number|null, lon:number|null, zuletzt:string}>,
 *          heute:string, maxAnfragen?:number, sleep?:(ms:number)=>Promise<void>}} opt
 */
export async function ergaenzeOrte(events, { abruf, cache = {}, heute, maxAnfragen = 400, sleep = realSleep }) {
  const alt = cache && typeof cache === 'object' ? cache : {};
  // Ohne Prototyp, damit Suchtexte wie "constructor" oder "__proto__" gewöhnliche Schlüssel sind.
  const neuerCache = Object.assign(Object.create(null), alt);
  const benutzt = new Set();
  const stats = { treffer: 0, ohneTreffer: 0, ausCache: 0, fehler: 0, offen: 0 };
  let anfragen = 0;
  let fehlerInFolge = 0;

  const ergebnis = [];
  for (const e of events) {
    let fragen = [];
    try { fragen = suchtexteFuer(e); } catch { /* unbrauchbarer Termin: bleibt, wie er ist */ }
    let neu = e;
    for (const text of fragen) {
      let eintrag = Object.hasOwn(neuerCache, text) && gueltig(neuerCache[text]) ? neuerCache[text] : null;
      let frisch = false;
      if (eintrag) {
        // Eine in diesem Lauf schon gestellte Frage (zweiter Termin, gleicher Text) zählt nicht als Zwischenspeicher.
        if (Object.hasOwn(alt, text)) stats.ausCache += 1;
      } else {
        if (anfragen >= maxAnfragen || fehlerInFolge >= MAX_FEHLER_IN_FOLGE) {
          stats.offen += 1;
          break;
        }
        try {
          if (anfragen > 0) await sleep(ABSTAND_MS);
          anfragen += 1;
          const antwort = await abruf(suchUrl(text));
          eintrag = { ...auswerten(antwort, e), zuletzt: heute };
          fehlerInFolge = 0;
          frisch = true;
        } catch {
          stats.fehler += 1;
          fehlerInFolge += 1;
          break; // nichts merken: beim nächsten Lauf wird erneut gefragt
        }
      }
      neuerCache[text] = { ...eintrag, zuletzt: heute };
      benutzt.add(text);
      // Auch ein Treffer aus dem Zwischenspeicher oder von einem anderen Termin dieses Laufs muss im eigenen Radius liegen;
      // sonst gilt er nur für diesen Termin als kein Treffer, der Eintrag bleibt.
      if (eintrag.lat != null && eintrag.lon != null && (frisch || imRadius(eintrag, e))) {
        neu = { ...e, lat: eintrag.lat, lon: eintrag.lon, country: 'DE', ortRegionKm: null };
        if (frisch) stats.treffer += 1;
        break;
      }
      if (frisch) stats.ohneTreffer += 1;
    }
    ergebnis.push(neu);
  }

  // Alte, in diesem Lauf nicht gebrauchte Einträge verwerfen, damit die Datei nicht endlos wächst.
  const grenze = Date.parse(`${heute}T00:00:00Z`) - AUFBEWAHREN_TAGE * 86_400_000;
  for (const [k, v] of Object.entries(neuerCache)) {
    if (benutzt.has(k)) continue;
    const zuletzt = Date.parse(v?.zuletzt ?? '');
    if (Number.isNaN(zuletzt) || zuletzt < grenze) delete neuerCache[k];
  }
  return { events: ergebnis, cache: Object.fromEntries(Object.entries(neuerCache)), stats };
}
