import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zieheStichprobe, vergleiche, vorbereiten } from '../scripts/einsortierung-pruefen.js';

const viele = Array.from({ length: 50 }, (_, i) => ({ id: `e${i}`, title: `Termin ${i}` }));

test('zieheStichprobe: gleicher seed gleiche Termine, anderer seed andere, keine Doppelten', () => {
  const a = zieheStichprobe(viele, 10, 1);
  assert.deepEqual(zieheStichprobe(viele, 10, 1), a);
  assert.notDeepEqual(zieheStichprobe(viele, 10, 2).map((e) => e.id), a.map((e) => e.id));
  assert.equal(new Set(a.map((e) => e.id)).size, 10);
});

test('zieheStichprobe: n größer als der Bestand liefert alle', () => {
  const alle = zieheStichprobe(viele, 500, 7);
  assert.equal(alle.length, 50);
  assert.equal(new Set(alle.map((e) => e.id)).size, 50);
});

const bestand = () => [
  { id: '1', art: 'konzert', rubrik: 'konzert', genre: 'jazz', title: 'Jazzabend', placeName: 'Bautzen', sources: [{ name: 'Ticketmaster' }] },
  { id: '2', art: 'sonstiges', rubrik: 'sonstiges', genre: null, title: 'Winter Werksverkauf', placeName: 'Zittau', sources: [{ name: 'X' }] },
  { id: '3', art: 'sonstiges', rubrik: 'sonstiges', genre: null, title: 'Stadtfest Pirna', placeName: 'Pirna', sources: [{ name: 'X' }] },
  { id: '4', art: 'konzert', rubrik: 'konzert', genre: 'rock', title: 'Rock im Park', placeName: 'Görlitz', sources: [{ name: 'Ticketmaster' }] },
  { id: '5', art: 'sonstiges', rubrik: 'sonstiges', genre: null, title: 'Etwas', placeName: 'Löbau', sources: [{ name: 'X' }] },
];

test('vergleiche: zählt vorher und nachher, führt Aussortiertes mit Grund, liefert fünf Ziele', () => {
  const r = vergleiche(bestand());
  assert.equal(r.vorher['konzert'], 2);
  assert.equal(r.vorher['konzert/jazz'], 1);
  assert.equal(r.vorher['sonstiges'], 3);
  assert.equal(r.vorher['sonstiges/sonstige'], 3);
  const summeNachher = Object.entries(r.nachher).filter(([k]) => !k.includes('/')).reduce((s, [, n]) => s + n, 0);
  assert.equal(summeNachher + r.aussortiert.length, 5);
  assert.deepEqual(r.aussortiert, [{ titel: 'Winter Werksverkauf', ort: 'Zittau', grund: 'Ladenöffnung' }]);
  assert.equal(r.ziele.length, 5);
  assert.deepEqual(r.ziele.map((z) => z.name), ['sonstiges', 'konzert/kirche', 'theater/kabarett', 'aussortiert', 'konzertFremd']);
  assert.ok(r.ziele.find((z) => z.name === 'aussortiert').erreicht);
  assert.deepEqual(r.konzertFremd, []);
});

test('vergleiche: Konzert mit Kabarett im Titel wird als fremd gemeldet', () => {
  const r = vergleiche([{ id: '9', art: 'konzert', rubrik: 'konzert', genre: null, title: 'Comedy Night live', sources: [{ name: 'X' }] }]);
  if (r.nachher['konzert']) assert.deepEqual(r.konzertFremd, ['Comedy Night live']);
});

test('vorbereiten: Hinweis nur beim Ticketmaster-Konzert', () => {
  const [a, b, c] = vorbereiten([
    { art: 'konzert', rubrik: 'konzert', genre: 'jazz', sources: [{ name: 'Ticketmaster' }] },
    { art: 'konzert', rubrik: 'konzert', genre: 'jazz', sources: [{ name: 'Andere' }] },
    { art: 'markt', rubrik: 'markt', genre: 'jazz', sources: [{ name: 'Ticketmaster' }] },
  ]);
  assert.equal(a.genreQuelle, 'jazz');
  assert.equal(b.genreQuelle, null);
  assert.equal(c.genreQuelle, null);
  for (const e of [a, b, c]) { assert.equal(e.rubrik, null); assert.equal(e.genre, null); }
});
