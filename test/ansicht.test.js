import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ansichtVon, ansichtNachPopstate, filterAendernPerZurueck, fensterZustand } from '../site/js/ansicht.js';

const LISTE = { ansicht: 'liste' };

test('ansichtVon: nur ansicht:liste zeigt die Liste', () => {
  assert.equal(ansichtVon(LISTE), 'liste');
  assert.equal(ansichtVon({ ansicht: 'liste', fenster: true }), 'liste');
  assert.equal(ansichtVon(null), 'filter');
  assert.equal(ansichtVon(undefined), 'filter');
  assert.equal(ansichtVon({ fenster: true }), 'filter');
  assert.equal(ansichtVon({ ansicht: 'etwas' }), 'filter');
  assert.equal(ansichtVon('liste'), 'filter');
});

test('Liste → Detail → Zurück: bleibt auf der Liste', () => {
  // Zurück aus dem Fenster landet auf dem Listeneintrag; das Fenster war offen
  assert.equal(ansichtNachPopstate(LISTE, true, 'liste'), 'liste');
  // auch wenn das Fenster per X geschlossen wurde und das folgende history.back() ohne offenes Fenster ankommt
  assert.equal(ansichtNachPopstate(LISTE, false, 'liste'), 'liste');
});

test('Liste → Zurück: Filterseite', () => {
  assert.equal(ansichtNachPopstate(null, false, 'liste'), 'filter');
});

test('Filterseite → Über → Zurück: Filterseite', () => {
  assert.equal(ansichtNachPopstate(null, true, 'filter'), 'filter');
  assert.equal(ansichtNachPopstate(null, false, 'filter'), 'filter');
});

test('Vorwärts nach Zurück: Listeneintrag zeigt wieder die Liste, ein Fenstereintrag die Ansicht darunter', () => {
  assert.equal(ansichtNachPopstate(LISTE, false, 'filter'), 'liste');
  assert.equal(ansichtNachPopstate(fensterZustand(LISTE), false, 'filter'), 'liste');
  assert.equal(ansichtNachPopstate(fensterZustand(null), false, 'liste'), 'filter');
});

test('ein offenes Fenster hält die Ansicht, egal welcher Zustand kommt', () => {
  assert.equal(ansichtNachPopstate(null, true, 'liste'), 'liste');
  assert.equal(ansichtNachPopstate(LISTE, true, 'filter'), 'filter');
});

test('fensterZustand trägt die Ansicht darunter mit und ändert das Original nicht', () => {
  const vorher = { ansicht: 'liste' };
  assert.deepEqual(fensterZustand(vorher), { ansicht: 'liste', fenster: true });
  assert.deepEqual(vorher, { ansicht: 'liste' });
  assert.deepEqual(fensterZustand(null), { fenster: true });
  assert.deepEqual(fensterZustand('x'), { fenster: true });
});

test('Filter ändern: history.back() nur auf dem Listeneintrag selbst', () => {
  assert.equal(filterAendernPerZurueck(LISTE), true);
  assert.equal(filterAendernPerZurueck(null), false);
  assert.equal(filterAendernPerZurueck({ fenster: true }), false);
  assert.equal(filterAendernPerZurueck(fensterZustand(LISTE)), false);
});

test('zusammenfassungMitSuche hängt eine nicht leere Suche in deutschen Anführungszeichen an', async () => {
  const { zusammenfassungMitSuche } = await import('../site/js/ansicht.js');
  assert.equal(zusammenfassungMitSuche('Alle Termine', ''), 'Alle Termine');
  assert.equal(zusammenfassungMitSuche('Alle Termine', '   '), 'Alle Termine');
  assert.equal(zusammenfassungMitSuche('Alle Termine', ' Rock '), 'Alle Termine · „Rock“');
  assert.equal(zusammenfassungMitSuche('Alle Termine', undefined), 'Alle Termine');
});
