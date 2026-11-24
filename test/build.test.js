import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';
import { RADIUS_KM } from '../src/geo.js';
import { runAll, pruefeLauf, ortsliste, mitEntfernung, einordnen, fertigstellen, aussortiertText, MAX_UEBERNAHME_TAGE } from '../src/build.js';
import { versionsInfo, schreibeVersion } from '../src/version.js';

const NOW = new Date('2026-11-10T19:00:00Z'); // 20:00 Berlin, Dienstag 10.11.2026

let zaehler = 0;
function ev(over) {
  zaehler += 1;
  return makeEvent({
    sourceName: 'T', sourceId: String(zaehler), sourceUrl: 'https://t.example/x',
    title: 'Termin', start: '2026-11-14T10:00:00+01:00', placeName: 'Sebnitz',
    ...over,
  });
}
const quelle = (name, fn, config = {}) => ({ name, fetchEvents: fn, config });

test('eine werfende Quelle erzeugt status ok:false und stoppt die anderen nicht', async () => {
  const { events, status } = await runAll({
    now: NOW, http: {},
    sources: [
      quelle('kaputt', async () => { throw new Error('HTTP 403'); }),
      quelle('gut', async () => [ev({ title: 'Läuft' })]),
    ],
  });
  assert.equal(events.length, 1);
  const kaputt = status.find((s) => s.name === 'kaputt');
  assert.equal(kaputt.ok, false);
  assert.match(kaputt.error, /HTTP 403/);
  assert.equal(status.find((s) => s.name === 'gut').ok, true);
});

test('eine Quelle mit enabled:false wird nicht aufgerufen', async () => {
  let aufrufe = 0;
  const { status } = await runAll({
    now: NOW, http: {},
    sources: [quelle('aus', async () => { aufrufe++; return []; }, { enabled: false })],
  });
  assert.equal(aufrufe, 0);
  assert.equal(status.length, 0);
});

test('Ergebnis mit 0 Terminen von einer sonst ergiebigen Quelle wird als leere Antwort gemeldet', async () => {
  const { events, status } = await runAll({
    now: NOW, http: {},
    previousStatus: [{ name: 'q', ok: true, count: 12, error: null, lastOkAt: '2026-11-09T05:00:00.000Z' }],
    sources: [quelle('q', async () => [])],
  });
  assert.equal(events.length, 0);
  assert.equal(status[0].ok, false);
  assert.equal(status[0].error, 'leere Antwort');
  assert.equal(status[0].lastOkAt, '2026-11-09T05:00:00.000Z');
});

test('0 Termine von einer ohnehin kleinen Quelle ist kein Fehler', async () => {
  const { status } = await runAll({
    now: NOW, http: {},
    previousStatus: [{ name: 'q', ok: true, count: 2, error: null, lastOkAt: null }],
    sources: [quelle('q', async () => [])],
  });
  assert.equal(status[0].ok, true);
  assert.equal(status[0].count, 0);
});

test('Termine mit distanceKm > 75 werden entfernt, unbekannter Ort bleibt mit distanceKm null', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [
      ev({ title: 'Nah', placeName: 'Sebnitz' }),
      ev({ title: 'Weit', placeName: 'Cottbus' }),
      ev({ title: 'Unbekannt', placeName: 'Irgendwo im Nirgendwo' }),
      ev({ title: 'Ohne Ort', placeName: '' }),
    ])],
  });
  const titel = events.map((e) => e.title).sort();
  assert.deepEqual(titel, ['Nah', 'Ohne Ort', 'Unbekannt']);
  const nah = events.find((e) => e.title === 'Nah');
  assert.ok(nah.distanceKm >= 0 && nah.distanceKm < 5);
  assert.equal(nah.country, 'DE');
  assert.equal(events.find((e) => e.title === 'Unbekannt').distanceKm, null);
});

test('liefert der Adapter Koordinaten, wird daraus die Entfernung berechnet', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [
      ev({ title: 'Weit weg', placeName: 'Berlin', lat: 52.52, lon: 13.4 }),
      ev({ title: 'Nebenan', placeName: 'Irgendwo', lat: 50.95, lon: 14.3 }),
    ])],
  });
  assert.deepEqual(events.map((e) => e.title), ['Nebenan']);
});

test('tschechischer Ort bekommt country CZ', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [ev({ title: 'Koncert', placeName: 'Děčín' })])],
  });
  assert.equal(events[0].country, 'CZ');
});

test('Termin von heute 10:00 ohne Ende bleibt um 20:00 Berlin-Zeit erhalten, gestern verschwindet', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [
      ev({ title: 'Heute früh', start: '2026-11-10T10:00:00+01:00' }),
      ev({ title: 'Gestern', start: '2026-11-09T20:00:00+01:00' }),
      ev({ title: 'Mehrtägig', start: '2026-11-08T10:00:00+01:00', end: '2026-11-11T18:00:00+01:00' }),
    ])],
  });
  assert.deepEqual(events.map((e) => e.title).sort(), ['Heute früh', 'Mehrtägig']);
});

test('lastOkAt wird aus previousStatus übernommen, wenn die Quelle ausfällt, und bei Erfolg erneuert', async () => {
  const prev = [{ name: 'q', ok: true, count: 3, error: null, lastOkAt: '2026-11-09T05:00:00.000Z' }];
  const fail = await runAll({ now: NOW, http: {}, previousStatus: prev, sources: [quelle('q', async () => { throw new Error('x'); })] });
  assert.equal(fail.status[0].lastOkAt, '2026-11-09T05:00:00.000Z');
  const ok = await runAll({ now: NOW, http: {}, previousStatus: prev, sources: [quelle('q', async () => [ev({})])] });
  assert.equal(ok.status[0].lastOkAt, NOW.toISOString());
  assert.equal(ok.status[0].count, 1);
  assert.equal(ok.status[0].error, null);
});

// --- Übernahme bei Quellenausfall ---
const ROH_GUT = '2026-11-09T05:00:00.000Z'; // gestern, innerhalb der 14 Tage
const rohdatenVon = (name, events, lastOkAt = ROH_GUT) => ({ [name]: { lastOkAt, events } });

test('Erfolg: rohdaten hält je Quelle die Termine und den Zeitpunkt des Abrufs', async () => {
  const { rohdaten } = await runAll({ now: NOW, http: {}, sources: [quelle('q', async () => [ev({ title: 'A' }), ev({ title: 'B' })])] });
  assert.deepEqual(Object.keys(rohdaten), ['q']);
  assert.equal(rohdaten.q.lastOkAt, NOW.toISOString());
  assert.deepEqual(rohdaten.q.events.map((e) => e.title).sort(), ['A', 'B']);
});

test('Ausfall: Termine vom letzten guten Abruf bleiben stehen, Status meldet es', async () => {
  const alt = [ev({ title: 'Gestern geholt' })].map((e) => ({ ...e, distanceKm: 0 }));
  const { events, status, rohdaten } = await runAll({
    now: NOW, http: {},
    previousRohdaten: rohdatenVon('q', alt),
    sources: [quelle('q', async () => { throw new Error('HTTP 503'); })],
  });
  assert.deepEqual(events.map((e) => e.title), ['Gestern geholt']);
  assert.equal(status[0].ok, false);
  assert.match(status[0].error, /HTTP 503/);
  assert.equal(status[0].uebernommen, true);
  assert.equal(status[0].count, 1);
  assert.equal(status[0].lastOkAt, ROH_GUT);
  // der alte Stand bleibt als Grundlage für den nächsten Lauf erhalten, mit dem alten Zeitpunkt
  assert.equal(rohdaten.q.lastOkAt, ROH_GUT);
  assert.equal(rohdaten.q.events.length, 1);
});

test('Übernahme: alte Termine im alten Format werden neu eingeordnet (Rubrik, Sorte, Advent)', async () => {
  // Stand vor dieser Version: kein rubrik, kein advent; außerdem ein veralteter Wert, der neu berechnet werden muss
  const altFormat = { ...ev({ title: 'Weihnachtskonzert', art: 'konzert' }), distanceKm: 0 };
  delete altFormat.rubrik;
  delete altFormat.advent;
  const veraltet = { ...ev({ title: 'Lesung im Rathaus', art: 'sonstiges' }), distanceKm: 0, rubrik: 'konzert', advent: true };
  const { events, rohdaten } = await runAll({
    now: NOW, http: {},
    previousRohdaten: rohdatenVon('q', [altFormat, veraltet]),
    sources: [quelle('q', async () => { throw new Error('HTTP 503'); })],
  });
  const konzert = events.find((e) => e.title === 'Weihnachtskonzert');
  assert.equal(konzert.rubrik, 'konzert');
  assert.equal(konzert.advent, true);
  assert.ok('genre' in konzert);
  const lesung = events.find((e) => e.title === 'Lesung im Rathaus');
  assert.equal(lesung.advent, false);
  assert.notEqual(lesung.rubrik, 'konzert');
  assert.equal(rohdaten.q.events.find((e) => e.title === 'Weihnachtskonzert').rubrik, 'konzert', 'auch die Grundlage für den nächsten Lauf');
});

test('unerwartet leere Antwort zählt wie ein Ausfall: die alten Termine bleiben', async () => {
  const { events, status } = await runAll({
    now: NOW, http: {},
    previousStatus: [{ name: 'q', ok: true, count: 12, error: null, lastOkAt: ROH_GUT }],
    previousRohdaten: rohdatenVon('q', [ev({ title: 'Bleibt' })]),
    sources: [quelle('q', async () => [])],
  });
  assert.deepEqual(events.map((e) => e.title), ['Bleibt']);
  assert.equal(status[0].error, 'leere Antwort');
  assert.equal(status[0].uebernommen, true);
});

test('Übernahme: vorbeigegangene Termine fallen weg, nur der Rest bleibt', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    previousRohdaten: rohdatenVon('q', [ev({ title: 'Vorbei', start: '2026-11-08T10:00:00+01:00' }), ev({ title: 'Kommt', start: '2026-11-20T10:00:00+01:00' })]),
    sources: [quelle('q', async () => { throw new Error('x'); })],
  });
  assert.deepEqual(events.map((e) => e.title), ['Kommt']);
});

test('Übernahme endet nach 14 Tagen ohne guten Abruf', async () => {
  const lauf = (lastOkAt) => runAll({
    now: NOW, http: {},
    previousRohdaten: rohdatenVon('q', [ev({ title: 'Alt' })], lastOkAt),
    sources: [quelle('q', async () => { throw new Error('x'); })],
  });
  const gerade = await lauf(new Date(NOW.getTime() - MAX_UEBERNAHME_TAGE * 86_400_000).toISOString());
  assert.equal(gerade.events.length, 1);
  const zuAlt = await lauf(new Date(NOW.getTime() - MAX_UEBERNAHME_TAGE * 86_400_000 - 1000).toISOString());
  assert.equal(zuAlt.events.length, 0);
  assert.equal(zuAlt.status[0].uebernommen, undefined);
  assert.equal(zuAlt.status[0].count, 0);
  assert.deepEqual(zuAlt.rohdaten, {});
});

test('Übernahme: ohne gespeicherte Rohdaten oder mit kaputtem Eintrag passiert nichts Schlimmes', async () => {
  for (const previousRohdaten of [{}, { q: null }, { q: { lastOkAt: 'kaputt', events: [] } }, { q: { lastOkAt: ROH_GUT, events: 'x' } }, { q: { lastOkAt: ROH_GUT, events: [null, { title: 'ohne start' }] } }]) {
    const { events, status } = await runAll({ now: NOW, http: {}, previousRohdaten, sources: [quelle('q', async () => { throw new Error('x'); })] });
    assert.equal(events.length, 0);
    assert.equal(status[0].ok, false);
    assert.equal(status[0].uebernommen, undefined);
  }
});

test('Übernahme gilt nur für eingeschaltete Quellen: eine abgeschaltete Quelle (z. B. nach einem Nein) verschwindet sofort', async () => {
  const { events, status, rohdaten } = await runAll({
    now: NOW, http: {},
    previousRohdaten: rohdatenVon('aus', [ev({ title: 'Darf nicht bleiben' })]),
    sources: [quelle('aus', async () => { throw new Error('nie aufgerufen'); }, { enabled: false })],
  });
  assert.equal(events.length, 0);
  assert.equal(status.length, 0);
  assert.deepEqual(rohdaten, {});
});

test('Übernahme: alte Termine werden mit den frischen Terminen anderer Quellen zusammengeführt', async () => {
  const gleich = { title: 'Konzert', start: '2026-11-20T20:00:00+01:00', placeName: 'Sebnitz' };
  const { events } = await runAll({
    now: NOW, http: {},
    previousRohdaten: rohdatenVon('alt', [{ ...ev({ ...gleich, sourceName: 'Alt', sourceUrl: 'https://alt.example/1' }), distanceKm: 0 }]),
    sources: [
      quelle('alt', async () => { throw new Error('x'); }),
      quelle('neu', async () => [ev({ ...gleich, sourceName: 'Neu', sourceUrl: 'https://neu.example/1' })]),
    ],
  });
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].sources.map((s) => s.name).sort(), ['Alt', 'Neu']);
});

test('liefert ein Adapter Unsinn statt einer Liste, ist das ein Fehler dieser Quelle', async () => {
  const { status } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => ({ nix: 1 }))],
  });
  assert.equal(status[0].ok, false);
});

test('Dubletten verschiedener Quellen werden zusammengeführt', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [
      quelle('A', async () => [ev({ sourceName: 'A', sourceId: '1', sourceUrl: 'https://a.example/1' })]),
      quelle('B', async () => [ev({ sourceName: 'B', sourceId: '1', sourceUrl: 'https://b.example/1' })]),
    ],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].sources.length, 2);
});

test('pruefeLauf: ohne eine einzige gelieferte Quelle oder ohne Termine bricht der Lauf ab, damit der letzte gute Stand stehen bleibt', () => {
  const ok = { name: 'a', ok: true, count: 3, error: null, lastOkAt: 'x' };
  const fehl = { name: 'b', ok: false, count: 0, error: 'HTTP 403', lastOkAt: null };
  assert.throws(() => pruefeLauf({ events: [], status: [] }), /keine Quelle/);
  assert.throws(() => pruefeLauf({ events: [{}], status: [fehl] }), /keine Quelle/);
  assert.throws(() => pruefeLauf({ events: [], status: [ok] }), /keine Termine/);
  assert.doesNotThrow(() => pruefeLauf({ events: [{}], status: [ok, fehl] }));
});

test('status nennt Orte, die das Ortsverzeichnis nicht kennt (gelieferte Termine und vom Adapter verworfene), ohne Dubletten', async () => {
  const liefert = async () => {
    const liste = [ev({ title: 'Eins', placeName: 'Halle, Niemandsdorf' }), ev({ title: 'Zwei', placeName: 'Halle, Niemandsdorf' }), ev({ title: 'Drei', placeName: 'Sebnitz' })];
    liste.verworfeneOrte = ['Nirgendwo', 'Halle, Niemandsdorf'];
    return liste;
  };
  const { events, status } = await runAll({ now: NOW, http: {}, sources: [quelle('q', liefert)] });
  assert.equal(events.length, 3, 'Termine mit unbekanntem Ort bleiben sichtbar');
  assert.deepEqual(status[0].unbekannteOrte, ['Halle, Niemandsdorf', 'Nirgendwo']);
  const sauber = await runAll({ now: NOW, http: {}, sources: [quelle('r', async () => [ev({})])] });
  assert.deepEqual(sauber.status[0].unbekannteOrte, []);
});

test('ortsliste: genau 8 feste Mittelpunkte (Sebnitz als Standard), mit Name, Koordinaten und Land, nach Namen sortiert', () => {
  const liste = ortsliste();
  const namen = liste.map((o) => o.name);
  assert.deepEqual([...namen].sort(), ['Bautzen', 'Dresden', 'Děčín', 'Görlitz', 'Kamenz', 'Pirna', 'Sebnitz', 'Zittau'].sort());
  assert.deepEqual(namen, [...namen].sort((a, b) => a.localeCompare(b, 'de')));
  assert.deepEqual(Object.keys(liste[0]).sort(), ['country', 'lat', 'lon', 'name']);
  assert.equal(liste.find((o) => o.name === 'Děčín').country, 'CZ');
});

test('Unterart (genre): Konzerte bekommen ein Genre, Märkte und Schauen ihre Sorte, alle anderen Arten keins; unpassende Vorgaben fallen weg', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [
      ev({ title: 'Jazzabend im Club', art: 'konzert' }),
      ev({ title: 'Comedy-Show Live', art: 'sonstiges' }),
      ev({ title: 'Pirnaer Weihnachtsmarkt', art: 'markt' }),
      ev({ title: 'Kleintierschau Hainewalde', art: 'schau' }),
      ev({ title: 'Rock-Party', art: 'party' }),
      ev({ title: 'Stand-up-Abend', art: 'sonstiges', genre: 'comedy' }),
      ev({ title: 'Flohmarkt am Ring', art: 'markt', genre: 'jazz' }),
      ev({ title: 'Ohne Hinweis', art: 'konzert', genre: 'tiere' }),
    ])],
  });
  const von = (titel) => events.find((e) => e.title === titel).genre;
  assert.equal(von('Jazzabend im Club'), 'jazz');
  assert.equal(von('Comedy-Show Live'), null);
  assert.equal(von('Pirnaer Weihnachtsmarkt'), 'weihnachtsmarkt');
  assert.equal(von('Kleintierschau Hainewalde'), 'tiere');
  assert.equal(von('Rock-Party'), null);
  assert.equal(von('Stand-up-Abend'), null, 'Comedy ist kein Konzert-Genre mehr; ein Hinweis ohne passende Rubrik fällt weg');
  assert.equal(von('Flohmarkt am Ring'), 'troedel', 'ein Konzert-Genre bei einem Markt wird verworfen und neu bestimmt');
  assert.equal(von('Ohne Hinweis'), null);
});

test('Rubrik: anreichern setzt rubrik und genre aus rubrikUndGenre, art bleibt', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [
      ev({ title: 'Mühlen- und Bäckereiführung', art: 'sonstiges' }),
      ev({ title: 'Jazzabend im Club', art: 'konzert' }),
    ])],
  });
  const fuehrung = events.find((e) => e.title === 'Mühlen- und Bäckereiführung');
  assert.equal(fuehrung.rubrik, 'fuehrung');
  assert.equal(fuehrung.genre, 'brauerei');
  assert.equal(fuehrung.art, 'sonstiges');
  const konzert = events.find((e) => e.title === 'Jazzabend im Club');
  assert.equal(konzert.rubrik, 'konzert');
  assert.equal(konzert.genre, 'jazz');
});

test('versionsInfo: Nummer aus package.json, Commit auf 7 Zeichen gekürzt, ungültiger Commit entfällt', () => {
  const gebaut = '2026-11-10T14:23:31.511Z';
  assert.deepEqual(versionsInfo({ paket: { version: '1.4.0' }, sha: 'EC29751AB0123456789012345678901234567890', gebaut }), { version: '1.4.0', commit: 'ec29751', gebaut });
  assert.equal(versionsInfo({ paket: { version: '1.4.0' }, sha: 'kein commit', gebaut }).commit, null);
  assert.equal(versionsInfo({ paket: { version: '1.4.0' }, sha: undefined, gebaut }).commit, null);
  assert.equal(versionsInfo({ paket: {}, sha: null, gebaut }).version, '');
});

test('schreibeVersion: legt version.json im Zielordner an, mit Nummer aus package.json', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const ordner = await mkdtemp(join(tmpdir(), 'version-'));
  try {
    const outDir = pathToFileURL(join(ordner, 'data') + '/');
    const gebaut = '2026-11-10T16:00:00.000Z';
    const info = await schreibeVersion({ outDir, gebaut, sha: 'abcdef1234567' });
    const paket = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.deepEqual(info, { version: paket.version, commit: 'abcdef1', gebaut });
    assert.deepEqual(JSON.parse(await readFile(new URL('version.json', outDir), 'utf8')), info);
  } finally {
    await rm(ordner, { recursive: true, force: true });
  }
});

test('Weihnachtsmarkt Sebnitz bekommt advent, ein Sommerfest nicht', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [
      ev({ title: 'Weihnachtsmarkt Sebnitz', art: 'markt' }),
      ev({ title: 'Sommerfest', art: 'fest' }),
    ])],
  });
  assert.equal(events.find((e) => e.title === 'Weihnachtsmarkt Sebnitz').advent, true);
  assert.equal(events.find((e) => e.title === 'Sommerfest').advent, false);
});

test('Ort: placeName zuerst, dann der Titel; mit ortRegionKm bleibt es beim Regionsmittelpunkt', async () => {
  const BAUTZEN = { lat: 51.1809, lon: 14.4276 };
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [
      ev({ title: 'Stammtisch', placeName: 'Vereinsheim, Neusalza-Spremberg' }),
      ev({ title: 'Lokalschau Neusalza-Spremberg', placeName: 'Vereinsheim, Unbekanntdorf' }),
      ev({ title: 'Weihnachtsmarkt Dresden', placeName: 'Rathaus, Raum Bautzen', ...BAUTZEN, ortRegionKm: 30 }),
      ev({ title: 'Kegelabend', placeName: 'Vereinsheim, Unbekanntdorf' }),
    ])],
  });
  const von = (titel) => events.find((e) => e.title === titel);
  assert.equal(von('Stammtisch').lat, 51.0337);
  const schau = von('Lokalschau Neusalza-Spremberg');
  assert.equal(schau.lat, 51.0337);
  assert.equal(schau.lon, 14.5445);
  assert.ok(schau.distanceKm > 0 && schau.distanceKm < RADIUS_KM);
  const markt = von('Weihnachtsmarkt Dresden');
  assert.equal(markt.lat, BAUTZEN.lat);
  assert.equal(markt.ortRegionKm, 30);
  const kegeln = von('Kegelabend');
  assert.equal(kegeln.lat, null);
  assert.equal(kegeln.distanceKm, null);
  assert.equal(kegeln.ortRegionKm, null);
});

test('Ort aus dem Titel: ein Ort außerhalb des Umkreises (z. B. "Reise nach Berlin") wird nicht übernommen, der Termin bleibt sichtbar', async () => {
  const { events } = await runAll({
    now: NOW, http: {},
    sources: [quelle('q', async () => [ev({ title: 'Lesung: Reise nach Berlin', placeName: 'Vereinsheim, Unbekanntdorf' })])],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].lat, null);
  assert.equal(events[0].distanceKm, null);
});

test('mitEntfernung: setzt distanceKm aus lat/lon neu, null ohne Koordinaten', () => {
  const nah = mitEntfernung(ev({ lat: 51.1809, lon: 14.4276, distanceKm: 999 }));
  assert.ok(nah.distanceKm > 25 && nah.distanceKm < 30, String(nah.distanceKm));
  assert.equal(nah.distanceKm, Math.round(nah.distanceKm * 10) / 10, 'auf eine Nachkommastelle gerundet');
  assert.equal(nah.lat, 51.1809);
  assert.equal(mitEntfernung(ev({ lat: null, lon: null, distanceKm: 12 })).distanceKm, null);
});

test('einordnen ist wiederholbar und behält den Hinweis der Quelle', () => {
  const a = einordnen({ art: 'konzert', genre: 'jazz', title: 'X' });
  assert.equal(a.genre, 'jazz');
  assert.equal(a.genreQuelle, 'jazz');
  assert.deepEqual(einordnen(a), a);
  assert.deepEqual(einordnen(einordnen(a)), a);
  // altes gespeichertes Format: genre ist errechnet und zählt nicht als Hinweis der Quelle
  const b = einordnen({ art: 'konzert', rubrik: 'konzert', genre: 'klassik', title: 'Sommerhits live' });
  assert.equal(b.genreQuelle, null);
  assert.notEqual(b.genre, 'klassik');
});

test('übernommene Termine einer ausgefallenen Quelle behalten den Hinweis', async () => {
  const mit = { ...ev({ title: 'X', art: 'konzert', genre: 'jazz', rubrik: 'konzert' }), genreQuelle: 'jazz', distanceKm: 0 };
  const altFormat = { ...ev({ title: 'Y', art: 'konzert', rubrik: 'konzert', genre: 'klassik' }), distanceKm: 0 };
  const { events } = await runAll({
    now: NOW, http: {},
    previousRohdaten: rohdatenVon('q', [mit, altFormat]),
    sources: [quelle('q', async () => { throw new Error('HTTP 503'); })],
  });
  const x = events.find((e) => e.title === 'X');
  assert.equal(x.genre, 'jazz');
  assert.equal(x.genreQuelle, 'jazz');
  assert.equal(events.find((e) => e.title === 'Y').genreQuelle, null);
});

const NULLEN = { ladenoeffnung: 0, schulvorstellung: 0, gruppentreffen: 0 };

test('fertigstellen: ordnet neu ein, setzt die Sprache, sortiert aus, entfernt genreQuelle', () => {
  const eingang = [
    { art: 'konzert', genre: 'jazz', genreQuelle: 'jazz', rubrik: 'konzert', title: 'X', country: 'DE' },
    { art: 'sonstiges', rubrik: 'sonstiges', title: 'Kabarett „Der nackte Shakespeare 2“', country: 'CZ' },
    { art: 'sonstiges', title: 'Winter Werksverkauf' },
    { art: 'sonstiges', title: 'Trauercafe Bautzen' },
  ];
  const { events, aussortiert } = fertigstellen(eingang);
  assert.equal(events.length, 2);
  assert.equal(events[0].genre, 'jazz');
  assert.equal(events[0].sprache, null);
  assert.equal(events[1].sprache, 'cs');
  for (const e of events) assert.equal(Object.hasOwn(e, 'genreQuelle'), false);
  assert.deepEqual(aussortiert, { ladenoeffnung: 1, schulvorstellung: 0, gruppentreffen: 1 });
  assert.equal(events.length + 2, eingang.length);
});

test('fertigstellen: zweimal angewendet gleich einmal', () => {
  const f = fertigstellen([
    { art: 'konzert', genreQuelle: 'jazz', title: 'Jazzabend', country: 'DE' },
    { art: 'sonstiges', title: 'Kabarett', country: 'CZ' },
    { art: 'sonstiges', title: 'Markt in Sebnitz' },
  ]);
  assert.deepEqual(fertigstellen(f.events).events, f.events);
});

test('fertigstellen: leere Eingabe, kaputte Einträge, Summe stimmt', () => {
  assert.deepEqual(fertigstellen([]), { events: [], aussortiert: NULLEN });
  const eingang = [
    { art: 'sonstiges', title: 'Příběh bez překladu', country: 'CZ' },
    null, 'text', {}, { title: 42 },
    { art: 'sonstiges', title: 'Lagerverkauf' },
  ];
  const { events, aussortiert } = fertigstellen(eingang);
  const summe = Object.values(aussortiert).reduce((a, b) => a + b, 0);
  assert.equal(events.length + summe, eingang.length);
  assert.equal(summe, 1);
});

test('aussortiertText nennt alle drei Gründe', () => {
  assert.equal(
    aussortiertText({ ladenoeffnung: 12, schulvorstellung: 0, gruppentreffen: 0 }),
    'aussortiert: 12 Ladenöffnung, 0 Schulvorstellung, 0 Gruppentreffen',
  );
});
