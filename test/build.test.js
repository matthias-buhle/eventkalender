import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';
import { runAll, pruefeLauf, ortsliste } from '../src/build.js';

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

test('ortsliste: Name, Koordinaten und Land aller Orte im Umkreis, nach Namen sortiert, ohne Aliasse', () => {
  const liste = ortsliste();
  assert.ok(liste.length > 50);
  const sebnitz = liste.find((o) => o.name === 'Sebnitz');
  assert.deepEqual(Object.keys(sebnitz).sort(), ['country', 'lat', 'lon', 'name']);
  assert.deepEqual(liste.map((o) => o.name), [...liste.map((o) => o.name)].sort((a, b) => a.localeCompare(b, 'de')));
  assert.ok(!liste.some((o) => o.name === 'Ulm' || o.name === 'Berlin'), 'ferne Orte sind keine Mitte zur Auswahl');
});
