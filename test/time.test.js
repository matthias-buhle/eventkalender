import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berlinIso, parseGermanDate, todayBerlin } from '../src/time.js';

test('berlinIso im Sommer hat Offset +02:00', () => {
  assert.equal(berlinIso('2026-07-01', '20:00'), '2026-07-01T20:00:00+02:00');
});

test('berlinIso im Winter hat Offset +01:00', () => {
  assert.equal(berlinIso('2026-11-14', '10:00'), '2026-11-14T10:00:00+01:00');
});

test('berlinIso am Tag der Umstellung mittags hat +02:00', () => {
  assert.ok(berlinIso('2026-03-29', '12:00').endsWith('+02:00'));
});

test('berlinIso ohne Uhrzeit liefert Mitternacht', () => {
  assert.equal(berlinIso('2026-11-14', null), '2026-11-14T00:00:00+01:00');
});

test('parseGermanDate versteht Wochentag mit Datum', () => {
  assert.equal(parseGermanDate('Di, 10.11.2026'), '2026-11-10');
});

test('parseGermanDate versteht nacktes Datum mit einstelligem Tag', () => {
  assert.equal(parseGermanDate('3.2.2027'), '2027-02-03');
});

test('parseGermanDate liefert null bei Unsinn', () => {
  assert.equal(parseGermanDate('bald'), null);
  assert.equal(parseGermanDate('31.13.2026'), null);
});

test('todayBerlin rechnet UTC-Abend in den nächsten Berliner Tag um', () => {
  assert.equal(todayBerlin(new Date('2026-11-14T23:30:00Z')), '2026-11-15');
});
