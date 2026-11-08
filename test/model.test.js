import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';

const base = {
  sourceName: 'test',
  sourceId: '42',
  sourceUrl: 'https://example.org/42',
  title: 'Töpfermarkt Pulsnitz',
  start: '2026-11-14T10:00:00+01:00',
};

test('makeEvent wirft ohne title', () => {
  assert.throws(() => makeEvent({ ...base, title: '' }), /title/);
});

test('makeEvent wirft ohne start', () => {
  assert.throws(() => makeEvent({ ...base, start: undefined }), /start/);
});

test('makeEvent wirft ohne Quellenlink', () => {
  assert.throws(() => makeEvent({ ...base, sourceUrl: undefined }), /sources/);
});

test('makeEvent liefert stabile id für gleiche sourceName+sourceId', () => {
  const a = makeEvent(base);
  const b = makeEvent({ ...base, title: 'Anderer Titel' });
  assert.equal(a.id, b.id);
  assert.match(a.id, /^[0-9a-f]{40}$/);
  assert.notEqual(a.id, makeEvent({ ...base, sourceId: '43' }).id);
});

test('makeEvent setzt Standardwerte', () => {
  const e = makeEvent(base);
  assert.deepEqual(e.tags, []);
  assert.equal(e.needsReview, false);
  assert.equal(e.submittedBy, null);
  assert.equal(e.country, 'DE');
  assert.equal(e.art, 'sonstiges');
  assert.deepEqual(e.contact, { phone: null, url: null, email: null });
  assert.deepEqual(e.sources, [{ name: 'test', url: 'https://example.org/42' }]);
  assert.equal(e.ticketStatus, null);
  assert.equal('sourceId' in e, false);
});

test('makeEvent: genre ist standardmäßig null und wird sonst übernommen', () => {
  assert.equal(makeEvent(base).genre, null);
  assert.equal(makeEvent({ ...base, genre: 'jazz' }).genre, 'jazz');
});
