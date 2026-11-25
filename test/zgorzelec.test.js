import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/zgorzelec.js';

const liste = readFileSync(new URL('./fixtures/zgorzelec-liste.html', import.meta.url), 'utf8');
const LISTE_URL = 'https://zgorzelec.eu/wydarzenia-zgorzelec/';
const config = {
  enabled: true,
  url: LISTE_URL,
  contact: { phone: null, url: LISTE_URL, email: null },
};
const HEUTE = '2026-11-25';

function fakeHttp(body = liste) {
  const abrufe = [];
  return { abrufe, get: async (url) => { abrufe.push(url); return { status: 200, body, url }; } };
}
const holen = async (extra = {}, today = HEUTE) => {
  const http = fakeHttp();
  const events = await fetchEvents({ http, today, config: { ...config, ...extra } });
  return { events, http };
};

test('Quellenname ist zgorzelec', () => {
  assert.equal(name, 'zgorzelec');
});

test('zgorzelec: ein einziger Abruf der Listenseite, keine Einzelseiten', async () => {
  const { http } = await holen();
  assert.deepEqual(http.abrufe, [LISTE_URL]);
});

test('zgorzelec: nur Termine ab heute, 12 Parkrun darunter; der mehrtägige Markt zählt einmal', async () => {
  const { events } = await holen();
  assert.equal(events.length, 20);
  assert.ok(events.every((e) => (e.end ?? e.start).slice(0, 10) >= HEUTE));
  assert.equal(events.filter((e) => e.title === 'Parkrun').length, 12);
  assert.equal(events.filter((e) => e.title.startsWith('Śląski Jarmark')).length, 1);
  assert.ok(!events.some((e) => e.title.includes('Spotkanie autorskie')), 'vergangene Termine fehlen');
});

test('zgorzelec: Titel, Beginn mit Uhrzeit, Ort und Link zur Veranstaltung', async () => {
  const { events } = await holen();
  const melodie = events.find((e) => e.title.startsWith('Melodie pod Choinkę'));
  assert.equal(melodie.start, '2026-12-05T19:00:00+01:00');
  assert.equal(melodie.hasTime, true);
  assert.equal(melodie.placeName, 'Zgorzelec');
  assert.equal(melodie.sources[0].name, 'Stadt Zgorzelec');
  assert.equal(melodie.sources[0].url, 'https://zgorzelec.eu/kalendarz-wydarzen/melodie-pod-choinke-czyli-halina-mlynkova-i-zgorzelecka-orkiestra-mandolinistow/');
  assert.deepEqual(melodie.contact, config.contact);
});

test('zgorzelec: Zgorzelec-Termine tragen Koordinaten der Stadt, Görlitzer Termine nicht (die lösen sich über den Ort auf)', async () => {
  const { events } = await holen();
  const polen = events.find((e) => e.title.startsWith('Recital'));
  assert.equal(polen.lat, 51.152);
  assert.equal(polen.lon, 15.009);
  assert.equal(polen.country, 'DE');
  assert.equal(polen.sprache, null);
  const goerlitz = events.find((e) => e.title.startsWith('Śląski Jarmark'));
  assert.equal(goerlitz.placeName, 'Görlitz');
  assert.equal(goerlitz.lat, null);
});

test('zgorzelec: nur Titel, Datum, Ort und Link; keine Beschreibung, keine Bilder, kein Ticketlink', async () => {
  const { events } = await holen();
  for (const e of events) {
    assert.equal(e.description, null);
    assert.equal(e.ticketUrl, null);
    assert.equal(e.ticketStatus, null);
    assert.match(e.sources[0].url, /^https:\/\/zgorzelec\.eu\/kalendarz-wydarzen\/.+\/$/);
    assert.ok(!JSON.stringify(e).match(/\.(jpe?g|png|webp)/i), 'kein Bildlink');
  }
});

test('zgorzelec: Termin nur mit Datum hat hasTime false und Mitternacht', async () => {
  const { events } = await holen();
  const wosp = events.find((e) => e.title.startsWith('35. finał WOŚP'));
  assert.equal(wosp.hasTime, false);
  assert.equal(wosp.start, '2027-01-31T00:00:00+01:00');
  assert.equal(wosp.end, null);
});

test('zgorzelec: mehrtägiger Markt in Görlitz wird ein Termin vom ersten Tag bis zum Ende', async () => {
  const { events } = await holen();
  const markt = events.find((e) => e.title.startsWith('Śląski Jarmark'));
  assert.equal(markt.start, '2026-12-04T15:00:00+01:00');
  assert.equal(markt.end, '2026-12-20T22:00:00+01:00');
  assert.equal(markt.art, 'markt');
});

test('zgorzelec: ein laufender mehrtägiger Termin bleibt nach seinem ersten Tag erhalten', async () => {
  const { events } = await holen({}, '2026-12-10');
  const markt = events.find((e) => e.title.startsWith('Śląski Jarmark'));
  assert.equal(markt.start, '2026-12-04T15:00:00+01:00');
});

test('zgorzelec: Ende am selben Tag wird übernommen, ein Ende ohne Zeit oder gleich dem Beginn nicht', async () => {
  const { events } = await holen();
  const lauf = events.find((e) => e.title === 'Parkrun');
  assert.equal(lauf.start, '2026-11-28T10:00:00+01:00');
  assert.equal(lauf.end, '2026-11-28T12:00:00+01:00');
  const recital = events.find((e) => e.title.startsWith('Recital'));
  assert.equal(recital.end, null);
});

test('zgorzelec: HTML-Entitäten im Titel sind aufgelöst', async () => {
  const { events } = await holen({}, '2026-11-01');
  const fiat = events.find((e) => e.title.includes('Mały Fiat'));
  assert.ok(fiat, 'Termin vom 21.11. liegt im Fenster');
  assert.ok(!fiat.title.includes('&#'));
  assert.ok(fiat.title.includes('–'));
  assert.equal(fiat.end, null, 'Ende gleich Beginn wird nicht übernommen');
});

test('zgorzelec: Arten nach polnischen Stichworten', async () => {
  const { events } = await holen();
  const art = (anfang) => events.find((e) => e.title.startsWith(anfang)).art;
  assert.equal(art('Zgorzelecki Jarmark'), 'markt');
  assert.equal(art('Recital'), 'konzert');
  assert.equal(art('Parkrun'), 'sonstiges');
});

test('zgorzelec: Ids sind eindeutig, auch bei Parkrun mit gleichem Link', async () => {
  const { events } = await holen();
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
});

test('zgorzelec: horizonDays begrenzt nach vorn', async () => {
  const { events } = await holen({ horizonDays: 14 });
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => e.start.slice(0, 10) <= '2026-12-09'));
});

test('zgorzelec: abgesagt wird als ticketStatus erkannt', async () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'http://schema.org', '@type': 'Event', eventStatus: 'https://schema.org/EventCancelled',
    startDate: '2026-12-01T18:00:00+01:00', endDate: '2026-12-01',
    location: { '@type': 'Place', name: 'Zgorzelec' }, name: 'Koncert', url: 'https://zgorzelec.eu/kalendarz-wydarzen/koncert/',
  })}</script>`;
  const events = await fetchEvents({ http: fakeHttp(html), today: HEUTE, config });
  assert.equal(events.length, 1);
  assert.equal(events[0].ticketStatus, 'abgesagt');
});

test('zgorzelec: Seite ohne Termine ergibt eine leere Liste', async () => {
  const events = await fetchEvents({ http: fakeHttp('<html><body>nichts</body></html>'), today: HEUTE, config });
  assert.deepEqual(events, []);
});
