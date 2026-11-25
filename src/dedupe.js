import { fold, resolvePlace } from './geo.js';

const NEGATIV = ['abgesagt', 'verlegt', 'ausverkauft'];

function key(e) {
  const ort = resolvePlace(e.placeName)?.name ?? e.placeName;
  return `${fold(e.title)}|${e.start.slice(0, 10)}|${fold(ort)}`;
}

function erster(a, b) {
  return a ?? b ?? null;
}

function statusVon(a, b) {
  for (const s of NEGATIV) if (a === s || b === s) return s;
  return a ?? b ?? null;
}

function merge(a, b) {
  // Koordinaten samt Regionsradius kommen zusammen von einem Eintrag: von a, außer a hat keine oder nur den
  // Mittelpunkt der Region (ortRegionKm) und b hat genauere.
  const nimmB = b.lat != null && (a.lat == null || (a.ortRegionKm != null && b.ortRegionKm == null));
  const ort = nimmB ? b : a;
  const sources = [...a.sources];
  for (const s of b.sources) if (!sources.some((x) => x.name === s.name)) sources.push(s);
  return {
    ...a,
    sources,
    start: !a.hasTime && b.hasTime ? b.start : a.start,
    end: erster(a.end, b.end),
    hasTime: a.hasTime || b.hasTime,
    lat: ort.lat,
    lon: ort.lon,
    distanceKm: ort.distanceKm,
    ortRegionKm: ort.ortRegionKm,
    country: ort.country,
    genre: erster(a.genre, b.genre),
    ...(Object.hasOwn(a, 'genreQuelle') || Object.hasOwn(b, 'genreQuelle') ? { genreQuelle: erster(a.genreQuelle, b.genreQuelle) } : {}),
    tags: [...new Set([...a.tags, ...b.tags])],
    contact: {
      phone: erster(a.contact.phone, b.contact.phone),
      url: erster(a.contact.url, b.contact.url),
      email: erster(a.contact.email, b.contact.email),
    },
    ticketUrl: erster(a.ticketUrl, b.ticketUrl),
    ticketStatus: statusVon(a.ticketStatus, b.ticketStatus),
    description: erster(a.description, b.description),
    lizenz: erster(a.lizenz, b.lizenz),
    needsReview: a.needsReview && b.needsReview,
    terminlisteVoll: a.terminlisteVoll === true || b.terminlisteVoll === true,
  };
}

/** Zwei Einträge derselben Quelle mit verschiedenem Link sind verschiedene Termine (z. B. zwei Spielstätten einer Stadt). */
function gleicheQuelleAndererEintrag(a, b) {
  return a.sources.some((x) => b.sources.some((y) => x.name === y.name && x.url !== y.url));
}

// Wörter, die in Titeln und Ortsnamen nichts unterscheiden.
const TITEL_FUELL = new Set(['mit', 'und', 'der', 'die', 'das', 'den', 'dem', 'von', 'vom', 'fur', 'fuer', 'im', 'in', 'am', 'zum', 'zur', 'live', 'tour']);
const ORT_FUELL = new Set(['haus', 'saal', 'halle', 'theater', 'stadt', 'kirche', 'zentrum', 'club', 'platz', 'schloss', 'museum', 'der', 'die', 'das', 'im', 'am', 'an', 'in', 'und', 'zum', 'zur']);
const woerter = (text, fuell) => new Set(fold(text ?? '').split(' ').filter((w) => w.length >= 3 && !fuell.has(w)));
const geteilt = (a, b) => [...a].filter((w) => b.has(w)).length;

/** Titel derselben Veranstaltung aus verschiedenen Quellen: mindestens zwei gemeinsame Wörter und vier Fünftel des kürzeren Titels. */
function titelAehnlich(a, b) {
  if (fold(a.title) === fold(b.title)) return true;
  const wa = woerter(a.title, TITEL_FUELL);
  const wb = woerter(b.title, TITEL_FUELL);
  const gemeinsam = geteilt(wa, wb);
  return gemeinsam >= 2 && gemeinsam / Math.min(wa.size, wb.size) >= 0.8;
}

/** Orte, die dasselbe meinen können: gleicher Ort, zwei gemeinsame Ortswörter oder ein unscharfer Ort ("Pirna"), der im anderen steckt. */
function ortVertraeglich(a, b) {
  const oa = resolvePlace(a.placeName)?.name ?? a.placeName;
  const ob = resolvePlace(b.placeName)?.name ?? b.placeName;
  if (fold(oa ?? '') === fold(ob ?? '')) return true;
  const wa = woerter(a.placeName, ORT_FUELL);
  const wb = woerter(b.placeName, ORT_FUELL);
  if (geteilt(wa, wb) >= 2) return true;
  const [klein, gross] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  return klein.size > 0 && klein.size <= 1 && geteilt(klein, gross) === klein.size;
}

const zeitVertraeglich = (a, b) => !a.hasTime || !b.hasTime || a.start === b.start;

/**
 * Zweiter Durchgang: dieselbe Veranstaltung, aber von verschiedenen Quellen verschieden benannt ("Lesung - ... mit Sky du Mont"
 * und "Sky du Mont liest ..."), mit verschieden geschriebenem Ort und einmal ohne Uhrzeit. Gleicher Tag, ähnlicher Titel,
 * verträglicher Ort und gleiche oder fehlende Uhrzeit. Einträge derselben Quelle bleiben getrennt.
 */
function aehnlicheZusammenfuehren(events) {
  const nachTag = new Map();
  for (const e of events) {
    const tag = e.start.slice(0, 10);
    const liste = nachTag.get(tag) ?? [];
    liste.push(e);
    nachTag.set(tag, liste);
  }
  const ergebnis = [];
  for (const liste of nachTag.values()) {
    const behalten = [];
    for (const e of liste) {
      const i = behalten.findIndex((x) => !x.sources.some((p) => e.sources.some((q) => p.name === q.name))
        && titelAehnlich(x, e) && ortVertraeglich(x, e) && zeitVertraeglich(x, e));
      if (i >= 0) behalten[i] = merge(behalten[i], e);
      else behalten.push(e);
    }
    ergebnis.push(...behalten);
  }
  return ergebnis;
}

/**
 * Führt gleiche Termine (normalisierter Titel, Tag, Ort) zusammen, danach ähnliche aus verschiedenen Quellen, und sortiert nach Start.
 * Im Zweifel lieber doppelt zeigen: Einträge derselben Quelle mit verschiedenem Link bleiben getrennt.
 * @param {import('./model.js').Event[]} events
 * @returns {import('./model.js').Event[]}
 */
export function dedupe(events) {
  const byKey = new Map();
  for (const e of events) {
    const k = key(e);
    const gruppe = byKey.get(k) ?? [];
    const i = gruppe.findIndex((x) => !gleicheQuelleAndererEintrag(x, e));
    if (i >= 0) gruppe[i] = merge(gruppe[i], e);
    else gruppe.push(e);
    byKey.set(k, gruppe);
  }
  return aehnlicheZusammenfuehren([...byKey.values()].flat()).sort((x, y) => x.start.localeCompare(y.start) || x.title.localeCompare(y.title));
}
