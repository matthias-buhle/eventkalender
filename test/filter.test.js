import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, groupByDay, loadPrefs, savePrefs, DEFAULT_PREFS } from '../site/js/filter.js';

const NOW = '2026-11-08T19:30:00Z'; // 20:30 Uhr in Berlin
const ev = (extra = {}) => ({
  id: 'x', title: 'Termin', art: 'konzert', tags: [], start: '2026-11-08T19:00:00+01:00', end: null, hasTime: true,
  placeName: 'Pirna', distanceKm: 20, country: 'DE', ...extra,
});
// Die Tests hier prüfen die übrigen Filter; der Zeitraum steht auf "alle" (Standard ist "wochenende").
const prefs = (extra = {}) => ({ ...DEFAULT_PREFS, zeit: 'alle', ...extra });

function fakeStorage(inhalt = {}) {
  const daten = { ...inhalt };
  return { getItem: (k) => (k in daten ? daten[k] : null), setItem: (k, v) => { daten[k] = String(v); }, daten };
}

test('Rubrik filtern: nur die gewählten Rubriken; ohne Feld rubrik gilt die Art; leer heißt alle', () => {
  const liste = [
    ev({ id: 'fuehrung', rubrik: 'fuehrung', art: 'sonstiges' }),
    ev({ id: 'alt-konzert', art: 'konzert' }), // alte Daten ohne rubrik
    ev({ id: 'markt', rubrik: 'markt', art: 'markt' }),
    ev({ id: 'theater', rubrik: 'theater', art: 'sonstiges' }),
  ];
  const ids = (rubriken) => applyFilters(liste, prefs({ rubriken }), NOW).map((e) => e.id);
  assert.deepEqual(ids(['fuehrung']), ['fuehrung']);
  assert.deepEqual(ids(['konzert']), ['alt-konzert']);
  assert.deepEqual(ids(['konzert', 'theater']), ['alt-konzert', 'theater']);
  assert.deepEqual(ids([]), ['fuehrung', 'alt-konzert', 'markt', 'theater']);
});

test('applyFilters blendet hiddenTags aus', () => {
  const liste = [ev({ id: 'a', tags: ['80er'] }), ev({ id: 'b', tags: ['kinder', '80er'] }), ev({ id: 'c', tags: [] })];
  assert.deepEqual(applyFilters(liste, prefs({ hiddenTags: ['kinder'] }), NOW).map((e) => e.id), ['a', 'c']);
});

test('applyFilters blendet Termine über maxKm aus, behält distanceKm null', () => {
  const liste = [ev({ id: 'nah', distanceKm: 10 }), ev({ id: 'fern', distanceKm: 60 }), ev({ id: 'unbekannt', distanceKm: null }), ev({ id: 'genau', distanceKm: 30 })];
  assert.deepEqual(applyFilters(liste, prefs({ maxKm: 30 }), NOW).map((e) => e.id), ['nah', 'unbekannt', 'genau']);
});

test('applyFilters blendet CZ bei showCZ false aus', () => {
  const liste = [ev({ id: 'de' }), ev({ id: 'cz', country: 'CZ' })];
  assert.deepEqual(applyFilters(liste, prefs({ showCZ: false }), NOW).map((e) => e.id), ['de']);
  assert.deepEqual(applyFilters(liste, prefs({ showCZ: true }), NOW).map((e) => e.id), ['de', 'cz']);
});

test('applyFilters entfernt Termin von gestern, behält heute', () => {
  const liste = [
    ev({ id: 'gestern', start: '2026-11-07T19:00:00+01:00' }),
    ev({ id: 'heute-frueh', start: '2026-11-08T10:00:00+01:00' }), // Beginn schon vorbei, kein Ende: bleibt bis Tagesende
    ev({ id: 'heute-ohne-zeit', start: '2026-11-08T00:00:00+01:00', hasTime: false }),
    ev({ id: 'morgen', start: '2026-11-09T19:00:00+01:00' }),
  ];
  assert.deepEqual(applyFilters(liste, prefs(), NOW).map((e) => e.id), ['heute-frueh', 'heute-ohne-zeit', 'morgen']);
});

test('applyFilters behält mehrtägigen Termin bis zum letzten Tag und rechnet "heute" nach Berliner Zeit', () => {
  const markt = ev({ id: 'markt', start: '2026-11-06T00:00:00+01:00', end: '2026-11-08T00:00:00+01:00', hasTime: false });
  assert.equal(applyFilters([markt], prefs(), NOW).length, 1, 'letzter Tag ist heute');
  assert.equal(applyFilters([markt], prefs(), '2026-11-08T23:30:00Z').length, 0, 'in Berlin schon der 9. November');
});

test('applyFilters: Ende um 00:00 Uhr zählt zum Vortag', () => {
  const tanz = ev({ id: 'tanz', start: '2026-11-07T19:30:00+01:00', end: '2026-11-08T00:00:00+01:00' });
  assert.equal(applyFilters([tanz], prefs(), NOW).length, 0);
  assert.equal(applyFilters([tanz], prefs(), '2026-11-07T20:00:00Z').length, 1);
});

test('groupByDay sortiert aufsteigend', () => {
  const liste = [
    ev({ id: 'c', start: '2026-11-10T09:00:00+01:00' }),
    ev({ id: 'b2', start: '2026-11-09T20:00:00+01:00' }),
    ev({ id: 'b1', start: '2026-11-09T10:00:00+01:00' }),
    ev({ id: 'a', start: '2026-11-08T21:00:00+01:00' }),
  ];
  const gruppen = groupByDay(liste);
  assert.deepEqual(gruppen.map((g) => g.day), ['2026-11-08', '2026-11-09', '2026-11-10']);
  assert.deepEqual(gruppen[1].events.map((e) => e.id), ['b1', 'b2']);
});

test('groupByDay legt laufende Termine auf den ersten sichtbaren Tag', () => {
  const laufend = ev({ id: 'laeuft', start: '2026-11-06T00:00:00+01:00', end: '2026-11-09T00:00:00+01:00', hasTime: false });
  const gruppen = groupByDay([laufend, ev({ id: 'heute' })], '2026-11-08');
  assert.deepEqual(gruppen.map((g) => g.day), ['2026-11-08']);
  assert.deepEqual(gruppen[0].events.map((e) => e.id).sort(), ['heute', 'laeuft']);
});

test('loadPrefs liefert Standard bei kaputtem JSON', () => {
  assert.deepEqual(loadPrefs(fakeStorage({ 'eventkalender.prefs': '{kaputt' })), DEFAULT_PREFS);
});

test('loadPrefs liefert Standard ohne Speicher, bei werfendem Speicher und bei falschen Typen', () => {
  assert.deepEqual(loadPrefs(null), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs(undefined), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs({ getItem() { throw new Error('gesperrt'); } }), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs(fakeStorage({ 'eventkalender.prefs': '"text"' })), DEFAULT_PREFS);
  const gemischt = loadPrefs(fakeStorage({ 'eventkalender.prefs': JSON.stringify({ hiddenArt: 'markt', maxKm: 'viel', showCZ: false, hiddenTags: ['a', 3] }) }));
  assert.deepEqual(gemischt, { ...DEFAULT_PREFS, hiddenTags: ['a'], showCZ: false });
});

test('Standard blendet nichts aus: alle Rubriken, 75 km, Tschechien an, Wochenende', () => {
  assert.deepEqual(DEFAULT_PREFS, {
    rubriken: [], hiddenGenres: [], hiddenTags: [], maxKm: 75, showCZ: true, ort: null,
    zeit: 'wochenende', von: null, bis: null, suche: '',
  });
  assert.ok(Object.isFrozen(DEFAULT_PREFS) && Object.isFrozen(DEFAULT_PREFS.rubriken), 'der Standard ist nicht veränderbar');
  const geladen = loadPrefs(null);
  assert.ok(!Object.isFrozen(geladen) && geladen.rubriken !== DEFAULT_PREFS.rubriken, 'loadPrefs liefert eine eigene Kopie');
});

test('savePrefs und loadPrefs: Rundlauf; werfender Speicher löst keine Ausnahme aus', () => {
  const speicher = fakeStorage();
  const eigene = {
    rubriken: ['markt'], hiddenGenres: ['jazz'], hiddenTags: ['kinder'], maxKm: 50, showCZ: false, ort: 'Bautzen',
    zeit: 'wochenende', von: null, bis: null, suche: '',
  };
  savePrefs(speicher, eigene);
  assert.deepEqual(loadPrefs(speicher), eigene);
  savePrefs(speicher, { ...eigene, suche: 'Rammstein' });
  assert.equal(loadPrefs(speicher).suche, '', 'die Suche wird nicht gemerkt');
  assert.doesNotThrow(() => savePrefs({ setItem() { throw new Error('voll'); } }, eigene));
  assert.doesNotThrow(() => savePrefs(null, eigene));
});
