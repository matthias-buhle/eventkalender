import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';
import { markiereSerien, SERIEN_LUECKE_TAGE, SERIEN_ORT_METER, OHNE_SERIE } from '../src/serien.js';

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
  const [a, b] = kennungen([ev('2026-11-26', { title: 'STRIEZELMARKT!' }), ev('2026-11-27', { placeName: 'Dresden' })].map((e) => ({ ...e, lat: 51.0504, lon: 13.7373 })));
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

// --- Offenes Ende (A) ---
const donnerstage = () => ['2026-11-26', '2026-12-03', '2026-12-10', '2026-12-17'].map((tag) => ev(tag));
const anderes = (tag, extra = {}) => ev(tag, { title: 'Anderes', placeName: 'Pirna', ...extra });
const offen = (liste) => markiereSerien(liste).events.map((e) => e.endeOffen);

test('offenes Ende: die Quelle liefert bis kurz nach dem letzten Termin, die Serie reicht an den Rand des Abrufs', () => {
  const out = markiereSerien([...donnerstage(), anderes('2026-12-20')]);
  assert.deepEqual(out.events.slice(0, 4).map((e) => e.endeOffen), [true, true, true, true]);
  assert.equal(out.events[4].endeOffen, false);
  assert.equal(out.offen, 1);
});

test('offenes Ende: liefert die Quelle noch 30 Tage später etwas, ist die Serie zu Ende', () => {
  const out = markiereSerien([...donnerstage(), anderes('2027-01-16')]);
  assert.deepEqual(out.events.slice(0, 4).map((e) => e.endeOffen), [false, false, false, false]);
  assert.equal(out.offen, 0);
});

test('offenes Ende: tägliche Kette, Abstand 1 Tag', () => {
  const tage = ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30'].map((tag) => ev(tag));
  assert.deepEqual(offen([...tage, anderes('2026-12-02')]).slice(0, 5), [false, false, false, false, false]);
  assert.deepEqual(offen([...tage, anderes('2026-11-30')]).slice(0, 5), [true, true, true, true, true]);
});

test('offenes Ende: mit zwei Quellen zählt das spätere Quellenende', () => {
  const b = { sourceName: 'B', sourceUrl: 'https://b.example/' };
  const liste = [ev('2026-11-26'), ev('2026-12-03'), ev('2026-12-10', b), ev('2026-12-17', b),
    anderes('2026-12-20'), // Quelle A reicht bis 20.12.
    anderes('2027-01-20', b)]; // Quelle B reicht bis 20.1.
  assert.deepEqual(offen(liste).slice(0, 4), [false, false, false, false]);
});

test('offenes Ende: alle Einträge am selben Tag, keine Rhythmusrechnung', () => {
  const liste = [ev('2026-11-26'), ev('2026-11-26', { start: '2026-11-26T14:00:00+01:00' })];
  assert.deepEqual(offen(liste), [false, false]);
});

test('offenes Ende: volle Terminliste am letzten Tag, auch wenn nur der zweite Eintrag des Tages sie trägt', () => {
  const liste = [ev('2026-11-26'), ev('2026-12-26'), ev('2026-12-26', { terminlisteVoll: true }), anderes('2027-06-01')];
  assert.deepEqual(offen(liste).slice(0, 3), [true, true, true]);
});

test('offenes Ende: Einzeltermin false, Eingabe bleibt ohne das Feld', () => {
  const liste = [ev('2026-11-26', { title: 'Einzeln' }), ...donnerstage()];
  const out = markiereSerien(liste);
  assert.equal(out.events[0].endeOffen, false);
  assert.ok(liste.every((e) => !Object.hasOwn(e, 'endeOffen')));
});

// --- Spielstätten (B) ---
const zwinger = { lat: 51.0534, lon: 13.7342 };
const schloss = { lat: 51.0504, lon: 13.7373 }; // rund 400 m entfernt
const fuehrung = (tag, ort, koord, extra = {}) => ev(tag, { title: 'Öffentliche Führung', rubrik: 'fest', genre: null, placeName: ort, ...koord, ...extra });

test('Spielstätten: zwei Stätten einer Stadt bleiben zwei Serien, auch bei gleichem start', () => {
  assert.equal(SERIEN_ORT_METER, 300);
  const z = (tag) => fuehrung(tag, 'Zwinger, Dresden', zwinger);
  const s = (tag) => fuehrung(tag, 'Schloss, Dresden', schloss);
  const out = markiereSerien([z('2026-11-26'), s('2026-11-26'), z('2026-11-27'), s('2026-11-27'), z('2026-11-28'), s('2026-11-28')]);
  const k = out.events.map((e) => e.serie);
  assert.ok(k[0] && k[0] === k[2] && k[2] === k[4]);
  assert.ok(k[1] && k[1] === k[3] && k[3] === k[5]);
  assert.notEqual(k[0], k[1]);
  assert.deepEqual([out.serien, out.termine], [2, 6]);
});

test('Spielstätten: zwei Schreibweisen derselben Stätte, 50 m auseinander, bleiben eine Serie', () => {
  const markt = (tag, ort, lat) => ev(tag, { placeName: ort, lat, lon: 13.4737 });
  const k = kennungen([markt('2026-11-26', 'Markt 01662 Meißen, Meißen', 51.16), markt('2026-11-27', 'Meißner Weihnacht, Meißen', 51.16045)]);
  assert.ok(k[0] && k[0] === k[1]);
});

test('Spielstätten: ohne Koordinaten gilt der gefaltete placeName', () => {
  const k = kennungen([fuehrung('2026-11-26', 'Zwinger, Dresden', {}), fuehrung('2026-11-27', 'ZWINGER, Dresden', {}), fuehrung('2026-11-27', 'Schloss, Dresden', {})]);
  assert.ok(k[0] && k[0] === k[1]);
  assert.equal(k[2], null);
});

test('Spielstätten: zwei Stätten mit gleichem ersten Tag haben verschiedene Kennungen', () => {
  const k = kennungen([
    fuehrung('2026-11-26', 'Zwinger, Dresden', zwinger), fuehrung('2026-11-27', 'Zwinger, Dresden', zwinger),
    fuehrung('2026-11-26', 'Schloss, Dresden', schloss), fuehrung('2026-11-27', 'Schloss, Dresden', schloss),
  ]);
  assert.ok(k[0] && k[2] && k[0] !== k[2]);
});
