import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagPlus } from '../site/js/filter.js';
import { kurzTag, zeilenAus, zeilenNachTagen } from '../site/js/serien.js';

const HEUTE = '2026-11-24';
const t = (tag, zeit = '10:00', extra = {}) => ({
  id: `${tag}-${zeit}`, title: 'Markt', start: `${tag}T${zeit}:00+01:00`, end: null, hasTime: true,
  placeName: 'Dresden', rubrik: 'markt', serie: 's1', ticketStatus: null, ...extra,
});
const tage = (von, n) => Array.from({ length: n }, (_, i) => t(tagPlus(von, i)));
const startTage = (liste) => liste.map((e) => e.start.slice(0, 10));

test('kurzTag', () => {
  assert.equal(kurzTag('2026-11-26'), 'Do, 26. Nov.');
  assert.equal(kurzTag('2027-01-15'), 'Fr, 15. Jan.');
});

test('zeilenAus: Serie einmal, angeführt vom frühesten passenden Termin; termine sind alle ab heute', () => {
  const einzel = t('2026-11-28', '19:00', { id: 'e', serie: null, title: 'Konzert' });
  const serie = tage('2026-11-26', 4); // Do bis So
  const zeilen = zeilenAus([einzel, serie[2], serie[3]], [einzel, ...serie], HEUTE);
  assert.equal(zeilen.length, 2);
  const s = zeilen.find((z) => z.termine);
  assert.equal(s.ev, serie[2]);
  assert.deepEqual(startTage(s.termine), ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  assert.deepEqual(zeilen.find((z) => !z.termine), { ev: einzel, termine: null });
});

test('zeilenAus: abgesagt oder verlegt führt nicht an, solange ein anderer passt; ausverkauft schon', () => {
  const [a, b, c] = tage('2026-11-26', 3);
  for (const status of ['abgesagt', 'verlegt']) {
    const a2 = { ...a, ticketStatus: status };
    assert.equal(zeilenAus([a2, b, c], [a2, b, c], HEUTE)[0].ev, b);
    const b2 = { ...b, ticketStatus: status };
    assert.equal(zeilenAus([a2, b2], [a2, b2, c], HEUTE)[0].ev, a2, 'alle passenden abgesagt: der früheste');
  }
  const voll = { ...a, ticketStatus: 'ausverkauft' };
  assert.equal(zeilenAus([voll, b], [voll, b, c], HEUTE)[0].ev, voll);
});

test('zeilenAus: Vergangenes zählt nicht; bleibt nur ein Termin, ist es ein Einzeltermin', () => {
  const alle = [t('2026-11-22'), t('2026-11-23'), t('2026-11-24')];
  assert.deepEqual(zeilenAus([alle[2]], alle, HEUTE), [{ ev: alle[2], termine: null }]);
});

test('zeilenAus: gleicher start nur einmal, der erste gilt', () => {
  const a = t('2026-11-26'); const doppel = { ...a, id: 'doppel' }; const b = t('2026-11-27');
  const [z] = zeilenAus([a, doppel, b], [a, doppel, b], HEUTE);
  assert.equal(z.ev, a);
  assert.deepEqual(z.termine, [a, b]);
});

// Review Focus 5
test('zeilenAus: fällt der erste von zwei gleichen Einträgen durch einen Filter, bleibt eine Zeile', () => {
  const a = t('2026-11-26'); const doppel = { ...a, id: 'doppel' }; const b = t('2026-11-27');
  const zeilen = zeilenAus([doppel, b], [a, doppel, b], HEUTE);
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].ev, doppel);
  assert.equal(zeilen[0].termine.length, 2);
});

// Review Focus 1
test('zeilenAus: alte Daten ohne Feld serie sind lauter Einzeltermine', () => {
  const alt = tage('2026-11-26', 3).map(({ serie, ...rest }) => rest);
  assert.deepEqual(zeilenAus(alt, alt, HEUTE), alt.map((ev) => ({ ev, termine: null })));
  const leer = tage('2026-11-26', 2).map((e) => ({ ...e, serie: '' }));
  assert.equal(zeilenAus(leer, leer, HEUTE).length, 2);
});

test('zeilenAus: zwei Serien bleiben getrennt', () => {
  const a = tage('2026-11-26', 2); const b = tage('2026-11-26', 2).map((e) => ({ ...e, id: `b${e.id}`, serie: 's2' }));
  assert.equal(zeilenAus([...a, ...b], [...a, ...b], HEUTE).length, 2);
});

test('zeilenNachTagen: die Serie steht einmal, unter dem Tag ihres nächsten Termins, nach Startzeit eingereiht', () => {
  const serie = tage('2026-11-27', 3); // Fr bis So, 10 Uhr
  const frueh = t('2026-11-27', '08:00', { id: 'f', serie: null });
  const sa = t('2026-11-28', '19:00', { id: 's', serie: null });
  const gruppen = zeilenNachTagen(zeilenAus([sa, ...serie, frueh], [sa, ...serie, frueh], HEUTE), HEUTE);
  assert.deepEqual(gruppen.map((g) => g.day), ['2026-11-27', '2026-11-28']);
  assert.deepEqual(gruppen[0].zeilen.map((z) => z.ev.id), ['f', serie[0].id]);
  assert.deepEqual(gruppen[1].zeilen.map((z) => z.ev.id), ['s']);
});

// Review Focus 4
test('ein schon laufender mehrtägiger Termin führt die Serie an und steht unter heute', () => {
  const laeuft = t('2026-11-20', '16:00', { end: '2026-11-29T20:00:00+01:00' });
  const spaeter = t('2026-12-04', '16:00', { end: '2026-12-06T20:00:00+01:00' });
  const zeilen = zeilenAus([laeuft, spaeter], [laeuft, spaeter], HEUTE);
  assert.equal(zeilen[0].ev, laeuft);
  assert.deepEqual(zeilen[0].termine, [laeuft, spaeter]);
  assert.deepEqual(zeilenNachTagen(zeilen, HEUTE).map((g) => g.day), [HEUTE]);
});
