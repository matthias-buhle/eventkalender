import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CENTER, RADIUS_KM, distanceKm, resolvePlace } from '../src/geo.js';

const at = (name) => {
  const p = resolvePlace(name);
  assert.ok(p, `${name} nicht im Ortsverzeichnis`);
  return p;
};

test('Radius und Mittelpunkt sind wie im Konzept festgelegt', () => {
  assert.equal(RADIUS_KM, 75);
  assert.ok(Math.abs(CENTER.lat - 50.97) < 0.05 && Math.abs(CENTER.lon - 14.27) < 0.05);
});

test('distanceKm Sebnitz–Dresden zwischen 30 und 50', () => {
  const d = distanceKm(CENTER, at('Dresden'));
  assert.ok(d > 30 && d < 50, `war ${d}`);
});

test('distanceKm Sebnitz–Liberec zwischen 50 und 70', () => {
  const d = distanceKm(CENTER, at('Liberec'));
  assert.ok(d > 50 && d < 70, `war ${d}`);
});

test('distanceKm Sebnitz–Cottbus größer 75', () => {
  assert.ok(distanceKm(CENTER, at('Cottbus')) > 75);
});

test('Neustadt i. Sa. und Neustadt in Sachsen sind derselbe Ort', () => {
  assert.deepEqual(at('Neustadt i. Sa.'), at('Neustadt in Sachsen'));
});

test('Děčín liegt in Tschechien', () => {
  assert.equal(at('Děčín').country, 'CZ');
  assert.equal(at('Bautzen').country, 'DE');
});

test('Unbekannter Ort ergibt null', () => {
  assert.equal(resolvePlace('Ortunbekanntdorf'), null);
  assert.equal(resolvePlace(''), null);
});

test('Groß-/Kleinschreibung und Umlautschreibweise werden ignoriert', () => {
  assert.deepEqual(at('GÖRLITZ'), at('goerlitz'));
});

test('Zusätze wie "Dresden, Alter Schlachthof" werden auf den Ort zurückgeführt', () => {
  assert.equal(at('Dresden, Alter Schlachthof').name, at('Dresden').name);
});

test('resolvePlace: Dörfer der Oberlausitz aus den Quellen werden aufgelöst, ferne Messen liegen außerhalb des Radius', () => {
  for (const name of ['Turnhalle, Hainewalde', 'Ausstellungshalle, Kubschütz / Kreckwitz', 'Vereinsheim "Goldene Gans", Bertsdorf-Hörnitz', 'Turnhalle, Großharthau/Bühlau', 'VIA-Regia Haus, Reichenbach', 'Mehrzweckhalle, Schönau-Berzdorf a.d. Eigen / Schönau']) {
    const ort = resolvePlace(name);
    assert.ok(ort, name);
    assert.ok(distanceKm(CENTER, ort) <= RADIUS_KM, `${name}: ${distanceKm(CENTER, ort)} km`);
  }
  for (const name of ['Messe Leipzig', 'Messe Ulm', 'Wittenbergplatz, Berlin']) {
    assert.ok(distanceKm(CENTER, resolvePlace(name)) > RADIUS_KM, name);
  }
});
