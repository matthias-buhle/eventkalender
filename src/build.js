import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { todayBerlin } from './time.js';
import { CENTER, RADIUS_KM, distanceKm, resolvePlace } from './geo.js';
import { dedupe } from './dedupe.js';
import { detectSorte, passendeSorte } from './normalize.js';
import { createPoliteClient } from './http.js';
import { uebersetzeTermine } from './uebersetzen.js';
import { schreibeVersion } from './version.js';

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

/** So lange (in Tagen seit dem letzten guten Abruf) bleiben die Termine einer ausgefallenen Quelle im Kalender stehen. */
export const MAX_UEBERNAHME_TAGE = 14;

/**
 * Die Termine, die von einer ausgefallenen Quelle noch gezeigt werden: die vom letzten guten Abruf, soweit sie nicht
 * vorbei sind und der Abruf nicht länger als MAX_UEBERNAHME_TAGE zurückliegt. Sonst nichts.
 * @param {{lastOkAt?:string, events?:object[]}|undefined} alt Eintrag der Quelle aus rohdaten.json
 */
function uebernehmbar(alt, heute, now) {
  if (!alt || !Array.isArray(alt.events)) return null;
  const letzter = Date.parse(alt.lastOkAt ?? '');
  if (Number.isNaN(letzter) || now.getTime() - letzter > MAX_UEBERNAHME_TAGE * 86_400_000) return null;
  const noch = alt.events.filter((e) => e && typeof e.start === 'string' && nochAktuell(e, heute));
  return noch.length ? { lastOkAt: alt.lastOkAt, events: noch } : null;
}

/**
 * Ruft alle aktiven Quellen ab. Jede Quelle ist für sich abgesichert: ein Fehler wird im Status gemeldet
 * und stoppt die anderen nicht. Fällt eine Quelle aus (Fehler oder unerwartet leere Antwort), bleiben ihre Termine vom
 * letzten guten Abruf stehen (siehe MAX_UEBERNAHME_TAGE); im Status steht dann uebernommen: true.
 * rohdaten hält je eingeschalteter Quelle die Termine vor dem Zusammenführen, als Grundlage für den nächsten Lauf.
 * @param {{sources:{name:string, fetchEvents:Function, config?:object}[], http:object, now:Date, previousStatus?:SourceStatus[],
 *   previousRohdaten?:Record<string,{lastOkAt:string, events:object[]}>}} args
 * @returns {Promise<{events:import('./model.js').Event[], status:SourceStatus[], rohdaten:Record<string,{lastOkAt:string, events:object[]}>}>}
 */
export async function runAll({ sources, http, now, previousStatus = [], previousRohdaten = {} }) {
  const heute = todayBerlin(now);
  const alle = [];
  const status = [];
  const rohdaten = {};
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
      rohdaten[source.name] = { lastOkAt: now.toISOString(), events: brauchbar };
      status.push({ name: source.name, ok: true, count: geliefert.length, error: null, lastOkAt: now.toISOString(), unbekannteOrte: unbekannteOrte(geliefert) });
    } catch (err) {
      const fehler = err?.message ?? String(err);
      const alt = uebernehmbar(previousRohdaten[source.name], heute, now);
      if (alt) {
        alle.push(...alt.events);
        rohdaten[source.name] = alt;
        status.push({ name: source.name, ok: false, count: alt.events.length, error: fehler, lastOkAt: alt.lastOkAt, uebernommen: true });
      } else {
        status.push({ name: source.name, ok: false, count: 0, error: fehler, lastOkAt: lastOkAlt });
      }
    }
  }
  return { events: dedupe(alle), status, rohdaten };
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
  const previousRohdaten = (await readJson(new URL('rohdaten.json', outDir), { quellen: {} })).quellen ?? {};
  const { events: roh, status, rohdaten } = await runAll({ sources, http, now, previousStatus: previous, previousRohdaten });
  // Sofort in Text fassen: die spätere Übersetzung darf die gespeicherten Rohtermine nicht verändern.
  const rohdatenText = JSON.stringify({ generatedAt: now.toISOString(), quellen: rohdaten });
  for (const s of status) console.log(`${s.ok ? 'ok  ' : 'FEHL'} ${s.name}: ${s.count} Termine${s.error ? ` (${s.error}${s.uebernommen ? `; ${s.count} Termine vom Abruf am ${(s.lastOkAt ?? '').slice(0, 10)} übernommen` : ''})` : ''}`);
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
  await writeFile(new URL('rohdaten.json', outDir), rohdatenText);
  await schreibeVersion({ outDir, gebaut: generatedAt });
  console.log(`${events.length} Termine geschrieben`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
