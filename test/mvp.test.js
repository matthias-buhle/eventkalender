import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import robotsParser from 'robots-parser';
import { name, fetchEvents } from '../src/sources/mvp.js';
import { rubrikUndGenre } from '../src/rubriken.js';
import { HttpError, RobotsDisallowedError } from '../src/http.js';

const fx = (datei) => readFileSync(new URL(`./fixtures/${datei}`, import.meta.url), 'utf8');
const BASIS = 'https://www.mvp.de/dresden/veranstaltungen/';
const PARTY = `${BASIS}tanzevents-partys-discotheken/`;
const KONZERTE = `${BASIS}konzerte/`;
const KONZERTE_2 = `${BASIS}konzerte/?from=40`;
const THEATER = `${BASIS}theater-buehne-comedy-musicals/`;
const TANZ = `${BASIS}tanz-ballett-events/`;
const ZIRKUS = `${BASIS}zirkus-variete-artistik/`;
const KINO = `${BASIS}kinos-filmvorfuehrungen/`;
const LESUNG = `${BASIS}lesungen-vortraege/`;
const KURSE = `${BASIS}seminare-kurse-workshops/`;
const KINDER = `${BASIS}veranstaltung-fuer-kinder/`;
const D_AFROB = `${BASIS}afrob-ferris-mc-reimemonster-tour-2026-reithalle-strasse-e/`;
const D_PIAF = `${BASIS}piaf-schauspielhaus-dresden/`;
const D_ADVENT = `${BASIS}adventskonzert-wallpavillon-im-dresdner-zwinger-dresden/`;
const TODAY = '2026-11-25';
const config = { enabled: true, horizonDays: 45, maxListPages: 2, maxDetailPages: 100, minDelayMs: 5000 };

const LISTEN = {
  [PARTY]: fx('mvp-party-1.html'),
  [KONZERTE]: fx('mvp-konzerte-1.html'),
  [KONZERTE_2]: fx('mvp-konzerte-2.html'),
  [THEATER]: fx('mvp-theater-1.html'),
  [TANZ]: fx('mvp-tanz-1.html'),
  [ZIRKUS]: fx('mvp-zirkus-1.html'),
  [KINO]: fx('mvp-kino-1.html'),
  [LESUNG]: fx('mvp-lesung-1.html'),
  [KURSE]: fx('mvp-kurse-1.html'),
  [KINDER]: fx('mvp-kinder-1.html'),
};
const DETAILS = {
  [D_AFROB]: fx('mvp-detail-einzel.html'),
  [D_PIAF]: fx('mvp-detail-reihe.html'),
  [D_ADVENT]: fx('mvp-detail-lang.html'),
};

/** Alle Seiten aus den Fixtures; alles andere gibt es nicht (404). Merkt sich Adressen und Abstand. */
function fakeHttp(seiten = { ...LISTEN, ...DETAILS }, hook = null) {
  const abgerufen = [];
  const abstaende = [];
  return {
    abgerufen,
    abstaende,
    get: async (url, opts = {}) => {
      abgerufen.push(url);
      abstaende.push(opts.minDelayMs);
      hook?.(url, abgerufen.length);
      if (!seiten[url]) throw new HttpError(404, url);
      return { status: 200, body: seiten[url], url };
    },
  };
}
const holen = async (cfg = config, seiten, today = TODAY) => {
  const http = fakeHttp(seiten);
  const events = await fetchEvents({ http, today, config: cfg });
  return { events, http };
};
const finden = (events, anfang) => events.filter((e) => e.title.startsWith(anfang));
const detailAdressen = (http) => http.abgerufen.filter((u) => !u.includes('?from=') && !Object.hasOwn(LISTEN, u));

/** Eine Karte der Liste im Aufbau von mvp.de (für Sonderfälle, die die echten Seiten gerade nicht enthalten). */
const karte = ({ href, titel, kat, ort = 'Club Test, DRESDEN', start, ende = start, ticket = null }) => `
<div class="abl-entry-wrapper entry-js"><div class="abl-entry abl-card"><div class="abl-card-body"><div class="abl-entry-content">
<h2 class="abl-entry-name"><a href="${href}">${titel}</a></h2>
<div class="abl-card-meta text-primary category"><span>${kat}</span></div>
<div class="abl-card-meta text-primary location"><span>${ort}</span></div></div>
<div class="abl-entry-footer"><div class="abl-card-eventdate"><span class="date-hint-js" data-start="${start}" data-end="${ende}"></span></div>
${ticket ? `<a href="${ticket}" class="btn ticket-button">Tickets kaufen</a>` : ''}</div></div></div></div>`;
const liste = (karten, weiter = null) => `<!doctype html><html><body>${weiter ? `<a class="btn abl-next-js" href="${weiter}">nächste Seite</a>` : ''}${karten.join('')}</body></html>`;
const ARTISTEN = '/dresden/veranstaltungen/';

test('Quellenname ist mvp', () => {
  assert.equal(name, 'mvp');
});

test('mvp: alle Abrufe der Fixtures sind laut robots.txt erlaubt (Unterlagen vom 24.11.2026)', async () => {
  const robots = robotsParser('https://www.mvp.de/robots.txt', fx('mvp-robots.txt'));
  const { http } = await holen();
  assert.ok(http.abgerufen.length > 10);
  for (const url of http.abgerufen) assert.equal(robots.isAllowed(url, 'Eventkalender-Ostsachsen'), true, url);
});

test('mvp: jeder Abruf nutzt mindestens minDelayMs Abstand (Standard 5 Sekunden)', async () => {
  const { http } = await holen({ ...config, minDelayMs: undefined });
  assert.ok(http.abstaende.length > 10);
  assert.ok(http.abstaende.every((a) => a === 5000));
  const { http: langsam } = await holen({ ...config, minDelayMs: 8000, maxDetailPages: 2 });
  assert.ok(langsam.abstaende.every((a) => a === 8000));
});

test('mvp: Konzert mit Einzelseite: Titel, Beginn, Ort, Ticketlink, Link zurück, keine Beschreibung', async () => {
  const { events } = await holen();
  const [afrob] = finden(events, 'Afrob & Ferris MC');
  assert.equal(afrob.title, 'Afrob & Ferris MC - Reimemonster Tour 2026');
  assert.equal(afrob.start, '2026-11-26T20:00:00+01:00');
  assert.equal(afrob.hasTime, true);
  assert.equal(afrob.art, 'konzert');
  assert.equal(afrob.genre, 'hiphop-elektro');
  assert.equal(afrob.placeName, 'Reithalle Strasse E, Dresden');
  assert.match(afrob.ticketUrl, /^https:\/\/www\.eventim\.de\/noapp\/event\/21437303\//);
  assert.equal(afrob.ticketStatus, 'verfuegbar');
  assert.deepEqual(afrob.sources, [{ name: 'mvp.de', url: D_AFROB }]);
  assert.equal(afrob.contact.url, D_AFROB);
  assert.equal(afrob.description, null);
  assert.equal(afrob.lat, null);
});

test('mvp: keiner der Termine trägt Beschreibung, Foto oder Fremdtext', async () => {
  const { events } = await holen();
  assert.ok(events.length > 100);
  for (const e of events) {
    assert.equal(e.description, null, e.title);
    assert.deepEqual(Object.keys(e.contact).filter((k) => e.contact[k]), ['url'], e.title);
  }
});

test('mvp: Reihe mit Einzelseite wird je Termin ein Eintrag, nur im Horizont (45 Tage bis 09.01.2027)', async () => {
  const { events } = await holen();
  const piaf = finden(events, 'Piaf');
  assert.deepEqual(piaf.map((e) => e.start), ['2026-11-25T19:30:00+01:00', '2026-12-10T19:30:00+01:00']);
  assert.ok(piaf.every((e) => e.hasTime && e.placeName === 'Schauspielhaus, Dresden'));
  assert.notEqual(piaf[0].ticketUrl, piaf[1].ticketUrl);
  assert.equal(new Set(piaf.map((e) => e.id)).size, 2);
  const weiter = await holen({ ...config, horizonDays: 60 });
  assert.equal(finden(weiter.events, 'Piaf').length, 3);
});

test('mvp: lange Reihe: nur Termine ab heute bis Horizont, zwei Termine am selben Tag bleiben getrennt', async () => {
  const { events } = await holen();
  const advent = finden(events, 'Adventskonzert im Dresdner Zwinger');
  assert.equal(advent.length, 14);
  assert.ok(advent.every((e) => e.start >= '2026-11-25' && e.start < '2027-01-10'));
  const tag = advent.filter((e) => e.start.startsWith('2026-11-29'));
  assert.deepEqual(tag.map((e) => e.start.slice(11, 16)), ['14:00', '17:00']);
  assert.equal(new Set(advent.map((e) => e.id)).size, 14);
  assert.equal(advent[0].placeName, 'Wallpavillon im Dresdner Zwinger, Dresden');
});

test('mvp: ohne Einzelseite zählt nur der Tag der Liste (ohne Uhrzeit), Ticketlink der Karte nur bei einem Tag', async () => {
  const { events } = await holen();
  const [ty] = finden(events, 'Ty Freeman');
  assert.equal(ty.start, '2026-11-26T00:00:00+01:00');
  assert.equal(ty.hasTime, false);
  assert.equal(ty.art, 'party');
  assert.equal(ty.genre, 'club');
  assert.equal(ty.placeName, 'Bärenzwinger, Dresden');
  assert.match(ty.ticketUrl, /^https:\/\/www\.eventim\.de\//);
  assert.equal(ty.sources[0].url, `${BASIS}ty-freeman-one-way-love-european-tour-26-27-baerenzwinger/`);
  const [reihe] = finden(events, 'Böhmischer Spätschoppen'); // Reihe 26.11.2026 bis 21.03.2027, Einzelseite nicht abgerufen
  assert.equal(reihe.start, '2026-11-26T00:00:00+01:00');
  assert.equal(reihe.ticketUrl, null);
  assert.equal(finden(events, 'Böhmischer Spätschoppen').length, 1);
});

test('mvp: Titel ohne " - DRESDEN" und ohne veraltetes Datum am Ende', async () => {
  const { events } = await holen({ ...config, maxDetailPages: 0 });
  assert.ok(finden(events, 'Afrob & Ferris MC - Reimemonster Tour 2026').length === 1);
  assert.ok(events.every((e) => !/ - DRESDEN$/i.test(e.title) && !/ - \d{1,2}\.\d{1,2}\.\d{4}$/.test(e.title)), 'Zusatz im Titel');
  assert.ok(finden(events, 'Vivaldi - Die vier Jahreszeiten').length >= 1);
});

test('mvp: Orte aus Versalien werden zu "Location, Stadt"; die Stadt wird nicht doppelt genannt', async () => {
  const { events } = await holen({ ...config, maxDetailPages: 0 });
  const orte = new Set(events.map((e) => e.placeName));
  assert.ok(orte.has('Reithalle Strasse E, Dresden'));
  assert.ok(orte.has('Konzertsaal im Kulturpalast Dresden'));
  assert.ok(orte.has('Stadtkulturhaus - Saal Laterne, Freital'));
  assert.ok(orte.has('Staatsoperette Dresden'));
  assert.ok([...orte].every((o) => !/DRESDEN|FREITAL/.test(o)), 'Versalien übrig');
});

test('mvp: Art und Rubrik: Konzerte, Partys, Theater, Tanz, Kinder und Lesungen landen in ihrer Rubrik', async () => {
  const { events } = await holen({ ...config, horizonDays: 90 });
  const rubrik = (anfang) => {
    const treffer = finden(events, anfang);
    assert.ok(treffer.length, `${anfang} fehlt`);
    return rubrikUndGenre(treffer[0]);
  };
  assert.equal(rubrik('Conny Ochs').rubrik, 'konzert');
  assert.equal(rubrik('Haymaker').rubrik, 'party');
  assert.equal(rubrik('Nikolaus 2026').rubrik, 'party');
  assert.equal(rubrik('Woyzeck').rubrik, 'theater');
  assert.equal(rubrik('Der Nussknacker').rubrik, 'theater'); // Ballett
  assert.equal(rubrik('TUNE BACK').rubrik, 'theater'); // Tanz
  assert.equal(rubrik('Breakin').rubrik, 'theater'); // Zirkus, Varieté, Artistik
  assert.equal(rubrik('Lesung Dörte Hansen').genre, 'lesung');
  assert.equal(rubrik('Schreibkurs').rubrik, 'kurse');
  assert.equal(rubrik('Puppentheater Glöckchen').rubrik, 'kinder');
  assert.equal(rubrik('Hänsel & Gretel').rubrik, 'kinder'); // nur "Kinderfreundliches Event" an einer Oper
  assert.equal(rubrik('Das große Taschenlampen').rubrik, 'kinder'); // Konzert + Kinder
  assert.equal(rubrik('Abenteuer Japan').rubrik, 'theater'); // Kino
  assert.equal(rubrik('Abenteuer Japan').genre, 'kino');
});

test('mvp: das Rubrikwort wird nur angehängt, wenn die Rubrik sonst nicht stimmt', async () => {
  const { events } = await holen();
  assert.ok(finden(events, 'Woyzeck')[0].title.endsWith('(Theater)')); // "Woyzeck" allein sagt src/rubriken.js nichts
  assert.equal(finden(events, 'Die Weihnachtsgans Auguste')[0].title, 'Die Weihnachtsgans Auguste'); // Spielstätte "Boulevardtheater" genügt
  assert.equal(finden(events, 'Lesung Dörte Hansen')[0].title, 'Lesung Dörte Hansen');
  assert.equal(finden(events, 'Conny Ochs')[0].title, 'Conny Ochs');
  assert.ok(finden(events, 'Hänsel & Gretel')[0].title.endsWith('(für Kinder)'));
});

test('mvp: Genre-Hinweis aus der Kategorie der Karte', async () => {
  const { events } = await holen();
  const genre = (anfang) => finden(events, anfang)[0].genre;
  assert.equal(genre('Jazz Faculty'), 'jazz');
  assert.equal(genre('Cabal & Employed'), 'metal-punk');
  assert.equal(genre('Olivier Latry'), 'klassik');
  assert.equal(genre('Hutzenobnd'), 'schlager-folk');
  assert.equal(genre('Conny Ochs'), 'rock-pop');
  assert.equal(finden(events, 'Árstíðir')[0].genre, null); // "Konzert - sonstige Musik"
});

test('mvp: Seite 2 der Liste nur, solange der Horizont nicht erreicht ist; Party endet nach Seite 1', async () => {
  const { http } = await holen();
  assert.ok(http.abgerufen.includes(KONZERTE_2));
  assert.equal(http.abgerufen.filter((u) => u.startsWith(PARTY)).length, 1); // letzte Karte 15.02.2027, Horizont 09.01.2027
  assert.ok(!http.abgerufen.includes(`${KONZERTE}?from=80`), 'maxListPages = 2');
  const { http: ein } = await holen({ ...config, maxListPages: 1 });
  assert.ok(!ein.abgerufen.includes(KONZERTE_2));
});

test('mvp: höchstens maxDetailPages Einzelseiten, die nächstliegenden zuerst', async () => {
  const { http, events } = await holen({ ...config, maxDetailPages: 3 });
  assert.equal(detailAdressen(http).length, 3);
  // am 25.11. beginnen die Reihen; Afrob (26.11.) kommt nicht mehr an die Reihe
  assert.ok(!detailAdressen(http).includes(D_AFROB));
  assert.ok(events.length > 100);
  const { http: keine } = await holen({ ...config, maxDetailPages: 0 });
  assert.equal(detailAdressen(keine).length, 0);
  assert.equal(keine.abgerufen.length, http.abgerufen.length - 3);
});

test('mvp: Standard ist höchstens 40 Einzelseiten und 6 Listenseiten je Kategorie', async () => {
  const volleListe = (start, n) => liste(Array.from({ length: n }, (_, i) => karte({ href: `${ARTISTEN}konzert-${start}-${i}/`, titel: `Konzert ${start} ${i}`, kat: 'Konzert - Klassik', start: '2026-11-26' })), `${KONZERTE}?from=${start + 40}`);
  const seiten = {};
  for (let s = 0; s < 400; s += 40) seiten[s === 0 ? KONZERTE : `${KONZERTE}?from=${s}`] = volleListe(s, 40);
  const http = fakeHttp(seiten);
  const events = await fetchEvents({ http, today: TODAY, config: { listUrls: [KONZERTE] } });
  const listenAbrufe = http.abgerufen.filter((u) => u.startsWith(KONZERTE));
  assert.equal(listenAbrufe.length, 6);
  assert.equal(http.abgerufen.length - 6, 40);
  assert.equal(events.length, 240);
});

test('mvp: Reihe, die schon läuft (Beginn in der Vergangenheit), zählt nur mit Einzelseite', async () => {
  const href = `${ARTISTEN}lauf-reihe/`;
  const liste1 = liste([karte({ href, titel: 'Laufende Reihe', kat: 'Theater, Musical, Bühne & Comedy', start: '2026-02-03', ende: '2026-12-31' })]);
  const ohne = await fetchEvents({ http: fakeHttp({ [THEATER]: liste1 }), today: TODAY, config: { listUrls: [THEATER], maxDetailPages: 0 } });
  assert.deepEqual(ohne, []);
  const detail = fx('mvp-detail-reihe.html');
  const mit = await fetchEvents({ http: fakeHttp({ [THEATER]: liste1, [`https://www.mvp.de${href}`]: detail }), today: TODAY, config: { listUrls: [THEATER] } });
  assert.equal(mit.length, 2);
  assert.ok(mit.every((e) => e.start >= '2026-11-25'));
});

test('mvp: Führungen und Rundfahrten gehören nicht zur Zusage, Theater mit Führung schon', async () => {
  const seite = liste([
    karte({ href: `${ARTISTEN}rundgang/`, titel: 'Nachtwächter-Rundgang', kat: 'Lesung, Vortrag, Talk & Podcast, Führung, Rundfahrt & Ausflug', start: '2026-11-26' }),
    karte({ href: `${ARTISTEN}wandern/`, titel: 'Aktiv', kat: 'Aktiv / Natur / Tour', start: '2026-11-26' }),
    karte({ href: `${ARTISTEN}theaterfuehrung/`, titel: 'Der Kontrabass', kat: 'Theater, Musical, Bühne & Comedy, Führung, Rundfahrt & Ausflug', start: '2026-11-26' }),
    karte({ href: `${ARTISTEN}vortrag/`, titel: 'Reisebericht Island', kat: 'Lesung, Vortrag, Talk & Podcast', start: '2026-11-27' }),
  ]);
  const events = await fetchEvents({ http: fakeHttp({ [LESUNG]: seite }), today: TODAY, config: { listUrls: [LESUNG], maxDetailPages: 0 } });
  assert.deepEqual(events.map((e) => e.title.replace(/ \(.*\)$/, '')), ['Der Kontrabass', 'Reisebericht Island']);
  const rubriken = events.map((e) => rubrikUndGenre(e).rubrik);
  assert.ok(rubriken.every((r) => r === 'theater' || r === 'kurse'), rubriken.join());
});

test('mvp: Orte außerhalb von Dresden und Umgebung (anderer Pfad) werden verworfen', async () => {
  const seite = liste([
    karte({ href: '/berlin/veranstaltungen/club-berlin/', titel: 'Berlin Party', kat: 'Tanz / Party & Disco', ort: 'Club, BERLIN', start: '2026-11-26' }),
    karte({ href: '/sachsen/veranstaltungen/coswig-fasching/', titel: 'Fasching Coswig', kat: 'Tanz / Party & Disco', ort: 'Börse Coswig', start: '2026-11-27' }),
    karte({ href: `${ARTISTEN}dresden-party/`, titel: 'Dresden Party', kat: 'Tanz / Party & Disco', ort: 'ALTES PUMPENHAUS, DRESDEN', start: '2026-11-28' }),
  ]);
  const events = await fetchEvents({ http: fakeHttp({ [PARTY]: seite }), today: TODAY, config: { listUrls: [PARTY], maxDetailPages: 0 } });
  assert.deepEqual(events.map((e) => [e.title, e.placeName]), [['Fasching Coswig', 'Börse Coswig'], ['Dresden Party', 'Altes Pumpenhaus, Dresden']]);
});

test('mvp: Kategorie der Liste gilt, wenn die Karte keine bekannte Beschriftung trägt', async () => {
  const seite = liste([karte({ href: `${ARTISTEN}x/`, titel: 'Etwas Neues', kat: 'Sonstiges Event', start: '2026-11-26' })]);
  const events = await fetchEvents({ http: fakeHttp({ [KINDER]: seite }), today: TODAY, config: { listUrls: [KINDER], maxDetailPages: 0 } });
  assert.equal(events.length, 1);
  assert.equal(rubrikUndGenre(events[0]).rubrik, 'kinder');
});

test('mvp: Termine vor heute und hinter dem Horizont bleiben weg', async () => {
  const seite = liste([
    karte({ href: `${ARTISTEN}alt/`, titel: 'Gestern', kat: 'Konzert - Rock & Pop', start: '2026-11-24' }),
    karte({ href: `${ARTISTEN}heute/`, titel: 'Heute', kat: 'Konzert - Rock & Pop', start: '2026-11-25' }),
    karte({ href: `${ARTISTEN}letzter/`, titel: 'Letzter Tag', kat: 'Konzert - Rock & Pop', start: '2027-01-09' }),
    karte({ href: `${ARTISTEN}spaet/`, titel: 'Zu spät', kat: 'Konzert - Rock & Pop', start: '2027-01-10' }),
  ]);
  const events = await fetchEvents({ http: fakeHttp({ [KONZERTE]: seite }), today: TODAY, config: { listUrls: [KONZERTE], maxDetailPages: 0 } });
  assert.deepEqual(events.map((e) => e.title), ['Heute', 'Letzter Tag']);
});

test('mvp: Einzelseite ohne schema.org-Daten: die Terminblöcke der Seite liefern Tag, Uhrzeit und Ticketlink', async () => {
  const ohneLd = fx('mvp-detail-reihe.html').replace(/<script[\s\S]*?<\/script>/g, '');
  assert.ok(!/ld\+json/.test(ohneLd));
  const { events } = await holen(config, { ...LISTEN, [D_PIAF]: ohneLd });
  const piaf = finden(events, 'Piaf');
  assert.deepEqual(piaf.map((e) => e.start), ['2026-11-25T19:30:00+01:00', '2026-12-10T19:30:00+01:00']);
  assert.ok(piaf.every((e) => e.hasTime && /eventim\.de/.test(e.ticketUrl)));
  assert.equal(piaf[0].placeName, 'Schauspielhaus, Dresden'); // Ort der Liste
});

test('mvp: fällt eine Einzelseite aus, bleibt der Termin mit den Angaben der Liste', async () => {
  const { events } = await holen(config, { ...LISTEN, ...DETAILS, [D_AFROB]: undefined });
  const [afrob] = finden(events, 'Afrob & Ferris MC');
  assert.equal(afrob.hasTime, false);
  assert.equal(afrob.start, '2026-11-26T00:00:00+01:00');
  assert.match(afrob.ticketUrl, /eventim\.de/);
});

test('mvp: eine ausgefallene Kategorieseite stoppt die übrigen nicht', async () => {
  const seiten = { ...LISTEN, ...DETAILS };
  delete seiten[THEATER];
  const { events } = await holen(config, seiten);
  assert.ok(finden(events, 'Conny Ochs').length);
  assert.equal(finden(events, 'Woyzeck').length, 0);
});

test('mvp: bei HTTP 429 (Sperre wegen Last) endet der Lauf sofort und liefert, was schon da ist', async () => {
  let n = 0;
  const http = fakeHttp({ ...LISTEN, ...DETAILS }, (url) => {
    n += 1;
    if (n === 4) throw new HttpError(429, url);
  });
  const events = await fetchEvents({ http, today: TODAY, config });
  assert.equal(http.abgerufen.length, 4);
  assert.ok(events.length > 0);
});

test('mvp: bei 403 gleich zu Beginn gibt es keine weiteren Abrufe und einen Fehler', async () => {
  const http = { abgerufen: [], get: async (url) => { http.abgerufen.push(url); throw new HttpError(403, url); } };
  await assert.rejects(fetchEvents({ http, today: TODAY, config }), /HTTP 403/);
  assert.equal(http.abgerufen.length, 1);
});

test('mvp: verbietet die robots.txt die Liste, meldet die Quelle den Fehler', async () => {
  const http = { get: async (url) => { throw new RobotsDisallowedError(url); } };
  await assert.rejects(fetchEvents({ http, today: TODAY, config: { ...config, listUrls: [KONZERTE] } }), /robots\.txt/);
});

test('mvp: ohne Karten und ohne Fehler ist das Ergebnis leer', async () => {
  const events = await fetchEvents({ http: fakeHttp({ [KONZERTE]: liste([]) }), today: TODAY, config: { listUrls: [KONZERTE] } });
  assert.deepEqual(events, []);
});

test('mvp: gleicher Termin in zwei Kategorielisten wird nur einmal gelesen', async () => {
  const { events, http } = await holen({ ...config, maxDetailPages: 100 });
  const ids = events.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  const details = detailAdressen(http);
  assert.equal(new Set(details).size, details.length);
});
