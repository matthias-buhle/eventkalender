import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/bischofswerda.js';

const feed = readFileSync(new URL('./fixtures/bischofswerda.xml', import.meta.url), 'utf8');
const URL_FEED = 'https://www.bischofswerda.de/veranstaltungen/rss';
const config = { enabled: true, url: URL_FEED };
const fakeHttp = (body = feed) => {
  const urls = [];
  return { urls, get: async (url) => { urls.push(url); return { status: 200, body, url }; } };
};

const holen = async (titelStart, body) =>
  (await fetchEvents({ http: fakeHttp(body), today: '2026-11-08', config })).find((e) => e.title.startsWith(titelStart));

test('Quellenname ist bischofswerda', () => {
  assert.equal(name, 'bischofswerda');
});

test('bischofswerda: jeder Termin hat Titel, Start, Ort und sources[0].url', async () => {
  const http = fakeHttp();
  const events = await fetchEvents({ http, today: '2026-11-08', config });
  assert.deepEqual(http.urls, [URL_FEED]);
  assert.equal(events.length, 5);
  for (const e of events) {
    assert.ok(e.title);
    assert.match(e.start, /^2026-11-\d\dT\d\d:\d\d:00\+01:00$/);
    assert.equal(e.placeName, 'Bischofswerda');
    assert.match(e.sources[0].url, /^https:\/\/www\.bischofswerda\.de\/veranstaltungen\/veranstaltung\//);
    assert.equal(e.sources[0].name, 'Stadt Bischofswerda');
  }
});

test('bischofswerda: Eintrag mit AUSVERKAUFT hat ticketStatus ausverkauft und bereinigten Titel', async () => {
  const e = await holen('Auftakt');
  assert.equal(e.ticketStatus, 'ausverkauft');
  assert.equal(e.title, 'Auftakt - Ein märchenhafter Abend mit dem BKC (P18+)');
});

test('bischofswerda: Eintrag ohne Hinweis hat ticketStatus null (nie verfuegbar)', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: '2026-11-08', config });
  for (const e of events.filter((x) => !x.title.startsWith('Auftakt'))) assert.equal(e.ticketStatus, null);
});

test('bischofswerda: Ende und Beschreibung ohne Startzeile', async () => {
  const e = await holen('"Eselsohren');
  assert.equal(e.start, '2026-11-12T15:00:00+01:00');
  assert.equal(e.end, '2026-11-12T17:00:00+01:00');
  assert.ok(!e.description.startsWith('Start:'));
  assert.match(e.description, /^Bastelworkshop für Buchkunst/);
  const ohneEnde = await holen('„Menschenschicksale');
  assert.equal(ohneEnde.end, null);
});

test('bischofswerda: mehrtägiger Termin hat Ende am Folgetag', async () => {
  const e = await holen('Biografiearbeit');
  assert.equal(e.start, '2026-11-13T17:00:00+01:00');
  assert.equal(e.end, '2026-11-14T15:00:00+01:00');
});

test('bischofswerda: Telefon und E-Mail aus dem Text, sonst die Seite der Stadt als Kontakt', async () => {
  const bib = await holen('"Eselsohren');
  assert.equal(bib.contact.phone, '03594786160');
  assert.equal(bib.contact.email, 'stadtbibliothek@bischofswerda.de');
  const wandern = await holen('Kurzwanderung');
  assert.equal(wandern.contact.phone, '01624889742');
  const ohne = await holen('„Menschenschicksale');
  assert.equal(ohne.contact.phone, null);
  assert.equal(ohne.contact.url, ohne.sources[0].url);
});

test('bischofswerda: leerer Feed ergibt eine leere Liste', async () => {
  const leer = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>';
  assert.deepEqual(await fetchEvents({ http: fakeHttp(leer), today: '2026-11-08', config }), []);
});
