// Ergänzt src/places.json um Orte, die das Ortsverzeichnis noch nicht kennt (OpenStreetMap-Nominatim, 1 Anfrage pro Sekunde).
// Probelauf (schreibt nichts):  node scripts/learn-places.js [Datei.json | "Ortsname" ...]
// Eintragen:                    node scripts/learn-places.js --write [Datei.json | "Ortsname" ...]
// Mit "Ort=Suchanfrage" wird nur die genauere Anfrage ohne Gebietsbeschränkung gestellt
// (z. B. "VIA-Regia Haus, Reichenbach=Reichenbach Oberlausitz").
// Eine Datei.json ist ein status.json (Feld sources[].unbekannteOrte) oder eine Liste von Ortsnamen.
// Ohne Angabe wird site/data/status.json gelesen. Die Treffer sind vor dem Eintragen zu prüfen!
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CENTER, distanceKm, resolvePlace } from '../src/geo.js';
import { ortskandidaten } from '../src/ortsname.js';

const UA = 'eventkalender-ostsachsen/1.0 (privates Projekt, Ortsverzeichnis pflegen)';
const PLACES = fileURLToPath(new URL('../src/places.json', import.meta.url));
const STATUS = fileURLToPath(new URL('../site/data/status.json', import.meta.url));
const ORTSARTEN = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'municipality', 'borough', 'quarter', 'neighbourhood', 'locality', 'isolated_dwelling']);

const args = process.argv.slice(2);
const schreiben = args.includes('--write');
const eingaben = args.filter((a) => a !== '--write');

function namenAus(quelle) {
  if (quelle.endsWith('.json')) {
    const daten = JSON.parse(readFileSync(quelle, 'utf8'));
    if (Array.isArray(daten) && typeof daten[0] === 'string') return daten;
    const quellen = Array.isArray(daten) ? daten : daten.sources;
    return quellen.flatMap((s) => s.unbekannteOrte ?? []);
  }
  return [quelle];
}
const namen = [...new Set((eingaben.length ? eingaben : [STATUS]).flatMap(namenAus))];

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
async function suche(frage, nahe) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', frage);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  if (nahe) {
    url.searchParams.set('countrycodes', 'de,cz');
    url.searchParams.set('viewbox', `${CENTER.lon - 1.6},${CENTER.lat + 1.1},${CENTER.lon + 1.6},${CENTER.lat - 1.1}`);
    url.searchParams.set('bounded', '1');
  }
  const antwort = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de' } });
  if (!antwort.ok) throw new Error(`Nominatim ${antwort.status}`);
  await warte(1100);
  const treffer = await antwort.json();
  // Ortschaften vor Straßen, Gebäuden usw. In der Umgebung gewinnt der nächste zum Mittelpunkt,
  // sonst (große, ferne Städte) die Reihenfolge von Nominatim nach Bedeutung.
  const orte = treffer.filter((t) => ORTSARTEN.has(t.type) || t.category === 'place' || t.category === 'boundary');
  return nahe ? orte.sort((a, b) => distanceKm(CENTER, { lat: +a.lat, lon: +a.lon }) - distanceKm(CENTER, { lat: +b.lat, lon: +b.lon })) : orte;
}

const gefunden = [];
for (const eingabe of namen) {
  const [name, anfrage] = eingabe.includes('=') ? eingabe.split('=').map((t) => t.trim()) : [eingabe, null];
  if (!anfrage && resolvePlace(name)) {
    console.log(`bekannt    ${name}`);
    continue;
  }
  const { hauptort, weitere } = ortskandidaten(name);
  if (!hauptort) continue;
  const aus = hauptort.replace(/^(Messe|Stadthalle|Kulturhaus)\s+/i, '');
  // Reihenfolge der Anfragen: Hauptort, Hauptort ohne Zusatz ("a.d. Eigen"), Ortsteile. Mit "Ort=Anfrage" nur diese, ohne Gebiet.
  const anfragen = [aus, aus.replace(/\s+(a\.\s?d\.|an der|am)\s.*$/i, ''), ...weitere].filter(Boolean);
  let t;
  if (anfrage) {
    t = (await suche(anfrage, false))[0];
  } else {
    for (const frage of new Set(anfragen)) {
      t = (await suche(frage, true))[0];
      if (t) break;
    }
    if (!t) t = (await suche(aus, false))[0];
  }
  if (!t) {
    console.log(`NICHT GEFUNDEN  ${name}`);
    continue;
  }
  const lat = Math.round(+t.lat * 10000) / 10000;
  const lon = Math.round(+t.lon * 10000) / 10000;
  const km = Math.round(distanceKm(CENTER, { lat, lon }));
  const land = (t.address?.country_code ?? 'de').toUpperCase();
  console.log(`${String(km).padStart(4)} km  ${name}  →  ${aus} (${t.display_name.split(',').slice(0, 3).join(',')}) ${land}`);
  gefunden.push({ name: aus, aliases: [...new Set([aus, hauptort, ...weitere, ...(name.includes(',') ? [] : [name])])], lat, lon, country: land === 'CZ' ? 'CZ' : 'DE' });
}

if (schreiben) {
  const orte = JSON.parse(readFileSync(PLACES, 'utf8'));
  let neu = 0;
  for (const g of gefunden) {
    const vorhanden = orte.find((o) => o.name === g.name);
    if (vorhanden) {
      vorhanden.aliases = [...new Set([...vorhanden.aliases, ...g.aliases])];
    } else {
      orte.push(g);
      neu++;
    }
  }
  writeFileSync(PLACES, `${JSON.stringify(orte, null, 1)}\n`);
  console.log(`${neu} Orte neu in places.json (jetzt ${orte.length})`);
} else {
  console.log('Probelauf: nichts geschrieben. Mit --write eintragen.');
}
