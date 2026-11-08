import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, fetchEvents } from '../src/sources/gefluegel.js';
import { createPoliteClient } from '../src/http.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const BASIS = 'https://www.rassegefluegel-oberlausitz.de';
const LISTE = `${BASIS}/veranstaltungen/rubrik.php?nummer=5551`;
const D_HAINEWALDE = `${BASIS}/veranstaltungen/2916799/2026/11/07/kleintierschau-hainewalde`;
const D_SEBNITZ = `${BASIS}/veranstaltungen/2916791/2026/11/06/kreisjunggefluegelschau-des-territorialverbandes-der-kleintierzuechter-sebnitz-e.v`;
const TODAY = '2026-11-06';
const config = { enabled: true, listUrl: LISTE, minDelayMs: 10000, horizonDays: 60, maxDetailPages: 60 };

/** Liefert Liste und die zwei vorhandenen Detailseiten; die anderen Detailseiten gibt es nicht (404). */
function fakeHttp(extra = {}) {
  const seiten = { [LISTE]: fx('gefluegel-list.html'), [D_HAINEWALDE]: fx('gefluegel-detail-1.html'), [D_SEBNITZ]: fx('gefluegel-detail-2.html'), ...extra };
  const abgerufen = [];
  return {
    abgerufen,
    get: async (url, opts) => {
      abgerufen.push({ url, minDelayMs: opts?.minDelayMs });
      if (!seiten[url]) throw new Error(`HTTP 404 für ${url}`);
      return { status: 200, body: seiten[url], url };
    },
  };
}

test('Quellenname ist gefluegel', () => {
  assert.equal(name, 'gefluegel');
});

test("gefluegel: Termine haben art 'schau' und einen Ort", async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY, config });
  assert.equal(events.length, 4);
  assert.ok(events.every((e) => e.art === 'schau'));
  const hainewalde = events.find((e) => e.title === 'Kleintierschau Hainewalde');
  assert.equal(hainewalde.placeName, 'Turnhalle, Hainewalde');
  assert.equal(hainewalde.start, '2026-11-07T00:00:00+01:00');
  assert.equal(hainewalde.end, '2026-11-08T00:00:00+01:00');
  assert.equal(hainewalde.hasTime, false);
  assert.equal(hainewalde.sources[0].url, D_HAINEWALDE);
  assert.match(hainewalde.description, /Rassegeflügelzüchterverein Hainewalde e\.V\./);
  const sebnitz = events.find((e) => e.title.startsWith('Kreisjunggeflügelschau'));
  assert.equal(sebnitz.placeName, 'Stadthalle, Sebnitz');
});

test('gefluegel: Detailseite ohne Abruf-Erfolg behält den Termin aus der Liste mit Quellenlink', async () => {
  const events = await fetchEvents({ http: fakeHttp(), today: TODAY, config });
  const lokal = events.find((e) => e.title.startsWith('Lokalschau Neusalza'));
  assert.equal(lokal.placeName, '');
  assert.match(lokal.sources[0].url, /\/veranstaltungen\/2916519\/2026\/11\/06\/lokalschau-neusalza-spremberg$/);
  assert.equal(lokal.start, '2026-11-06T00:00:00+01:00');
});

test('gefluegel: jede Seite wird höchstens einmal je Lauf abgerufen, mit Mindestabstand 10000 ms', async () => {
  const http = fakeHttp();
  await fetchEvents({ http, today: TODAY, config });
  const urls = http.abgerufen.map((a) => a.url);
  assert.equal(urls.length, new Set(urls).size);
  assert.equal(urls.length, 5); // Liste + 4 Detailseiten
  assert.ok(http.abgerufen.every((a) => a.minDelayMs === 10000));
});

test('gefluegel: nur Termine im Zeitraum, höchstens maxDetailPages Detailseiten', async () => {
  const http = fakeHttp();
  const events = await fetchEvents({ http, today: TODAY, config: { ...config, maxDetailPages: 1 } });
  assert.equal(http.abgerufen.length, 2);
  assert.equal(events.length, 4, 'ohne Detailseite bleibt der Termin trotzdem');
  const amLetztenTag = await fetchEvents({ http: fakeHttp(), today: '2026-11-08', config });
  assert.equal(amLetztenTag.length, 4, 'Termine, die heute noch laufen, bleiben');
  assert.equal((await fetchEvents({ http: fakeHttp(), today: '2026-11-09', config })).length, 0, 'beendete Termine fallen weg');
  const frueh = await fetchEvents({ http: fakeHttp(), today: '2026-09-01', config: { ...config, horizonDays: 30 } });
  assert.equal(frueh.length, 0, 'Termine hinter dem Zeitraum fallen weg');
});

test('gefluegel: zwei Detailabrufe liegen mindestens 10 s auseinander (mit gefälschter Uhr)', async () => {
  let t = 0;
  const zeiten = [];
  const seiten = { [LISTE]: fx('gefluegel-list.html'), [D_HAINEWALDE]: fx('gefluegel-detail-1.html'), [D_SEBNITZ]: fx('gefluegel-detail-2.html') };
  const fetchImpl = async (url) => {
    if (url.endsWith('/robots.txt')) return { ok: false, status: 404, text: async () => '', url };
    zeiten.push(t);
    const body = seiten[url];
    return { ok: Boolean(body), status: body ? 200 : 404, text: async () => body ?? '', url };
  };
  const http = createPoliteClient({
    userAgent: 'Eventkalender-Ostsachsen/1.0 (test)', perHostDelayMs: 2000, fetchImpl,
    now: () => t, sleep: async (ms) => { t += ms; },
  });
  await fetchEvents({ http, today: TODAY, config });
  assert.ok(zeiten.length >= 4, `nur ${zeiten.length} Abrufe`);
  for (let i = 1; i < zeiten.length; i++) assert.ok(zeiten[i] - zeiten[i - 1] >= 10000, `Abstand ${zeiten[i] - zeiten[i - 1]} ms bei Abruf ${i}`);
});

test('gefluegel: Veranstalter-Kontakt aus der Detailseite (Telefon, E-Mail, Link)', async () => {
  const seite = fx('gefluegel-detail-1.html').replace(
    /(<article[^>]*single-view-4-organizer[\s\S]*?<p class="tiny_p">)\s*(<\/p>)/,
    '$1Tel. 035930 12345 <a href="mailto:zuechter@example.org">E-Mail</a> <a href="https://www.zuechter-hainewalde.example/">Webseite</a>$2',
  );
  const events = await fetchEvents({ http: fakeHttp({ [D_HAINEWALDE]: seite }), today: TODAY, config });
  const e = events.find((x) => x.title === 'Kleintierschau Hainewalde');
  assert.equal(e.contact.phone, '03593012345');
  assert.equal(e.contact.email, 'zuechter@example.org');
  assert.equal(e.contact.url, 'https://www.zuechter-hainewalde.example/');
  const ohne = events.find((x) => x.title.startsWith('Kreisjunggeflügelschau'));
  assert.equal(ohne.contact.phone, null);
  assert.equal(ohne.contact.url, D_SEBNITZ, 'ohne Angaben bleibt die Seite der Veranstaltung als Kontaktlink');
});

test('gefluegel: fällt die Liste aus, ist es ein Fehler', async () => {
  await assert.rejects(fetchEvents({ http: fakeHttp({ [LISTE]: '' }), today: TODAY, config }), /404/);
});
