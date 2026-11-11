import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchApiEvents, lizenzAus } from '../src/sources/satourn-api.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/satourn-api.json', import.meta.url), 'utf8'));

const TODAY = '2026-11-11';
const config = {
  apiUrl: 'https://meta.et4.de/rest.ashx/search/',
  experience: 'open-data-sachsen-tourismus',
  limit: 1000,
  horizonDays: 90,
  fallbackUrl: 'https://www.sachsen-tourismus.de/',
};

/** Fake-Client: liefert den Body und merkt sich die abgerufenen Adressen. */
function fakeHttp(body = fixture) {
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      return { status: 200, body, url };
    },
  };
}

const lade = async (extra = {}, body = fixture) => fetchApiEvents({ http: fakeHttp(body), today: TODAY, config: { ...config, ...extra } });
const mitTitel = (events, titel) => events.filter((e) => e.title === titel);
const einzeln = (events, titel) => {
  const treffer = mitTitel(events, titel);
  assert.equal(treffer.length, 1, `${titel}: ${treffer.length} Treffer`);
  return treffer[0];
};

test('ruft die API genau einmal mit den festen Parametern ab', async () => {
  const http = fakeHttp();
  await fetchApiEvents({ http, today: TODAY, config });
  assert.equal(http.abgerufen.length, 1);
  const url = http.abgerufen[0];
  assert.ok(url.startsWith('https://meta.et4.de/rest.ashx/search/?'), url);
  for (const teil of [
    'experience=open-data-sachsen-tourismus', 'type=Event', 'template=schemaorg', 'limit=1000',
    'distance=75000', 'latitude=50.9399', 'longitude=14.291',
    'startdate=2026-11-11T00%3A00%3A00%2B01%3A00',
  ]) assert.ok(url.includes(teil), `${teil} fehlt in ${url}`);
  assert.match(url, /enddate=2027-02-09T/);
});

test('Termin A: Felder', async () => {
  const a = einzeln(await lade(), 'Weihnachtskonzert „Freue dich, Welt“');
  assert.equal(a.start, '2026-12-13T16:00:00+01:00');
  assert.equal(a.end, '2026-12-13T17:30:00+01:00');
  assert.equal(a.hasTime, true);
  assert.equal(a.placeName, 'Ev.-Luth. Peter-Paul-Kirche Sebnitz, Sebnitz');
  assert.equal(a.lat, 50.9667);
  assert.equal(a.lon, 14.2833);
  assert.deepEqual(a.contact, { phone: '+4935971' + '70960', email: 'touristinfo@sebnitz.de', url: 'https://www.sebnitz.de/tourist' });
  assert.deepEqual(a.lizenz, {
    name: 'CC BY-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
    urheber: 'Große Kreisstadt Sebnitz Touristinformation Sebnitz',
  });
  assert.equal(a.sources[0].name, 'Tourismus Sachsen (Open Data)');
  assert.equal(a.ticketUrl, 'https://tickets.example.org/weihnachtskonzert');
  assert.equal(a.description, 'Der Kirchenchor und das Orchester laden ein. Eintritt frei, Spenden willkommen.');
});

test('Lizenzen CC0 und CC BY', async () => {
  const events = await lade();
  const b = einzeln(events, 'Sonderausstellung Heimatgeschichte');
  assert.equal(b.lizenz.name, 'CC0 1.0');
  assert.equal(b.lizenz.url, 'https://creativecommons.org/publicdomain/zero/1.0/deed.de');
  assert.equal(b.lizenz.urheber, 'Heimatverein Neustadt');
  assert.equal(einzeln(events, 'Adventsmarkt').lizenz.name, 'CC BY 4.0');
});

test('Art aus dem Typ', async () => {
  const events = await lade();
  assert.equal(einzeln(events, 'Sonderausstellung Heimatgeschichte').art, 'schau');
  assert.equal(einzeln(events, 'Adventsmarkt').art, 'markt');
  assert.equal(einzeln(events, 'Weihnachtskonzert „Freue dich, Welt“').art, 'konzert');
  assert.equal(mitTitel(events, 'Brauhausweihnacht')[0].art, 'sonstiges');
});

test('ganztägig', async () => {
  const c = einzeln(await lade(), 'Adventsmarkt');
  assert.equal(c.start, '2026-11-28T00:00:00+01:00');
  assert.equal(c.hasTime, false);
  assert.equal(c.end, null);
});

test('Quellenlink', async () => {
  const events = await lade();
  assert.equal(einzeln(events, 'Weihnachtskonzert „Freue dich, Welt“').sources[0].url, 'https://www.saechsische-schweiz.de/veranstaltung/weihnachtskonzert-freue-dich-welt');
  assert.equal(einzeln(events, 'Sonderausstellung Heimatgeschichte').sources[0].url, 'https://example.org/verein/');
  assert.equal(einzeln(events, 'Adventsmarkt').sources[0].url, config.fallbackUrl);
});

test('Wiederholungen bleiben getrennt', async () => {
  const brau = mitTitel(await lade(), 'Brauhausweihnacht');
  assert.equal(brau.length, 2);
  assert.notEqual(brau[0].id, brau[1].id);
});

test('Abgesagt', async () => {
  const e = einzeln(await lade(), 'ABGESAGT: Lichterfahrt');
  assert.equal(e.ticketStatus, 'abgesagt');
});

test('Fenster', async () => {
  const events = await lade();
  assert.equal(mitTitel(events, 'Herbstführung im Park').length, 0, 'F ist vorbei');
  assert.equal(mitTitel(events, 'Frühlingsmarkt der Vereine').length, 0, 'H liegt hinter dem Fenster');
  assert.equal(mitTitel(events, 'Wanderausstellung Elbsandstein').length, 1, 'G läuft noch');
  // Fenster bis 21.11.: D1 (20.11.) ist dabei, D2 (26.11.) nicht mehr.
  const kurz = mitTitel(await lade({ horizonDays: 10 }), 'Brauhausweihnacht');
  assert.deepEqual(kurz.map((e) => e.start), ['2026-11-20T18:00:00+01:00']);
});

test('Nicht offene Lizenz, ohne Namen, ohne Beginn oder ohne Koordinaten werden übersprungen', async () => {
  const events = await lade();
  assert.equal(mitTitel(events, 'Vortrag zur Kulturlandschaft').length, 0, 'I: by-nc');
  assert.equal(mitTitel(events, 'Termin ohne Beginn').length, 0, 'K: ohne startDate');
  assert.equal(events.some((e) => e.sources[0].url.endsWith('/ohne-namen')), false, 'J: ohne name');
  assert.equal(mitTitel(events, '1 DB TEST V. (3x POI) ohne Koordinaten').length, 0, 'L: ohne geo');
  assert.equal(events.length, 7);
});

test('Einträge ohne Koordinaten werden übersprungen, auch mit nur einer Hälfte', async () => {
  const ohne = (geo) => [{ ...fixture[0], location: [{ ...fixture[0].location[0], geo }] }];
  await assert.rejects(lade({}, ohne(undefined)), /keine/);
  await assert.rejects(lade({}, ohne({ latitude: 50.9 })), /keine/);
  await assert.rejects(lade({}, ohne({ latitude: 'x', longitude: 14.2 })), /keine/);
  assert.equal((await lade({}, ohne({ latitude: '50.9', longitude: '14.2' }))).length, 1, 'Zahlen als Text sind gültig');
});

test('Leere Antwort ist ein Fehler', async () => {
  await assert.rejects(lade({}, []), /leer|keine/);
});

test('Antwort, aus der kein Termin entsteht, ist ein Fehler', async () => {
  const fremd = fixture.map((e) => ({ ...e, license: 'https://creativecommons.org/licenses/by-nc/4.0/' }));
  await assert.rejects(lade({}, fremd), /keine/);
  // Auch wenn alle Einträge außerhalb des Fensters liegen.
  await assert.rejects(lade({}, [fixture[6], fixture[8]]), /keine/);
});

test('Lizenz-Weißliste: nur die genaue https-Adresse der drei Lizenzen zählt', async () => {
  const mit = (license) => [fixture[0], { ...fixture[1], license }];
  const anzahl = async (license) => (await lade({}, mit(license))).length;
  assert.equal(await anzahl('https://creativecommons.org/licenses/by-sa/4.0'), 2, 'ohne Schrägstrich ist gültig');
  assert.equal(await anzahl('http://creativecommons.org/licenses/by-sa/4.0/'), 1, 'http');
  assert.equal(await anzahl('https://creativecommons.org/licenses/by-sa/3.0/'), 1, 'by-sa 3.0');
  assert.equal(await anzahl(undefined), 1, 'ohne Lizenz');
});

test('lizenzAus: Weißliste, deed-Adressen und Urheber', () => {
  assert.deepEqual(lizenzAus('https://creativecommons.org/licenses/by/4.0/deed.de', 'X'), {
    name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.de', urheber: 'X',
  });
  assert.equal(lizenzAus('https://creativecommons.org/licenses/by/4.0/', '').urheber, null);
  assert.equal(lizenzAus('https://creativecommons.org/licenses/by-nd/4.0/deed.de', 'X'), null);
  assert.equal(lizenzAus(undefined, 'X'), null);
});

test('Ohne Uhrzeit: Datum allein und Mitternacht sind ganztägig', async () => {
  const mitStart = (startDate) => [{ ...fixture[0], startDate, endDate: undefined }];
  assert.equal((await lade({}, mitStart('2026-12-13')))[0].hasTime, false, 'nur Datum');
  assert.equal((await lade({}, mitStart('2026-12-13T00:00:00+01:00')))[0].hasTime, false, 'Mitternacht');
  assert.equal((await lade({}, mitStart('2026-12-13T16:00:00+01:00')))[0].hasTime, true);
});

test('Antwort ohne Array ist ein Fehler', async () => {
  await assert.rejects(lade({}, { fehler: 1 }), /Array/);
});

test('Zu viele Datensätze sind ein Fehler', async () => {
  const viele = Array.from({ length: 900 }, (_, i) => ({
    ...fixture[0],
    identifier: [`e_9${String(i).padStart(8, '0')}`],
  }));
  await assert.rejects(lade({}, viele), /limit/);
});

test('Grenze der Abschneide-Prüfung: 899 verschiedene Datensätze gehen, 900 nicht', async () => {
  const datensaetze = (n) => Array.from({ length: n }, (_, i) => ({ ...fixture[0], identifier: [`e_9${String(i).padStart(8, '0')}`] }));
  assert.equal((await lade({}, datensaetze(899))).length, 899);
  await assert.rejects(lade({}, datensaetze(900)), /limit/);
  // Wiederholungen desselben Datensatzes zählen nur einmal.
  const wiederholt = Array.from({ length: 950 }, (_, i) => ({ ...fixture[0], startDate: `2026-12-${String(1 + (i % 28)).padStart(2, '0')}T16:00:00+01:00` }));
  assert.equal((await lade({}, wiederholt)).length, 950);
});
