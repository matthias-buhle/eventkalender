import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSchemaEvents } from '../src/schemaorg.js';

const ld = (obj) => `<script type="application/ld+json">${typeof obj === 'string' ? obj : JSON.stringify(obj)}</script>`;

test('extractSchemaEvents liest JSON-LD in @graph', () => {
  const html = `<html><head>${ld({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'Seite' },
      {
        '@type': 'MusicEvent', name: 'Konzert A', startDate: '2026-11-14T20:00:00+01:00', endDate: '2026-11-14T22:00:00+01:00',
        url: 'https://example.org/a',
        location: { '@type': 'Place', name: 'Halle', address: { '@type': 'PostalAddress', addressLocality: 'Pirna', postalCode: '01796', streetAddress: 'Markt 1' }, geo: { '@type': 'GeoCoordinates', latitude: 50.96, longitude: 13.94 } },
        offers: { '@type': 'Offer', url: 'https://tickets.example/a', availability: 'https://schema.org/SoldOut', price: '25' },
      },
    ],
  })}</head></html>`;
  const [e, ...rest] = extractSchemaEvents(html);
  assert.equal(rest.length, 0);
  assert.equal(e.name, 'Konzert A');
  assert.equal(e.startDate, '2026-11-14T20:00:00+01:00');
  assert.equal(e.endDate, '2026-11-14T22:00:00+01:00');
  assert.equal(e.url, 'https://example.org/a');
  assert.deepEqual(e.location, { name: 'Halle', locality: 'Pirna', postalCode: '01796', street: 'Markt 1', lat: 50.96, lon: 13.94 });
  assert.deepEqual(e.offers, [{ url: 'https://tickets.example/a', availability: 'https://schema.org/SoldOut', price: '25' }]);
  assert.equal(e.raw['@type'], 'MusicEvent');
});

test('extractSchemaEvents liest JSON-LD als Liste mit Typ-Liste und Ortsliste', () => {
  const html = ld([
    { '@type': ['Event', 'WebPage'], name: 'Führung', startDate: '2026-11-25T13:30:00+01:00', location: [{ '@type': 'Place', name: 'Bergwerk', address: { addressLocality: 'Berggießhübel' } }] },
    { '@type': ['Event', 'WebPage'], name: 'Führung', startDate: '2026-12-02T13:30:00+01:00' },
  ]);
  const events = extractSchemaEvents(html);
  assert.equal(events.length, 2);
  assert.equal(events[0].location.locality, 'Berggießhübel');
  assert.equal(events[1].location, null);
  assert.deepEqual(events[1].offers, []);
});

test('extractSchemaEvents liest Microdata', () => {
  const html = `<div itemscope itemtype="https://schema.org/Event">
    <time itemprop="startDate" datetime="2026-11-13T19:30:00+01:00">Freitag, 13.11.2026</time>
    <p itemprop="location" itemscope itemtype="https://schema.org/Place"><span itemprop="name">Stadttheater Kamenz</span></p>
    <h2 itemprop="name"><a href="/veranstaltung/x.html" itemprop="url">Hip Hop History</a></h2>
    <div itemprop="description"><p>Tanzabend</p><a itemprop="url" href="/mehr.html">mehr</a></div>
  </div>`;
  const [e] = extractSchemaEvents(html);
  assert.equal(e.name, 'Hip Hop History');
  assert.equal(e.startDate, '2026-11-13T19:30:00+01:00');
  assert.equal(e.url, '/veranstaltung/x.html');
  assert.equal(e.location.name, 'Stadttheater Kamenz');
  assert.match(e.description, /Tanzabend/);
  assert.match(e.raw.html, /<div itemscope/);
});

test('extractSchemaEvents ignoriert kaputtes JSON-LD ohne Ausnahme', () => {
  const html = `${ld('{ "@type": "Event", "name": "Kaputt", ')}${ld({ '@type': 'Event', name: 'Heil', startDate: '2026-11-14' })}`;
  const events = extractSchemaEvents(html);
  assert.deepEqual(events.map((e) => e.name), ['Heil']);
});

test('extractSchemaEvents liefert eine leere Liste, wenn keine Events enthalten sind', () => {
  assert.deepEqual(extractSchemaEvents('<html><body>nichts</body></html>'), []);
  assert.deepEqual(extractSchemaEvents(ld({ '@type': 'Organization', name: 'X' })), []);
  assert.deepEqual(extractSchemaEvents(''), []);
});
