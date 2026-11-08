// Holt eine URL mit dem höflichen Client und speichert die Antwort als Test-Fixture.
// Aufruf: node scripts/capture-fixture.js <url> <datei> [--limit N] [--text]
// Bei JSON-Listen (auch verschachtelt) werden höchstens N Einträge der ersten Liste gespeichert.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createPoliteClient } from '../src/http.js';

const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name);
const limitAt = flag('--limit');
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : null;
const asText = flag('--text') >= 0;
const positional = args.filter((a, i) => !a.startsWith('--') && (limitAt < 0 || i !== limitAt + 1));
const [url, file] = positional;

if (!url || !file) {
  console.error('Aufruf: node scripts/capture-fixture.js <url> <datei> [--limit N] [--text]');
  process.exit(2);
}

const http = createPoliteClient({ userAgent: 'Eventkalender-Ostsachsen/1.0 (privater Kalender; Fixture-Abruf)', perHostDelayMs: 2000 });
const { body } = await http.get(url, { as: asText ? 'text' : 'json' });

// kürzt die erste gefundene Liste (auch verschachtelt, z. B. { events: { others: [...] } })
function kuerzen(wert, n) {
  if (Array.isArray(wert)) return wert.slice(0, n);
  if (wert && typeof wert === 'object') {
    for (const k of Object.keys(wert)) {
      const gekuerzt = kuerzen(wert[k], n);
      if (gekuerzt !== wert[k]) return { ...wert, [k]: gekuerzt };
    }
  }
  return wert;
}

const out = !asText && limit ? kuerzen(body, limit) : body;

await mkdir(dirname(file), { recursive: true });
await writeFile(file, asText ? out : JSON.stringify(out, null, 1));
console.log(`gespeichert: ${file}`);
