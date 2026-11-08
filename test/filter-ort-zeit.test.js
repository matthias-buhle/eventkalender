import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, loadPrefs, zeitfenster, DEFAULT_PREFS } from '../site/js/filter.js';

const NOW = '2026-11-08T19:30:00Z'; // Sonntag, 20:30 Uhr in Berlin
const ev = (extra = {}) => ({
  id: 'x', title: 'Termin', art: 'konzert', tags: [], start: '2026-11-08T19:00:00+01:00', end: null, hasTime: true,
  placeName: 'Pirna', distanceKm: 20, country: 'DE', ...extra,
});
const prefs = (extra = {}) => ({ ...DEFAULT_PREFS, ...extra });
const fakeStorage = (inhalt) => ({ getItem: (k) => (k in inhalt ? inhalt[k] : null), setItem() {} });

// --- Ort und Umkreis ---

const ORTE = { Bautzen: { lat: 51.1814, lon: 14.4244 }, Sebnitz: { lat: 50.9408, lon: 14.2677 } };

test('Ort + Umkreis: gemessen wird von der gewählten Mitte, nicht von Sebnitz; Termine ohne Koordinaten bleiben', () => {
  const liste = [
    ev({ id: 'bautzen', lat: 51.18, lon: 14.42, distanceKm: 28 }),
    ev({ id: 'sebnitz', lat: 50.94, lon: 14.27, distanceKm: 0 }), // rund 27 km von Bautzen
    ev({ id: 'dresden', lat: 51.05, lon: 13.74, distanceKm: 40 }), // rund 46 km von Bautzen
    ev({ id: 'unbekannt', lat: null, lon: null, distanceKm: null }),
  ];
  const ids = (extra) => applyFilters(liste, prefs(extra), NOW, ORTE).map((e) => e.id);
  assert.deepEqual(ids({ ort: 'Bautzen', maxKm: 10 }), ['bautzen', 'unbekannt']);
  assert.deepEqual(ids({ ort: 'Bautzen', maxKm: 30 }), ['bautzen', 'sebnitz', 'unbekannt']);
  assert.deepEqual(ids({ ort: 'Bautzen', maxKm: 50 }), ['bautzen', 'sebnitz', 'dresden', 'unbekannt']);
  assert.deepEqual(ids({ ort: null, maxKm: 30 }), ['bautzen', 'sebnitz', 'unbekannt'], 'ohne Ort gilt distanceKm von Sebnitz');
});

test('Ort + Umkreis: ein gespeicherter Ort, der nicht (mehr) im Verzeichnis steht, fällt auf Sebnitz zurück', () => {
  const liste = [ev({ id: 'nah', distanceKm: 10, lat: 50.99, lon: 14.3 }), ev({ id: 'fern', distanceKm: 60, lat: 51.4, lon: 14.9 })];
  assert.deepEqual(applyFilters(liste, prefs({ ort: 'Nirgendwo', maxKm: 30 }), NOW, ORTE).map((e) => e.id), ['nah']);
  assert.deepEqual(applyFilters(liste, prefs({ ort: 'Bautzen', maxKm: 30 }), NOW).map((e) => e.id), ['nah'], 'ohne Ortsverzeichnis ebenso');
});

// --- Zeitraum ---

test('zeitfenster: Voreinstellungen alle, heute, 7 Tage, 30 Tage', () => {
  assert.deepEqual(zeitfenster(prefs({ zeit: 'alle' }), '2026-11-08'), { von: '2026-11-08', bis: null });
  assert.deepEqual(zeitfenster(prefs({ zeit: 'heute' }), '2026-11-08'), { von: '2026-11-08', bis: '2026-11-08' });
  assert.deepEqual(zeitfenster(prefs({ zeit: '7' }), '2026-11-08'), { von: '2026-11-08', bis: '2026-11-14' });
  assert.deepEqual(zeitfenster(prefs({ zeit: '30' }), '2026-11-08'), { von: '2026-11-08', bis: '2026-12-07' });
});

test('zeitfenster: Wochenende ist Freitag bis Sonntag; am Wochenende selbst ab heute', () => {
  const w = (tag) => zeitfenster(prefs({ zeit: 'wochenende' }), tag);
  assert.deepEqual(w('2026-11-09'), { von: '2026-11-13', bis: '2026-11-15' }, 'Montag');
  assert.deepEqual(w('2026-11-11'), { von: '2026-11-13', bis: '2026-11-15' }, 'Mittwoch');
  assert.deepEqual(w('2026-11-13'), { von: '2026-11-13', bis: '2026-11-15' }, 'Freitag');
  assert.deepEqual(w('2026-11-14'), { von: '2026-11-14', bis: '2026-11-15' }, 'Samstag');
  assert.deepEqual(w('2026-11-15'), { von: '2026-11-15', bis: '2026-11-15' }, 'Sonntag');
});

test('zeitfenster: eigener Zeitraum; offene Enden, ein Beginn in der Vergangenheit und vertauschte Daten', () => {
  assert.deepEqual(zeitfenster(prefs({ zeit: 'bereich', von: '2026-12-01', bis: '2026-12-24' }), '2026-11-08'), { von: '2026-12-01', bis: '2026-12-24' });
  assert.deepEqual(zeitfenster(prefs({ zeit: 'bereich', von: null, bis: '2026-12-24' }), '2026-11-08'), { von: '2026-11-08', bis: '2026-12-24' });
  assert.deepEqual(zeitfenster(prefs({ zeit: 'bereich', von: '2026-10-01', bis: null }), '2026-11-08'), { von: '2026-11-08', bis: null });
  assert.deepEqual(zeitfenster(prefs({ zeit: 'bereich', von: '2026-12-24', bis: '2026-12-01' }), '2026-11-08'), { von: '2026-12-01', bis: '2026-12-24' });
});

test('Zeitraum: Termine, die das Fenster berühren, bleiben (auch mehrtägige); andere fallen weg', () => {
  const liste = [
    ev({ id: 'heute', start: '2026-11-08T19:00:00+01:00' }),
    ev({ id: 'in3', start: '2026-11-11T19:00:00+01:00' }),
    ev({ id: 'in10', start: '2026-11-18T19:00:00+01:00' }),
    ev({ id: 'markt-laeuft', start: '2026-11-05T00:00:00+01:00', end: '2026-11-20T00:00:00+01:00', hasTime: false }),
    ev({ id: 'markt-spaeter', start: '2026-11-25T00:00:00+01:00', end: '2026-11-27T00:00:00+01:00', hasTime: false }),
  ];
  const ids = (extra) => applyFilters(liste, prefs(extra), NOW).map((e) => e.id);
  assert.deepEqual(ids({ zeit: 'heute' }), ['heute', 'markt-laeuft']);
  assert.deepEqual(ids({ zeit: '7' }), ['heute', 'in3', 'markt-laeuft']);
  assert.deepEqual(ids({ zeit: 'bereich', von: '2026-11-24', bis: '2026-11-30' }), ['markt-spaeter']);
  assert.deepEqual(ids({ zeit: 'alle' }), ['heute', 'in3', 'in10', 'markt-laeuft', 'markt-spaeter']);
});

test('loadPrefs: Ort, Zeitraum und Daten werden geprüft; ältere Einstellungen bekommen die Standardwerte', () => {
  const lade = (obj) => loadPrefs(fakeStorage({ 'eventkalender.prefs': JSON.stringify(obj) }));
  assert.deepEqual(lade({ hiddenArt: ['markt'], maxKm: 30 }), { ...DEFAULT_PREFS, hiddenArt: ['markt'], maxKm: 30 });
  assert.deepEqual(lade({ ort: 42, zeit: 'immer', von: 'gestern', bis: '2026-13-45x' }), DEFAULT_PREFS);
  const gut = lade({ ort: 'Bautzen', zeit: 'bereich', von: '2026-12-01', bis: '2026-12-24' });
  assert.deepEqual([gut.ort, gut.zeit, gut.von, gut.bis], ['Bautzen', 'bereich', '2026-12-01', '2026-12-24']);
});

// --- Genre ---

test('Genre: ausgeblendete Genres verschwinden; Konzerte ohne Genre zählen als "sonstige", andere Arten ohne Genre bleiben', () => {
  const liste = [
    ev({ id: 'rock', genre: 'rock-pop' }),
    ev({ id: 'jazz', genre: 'jazz' }),
    ev({ id: 'ohne', genre: null }),
    ev({ id: 'alt', genre: undefined }),
    ev({ id: 'comedy', art: 'sonstiges', genre: 'comedy' }),
    ev({ id: 'markt', art: 'markt', genre: null }),
  ];
  const ids = (hiddenGenres) => applyFilters(liste, prefs({ hiddenGenres }), NOW).map((e) => e.id);
  assert.deepEqual(ids([]), ['rock', 'jazz', 'ohne', 'alt', 'comedy', 'markt']);
  assert.deepEqual(ids(['jazz', 'comedy']), ['rock', 'ohne', 'alt', 'markt']);
  assert.deepEqual(ids(['sonstige']), ['rock', 'jazz', 'comedy', 'markt']);
});

test('loadPrefs: hiddenGenres wird als Textliste geprüft, ältere Einstellungen haben keine', () => {
  const lade = (obj) => loadPrefs(fakeStorage({ 'eventkalender.prefs': JSON.stringify(obj) }));
  assert.deepEqual(lade({ maxKm: 30 }).hiddenGenres, []);
  assert.deepEqual(lade({ hiddenGenres: ['jazz', 3, 'comedy'] }).hiddenGenres, ['jazz', 'comedy']);
  assert.deepEqual(lade({ hiddenGenres: 'jazz' }).hiddenGenres, []);
});
