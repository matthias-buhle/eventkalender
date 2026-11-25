import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents, leseIcal } from '../src/sources/flohmarkt.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const URL_FEED = 'https://flohmarkt-sachsen.de/markttermine/ical/';
const config = { enabled: true, url: URL_FEED };
const http = (body) => ({ get: async (url) => { assert.equal(url, URL_FEED); return { status: 200, body, url }; } });
const holen = (today = '2026-11-25', body = fx('flohmarkt-feed.ics')) => fetchEvents({ http: http(body), today, config });
const finden = (events, anfang, tag) => events.find((e) => e.title.startsWith(anfang) && (!tag || e.start.startsWith(tag)));

const kalender = (...ereignisse) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${ereignisse.join('')}END:VCALENDAR\r\n`;
const ereignis = (...zeilen) => `BEGIN:VEVENT\r\n${zeilen.join('\r\n')}\r\nEND:VEVENT\r\n`;

test('Quellenname ist flohmarkt', () => {
  assert.equal(name, 'flohmarkt');
});

test('flohmarkt: der Sammelkalender ergibt 50 Markttermine, ein Abruf genügt', async () => {
  const events = await holen();
  assert.equal(events.length, 50);
  assert.ok(events.every((e) => e.art === 'markt' && e.country === 'DE' && e.hasTime));
  assert.equal(new Set(events.map((e) => e.id)).size, 50);
  const tage = events.map((e) => e.start.slice(0, 10)).sort();
  assert.equal(tage[0], '2026-11-28');
  assert.equal(tage.at(-1), '2027-05-01');
});

test('flohmarkt: Zeit mit Zeitzone Europe/Berlin, Winter- und Sommerzeit', async () => {
  const events = await holen();
  const winter = finden(events, 'Elbeflohmarkt', '2026-11-28');
  assert.equal(winter.start, '2026-11-28T09:00:00+01:00');
  assert.equal(winter.end, '2026-11-28T15:00:00+01:00');
  const sommer = finden(events, 'Elbeflohmarkt', '2027-04-03');
  assert.equal(sommer.start, '2027-04-03T09:00:00+02:00');
  assert.equal(sommer.end, '2027-04-03T15:00:00+02:00');
});

test('flohmarkt: Titel und Ort werden von HTML-Entitäten und iCal-Escapes befreit', async () => {
  const events = await holen();
  const mh = finden(events, 'Trödelmarkt Neustädter Markthalle', '2026-12-05');
  assert.ok(mh, 'Titel mit Umlauten gefunden');
  assert.equal(mh.placeName, 'Neustädter Markthalle, Metzer Str. 1, Dresden, Sachsen, 01097, Deutschland');
  assert.equal(finden(events, 'Japanfestival').title, 'Japanfestival & Kreativmarkt');
  assert.match(finden(events, 'Riesentrödelmarkt an der Galopprennbahn').placeName, /Oskar-Röder Straße 1/);
});

test('flohmarkt: Quellenlink und Kontakt sind die Seite des Termins', async () => {
  const e = finden(await holen(), 'Trödelmarkt Neustädter Markthalle', '2026-11-28');
  assert.equal(e.sources[0].name, 'flohmarkt-sachsen.de');
  assert.equal(e.sources[0].url, 'https://flohmarkt-sachsen.de/markttermine/troedelmarkt-neustaedter-markthalle-2-2026-11-28/');
  assert.equal(e.contact.url, e.sources[0].url);
});

test('flohmarkt: gefaltete Zeilen werden zusammengesetzt, die Beschreibung ist kurz und ohne Entitäten', async () => {
  const events = await holen();
  const elbe = finden(events, 'Elbeflohmarkt', '2026-11-28');
  assert.match(elbe.description, /^Marktzeit: 9 bis 15 Uhr Aufbau: ab 7 Uhr bis 8\.30 Uhr Parken:/);
  assert.ok(elbe.description.length <= 300);
  assert.ok(!/&\w+;/.test(elbe.description));
  assert.equal(finden(events, 'Trödelmarkt Neustädter Markthalle', '2026-11-28').description, null);
});

test('flohmarkt: vergangene Termine fallen heraus, ein laufender Termin bleibt', async () => {
  assert.equal((await holen('2026-11-29')).length, 48);
  const spaet = await holen('2027-04-25');
  assert.deepEqual(spaet.map((e) => e.start.slice(0, 10)), ['2027-04-25', '2027-05-01', '2027-05-01', '2027-05-01']);
  assert.equal((await holen('2027-05-02')).length, 0);
});

test('flohmarkt: Feed ohne Termine ist ein Fehler', async () => {
  await assert.rejects(() => holen('2026-11-25', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'), /keine Termine/);
});

test('flohmarkt: Termin ohne Uhrzeit (Ganztag) mit exklusivem Ende', async () => {
  const body = kalender(ereignis(
    'UID:a1@x', 'DTSTART;VALUE=DATE:20261205', 'DTEND;VALUE=DATE:20261207', 'SUMMARY:Adventsmarkt', 'URL:https://x.de/a/',
  ), ereignis('UID:a2@x', 'DTSTART;VALUE=DATE:20261205', 'DTEND;VALUE=DATE:20261206', 'SUMMARY:Eintagsmarkt', 'URL:https://x.de/b/'));
  const [mehr, ein] = await holen('2026-11-25', body);
  assert.equal(mehr.hasTime, false);
  assert.equal(mehr.start, '2026-12-05T00:00:00+01:00');
  assert.equal(mehr.end, '2026-12-06T00:00:00+01:00'); // letzter Tag ist der 6.
  assert.equal(ein.end, null);
});

test('flohmarkt: UTC-Zeit mit Z wird zur Berliner Zeit, ohne Z und ohne Zeitzone gilt Ortszeit', async () => {
  const body = kalender(
    ereignis('UID:u1@x', 'DTSTART:20260704T070000Z', 'DTEND:20260704T130000Z', 'SUMMARY:Sommermarkt', 'URL:https://x.de/u1/'),
    ereignis('UID:u2@x', 'DTSTART:20261212T100000', 'SUMMARY:Ortszeitmarkt', 'URL:https://x.de/u2/'),
  );
  const [utc, lokal] = await holen('2026-01-01', body);
  assert.equal(utc.start, '2026-07-04T09:00:00+02:00');
  assert.equal(utc.end, '2026-07-04T15:00:00+02:00');
  assert.equal(lokal.start, '2026-12-12T10:00:00+01:00');
  assert.equal(lokal.end, null);
});

test('flohmarkt: Escape-Zeichen, Faltung mit CRLF und abgesagte Termine', async () => {
  const body = kalender(ereignis(
    'UID:e1@x', 'DTSTART;TZID=Europe/Berlin:20261212T100000', 'SUMMARY:Kreativ-\\, Antik- und Tr&ouml;delmarkt',
    'LOCATION:Halle 1\\; Eingang\\, Hauptstr. 1\\, Dr', ' esden', 'DESCRIPTION:Zeile eins\\nZeile zwei mit Back\\\\slash',
    'STATUS:CANCELLED', 'URL:https://x.de/e1/',
  ));
  const [e] = await holen('2026-11-25', body);
  assert.equal(e.title, 'Kreativ-, Antik- und Trödelmarkt');
  assert.equal(e.placeName, 'Halle 1; Eingang, Hauptstr. 1, Dresden');
  assert.equal(e.description, 'Zeile eins Zeile zwei mit Back\\slash');
  assert.equal(e.ticketStatus, 'abgesagt');
});

test('flohmarkt: leseIcal ignoriert die Zeitzonenangaben und doppelte UIDs erscheinen nur einmal', async () => {
  const vt = 'BEGIN:VTIMEZONE\r\nBEGIN:DAYLIGHT\r\nDTSTART:19700329T020000\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE\r\n';
  const e = ereignis('UID:d1@x', 'DTSTART:20261212T100000', 'SUMMARY:Doppelt', 'URL:https://x.de/d/');
  assert.equal(leseIcal(vt + e + e).length, 2);
  assert.equal((await holen('2026-11-25', kalender(vt, e, e))).length, 1);
});
