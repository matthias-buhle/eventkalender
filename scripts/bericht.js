// Prüfwerkzeug für die Filterseite: wendet die Rubrik-Zuordnung auf die lokale (git-ignorierte) site/data/events.json an
// und druckt Anteile, Konzert-Genres, Termine ohne Koordinaten und Stichproben.
//   node scripts/bericht.js            nur berichten
//   node scripts/bericht.js --schreiben   rubrik und genre in die Datei zurückschreiben
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RUBRIKEN, rubrikUndGenre } from '../src/rubriken.js';
import { GENRES } from '../src/normalize.js';

const DATEI = fileURLToPath(new URL('../site/data/events.json', import.meta.url));
const schreiben = process.argv.includes('--schreiben');

const roh = JSON.parse(readFileSync(DATEI, 'utf8'));
const events = (Array.isArray(roh) ? roh : roh.events).map((e) => {
  const { rubrik, genre } = rubrikUndGenre(e);
  return { ...e, rubrik, genre };
});

const prozent = (n) => `${((100 * n) / events.length).toFixed(1)} %`;
const je = new Map(RUBRIKEN.map((r) => [r.key, []]));
for (const e of events) je.get(e.rubrik).push(e);

console.log(`Termine gesamt: ${events.length}`);
console.log('\nRubriken:');
let summe = 0;
let groesste = 0;
for (const r of RUBRIKEN) {
  const n = je.get(r.key).length;
  summe += n;
  groesste = Math.max(groesste, n);
  console.log(`  ${r.key.padEnd(12)} ${String(n).padStart(5)}  ${prozent(n).padStart(8)}  ${r.name}`);
}
console.log(`  ${'Summe'.padEnd(12)} ${String(summe).padStart(5)}  ${summe === events.length ? 'ok' : 'ABWEICHUNG'}`);
console.log(`  größte Rubrik: ${prozent(groesste)} ${groesste / events.length > 0.2 ? '(ÜBER 20 %)' : '(unter 20 %)'}`);

console.log('\nKonzert-Genres:');
const genres = new Map();
for (const e of je.get('konzert')) genres.set(e.genre, (genres.get(e.genre) ?? 0) + 1);
for (const [g, n] of [...genres].sort((a, b) => b[1] - a[1])) console.log(`  ${(g ?? '(ohne Genre)').padEnd(16)} ${String(n).padStart(5)}  ${g ? GENRES[g] : ''}`);

console.log(`Termine ohne Koordinaten: ${events.filter((e) => e.lat == null || e.lon == null).length}`);

console.log('\nStichproben (15 je Rubrik):');
for (const r of RUBRIKEN) {
  const liste = je.get(r.key);
  const schritt = Math.max(1, Math.floor(liste.length / 15));
  const probe = liste.filter((_, i) => i % schritt === 0).slice(0, 15);
  console.log(`\n[${r.key}] ${r.name} (${liste.length})`);
  for (const e of probe) console.log(`  - ${e.title.slice(0, 90)}${e.genre ? `  <${e.genre}>` : ''}  {${e.art}}`);
}

if (schreiben) {
  writeFileSync(DATEI, JSON.stringify(Array.isArray(roh) ? events : { ...roh, events }));
  console.log(`\n${DATEI} geschrieben.`);
}
