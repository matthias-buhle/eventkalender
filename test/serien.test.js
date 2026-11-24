import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';
import { markiereSerien, SERIEN_LUECKE_TAGE, OHNE_SERIE } from '../src/serien.js';

let nr = 0;
const ev = (tag, over = {}) => makeEvent({
  sourceName: 'A', sourceId: String(++nr), sourceUrl: 'https://a.example/', title: 'Striezelmarkt',
  start: `${tag}T10:00:00+01:00`, placeName: 'Altmarkt, Dresden', rubrik: 'markt', genre: 'weihnachtsmarkt', ...over,
});
const kennungen = (liste) => markiereSerien(liste).events.map((e) => e.serie);

test('gleicher Titel, Ort, Rubrik und Unterpunkt: eine Serie; alles andere bleibt null', () => {
  const out = markiereSerien([ev('2026-11-26'), ev('2026-11-27'), ev('2026-11-28', { title: 'Töpfermarkt' })]);
  const [a, b, c] = out.events.map((e) => e.serie);
  assert.match(a, /^s[0-9a-f]{10}$/);
  assert.equal(a, b);
  assert.equal(c, null);
  assert.deepEqual([out.serien, out.termine], [1, 2]);
});

test('Titel und Ort werden wie in dedupe verglichen (Schreibweise, Ortsteil)', () => {
  const [a, b] = kennungen([ev('2026-11-26', { title: 'STRIEZELMARKT!' }), ev('2026-11-27', { placeName: 'Dresden' })]);
  assert.ok(a && a === b);
});

test('gleicher Titel an zwei Orten: zwei Serien', () => {
  const [a, b, c, d] = kennungen([ev('2026-11-26'), ev('2026-11-27'), ev('2026-11-26', { placeName: 'Pirna' }), ev('2026-11-27', { placeName: 'Pirna' })]);
  assert.ok(a && c && a === b && c === d && a !== c);
});

test('Theater und Konzert bleiben einzeln', () => {
  assert.deepEqual(OHNE_SERIE, ['theater', 'konzert']);
  for (const rubrik of OHNE_SERIE) {
    assert.deepEqual(kennungen([ev('2026-11-26', { rubrik, genre: null }), ev('2026-11-27', { rubrik, genre: null })]), [null, null]);
  }
});

test('verschiedene Rubrik oder verschiedener Unterpunkt: keine Serie', () => {
  assert.deepEqual(kennungen([ev('2026-11-26'), ev('2026-11-27', { rubrik: 'fest' })]), [null, null]);
  assert.deepEqual(kennungen([ev('2026-11-26'), ev('2026-11-27', { genre: 'handwerk' })]), [null, null]);
});

test('Lücke: 42 Tage halten zusammen, 43 trennen; Teile mit einem Termin sind Einzeltermine', () => {
  assert.equal(SERIEN_LUECKE_TAGE, 42);
  const [a, b] = kennungen([ev('2026-11-26'), ev('2027-01-07')]); // 42 Tage
  assert.ok(a && a === b);
  assert.deepEqual(kennungen([ev('2026-11-26'), ev('2027-01-08')]), [null, null]); // 43 Tage
  const k = kennungen([ev('2026-11-26'), ev('2026-11-27'), ev('2027-11-25'), ev('2027-11-26'), ev('2028-06-01')]);
  assert.ok(k[0] === k[1] && k[2] === k[3] && k[0] !== k[2]);
  assert.equal(k[4], null);
});

test('ohne Ortsangabe nie eine Serie', () => {
  assert.deepEqual(kennungen([ev('2026-11-26', { placeName: '' }), ev('2026-11-27', { placeName: '  ' })]), [null, null]);
});

test('zwei Einträge mit gleichem start gehören zur selben Serie; Reihenfolge und Eingabe bleiben', () => {
  const liste = [ev('2026-11-27'), ev('2026-11-26'), ev('2026-11-26')];
  const out = markiereSerien(liste);
  assert.deepEqual(out.events.map((e) => e.id), liste.map((e) => e.id));
  assert.equal(new Set(out.events.map((e) => e.serie)).size, 1);
  assert.ok(liste.every((e) => !Object.hasOwn(e, 'serie')));
  assert.deepEqual([out.serien, out.termine], [1, 3]);
});

test('Quelle spielt keine Rolle', () => {
  const [a, b] = kennungen([ev('2026-11-26'), ev('2026-11-27', { sourceName: 'B', sourceUrl: 'https://b.example/' })]);
  assert.ok(a && a === b);
});
