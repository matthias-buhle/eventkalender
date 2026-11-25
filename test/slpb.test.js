import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents, leseListe, leseZeit } from '../src/sources/slpb.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const LISTE = 'https://www.slpb.de/veranstaltungen';
const config = { enabled: true, url: LISTE };

// Die Fixtures sind die echten Listenseiten 1, 2, 3 und 5 (Stand 25.11.2026). Seite 4 fehlt; der Adapter fragt sie
// nur an, wenn das Fenster weit genug reicht, dann steht Seite 5 stellvertretend ein.
const SEITEN = { 1: 'slpb-list-1.html', 2: 'slpb-list-2.html', 3: 'slpb-list-3.html', 4: 'slpb-list-5.html', 5: 'slpb-list-5.html' };

function netz() {
  const abrufe = [];
  return {
    abrufe,
    get: async (url) => {
      abrufe.push(url);
      const nr = url === LISTE ? 1 : Number(/currentPage%5D=(\d+)/.exec(url)?.[1]);
      assert.ok(SEITEN[nr], `unerwartete Adresse: ${url}`);
      return { status: 200, body: fx(SEITEN[nr]), url };
    },
  };
}
const holen = async (extra = {}, today = '2026-11-25') => {
  const http = netz();
  const events = await fetchEvents({ http, today, config: { ...config, ...extra } });
  return { events, abrufe: http.abrufe };
};
const finden = (events, teil, tag) => events.find((e) => e.title.includes(teil) && (!tag || e.start.startsWith(tag)));

test('Quellenname ist slpb', () => {
  assert.equal(name, 'slpb');
});

test('slpb: Listenseite liefert neun Karten und den Link zur nächsten Seite', () => {
  const { karten, naechsteSeite } = leseListe(fx('slpb-list-1.html'), LISTE);
  assert.equal(karten.length, 9);
  assert.match(naechsteSeite, /^https:\/\/www\.slpb\.de\/veranstaltungen\?.*currentPage%5D=2&.*cHash=/);
  assert.equal(leseListe(fx('slpb-list-5.html'), LISTE).naechsteSeite, null); // letzte Seite: kein Weiter
});

test('slpb: Zeitangaben der Karten', () => {
  assert.deepEqual(leseZeit('25.11.2026, 19:00 – 21:00 Uhr'), { start: { tag: '2026-11-25', zeit: '19:00' }, ende: { tag: '2026-11-25', zeit: '21:00' } });
  assert.deepEqual(leseZeit('03.09.2026 – 20.12.2026'), { start: { tag: '2026-09-03', zeit: null }, ende: { tag: '2026-12-20', zeit: null } });
  assert.deepEqual(leseZeit('01.12.2026, 10:00 Uhr – 02.12.2026, 16:00 Uhr'), { start: { tag: '2026-12-01', zeit: '10:00' }, ende: { tag: '2026-12-02', zeit: '16:00' } });
  assert.deepEqual(leseZeit('05.12.2026, 18:30 Uhr'), { start: { tag: '2026-12-05', zeit: '18:30' }, ende: null });
  assert.equal(leseZeit('nach Vereinbarung'), null);
});

test('slpb: Uhrzeit, Ende, Ort und Quellenlink aus der Karte; Ort mit Haus voran', async () => {
  const { events } = await holen({ horizonDays: 14 });
  const lesung = finden(events, 'Die Lücke im Album');
  assert.equal(lesung.start, '2026-11-25T19:00:00+01:00');
  assert.equal(lesung.end, '2026-11-25T21:00:00+01:00');
  assert.equal(lesung.hasTime, true);
  assert.equal(lesung.placeName, 'Hillersche Villa, Zittau');
  assert.equal(lesung.sources[0].name, 'Sächsische Landeszentrale für politische Bildung');
  assert.equal(lesung.sources[0].url, 'https://www.slpb.de/veranstaltungen/details/2026/die-luecke-im-album-wie-ich-die-geschichte-meiner-nichtjuedisch-juedischen-familie-in-der-ns-zeit-entdeckte-2559h');
  assert.equal(lesung.contact.url, lesung.sources[0].url);
  assert.equal(lesung.country, 'DE');
  assert.ok(lesung.description.length > 40 && lesung.description.length <= 300);
});

test('slpb: der Typ steht im Titelzusatz, damit Lesung, Vortrag und Film erkannt werden', async () => {
  const { events } = await holen({ horizonDays: 14 });
  assert.equal(finden(events, 'Die Lücke im Album').title, 'Die Lücke im Album. Wie ich die Geschichte meiner nichtjüdisch-jüdischen Familie in der NS-Zeit entdeckte. (Lesung)');
  assert.equal(finden(events, 'Bleiben? Verändern? Aufbrechen?', '2026-11-26').title, 'Bleiben? Verändern? Aufbrechen? (Filmvorführung)');
  assert.equal(finden(events, 'Warum die Demokratie schützen?', '2026-12-02').title, 'Warum die Demokratie schützen? (Vortrag mit Diskussion)');
  assert.equal(finden(events, 'Mit KI Ziele leichter erreichen').title, 'Mit KI Ziele leichter erreichen (Workshop)'); // Doppelpunkt am Ende entfällt
});

test('slpb: Art aus Typ und Titel; Ausstellungen sind Schauen, Begleitgespräche nicht', async () => {
  const { events } = await holen({ horizonDays: 20 });
  assert.equal(finden(events, 'Wie klingt die Freiheit?', '2026-11-30').art, 'konzert'); // Typ "Konzert mit Gespräch und Diskussion"
  assert.equal(finden(events, 'Sichtbare Vielfalt. Religionen in Sachsen', '2026-11-29').art, 'schau');
  assert.equal(finden(events, 'Die Lücke im Album').art, 'sonstiges');
  const gespraech = finden(events, 'Ausstellungsgespräch');
  assert.equal(gespraech.art, 'sonstiges');
  assert.match(gespraech.title, /\(Begleitveranstaltung\)$/);
});

test('slpb: Ausstellungen laufen über einen Zeitraum ohne Uhrzeit und zählen, solange sie laufen', async () => {
  const { events } = await holen();
  const tuchfabrik = finden(events, 'Sichtbare Vielfalt. Religionen in Sachsen', '2026-09-03');
  assert.ok(tuchfabrik, 'die seit September laufende Ausstellung gehört in die Liste');
  assert.equal(tuchfabrik.start, '2026-09-03T00:00:00+02:00');
  assert.equal(tuchfabrik.end, '2026-12-20T00:00:00+01:00');
  assert.equal(tuchfabrik.hasTime, false);
  assert.equal(tuchfabrik.placeName, 'Tuchfabrik, Crimmitschau');
  assert.equal(tuchfabrik.title, 'Sichtbare Vielfalt. Religionen in Sachsen (Ausstellung)');
});

test('slpb: abgelaufene Ausstellungen fallen heraus', async () => {
  const { events } = await holen({}, '2026-11-28');
  assert.equal(finden(events, 'Sichtbare Vielfalt', '2026-10-19'), undefined); // lief bis 27.11.2026
  assert.ok(finden(events, 'Sichtbare Vielfalt', '2026-09-03'));
});

test('slpb: Termine im Netz (online) werden nicht aufgenommen', async () => {
  const { events } = await holen({ horizonDays: 20 });
  assert.equal(finden(events, 'Informationsabend zur Bildungsreise'), undefined);
  assert.equal(finden(events, 'Was.Schule.bewegt.'), undefined);
  assert.ok(events.every((e) => e.placeName && !/^online/i.test(e.placeName)));
});

test('slpb: ein Ortsname ohne Haus bleibt der Ort', async () => {
  const { events } = await holen({ horizonDays: 700 });
  assert.equal(finden(events, 'Decoding Brüssel').placeName, 'Brüssel');
  assert.equal(finden(events, 'Trinationale Vernetzungstagung').placeName, 'Dresden');
});

test('slpb: Typ "Bildungsreise / Exkursion / Führung" wird zu "Bildungsreise"', async () => {
  const { events } = await holen({ horizonDays: 700, maxPages: 8 });
  const reise = finden(events, 'Decoding Brüssel');
  assert.match(reise.title, /\(Bildungsreise\)$/);
  assert.equal(reise.start.slice(0, 10), '2027-04-25');
  assert.equal(reise.end.slice(0, 10), '2027-04-28');
});

test('slpb: geblättert wird über die Weiter-Links, höchstens maxPages Seiten', async () => {
  const { abrufe, events } = await holen({ maxPages: 2 });
  assert.equal(abrufe.length, 2);
  assert.equal(abrufe[0], LISTE);
  assert.match(abrufe[1], /currentPage%5D=2&/);
  assert.ok(events.length > 10);
});

test('slpb: das Fenster horizonDays beendet das Blättern, sobald die Seite dahinter liegt', async () => {
  // Seite 2 endet am 02.12.2026; ein Fenster bis 01.12. braucht keine dritte Seite.
  const { abrufe, events } = await holen({ horizonDays: 6 });
  assert.equal(abrufe.length, 2);
  assert.ok(events.every((e) => e.start.slice(0, 10) <= '2026-12-01'));
  assert.ok(!finden(events, 'Tacheles - was bleibt?', '2026-12-02'));
});

test('slpb: Standardfenster 90 Tage, Standard 8 Seiten; keine Detailseiten', async () => {
  const { abrufe, events } = await holen();
  assert.ok(abrufe.length <= 8);
  assert.ok(abrufe.every((u) => u === LISTE || u.includes('currentPage')));
  assert.ok(events.every((e) => e.start.slice(0, 10) <= '2027-02-23'));
  assert.ok(finden(events, 'Tell me more', '2027-02-14'));
  assert.equal(finden(events, 'Herrnhut'), undefined);
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
});

test('slpb: Anzahl der Termine aus den echten Listenseiten', async () => {
  const { events } = await holen({ horizonDays: 14 }); // 25.11. bis 09.12.2026
  // Seiten 1 bis 3 haben 27 Karten: der Webtalk vom 02.12. liegt im Netz, zwei Termine vom 10.12. liegen hinter dem Fenster; die laufenden Ausstellungen zählen mit.
  assert.equal(events.length, 24);
});

test('slpb: Seite ohne Karten ist ein Fehler', async () => {
  const http = { get: async () => ({ status: 200, body: '<html><body>leer</body></html>', url: LISTE }) };
  await assert.rejects(() => fetchEvents({ http, today: '2026-11-25', config }), /keine Termine/);
});
