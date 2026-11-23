import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFS } from '../site/js/filter.js';
import { tageMitTerminen, monateMitTerminen, monatsRaster, monatsName, tagWaehlen, markierterBereich } from '../site/js/kalender.js';

const NOW = '2026-11-23T10:00:00Z'; // Montag, 23.11.2026, 11:00 Uhr in Berlin
const HEUTE = '2026-11-23';
const ev = (extra = {}) => ({
  id: 'x', title: 'Termin', art: 'konzert', tags: [], start: '2026-11-27T19:00:00+01:00', end: null, hasTime: true,
  placeName: 'Pirna', distanceKm: 20, country: 'DE', ...extra,
});
// Der Zeitraum der Prefs darf die Tage nicht beeinflussen; hier absichtlich auf "heute" gestellt.
const prefs = (extra = {}) => ({ ...DEFAULT_PREFS, zeit: 'heute', ...extra });
const tage = (liste, p = prefs(), orte = {}) => [...tageMitTerminen(liste, p, NOW, orte)].sort();

test('tageMitTerminen: ein Eintagstermin zählt nur an seinem Tag', () => {
  assert.deepEqual(tage([ev()]), ['2026-11-27']);
});

test('tageMitTerminen: ein mehrtägiger Termin zählt an jedem Tag von heute bis zum letzten Tag, nie davor', () => {
  const markt = ev({ id: 'markt', start: '2026-11-20T10:00:00+01:00', end: '2026-12-23T20:00:00+01:00' });
  const t = tage([markt]);
  assert.equal(t[0], '2026-11-23'); // 20.–22.11. liegen vor heute
  assert.equal(t.at(-1), '2026-12-23');
  assert.equal(t.length, 31); // 23.11. bis 23.12.
  assert.ok(t.includes('2026-12-01'));
});

test('tageMitTerminen: ein Markt ab 24.11. zählt vom 24.11. bis 23.12. lückenlos', () => {
  const markt = ev({ id: 'markt', start: '2026-11-24T10:00:00+01:00', end: '2026-12-23T20:00:00+01:00' });
  const t = tage([markt]);
  assert.equal(t.length, 30);
  assert.equal(t[0], '2026-11-24');
  assert.equal(t.at(-1), '2026-12-23');
});

test('tageMitTerminen: vergangene Tage und vergangene Termine fehlen, heute zählt', () => {
  const t = tage([
    ev({ id: 'gestern', start: '2026-11-22T19:00:00+01:00' }),
    ev({ id: 'heute', start: '2026-11-23T19:00:00+01:00' }),
  ]);
  assert.deepEqual(t, ['2026-11-23']);
});

test('tageMitTerminen: Mitternachtsende zählt nicht für den Folgetag (wie lastDay)', () => {
  const t = tage([ev({ start: '2026-11-27T20:00:00+01:00', end: '2026-11-28T00:00:00+01:00' })]);
  assert.deepEqual(t, ['2026-11-27']);
});

test('tageMitTerminen: berücksichtigt rubriken', () => {
  const liste = [ev({ id: 'k', rubrik: 'konzert', start: '2026-11-27T19:00:00+01:00' }), ev({ id: 'm', rubrik: 'markt', art: 'markt', start: '2026-11-28T10:00:00+01:00' })];
  assert.deepEqual(tage(liste, prefs({ rubriken: ['markt'] })), ['2026-11-28']);
  assert.deepEqual(tage(liste, prefs({ rubriken: [] })), ['2026-11-27', '2026-11-28']);
});

test('tageMitTerminen: berücksichtigt maxKm ohne Mitte (distanceKm)', () => {
  const liste = [ev({ id: 'nah', distanceKm: 10, start: '2026-11-27T19:00:00+01:00' }), ev({ id: 'fern', distanceKm: 60, start: '2026-11-28T19:00:00+01:00' })];
  assert.deepEqual(tage(liste, prefs({ maxKm: 25 })), ['2026-11-27']);
});

test('tageMitTerminen: berücksichtigt ort und maxKm (Umkreis um den gewählten Ort)', () => {
  const orte = { Dresden: { lat: 51.05, lon: 13.74 } };
  const liste = [
    ev({ id: 'dd', lat: 51.05, lon: 13.74, start: '2026-11-27T19:00:00+01:00' }),
    ev({ id: 'bautzen', lat: 51.18, lon: 14.43, start: '2026-11-28T19:00:00+01:00' }), // gut 50 km von Dresden
  ];
  assert.deepEqual(tage(liste, prefs({ ort: 'Dresden', maxKm: 10 }), orte), ['2026-11-27']);
  assert.deepEqual(tage(liste, prefs({ ort: 'Dresden', maxKm: 75 }), orte), ['2026-11-27', '2026-11-28']);
});

test('tageMitTerminen: Advent-Schalter wirkt auf die Punkte', () => {
  const liste = [ev({ id: 'a', advent: true, start: '2026-11-27T19:00:00+01:00' }), ev({ id: 'b', start: '2026-11-28T19:00:00+01:00' })];
  assert.deepEqual(tage(liste, prefs({ advent: true })), ['2026-11-27']);
  assert.deepEqual(tage(liste, prefs({ advent: false })), ['2026-11-27', '2026-11-28']);
});

test('tageMitTerminen: der Zeitraum der Prefs wird ignoriert', () => {
  const liste = [ev({ start: '2026-12-05T19:00:00+01:00' })];
  for (const p of [prefs({ zeit: 'heute' }), prefs({ zeit: 'wochenende' }), prefs({ zeit: '7' }), prefs({ zeit: 'tage', von: '2026-11-24', bis: '2026-11-25' }), prefs({ zeit: 'alle' })]) {
    assert.deepEqual(tage(liste, p), ['2026-12-05'], p.zeit);
  }
});

test('tageMitTerminen: höchstens 400 Tage voraus', () => {
  const lang = ev({ start: '2026-11-23T10:00:00+01:00', end: '2030-01-01T10:00:00+01:00' });
  const t = tage([lang]);
  assert.equal(t.length, 401); // heute plus 400 Tage
  assert.equal(t.at(-1), '2027-12-28');
  assert.deepEqual(tage([ev({ start: '2027-12-29T10:00:00+01:00' })]), []); // Tag 401 liegt außerhalb
  assert.deepEqual(tage([ev({ start: '2027-12-28T10:00:00+01:00' })]), ['2027-12-28']);
});

test('Jahreswechsel: 30.12. bis 02.01. liefert vier Tage über zwei Jahre, die Monate sind Dezember und Januar', () => {
  const t = tageMitTerminen([ev({ start: '2026-12-30T10:00:00+01:00', end: '2027-01-02T18:00:00+01:00' })], prefs(), NOW, {});
  assert.deepEqual([...t].sort(), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(monateMitTerminen(t, HEUTE), ['2026-11', '2026-12', '2027-01']);
});

test('monateMitTerminen: Monat von heute ist immer dabei, aufsteigend, ohne Doppelte', () => {
  assert.deepEqual(monateMitTerminen(new Set(), HEUTE), ['2026-11']);
  assert.deepEqual(monateMitTerminen(new Set(['2027-01-02', '2026-12-30', '2026-12-31']), HEUTE), ['2026-11', '2026-12', '2027-01']);
  assert.deepEqual(monateMitTerminen(new Set(['2026-11-30']), HEUTE), ['2026-11']);
});

test('monatsRaster: November 2026 beginnt mit sechs Leerzellen und hat 42 Zellen', () => {
  const raster = monatsRaster('2026-11');
  assert.equal(raster.length, 42);
  assert.deepEqual(raster.slice(0, 6), [null, null, null, null, null, null]);
  assert.equal(raster[6], '2026-11-01');
  assert.ok(raster.includes('2026-11-30'));
  assert.equal(raster.filter((z) => z !== null).length, 30);
  assert.equal(raster.at(-1), null);
});

test('monatsRaster: Februar 2028 enthält den 29., ein Monat, der am Montag beginnt, hat keine Leerzellen davor', () => {
  assert.ok(monatsRaster('2028-02').includes('2028-02-29'));
  assert.equal(monatsRaster('2028-02').filter((z) => z !== null).length, 29);
  const jun = monatsRaster('2026-06'); // 1.6.2026 ist ein Montag
  assert.equal(jun[0], '2026-06-01');
  assert.equal(jun.length, 42);
});

test('monatsName: deutscher Monat mit Jahr', () => {
  assert.equal(monatsName('2026-11'), 'November 2026');
  assert.equal(monatsName('2027-03'), 'März 2027');
});

const tageWahl = (von, bis) => ({ ...DEFAULT_PREFS, zeit: 'tage', von, bis });

test('tagWaehlen: erster Tipp ohne Tage-Auswahl wählt einen einzelnen Tag', () => {
  assert.deepEqual(tagWaehlen({ ...DEFAULT_PREFS, zeit: 'wochenende', von: null, bis: null }, '2026-11-28'), { zeit: 'tage', von: '2026-11-28', bis: '2026-11-28' });
});

test('tagWaehlen: vorher "alle" gilt auch als erster Tipp', () => {
  assert.deepEqual(tagWaehlen({ ...DEFAULT_PREFS, zeit: 'alle' }, '2026-12-01'), { zeit: 'tage', von: '2026-12-01', bis: '2026-12-01' });
});

test('tagWaehlen: zweiter Tipp auf einen späteren Tag bei einem Einzeltag ergibt den Zeitraum', () => {
  assert.deepEqual(tagWaehlen(tageWahl('2026-11-28', '2026-11-28'), '2026-12-02'), { zeit: 'tage', von: '2026-11-28', bis: '2026-12-02' });
});

test('tagWaehlen: zweiter Tipp auf einen früheren Tag beginnt neu mit diesem Einzeltag', () => {
  assert.deepEqual(tagWaehlen(tageWahl('2026-11-28', '2026-11-28'), '2026-11-25'), { zeit: 'tage', von: '2026-11-25', bis: '2026-11-25' });
});

test('tagWaehlen: bei einem vorhandenen Zeitraum wird der Tipp ein neuer Einzeltag', () => {
  assert.deepEqual(tagWaehlen(tageWahl('2026-11-28', '2026-12-02'), '2026-12-10'), { zeit: 'tage', von: '2026-12-10', bis: '2026-12-10' });
});

test('tagWaehlen: derselbe Tag noch einmal bleibt Einzeltag', () => {
  assert.deepEqual(tagWaehlen(tageWahl('2026-11-28', '2026-11-28'), '2026-11-28'), { zeit: 'tage', von: '2026-11-28', bis: '2026-11-28' });
});

test('tagWaehlen: eine offene Tage-Auswahl (bis null) ist kein Einzeltag und beginnt neu', () => {
  assert.deepEqual(tagWaehlen(tageWahl('2026-11-28', null), '2026-12-02'), { zeit: 'tage', von: '2026-12-02', bis: '2026-12-02' });
});

test('tagWaehlen: ändert die übergebenen Prefs nicht', () => {
  const p = tageWahl('2026-11-28', '2026-11-28');
  tagWaehlen(p, '2026-12-02');
  assert.deepEqual(p, tageWahl('2026-11-28', '2026-11-28'));
});

test('markierterBereich: Wochenende, 7 und 30 Tage liefern das Zeitfenster', () => {
  assert.deepEqual(markierterBereich({ zeit: 'wochenende' }, HEUTE), { von: '2026-11-27', bis: '2026-11-29' });
  assert.deepEqual(markierterBereich({ zeit: '7' }, HEUTE), { von: '2026-11-23', bis: '2026-11-29' });
  assert.deepEqual(markierterBereich({ zeit: '30' }, HEUTE), { von: '2026-11-23', bis: '2026-12-22' });
});

test('markierterBereich: heute ist der Tag selbst, alle ist null', () => {
  assert.deepEqual(markierterBereich({ zeit: 'heute' }, HEUTE), { von: '2026-11-23', bis: '2026-11-23' });
  assert.equal(markierterBereich({ zeit: 'alle' }, HEUTE), null);
});

test('markierterBereich: tage liefert dieselben Tage, ein Anfang vor heute beginnt heute', () => {
  assert.deepEqual(markierterBereich({ zeit: 'tage', von: '2026-12-01', bis: '2026-12-05' }, HEUTE), { von: '2026-12-01', bis: '2026-12-05' });
  assert.deepEqual(markierterBereich({ zeit: 'tage', von: '2026-11-01', bis: '2026-11-25' }, HEUTE), { von: '2026-11-23', bis: '2026-11-25' });
});

test('markierterBereich: tage mit offenem Ende läuft bis zum Kalenderende (heute plus 400 Tage)', () => {
  assert.deepEqual(markierterBereich({ zeit: 'tage', von: '2026-12-01', bis: null }, HEUTE), { von: '2026-12-01', bis: '2027-12-28' });
});
