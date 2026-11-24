import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagPlus, zaehleVeranstaltungen } from '../site/js/filter.js';
import { kurzTag, zeilenAus, zeilenNachTagen, serienText, istVoll } from '../site/js/serien.js';

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

const anTagen = (liste, extra = {}) => liste.map((tag) => t(tag, '10:00', extra));
const reihe = (von, n, schritt = 1) => Array.from({ length: n }, (_, i) => t(tagPlus(von, i * schritt)));
const text = (termine, naechster = termine[0]) => serienText(termine, naechster);

test('serienText: zwei oder drei Termine werden aufgezählt', () => {
  assert.equal(text(anTagen(['2026-11-28', '2026-11-29'])), 'auch So, 29. Nov.');
  const drei = anTagen(['2026-11-28', '2026-12-05', '2026-12-12']);
  assert.equal(text(drei), 'auch Sa, 5. Dez. und Sa, 12. Dez.');
  assert.equal(text(drei, drei[2]), 'auch Sa, 28. Nov. und Sa, 5. Dez.');
  assert.equal(text([t('2026-11-28', '10:00'), t('2026-11-28', '16:00')]), 'auch 16:00 Uhr');
  assert.equal(text([t('2026-11-28', '10:00'), t('2026-11-28', '16:00'), t('2026-11-29', '10:00')]), 'auch 16:00 Uhr und So, 29. Nov.');
});

test('serienText: ein zweiter Eintrag mit dem start des nächsten wird nicht als „auch“ genannt', () => {
  const a = t('2026-11-28'); const b = t('2026-11-29');
  assert.equal(serienText([a, b], { ...a, id: 'doppel' }), 'auch So, 29. Nov.');
});

test('serienText: täglich', () => {
  assert.equal(text(reihe('2026-11-26', 29)), 'täglich bis Do, 24. Dez. · 29 Termine');
});

test('serienText: fast täglich (an zwei Feiertagen zu)', () => {
  const termine = reihe('2026-11-26', 32).filter((e) => !['2026-12-24', '2026-12-25'].includes(e.start.slice(0, 10)));
  assert.equal(text(termine), 'fast täglich bis So, 27. Dez. · 30 Termine');
});

test('serienText: jeden Donnerstag, mit Lücken donnerstags', () => {
  const alle = reihe('2026-11-26', 13, 7);
  assert.equal(text(alle), 'jeden Donnerstag bis Do, 18. Feb. · 13 Termine');
  assert.equal(text(alle.filter((_, i) => i !== 4 && i !== 5)), 'donnerstags bis Do, 18. Feb. · 11 Termine');
});

test('serienText: zwei oder drei Wochentage, auch bei 60 % der Tage', () => {
  const frSo = ['2026-11-27', '2026-11-28', '2026-11-29', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-11', '2026-12-12', '2026-12-13'];
  assert.equal(text(anTagen(frSo)), 'freitags, samstags und sonntags bis So, 13. Dez. · 9 Termine');
  assert.equal(text(anTagen(frSo.slice(0, 6))), 'freitags, samstags und sonntags bis So, 6. Dez. · 6 Termine');
  assert.equal(text(anTagen(['2026-11-28', '2026-11-29', '2026-12-05', '2026-12-06'])), 'samstags und sonntags bis So, 6. Dez. · 4 Termine');
});

test('serienText: sonst Anzahl und Ende', () => {
  const lose = ['2026-11-26', '2026-11-28', '2026-12-01', '2026-12-02', '2026-12-04', '2026-12-06', '2026-12-08', '2026-12-10', '2026-12-12', '2026-12-13'];
  assert.equal(text(anTagen(lose)), '10 Termine bis So, 13. Dez.');
});

test('serienText: Ende ist der letzte Tag des letzten Termins', () => {
  const wochenenden = ['2026-11-27', '2026-12-04', '2026-12-11', '2026-12-18'].map((tag) => t(tag, '16:00', { end: `${tagPlus(tag, 2)}T20:00:00+01:00` }));
  assert.equal(text(wochenenden), 'jeden Freitag bis So, 20. Dez. · 4 Termine');
});

test('serienText: alle Termine am selben Tag sind nie „täglich“', () => {
  assert.equal(text(['10:00', '12:00', '14:00', '16:00'].map((zeit) => t('2026-11-28', zeit))), '4 Termine an diesem Tag');
});

test('serienText: wöchentlich über Jahreswechsel und Zeitumstellung', () => {
  assert.equal(text(reihe('2026-12-19', 4, 7)), 'jeden Samstag bis Sa, 9. Jan. · 4 Termine');
  const umstellung = [['2027-03-20', '+01:00'], ['2027-03-27', '+01:00'], ['2027-04-03', '+02:00'], ['2027-04-10', '+02:00']]
    .map(([tag, versatz]) => t(tag, '10:00', { start: `${tag}T10:00:00${versatz}` }));
  assert.equal(text(umstellung), 'jeden Samstag bis Sa, 10. Apr. · 4 Termine');
});

test('serienText: volle Terminliste nennt keine Anzahl und sagt „mindestens bis“', () => {
  const voll = (liste) => liste.map((e, i) => (i === liste.length - 1 ? { ...e, terminlisteVoll: true } : e));
  assert.equal(istVoll(reihe('2026-12-17', 30)), false);
  assert.equal(istVoll(voll(reihe('2026-12-17', 30))), true);
  assert.equal(text(voll(reihe('2026-12-17', 30))), 'täglich, mindestens bis Fr, 15. Jan.');
  assert.equal(text(voll(reihe('2026-11-26', 8, 7))), 'jeden Donnerstag, mindestens bis Do, 14. Jan.');
  assert.equal(text(voll(reihe('2026-11-26', 8, 7).filter((_, i) => i !== 3))), 'donnerstags, mindestens bis Do, 14. Jan.');
  assert.equal(text(voll(anTagen(['2026-11-28', '2026-11-29', '2026-12-05', '2026-12-06']))), 'samstags und sonntags, mindestens bis So, 6. Dez.');
  const fast = reihe('2026-12-15', 32).filter((e) => !['2026-12-24', '2026-12-25'].includes(e.start.slice(0, 10)));
  assert.equal(text(voll(fast)), 'fast täglich, mindestens bis Fr, 15. Jan.');
  const lose = anTagen(['2026-12-26', '2026-12-28', '2026-12-31', '2027-01-01', '2027-01-03', '2027-01-05', '2027-01-07', '2027-01-09', '2027-01-11', '2027-01-15']);
  assert.equal(text(voll(lose)), 'Termine mindestens bis Fr, 15. Jan.');
  assert.equal(text(voll(anTagen(['2026-11-28', '2026-11-29']))), 'auch So, 29. Nov.');
});

test('die Zahl am Knopf ist die Zahl der Zeilen', () => {
  const alle = [t('2026-11-28', '19:00', { id: 'e', serie: null }), ...tage('2026-11-26', 4), ...tage('2026-11-26', 2).map((e) => ({ ...e, id: `b${e.id}`, serie: 's2' }))];
  assert.equal(zaehleVeranstaltungen(alle), 3);
  assert.equal(zeilenAus(alle, alle, HEUTE).length, 3);
});
