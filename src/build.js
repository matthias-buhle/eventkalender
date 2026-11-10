import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { todayBerlin } from './time.js';
import { CENTER, RADIUS_KM, distanceKm, resolvePlace } from './geo.js';
import { dedupe } from './dedupe.js';
import { detectSorte, passendeSorte } from './normalize.js';
import { createPoliteClient } from './http.js';
import { uebersetzeTermine } from './uebersetzen.js';

const MIN_ERGIEBIG = 5;

/**
 * @typedef {{name:string, ok:boolean, count:number, error:string|null, lastOkAt:string|null, unbekannteOrte?:string[]}} SourceStatus
 */

/** Unterart (Feld genre): Genre bei Konzerten, Sorte bei Märkten und Schauen; eine Vorgabe der Quelle zählt nur, wenn sie zur Art passt. */
function genreVon(e) {
  return passendeSorte(e.art, e.genre) ?? detectSorte(e.art, e.title, e.description);
}

function anreichern(e) {
  let { lat, lon, country } = e;
  if (lat == null || lon == null) {
    const ort = resolvePlace(e.placeName);
    if (ort) ({ lat, lon, country } = ort);
  }
  const km = lat != null && lon != null ? Math.round(distanceKm(CENTER, { lat, lon }) * 10) / 10 : null;
  return { ...e, genre: genreVon(e), lat: lat ?? null, lon: lon ?? null, country, distanceKm: km };
}

/** Ortsnamen, die das Ortsverzeichnis nicht kennt: aus gelieferten Terminen und aus dem, was der Adapter verworfen hat. */
function unbekannteOrte(geliefert) {
  const namen = [...geliefert.map((e) => e.placeName), ...(geliefert.verworfeneOrte ?? [])];
  return [...new Set(namen.filter((n) => n && !resolvePlace(n)))].sort((a, b) => a.localeCompare(b, 'de'));
}

function nochAktuell(e, heute) {
  return (e.end ?? e.start).slice(0, 10) >= heute;
}

/**
 * Ruft alle aktiven Quellen ab. Jede Quelle ist für sich abgesichert: ein Fehler wird im Status gemeldet
 * und stoppt die anderen nicht.
 * @param {{sources:{name:string, fetchEvents:Function, config?:object}[], http:object, now:Date, previousStatus?:SourceStatus[]}} args
 * @returns {Promise<{events:import('./model.js').Event[], status:SourceStatus[]}>}
 */
export async function runAll({ sources, http, now, previousStatus = [] }) {
  const heute = todayBerlin(now);
  const alle = [];
  const status = [];
  for (const source of sources) {
    const config = source.config ?? {};
    if (config.enabled === false) continue;
    const prev = previousStatus.find((s) => s.name === source.name);
    const lastOkAlt = prev?.lastOkAt ?? null;
    try {
      const geliefert = await source.fetchEvents({ http, today: heute, config });
      if (!Array.isArray(geliefert)) throw new Error('Quelle lieferte keine Liste');
      if (geliefert.length === 0 && (prev?.count ?? 0) >= MIN_ERGIEBIG) throw new Error('leere Antwort');
      const brauchbar = geliefert
        .map(anreichern)
        .filter((e) => nochAktuell(e, heute))
        .filter((e) => e.distanceKm == null || e.distanceKm <= RADIUS_KM);
      alle.push(...brauchbar);
      status.push({ name: source.name, ok: true, count: geliefert.length, error: null, lastOkAt: now.toISOString(), unbekannteOrte: unbekannteOrte(geliefert) });
    } catch (err) {
      status.push({ name: source.name, ok: false, count: 0, error: err?.message ?? String(err), lastOkAt: lastOkAlt });
    }
  }
  return { events: dedupe(alle), status };
}

/**
 * Bricht ab, wenn der Lauf nichts Brauchbares ergeben hat; dann bleibt der zuletzt veröffentlichte Stand stehen,
 * statt von einer leeren Seite ersetzt zu werden.
 */
export function pruefeLauf({ events, status }) {
  if (!status.some((s) => s.ok)) throw new Error('Lauf abgebrochen: keine Quelle hat Daten geliefert');
  if (events.length === 0) throw new Error('Lauf abgebrochen: keine Termine entstanden');
}

/** Die Orte für die Auswahl "Ort + Umkreis" auf der Seite: die in places.json mit "auswahl" markierten Mittelpunkte, nach Namen sortiert. */
export function ortsliste() {
  const orte = JSON.parse(readFileSync(new URL('./places.json', import.meta.url), 'utf8'));
  return orte
    .filter((o) => distanceKm(CENTER, o) <= RADIUS_KM)
    .filter((o) => o.auswahl === true)
    .map(({ name, lat, lon, country }) => ({ name, lat, lon, country }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const { adapters } = await import('./sources/index.js');
  // sources.json muss lesbar sein: ein Tippfehler dort darf nicht alle Quellen stillschweigend abschalten.
  const config = JSON.parse(await readFile(new URL('../sources.json', import.meta.url), 'utf8'));
  const outDir = new URL('../site/data/', import.meta.url);
  const previous = (await readJson(new URL('status.json', outDir), { sources: [] })).sources;
  const kontakt = process.env.EVENTKALENDER_CONTACT;
  const http = createPoliteClient({
    userAgent: `Eventkalender-Ostsachsen/1.0 (privater Kalender${kontakt ? `; ${kontakt}` : ''})`,
    perHostDelayMs: 2000,
  });
  const sources = adapters.map((a) => ({ name: a.name, fetchEvents: a.fetchEvents, config: config[a.name] ?? { enabled: false } }));
  const now = new Date();
  const { events: roh, status } = await runAll({ sources, http, now, previousStatus: previous });
  for (const s of status) console.log(`${s.ok ? 'ok  ' : 'FEHL'} ${s.name}: ${s.count} Termine${s.error ? ` (${s.error})` : ''}`);
  pruefeLauf({ events: roh, status });
  // Tschechische Termine ins Deutsche übersetzen; Fehler dabei stoppen den Lauf nie, der Originaltext bleibt dann stehen.
  const alterSpeicher = await readJson(new URL('uebersetzungen.json', outDir), {});
  const { events, cache, stats } = await uebersetzeTermine(roh, {
    apiKey: process.env.DEEPL_API_KEY, cache: alterSpeicher, heute: todayBerlin(now),
  });
  console.log(`Übersetzung: ${stats.uebersetzt} neu (${stats.zeichen} Zeichen), ${stats.ausCache} aus dem Zwischenspeicher${stats.fehler ? `, Hinweis: ${stats.fehler}` : ''}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(new URL('uebersetzungen.json', outDir), JSON.stringify(cache));
  const generatedAt = now.toISOString();
  await writeFile(new URL('events.json', outDir), JSON.stringify({ generatedAt, events }, null, 1));
  await writeFile(new URL('status.json', outDir), JSON.stringify({ generatedAt, sources: status }, null, 1));
  await writeFile(new URL('places.json', outDir), JSON.stringify(ortsliste()));
  console.log(`${events.length} Termine geschrieben`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
