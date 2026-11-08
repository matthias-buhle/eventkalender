// Kleiner statischer Server für die lokale Vorschau: node scripts/serve.js [Port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = fileURLToPath(new URL('../site/', import.meta.url));
const port = Number(process.argv[2]) || 8080;
const typen = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};

createServer(async (anfrage, antwort) => {
  const pfad = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname);
  const datei = normalize(join(wurzel, pfad.endsWith('/') ? `${pfad}index.html` : pfad));
  if (!datei.startsWith(wurzel)) { antwort.writeHead(403).end(); return; }
  try {
    const inhalt = await readFile(datei);
    antwort.writeHead(200, { 'Content-Type': typen[extname(datei)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(inhalt);
  } catch {
    antwort.writeHead(404).end('nicht gefunden');
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
