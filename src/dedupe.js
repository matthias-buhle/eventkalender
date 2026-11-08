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
    tags: [...new Set([...a.tags, ...b.tags])],
    contact: {
      phone: erster(a.contact.phone, b.contact.phone),
      url: erster(a.contact.url, b.contact.url),
      email: erster(a.contact.email, b.contact.email),
    },
    ticketUrl: erster(a.ticketUrl, b.ticketUrl),
    ticketStatus: statusVon(a.ticketStatus, b.ticketStatus),
    description: erster(a.description, b.description),
    needsReview: a.needsReview && b.needsReview,
  };
}

/**
 * Führt gleiche Termine (normalisierter Titel, Tag, Ort) zusammen und sortiert nach Start.
 * @param {import('./model.js').Event[]} events
 * @returns {import('./model.js').Event[]}
 */
export function dedupe(events) {
  const byKey = new Map();
  for (const e of events) {
    const k = key(e);
    byKey.set(k, byKey.has(k) ? merge(byKey.get(k), e) : e);
  }
  return [...byKey.values()].sort((x, y) => x.start.localeCompare(y.start) || x.title.localeCompare(y.title));
}
