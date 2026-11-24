import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUBRIKEN, SORTEN, rubrikVon, rubrikName, rubrikKarte, rubrikFarbe, sorteFilter, sorteName, sprachHinweis } from '../site/js/arten.js';

test('rubrikVon: bekannte Rubrik gilt, sonst fällt es auf die Art zurück, Unbekanntes wird sonstiges', () => {
  assert.equal(rubrikVon({ art: 'unbekannt' }), 'sonstiges');
  assert.equal(rubrikVon({ art: 'schau', rubrik: 'quatsch' }), 'schau');
  assert.equal(rubrikVon({ art: 'schau', rubrik: 'ausstellung' }), 'ausstellung');
  assert.equal(rubrikVon({ art: 'sonstiges', rubrik: 'fuehrung' }), 'fuehrung');
  for (const art of ['konzert', 'markt', 'party', 'fest', 'schau']) assert.equal(rubrikVon({ art }), art);
  assert.equal(rubrikVon({ art: 'sonstiges' }), 'sonstiges');
  assert.equal(rubrikVon({}), 'sonstiges');
  assert.equal(rubrikVon({ art: 'konzert', rubrik: 'toString' }), 'konzert', 'Prototyp-Namen sind keine Rubrik');
  assert.equal(rubrikVon({ art: 'toString' }), 'sonstiges');
});

test('Rubrikname und Karten-Einzahl; 14 Rubriken', () => {
  assert.equal(RUBRIKEN.length, 14);
  assert.equal(RUBRIKEN.at(-2).key, 'sport');
  assert.equal(rubrikName('sport'), 'Sport & Freizeit');
  assert.equal(rubrikFarbe('sport'), 'sonstiges');
  assert.equal(rubrikName('ausstellung'), 'Ausstellungen & Museen');
  assert.equal(rubrikKarte('ausstellung'), 'Ausstellung');
  assert.equal(rubrikKarte('fuehrung'), 'Führung');
  assert.equal(rubrikName('quatsch'), 'Sonstiges');
  assert.equal(rubrikKarte('quatsch'), 'Sonstiges');
});

test('SORTEN je Rubrik, neue Sonstige-Schlüssel und Titel', () => {
  assert.deepEqual(Object.keys(SORTEN), [
    'konzert', 'party', 'markt', 'fest', 'schau', 'ausstellung', 'fuehrung', 'wandern', 'kurse', 'theater', 'essen', 'kinder',
  ]);
  assert.equal(SORTEN.wandern.sonstige, 'sonstige-wandern');
  assert.equal(SORTEN.kurse.sonstige, 'sonstige-kurse');
  assert.equal(SORTEN.theater.sonstige, 'sonstige-theater');
  assert.equal(SORTEN.essen.sonstige, 'sonstige-essen');
  assert.equal(SORTEN.kinder.sonstige, 'sonstige-kinder');
  assert.equal(SORTEN.theater.sonstigeText, 'Sonstiges Theater');
  assert.equal(SORTEN.kinder.sonstigeText, 'Sonstiges für Kinder');
  assert.equal(SORTEN.wandern.titel, 'Wandern & Natur: Sorte');
  assert.equal(SORTEN.ausstellung.sonstige, 'sonstige-ausstellung');
  assert.equal(SORTEN.fuehrung.sonstige, 'sonstige-fuehrung');
  assert.equal(SORTEN.ausstellung.titel, 'Ausstellungen: Sorte');
  assert.equal(SORTEN.fuehrung.titel, 'Führungen: Sorte');
});

test('sorteFilter/sorteName arbeiten mit der Rubrik', () => {
  assert.equal(sorteFilter({ art: 'schau', rubrik: 'ausstellung', genre: 'kunst' }), 'kunst');
  assert.equal(sorteName({ art: 'schau', rubrik: 'ausstellung', genre: 'kunst' }), 'Kunst & Foto');
  assert.equal(sorteFilter({ art: 'sonstiges', rubrik: 'fuehrung', genre: null }), 'sonstige-fuehrung');
  assert.equal(sorteFilter({ art: 'sonstiges', rubrik: 'fuehrung', genre: 'untertage' }), 'untertage');
  assert.equal(sorteFilter({ art: 'konzert', genre: 'jazz' }), 'jazz');
  assert.equal(sorteFilter({ art: 'sonstiges', rubrik: 'wandern' }), 'sonstige-wandern');
  assert.equal(sorteFilter({ art: 'sonstiges', rubrik: 'sport' }), null);
  assert.equal(sorteFilter({ art: 'sonstiges', rubrik: 'sonstiges' }), null);
  assert.equal(sorteName({ art: 'sonstiges' }), null);
});

test('alte Daten: Genre, das die Rubrik nicht (mehr) kennt, wirft nicht und zählt als "sonstige" der Rubrik', () => {
  const alt = { art: 'schau', genre: 'kunst' }; // vor den Rubriken lag kunst unter schau
  assert.equal(rubrikVon(alt), 'schau');
  assert.equal(sorteFilter(alt), 'sonstige-schau');
  assert.equal(sorteName(alt), null);
  assert.equal(sorteFilter({ art: 'markt', genre: 'jazz' }), 'sonstige-markt');
  assert.equal(sorteFilter({ art: 'konzert', genre: { x: 1 } }), 'sonstige');
  assert.equal(sorteFilter({ art: 'konzert', genre: 'constructor' }), 'sonstige');
});

test('alte Daten: Genre comedy unter Konzert zählt als Sonstige Konzerte', () => {
  const alt = { rubrik: 'konzert', art: 'konzert', genre: 'comedy' };
  assert.equal(sorteFilter(alt), 'sonstige');
  assert.equal(sorteName(alt), null);
});

test('Rubrik sport und Rückfälle bleiben', () => {
  assert.equal(rubrikVon({ rubrik: 'sport', art: 'sonstiges' }), 'sport');
  assert.equal(rubrikVon({ rubrik: 'gibtsnicht', art: 'konzert' }), 'konzert');
  assert.equal(rubrikVon({ rubrik: 'gibtsnicht', art: 'auchnicht' }), 'sonstiges');
  assert.equal(sorteFilter({ rubrik: 'theater', genre: 'gibtsnicht' }), 'sonstige-theater');
  assert.doesNotThrow(() => sorteFilter({ rubrik: 'sport', genre: 'x' }));
  assert.doesNotThrow(() => sorteFilter({ rubrik: 'sonstiges' }));
});

test('Unterfilter-Schlüssel sind über alle Rubriken eindeutig (hiddenGenres ist eine gemeinsame Liste)', () => {
  const alle = Object.values(SORTEN).flatMap((def) => [...Object.keys(def.liste), def.sonstige]);
  const doppelt = alle.filter((k, i) => alle.indexOf(k) !== i);
  assert.deepEqual(doppelt, []);
  assert.ok(alle.length > 0);
});

test('rubrikFarbe: Farbfamilie der Rubrik wie die Kachel; Unbekanntes ist sonstiges', async () => {
  const { rubrikFarbe } = await import('../site/js/arten.js');
  for (const r of RUBRIKEN) assert.equal(rubrikFarbe(r.key), r.farbe);
  assert.equal(rubrikFarbe('quatsch'), 'sonstiges');
  assert.equal(rubrikFarbe(undefined), 'sonstiges');
});

test('sprachHinweis: nur bei Theater, Kursen, Führungen und Kinderprogramm mit cs oder pl', () => {
  assert.equal(sprachHinweis({ rubrik: 'theater', sprache: 'cs' }), 'auf Tschechisch');
  assert.equal(sprachHinweis({ rubrik: 'fuehrung', sprache: 'pl' }), 'auf Polnisch');
  assert.equal(sprachHinweis({ rubrik: 'konzert', sprache: 'cs' }), null);
  assert.equal(sprachHinweis({ rubrik: 'markt', sprache: 'pl' }), null);
  assert.equal(sprachHinweis({ rubrik: 'theater' }), null);
  assert.equal(sprachHinweis({ rubrik: 'theater', sprache: 'xx' }), null);
  assert.equal(sprachHinweis(undefined), null);
});
