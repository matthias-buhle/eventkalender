// Erzeugt src/places.json aus OpenStreetMap-Nominatim (1 Anfrage pro Sekunde).
// Aufruf: node scripts/build-places.js
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UA = 'eventkalender-ostsachsen/1.0 (privates Projekt, Ortsverzeichnis einmalig)';
const OUT = fileURLToPath(new URL('../src/places.json', import.meta.url));

// [Anzeigename, Suchanfrage, Land, zusätzliche Schreibweisen]
const PLACES = [
  ['Sebnitz', 'Sebnitz, Sachsen', 'DE', []],
  ['Neustadt in Sachsen', 'Neustadt in Sachsen, Landkreis Sächsische Schweiz-Osterzgebirge', 'DE', ['Neustadt i. Sa.', 'Neustadt/Sa.', 'Neustadt Sachsen', 'Neustadt Sa']],
  ['Polenz', 'Polenz, Neustadt in Sachsen', 'DE', []],
  ['Oberottendorf', 'Oberottendorf, Neustadt in Sachsen', 'DE', []],
  ['Stolpen', 'Stolpen, Sachsen', 'DE', []],
  ['Hohnstein', 'Hohnstein, Sachsen', 'DE', []],
  ['Bad Schandau', 'Bad Schandau', 'DE', []],
  ['Hinterhermsdorf', 'Hinterhermsdorf, Sebnitz', 'DE', []],
  ['Königstein', 'Königstein, Sächsische Schweiz', 'DE', ['Koenigstein']],
  ['Rathen', 'Kurort Rathen', 'DE', ['Kurort Rathen']],
  ['Stadt Wehlen', 'Wehlen, Sächsische Schweiz', 'DE', ['Wehlen']],
  ['Bischofswerda', 'Bischofswerda', 'DE', []],
  ['Steinigtwolmsdorf', 'Steinigtwolmsdorf', 'DE', []],
  ['Neukirch', 'Neukirch/Lausitz', 'DE', ['Neukirch/Lausitz']],
  ['Pulsnitz', 'Pulsnitz, Sachsen', 'DE', []],
  ['Pirna', 'Pirna', 'DE', []],
  ['Heidenau', 'Heidenau, Sachsen', 'DE', []],
  ['Dohna', 'Dohna, Sachsen', 'DE', []],
  ['Bautzen', 'Bautzen', 'DE', ['Budyšin']],
  ['Dresden', 'Dresden', 'DE', []],
  ['Radeberg', 'Radeberg', 'DE', []],
  ['Radebeul', 'Radebeul', 'DE', []],
  ['Meißen', 'Meißen', 'DE', ['Meissen']],
  ['Freital', 'Freital', 'DE', []],
  ['Großenhain', 'Großenhain', 'DE', ['Grossenhain']],
  ['Kamenz', 'Kamenz', 'DE', []],
  ['Königsbrück', 'Königsbrück', 'DE', ['Koenigsbrueck']],
  ['Neschwitz', 'Neschwitz', 'DE', []],
  ['Hoyerswerda', 'Hoyerswerda', 'DE', []],
  ['Löbau', 'Löbau', 'DE', ['Loebau']],
  ['Görlitz', 'Görlitz', 'DE', ['Goerlitz']],
  ['Kodersdorf', 'Kodersdorf', 'DE', []],
  ['Niesky', 'Niesky', 'DE', []],
  ['Weißwasser', 'Weißwasser/O.L.', 'DE', ['Weisswasser']],
  ['Bad Muskau', 'Bad Muskau', 'DE', []],
  ['Zittau', 'Zittau', 'DE', []],
  ['Hirschfelde', 'Hirschfelde, Zittau', 'DE', []],
  ['Herrnhut', 'Herrnhut', 'DE', []],
  ['Ebersbach-Neugersdorf', 'Ebersbach-Neugersdorf', 'DE', ['Ebersbach', 'Neugersdorf']],
  ['Cottbus', 'Cottbus', 'DE', []],
  ['Děčín', 'Děčín', 'CZ', ['Decin', 'Tetschen']],
  ['Ústí nad Labem', 'Ústí nad Labem', 'CZ', ['Usti nad Labem', 'Aussig']],
  ['Liberec', 'Liberec', 'CZ', ['Reichenberg']],
  ['Česká Lípa', 'Česká Lípa', 'CZ', ['Ceska Lipa', 'Böhmisch Leipa']],
  ['Varnsdorf', 'Varnsdorf', 'CZ', []],
  ['Rumburk', 'Rumburk', 'CZ', ['Rumburg']],
  ['Šluknov', 'Šluknov', 'CZ', ['Sluknov', 'Schluckenau']],
  ['Krásná Lípa', 'Krásná Lípa', 'CZ', ['Krasna Lipa', 'Schönlinde']],
  ['Česká Kamenice', 'Česká Kamenice', 'CZ', ['Ceska Kamenice', 'Böhmisch Kamnitz']],
  ['Teplice', 'Teplice', 'CZ', []],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(params) {
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'json', limit: '1', 'accept-language': 'de', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  const data = await res.json();
  return data[0] ? { lat: Number(data[0].lat), lon: Number(data[0].lon) } : null;
}

const center = await nominatim({ postalcode: '01855', country: 'Deutschland' });
console.log('PLZ 01855 liegt bei', center);
await sleep(1100);

const out = [];
const misses = [];
for (const [name, query, country, extra] of PLACES) {
  const hit = await nominatim({ q: query, countrycodes: country.toLowerCase() });
  await sleep(1100);
  if (!hit) { misses.push(name); continue; }
  out.push({ name, aliases: [name, ...extra], lat: +hit.lat.toFixed(4), lon: +hit.lon.toFixed(4), country });
}
if (misses.length) {
  console.error('Nicht gefunden:', misses.join(', '));
  process.exitCode = 1;
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} Orte nach ${OUT} geschrieben.`);
