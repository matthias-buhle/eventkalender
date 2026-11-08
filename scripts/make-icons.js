// Erzeugt die App-Symbole (einfacher Kalender) ohne Zusatzpakete: node scripts/make-icons.js
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const GRUEN = [45, 106, 79];
const WEISS = [255, 255, 255];
const DUNKEL = [27, 67, 50];

function farbeAn(u, v) {
  // u, v in 0..1; Inhalt liegt im mittleren Bereich, damit "maskable" nichts abschneidet
  const inKasten = (x0, y0, x1, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1;
  if (inKasten(0.33, 0.24, 0.38, 0.34) || inKasten(0.62, 0.24, 0.67, 0.34)) return WEISS; // Ringe
  if (inKasten(0.25, 0.30, 0.75, 0.42)) return DUNKEL; // Kopfleiste
  if (inKasten(0.25, 0.42, 0.75, 0.74)) {
    const sx = (u - 0.25) / 0.5;
    const sy = (v - 0.42) / 0.32;
    const punkt = Math.floor(sx * 4) % 1 === 0 && (sx * 4) % 1 > 0.25 && (sx * 4) % 1 < 0.75 && (sy * 3) % 1 > 0.3 && (sy * 3) % 1 < 0.7;
    return punkt ? GRUEN : WEISS;
  }
  return GRUEN;
}

function png(groesse) {
  const zeilen = Buffer.alloc((groesse * 3 + 1) * groesse);
  for (let y = 0; y < groesse; y++) {
    const o = y * (groesse * 3 + 1);
    zeilen[o] = 0;
    for (let x = 0; x < groesse; x++) {
      const [r, g, b] = farbeAn((x + 0.5) / groesse, (y + 0.5) / groesse);
      zeilen.set([r, g, b], o + 1 + x * 3);
    }
  }
  const block = (typ, daten) => {
    const kopf = Buffer.alloc(4);
    kopf.writeUInt32BE(daten.length);
    const t = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
    const summe = Buffer.alloc(4);
    summe.writeUInt32BE(crc32(t));
    return Buffer.concat([kopf, t, summe]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(groesse, 0);
  ihdr.writeUInt32BE(groesse, 4);
  ihdr[8] = 8; // Bits je Kanal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block('IHDR', ihdr),
    block('IDAT', deflateSync(zeilen)),
    block('IEND', Buffer.alloc(0)),
  ]);
}

const ziel = new URL('../site/icons/', import.meta.url);
mkdirSync(ziel, { recursive: true });
for (const g of [192, 512]) writeFileSync(new URL(`icon-${g}.png`, ziel), png(g));
console.log('Symbole geschrieben');
