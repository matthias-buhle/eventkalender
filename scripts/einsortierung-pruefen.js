// Misst die Einordnung an einem festen Bestand: Rubrik und Unterpunkt vorher/nachher, Aussortiertes, Ziele.
// Aufruf: node scripts/einsortierung-pruefen.js <pfad> [--stichprobe 300] [--seed 20261124] [--aus <ordner>] [--schreiben <ziel.json>]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fertigstellen } from '../src/build.js';
import { aussortierGrund, GRUENDE } from '../src/aussortieren.js';
import { GENRES } from '../src/normalize.js';

const FREMD = /kabarett|comedy|stand.?up|satire|lesung|\bliest\b/i;

/** Setzt den Bestand in den Zustand vor dem Einordnen zurück. */
export function vorbereiten(events) {
  return events.map((e) => {
    const ticketmaster = Array.isArray(e.sources) && e.sources.some((s) => s?.name === 'Ticketmaster');
    const behalten = ticketmaster && e.art === 'konzert' && Object.hasOwn(GENRES, e.genre);
    return { ...e, rubrik: null, genre: null, genreQuelle: behalten ? e.genre : null };
  });
}

function zaehle(events) {
  const z = {};
  for (const e of events) {
    if (!e?.rubrik) continue;
    z[e.rubrik] = (z[e.rubrik] ?? 0) + 1;
    const k = `${e.rubrik}/${e.genre ?? 'sonstige'}`;
    z[k] = (z[k] ?? 0) + 1;
  }
  return z;
}

export function vergleiche(events) {
  const vorher = zaehle(events);
  const roh = vorbereiten(events);
  const { events: fertig } = fertigstellen(roh);
  const nachher = zaehle(fertig);
  const aussortiert = [];
  for (const e of roh) {
    const grund = aussortierGrund(e);
    if (grund) aussortiert.push({ titel: e.title, ort: e.placeName ?? '', grund: GRUENDE[grund] });
  }
  const konzertFremd = fertig
    .filter((e) => e.rubrik === 'konzert' && (FREMD.test(e.title ?? '') || FREMD.test(String(e.description ?? '').slice(0, 200))))
    .map((e) => e.title);
  const ziel = (name, soll, ist, erreicht) => ({ name, soll, ist, erreicht });
  const ziele = [
    ziel('sonstiges', '≤ 110', nachher.sonstiges ?? 0, (nachher.sonstiges ?? 0) <= 110),
    ziel('konzert/kirche', '≥ 40', nachher['konzert/kirche'] ?? 0, (nachher['konzert/kirche'] ?? 0) >= 40),
    ziel('theater/kabarett', '≥ 15', nachher['theater/kabarett'] ?? 0, (nachher['theater/kabarett'] ?? 0) >= 15),
    ziel('aussortiert', '≤ 20', aussortiert.length, aussortiert.length <= 20),
    ziel('konzertFremd', '= 0', konzertFremd.length, konzertFremd.length === 0),
  ];
  return { vorher, nachher, aussortiert, ziele, konzertFremd };
}

/** Fester Zufall (mulberry32), ohne Zurücklegen, Ergebnis in Zugreihenfolge. */
export function zieheStichprobe(events, n, seed) {
  let a = seed >>> 0;
  const zufall = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rest = [...events];
  const gezogen = [];
  while (gezogen.length < n && rest.length) gezogen.push(rest.splice(Math.floor(zufall() * rest.length), 1)[0]);
  return gezogen;
}

function tabelle(r) {
  const schluessel = [...new Set([...Object.keys(r.vorher), ...Object.keys(r.nachher)])]
    .sort((a, b) => a.localeCompare(b, 'de'));
  const zeilen = ['| Rubrik/Unterpunkt | vorher | nachher |', '|---|---:|---:|'];
  for (const k of schluessel) zeilen.push(`| ${k} | ${r.vorher[k] ?? 0} | ${r.nachher[k] ?? 0} |`);
  return zeilen.join('\n');
}

function bericht(r) {
  const teile = [tabelle(r), '', `Aussortiert (${r.aussortiert.length}):`];
  for (const a of r.aussortiert) teile.push(`- ${a.grund}: ${a.titel} (${a.ort})`);
  teile.push('', 'Ziele:');
  for (const z of r.ziele) teile.push(`- ${z.erreicht ? 'erreicht' : 'verfehlt'}  ${z.name} ${z.soll}: ${z.ist}`);
  if (r.konzertFremd.length) teile.push('', 'Fremde Termine unter Konzert:', ...r.konzertFremd.map((t) => `- ${t}`));
  return teile.join('\n');
}

function argumente(argv) {
  const o = { pfad: null, stichprobe: 0, seed: 20261124, aus: '.superpowers/einsortierung/', schreiben: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stichprobe') o.stichprobe = Number(argv[++i]);
    else if (a === '--seed') o.seed = Number(argv[++i]);
    else if (a === '--aus') o.aus = argv[++i];
    else if (a === '--schreiben') o.schreiben = argv[++i];
    else if (!o.pfad) o.pfad = a;
  }
  return o;
}

async function main() {
  const o = argumente(process.argv.slice(2));
  if (!o.pfad) throw new Error('Aufruf: node scripts/einsortierung-pruefen.js <pfad> [--stichprobe 300] [--seed 20261124] [--aus <ordner>] [--schreiben <ziel.json>]');
  const { events } = JSON.parse(await readFile(o.pfad, 'utf8'));
  const r = vergleiche(events);
  const text = bericht(r);
  console.log(text);
  const summe = Object.entries(r.nachher).filter(([k]) => !k.includes('/')).reduce((s, [, n]) => s + n, 0);
  console.log(`\nSumme: nachher ${summe} + aussortiert ${r.aussortiert.length} = ${summe + r.aussortiert.length} (Bestand ${events.length})`);
  await mkdir(o.aus, { recursive: true });
  await writeFile(join(o.aus, 'tabelle.md'), `${text}\n`);
  if (o.stichprobe > 0 || o.schreiben) {
    const { events: fertig } = fertigstellen(vorbereiten(events));
    if (o.stichprobe > 0) {
      const probe = zieheStichprobe(fertig, o.stichprobe, o.seed).map((e) => ({
        id: e.id, title: e.title, placeName: e.placeName, start: e.start, art: e.art,
        rubrik: e.rubrik, unterpunkt: e.genre ?? null, beschreibung: String(e.description ?? '').slice(0, 300),
      }));
      await writeFile(join(o.aus, 'stichprobe.json'), JSON.stringify(probe, null, 1));
    }
    if (o.schreiben) await writeFile(o.schreiben, JSON.stringify({ generatedAt: new Date().toISOString(), events: fertig }, null, 1));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
