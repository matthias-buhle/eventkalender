import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ortskandidaten } from '../src/ortsname.js';

test('ortskandidaten: Spielstätte vor dem Komma fällt weg, der Ort danach bleibt', () => {
  assert.deepEqual(ortskandidaten('Turnhalle, Hainewalde'), { hauptort: 'Hainewalde', weitere: [] });
  assert.deepEqual(ortskandidaten('Pachterhof, Sohland a.d. Spree'), { hauptort: 'Sohland a.d. Spree', weitere: [] });
});

test('ortskandidaten: Komma im Namen der Spielstätte (in Anführungszeichen) stört nicht', () => {
  assert.deepEqual(ortskandidaten('Vereinsheim "Goldene Gans", Bertsdorf-Hörnitz'), { hauptort: 'Bertsdorf-Hörnitz', weitere: [] });
  assert.deepEqual(ortskandidaten('Festhalle "Am Storchennest", Großpostwitz'), { hauptort: 'Großpostwitz', weitere: [] });
});

test('ortskandidaten: Gemeinde / Ortsteil wird in Hauptort und weitere Namen getrennt, auch ohne Leerzeichen um den Schrägstrich', () => {
  assert.deepEqual(ortskandidaten('Ausstellungshalle, Kubschütz / Kreckwitz'), { hauptort: 'Kubschütz', weitere: ['Kreckwitz'] });
  assert.deepEqual(ortskandidaten('Turnhalle, Großharthau/Bühlau'), { hauptort: 'Großharthau', weitere: ['Bühlau'] });
  assert.deepEqual(ortskandidaten('Turnhalle, Reichenbach / Sohland a. Rotstein'), { hauptort: 'Reichenbach', weitere: ['Sohland a. Rotstein'] });
});

test('ortskandidaten: ohne Komma ist der ganze Name der Ort; Zusätze nach "a.d."/"a." mit Punkt bleiben im Namen', () => {
  assert.deepEqual(ortskandidaten('Messe Leipzig'), { hauptort: 'Messe Leipzig', weitere: [] });
  assert.deepEqual(ortskandidaten('Mehrzweckhalle, Schönau-Berzdorf a.d. Eigen / Schönau'), { hauptort: 'Schönau-Berzdorf a.d. Eigen', weitere: ['Schönau'] });
});
