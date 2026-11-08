import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';
import { dedupe } from '../src/dedupe.js';

function ev(over) {
  return makeEvent({
    sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1',
    title: 'Töpfermarkt', start: '2026-11-14T10:00:00+01:00', placeName: 'Pulsnitz',
    ...over,
  });
}

test('gleicher Titel (normalisiert), Tag und Ort werden zu einem Termin mit beiden sources', () => {
  const a = ev({ sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1', title: 'Töpfermarkt Pulsnitz!' });
  const b = ev({ sourceName: 'B', sourceId: '9', sourceUrl: 'https://b.example/9', title: 'TÖPFERMARKT  Pulsnitz', start: '2026-11-14T09:00:00+01:00' });
  const out = dedupe([a, b]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].sources.map((s) => s.name), ['A', 'B']);
});

test('gleicher Titel und Tag, aber anderer Ort bleiben getrennt', () => {
  const a = ev({ placeName: 'Pulsnitz' });
  const b = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2', placeName: 'Kamenz' });
  assert.equal(dedupe([a, b]).length, 2);
});

test('Ortsvarianten desselben Ortes zählen als gleicher Ort', () => {
  const a = ev({ placeName: 'Neustadt in Sachsen' });
  const b = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2', placeName: 'Neustadt/Sa.' });
  assert.equal(dedupe([a, b]).length, 1);
});

test('der zusammengeführte Termin nimmt vorhandene Kontaktfelder und ausverkauft aus beliebigem Teiltermin', () => {
  const a = ev({ contact: { phone: null, url: 'https://veranstalter.example', email: null } });
  const b = ev({
    sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2',
    contact: { phone: '03595512345', url: null, email: null },
    ticketStatus: 'ausverkauft', ticketUrl: 'https://tickets.example/x',
  });
  const [m] = dedupe([a, b]);
  assert.equal(m.contact.phone, '03595512345');
  assert.equal(m.contact.url, 'https://veranstalter.example');
  assert.equal(m.ticketStatus, 'ausverkauft');
  assert.equal(m.ticketUrl, 'https://tickets.example/x');
});

test('verfuegbar überschreibt nie ausverkauft', () => {
  const a = ev({ ticketStatus: 'verfuegbar' });
  const b = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2', ticketStatus: 'ausverkauft' });
  assert.equal(dedupe([a, b])[0].ticketStatus, 'ausverkauft');
  assert.equal(dedupe([b, a])[0].ticketStatus, 'ausverkauft');
});

test('dieselbe Quelle wird nicht doppelt als source eingetragen', () => {
  const a = ev({});
  const b = ev({ sourceId: '1b' });
  const [m] = dedupe([a, b]);
  assert.equal(m.sources.length, 1);
});

test('Ergebnis ist nach Start sortiert', () => {
  const spaet = ev({ title: 'Spät', start: '2026-12-01T10:00:00+01:00' });
  const frueh = ev({ title: 'Früh', sourceId: '3', start: '2026-11-10T10:00:00+01:00' });
  assert.deepEqual(dedupe([spaet, frueh]).map((e) => e.title), ['Früh', 'Spät']);
});

test('zwei Termine derselben Quelle mit gleichem Titel und Tag an verschiedenen Spielstätten derselben Stadt bleiben getrennt', () => {
  const a = ev({ title: 'Flohmarkt', sourceId: '1', sourceUrl: 'https://a.example/1', placeName: 'Messe Dresden, Dresden' });
  const b = ev({ title: 'Flohmarkt', sourceId: '2', sourceUrl: 'https://a.example/2', placeName: 'Elbepark, Dresden' });
  const out = dedupe([a, b]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((e) => e.sources[0].url).sort(), ['https://a.example/1', 'https://a.example/2']);
});

test('derselbe Termin (gleiche Quelle, gleicher Link) zweimal geliefert wird zu einem', () => {
  const a = ev({ sourceId: '7' });
  assert.equal(dedupe([a, { ...a }]).length, 1);
});
