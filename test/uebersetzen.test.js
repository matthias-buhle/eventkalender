import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';
import { uebersetzeTermine, deeplHost } from '../src/uebersetzen.js';

const HEUTE = '2026-11-10';
let zaehler = 0;
function ev(over) {
  zaehler += 1;
  return makeEvent({
    sourceName: 'T', sourceId: String(zaehler), sourceUrl: 'https://t.example/x',
    title: 'Termin', start: '2026-11-14T10:00:00+01:00', placeName: 'Děčín', country: 'CZ',
    ...over,
  });
}

/** Falscher DeepL-Server: antwortet mit "DE:" vor jedem Text und merkt sich die Anfragen. */
function falschesDeepl({ status = 200 } = {}) {
  const anfragen = [];
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    anfragen.push({ url, auth: opts.headers.Authorization, body });
    if (status !== 200) return { ok: false, status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ translations: body.text.map((t) => ({ text: `DE: ${t}` })) }) };
  };
  return { fetchImpl, anfragen };
}
const ohnePause = async () => {};

test('deeplHost: Gratis-Schlüssel (:fx) geht an den Free-Server, sonst an den Pro-Server', () => {
  assert.equal(deeplHost('abc:fx'), 'https://api-free.deepl.com');
  assert.equal(deeplHost('abc'), 'https://api.deepl.com');
});

test('übersetzt nur tschechische Termine; deutsche bleiben unberührt', async () => {
  const { fetchImpl, anfragen } = falschesDeepl();
  const de = ev({ title: 'Marktfest', country: 'DE', placeName: 'Sebnitz', description: 'Ein Fest' });
  const cz = ev({ title: 'Vánoční trh', description: 'Trh na náměstí' });
  const { events, stats } = await uebersetzeTermine([de, cz], { apiKey: 'k:fx', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(events[0].title, 'Marktfest');
  assert.equal(events[0].description, 'Ein Fest');
  assert.equal(events[1].title, 'DE: Vánoční trh');
  assert.equal(anfragen.length, 1);
  assert.deepEqual(anfragen[0].body.text, ['Vánoční trh', 'Trh na náměstí']);
  assert.equal(anfragen[0].body.source_lang, 'CS');
  assert.equal(anfragen[0].body.target_lang, 'DE');
  assert.equal(anfragen[0].auth, 'DeepL-Auth-Key k:fx');
  assert.equal(anfragen[0].url, 'https://api-free.deepl.com/v2/translate');
  assert.equal(stats.uebersetzt, 2);
});

test('der Originaltitel bleibt in der Beschreibung erhalten, wenn sich der Titel ändert', async () => {
  const { fetchImpl } = falschesDeepl();
  const { events } = await uebersetzeTermine([ev({ title: 'Vánoční trh', description: 'Trh' })],
    { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(events[0].description, 'Originaltitel: Vánoční trh – DE: Trh');
});

test('bleibt der Titel gleich (Eigenname), steht kein Originaltitel in der Beschreibung', async () => {
  const fetchImpl = async (url, opts) => {
    const { text } = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ translations: text.map((t) => ({ text: t === 'Rammstein' ? 'Rammstein' : `DE: ${t}` })) }) };
  };
  const { events } = await uebersetzeTermine([ev({ title: 'Rammstein', description: 'Koncert' })],
    { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(events[0].title, 'Rammstein');
  assert.equal(events[0].description, 'DE: Koncert');
});

test('ein Termin ohne Beschreibung wird trotzdem übersetzt', async () => {
  const { fetchImpl } = falschesDeepl();
  const { events } = await uebersetzeTermine([ev({ title: 'Koncert', description: null })],
    { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(events[0].title, 'DE: Koncert');
  assert.equal(events[0].description, 'Originaltitel: Koncert');
});

test('der Zwischenspeicher verhindert eine zweite Übersetzung desselben Textes', async () => {
  const { fetchImpl, anfragen } = falschesDeepl();
  const termine = () => [ev({ title: 'Vánoční trh', description: 'Trh' })];
  const erst = await uebersetzeTermine(termine(), { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(anfragen.length, 1);
  const zweit = await uebersetzeTermine(termine(), { apiKey: 'k', cache: erst.cache, heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(anfragen.length, 1, 'keine weitere Anfrage');
  assert.equal(zweit.stats.ausCache, 2);
  assert.equal(zweit.events[0].title, 'DE: Vánoční trh');
});

test('gleiche Texte mehrerer Termine werden nur einmal gesendet', async () => {
  const { fetchImpl, anfragen } = falschesDeepl();
  await uebersetzeTermine([ev({ title: 'Trh', description: null }), ev({ title: 'Trh', description: null })],
    { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.deepEqual(anfragen[0].body.text, ['Trh']);
});

test('ohne Schlüssel bleibt der Originaltext stehen und es gibt keine Anfrage', async () => {
  const { fetchImpl, anfragen } = falschesDeepl();
  const { events, stats } = await uebersetzeTermine([ev({ title: 'Vánoční trh' })], { apiKey: undefined, heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(events[0].title, 'Vánoční trh');
  assert.equal(anfragen.length, 0);
  assert.match(stats.fehler, /DEEPL_API_KEY/);
});

test('aufgebrauchtes Kontingent (456) wirft nicht und lässt das Original stehen, ohne zu wiederholen', async () => {
  const { fetchImpl, anfragen } = falschesDeepl({ status: 456 });
  const { events, stats } = await uebersetzeTermine([ev({ title: 'Vánoční trh' })], { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(events[0].title, 'Vánoční trh');
  assert.equal(anfragen.length, 1);
  assert.match(stats.fehler, /Kontingent/);
});

test('ein Serverfehler (503) wird einmal wiederholt', async () => {
  let n = 0;
  const fetchImpl = async (url, opts) => {
    n += 1;
    if (n === 1) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ translations: JSON.parse(opts.body).text.map((t) => ({ text: `DE: ${t}` })) }) };
  };
  const { events } = await uebersetzeTermine([ev({ title: 'Trh', description: null })], { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(n, 2);
  assert.equal(events[0].title, 'DE: Trh');
});

test('403: es wird einmal am anderen Server versucht und danach dort weitergemacht', async () => {
  const urls = [];
  const fetchImpl = async (url, opts) => {
    urls.push(url);
    if (url.startsWith('https://api.deepl.com')) return { ok: false, status: 403, json: async () => ({ message: 'Wrong endpoint' }) };
    return { ok: true, status: 200, json: async () => ({ translations: JSON.parse(opts.body).text.map((t) => ({ text: `DE: ${t}` })) }) };
  };
  const { events } = await uebersetzeTermine([ev({ title: 'Trh', description: null })], { apiKey: 'ohne-endung', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.deepEqual(urls, ['https://api.deepl.com/v2/translate', 'https://api-free.deepl.com/v2/translate']);
  assert.equal(events[0].title, 'DE: Trh');
});

test('403 an beiden Servern: die Meldung von DeepL steht im Hinweis, der Schlüssel nirgends', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ message: 'Forbidden' }) });
  const { events, stats } = await uebersetzeTermine([ev({ title: 'Trh' })], { apiKey: 'geheim-123:fx', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(events[0].title, 'Trh');
  assert.match(stats.fehler, /403 \(Forbidden\)/);
  assert.ok(!stats.fehler.includes('geheim'));
});

test('ein Netzfehler wirft nicht', async () => {
  const fetchImpl = async () => { throw new Error('ECONNRESET'); };
  const { events, stats } = await uebersetzeTermine([ev({ title: 'Trh' })], { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(events[0].title, 'Trh');
  assert.match(stats.fehler, /ECONNRESET/);
});

test('mehr als 50 Texte gehen in mehreren Anfragen hinaus', async () => {
  const { fetchImpl, anfragen } = falschesDeepl();
  const termine = Array.from({ length: 120 }, (_, i) => ev({ title: `Akce ${i}`, description: null }));
  const { stats } = await uebersetzeTermine(termine, { apiKey: 'k', heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.deepEqual(anfragen.map((a) => a.body.text.length), [50, 50, 20]);
  assert.equal(stats.uebersetzt, 120);
});

test('unbenutzte Einträge, die älter als 90 Tage sind, fallen aus dem Zwischenspeicher', async () => {
  const { fetchImpl } = falschesDeepl();
  const cache = {
    alt: { de: 'alt', zuletzt: '2026-06-01' },
    frisch: { de: 'frisch', zuletzt: '2026-11-01' },
  };
  const { cache: neu } = await uebersetzeTermine([], { apiKey: 'k', cache, heute: HEUTE, fetchImpl, sleep: ohnePause });
  assert.equal(neu.alt, undefined);
  assert.equal(neu.frisch.de, 'frisch');
});
