import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/neustadthalle.js';

const liste = readFileSync(new URL('./fixtures/neustadthalle-list.html', import.meta.url), 'utf8');
const BASIS = 'https://www.neustadthalle.de/veranstaltungen.html';
const TODAY = '2026-11-08';
const config = {
  enabled: true, url: BASIS, horizonDays: 60,
  contact: { phone: '+493596587555', url: 'https://www.neustadthalle.de', email: null },
};
const fakeHttp = (body = liste) => {
  const urls = [];
  return { urls, get: async (url) => { urls.push(url); return { status: 200, body, url }; } };
};
const holen = (body) => fetchEvents({ http: fakeHttp(body), today: TODAY, config });

test('Quellenname ist neustadthalle', () => {
  assert.equal(name, 'neustadthalle');
});

test('neustadthalle: ruft Monat für Monat im Zeitraum ab, jeder Termin zählt einmal', async () => {
  const http = fakeHttp();
  const events = await fetchEvents({ http, today: TODAY, config });
  assert.deepEqual(http.urls, [`${BASIS}?month=202611`, `${BASIS}?month=202612`, `${BASIS}?month=202701`]);
  assert.equal(events.length, 3, 'vergangene Termine fallen weg, gleiche Termine aus mehreren Monaten zählen einmal');
});

test('neustadthalle: Titel, Start, Ende, Ort, Quellenlink und Kontakt der Halle', async () => {
  const events = await holen();
  const puppen = events.find((e) => e.title.includes('PuppenSpielSpektakel'));
  assert.equal(puppen.start, '2026-11-18T09:30:00+01:00');
  assert.equal(puppen.end, '2026-11-18T15:30:00+01:00');
  assert.equal(puppen.placeName, 'Neustadthalle, Neustadt in Sachsen');
  assert.equal(puppen.sources[0].url, 'https://www.neustadthalle.de/veranstaltungen-leser/26-puppenspielspektakel-in-der-neustadthalle.html');
  assert.equal(puppen.contact.phone, '+493596587555');
  const ohneZeit = events.find((e) => e.title.startsWith('Weihnachtszeit ist Märchenzeit'));
  assert.equal(ohneZeit.hasTime, false);
  assert.equal(ohneZeit.start, '2026-11-23T00:00:00+01:00');
});

test('neustadthalle: Ende um 00:00 Uhr liegt nach dem Start, am Folgetag', async () => {
  const bis_mitternacht = liste.replace('09:30 Uhr–15:30 Uhr', '19:30 Uhr–00:00 Uhr');
  assert.notEqual(bis_mitternacht, liste);
  const puppen = (await holen(bis_mitternacht)).find((e) => e.title.includes('PuppenSpielSpektakel'));
  assert.equal(puppen.start, '2026-11-18T19:30:00+01:00');
  assert.equal(puppen.end, '2026-11-19T00:00:00+01:00');
});

test('neustadthalle: Reservix-Link wird ticketUrl, ohne Link null; Verfügbarkeit wird nicht behauptet', async () => {
  const events = await holen();
  const bella = events.find((e) => e.title.includes('Bella Italia'));
  assert.match(bella.ticketUrl, /^https:\/\/www\.reservix\.de\/tickets-bella-italia/);
  assert.equal(events.find((e) => e.title.startsWith('Weihnachtszeit')).ticketUrl, null);
  assert.ok(events.every((e) => e.ticketStatus === null));
  assert.equal(bella.art, 'konzert');
});

test("neustadthalle: 'Ausverkauft!' erkannt", async () => {
  // Das erste Div gehört zu einem vergangenen Termin; ausverkauft wird das zweite (Bella Italia).
  let n = 0;
  const markiert = liste.replace(/<div class="ausverkauft">\s*<\/div>/g, (leer) => (++n === 2 ? '<div class="ausverkauft">Ausverkauft!</div>' : leer));
  assert.notEqual(markiert, liste);
  const events = await holen(markiert);
  const betroffen = events.filter((e) => e.ticketStatus === 'ausverkauft');
  assert.equal(betroffen.length, 1);
  assert.match(betroffen[0].title, /Bella Italia/);
  assert.ok(events.filter((e) => e.ticketStatus !== 'ausverkauft').every((e) => e.ticketStatus === null));
});

test('neustadthalle: Veranstaltung in der Kirche bekommt den Ort aus der Liste', async () => {
  const kirche = liste.replace('alle Räume der Neustadthalle - Kinder und Familie', 'St.-Jacobi-Kirche Neustadt in Sachsen');
  assert.notEqual(kirche, liste);
  const events = await holen(kirche);
  assert.ok(events.some((e) => e.placeName.includes('Jacobi-Kirche')));
});

test('neustadthalle: eine fehlende Monatsseite überspringt nur diesen Monat, fallen alle aus, ist es ein Fehler', async () => {
  let n = 0;
  const http = { get: async (url) => { if (n++ === 0) throw new Error('HTTP 404'); return { status: 200, body: liste, url }; } };
  assert.ok((await fetchEvents({ http, today: TODAY, config })).length > 0);
  const kaputt = { get: async () => { throw new Error('HTTP 500'); } };
  await assert.rejects(fetchEvents({ http: kaputt, today: TODAY, config }), /500/);
});
