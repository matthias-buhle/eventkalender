import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/bluenote.js';
import { rubrikUndGenre } from '../src/rubriken.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const URL_FEED = 'https://bluenote-dresden.de/calendar.ics';
const config = { enabled: true, url: URL_FEED };
const http = (body) => ({ get: async (url) => { assert.equal(url, URL_FEED); return { status: 200, body, url }; } });
const holen = (today = '2026-11-25', body = fx('bluenote-feed.ics')) => fetchEvents({ http: http(body), today, config });
const finden = (events, anfang, tag) => events.find((e) => e.title.startsWith(anfang) && (!tag || e.start.startsWith(tag)));

const kalender = (...ereignisse) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${ereignisse.join('')}END:VCALENDAR\r\n`;
const ereignis = (...zeilen) => `BEGIN:VEVENT\r\n${zeilen.join('\r\n')}\r\nEND:VEVENT\r\n`;

test('Quellenname ist bluenote', () => {
  assert.equal(name, 'bluenote');
});

test('bluenote: das Fixture ergibt Konzerte ab heute, vergangene fallen heraus', async () => {
  const alle = await holen('2026-01-01');
  assert.equal(alle.length, 27);
  assert.ok(alle.every((e) => e.art === 'konzert' && e.country === 'DE' && e.hasTime));
  assert.equal(new Set(alle.map((e) => e.id)).size, 27);
  const events = await holen();
  assert.equal(events.length, 23);
  const tage = events.map((e) => e.start.slice(0, 10));
  assert.equal(tage[0], '2026-11-25'); // der heutige Abend zählt noch
  assert.equal(tage.at(-1), '2027-11-25'); // der Horizont ist nicht begrenzt
  assert.equal((await holen('2027-11-26')).length, 0);
});

test('bluenote: UTC wird zur Berliner Zeit, Winter- und Sommerzeit', async () => {
  const events = await holen();
  assert.equal(finden(events, 'Etienne Wittich', '2026-11-25').start, '2026-11-25T20:00:00+01:00'); // 19:00Z im Winter
  assert.equal(finden(events, 'Lotte Koenen').start, '2027-05-11T20:00:00+02:00'); // 18:00Z im Sommer
  assert.equal(finden(events, 'Christmas Among Friends').start, '2026-12-24T22:30:00+01:00'); // 21:30Z
});

test('bluenote: nur der Beginn, das Ende bleibt leer (auch wenn der Feed ein Platzhalter-Ende nennt)', async () => {
  const events = await holen();
  assert.ok(events.every((e) => e.end === null));
});

test('bluenote: Titel ohne HTML-Entitäten und iCal-Escapes', async () => {
  const events = await holen();
  assert.equal(finden(events, 'Etienne Wittich').title, 'Etienne Wittich & Paulo Morello Quartet');
  assert.equal(finden(events, 'Sinomtha Zake', '2027-01-02').title, 'Sinomtha Zake ft Salt, Pepper & the Peanuts');
  assert.equal(finden(events, 'Christmas Time Is Here').title, 'Christmas Time Is Here – Das Weihnachtskonzert mit Anne Großhäuser und Band');
  assert.equal(finden(events, 'Ramiro Olaciregui').title, 'Ramiro Olaciregui „My Standards 4tet“');
  assert.equal(finden(events, 'Carla').title, 'Carla’s Café');
  assert.ok(events.every((e) => !/&#?\w+;|\\/.test(e.title)));
});

test('bluenote: Ort, Link und Kontakt sind die Seite des Hauses und des Termins', async () => {
  const e = finden(await holen(), 'Dresden Jazz Session', '2026-11-30');
  assert.equal(e.placeName, 'Blue Note Dresden, Dresden');
  assert.equal(e.sources[0].name, 'Blue Note Dresden');
  assert.equal(e.sources[0].url, 'https://bluenote-dresden.de/konzert/2026-11-30-dresden-jazz-session-hosted-by-mathis-nicolaus/');
  assert.equal(e.contact.url, e.sources[0].url);
});

test('bluenote: keine Beschreibung und keine Bilder, auch wenn der Feed lange Texte liefert', async () => {
  const body = fx('bluenote-feed.ics');
  assert.ok(/DESCRIPTION:.{20}/.test(body), 'das Fixture enthält Beschreibungen');
  const events = await holen('2026-01-01');
  assert.ok(events.every((e) => e.description === null && e.ticketUrl === null && !('image' in e)));
  assert.ok(!JSON.stringify(events).includes('Jazzstudiums'));
});

test('bluenote: Konzerte kommen als Jazz in die Rubrik Konzerte, die Songwriter-Reihe als Rock & Pop', async () => {
  const events = await holen();
  const einordnen = (anfang, tag) => rubrikUndGenre(finden(events, anfang, tag));
  assert.deepEqual(einordnen('Dresden Jazz Session', '2026-11-30'), { rubrik: 'konzert', genre: 'jazz' });
  assert.deepEqual(einordnen('Alou String Quartet'), { rubrik: 'konzert', genre: 'jazz' }); // "Quartet" ist hier kein Klassik-Hinweis
  assert.deepEqual(einordnen('Christmas Time Is Here'), { rubrik: 'konzert', genre: 'jazz' }); // Weihnachtskonzert, aber im Jazzclub
  assert.deepEqual(einordnen('Die Zweiten'), { rubrik: 'konzert', genre: 'rock-pop' }); // "Take Note Songwriter Sessions" im Link
  assert.deepEqual(einordnen('Marcus Evans'), { rubrik: 'konzert', genre: 'rock-pop' });
  // die offene Bühne bleibt ohne Hinweis, ist aber ein Konzert
  assert.deepEqual(einordnen('30 Jahre Blue Note'), { rubrik: 'konzert', genre: null });
  assert.ok(events.every((e) => rubrikUndGenre(e).rubrik === 'konzert'));
});

test('bluenote: gleiche Titel an Folgetagen sind getrennte Termine mit eigenem Link', async () => {
  const events = (await holen()).filter((e) => e.title.startsWith('Eugenia Serra'));
  assert.equal(events.length, 2);
  assert.notEqual(events[0].id, events[1].id);
  assert.notEqual(events[0].sources[0].url, events[1].sources[0].url);
});

test('bluenote: Feed ohne Termine ist ein Fehler', async () => {
  await assert.rejects(() => holen('2026-11-25', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'), /keine Termine/);
});

test('bluenote: fehlende oder fremde URL fällt auf die Seite des Hauses zurück, abgesagte Termine werden vermerkt', async () => {
  const body = kalender(
    ereignis('UID:a1@x', 'DTSTART:20261212T190000Z', 'SUMMARY:Ohne Link'),
    ereignis('UID:a2@x', 'DTSTART:20261213T190000Z', 'SUMMARY:Fremder Link', 'URL:https://example.org/boese/'),
    ereignis('UID:a3@x', 'DTSTART:20261214T190000Z', 'SUMMARY:Abgesagt', 'URL:https://bluenote-dresden.de/konzert/x/', 'STATUS:CANCELLED'),
  );
  const [ohne, fremd, abgesagt] = await holen('2026-11-25', body);
  assert.equal(ohne.sources[0].url, 'https://bluenote-dresden.de/');
  assert.equal(fremd.sources[0].url, 'https://bluenote-dresden.de/');
  assert.equal(abgesagt.sources[0].url, 'https://bluenote-dresden.de/konzert/x/');
  assert.equal(abgesagt.ticketStatus, 'abgesagt');
  assert.equal(ohne.ticketStatus, null);
});

test('bluenote: Zeit ohne Z gilt als Ortszeit, Termin ohne Uhrzeit hat hasTime false, kaputte Zeile wird übersprungen', async () => {
  const body = kalender(
    ereignis('UID:b1@x', 'DTSTART;TZID=Europe/Berlin:20261212T200000', 'SUMMARY:Ortszeit', 'URL:https://bluenote-dresden.de/konzert/b1/'),
    ereignis('UID:b2@x', 'DTSTART;VALUE=DATE:20261215', 'SUMMARY:Ganztag', 'URL:https://bluenote-dresden.de/konzert/b2/'),
    ereignis('UID:b3@x', 'DTSTART:unsinn', 'SUMMARY:Kaputt'),
    ereignis('UID:b4@x', 'DTSTART:20261216T190000Z', 'SUMMARY:  '),
  );
  const events = await holen('2026-11-25', body);
  assert.equal(events.length, 2);
  assert.equal(events[0].start, '2026-12-12T20:00:00+01:00');
  assert.equal(events[1].hasTime, false);
  assert.equal(events[1].start, '2026-12-15T00:00:00+01:00');
});

test('bluenote: höchstens 400 Termine, doppelte UIDs nur einmal', async () => {
  const viele = [];
  for (let i = 0; i < 450; i += 1) {
    const tag = new Date(Date.UTC(2026, 11, 1 + i)).toISOString().slice(0, 10).replaceAll('-', '');
    viele.push(ereignis(`UID:v${i}@x`, `DTSTART:${tag}T190000Z`, `SUMMARY:Termin ${i}`, `URL:https://bluenote-dresden.de/konzert/v${i}/`));
  }
  const events = await holen('2026-11-25', kalender(...viele, viele[0]));
  assert.equal(events.length, 400);
  assert.equal(new Set(events.map((e) => e.id)).size, 400);
  assert.equal(events[0].title, 'Termin 0');
});
