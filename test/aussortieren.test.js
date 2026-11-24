import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRUENDE, aussortierGrund } from '../src/aussortieren.js';

const sonst = (title, description = null, art = 'sonstiges') => aussortierGrund({ art, title, description });

test('GRUENDE: Schlüssel und Namen in Protokoll-Reihenfolge', () => {
  assert.deepEqual(GRUENDE, {
    ladenoeffnung: 'Ladenöffnung',
    schulvorstellung: 'Schulvorstellung',
    gruppentreffen: 'Gruppentreffen',
  });
  assert.deepEqual(Object.keys(GRUENDE), ['ladenoeffnung', 'schulvorstellung', 'gruppentreffen']);
});

test('Ladenöffnung und Werksverkauf (echte Titel)', () => {
  for (const t of [
    'Der Domladen hat geöffnet und lädt Sie herzlich ein!',
    'Winter Werksverkauf',
    'Weihnachtsbaumverkauf zum Selbstschlagen im Revier Ottomühle',
  ]) assert.equal(sonst(t), 'ladenoeffnung', t);
});

test('Gegenbeispiele Laden', () => {
  assert.equal(sonst('Weihnachtsmarkt mit Werksverkauf', null, 'markt'), null);
  assert.equal(sonst('Hoffest mit Werksverkauf', null, 'fest'), null);
  assert.equal(sonst('Werksverkauf mit Führung durch die Manufaktur'), null);
  assert.equal(sonst('Das Museum hat geöffnet: Sonderausstellung', null, 'schau'), null);
});

test('Schulvorstellung', () => {
  assert.equal(sonst('Der kleine Prinz (Schulvorstellung)'), 'schulvorstellung');
  assert.equal(sonst('Klassenzimmerstück: Die Welle'), 'schulvorstellung');
  assert.equal(sonst('Der Zauberlehrling', 'Geschlossene Veranstaltung für Schulklassen.'), 'schulvorstellung');
  assert.equal(sonst('Geschlossene Gesellschaft'), null);
  assert.equal(sonst('Faust', ' '.repeat(400) + 'Schulvorstellung'), null);
});

test('Gruppentreffen (echte Titel)', () => {
  for (const t of ['Trauercafe Bautzen', 'Jugendtrauerkreis', 'Bibelkreis', 'Selbsthilfegruppe Diabetes', 'Seniorennachmittag', 'Chorprobe'])
    assert.equal(sonst(t), 'gruppentreffen', t);
  for (const t of [
    'Weinprobe im Schlosskeller',
    'Öffentliche Probe der Philharmonie',
    'Generalprobe: Weihnachtsoratorium',
    'Vereinstreffen der Modellbahner',
    'Trauerfeier-Musik: Requiem',
  ]) assert.equal(sonst(t), null, t);
});

test('aussortierGrund wirft nie', () => {
  assert.equal(aussortierGrund(undefined), null);
  assert.equal(aussortierGrund({ title: '' }), null);
  assert.equal(aussortierGrund({ title: null, description: null }), null);
});
