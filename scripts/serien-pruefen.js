// Zählt je Rubrik die Einzeltermine vorher und die Veranstaltungen nachher (Serien als eine Veranstaltung).
// Aufruf: node scripts/serien-pruefen.js <events.json> [--jetzt <ISO-Zeit>] [--schreibe <ordner>]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fertigstellen, ortsliste } from '../src/build.js';
import { markiereSerien } from '../src/serien.js';
import { applyFilters, zaehleRubriken, DEFAULT_PREFS } from '../site/js/filter.js';
import { RUBRIKEN, rubrikVon, rubrikName } from '../site/js/arten.js';

/** Zählt mit den Filtern der Seite (Zeitraum "alle", Vergangenes entfernt); die Termine müssen schon mit `serie` markiert sein. */
export function zaehleVorherNachher(events, nowIso) {
  const prefs = { ...DEFAULT_PREFS, zeit: 'alle' };
  const gefiltert = applyFilters(events, prefs, nowIso);
  const nachher = zaehleRubriken(events, prefs, nowIso);
  const vorher = Object.fromEntries(RUBRIKEN.map((r) => [r.key, 0]));
  const serienJeRubrik = Object.fromEntries(RUBRIKEN.map((r) => [r.key, new Map()]));
  for (const e of gefiltert) {
    const key = rubrikVon(e);
    vorher[key] += 1;
    if (e.serie != null) serienJeRubrik[key].set(e.serie, (serienJeRubrik[key].get(e.serie) ?? 0) + 1);
  }
  const zeilen = RUBRIKEN.map(({ key }) => ({
    key,
    name: rubrikName(key),
    vorher: vorher[key],
    nachher: nachher[key],
    serien: [...serienJeRubrik[key].values()].filter((n) => n >= 2).length,
  })).sort((a, b) => b.vorher - a.vorher);
  const summe = (feld) => zeilen.reduce((s, z) => s + z[feld], 0);
  return { zeilen, gesamt: { vorher: summe('vorher'), nachher: summe('nachher'), serien: summe('serien') } };
}

function tabelle(r) {
  const zeilen = ['| Rubrik | vorher | nachher | Serien |', '|---|---:|---:|---:|'];
  for (const z of r.zeilen) zeilen.push(`| ${z.name} | ${z.vorher} | ${z.nachher} | ${z.serien} |`);
  zeilen.push(`| **Gesamt** | ${r.gesamt.vorher} | ${r.gesamt.nachher} | ${r.gesamt.serien} |`);
  return zeilen.join('\n');
}

function argumente(argv) {
  const o = { pfad: null, jetzt: null, schreibe: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--jetzt') o.jetzt = argv[++i];
    else if (a === '--schreibe') o.schreibe = argv[++i];
    else if (!o.pfad) o.pfad = a;
  }
  return o;
}

async function main() {
  const o = argumente(process.argv.slice(2));
  if (!o.pfad) throw new Error('Aufruf: node scripts/serien-pruefen.js <events.json> [--jetzt <ISO-Zeit>] [--schreibe <ordner>]');
  const jetzt = o.jetzt ?? new Date().toISOString();
  const { events } = JSON.parse(await readFile(o.pfad, 'utf8'));
  const markiert = markiereSerien(fertigstellen(events).events);
  console.log(tabelle(zaehleVorherNachher(markiert.events, jetzt)));
  console.log(`\nSerien insgesamt: ${markiert.serien} mit ${markiert.termine} Terminen`);
  if (o.schreibe) {
    await mkdir(o.schreibe, { recursive: true });
    const generatedAt = new Date().toISOString();
    await writeFile(join(o.schreibe, 'events.json'), JSON.stringify({ generatedAt, events: markiert.events }, null, 1));
    await writeFile(join(o.schreibe, 'status.json'), JSON.stringify({ generatedAt, sources: [] }, null, 1));
    await writeFile(join(o.schreibe, 'places.json'), JSON.stringify(ortsliste()));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
