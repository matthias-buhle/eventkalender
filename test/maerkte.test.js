import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/maerkte.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const MFT01 = 'https://meine-flohmarkt-termine.de/de/plz-gebiet/01';
const MFT02 = 'https://meine-flohmarkt-termine.de/de/plz-gebiet/02';
const MKT01 = 'https://meine-kunsthandwerker-termine.de/de/plz-gebiet/01';
const LEER = '<!doctype html><html><head></head><body></body></html>';
const TODAY = '2026-11-08';
const config = { enabled: true, urls: [MFT01, MFT02, MKT01], horizonDays: 60, maxPages: 4, ausserhalbPlz: ['0158', '0159', '0160'] };

/** Seite mit JSON-LD-Terminen im Format des Portals (Texte sind dort doppelt HTML-kodiert). */
function seite(events) {
  return `<!doctype html><html><head>${events.map((e) => `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Event',
    name: 'Testmarkt', description: 'Ein Markt',
    startDate: '2026-11-20', endDate: '2026-11-20',
    url: 'https://meine-flohmarkt-termine.de/testmarkt/1/details',
    location: { '@type': 'Place', name: 'Marktplatz', address: { '@type': 'PostalAddress', addressLocality: 'Pirna', postalCode: '01796', streetAddress: 'Markt 1' } },
    ...e,
  })}</script>`).join('\n')}</head><body></body></html>`;
}

function fakeHttp(seiten) {
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url) => {
      abgerufen.push(url);
      const body = seiten[url] ?? (url.includes('?page=') ? LEER : null);
      if (body === null) throw new Error(`HTTP 404 für ${url}`);
      if (body instanceof Error) throw body;
      return { status: 200, body, url };
    },
  };
}
const standard = () => fakeHttp({ [MFT01]: fx('maerkte-flohmarkt-plz01.html'), [MFT02]: LEER, [MKT01]: fx('maerkte-kunsthandwerk-plz01.html') });
const holen = (seiten, extra = {}) => fetchEvents({ http: fakeHttp(seiten), today: TODAY, config: { ...config, urls: [MFT01], ...extra } });

test('Quellenname ist maerkte', () => {
  assert.equal(name, 'maerkte');
});

test("maerkte: Termine haben art 'markt', Titel, Ort, Quellenlink und keine Uhrzeit", async () => {
  const events = await fetchEvents({ http: standard(), today: TODAY, config });
  const galopp = events.find((e) => e.title === 'Trödelmarkt Dresdner Galopprennbahn');
  assert.ok(galopp);
  assert.ok(events.every((e) => e.art === 'markt'));
  assert.equal(galopp.placeName, 'Galopprennbahn Dresden-Seidnitz, Dresden, Seidnitz');
  assert.equal(galopp.start, '2026-11-08T00:00:00+01:00');
  assert.equal(galopp.hasTime, false);
  assert.equal(galopp.sources[0].url, 'https://meine-flohmarkt-termine.de/trodelmarkt-dresdner-galopprennbahn/23729523/details');
  assert.equal(galopp.sources[0].name, 'meine-flohmarkt-termine.de');
  assert.equal(galopp.ticketStatus, null);
});

test('maerkte: doppelt kodierte Umlaute in Beschreibung und Ort werden lesbar', async () => {
  const events = await fetchEvents({ http: standard(), today: TODAY, config });
  const galopp = events.find((e) => e.title === 'Trödelmarkt Dresdner Galopprennbahn');
  assert.match(galopp.description, /^Dresdens schönster Flohmarkt/);
  assert.ok(!/&\w+;/.test(galopp.description), galopp.description);
  assert.ok(events.some((e) => e.placeName.startsWith('Neustädter Markthalle')));
  assert.ok(events.every((e) => e.description.length <= 300));
});

test('maerkte: Mehrtagesmarkt bleibt ein Termin (Tage mit eigener Seite werden zusammengefasst)', async () => {
  const events = await fetchEvents({ http: fakeHttp({ [MFT01]: fx('maerkte-flohmarkt-plz01.html') }), today: TODAY, config: { ...config, urls: [MFT01] } });
  const design = events.filter((e) => e.title === 'designmarket dresden');
  assert.equal(design.length, 1);
  assert.equal(design[0].start, '2026-11-14T00:00:00+01:00');
  assert.equal(design[0].end, '2026-11-15T00:00:00+01:00');
  assert.equal(events.length, 4, 'Galopprennbahn, designmarket, Markthalle, Elbeflohmarkt');
});

test('maerkte: ein Termin mit Enddatum bleibt ein Termin mit end nach start', async () => {
  const [e] = await holen({ [MFT01]: seite([{ startDate: '2026-11-27', endDate: '2026-11-29' }]) });
  assert.equal(e.start, '2026-11-27T00:00:00+01:00');
  assert.equal(e.end, '2026-11-29T00:00:00+01:00');
});

test('maerkte: wöchentliche Märkte desselben Orts bleiben getrennte Termine', async () => {
  const events = await holen({ [MFT01]: seite([
    { startDate: '2026-11-14', endDate: '2026-11-14', url: 'https://meine-flohmarkt-termine.de/a/1/details' },
    { startDate: '2026-11-21', endDate: '2026-11-21', url: 'https://meine-flohmarkt-termine.de/a/2/details' },
  ]) });
  assert.equal(events.length, 2);
});

test('maerkte: Orte außerhalb des Ortsverzeichnisses und der Postleitzahl-Sperre fallen weg', async () => {
  const events = await holen({ [MFT01]: seite([
    { url: 'https://meine-flohmarkt-termine.de/a/1/details', name: 'In Pirna' },
    { url: 'https://meine-flohmarkt-termine.de/a/2/details', name: 'In Leipzig', location: { name: 'Westbad', address: { addressLocality: 'Leipzig', postalCode: '01477' } } },
    { url: 'https://meine-flohmarkt-termine.de/a/3/details', name: 'In Riesa', location: { name: 'Halle', address: { addressLocality: 'Dresden', postalCode: '01587' } } },
  ]) });
  assert.deepEqual(events.map((e) => e.title), ['In Pirna']);
});

test('maerkte: abgesagt im Titel wird erkannt, sonst null', async () => {
  const events = await holen({ [MFT01]: seite([
    { url: 'https://meine-flohmarkt-termine.de/a/1/details', name: 'Flohmarkt (abgesagt)' },
    { url: 'https://meine-flohmarkt-termine.de/a/2/details', name: 'Flohmarkt' },
  ]) });
  assert.equal(events.find((e) => e.title.startsWith('Flohmarkt (')).ticketStatus, 'abgesagt');
  assert.equal(events.find((e) => e.title === 'Flohmarkt').ticketStatus, null);
});

test('maerkte: liest weitere Seiten, solange die Termine im Zeitraum liegen, höchstens maxPages', async () => {
  const http = standard();
  await fetchEvents({ http, today: TODAY, config: { ...config, urls: [MFT01] } });
  assert.deepEqual(http.abgerufen, [MFT01, `${MFT01}?page=2`]);
  const kurz = standard();
  await fetchEvents({ http: kurz, today: TODAY, config: { ...config, urls: [MFT01], maxPages: 1 } });
  assert.deepEqual(kurz.abgerufen, [MFT01]);
  const spaet = fakeHttp({ [MFT01]: seite([{ startDate: '2027-06-01', endDate: '2027-06-01' }]) });
  await fetchEvents({ http: spaet, today: TODAY, config: { ...config, urls: [MFT01] } });
  assert.deepEqual(spaet.abgerufen, [MFT01], 'Termine hinter dem Zeitraum: keine weitere Seite');
});

test('maerkte: eine ausgefallene Seite stoppt die anderen nicht; fallen alle aus, ist es ein Fehler', async () => {
  const events = await fetchEvents({ http: fakeHttp({ [MFT01]: new Error('HTTP 500'), [MKT01]: fx('maerkte-kunsthandwerk-plz01.html') }), today: TODAY, config: { ...config, urls: [MFT01, MKT01] } });
  assert.ok(events.length > 0);
  await assert.rejects(fetchEvents({ http: fakeHttp({ [MFT01]: new Error('HTTP 500') }), today: TODAY, config: { ...config, urls: [MFT01] } }), /500/);
});
