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

test('beim Zusammenführen bleibt ein bekanntes Genre erhalten', () => {
  const [e] = dedupe([ev({ genre: null }), ev({ sourceName: 'B', sourceUrl: 'https://b.example/1', genre: 'comedy' })]);
  assert.equal(e.genre, 'comedy');
});

test('dedupe behält die Lizenz, wenn nur einer der beiden Einträge eine hat', () => {
  const lizenz = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de', urheber: 'Ottendorfer Hütte GmbH' };
  const ohne = ev({ sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1' });
  const mit = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2', lizenz });
  for (const eingabe of [[ohne, mit], [mit, ohne]]) {
    const out = dedupe(eingabe);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].lizenz, lizenz);
  }
});

test('Regionskoordinaten (ortRegionKm) weichen beim Zusammenführen den genauen Koordinaten des anderen Eintrags', () => {
  const region = ev({ sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1', lat: 51.18, lon: 14.43, distanceKm: 30, ortRegionKm: 30, country: 'DE' });
  const genau = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2', lat: 51.2, lon: 14.4, distanceKm: 31.5, ortRegionKm: null, country: 'DE' });
  for (const eingabe of [[region, genau], [genau, region]]) {
    const [e] = dedupe(eingabe);
    assert.equal(e.lat, 51.2);
    assert.equal(e.lon, 14.4);
    assert.equal(e.distanceKm, 31.5);
    assert.equal(e.ortRegionKm, null);
  }
});

test('Regionskoordinaten bleiben, wenn der andere Eintrag keine Koordinaten oder ebenfalls nur die Region hat', () => {
  const region = ev({ sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1', lat: 51.18, lon: 14.43, distanceKm: 30, ortRegionKm: 30 });
  const ohne = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2' });
  const [e1] = dedupe([region, ohne]);
  assert.deepEqual([e1.lat, e1.ortRegionKm], [51.18, 30]);
  const region2 = ev({ sourceName: 'C', sourceId: '3', sourceUrl: 'https://c.example/3', lat: 51.19, lon: 14.44, distanceKm: 31, ortRegionKm: 15 });
  const [e2] = dedupe([region, region2]);
  assert.deepEqual([e2.lat, e2.ortRegionKm], [51.18, 30]);
});

test('hat nur der zweite Eintrag Koordinaten, kommt sein Regionsradius mit', () => {
  const ohne = ev({ sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1' });
  const region = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2', lat: 51.18, lon: 14.43, distanceKm: 30, ortRegionKm: 30 });
  const [e] = dedupe([ohne, region]);
  assert.deepEqual([e.lat, e.lon, e.distanceKm, e.ortRegionKm], [51.18, 14.43, 30, 30]);
});

test('genreQuelle: der erste vorhandene Hinweis gewinnt; ohne das Feld bleibt es weg', () => {
  const a = { ...ev({ sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1' }), genreQuelle: null };
  const b = { ...ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2' }), genreQuelle: 'jazz' };
  assert.equal(dedupe([a, b])[0].genreQuelle, 'jazz');
  const c = ev({ sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1' });
  const d = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2' });
  assert.equal(Object.hasOwn(dedupe([c, d])[0], 'genreQuelle'), false);
});

test('terminlisteVoll bleibt beim Zusammenführen erhalten, egal von welcher Seite', () => {
  const a = ev({ sourceName: 'A', sourceId: '1' });
  const b = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2', terminlisteVoll: true });
  assert.equal(dedupe([a, b])[0].terminlisteVoll, true);
  assert.equal(dedupe([b, a])[0].terminlisteVoll, true);
  assert.equal(dedupe([a, ev({ sourceName: 'B', sourceId: '3', sourceUrl: 'https://b.example/3' })])[0].terminlisteVoll, false);
});

const sky = (over) => ev({ sourceName: 'A', sourceId: 's1', sourceUrl: 'https://a.example/s1', start: '2026-11-29T15:00:00+01:00', title: 'Sky du Mont liest vergnügliche Weihnachtsgeschichten', placeName: 'Jagdschloss Graupa, Pirna', ...over });
const sky2 = (over) => sky({ sourceName: 'B', sourceId: 's2', sourceUrl: 'https://b.example/s2', title: 'Lesung - vergnügliche Weihnachtsgeschichten mit Sky du Mont', placeName: 'Richard-Wagner-Stätten Graupa, Jagdschloss, Pirna', start: '2026-11-29T00:00:00+01:00', hasTime: false, ...over });

test('ähnliche Titel und verschieden geschriebener Ort aus zwei Quellen, einmal ohne Uhrzeit, werden zusammengeführt', () => {
  const out = dedupe([sky2(), sky()]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].sources.map((s) => s.name).sort(), ['A', 'B']);
  assert.equal(out[0].start, '2026-11-29T15:00:00+01:00');
  assert.equal(out[0].hasTime, true);
});

test('ein unscharfer Ort ("Pirna") passt zum genauen Ort derselben Stadt', () => {
  assert.equal(dedupe([sky(), sky2({ placeName: 'Pirna' })]).length, 1);
});

test('ähnliche Titel, aber verschiedene Uhrzeiten (beide bekannt) bleiben getrennt', () => {
  assert.equal(dedupe([sky(), sky2({ start: '2026-11-29T19:30:00+01:00', hasTime: true })]).length, 2);
});

test('ähnliche Titel am selben Tag, aber an verschiedenen Orten bleiben getrennt', () => {
  assert.equal(dedupe([sky(), sky2({ placeName: 'Kulturpalast, Dresden' })]).length, 2);
});

test('Einträge derselben Quelle werden nicht über ähnliche Titel zusammengeführt', () => {
  assert.equal(dedupe([sky(), sky2({ sourceName: 'A', sourceId: 's3', sourceUrl: 'https://a.example/s3' })]).length, 2);
});

test('Titel mit nur einem gemeinsamen Wort bleiben getrennt', () => {
  assert.equal(dedupe([sky(), sky2({ title: 'Weihnachtsgeschichten für Kinder' })]).length, 2);
});
