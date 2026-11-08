import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArt, detectStatus, normalizePhone, cleanText } from '../src/normalize.js';

test('detectStatus erkennt Ausverkauft in Plus-Klammern', () => {
  assert.equal(detectStatus('+++Ausverkauft+++'), 'ausverkauft');
});
test('detectStatus erkennt tschechische Ausverkauft-Wörter', () => {
  assert.equal(detectStatus('Vyprodáno'), 'ausverkauft');
  assert.equal(detectStatus('Prodej ukončen'), 'ausverkauft');
});
test('detectStatus erkennt abgesagt und verlegt', () => {
  assert.equal(detectStatus('Konzert abgesagt'), 'abgesagt');
  assert.equal(detectStatus('Zrušeno'), 'abgesagt');
  assert.equal(detectStatus('Termin verlegt auf Mai'), 'verlegt');
});
test('detectStatus setzt nie verfuegbar und kennt Normaltext nicht', () => {
  assert.equal(detectStatus('Eintritt frei'), null);
  assert.equal(detectStatus('Karten an der Abendkasse'), null);
  assert.equal(detectStatus(''), null);
});

test('normalizeArt ordnet Quellenkategorien zu', () => {
  assert.equal(normalizeArt('Rock & Pop', 'Band X'), 'konzert');
  assert.equal(normalizeArt('Feiern & Ausgehen', '80er Party'), 'party');
});
test('normalizeArt erkennt Art am Titel', () => {
  assert.equal(normalizeArt('', 'Töpfermarkt Pulsnitz'), 'markt');
  assert.equal(normalizeArt('', 'Kreisschau Rassegeflügel'), 'schau');
  assert.equal(normalizeArt('', 'Suppenfest'), 'fest');
  assert.equal(normalizeArt('', 'Weihnachtsmarkt am 05.12.'), 'markt');
});
test('normalizeArt fällt auf sonstiges zurück', () => {
  assert.equal(normalizeArt('', 'Lesung im Rathaus'), 'sonstiges');
  assert.equal(normalizeArt(undefined, undefined), 'sonstiges');
});

test('normalizePhone bereinigt deutsche Nummern', () => {
  assert.equal(normalizePhone('035955 / 12 345'), '03595512345');
  assert.equal(normalizePhone('+49 (0) 351 123'), '+49351123');
});
test('normalizePhone findet die Nummer im Fließtext', () => {
  assert.equal(normalizePhone('Auskunft unter Tel. 035971 52 100 oder per Mail'), '03597152100');
});
test('normalizePhone lehnt Text, Datum und Uhrzeit ab', () => {
  assert.equal(normalizePhone('keine Nummer'), null);
  assert.equal(normalizePhone('am 10.11.2026 ab 19 Uhr'), null);
  assert.equal(normalizePhone('01.12.2026'), null);
  assert.equal(normalizePhone(null), null);
});

test('cleanText entfernt Tags, Skripte und Entitäten', () => {
  assert.equal(cleanText('<p>Hallo&nbsp;<b>Welt</b><script>alert(1)</script></p>'), 'Hallo Welt');
  assert.equal(cleanText('Tom &amp; Jerry &#8211; live'), 'Tom & Jerry – live');
  assert.equal(cleanText('  viel \n\n Leerraum\t'), 'viel Leerraum');
});

test('shorten kürzt an Wortgrenze mit Auslassungszeichen und lässt Kurzes unverändert', async () => {
  const { shorten } = await import('../src/normalize.js');
  assert.equal(shorten('kurz', 10), 'kurz');
  assert.equal(shorten('eins zwei drei vier', 12), 'eins zwei…');
  assert.equal(shorten('', 5), '');
  assert.equal(shorten(null, 5), '');
});
