import { readFileSync } from 'node:fs';

/** Mittelpunkt: Postleitzahl 01855 (Sebnitz), laut Nominatim. */
export const CENTER = { lat: 50.9399, lon: 14.291 };
export const RADIUS_KM = 75;

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;

/** Luftlinie in km (Haversine). */
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Kleinschreibung, Umlaute ausgeschrieben, Akzente weg, Satzzeichen zu Leerzeichen. */
function fold(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const places = JSON.parse(readFileSync(new URL('./places.json', import.meta.url), 'utf8'));
const byAlias = new Map();
for (const p of places) {
  const place = { name: p.name, lat: p.lat, lon: p.lon, country: p.country };
  for (const alias of p.aliases) byAlias.set(fold(alias), place);
}
// längste Aliasse zuerst, damit "bad schandau" vor "schandau" greift
const aliasesLongestFirst = [...byAlias.keys()].sort((a, b) => b.length - a.length);

/**
 * Sucht einen Ort im Verzeichnis. Findet auch Zusätze wie "Dresden, Alter Schlachthof".
 * @returns {{name:string,lat:number,lon:number,country:'DE'|'CZ'}|null}
 */
export function resolvePlace(name) {
  const text = fold(name ?? '');
  if (!text) return null;
  if (byAlias.has(text)) return byAlias.get(text);
  const padded = ` ${text} `;
  for (const alias of aliasesLongestFirst) {
    if (padded.includes(` ${alias} `)) return byAlias.get(alias);
  }
  return null;
}
