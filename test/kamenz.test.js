import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/kamenz.js';

const liste = readFileSync(new URL('./fixtures/kamenz-list.html', import.meta.url), 'utf8');
const LISTE_URL = 'https://www.kamenz.de/veranstaltungskalender.html';
const config = {
  enabled: true,
  url: LISTE_URL,
  contact: { phone: '035783790', url: LISTE_URL, email: null },
};
const fakeHttp = (body = liste) => ({ get: async (url) => ({ status: 200, body, url }) });

test('Quellenname ist kamenz', () => {
  assert.equal(name, 'kamenz');
});

test('kamenz: Events aus der Fixture mit title, start, Ort und absolutem Quellenlink', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: '2026-11-08', config });
  assert.equal(events.length, 6);
  const hiphop = events.find((e) => e.title.includes('Hip Hop History'));
  assert.equal(hiphop.start, '2026-11-13T19:30:00+01:00');
  assert.equal(hiphop.hasTime, true);
  assert.equal(hiphop.placeName, 'Stadttheater Kamenz, Kamenz');
  assert.equal(hiphop.sources[0].name, 'Stadt Kamenz');
  assert.match(hiphop.sources[0].url, /^https:\/\/www\.kamenz\.de\/veranstaltung_kamenz_ausfuehrlich\/.+\.html$/);
  assert.deepEqual(hiphop.contact, config.contact);
});

test('kamenz: Reservix-Link wird ticketUrl, ticketStatus bleibt null', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: '2026-11-08', config });
  const hiphop = events.find((e) => e.title.includes('Hip Hop History'));
  assert.equal(hiphop.ticketUrl, 'https://stadtkamenz.reservix.de/p/reservix/event/2610835');
  assert.equal(hiphop.ticketStatus, null);
  for (const e of events) assert.equal(e.ticketStatus, null);
  assert.ok(events.some((e) => e.ticketUrl === null));
});

test('kamenz: mehrtägiger Termin bekommt ein Ende', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: '2026-11-08', config });
  const ausstellung = events.find((e) => e.start.startsWith('2026-04-15'));
  assert.equal(ausstellung.start, '2026-04-15T08:00:00+02:00');
  assert.equal(ausstellung.end, '2026-11-15T08:00:00+01:00');
  const einzel = events.find((e) => e.title.includes('Hip Hop History'));
  assert.equal(einzel.end, null);
});

test('kamenz: die Beschreibung enthält keinen Weiterlesen-Hinweis', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: '2026-11-08', config });
  for (const e of events) assert.ok(!/Weiterlesen/.test(e.description ?? ''));
});

test('kamenz: eine Seite ohne Termine ergibt eine leere Liste', async () => {
  const events = await fetchEvents({ http: fakeHttp('<html><body>nichts</body></html>'), today: '2026-11-08', config });
  assert.deepEqual(events, []);
});
