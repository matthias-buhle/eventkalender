import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFilters, loadPrefs, savePrefs, zeitfenster, rubrikWaehlen, wirksameSorten, zaehleRubriken,
  zusammenfassung, tagPlus, UMKREISE, ZEITEN, DEFAULT_PREFS,
} from '../site/js/filter.js';
import * as filterModul from '../site/js/filter.js';

// Erst mit diesem Fix vorhanden; so scheitern die neuen Tests einzeln statt das ganze Modul beim Import.
const zeitAbgelaufen = (...a) => filterModul.zeitAbgelaufen(...a);
const nachRueckkehr = (...a) => filterModul.nachRueckkehr(...a);
const zeitZurueckgesetzt = (...a) => filterModul.zeitZurueckgesetzt(...a);
const sortenSchluessel = (...a) => filterModul.sortenSchluessel(...a);
const gewaehlteSorten = (...a) => filterModul.gewaehlteSorten(...a);
const sorteWaehlen = (...a) => filterModul.sorteWaehlen(...a);
const rubrikGetippt = (...a) => filterModul.rubrikGetippt(...a);
import { RUBRIKEN } from '../site/js/arten.js';

const NOW = '2026-11-08T19:30:00Z'; // Sonntag, 20:30 Uhr in Berlin
const ev = (extra = {}) => ({
  id: 'x', title: 'Termin', art: 'konzert', tags: [], start: '2026-11-08T19:00:00+01:00', end: null, hasTime: true,
  placeName: 'Pirna', distanceKm: 20, country: 'DE', ...extra,
});
// Zeitraum "alle", damit die übrigen Filter für sich geprüft werden (Standard ist "wochenende").
const prefs = (extra = {}) => ({ ...DEFAULT_PREFS, zeit: 'alle', ...extra });
const fakeStorage = (inhalt) => ({ getItem: (k) => (k in inhalt ? inhalt[k] : null), setItem() {} });
const ALLE_KEYS = RUBRIKEN.map((r) => r.key);

test('Konstanten: Umkreisstufen und Zeiträume', () => {
  assert.deepEqual(UMKREISE, [10, 25, 50, 75]);
  assert.deepEqual(ZEITEN, ['alle', 'heute', 'wochenende', '7', '30', 'tage']);
  assert.equal(tagPlus('2026-12-31', 1), '2027-01-01');
  assert.equal(tagPlus('2026-03-01', -1), '2026-02-28');
});

// --- Ort und Umkreis ---

const ORTE = { Bautzen: { lat: 51.1814, lon: 14.4244 }, Sebnitz: { lat: 50.9408, lon: 14.2677 }, Görlitz: { lat: 51.1528, lon: 14.9872 } };

test('Ort + Umkreis: gemessen wird von der gewählten Mitte, nicht von Sebnitz; Termine ohne Koordinaten bleiben', () => {
  const liste = [
    ev({ id: 'bautzen', lat: 51.18, lon: 14.42, distanceKm: 28 }),
    ev({ id: 'sebnitz', lat: 50.94, lon: 14.27, distanceKm: 0 }), // rund 27 km von Bautzen
    ev({ id: 'dresden', lat: 51.05, lon: 13.74, distanceKm: 40 }), // rund 46 km von Bautzen
    ev({ id: 'unbekannt', lat: null, lon: null, distanceKm: null }),
  ];
  const ids = (extra) => applyFilters(liste, prefs(extra), NOW, ORTE).map((e) => e.id);
  assert.deepEqual(ids({ ort: 'Bautzen', maxKm: 10 }), ['bautzen', 'unbekannt']);
  assert.deepEqual(ids({ ort: 'Bautzen', maxKm: 25 }), ['bautzen', 'unbekannt']);
  assert.deepEqual(ids({ ort: 'Bautzen', maxKm: 50 }), ['bautzen', 'sebnitz', 'dresden', 'unbekannt']);
  assert.deepEqual(ids({ ort: null, maxKm: 25 }), ['sebnitz', 'unbekannt'], 'ohne Ort gilt distanceKm von Sebnitz');
});

test('Ohne Koordinaten sichtbar: bei jeder Mitte und jedem Umkreis (Review Focus 2)', () => {
  const ohne = ev({ id: 'ohne', lat: null, lon: null, distanceKm: null });
  for (const ort of [null, 'Görlitz', 'Bautzen', 'Nirgendwo']) {
    for (const maxKm of UMKREISE) {
      assert.equal(applyFilters([ohne], prefs({ ort, maxKm }), NOW, ORTE).length, 1, `${ort} ${maxKm}`);
    }
  }
  assert.equal(applyFilters([ohne], prefs({ ort: 'Görlitz', maxKm: 10 }), NOW).length, 1, 'auch ohne Ortsverzeichnis');
});

test('Ort + Umkreis: ein gespeicherter Ort, der nicht (mehr) im Verzeichnis steht, fällt auf Sebnitz zurück', () => {
  const liste = [ev({ id: 'nah', distanceKm: 10, lat: 50.99, lon: 14.3 }), ev({ id: 'fern', distanceKm: 60, lat: 51.4, lon: 14.9 })];
  assert.deepEqual(applyFilters(liste, prefs({ ort: 'Nirgendwo', maxKm: 25 }), NOW, ORTE).map((e) => e.id), ['nah']);
  assert.deepEqual(applyFilters(liste, prefs({ ort: 'Bautzen', maxKm: 25 }), NOW).map((e) => e.id), ['nah'], 'ohne Ortsverzeichnis ebenso');
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

test('zeitfenster: "60" gibt es nicht mehr; ein unbekannter Wert (auch das frühere "bereich") gilt wie alle', () => {
  assert.deepEqual(zeitfenster(prefs({ zeit: '60' }), '2026-11-08'), { von: '2026-11-08', bis: null });
  assert.deepEqual(zeitfenster(prefs({ zeit: 'bereich' }), '2026-11-08'), { von: '2026-11-08', bis: null });
});

test('zeitfenster tage: von vor heute wird auf heute angehoben; bis null bleibt offen', () => {
  const t = (von, bis) => zeitfenster(prefs({ zeit: 'tage', von, bis }), '2026-11-23');
  assert.deepEqual(t('2026-11-28', '2026-11-29'), { von: '2026-11-28', bis: '2026-11-29' });
  assert.deepEqual(t('2026-11-20', '2026-11-25'), { von: '2026-11-23', bis: '2026-11-25' });
  assert.deepEqual(t('2026-11-28', null), { von: '2026-11-28', bis: null });
  assert.deepEqual(t(null, null), { von: '2026-11-23', bis: null });
});

test('zeitfenster tage: ein abgelaufener Zeitraum (bis vor heute) gilt als Wochenende, nie bis < von', () => {
  // Auswahl 5.–7.11., die App kommt am Montag 9.11. aus dem Hintergrund
  assert.deepEqual(zeitfenster(prefs({ zeit: 'tage', von: '2026-11-05', bis: '2026-11-07' }), '2026-11-09'), { von: '2026-11-13', bis: '2026-11-15' });
  assert.equal(zeitAbgelaufen(prefs({ zeit: 'tage', von: '2026-11-05', bis: '2026-11-07' }), '2026-11-09'), true);
  assert.equal(zeitAbgelaufen(prefs({ zeit: 'tage', von: '2026-11-05', bis: '2026-11-09' }), '2026-11-09'), false, 'bis heute läuft noch');
  assert.equal(zeitAbgelaufen(prefs({ zeit: 'tage', von: '2026-11-05', bis: null }), '2026-11-09'), false, 'offenes Ende läuft nie ab');
  assert.equal(zeitAbgelaufen(prefs({ zeit: 'wochenende' }), '2026-11-09'), false);
  // erschöpfend: jede Kombination von von/bis um heute herum, jede Zeitwahl
  const tage = Array.from({ length: 21 }, (_, i) => tagPlus('2026-11-13', i - 10));
  for (const heute of ['2026-11-09', '2026-11-13', '2026-11-14', '2026-11-15']) {
    for (const zeit of ['alle', 'heute', 'wochenende', '7', '30', 'tage', 'unbekannt']) {
      for (const von of [null, ...tage]) {
        for (const bis of [null, ...tage]) {
          const f = zeitfenster(prefs({ zeit, von, bis }), heute);
          assert.ok(f.von >= heute, `${zeit} ${von}–${bis} am ${heute}: von vor heute`);
          assert.ok(f.bis == null || f.bis >= f.von, `${zeit} ${von}–${bis} am ${heute}: bis < von`);
        }
      }
    }
  }
});

test('zusammenfassung: ein abgelaufener Zeitraum heißt Wochenende, nicht "Mo 9.11. – Sa 7.11."', () => {
  const z = zusammenfassung({ ...DEFAULT_PREFS, zeit: 'tage', von: '2026-11-05', bis: '2026-11-07' }, '2026-11-09');
  assert.equal(z, 'Wochenende · Alle Rubriken · Sebnitz 75 km');
});

test('nachRueckkehr: nur ein neuer Tag zeichnet neu; ein abgelaufener Zeitraum wird dann zurückgesetzt', () => {
  const abgelaufen = prefs({ zeit: 'tage', von: '2026-11-05', bis: '2026-11-07' });
  assert.deepEqual(nachRueckkehr(abgelaufen, '2026-11-09', '2026-11-09'), { neuZeichnen: false, zeitZuruecksetzen: false }, 'gleicher Tag');
  assert.deepEqual(nachRueckkehr(abgelaufen, '2026-11-07', '2026-11-09'), { neuZeichnen: true, zeitZuruecksetzen: true });
  assert.deepEqual(nachRueckkehr(prefs({ zeit: 'tage', von: '2026-11-05', bis: '2026-11-20' }), '2026-11-07', '2026-11-09'), { neuZeichnen: true, zeitZuruecksetzen: false });
  assert.deepEqual(nachRueckkehr(prefs({ zeit: 'tage', von: '2026-11-05', bis: null }), '2026-11-07', '2026-11-09'), { neuZeichnen: true, zeitZuruecksetzen: false });
  assert.deepEqual(nachRueckkehr(prefs({ zeit: 'heute' }), '2026-11-07', '2026-11-09'), { neuZeichnen: true, zeitZuruecksetzen: false });
  assert.deepEqual(nachRueckkehr(abgelaufen, null, '2026-11-09'), { neuZeichnen: true, zeitZuruecksetzen: true }, 'noch nie gezeichnet');
});

test('zeitZurueckgesetzt: Zeit wie im Standard, übrige Einstellungen bleiben', () => {
  const p = prefs({ zeit: 'tage', von: '2026-11-05', bis: '2026-11-07', rubriken: ['konzert'], maxKm: 25 });
  assert.deepEqual(zeitZurueckgesetzt(p), { ...p, zeit: DEFAULT_PREFS.zeit, von: DEFAULT_PREFS.von, bis: DEFAULT_PREFS.bis });
  assert.equal(zeitZurueckgesetzt(p).zeit, 'wochenende');
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
  assert.deepEqual(ids({ zeit: 'tage', von: '2026-11-18', bis: '2026-11-18' }), ['in10', 'markt-laeuft']);
  assert.deepEqual(ids({ zeit: 'alle', von: '2026-11-18', bis: '2026-11-18' }), ['heute', 'in3', 'in10', 'markt-laeuft', 'markt-spaeter'], 'von/bis wirken nur bei "tage"');
});

test('applyFilters ohneZeit: das Zeitfenster entfällt, Vergangenes bleibt weg', () => {
  const liste = [ev({ id: 'gestern', start: '2026-11-07T19:00:00+01:00' }), ev({ id: 'heute' }), ev({ id: 'spaeter', start: '2026-12-01T19:00:00+01:00' })];
  assert.deepEqual(applyFilters(liste, prefs({ zeit: 'heute' }), NOW, {}, { ohneZeit: true }).map((e) => e.id), ['heute', 'spaeter']);
});

const NOV23 = '2026-11-23T10:00:00Z'; // Montag

test('Mehrtägiger Termin zählt an jedem Tag, an dem er läuft, auch über Neujahr hinweg (Review Focus 3)', () => {
  const markt = ev({ id: 'markt', rubrik: 'markt', art: 'markt', start: '2026-11-24T00:00:00+01:00', end: '2026-12-23T00:00:00+01:00', hasTime: false });
  const zaehl = (von, bis) => zaehleRubriken([markt], prefs({ zeit: 'tage', von, bis }), NOV23, {}).markt;
  assert.equal(zaehl('2026-12-31', '2027-01-02'), 0);
  assert.equal(zaehl('2026-12-20', '2026-12-20'), 1);
  assert.equal(zaehl('2026-11-24', '2026-11-24'), 1, 'erster Tag');
  assert.equal(zaehl('2026-12-23', '2026-12-23'), 1, 'letzter Tag');
  const silvester = ev({ id: 'silvester', rubrik: 'party', art: 'party', start: '2026-12-31T20:00:00+01:00', end: '2027-01-01T03:00:00+01:00' });
  const s = (von) => applyFilters([silvester], prefs({ zeit: 'tage', von, bis: von }), NOV23).length;
  assert.equal(s('2026-12-31'), 1);
  assert.equal(s('2027-01-01'), 1, 'läuft noch am Neujahrstag');
  assert.equal(s('2027-01-02'), 0);
});

test('loadPrefs: Ort und Daten werden geprüft; Zeitraum, von, bis und Suche werden nie geladen', () => {
  const lade = (obj) => loadPrefs(fakeStorage({ 'eventkalender.prefs': JSON.stringify(obj) }));
  assert.deepEqual(lade({ ort: 42, zeit: 'immer', von: 'gestern', suche: 'x' }), DEFAULT_PREFS);
  const gut = lade({ ort: 'Bautzen', zeit: '7', von: '2026-11-28', bis: '2026-11-29' });
  assert.deepEqual([gut.ort, gut.zeit, gut.von, gut.bis], ['Bautzen', 'wochenende', null, null]);
});

// --- Einstellungen (Review Focus 4) ---

test('Einstellungen: savePrefs schreibt weder zeit, von, bis noch suche', () => {
  const daten = {};
  const speicher = { getItem: (k) => daten[k] ?? null, setItem: (k, v) => { daten[k] = v; } };
  savePrefs(speicher, prefs({ zeit: 'tage', von: '2026-11-28', bis: '2026-11-29', suche: 'jazz', rubriken: ['konzert'], advent: true }));
  const roh = JSON.parse(daten['eventkalender.prefs']);
  for (const feld of ['zeit', 'von', 'bis', 'suche']) assert.equal(Object.hasOwn(roh, feld), false, feld);
  assert.deepEqual([roh.rubriken, roh.advent], [['konzert'], true]);
});

test('Einstellungen: alte Felder, alter Zeitraum und Umkreis rasten ein; kaputtes JSON und fehlender Speicher geben den Standard', () => {
  const lade = (text) => loadPrefs(fakeStorage({ 'eventkalender.prefs': text }));
  const alt = lade('{"hiddenArt":["markt"],"zeit":"60","maxKm":5}');
  assert.deepEqual(alt, { ...DEFAULT_PREFS, maxKm: 10 });
  assert.deepEqual([alt.rubriken, alt.zeit, alt.maxKm, Object.hasOwn(alt, 'hiddenArt')], [[], 'wochenende', 10, false]);
  const km = (maxKm) => lade(JSON.stringify({ maxKm })).maxKm;
  assert.equal(km(30), 50);
  assert.equal(km(200), 75);
  assert.equal(km(10), 10);
  assert.equal(km(25), 25);
  assert.equal(km(26), 50);
  assert.equal(km(0), 75);
  assert.equal(km(-5), 75);
  assert.equal(km('viel'), 75);
  assert.deepEqual(lade('{kaputt'), DEFAULT_PREFS);
  assert.deepEqual(lade('null'), DEFAULT_PREFS);
  assert.deepEqual(lade('[1,2]'), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs(null), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs({ getItem() { throw new Error('gesperrt'); } }), DEFAULT_PREFS);
  assert.deepEqual(lade('{"rubriken":["konzert","gibtsnicht"]}').rubriken, ['konzert']);
  assert.deepEqual(lade('{"rubriken":"konzert"}').rubriken, []);
  assert.deepEqual(lade(JSON.stringify({ rubriken: ALLE_KEYS })).rubriken, [], 'alle 14 heißt alle');
  assert.equal(lade('{"advent":true}').advent, undefined, 'den Advent-Schalter gibt es nicht mehr');
});

// --- Rubriken und Unterfilter ---

test('rubrikWaehlen: antippen schaltet die Rubrik um; leer heißt alle; alle 14 gewählt heißt wieder alle', () => {
  assert.deepEqual(rubrikWaehlen([], 'konzert'), ['konzert']);
  assert.deepEqual(rubrikWaehlen(['konzert'], 'markt'), ['konzert', 'markt']);
  assert.deepEqual(rubrikWaehlen(['konzert'], 'konzert'), []);
  assert.deepEqual(rubrikWaehlen(ALLE_KEYS.slice(0, 13), ALLE_KEYS[13]), []);
  assert.deepEqual(rubrikWaehlen(['konzert'], 'gibtsnicht'), ['konzert'], 'Unbekanntes ändert nichts');
  const vorher = ['konzert'];
  rubrikWaehlen(vorher, 'markt');
  assert.deepEqual(vorher, ['konzert'], 'die Eingabe bleibt unverändert');
});

test('sortenSchluessel: alle Unterarten einer Rubrik in Knopfreihenfolge, am Ende die sonstigen; ohne Unterarten leer', () => {
  assert.deepEqual(sortenSchluessel('markt'), ['weihnachtsmarkt', 'troedel', 'handwerk', 'bauern', 'sonstige-markt']);
  assert.equal(sortenSchluessel('konzert').length, 8);
  assert.deepEqual(sortenSchluessel('theater'), ['schauspiel', 'lesung', 'kabarett', 'kino', 'show', 'sonstige-theater']);
  assert.deepEqual(sortenSchluessel('sport'), []);
  assert.deepEqual(sortenSchluessel('sonstiges'), []);
  assert.deepEqual(sortenSchluessel('gibtsnicht'), []);
  assert.deepEqual(sortenSchluessel('constructor'), []);
});

test('gewaehlteSorten: null heißt "Alle"; sonst die nicht ausgeblendeten Unterarten der Rubrik', () => {
  assert.equal(gewaehlteSorten([], 'markt'), null);
  assert.equal(gewaehlteSorten(undefined, 'markt'), null);
  assert.equal(gewaehlteSorten(['jazz'], 'markt'), null, 'fremde Schlüssel zählen nicht');
  assert.deepEqual(gewaehlteSorten(['troedel', 'handwerk', 'bauern', 'sonstige-markt'], 'markt'), ['weihnachtsmarkt']);
  assert.equal(gewaehlteSorten(['jazz'], 'sport'), null, 'Rubrik ohne Unterarten');
});

test('sorteWaehlen: aus "Alle" wird genau die getippte Unterart; weitere kommen dazu oder gehen wieder', () => {
  const nur = (rubrik, hidden) => gewaehlteSorten(hidden, rubrik);
  let h = sorteWaehlen([], 'konzert', 'jazz');
  assert.deepEqual(nur('konzert', h), ['jazz']);
  assert.equal(h.length, 7);
  h = sorteWaehlen(h, 'konzert', 'klassik');
  assert.deepEqual(nur('konzert', h), ['klassik', 'jazz'], 'Reihenfolge wie die Knöpfe');
  h = sorteWaehlen(h, 'konzert', 'jazz');
  assert.deepEqual(nur('konzert', h), ['klassik']);
  assert.deepEqual(sorteWaehlen(h, 'konzert', 'klassik'), [], 'die letzte abgewählt heißt wieder Alle');
  assert.deepEqual(sorteWaehlen(h, 'konzert', null), [], 'null heißt Alle');
});

test('sorteWaehlen: alle einzeln gewählt heißt Alle; andere Rubriken bleiben; Unbekanntes ändert nichts', () => {
  let h = ['jazz'];
  for (const k of ['weihnachtsmarkt', 'troedel', 'handwerk', 'bauern']) h = sorteWaehlen(h, 'markt', k);
  assert.deepEqual(gewaehlteSorten(h, 'markt'), ['weihnachtsmarkt', 'troedel', 'handwerk', 'bauern']);
  assert.ok(h.includes('jazz'));
  h = sorteWaehlen(h, 'markt', 'sonstige-markt');
  assert.deepEqual(h, ['jazz'], 'alle fünf gewählt: nichts mehr ausgeblendet');
  assert.deepEqual(sorteWaehlen(['jazz'], 'markt', null), ['jazz']);
  assert.deepEqual(sorteWaehlen(['troedel'], 'markt', 'jazz'), ['troedel'], 'Schlüssel einer anderen Rubrik');
  assert.deepEqual(sorteWaehlen(['troedel'], 'sport', 'troedel'), ['troedel'], 'Rubrik ohne Unterarten');
  const vorher = ['troedel'];
  sorteWaehlen(vorher, 'markt', 'bauern');
  assert.deepEqual(vorher, ['troedel'], 'die Eingabe bleibt unverändert');
});

test('rubrikGetippt: wählt oder entfernt die Rubrik; ihre Unterarten beginnen wieder bei Alle, die der übrigen bleiben', () => {
  const nurJazz = sorteWaehlen([], 'konzert', 'jazz');
  const p = { rubriken: ['konzert'], hiddenGenres: [...nurJazz, 'tiere'] };
  const dazu = rubrikGetippt(p, 'markt');
  assert.deepEqual(dazu.rubriken, ['konzert', 'markt']);
  assert.deepEqual(dazu.hiddenGenres, nurJazz, 'Jazz bleibt; der Rest einer nicht gewählten Rubrik (tiere) fällt weg');
  const weg = rubrikGetippt(p, 'konzert');
  assert.deepEqual(weg, { rubriken: [], hiddenGenres: [] });
  const alt = rubrikGetippt({ rubriken: [], hiddenGenres: ['jazz'] }, 'konzert');
  assert.deepEqual(alt, { rubriken: ['konzert'], hiddenGenres: [] }, 'eine neu gewählte Rubrik beginnt bei Alle');
  assert.deepEqual(rubrikGetippt({ rubriken: ['markt'] }, 'gibtsnicht'), { rubriken: ['markt'], hiddenGenres: [] });
  assert.deepEqual(p.rubriken, ['konzert'], 'die Eingabe bleibt unverändert');
});

test('Unterfilter wirken je gewählter Rubrik: Kinderführungen lassen sich auch neben Konzerten ausblenden', () => {
  const liste = [
    ev({ id: 'kinderfuehrung', rubrik: 'fuehrung', art: 'sonstiges', genre: 'kinder' }),
    ev({ id: 'stadtfuehrung', rubrik: 'fuehrung', art: 'sonstiges', genre: 'stadt' }),
    ev({ id: 'konzert', rubrik: 'konzert', genre: 'jazz' }),
    ev({ id: 'kindertag', rubrik: 'kinder', art: 'sonstiges' }),
  ];
  const ids = (rubriken) => applyFilters(liste, prefs({ rubriken, hiddenGenres: ['kinder'] }), NOW).map((e) => e.id);
  assert.deepEqual(ids(['fuehrung']), ['stadtfuehrung']);
  assert.deepEqual(ids(['fuehrung', 'konzert']), ['stadtfuehrung', 'konzert']);
  assert.deepEqual(ids(['fuehrung', 'kinder']), ['stadtfuehrung', 'kindertag'], 'die Rubrik Kinder ist nicht die Unterart kinder');
  assert.deepEqual(ids([]), ['kinderfuehrung', 'stadtfuehrung', 'konzert', 'kindertag'], 'ohne Rubrikwahl wirkt kein Unterfilter');
});

test('Genre: bei Konzert allein verschwinden ausgeblendete Genres; Konzerte ohne Genre zählen als "sonstige"', () => {
  const liste = [
    ev({ id: 'rock', genre: 'rock-pop' }),
    ev({ id: 'jazz', genre: 'jazz' }),
    ev({ id: 'ohne', genre: null }),
    ev({ id: 'alt', genre: undefined }),
    ev({ id: 'markt', art: 'markt', genre: null }),
  ];
  const ids = (hiddenGenres) => applyFilters(liste, prefs({ hiddenGenres, rubriken: ['konzert'] }), NOW).map((e) => e.id);
  assert.deepEqual(ids([]), ['rock', 'jazz', 'ohne', 'alt']);
  assert.deepEqual(ids(['jazz', 'hiphop-elektro']), ['rock', 'ohne', 'alt']);
  assert.deepEqual(ids(['sonstige']), ['rock', 'jazz']);
});

test('Sorte: bei Markt allein oder Schau allein lassen sich Sorten ausblenden; ohne bekannte Sorte gilt "sonstige-markt" bzw. "sonstige-schau"', () => {
  const markt = [
    ev({ id: 'weih', art: 'markt', genre: 'weihnachtsmarkt' }),
    ev({ id: 'trodel', art: 'markt', genre: 'troedel' }),
    ev({ id: 'm-ohne', art: 'markt', genre: null }),
    ev({ id: 'm-falsch', art: 'markt', genre: 'jazz' }),
  ];
  const mids = (hiddenGenres) => applyFilters(markt, prefs({ hiddenGenres, rubriken: ['markt'] }), NOW).map((e) => e.id);
  assert.deepEqual(mids(['weihnachtsmarkt']), ['trodel', 'm-ohne', 'm-falsch']);
  assert.deepEqual(mids(['sonstige-markt']), ['weih', 'trodel']);
  assert.deepEqual(mids(['sonstige']), ['weih', 'trodel', 'm-ohne', 'm-falsch'], 'Konzert-Schlüssel trifft keine Märkte');
  const schau = [ev({ id: 'tiere', art: 'schau', genre: 'tiere' }), ev({ id: 'kunst', art: 'schau', genre: 'kunst' }), ev({ id: 's-ohne', art: 'schau', genre: null })];
  const sids = (hiddenGenres) => applyFilters(schau, prefs({ hiddenGenres, rubriken: ['schau'] }), NOW).map((e) => e.id);
  // Alte Daten: kunst gehört seit den Rubriken zu "ausstellung"; ein alter Schau-Termin damit zählt als "sonstige Schau" und bleibt sichtbar, solange die nicht ausgeblendet ist.
  assert.deepEqual(sids(['tiere']), ['kunst', 's-ohne']);
  assert.deepEqual(sids(['tiere', 'sonstige-schau']), []);
});

test('Unterfilter wirken bei jeder gewählten Rubrik für sich; ohne Rubrikwahl wird alles gezeigt', () => {
  const liste = [
    ev({ id: 'jazz', genre: 'jazz' }),
    ev({ id: 'rock', genre: 'rock-pop' }),
    ev({ id: 'weih', art: 'markt', genre: 'weihnachtsmarkt' }),
    ev({ id: 'tiere', art: 'schau', genre: 'tiere' }),
  ];
  const hidden = ['jazz', 'weihnachtsmarkt', 'tiere'];
  const ids = (rubriken) => applyFilters(liste, prefs({ hiddenGenres: hidden, rubriken }), NOW).map((e) => e.id);
  assert.deepEqual(ids([]), ['jazz', 'rock', 'weih', 'tiere'], 'alle Rubriken');
  assert.deepEqual(ids(['konzert', 'markt']), ['rock'], 'zwei Rubriken: Jazz und Weihnachtsmarkt sind aus');
  assert.deepEqual(ids(['konzert', 'schau']), ['rock']);
  assert.deepEqual(ids(['konzert']), ['rock'], 'Konzert allein: Jazz ist aus');
  assert.deepEqual(ids(['markt']), [], 'Markt allein: Weihnachtsmarkt ist aus');
});

test('applyFilters ohneRubrik: Rubrik und Unterfilter entfallen', () => {
  const liste = [ev({ id: 'jazz', genre: 'jazz' }), ev({ id: 'markt', art: 'markt' })];
  const p = prefs({ rubriken: ['konzert'], hiddenGenres: ['jazz'] });
  assert.deepEqual(applyFilters(liste, p, NOW).map((e) => e.id), []);
  assert.deepEqual(applyFilters(liste, p, NOW, {}, { ohneRubrik: true }).map((e) => e.id), ['jazz', 'markt']);
});

test('wirksameSorten: nur die Schlüssel der gewählten Rubriken zählen', () => {
  const p = (rubriken, hiddenGenres) => prefs({ rubriken, hiddenGenres });
  assert.deepEqual(wirksameSorten(p(['konzert'], ['jazz', 'troedel', 'sonstige'])), ['jazz', 'sonstige']);
  assert.deepEqual(wirksameSorten(p(['markt'], ['jazz', 'troedel'])), ['troedel']);
  assert.deepEqual(wirksameSorten(p(['fuehrung'], ['kinder', 'jazz'])), ['kinder']);
  assert.deepEqual(wirksameSorten(p([], ['jazz'])), []);
  assert.deepEqual(wirksameSorten(p(['konzert', 'markt'], ['jazz', 'tiere', 'troedel'])), ['jazz', 'troedel']);
  assert.deepEqual(wirksameSorten(p(['theater'], ['jazz'])), [], 'Rubrik ohne Unterarten');
});

test('loadPrefs: hiddenGenres wird als Textliste geprüft, ältere Einstellungen haben keine', () => {
  const lade = (obj) => loadPrefs(fakeStorage({ 'eventkalender.prefs': JSON.stringify(obj) }));
  assert.deepEqual(lade({ maxKm: 30 }).hiddenGenres, []);
  assert.deepEqual(lade({ hiddenGenres: ['jazz', 3, 'comedy'] }).hiddenGenres, ['jazz', 'comedy']);
  assert.deepEqual(lade({ hiddenGenres: 'jazz' }).hiddenGenres, []);
});

// --- Advent ---

test('Advent ist kein Filter mehr: ein altes prefs.advent wird übergangen und nicht mehr geladen', () => {
  const liste = [ev({ id: 'adv', rubrik: 'markt', art: 'markt', advent: true }), ev({ id: 'normal', advent: false }), ev({ id: 'ohne-feld' })];
  assert.deepEqual(applyFilters(liste, prefs({ advent: true }), NOW).map((e) => e.id), ['adv', 'normal', 'ohne-feld']);
  assert.equal(Object.hasOwn(DEFAULT_PREFS, 'advent'), false);
  const alt = loadPrefs(fakeStorage({ 'eventkalender.prefs': JSON.stringify({ advent: true, maxKm: 50 }) }));
  assert.equal(Object.hasOwn(alt, 'advent'), false);
  assert.equal(alt.maxKm, 50);
  assert.equal(filterModul.zaehleAdvent, undefined);
});

// --- Zähler ---

test('zaehleRubriken: alle 14 Schlüssel; gezählt im gewählten Zeitraum, Umkreis und Tschechien, ohne die Rubrikwahl', () => {
  const tag = (t) => `${t}T19:00:00+01:00`;
  const liste = [
    ev({ id: 'k', rubrik: 'konzert', start: tag('2026-11-28') }),
    ev({ id: 'm', rubrik: 'markt', art: 'markt', start: tag('2026-11-28'), advent: true }),
    ev({ id: 'k-sonntag', rubrik: 'konzert', start: tag('2026-11-29') }),
    ev({ id: 'f-fern', rubrik: 'fuehrung', art: 'sonstiges', start: tag('2026-11-28'), distanceKm: 60, lat: 51.4, lon: 14.9 }),
    ev({ id: 'fest-cz', rubrik: 'fest', art: 'fest', start: tag('2026-11-28'), country: 'CZ' }),
    ev({ id: 'p-alt', art: 'party', start: tag('2026-11-28') }),
    ev({ id: 'kinder-dresden', rubrik: 'kinder', art: 'sonstiges', start: tag('2026-11-28'), distanceKm: 40, lat: 51.05, lon: 13.74 }),
  ];
  const p = prefs({ zeit: 'tage', von: '2026-11-28', bis: '2026-11-28', rubriken: ['theater'], maxKm: 50, showCZ: false });
  const z = zaehleRubriken(liste, p, NOV23, ORTE);
  assert.deepEqual(Object.keys(z), ALLE_KEYS);
  assert.deepEqual(z, { ...Object.fromEntries(ALLE_KEYS.map((k) => [k, 0])), konzert: 1, markt: 1, party: 1, kinder: 1 });
  assert.equal(zaehleRubriken(liste, { ...p, showCZ: true }, NOV23, ORTE).fest, 1);
  assert.equal(zaehleRubriken(liste, { ...p, maxKm: 75 }, NOV23, ORTE).fuehrung, 1);
  assert.equal(zaehleRubriken(liste, { ...p, ort: 'Bautzen', maxKm: 25 }, NOV23, ORTE).kinder, 0, 'Dresden liegt rund 46 km von Bautzen');
  assert.equal(zaehleRubriken(liste, { ...p, bis: '2026-11-29' }, NOV23, ORTE).konzert, 2);
});

// --- Zusammenfassung ---

test('zusammenfassung: Zeit · Rubriken · Ort und Umkreis · Tschechien', () => {
  const H = '2026-11-23';
  assert.equal(zusammenfassung(DEFAULT_PREFS, H), 'Wochenende · Alle Rubriken · Sebnitz 75 km');
  assert.equal(zusammenfassung({ ...DEFAULT_PREFS, rubriken: ['konzert'], ort: 'Görlitz', maxKm: 25, advent: true }, H), 'Wochenende · Konzerte · Görlitz 25 km');
  assert.ok(zusammenfassung({ ...DEFAULT_PREFS, zeit: 'tage', von: '2026-11-28', bis: '2026-11-28' }, H).startsWith('Sa 28.11. · '));
  assert.equal(zusammenfassung({ ...DEFAULT_PREFS, zeit: 'tage', von: '2026-11-27', bis: '2026-11-29' }, H), 'Fr 27.11. – So 29.11. · Alle Rubriken · Sebnitz 75 km');
  assert.equal(zusammenfassung({ ...DEFAULT_PREFS, zeit: 'heute', rubriken: ['konzert', 'markt'], showCZ: false }, H), 'Heute · Konzerte, Märkte · Sebnitz 75 km · ohne Tschechien');
  assert.equal(zusammenfassung({ ...DEFAULT_PREFS, zeit: '7', rubriken: ['konzert', 'markt', 'fest'] }, H), '7 Tage · 3 Rubriken · Sebnitz 75 km');
  assert.ok(zusammenfassung({ ...DEFAULT_PREFS, zeit: '30' }, H).startsWith('30 Tage · '));
  assert.ok(zusammenfassung({ ...DEFAULT_PREFS, zeit: 'alle' }, H).startsWith('Alle Termine · '));
  assert.ok(zusammenfassung({ ...DEFAULT_PREFS, zeit: 'tage', von: '2026-12-31', bis: '2027-01-01' }, H).startsWith('Do 31.12. – Fr 1.1. · '));
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

test('zusammenfassung: nennt gewählte Unterarten hinter der Rubrik (bis zwei mit Namen, sonst die Anzahl)', () => {
  const H = '2026-11-23';
  const z = (rubriken, hiddenGenres) => zusammenfassung({ ...DEFAULT_PREFS, rubriken, hiddenGenres }, H);
  const nurJazz = sorteWaehlen([], 'konzert', 'jazz');
  assert.equal(z(['konzert'], nurJazz), 'Wochenende · Konzerte (Jazz & Blues) · Sebnitz 75 km');
  const zwei = sorteWaehlen(nurJazz, 'konzert', 'sonstige');
  assert.equal(z(['konzert'], zwei), 'Wochenende · Konzerte (Jazz & Blues, Sonstige Konzerte) · Sebnitz 75 km');
  const drei = sorteWaehlen(zwei, 'konzert', 'klassik');
  assert.equal(z(['konzert'], drei), 'Wochenende · Konzerte (3 Sorten) · Sebnitz 75 km');
  const mitMarkt = sorteWaehlen(nurJazz, 'markt', 'weihnachtsmarkt');
  assert.equal(z(['konzert', 'markt'], mitMarkt), 'Wochenende · Konzerte (Jazz & Blues), Märkte (Weihnachtsmarkt) · Sebnitz 75 km');
  assert.equal(z(['konzert', 'markt', 'fest'], mitMarkt), 'Wochenende · 3 Rubriken · Sebnitz 75 km');
  assert.equal(z([], nurJazz), 'Wochenende · Alle Rubriken · Sebnitz 75 km', 'ohne Rubrikwahl wirkt kein Unterfilter');
  assert.equal(z(['markt'], nurJazz), 'Wochenende · Märkte · Sebnitz 75 km', 'Unterarten einer anderen Rubrik zählen nicht');
});
