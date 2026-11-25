import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/varnsdorf.js';

const fx = (datei) => JSON.parse(readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8'));
const BASIS = 'https://www.varnsdorf.cz/rest/public/event-calendar/events';
const config = { enabled: true, url: BASIS, horizonDays: 90 };

/** Gibt der Reihe nach die übergebenen Antworten zurück und merkt sich die Adressen. */
function fakeHttp(antworten) {
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url, opts) => {
      abgerufen.push({ url, as: opts?.as });
      const antwort = antworten[Math.min(abgerufen.length - 1, antworten.length - 1)];
      if (antwort instanceof Error) throw antwort;
      return { status: 200, body: antwort, url };
    },
  };
}
const holen = async (antworten = [fx('varnsdorf-events.json')], cfg = config, today = '2026-11-25') => {
  const http = fakeHttp(antworten);
  return { events: await fetchEvents({ http, today, config: cfg }), http };
};
const finden = (events, anfang) => events.find((e) => e.title.startsWith(anfang));
const roh = (zusatz = {}) => ({
  id: 1, nazev: 'Testtermin', akatg3Name: '', misto: '', facilityName: 'Ostatní', facilityCity: '',
  startDate: Date.parse('2026-12-01T18:00:00Z'), endDate: Date.parse('2026-12-01T20:00:00Z'), ...zusatz,
});

test('Quellenname ist varnsdorf', () => {
  assert.equal(name, 'varnsdorf');
});

test('varnsdorf: Anfrage mit Datumsfenster TT.MM.JJJJ (heute bis heute + 90 Tage), Seite 0, JSON', async () => {
  const { http } = await holen();
  assert.equal(http.abgerufen.length, 1);
  assert.equal(http.abgerufen[0].url, `${BASIS}?datumOd=25.11.2026&datumDo=23.02.2027&page=0&pageSize=200`);
  assert.equal(http.abgerufen[0].as, 'json');
});

test('varnsdorf: horizonDays bestimmt das Ende des Fensters', async () => {
  const { http } = await holen([fx('varnsdorf-events.json')], { ...config, horizonDays: 30 });
  assert.match(http.abgerufen[0].url, /datumDo=25\.12\.2026&/);
});

test('varnsdorf: alle Termine des Fixtures werden gelesen', async () => {
  const { events } = await holen();
  assert.equal(events.length, 45);
  assert.equal(new Set(events.map((e) => e.id)).size, 45);
});

test('varnsdorf: Zeit aus UTC-Millisekunden als Berliner Zeit, Ende wenn vorhanden', async () => {
  const { events } = await holen();
  const jazz = finden(events, 'Mandava Jazz - Ben Poole');
  assert.equal(jazz.start, '2026-11-25T20:00:00+01:00');
  assert.equal(jazz.end, '2026-11-25T22:00:00+01:00');
  assert.equal(jazz.hasTime, true);
  const ples = finden(events, 'Ples města Varnsdorf');
  assert.equal(ples.start, '2027-01-16T19:00:00+01:00');
  assert.equal(ples.end, null, 'ein Ende um 23:59 ist nur Tagesende');
});

test('varnsdorf: Sommerzeit wird beachtet', async () => {
  const { events } = await holen([{ events: [roh({ startDate: Date.parse('2027-07-10T18:00:00Z'), endDate: null })], hasNext: false }], config, '2027-07-01');
  assert.equal(events[0].start, '2027-07-10T20:00:00+02:00');
});

test('varnsdorf: Ort aus misto, sonst Einrichtung, mit Varnsdorf ergänzt, ohne Doppelung', async () => {
  const { events } = await holen();
  assert.equal(finden(events, 'Vánoční trhy s dílničkami').placeName, 'MŠ Galaxie eR, Varnsdorf');
  assert.equal(finden(events, 'Adventní tvoření').placeName, 'ZUŠ Varnsdorf');
  assert.equal(finden(events, 'Irská kletba').placeName, 'Městské divadlo Varnsdorf');
  assert.equal(finden(events, 'Vánoční jarmark').placeName, 'ZŠ Východní, Varnsdorf');
  assert.equal(finden(events, 'Vánoční turnaj').placeName, 'sportovní hala, Západní 2984, Varnsdorf');
  assert.equal(finden(events, 'Vánoční kapřík').placeName, 'Plavecký bazén, Varnsdorf');
});

test('varnsdorf: Einrichtung "Ostatní" ist kein Ort; ohne Stadt in den Daten bleibt der Ort, wie er ist', async () => {
  const { events } = await holen();
  assert.equal(finden(events, 'Polyhymnia').placeName, 'Červený kostel');
  assert.equal(finden(events, 'Výstava betlémů').placeName, 'Varnsdorf', 'weder misto noch Einrichtung: nur die Stadt');
  const { events: leer } = await holen([{ events: [roh()], hasNext: false }]);
  assert.equal(leer[0].placeName, 'Varnsdorf');
});

test('varnsdorf: Land CZ, Sprache cs, Link zur Terminseite bei varnsdorf.cz, Quellenname', async () => {
  const jazz = finden((await holen()).events, 'Mandava Jazz - Ben Poole');
  assert.equal(jazz.country, 'CZ');
  assert.equal(jazz.sprache, 'cs');
  assert.equal(jazz.sources[0].url, 'https://www.varnsdorf.cz/cz/volny-cas/kalendar-akci/kalendar-udalosti.html?detail=true&id=12277');
  assert.equal(jazz.sources[0].name, 'Varnsdorf – varnsdorf.cz');
  assert.equal(jazz.contact.url, jazz.sources[0].url);
});

test('varnsdorf: ohne ID fällt der Link auf die Kalenderseite zurück', async () => {
  const { events } = await holen([{ events: [roh({ id: undefined })], hasNext: false }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].sources[0].url, 'https://www.varnsdorf.cz/cz/volny-cas/kalendar-akci/');
});

test('varnsdorf: keine Beschreibung, keine Bilder, kein Ticketlink, auch wenn die Daten sie liefern', async () => {
  const mitInhalt = roh({
    popis: '<p>Langer Text zur Veranstaltung</p>', vstupenka: 'https://tickets.example/x',
    galleryPhotos: [{ imageUrl: '/images/gallery/x.jpg' }], facilityEmail: 'x@example.org', facilityPhone: '123',
  });
  const { events } = await holen([{ events: [mitInhalt], hasNext: false }]);
  const e = events[0];
  assert.equal(e.description, null);
  assert.equal(e.ticketUrl, null);
  assert.doesNotMatch(JSON.stringify(e), /jpg|Langer Text|example/);
  for (const ev of (await holen()).events) assert.equal(ev.description, null);
});

test('varnsdorf: Art aus Kategorie und Titel (tschechisch)', async () => {
  const { events } = await holen();
  assert.equal(finden(events, 'Mandava Jazz - Ben Poole').art, 'konzert');
  assert.equal(finden(events, 'Vánoční trhy s dílničkami').art, 'markt');
  assert.equal(finden(events, 'Vánoční jarmark').art, 'markt');
  assert.equal(finden(events, 'Výstava betlémů').art, 'schau');
  assert.equal(finden(events, 'Ples města Varnsdorf').art, 'party');
  assert.equal(finden(events, 'Rozsvícení vánočního stromu').art, 'fest');
  assert.equal(finden(events, 'Mikulášské vlaky').art, 'fest');
  assert.equal(finden(events, 'Irská kletba').art, 'sonstiges', 'Theater bleibt sonstiges');
  assert.equal(finden(events, 'Silvestrovský běh').art, 'sonstiges', 'Sport bleibt sonstiges');
  assert.equal(finden(events, 'Vánoční krmení lesní zvěře').art, 'sonstiges');
});

test('varnsdorf: blättert, bis hasNext falsch ist, und nimmt jeden Termin nur einmal', async () => {
  const seite = (id, hasNext) => ({ events: [roh({ id })], hasNext });
  const { events, http } = await holen([seite(1, true), { events: [roh({ id: 1 }), roh({ id: 2 })], hasNext: true }, seite(3, false)]);
  assert.equal(http.abgerufen.length, 3);
  assert.match(http.abgerufen[1].url, /page=1&/);
  assert.match(http.abgerufen[2].url, /page=2&/);
  assert.equal(events.length, 3);
});

test('varnsdorf: liest höchstens maxPages Seiten (Standard 5)', async () => {
  const immerWeiter = { events: [roh()], hasNext: true };
  const { http } = await holen([immerWeiter]);
  assert.equal(http.abgerufen.length, 5);
  const { http: zwei } = await holen([immerWeiter], { ...config, maxPages: 2 });
  assert.equal(zwei.abgerufen.length, 2);
});

test('varnsdorf: Einträge ohne Titel oder Startzeit werden übersprungen', async () => {
  const { events } = await holen([{ events: [roh({ nazev: '  ' }), roh({ id: 2, startDate: null, datumOd: null }), roh({ id: 3 })], hasNext: false }]);
  assert.equal(events.length, 1);
});

test('varnsdorf: Fehler der Schnittstelle oder unbrauchbare Antwort sind ein Fehler', async () => {
  await assert.rejects(() => holen([new Error('HTTP 500 für x')]), /HTTP 500/);
  await assert.rejects(() => holen([{ foo: 1 }]), /Terminliste/);
});
