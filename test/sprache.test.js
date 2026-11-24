import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spracheVon } from '../src/sprache.js';

test('Titel nennt Polnisch: pl, auch in Deutschland', () => {
  assert.equal(spracheVon({ title: 'Rathausturm - Zwiedzanie Wieży Ratuszowej po polsku', country: 'DE' }), 'pl');
  assert.equal(spracheVon({ title: 'Stadtführung in polnischer Sprache' }), 'pl');
});

test('Termine aus Tschechien sind tschechisch, auch ohne Hinweis im Titel', () => {
  assert.equal(spracheVon({ title: 'Kabarett „Der nackte Shakespeare 2“', country: 'CZ' }), 'cs');
  assert.equal(spracheVon({ title: 'Divadlo: Lakomec', country: 'CZ' }), 'cs');
});

test('Titel nennt Tschechisch: cs, auch in Deutschland', () => {
  assert.equal(spracheVon({ title: 'Führung auf Tschechisch', country: 'DE' }), 'cs');
  assert.equal(spracheVon({ title: 'Prohlídka česky' }), 'cs');
});

test('Titel nennt Deutsch: keine Angabe, auch in Tschechien', () => {
  assert.equal(spracheVon({ title: 'Stadtführung auf Deutsch', country: 'CZ' }), null);
  assert.equal(spracheVon({ title: 'Prohlídka v němčině', country: 'CZ' }), null);
});

test('deutsche Termine ohne Sprachhinweis und fehlende Werte: null', () => {
  assert.equal(spracheVon({ title: 'Weihnachtsmarkt Sebnitz', country: 'DE' }), null);
  assert.equal(spracheVon(undefined), null);
  assert.equal(spracheVon(null), null);
  assert.equal(spracheVon({}), null);
  assert.equal(spracheVon({ title: 42, country: 'CZ' }), 'cs');
});
