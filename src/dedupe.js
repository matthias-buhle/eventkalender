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
  const sources = [...a.sources];
  for (const s of b.sources) if (!sources.some((x) => x.name === s.name)) sources.push(s);
  return {
    ...a,
    sources,
    start: !a.hasTime && b.hasTime ? b.start : a.start,
    end: erster(a.end, b.end),
    hasTime: a.hasTime || b.hasTime,
    lat: erster(a.lat, b.lat),
    lon: erster(a.lon, b.lon),
    distanceKm: erster(a.distanceKm, b.distanceKm),
    genre: erster(a.genre, b.genre),
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
  };
}

/** Zwei Einträge derselben Quelle mit verschiedenem Link sind verschiedene Termine (z. B. zwei Spielstätten einer Stadt). */
function gleicheQuelleAndererEintrag(a, b) {
  return a.sources.some((x) => b.sources.some((y) => x.name === y.name && x.url !== y.url));
}

/**
 * Führt gleiche Termine (normalisierter Titel, Tag, Ort) zusammen und sortiert nach Start.
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
  return [...byKey.values()].flat().sort((x, y) => x.start.localeCompare(y.start) || x.title.localeCompare(y.title));
}
