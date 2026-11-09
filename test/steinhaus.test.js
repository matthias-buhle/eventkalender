import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/steinhaus.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const URL_LISTE = 'https://www.steinhaus-bautzen.de/termine';
const config = { enabled: true, url: URL_LISTE };
const http = (body) => ({ get: async (url) => { assert.equal(url, URL_LISTE); return { status: 200, body, url }; } });
const holen = (today = '2026-11-09', body = fx('steinhaus-list.html')) => fetchEvents({ http: http(body), today, config });
const finden = (events, anfang) => events.find((e) => e.title.startsWith(anfang));

test('Quellenname ist steinhaus', () => {
  assert.equal(name, 'steinhaus');
});

test('steinhaus: ein Abruf der Terminseite genügt; Zeit wird zur Berliner Zeit', async () => {
  const fk = finden(await holen(), 'Foyerkonzert');
  assert.equal(fk.start, '2026-11-10T20:00:00+01:00');
  assert.equal(fk.end, null); // endDateHidden: das Ende ist nur ein Platzhalter
  assert.equal(fk.hasTime, true);
});

test('steinhaus: Ort, Koordinaten und Quellenlink aus der Terminseite', async () => {
  const fk = finden(await holen(), 'Foyerkonzert');
  assert.equal(fk.placeName, 'Steinhaus, Bautzen');
  assert.ok(Math.abs(fk.lat - 51.18) < 0.01 && Math.abs(fk.lon - 14.43) < 0.01);
  assert.equal(fk.sources[0].name, 'Steinhaus Bautzen');
  assert.equal(fk.sources[0].url, 'https://www.steinhaus-bautzen.de/event-details/foyerkonzert-mit-dare-to-try');
  assert.equal(fk.contact.url, fk.sources[0].url);
  assert.equal(fk.country, 'DE');
});

test('steinhaus: Art aus Titel und Kurztext; Kino bleibt sonstiges', async () => {
  const events = await holen();
  assert.equal(finden(events, 'Foyerkonzert').art, 'konzert');
  assert.equal(finden(events, 'KINO').art, 'sonstiges');
  assert.equal(finden(events, 'Swingin').art, 'konzert');
});

test('steinhaus: Kurztext wird Beschreibung', async () => {
  const fk = finden(await holen(), 'Foyerkonzert');
  assert.equal(fk.description, 'Alternative-Progressive Metal / Pirna');
});

test('steinhaus: ausverkauft wird nicht aus dem Wix-Feld geschlossen (das steht dort überall auf true)', async () => {
  const events = await holen();
  assert.ok(events.every((e) => e.ticketStatus === null));
});

test('steinhaus: vergangene Termine fallen heraus', async () => {
  const events = await holen();
  assert.equal(finden(events, 'Altes Konzert'), undefined);
  assert.equal(events.length, 4);
});

test('steinhaus: Seite ohne eingebettete Termine ist ein Fehler', async () => {
  await assert.rejects(() => holen('2026-11-09', '<html><body>leer</body></html>'), /keine Termine/);
});
