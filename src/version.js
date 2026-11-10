// Die Programmversion für Kopf und Menü: data/version.json.
// Geschrieben wird sie vom Datenlauf (npm run build) und vom Programm-Workflow (npm run versiondatei).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Nummer aus package.json, Commit aus dem Workflow (GITHUB_SHA) oder, auf dem eigenen Rechner, aus git;
 * fehlt beides, bleibt der Commit leer.
 */
export function versionsInfo({ paket, sha, gebaut }) {
  const commit = typeof sha === 'string' && /^[0-9a-f]{7,40}$/i.test(sha.trim()) ? sha.trim().slice(0, 7).toLowerCase() : null;
  return { version: String(paket?.version ?? ''), commit, gebaut };
}

function gitKurz() {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Schreibt version.json in den Datenordner (Standard: site/data/) und gibt den Inhalt zurück.
 * @param {{outDir?: URL, gebaut?: string, sha?: string|null}} [optionen]
 */
export async function schreibeVersion({ outDir = new URL('../site/data/', import.meta.url), gebaut = new Date().toISOString(), sha = process.env.GITHUB_SHA ?? gitKurz() } = {}) {
  const paket = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const info = versionsInfo({ paket, sha, gebaut });
  await mkdir(outDir, { recursive: true });
  await writeFile(new URL('version.json', outDir), JSON.stringify(info));
  return info;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  schreibeVersion()
    .then((info) => console.log(`version.json: ${info.version}${info.commit ? ` (${info.commit})` : ''}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
