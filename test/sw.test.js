import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('Service Worker: jede Datei unter site/js/ steht im GRUNDSTOCK (sonst fehlt sie offline)', () => {
  const sw = readFileSync(new URL('../site/sw.js', import.meta.url), 'utf8');
  const block = sw.match(/const GRUNDSTOCK = \[([\s\S]*?)\];/);
  assert.ok(block, 'GRUNDSTOCK in sw.js gefunden');
  const eintraege = new Set([...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const dateien = readdirSync(new URL('../site/js/', import.meta.url)).filter((n) => n.endsWith('.js'));
  assert.ok(dateien.length > 0);
  const fehlen = dateien.filter((n) => !eintraege.has(`js/${n}`));
  assert.deepEqual(fehlen, [], `fehlen im GRUNDSTOCK: ${fehlen.join(', ')}`);
});
