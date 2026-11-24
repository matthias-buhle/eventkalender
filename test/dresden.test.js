import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { name, fetchEvents } from '../src/sources/dresden.js';
import { runAll, einordnen } from '../src/build.js';
import { dedupe } from '../src/dedupe.js';
import { makeEvent } from '../src/model.js';
import { HttpError } from '../src/http.js';

// Alle Antworten hier sind erfunden und nach der OpenAPI-Beschreibung der Schnittstelle gebaut
// (https://veranstaltungen-api.dresden.de/api/doc/v2.json); es gibt keinen echten Abruf und keine echten Zugangsdaten.
const TODAY = '2026-11-24';
const config = { enabled: true, apiUrl: 'https://veranstaltungen-api.dresden.de', horizonDays: 90, limit: 500, maxPages: 40, fallbackUrl: null };
const TOKEN = { access_token: 'tok-erfunden-1', expires_in: 86400, token_type: 'bearer', scope: null };

const ENV = ['DRESDEN_API_KEY', 'DRESDEN_API_SECRET'];
let vorher;
beforeEach(() => {
  vorher = ENV.map((k) => process.env[k]);
  process.env.DRESDEN_API_KEY = 'erfundener-key';
  process.env.DRESDEN_API_SECRET = 'erfundenes-secret';
});
afterEach(() => ENV.forEach((k, i) => { if (vorher[i] === undefined) delete process.env[k]; else process.env[k] = vorher[i]; }));

let nummer = 100;
/** Ein erfundener Termin (EventDate mit eingebettetem Event); `over` ändert den Termin, `ev` die Veranstaltung. */
function termin(over = {}, ev = {}) {
  nummer += 1;
  return {
    id: nummer,
    start_date: '2026-12-05T19:30:00+01:00',
    end_date: '2026-12-05T22:00:00+01:00',
    enabled: true,
    is_cancelled: false,
    is_rescheduled: false,
    rescheduled_start_date: null,
    rescheduled_end_date: null,
    event: {
      id: 7000 + nummer,
      title: 'Beispielabend im Kulturhaus',
      is_highlight: false,
      is_online_event: false,
      open_data: true,
      prices: [],
      host: {
        id: 31, title: 'Kulturhaus Beispiel e. V.', telephone: '0351 0000000', email: 'kontakt@kulturhaus-beispiel.example',
        url: 'https://kulturhaus-beispiel.example', contact_person: 'Erika Beispiel',
      },
      location: { id: 55, title: 'Kulturhaus Beispiel', address: 'Beispielstraße 1', zip: '01067', city: 'Dresden', country: 'Deutschland', lat: '51.0504', lng: '13.7373' },
      tags: [],
      updated_at: '2026-11-01T10:00:00+01:00',
      event_links: [{ id: 1, href: 'https://kulturhaus-beispiel.example/programm/beispielabend', title: 'Zur Veranstaltung' }],
      ...ev,
    },
    ...over,
  };
}
const seite = (data, total = data.length, offset = 0) => ({ limit: 500, offset, total_count: total, data });

/** Fake-Client: merkt sich Anmeldungen (post) und Abrufe (get); die Seiten kommen der Reihe nach aus `seiten`. */
function fakeHttp(seiten, { token = TOKEN, postFehler = null } = {}) {
  const posts = [];
  const gets = [];
  const rest = [...seiten];
  return {
    posts,
    gets,
    post: async (url, opt) => {
      posts.push({ url, ...opt });
      if (postFehler) throw postFehler;
      return { status: 200, body: token, url };
    },
    get: async (url, opt) => {
      gets.push({ url, ...opt });
      return { status: 200, body: rest.shift() ?? seite([], 0), url };
    },
  };
}
const holen = (seiten, extra = {}, opt = {}) => fetchEvents({ http: fakeHttp(seiten, opt), today: TODAY, config: { ...config, ...extra } });
const einer = async (over, ev, extra) => (await holen([seite([termin(over, ev)])], extra))[0];

test('Quellenname ist dresden', () => {
  assert.equal(name, 'dresden');
});

test('dresden: ohne Zugangsdaten klare Meldung im Status, kein Abruf, der Lauf geht weiter', async () => {
  for (const fehlt of ENV) {
    process.env.DRESDEN_API_KEY = 'erfundener-key';
    process.env.DRESDEN_API_SECRET = 'erfundenes-secret';
    delete process.env[fehlt];
    const http = fakeHttp([seite([termin()])]);
    const { events, status } = await runAll({ sources: [{ name, fetchEvents, config }], http, now: new Date('2026-11-24T12:00:00Z') });
    assert.deepEqual(events, []);
    assert.equal(status[0].ok, false);
    assert.match(status[0].error, /keine Zugangsdaten/);
    assert.equal(http.posts.length + http.gets.length, 0, `${fehlt} fehlt: nichts wird abgerufen`);
  }
});

test('dresden: meldet sich mit Key und Secret als JSON an und sendet den Token nur im Kopf', async () => {
  const http = fakeHttp([seite([termin()])]);
  await fetchEvents({ http, today: TODAY, config });
  assert.equal(http.posts.length, 1);
  assert.equal(http.posts[0].url, 'https://veranstaltungen-api.dresden.de/oauth/v2/token');
  assert.deepEqual(http.posts[0].json, { apiKey: 'erfundener-key', apiSecret: 'erfundenes-secret' });
  assert.equal(http.posts[0].as, 'json');
  assert.equal(http.gets[0].headers.Authorization, 'Bearer tok-erfunden-1');
  assert.equal(http.gets[0].as, 'json');
  for (const geheim of ['tok-erfunden-1', 'erfundener-key', 'erfundenes-secret']) {
    assert.ok(!http.gets[0].url.includes(geheim), 'nichts Geheimes in der Adresse');
  }
});

test('dresden: holt den Token einmal je Lauf und nutzt ihn für alle Seiten', async () => {
  const http = fakeHttp([seite([termin()], 3, 0), seite([termin()], 3, 1), seite([termin()], 3, 2)]);
  const events = await fetchEvents({ http, today: TODAY, config });
  assert.equal(http.posts.length, 1);
  assert.equal(http.gets.length, 3);
  assert.deepEqual(http.gets.map((g) => g.headers.Authorization), Array(3).fill('Bearer tok-erfunden-1'));
  assert.equal(events.length, 3);
});

test('dresden: fragt die Termine der nächsten 90 Tage mit eingebetteter Veranstaltung ab', async () => {
  const http = fakeHttp([seite([termin()])]);
  await fetchEvents({ http, today: TODAY, config });
  const u = new URL(http.gets[0].url);
  assert.equal(u.origin + u.pathname, 'https://veranstaltungen-api.dresden.de/api/v2/secure/eventdates');
  assert.equal(u.searchParams.get('offset'), '0');
  assert.equal(u.searchParams.get('limit'), '500');
  assert.equal(u.searchParams.get('include_event'), 'true');
  assert.deepEqual(JSON.parse(u.searchParams.get('filter')), {
    end_date_from: '2026-11-24T00:00:00+01:00',
    start_date_to: '2027-02-22T23:59:00+01:00',
  });
});

test('dresden: liest weiter, bis total_count erreicht ist; der Versatz wächst um die gelieferten Einträge', async () => {
  const http = fakeHttp([seite([termin(), termin()], 5, 0), seite([termin(), termin()], 5, 2), seite([termin()], 5, 4)]);
  const events = await fetchEvents({ http, today: TODAY, config });
  assert.deepEqual(http.gets.map((g) => new URL(g.url).searchParams.get('offset')), ['0', '2', '4']);
  assert.equal(events.length, 5);
});

test('dresden: mehr Termine als maxPages Seiten fassen ist ein Fehler, nichts wird still abgeschnitten', async () => {
  const seiten = [seite([termin()], 9, 0), seite([termin()], 9, 1), seite([termin()], 9, 2)];
  await assert.rejects(holen(seiten, { maxPages: 2 }), /unvollständig/);
});

test('dresden: eine leere Seite mitten in der Liste beendet das Lesen mit Fehler statt Endlosschleife', async () => {
  await assert.rejects(holen([seite([termin()], 9, 0), seite([], 9, 1)]), /unvollständig/);
});

test('dresden: Antwort ohne Terminliste ist ein Fehler', async () => {
  await assert.rejects(holen([{ fehler: 'kaputt' }]), /keine Terminliste/);
});

test('dresden: Anmeldung ohne Token ist ein Fehler, die Meldung nennt weder Key noch Secret', async () => {
  await assert.rejects(holen([seite([termin()])], {}, { token: { error: 'nix' } }), (e) => /Anmeldung/.test(e.message) && !/erfunden/.test(e.message));
});

test('dresden: abgelehnte Anmeldung nennt den Status und bittet, die Zugangsdaten zu prüfen', async () => {
  const http = fakeHttp([seite([termin()])], { postFehler: new HttpError(401, 'https://veranstaltungen-api.dresden.de/oauth/v2/token') });
  await assert.rejects(fetchEvents({ http, today: TODAY, config }), (e) => /Anmeldung abgelehnt \(HTTP 401\)/.test(e.message) && /Zugangsdaten/.test(e.message) && !/erfunden/.test(e.message));
  assert.equal(http.gets.length, 0);
});

// ---------- Abbildung auf das Terminformat ----------

test('dresden: Termin hat Titel, Berliner Zeiten, Ort mit Koordinaten und den Link am Termin als Quelle', async () => {
  const e = await einer();
  assert.equal(e.title, 'Beispielabend im Kulturhaus');
  assert.equal(e.start, '2026-12-05T19:30:00+01:00');
  assert.equal(e.end, '2026-12-05T22:00:00+01:00');
  assert.equal(e.hasTime, true);
  assert.equal(e.placeName, 'Kulturhaus Beispiel, Dresden');
  assert.equal(e.lat, 51.0504);
  assert.equal(e.lon, 13.7373);
  assert.equal(e.country, 'DE');
  assert.deepEqual(e.sources, [{ name: 'Veranstaltungskalender Dresden', url: 'https://kulturhaus-beispiel.example/programm/beispielabend' }]);
  assert.equal(e.ticketUrl, null);
  assert.equal(e.ticketStatus, null);
  assert.equal(e.description, null);
});

test('dresden: Zeiten mit anderem Offset werden zum selben Zeitpunkt in Berliner Zeit', async () => {
  const e = await einer({ start_date: '2026-12-05T18:30:00+00:00', end_date: '2026-12-05T21:00:00Z' });
  assert.equal(e.start, '2026-12-05T19:30:00+01:00');
  assert.equal(e.end, '2026-12-05T22:00:00+01:00');
});

test('dresden: Mitternacht heißt ohne Uhrzeit; das Ende am selben Tag entfällt, bei mehreren Tagen bleibt es', async () => {
  const tag = await einer({ start_date: '2026-12-06T00:00:00+01:00', end_date: '2026-12-06T23:59:00+01:00' });
  assert.equal(tag.hasTime, false);
  assert.equal(tag.start, '2026-12-06T00:00:00+01:00');
  assert.equal(tag.end, null);
  const markt = await einer({ start_date: '2026-11-28T00:00:00+01:00', end_date: '2026-12-24T23:59:00+01:00' });
  assert.equal(markt.hasTime, false);
  assert.equal(markt.end, '2026-12-24T23:59:00+01:00');
});

test('dresden: ein Ende vor oder gleich dem Beginn zählt nicht', async () => {
  assert.equal((await einer({ end_date: '2026-12-05T19:30:00+01:00' })).end, null);
  assert.equal((await einer({ end_date: '2026-12-05T10:00:00+01:00' })).end, null);
  assert.equal((await einer({ end_date: null })).end, null);
});

test('dresden: abgesagte Termine bleiben und sind als abgesagt markiert', async () => {
  assert.equal((await einer({ is_cancelled: true })).ticketStatus, 'abgesagt');
});

test('dresden: verlegte Termine stehen am neuen Tag und sind als verlegt markiert', async () => {
  const e = await einer({ is_rescheduled: true, rescheduled_start_date: '2026-12-12T20:00:00+01:00', rescheduled_end_date: '2026-12-12T22:30:00+01:00' });
  assert.equal(e.start, '2026-12-12T20:00:00+01:00');
  assert.equal(e.end, '2026-12-12T22:30:00+01:00');
  assert.equal(e.ticketStatus, 'verlegt');
  const ohneNeu = await einer({ is_rescheduled: true });
  assert.equal(ohneNeu.start, '2026-12-05T19:30:00+01:00');
  assert.equal(ohneNeu.ticketStatus, 'verlegt');
});

test('dresden: nur Termine mit open_data: true werden übernommen', async () => {
  const gut = termin({}, { title: 'Offen' });
  const events = await holen([seite([
    gut,
    termin({}, { title: 'Nicht offen', open_data: false }),
    termin({}, { title: 'Ohne Angabe', open_data: undefined }),
    termin({}, { title: 'Angabe als Text', open_data: 'true' }),
  ])]);
  assert.deepEqual(events.map((e) => e.title), ['Offen']);
});

test('dresden: Online-Termine, abgeschaltete Termine und Einträge ohne Veranstaltung, Titel oder lesbaren Beginn bleiben weg', async () => {
  const events = await holen([seite([
    termin({}, { title: 'Bleibt' }),
    termin({}, { title: 'Online', is_online_event: true }),
    termin({ enabled: false }, { title: 'Abgeschaltet' }),
    { ...termin(), event: undefined },
    termin({}, { title: '   ' }),
    termin({ start_date: 'kaputt' }, { title: 'Kaputter Beginn' }),
    termin({ start_date: null }, { title: 'Ohne Beginn' }),
  ])]);
  assert.deepEqual(events.map((e) => e.title), ['Bleibt']);
});

test('dresden: Termine außerhalb des Zeitfensters bleiben weg, laufende zählen', async () => {
  const events = await holen([seite([
    termin({ start_date: '2026-11-20T10:00:00+01:00', end_date: '2026-11-30T18:00:00+01:00' }, { title: 'Läuft noch' }),
    termin({ start_date: '2026-11-20T10:00:00+01:00', end_date: '2026-11-23T18:00:00+01:00' }, { title: 'Vorbei' }),
    termin({ start_date: '2027-03-10T10:00:00+01:00', end_date: '2027-03-10T18:00:00+01:00' }, { title: 'Zu spät' }),
  ])]);
  assert.deepEqual(events.map((e) => e.title), ['Läuft noch']);
});

test('dresden: eine Antwort ohne einen verwertbaren Termin ist ein Fehler', async () => {
  await assert.rejects(holen([seite([])]), /leere Antwort/);
  await assert.rejects(holen([seite([termin({}, { open_data: false }), termin({}, { open_data: false })])]), /2 Einträge, aber keine Termine übrig/);
});

test('dresden: Stichwörter und Kategorie bestimmen die Art und gehen als Hinweis an die Einsortierung', async () => {
  const jazz = await einer({}, { title: 'Abend im Keller', tags: [{ id: 1, title: 'Jazz' }, { id: 2, title: 'Innenstadt' }] });
  assert.equal(jazz.art, 'konzert');
  assert.equal(jazz.genre, 'jazz');
  assert.deepEqual((({ rubrik, genre }) => ({ rubrik, genre }))(einordnen(jazz)), { rubrik: 'konzert', genre: 'jazz' });

  const floh = await einer({}, { title: 'Stöbern am Elbufer', tags: [{ id: 3, title: 'Flohmarkt' }] });
  assert.equal(floh.art, 'markt');
  assert.equal(floh.genre, 'troedel');
  assert.equal(einordnen(floh).rubrik, 'markt');

  const schau = await einer({}, { title: 'Zwischen den Zeilen', categories: [{ id: 4, title: 'Ausstellungen' }] });
  assert.equal(schau.art, 'schau');
  const alsText = await einer({}, { title: 'Lange Nacht', categories: ['Party', 7] });
  assert.equal(alsText.art, 'party');
});

test('dresden: ohne Stichwörter entscheidet der Titel, sonst bleibt die Art sonstiges ohne Hinweis', async () => {
  const konzert = await einer({}, { title: 'Adventskonzert des Kammerchors' });
  assert.equal(konzert.art, 'konzert');
  assert.equal(konzert.genre, null);
  const offen = await einer();
  assert.equal(offen.art, 'sonstiges');
  assert.equal(offen.genre, null);
});

test('dresden: Beschreibung wird zu einfachem Text und auf 300 Zeichen gekürzt', async () => {
  const kurz = await einer({}, { description: '<p>Ein Abend mit <b>Musik</b> &amp; Wein.</p>' });
  assert.equal(kurz.description, 'Ein Abend mit Musik & Wein.');
  const lang = await einer({}, { description: 'Wort '.repeat(200) });
  assert.ok(lang.description.length <= 300 && lang.description.endsWith('…'));
});

test('dresden: Ticket-Link wird erkannt; der Link zurück ist zuerst ein anderer Link am Termin', async () => {
  const beide = await einer({}, { event_links: [
    { href: 'https://tickets.example/abend', title: 'Tickets kaufen' },
    { href: 'https://kulturhaus-beispiel.example/programm/abend', title: 'Mehr erfahren' },
  ] });
  assert.equal(beide.ticketUrl, 'https://tickets.example/abend');
  assert.equal(beide.sources[0].url, 'https://kulturhaus-beispiel.example/programm/abend');
  const nurTicket = await einer({}, { event_links: [{ href: 'https://tickets.example/abend', title: 'Kartenvorverkauf' }] });
  assert.equal(nurTicket.ticketUrl, 'https://tickets.example/abend');
  assert.equal(nurTicket.sources[0].url, 'https://tickets.example/abend');
});

test('dresden: ohne Link am Termin zählt die Seite des Veranstalters, dann die Ausweichadresse; ohne alles entfällt der Termin', async () => {
  const ohneLinks = { event_links: [] };
  assert.equal((await einer({}, ohneLinks)).sources[0].url, 'https://kulturhaus-beispiel.example');
  const ohneHostSeite = { event_links: [{ href: 'javascript:alert(1)', title: 'Unsicher' }], host: { id: 31, title: 'Kulturhaus Beispiel e. V.', url: 'kein-link' } };
  assert.equal((await einer({}, ohneHostSeite, { fallbackUrl: 'https://kalender.example/' })).sources[0].url, 'https://kalender.example/');
  await assert.rejects(holen([seite([termin({}, ohneHostSeite)])]), /keine Termine übrig/);
});

test('dresden: Kontakt ist nur die Webseite des Veranstalters; Ansprechperson, Mail und Telefon werden nicht übernommen', async () => {
  const e = await einer();
  assert.deepEqual(e.contact, { phone: null, url: 'https://kulturhaus-beispiel.example', email: null });
  const alles = JSON.stringify(e);
  for (const privat of ['Erika Beispiel', 'kontakt@kulturhaus-beispiel.example', '0351 0000000', '03510000000']) {
    assert.ok(!alles.includes(privat), `${privat} darf nicht im Termin stehen`);
  }
});

test('dresden: Ortsname aus Spielstätte und Stadt, ohne die Stadt zu doppeln', async () => {
  const ort = (location) => einer({}, { location: { title: 'Kulturhaus Beispiel', city: 'Dresden', lat: '51.05', lng: '13.73', ...location } });
  assert.equal((await ort({ title: 'Kulturpalast Dresden' })).placeName, 'Kulturpalast Dresden');
  assert.equal((await ort({ title: '' })).placeName, 'Dresden');
  assert.equal((await ort({ city: 'Radebeul', title: 'Landesbühnen Sachsen' })).placeName, 'Landesbühnen Sachsen, Radebeul');
});

test('dresden: Koordinaten kommen als Text; unlesbare oder leere bleiben leer, der Termin bleibt über den Ortsnamen', async () => {
  for (const [lat, lng] of [['', ''], ['abc', '13.7'], ['0', '0'], [null, undefined], ['51.05', '']]) {
    const e = await einer({}, { location: { title: 'Kulturhaus Beispiel', city: 'Dresden', lat, lng } });
    assert.equal(e.lat, null, `${lat}/${lng}`);
    assert.equal(e.lon, null, `${lat}/${lng}`);
    assert.equal(e.placeName, 'Kulturhaus Beispiel, Dresden');
  }
  assert.equal((await einer({}, { location: { title: 'X', city: 'Dresden', lat: 51.05, lng: 13.73 } })).lat, 51.05, 'Zahlen gehen auch');
});

test('dresden: ein Termin ganz ohne Ortsangabe entfällt', async () => {
  const events = await holen([seite([termin({}, { title: 'Bleibt' }), termin({}, { title: 'Ohne Ort', location: null }), termin({}, { title: 'Leerer Ort', location: { title: ' ', city: '' } })])]);
  assert.deepEqual(events.map((e) => e.title), ['Bleibt']);
});

test('dresden: mehrere Termine einer Veranstaltung bleiben getrennt, derselbe Termin behält seine Kennung', async () => {
  const a = termin({ id: 501 }, { id: 9001 });
  const b = termin({ id: 502, start_date: '2026-12-06T19:30:00+01:00', end_date: '2026-12-06T22:00:00+01:00' }, { id: 9001 });
  const [e1, e2] = await holen([seite([a, b])]);
  assert.notEqual(e1.id, e2.id);
  const [nochmal] = await holen([seite([structuredClone(a)])]);
  assert.equal(nochmal.id, e1.id);
});

test('dresden: derselbe Termin aus Sachsen Tourismus wird über Titel, Tag und Ort zu einem Eintrag mit beiden Quellen', async () => {
  const dresden = await einer({}, { title: 'Striezelmarkt-Konzert' });
  const satourn = makeEvent({
    sourceName: 'Tourismus Sachsen (Open Data)', sourceId: 'e_1:2026-12-05', sourceUrl: 'https://www.sachsen-tourismus.de/x',
    title: 'Striezelmarkt-Konzert', start: '2026-12-05T19:30:00+01:00', placeName: 'Kulturhaus Beispiel, Dresden', lat: 51.05, lon: 13.74,
    lizenz: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.de', urheber: 'Beispiel' },
  });
  const zusammen = dedupe([satourn, dresden]);
  assert.equal(zusammen.length, 1);
  assert.deepEqual(zusammen[0].sources.map((s) => s.name), ['Tourismus Sachsen (Open Data)', 'Veranstaltungskalender Dresden']);
});

test('dresden: fehlt total_count, liest er weiter, bis eine Seite kürzer als limit ist', async () => {
  const ohne = (data) => ({ limit: 2, offset: 0, data });
  const http = fakeHttp([ohne([termin(), termin()]), ohne([termin()])]);
  const events = await fetchEvents({ http, today: TODAY, config: { ...config, limit: 2 } });
  assert.equal(http.gets.length, 2);
  assert.equal(events.length, 3);
});
