import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zaehleVorherNachher } from '../scripts/serien-pruefen.js';

const JETZT = '2026-11-24T12:00:00+01:00';
const e = (id, tag, extra = {}) => ({ id, title: id, art: 'sonstiges', tags: [], start: `${tag}T10:00:00+01:00`, end: null, hasTime: true, placeName: 'Pirna', distanceKm: 20, country: 'DE', serie: null, ...extra });

test('zaehleVorherNachher: Einzeltermine vorher, Veranstaltungen nachher, Serien mit mindestens zwei aktuellen Einträgen', () => {
  const r = zaehleVorherNachher([
    e('m1', '2026-11-23', { rubrik: 'markt', serie: 's1' }), // vergangen
    e('m2', '2026-11-25', { rubrik: 'markt', serie: 's1' }),
    e('m3', '2026-11-26', { rubrik: 'markt', serie: 's1' }),
    e('f1', '2026-11-22', { rubrik: 'fest', serie: 's2' }), // vergangen
    e('f2', '2026-11-27', { rubrik: 'fest', serie: 's2' }),
    e('k1', '2026-11-28', { rubrik: 'konzert' }),
  ], JETZT);
  const zeile = (key) => r.zeilen.find((z) => z.key === key);
  assert.deepEqual([zeile('markt').vorher, zeile('markt').nachher, zeile('markt').serien], [2, 1, 1]);
  assert.deepEqual([zeile('fest').vorher, zeile('fest').nachher, zeile('fest').serien], [1, 1, 0]);
  assert.equal(zeile('markt').name, 'Märkte');
  assert.deepEqual(r.gesamt, { vorher: 4, nachher: 3, serien: 1 });
  assert.equal(r.zeilen[0].key, 'markt');
});
