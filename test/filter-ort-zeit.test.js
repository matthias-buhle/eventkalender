import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, loadPrefs, zeitfenster, einzelneArt, artWaehlen, wirksameSorten, DEFAULT_PREFS } from '../site/js/filter.js';
import { ARTEN } from '../site/js/arten.js';

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

test('zeitfenster: 60 Tage; ein unbekannter Wert (auch das frühere "bereich") gilt wie alle', () => {
  assert.deepEqual(zeitfenster(prefs({ zeit: '60' }), '2026-11-08'), { von: '2026-11-08', bis: '2027-01-06' });
  assert.deepEqual(zeitfenster(prefs({ zeit: 'bereich' }), '2026-11-08'), { von: '2026-11-08', bis: null });
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
  assert.deepEqual(ids({ zeit: 'alle' }), ['heute', 'in3', 'in10', 'markt-laeuft', 'markt-spaeter']);
});

test('loadPrefs: Ort, Zeitraum und Daten werden geprüft; ältere Einstellungen bekommen die Standardwerte', () => {
  const lade = (obj) => loadPrefs(fakeStorage({ 'eventkalender.prefs': JSON.stringify(obj) }));
  assert.deepEqual(lade({ hiddenArt: ['markt'], maxKm: 30 }), { ...DEFAULT_PREFS, hiddenArt: ['markt'], maxKm: 30 });
  assert.deepEqual(lade({ ort: 42, zeit: 'immer', von: 'gestern', suche: 'x' }), DEFAULT_PREFS);
  assert.deepEqual(lade({ zeit: 'bereich' }).zeit, 'alle', 'der frühere eigene Zeitraum ist weg');
  const gut = lade({ ort: 'Bautzen', zeit: '60' });
  assert.deepEqual([gut.ort, gut.zeit], ['Bautzen', '60']);
});

// --- Genre ---

const nur = (art) => ARTEN.filter((x) => x !== art);

test('einzelneArt: nur wenn genau eine Art angezeigt wird, sonst null', () => {
  assert.equal(einzelneArt([]), null, 'alle Arten');
  assert.equal(einzelneArt(nur('konzert')), 'konzert');
  assert.equal(einzelneArt(['party', 'fest']), null, 'vier Arten');
  assert.equal(einzelneArt(ARTEN), null, 'keine Art angezeigt');
});

test('artWaehlen: aus "alle" wird die angetippte Art allein; weitere dazu, abwählen, und leer oder voll heißt wieder alle', () => {
  assert.deepEqual(artWaehlen([], 'markt'), nur('markt'));
  assert.deepEqual(artWaehlen(nur('markt'), 'konzert'), ARTEN.filter((x) => x !== 'markt' && x !== 'konzert'));
  assert.deepEqual(artWaehlen(ARTEN.filter((x) => x !== 'markt' && x !== 'konzert'), 'markt'), nur('konzert'));
  assert.deepEqual(artWaehlen(nur('markt'), 'markt'), [], 'die letzte Art abwählen zeigt wieder alle');
  assert.deepEqual(artWaehlen(['party'], 'party'), [], 'alle fünf anderen plus die sechste: wieder alle');
});

test('Genre: bei Konzert allein verschwinden ausgeblendete Genres; Konzerte ohne Genre zählen als "sonstige"', () => {
  const liste = [
    ev({ id: 'rock', genre: 'rock-pop' }),
    ev({ id: 'jazz', genre: 'jazz' }),
    ev({ id: 'ohne', genre: null }),
    ev({ id: 'alt', genre: undefined }),
    ev({ id: 'markt', art: 'markt', genre: null }),
  ];
  const ids = (hiddenGenres) => applyFilters(liste, prefs({ hiddenGenres, hiddenArt: nur('konzert') }), NOW).map((e) => e.id);
  assert.deepEqual(ids([]), ['rock', 'jazz', 'ohne', 'alt']);
  assert.deepEqual(ids(['jazz', 'comedy']), ['rock', 'ohne', 'alt']);
  assert.deepEqual(ids(['sonstige']), ['rock', 'jazz']);
});

test('Sorte: bei Markt allein oder Schau allein lassen sich Sorten ausblenden; ohne bekannte Sorte gilt "sonstige-markt" bzw. "sonstige-schau"', () => {
  const markt = [
    ev({ id: 'weih', art: 'markt', genre: 'weihnachtsmarkt' }),
    ev({ id: 'trodel', art: 'markt', genre: 'troedel' }),
    ev({ id: 'm-ohne', art: 'markt', genre: null }),
    ev({ id: 'm-falsch', art: 'markt', genre: 'jazz' }),
  ];
  const mids = (hiddenGenres) => applyFilters(markt, prefs({ hiddenGenres, hiddenArt: nur('markt') }), NOW).map((e) => e.id);
  assert.deepEqual(mids(['weihnachtsmarkt']), ['trodel', 'm-ohne', 'm-falsch']);
  assert.deepEqual(mids(['sonstige-markt']), ['weih', 'trodel']);
  assert.deepEqual(mids(['sonstige']), ['weih', 'trodel', 'm-ohne', 'm-falsch'], 'Konzert-Schlüssel trifft keine Märkte');
  const schau = [ev({ id: 'tiere', art: 'schau', genre: 'tiere' }), ev({ id: 'kunst', art: 'schau', genre: 'kunst' }), ev({ id: 's-ohne', art: 'schau', genre: null })];
  const sids = (hiddenGenres) => applyFilters(schau, prefs({ hiddenGenres, hiddenArt: nur('schau') }), NOW).map((e) => e.id);
  assert.deepEqual(sids(['tiere', 'sonstige-schau']), ['kunst']);
});

test('Unterfilter wirken nur bei genau einer Art; bei mehreren Arten (oder allen) wird alles gezeigt', () => {
  const liste = [
    ev({ id: 'jazz', genre: 'jazz' }),
    ev({ id: 'weih', art: 'markt', genre: 'weihnachtsmarkt' }),
    ev({ id: 'tiere', art: 'schau', genre: 'tiere' }),
  ];
  const hidden = ['jazz', 'weihnachtsmarkt', 'tiere'];
  const ids = (hiddenArt) => applyFilters(liste, prefs({ hiddenGenres: hidden, hiddenArt }), NOW).map((e) => e.id);
  assert.deepEqual(ids([]), ['jazz', 'weih', 'tiere'], 'alle Arten');
  assert.deepEqual(ids(ARTEN.filter((x) => x !== 'konzert' && x !== 'markt')), ['jazz', 'weih'], 'zwei Arten');
  assert.deepEqual(ids(nur('konzert')), [], 'Konzert allein: Jazz ist aus');
  assert.deepEqual(ids(nur('markt')), [], 'Markt allein: Weihnachtsmarkt ist aus');
});

test('wirksameSorten: nur die Schlüssel der einzeln gewählten Art zählen', () => {
  const p = (hiddenArt, hiddenGenres) => prefs({ hiddenArt, hiddenGenres });
  assert.deepEqual(wirksameSorten(p(nur('konzert'), ['jazz', 'troedel', 'sonstige'])), ['jazz', 'sonstige']);
  assert.deepEqual(wirksameSorten(p(nur('markt'), ['jazz', 'troedel'])), ['troedel']);
  assert.deepEqual(wirksameSorten(p([], ['jazz'])), []);
  assert.deepEqual(wirksameSorten(p(nur('party'), ['jazz'])), []);
});

test('loadPrefs: hiddenGenres wird als Textliste geprüft, ältere Einstellungen haben keine', () => {
  const lade = (obj) => loadPrefs(fakeStorage({ 'eventkalender.prefs': JSON.stringify(obj) }));
  assert.deepEqual(lade({ maxKm: 30 }).hiddenGenres, []);
  assert.deepEqual(lade({ hiddenGenres: ['jazz', 3, 'comedy'] }).hiddenGenres, ['jazz', 'comedy']);
  assert.deepEqual(lade({ hiddenGenres: 'jazz' }).hiddenGenres, []);
});

// --- Suche ---

test('Suche: findet in Titel, Ort und Beschreibung; Groß-/Kleinschreibung, Umlaute und Ligaturen egal; alle Wörter müssen passen', () => {
  const liste = [
    ev({ id: 'ramm', title: 'RAMMSTEIN SYMPHONIC TRIBUTE', placeName: 'Dresden' }),
    ev({ id: 'jazz', title: 'Jazzabend', description: 'Mit dem Kölner Trio um Jürgen Groß', placeName: 'Görlitz' }),
    ev({ id: 'markt', title: 'Weihnachtsmarkt', placeName: 'Bad Schandau' }),
  ];
  const ids = (suche) => applyFilters(liste, prefs({ suche }), NOW).map((e) => e.id);
  assert.deepEqual(ids(''), ['ramm', 'jazz', 'markt']);
  assert.deepEqual(ids('   '), ['ramm', 'jazz', 'markt'], 'nur Leerzeichen suchen nichts');
  assert.deepEqual(ids('rammstein'), ['ramm']);
  assert.deepEqual(ids('goerlitz'), ['jazz'], 'Ort mit ö');
  assert.deepEqual(ids('görlitz jazz'), ['jazz']);
  assert.deepEqual(ids('kolner trio'), ['jazz'], 'Beschreibung, ohne Umlaut');
  assert.deepEqual(ids('jürgen gross'), ['jazz'], 'ß wie ss');
  assert.deepEqual(ids('jazz markt'), [], 'alle Wörter müssen vorkommen');
  assert.deepEqual(ids('xyz'), []);
});
