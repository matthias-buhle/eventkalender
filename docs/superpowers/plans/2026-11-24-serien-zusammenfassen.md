# Serien zusammenfassen: Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Veranstaltung, die als Serie vorkommt (ein Eintrag je Tag oder Woche), steht in der Liste als eine Karte mit nächstem Termin und Rhythmus; Kacheln, Unterpunkte und Knopf zählen Veranstaltungen statt Einzeltermine.

**Architecture:** Der Datenlauf markiert Serien: `src/serien.js` setzt nach `fertigstellen` an jedem Termin das Feld `serie` (Kennung oder `null`); `events.json` bleibt eine Liste einzelner Termine. Die Seite fasst zusammen: `site/js/serien.js` (reine Funktionen) bildet aus gefilterten Terminen Zeilen und den Text der zweiten Zeile; `filter.js` zählt Serien einmal; `render.js` und `app.js` zeichnen Karte und Fenster. Alte Seite mit neuen Daten und neue Seite mit alten Daten funktionieren beide (Feld fehlt = Einzeltermin).

**Tech Stack:** Node 24, ES-Module, `node --test`, linkedom für DOM-Tests; Seite ohne Framework und ohne Build-Schritt.

**Spec:** `docs/superpowers/specs/2026-11-24-serien-zusammenfassen-design.md` (freigegeben am 24.11.2026). Wer baut, liest sie ganz.

## Global Constraints

- Kein Push, kein Merge, kein `npm run build` (fragt die Quellen im Netz ab). Kein Abruf im Netz überhaupt.
- Keine Handpflege: keine Listen einzelner Veranstaltungen, Titel, Orte oder Namen im Programm.
- Fremde Werte nur per `textContent`/`setAttribute`, nie `innerHTML`.
- Nicht anfassen: `docs/anfragen/`, `src/sources/index.js`, `sources.json`, alle Adapter außer `src/sources/satourn-api.js`, `src/rubriken.js`, `src/normalize.js`, `site/js/kalender.js`, `site/js/arten.js`.
- Die Adresscodes der Seite (`SITE_CODE`, `SITE_CODE_ADMIN`) nie ausgeben.
- Arbeitsbaum hat CRLF-Zeilenenden (Index LF); die git-Warnung dazu ist normal.
- Commits: nur genannte Dateien hinzufügen (nie `git add -A`, nie `git commit -a`); deutsche Nachricht mit `feat:`/`fix:`/`test:`/`docs:`; letzte Zeile `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Texte der Seite deutsch; Datumsform wie bisher („Do, 26. Nov.“).
- `npm test` ist nach jeder Aufgabe grün (Ausgang: 608 Tests).
- Serien-Grenzen aus der Spec: Lücke über **42** Tage trennt; Rubriken `theater` und `konzert` nie; „fast täglich“ ab **5** Tagen und **60 %**; Terminliste im Fenster zeigt **5**; volle Terminliste ab **30** Einträgen je Datensatz.

## Festlegungen des Plans (über die Spec hinaus)

1. **Reihenfolge der Rhythmus-Regeln:** Die Wochentagsformen („jeden Donnerstag“, „donnerstags“, „freitags, samstags und sonntags“) werden **vor** „fast täglich“ geprüft. Grund: Ein Markt Fr–So an zwei Wochenenden (6 von 10 Tagen = 60 %) hieße sonst „fast täglich“. Für alle Beispiele der Spec ändert das nichts.
2. **Alle Termine am selben Tag** (vier oder mehr, z. B. Führungen 10, 12, 14, 16 Uhr an einem einzigen Tag): „4 Termine an diesem Tag“ statt „täglich bis …“.
3. **`src/dedupe.js` bekommt eine Zeile:** `merge` trägt `terminlisteVoll` weiter, wenn einer der beiden Einträge es hat. Die Spec nennt die Datei „unverändert“; ohne die Zeile ginge die Markierung verloren, wenn derselbe Termin auch aus einer zweiten Quelle kommt.
4. **Kennung einer Serie:** `'s'` + die ersten 10 Hex-Zeichen von sha1 über `Titel|Ort|Rubrik|Unterpunkt|erster Starttag` (gefaltet wie beim Vergleich).
5. **`kurzTag`** („Do, 26. Nov.“) liegt in `site/js/serien.js`; `render.js` nutzt es statt seiner eigenen Funktion `kurz` (gleiche Ausgabe). So gibt es keinen Kreis-Import.
6. **Volle Terminliste bei zwei oder drei Terminen:** Aufzählung wie sonst („auch …“). Bei mehreren Wochentagen: „freitags und samstags, mindestens bis …“.
7. **Zählen der Spalte „Serien“ in der Abnahme:** Serien mit mindestens zwei noch aktuellen Einträgen (so hat die Probezählung der Spec gezählt).

## Review Focus

Was die Spec nahelegt, aber kein Beispiel der Spec prüft; je Zeile steht der Test in der genannten Aufgabe:

1. Alte Daten ohne Feld `serie` (zwischengespeicherte `events.json`): jede Zeile ein Einzeltermin, Zahlen wie bisher. → Aufgaben 3 und 5.
2. Wöchentliche Serie über Jahreswechsel und Zeitumstellung (27.3./3.4.2027, `+01:00` → `+02:00`): bleibt „jeden Samstag“; gerechnet wird mit Kalendertagen, nicht mit Millisekunden. → Aufgabe 4.
3. Alle Termine einer Serie am selben Tag: nie „täglich“. → Aufgabe 4.
4. Der nächste Termin läuft schon (mehrtägig, Start vor heute): Karte steht unter „Heute“, der Termin zählt zu den Terminen ab heute. → Aufgabe 3.
5. Zwei Einträge mit gleichem `start`, der erste fällt durch einen Filter (z. B. Suche): eine Zeile, kein Absturz, „auch …“ nennt den Tag nicht doppelt. → Aufgaben 3 und 4.

---

### Task 1: Serien im Datenlauf erkennen

**Files:**
- Create: `src/serien.js`, `test/serien.test.js`
- Modify: `src/build.js` (in `main`, direkt nach `const fertig = fertigstellen(uebersetzt);`), `src/model.js` (nur das `@typedef Event`: `serie:string|null` ergänzen)

**Interfaces:**
- Consumes: `fold`, `resolvePlace` aus `src/geo.js`; `createHash` aus `node:crypto`.
- Produces: `export const SERIEN_LUECKE_TAGE = 42;` `export const OHNE_SERIE = Object.freeze(['theater', 'konzert']);` `export function markiereSerien(events) → { events, serien, termine }`. `events`: neue Objekte in gleicher Reihenfolge, jedes mit `serie` (Zeichenkette oder `null`); die Eingabe bleibt unverändert. `serien`: Zahl der Serien, `termine`: Zahl der Einträge darin.

- [ ] **Step 1: Tests schreiben** (`test/serien.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent } from '../src/model.js';
import { markiereSerien, SERIEN_LUECKE_TAGE, OHNE_SERIE } from '../src/serien.js';

let nr = 0;
const ev = (tag, over = {}) => makeEvent({
  sourceName: 'A', sourceId: String(++nr), sourceUrl: 'https://a.example/', title: 'Striezelmarkt',
  start: `${tag}T10:00:00+01:00`, placeName: 'Altmarkt, Dresden', rubrik: 'markt', genre: 'weihnachtsmarkt', ...over,
});
const kennungen = (liste) => markiereSerien(liste).events.map((e) => e.serie);

test('gleicher Titel, Ort, Rubrik und Unterpunkt: eine Serie; alles andere bleibt null', () => {
  const out = markiereSerien([ev('2026-11-26'), ev('2026-11-27'), ev('2026-11-28', { title: 'Töpfermarkt' })]);
  const [a, b, c] = out.events.map((e) => e.serie);
  assert.match(a, /^s[0-9a-f]{10}$/);
  assert.equal(a, b);
  assert.equal(c, null);
  assert.deepEqual([out.serien, out.termine], [1, 2]);
});

test('Titel und Ort werden wie in dedupe verglichen (Schreibweise, Ortsteil)', () => {
  const [a, b] = kennungen([ev('2026-11-26', { title: 'STRIEZELMARKT!' }), ev('2026-11-27', { placeName: 'Dresden' })]);
  assert.ok(a && a === b);
});

test('gleicher Titel an zwei Orten: zwei Serien', () => {
  const [a, b, c, d] = kennungen([ev('2026-11-26'), ev('2026-11-27'), ev('2026-11-26', { placeName: 'Pirna' }), ev('2026-11-27', { placeName: 'Pirna' })]);
  assert.ok(a && c && a === b && c === d && a !== c);
});

test('Theater und Konzert bleiben einzeln', () => {
  assert.deepEqual(OHNE_SERIE, ['theater', 'konzert']);
  for (const rubrik of OHNE_SERIE) {
    assert.deepEqual(kennungen([ev('2026-11-26', { rubrik, genre: null }), ev('2026-11-27', { rubrik, genre: null })]), [null, null]);
  }
});

test('verschiedene Rubrik oder verschiedener Unterpunkt: keine Serie', () => {
  assert.deepEqual(kennungen([ev('2026-11-26'), ev('2026-11-27', { rubrik: 'fest' })]), [null, null]);
  assert.deepEqual(kennungen([ev('2026-11-26'), ev('2026-11-27', { genre: 'handwerk' })]), [null, null]);
});

test('Lücke: 42 Tage halten zusammen, 43 trennen; Teile mit einem Termin sind Einzeltermine', () => {
  assert.equal(SERIEN_LUECKE_TAGE, 42);
  const [a, b] = kennungen([ev('2026-11-26'), ev('2027-01-07')]); // 42 Tage
  assert.ok(a && a === b);
  assert.deepEqual(kennungen([ev('2026-11-26'), ev('2027-01-08')]), [null, null]); // 43 Tage
  const k = kennungen([ev('2026-11-26'), ev('2026-11-27'), ev('2027-11-25'), ev('2027-11-26'), ev('2028-06-01')]);
  assert.ok(k[0] === k[1] && k[2] === k[3] && k[0] !== k[2]);
  assert.equal(k[4], null);
});

test('ohne Ortsangabe nie eine Serie', () => {
  assert.deepEqual(kennungen([ev('2026-11-26', { placeName: '' }), ev('2026-11-27', { placeName: '  ' })]), [null, null]);
});

test('zwei Einträge mit gleichem start gehören zur selben Serie; Reihenfolge und Eingabe bleiben', () => {
  const liste = [ev('2026-11-27'), ev('2026-11-26'), ev('2026-11-26')];
  const out = markiereSerien(liste);
  assert.deepEqual(out.events.map((e) => e.id), liste.map((e) => e.id));
  assert.equal(new Set(out.events.map((e) => e.serie)).size, 1);
  assert.ok(liste.every((e) => !Object.hasOwn(e, 'serie')));
  assert.deepEqual([out.serien, out.termine], [1, 3]);
});

test('Quelle spielt keine Rolle', () => {
  const [a, b] = kennungen([ev('2026-11-26'), ev('2026-11-27', { sourceName: 'B', sourceUrl: 'https://b.example/' })]);
  assert.ok(a && a === b);
});
```

- [ ] **Step 2: `node --test test/serien.test.js`** → schlägt fehl (Modul fehlt).

- [ ] **Step 3: `src/serien.js` schreiben.** Schlüssel einer Gruppe: `fold(title)|fold(resolvePlace(placeName)?.name ?? placeName)|rubrik|genre ?? ''`. Übersprungen werden Termine mit `rubrik` in `OHNE_SERIE`, ohne `rubrik` oder mit leerem (getrimmtem) `placeName`. Je Gruppe nach `start` sortieren, an Lücken über `SERIEN_LUECKE_TAGE` trennen (Abstand der Starttage `start.slice(0, 10)`, als Kalendertage über `Date.UTC`), Ketten ab zwei Einträgen bekommen die Kennung nach Festlegung 4.

- [ ] **Step 4: In `src/build.js` einhängen.**

```js
  const fertig = fertigstellen(uebersetzt);
  // Letzter Schritt vor dem Schreiben: danach ändert nichts mehr Titel, Ort, Rubrik oder Unterpunkt.
  const markiert = markiereSerien(fertig.events);
  const events = markiert.events;
  console.log(aussortiertText(fertig.aussortiert));
  console.log(`Serien: ${markiert.serien} mit ${markiert.termine} Terminen`);
```

`rohdatenText` bleibt, wie es ist (ohne `serie`).

- [ ] **Step 5: `npm test`** → grün.

- [ ] **Step 6: Commit** `git add src/serien.js test/serien.test.js src/build.js src/model.js` · `feat: Datenlauf erkennt Serien und markiert sie (Feld serie)`

---

### Task 2: Volle Terminliste von Tourismus Sachsen markieren

**Files:**
- Modify: `src/sources/satourn-api.js` (`zuEvent`, `fetchApiEvents`), `src/model.js` (`makeEvent` und Typ: `terminlisteVoll`), `src/dedupe.js` (`merge`, eine Zeile)
- Test: `test/satourn-api.test.js`, `test/dedupe.test.js`, `test/model.test.js`

**Interfaces:**
- Produces: Jeder Event hat `terminlisteVoll: boolean` (Standard `false`). `export const TERMINE_JE_DATENSATZ = 30;` in `satourn-api.js`.

- [ ] **Step 1: Tests schreiben.**

`test/satourn-api.test.js`:

```js
test('terminlisteVoll: ab 30 Einträgen je Datensatz in der Antwort, darunter nicht', async () => {
  const reihe = (kennung, n) => Array.from({ length: n }, (_, i) => ({
    ...fixture[0], identifier: [kennung], name: kennung,
    startDate: `2026-12-${String(i + 1).padStart(2, '0')}T16:00:00+01:00`, endDate: undefined,
  }));
  const events = await lade({}, [...reihe('e_voll', 30), ...reihe('e_kurz', 29)]);
  assert.equal(mitTitel(events, 'e_voll').length, 30);
  assert.ok(mitTitel(events, 'e_voll').every((e) => e.terminlisteVoll === true));
  assert.equal(mitTitel(events, 'e_kurz').length, 29);
  assert.ok(mitTitel(events, 'e_kurz').every((e) => e.terminlisteVoll === false));
});

test('terminlisteVoll zählt die Antwort, nicht das Zeitfenster', async () => {
  // 30 Einträge, davon 10 vor dem Fenster (TODAY ist der 11.11.): die 20 übrigen sind trotzdem markiert.
  const body = Array.from({ length: 30 }, (_, i) => ({
    ...fixture[0], identifier: ['e_alt'], name: 'e_alt',
    startDate: `2026-11-${String(i + 1).padStart(2, '0')}T16:00:00+01:00`, endDate: undefined,
  }));
  const events = await lade({}, body);
  assert.equal(events.length, 20);
  assert.ok(events.every((e) => e.terminlisteVoll === true));
});
```

`test/dedupe.test.js`:

```js
test('terminlisteVoll bleibt beim Zusammenführen erhalten, egal von welcher Seite', () => {
  const a = ev({ sourceName: 'A', sourceId: '1' });
  const b = ev({ sourceName: 'B', sourceId: '2', sourceUrl: 'https://b.example/2', terminlisteVoll: true });
  assert.equal(dedupe([a, b])[0].terminlisteVoll, true);
  assert.equal(dedupe([b, a])[0].terminlisteVoll, true);
  assert.equal(dedupe([a, ev({ sourceName: 'B', sourceId: '3', sourceUrl: 'https://b.example/3' })])[0].terminlisteVoll, false);
});
```

`test/model.test.js`: ein Test, dass `makeEvent(...)` ohne Angabe `terminlisteVoll === false` liefert und mit `terminlisteVoll: true` den Wert `true`.

- [ ] **Step 2: Tests laufen lassen** → die neuen schlagen fehl.

- [ ] **Step 3: Umsetzen.** `makeEvent`: `terminlisteVoll: rest.terminlisteVoll === true`. `fetchApiEvents`: vor dem Filtern die Einträge von `body` je Datensatz zählen (Schlüssel wie `kennung` in `zuEvent`), `zuEvent(e, config, voll)` reicht `terminlisteVoll: voll` an `makeEvent`. `merge` in `dedupe.js`: `terminlisteVoll: a.terminlisteVoll === true || b.terminlisteVoll === true`. Bestehende Tests, die ganze Events vergleichen, bekommen das neue Feld.

- [ ] **Step 4: `npm test`** → grün.

- [ ] **Step 5: Commit** `git add src/sources/satourn-api.js src/model.js src/dedupe.js test/satourn-api.test.js test/dedupe.test.js test/model.test.js` · `feat: Tourismus Sachsen markiert volle Terminlisten (terminlisteVoll)`

---

### Task 3: Zeilen der Liste bilden

**Files:**
- Create: `site/js/serien.js`, `test/serien-seite.test.js`
- Modify: `site/sw.js` (`'js/serien.js'` in `GRUNDSTOCK`, `CACHE = 'eventkalender-v7'`), `site/js/render.js` (`kurz` durch importiertes `kurzTag` ersetzen)

**Interfaces:**
- Consumes: `lastDay`, `groupByDay` aus `site/js/filter.js`.
- Produces (alle aus `site/js/serien.js`, ohne `window`/`document`):
  - `kurzTag(tag: 'JJJJ-MM-TT') → 'Do, 26. Nov.'` (Ausgabe genau wie bisher `kurz` in `render.js`)
  - `zeilenAus(sichtbar, alle, heute) → Zeile[]` mit `Zeile = { ev, termine }`. `sichtbar`: Ergebnis von `applyFilters`; `alle`: alle geladenen Termine; `heute`: `JJJJ-MM-TT`. `ev`: der Einzeltermin bzw. der nächste Termin der Serie. `termine`: `null` für Einzeltermine und für Serien mit weniger als zwei Terminen ab heute; sonst alle Termine der Serie mit `lastDay >= heute`, nach `start` sortiert, gleicher `start` nur einmal (der erste in der Reihenfolge von `alle`).
  - `zeilenNachTagen(zeilen, fromDay) → { day, zeilen }[]`: wie `groupByDay`, maßgeblich ist `zeile.ev`.

Regeln für `ev` einer Serie: die Termine der Serie in `sichtbar`, nach `start` sortiert, gleicher `start` einmal; der erste ohne `ticketStatus` `abgesagt`/`verlegt`; gibt es keinen solchen, der früheste. Ein Termin gilt als Serientermin nur, wenn `serie` eine nichtleere Zeichenkette ist.

- [ ] **Step 1: Tests schreiben** (`test/serien-seite.test.js`)

```js
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
```

- [ ] **Step 2: `node --test test/serien-seite.test.js`** → schlägt fehl.
- [ ] **Step 3: `site/js/serien.js` schreiben** (Kopfkommentar: reine Funktionen, kein `window`/`document`); `render.js` auf `kurzTag` umstellen; `sw.js` anpassen.
- [ ] **Step 4: `npm test`** → grün (auch `test/sw.test.js` und `test/render.test.js`).
- [ ] **Step 5: Commit** `git add site/js/serien.js test/serien-seite.test.js site/js/render.js site/sw.js` · `feat: Seite bildet aus Terminen Zeilen (Einzeltermine und Serien)`

---

### Task 4: Text der zweiten Zeile

**Files:**
- Modify: `site/js/serien.js`, `test/serien-seite.test.js`

**Interfaces:**
- Consumes: `kurzTag`, `lastDay`, `tagPlus`.
- Produces: `serienText(termine, naechster) → string`. `termine`: wie in `Zeile.termine` (mindestens zwei); `naechster`: `Zeile.ev`. Außerdem `istVoll(termine) → boolean` (`termine.at(-1).terminlisteVoll === true`).

Regeln, die erste passende gilt. `n` = `termine.length`; „Tage“ = verschiedene Starttage; „Spanne“ = Kalendertage vom ersten bis zum letzten Starttag einschließlich; „Ende“ = `kurzTag(lastDay(termine.at(-1)))`; Wochentage als Kalendertag in UTC aus `start.slice(0, 10)`.

| # | Bedingung | Text | bei `istVoll` |
|---|---|---|---|
| 1 | `n` ≤ 3 | „auch A“ / „auch A und B“: die Termine, deren `start` nicht der von `naechster` ist, in zeitlicher Folge; liegt einer am Starttag von `naechster` und hat eine Uhrzeit: „16:00 Uhr“, sonst `kurzTag(Starttag)` | gleich |
| 2 | genau ein Tag | „4 Termine an diesem Tag“ | gleich |
| 3 | Tage = Spanne | „täglich bis Ende · n Termine“ | „täglich, mindestens bis Ende“ |
| 4 | ein Wochentag, alle Abstände der Tage genau 7 | „jeden Donnerstag bis Ende · n Termine“ | „jeden Donnerstag, mindestens bis Ende“ |
| 5 | ein Wochentag | „donnerstags bis Ende · n Termine“ | „donnerstags, mindestens bis Ende“ |
| 6 | zwei oder drei Wochentage | „freitags, samstags und sonntags bis Ende · n Termine“ (Reihenfolge Montag bis Sonntag; zwei: „samstags und sonntags“) | „…, mindestens bis Ende“ |
| 7 | Tage ≥ 5 und Tage / Spanne ≥ 0,6 | „fast täglich bis Ende · n Termine“ | „fast täglich, mindestens bis Ende“ |
| 8 | sonst | „n Termine bis Ende“ | „Termine mindestens bis Ende“ |

- [ ] **Step 1: Tests ergänzen** (`test/serien-seite.test.js`; `serienText`, `istVoll` in den Import)

```js
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

// Review Focus 5
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

// Review Focus 3
test('serienText: alle Termine am selben Tag sind nie „täglich“', () => {
  assert.equal(text(['10:00', '12:00', '14:00', '16:00'].map((zeit) => t('2026-11-28', zeit))), '4 Termine an diesem Tag');
});

// Review Focus 2
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
```

- [ ] **Step 2: Tests laufen lassen** → die neuen schlagen fehl.
- [ ] **Step 3: `serienText` und `istVoll` schreiben.** Abstände über Kalendertage (`Date.UTC` aus Jahr, Monat, Tag), nie über Zeitstempel.
- [ ] **Step 4: `npm test`** → grün. Schlägt ein erwarteter Text fehl, weil ein Datum im Test nicht zur Regel passt, wird das Datum im Test geprüft und berichtigt, nicht die Regel.
- [ ] **Step 5: Commit** `git add site/js/serien.js test/serien-seite.test.js` · `feat: Rhythmus, Ende und Anzahl einer Serie als Text`

---

### Task 5: Veranstaltungen zählen

**Files:**
- Modify: `site/js/filter.js` (`anzeigeText`, `zaehleRubriken`, `zaehleSorten`, neu `zaehleVeranstaltungen`), `site/js/filterseite.js` (Beschriftung der Kacheln, Zahl am Knopf), `site/js/ueber.js` (Absatz „Die Filterseite am Anfang …“)
- Test: `test/filter.test.js`, `test/filterseite.test.js`, `test/ort-navigation.test.js`, `test/serien-seite.test.js`

**Interfaces:**
- Produces: `zaehleVeranstaltungen(events) → number` in `filter.js`: Termine ohne Serie je 1, jede verschiedene `serie` (nichtleere Zeichenkette) 1. `anzeigeText(0|1|n)` → „Keine Veranstaltungen gefunden“ / „1 Veranstaltung anzeigen“ / „n Veranstaltungen anzeigen“. `zaehleRubriken`/`zaehleSorten`: gleiche Signatur, eine Serie zählt einmal.

- [ ] **Step 1: Tests schreiben und bestehende anpassen.**

`test/filter.test.js` (Import um `zaehleRubriken, zaehleSorten, zaehleVeranstaltungen` erweitern):

```js
test('zaehleVeranstaltungen: Einzeltermine je 1, jede Serie 1; ohne Feld serie alles einzeln', () => {
  const liste = [ev({ id: 'a' }), ev({ id: 'b', serie: null }), ev({ id: 'c', serie: 's1' }), ev({ id: 'd', serie: 's1' }), ev({ id: 'e', serie: 's2' })];
  assert.equal(zaehleVeranstaltungen(liste), 4);
  assert.equal(zaehleVeranstaltungen([ev({ id: 'a' }), ev({ id: 'b' })]), 2);
  assert.equal(zaehleVeranstaltungen([]), 0);
});

test('zaehleRubriken und zaehleSorten zählen eine Serie einmal, und nur wenn ein Termin im Zeitraum liegt', () => {
  const markt = (id, tag) => ev({ id, rubrik: 'markt', art: 'markt', genre: 'weihnachtsmarkt', serie: 's1', start: `${tag}T10:00:00+01:00` });
  const liste = [markt('m1', '2026-11-09'), markt('m2', '2026-11-10'), markt('m3', '2026-11-11'), ev({ id: 'k', rubrik: 'konzert' })];
  const alle = zaehleRubriken(liste, prefs(), NOW);
  assert.equal(alle.markt, 1);
  assert.equal(alle.konzert, 1);
  assert.equal(zaehleSorten(liste, prefs(), NOW).weihnachtsmarkt, 1);
  assert.equal(zaehleRubriken(liste, prefs({ zeit: 'heute' }), NOW).markt, 0);
  // alte Daten ohne Feld serie: wie bisher drei
  const alt = liste.map(({ serie, ...rest }) => rest);
  assert.equal(zaehleRubriken(alt, prefs(), NOW).markt, 3);
});
```

`test/serien-seite.test.js` (Import `zaehleVeranstaltungen` aus `filter.js`):

```js
test('die Zahl am Knopf ist die Zahl der Zeilen', () => {
  const alle = [t('2026-11-28', '19:00', { id: 'e', serie: null }), ...tage('2026-11-26', 4), ...tage('2026-11-26', 2).map((e) => ({ ...e, id: `b${e.id}`, serie: 's2' }))];
  assert.equal(zaehleVeranstaltungen(alle), 3);
  assert.equal(zeilenAus(alle, alle, HEUTE).length, 3);
});
```

`test/filterseite.test.js`: an allen Stellen `'1 Termin'` → `'1 Veranstaltung'`, `'N Termine'` → `'N Veranstaltungen'` in den `aria-label`-Erwartungen (Zeilen um 114–119), `'N Termine anzeigen'` → `'N Veranstaltungen anzeigen'`, `'1 Termin anzeigen'` → `'1 Veranstaltung anzeigen'`, `'Keine Termine gefunden'` → `'Keine Veranstaltungen gefunden'`. Die Texte „Termine werden geladen …“ und „Termine konnten nicht geladen werden“ bleiben. Dazu neu:

```js
test('Serien zählen als eine Veranstaltung: Kachel und Knopf', () => {
  const tage = ['2026-11-25', '2026-11-26', '2026-11-27'].map((tag) => ev({
    id: tag, title: 'Striezelmarkt', rubrik: 'markt', genre: 'weihnachtsmarkt', serie: 's1', start: `${tag}T10:00:00+01:00`,
  }));
  const { container } = aufbau({ zeit: 'alle' }, [...TERMINE, ...tage]);
  assert.equal(kachel(container, 'Märkte').getAttribute('aria-label'), 'Märkte, 2 Veranstaltungen');
  assert.equal(kachel(container, 'Märkte').querySelector('.kachel-zahl').textContent, '2');
  assert.equal(knopf(container).textContent, '6 Veranstaltungen anzeigen');
});
```

(Heißt die Klasse der Zahl in `filterseite.js` anders als `kachel-zahl`, gilt der Name dort.)

`test/ort-navigation.test.js` Zeilen 63–65: die drei neuen Texte von `anzeigeText`.

- [ ] **Step 2: Tests laufen lassen** → neue und angepasste schlagen fehl.
- [ ] **Step 3: Umsetzen.** `filterseite.js`: Beschriftung `` `${name}, ${zahl === 1 ? '1 Veranstaltung' : `${zahl} Veranstaltungen`}` ``; Knopf `anzeigeText(zaehleVeranstaltungen(applyFilters(events, prefs, jetzt, orte)))`. `ueber.js`, der Absatz wird zu:

  > Die Filterseite am Anfang grenzt mit Zeitraum, Rubrik, Ort und Umkreis ein, wie viele Veranstaltungen übrig bleiben, zeigt der Knopf unten. Was mehrmals stattfindet, etwa ein Weihnachtsmarkt an vielen Tagen oder ein Kurs jede Woche, steht als eine Veranstaltung mit ihrem nächsten Termin; Theater und Konzerte zeigen jede Vorstellung einzeln. In der Liste lässt sich mit der Suche weiter eingrenzen, bis nur noch passende Termine übrig sind; „Filter ändern“ führt zurück.

  Kommentare an den geänderten Funktionen nennen „Veranstaltungen“.
- [ ] **Step 4: `npm test`** → grün.
- [ ] **Step 5: Commit** `git add site/js/filter.js site/js/filterseite.js site/js/ueber.js test/filter.test.js test/filterseite.test.js test/ort-navigation.test.js test/serien-seite.test.js` · `feat: Kacheln, Unterpunkte und Knopf zählen Veranstaltungen`

---

### Task 6: Serienkarte und Liste

**Files:**
- Modify: `site/js/render.js` (`wannZeile`, `renderEventCard`), `site/js/app.js` (`zeichneListe`), `site/style.css`
- Test: `test/render.test.js`

**Interfaces:**
- Consumes: `zeilenAus`, `zeilenNachTagen`, `serienText` (Tasks 3, 4).
- Produces: `renderEventCard(doc, ev, { orte?, termine? })`: mit `termine` (Liste ab zwei Einträgen) eine Serienkarte: `p.when` beginnt mit „Nächster Termin: “, direkt danach `p.rhythmus` mit `serienText(termine, ev)`. Ohne `termine` (fehlt oder `null`) unverändert. `zeichneListe` ruft `beiOeffnen(zeile)` mit der ganzen Zeile `{ ev, termine }` und gibt die Zahl der Zeilen zurück.

- [ ] **Step 1: Tests schreiben** (`test/render.test.js`)

```js
const serienTage = (tage, extra = {}) => tage.map((tag) => ev({ id: tag, start: `${tag}T10:00:00+01:00`, end: `${tag}T21:00:00+01:00`, rubrik: 'markt', serie: 's1', ...extra }));

test('Serienkarte: „Nächster Termin: “ in der ersten Zeile, Rhythmus in der zweiten, dann der Ort', () => {
  const termine = serienTage(['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  const karte = renderEventCard(document, termine[0], { termine });
  assert.equal(karte.querySelector('.when').textContent, 'Nächster Termin: Do, 26. Nov., 10:00–21:00 Uhr');
  const zweite = karte.querySelector('.rhythmus');
  assert.equal(zweite.textContent, 'täglich bis So, 29. Nov. · 4 Termine');
  assert.equal(karte.querySelector('.when').nextElementSibling, zweite);
  assert.equal(zweite.nextElementSibling.getAttribute('class'), 'where');
});

test('Serienkarte: der Status des nächsten Termins steht in der ersten Zeile', () => {
  const termine = serienTage(['2026-11-26', '2026-11-27']);
  termine[1] = { ...termine[1], ticketStatus: 'ausverkauft' };
  const karte = renderEventCard(document, termine[1], { termine });
  assert.equal(karte.querySelector('.when .status-ausverkauft').textContent, 'ausverkauft');
  assert.equal(karte.querySelector('.rhythmus').textContent, 'auch Do, 26. Nov.');
});

test('ohne termine bleibt die Karte wie bisher, auch wenn der Termin eine Serienkennung trägt', () => {
  for (const optionen of [{}, { termine: null }]) {
    const karte = renderEventCard(document, ev({ serie: 's1' }), optionen);
    assert.equal(karte.querySelector('.when').textContent, 'Sa, 14. Nov., 19:00 Uhr');
    assert.equal(karte.querySelector('.rhythmus'), null);
  }
});

test('Serienkarte: fremde Werte bleiben Text', () => {
  const boese = '<img src=x onerror=alert(1)>';
  const termine = serienTage(['2026-11-26', '2026-11-27'], { title: boese, placeName: boese });
  const karte = renderEventCard(document, termine[0], { termine });
  assert.equal(karte.querySelectorAll('img').length, 0);
});
```

- [ ] **Step 2: Tests laufen lassen** → schlagen fehl.
- [ ] **Step 3: Umsetzen.** `render.js`: `wannZeile(doc, ev, vorsatz = '')`; die zweite Zeile als `p.rhythmus`. `app.js` `zeichneListe`: `zeilenAus(sichtbar, events, heute)`, Gruppen aus `zeilenNachTagen(zeilen, heute)`, Karte mit `{ ...optionen, termine: zeile.termine }`. `style.css`: `.card .rhythmus` wie `.card .where` (Zeile 186), `.detail .rhythmus` wie `.detail .where` (Zeile 149), jeweils mit dem kleinen Abstand der `where`-Zeile.
- [ ] **Step 4: `npm test`** → grün.
- [ ] **Step 5: Commit** `git add site/js/render.js site/js/app.js site/style.css test/render.test.js` · `feat: Serie als eine Karte mit nächstem Termin und Rhythmus`

---

### Task 7: Fenster „Einzelheiten“ mit Terminliste

**Files:**
- Modify: `site/js/render.js` (`renderDetail`), `site/js/app.js` (`zeigeDetail`), `site/style.css`
- Test: `test/render.test.js`

**Interfaces:**
- Consumes: `serienText`, `istVoll`.
- Produces: `renderDetail(doc, ev, { orte?, userAgent?, termine? })`. Mit `termine`: Kopf wie die Serienkarte (`p.when` mit Vorsatz, `p.rhythmus`); nach Beschreibung und Kürzungshinweis, vor den Knöpfen: `section.termine` mit `h3` „Termine“, `ul.terminliste` mit einem `li` je Termin (Text wie die Zeitangabe einer Karte, dazu der Status dieses Termins als `span.status.status-…`), ab dem sechsten `li` mit Attribut `hidden`; bei mehr als fünf Terminen ein `button.btn` „Alle n Termine zeigen“ (bei `istVoll`: „Alle bekannten Termine zeigen“), der beim Klick alle `hidden` entfernt und sich selbst. `zeigeDetail(zeile)` reicht `zeile.ev` und `zeile.termine` durch.

- [ ] **Step 1: Tests schreiben** (`test/render.test.js`; `tagPlus` aus `../site/js/filter.js` importieren)

```js
const langeSerie = (n, extra = {}) => Array.from({ length: n }, (_, i) => ev({ id: `t${i}`, start: `${tagPlus('2026-11-26', i)}T10:00:00+01:00`, rubrik: 'markt', serie: 's1', ...extra }));
const offen = (d) => [...d.querySelectorAll('.terminliste li')].filter((li) => !li.hasAttribute('hidden'));

test('Einzelheiten einer Serie: beide Zeitzeilen, Abschnitt „Termine“ mit fünf Zeilen, Knopf klappt alle auf', () => {
  const termine = langeSerie(29);
  termine[2] = { ...termine[2], ticketStatus: 'abgesagt' };
  const d = renderDetail(document, termine[0], { termine });
  assert.equal(d.querySelector('.when').textContent, 'Nächster Termin: Do, 26. Nov., 10:00 Uhr');
  assert.equal(d.querySelector('.rhythmus').textContent, 'täglich bis Do, 24. Dez. · 29 Termine');
  assert.equal(d.querySelector('.termine h3').textContent, 'Termine');
  assert.equal(d.querySelectorAll('.terminliste li').length, 29);
  assert.equal(offen(d).length, 5);
  assert.equal(offen(d)[0].textContent, 'Do, 26. Nov., 10:00 Uhr');
  assert.equal(offen(d)[2].querySelector('.status-abgesagt').textContent, 'abgesagt');
  assert.equal(d.querySelectorAll('.terminliste .status').length, 1);
  const knopf = d.querySelector('.termine button');
  assert.equal(knopf.textContent, 'Alle 29 Termine zeigen');
  knopf.click();
  assert.equal(offen(d).length, 29);
  assert.equal(d.querySelector('.termine button'), null);
});

test('Einzelheiten: bis fünf Termine kein Knopf; volle Terminliste heißt „Alle bekannten Termine zeigen“', () => {
  const fuenf = langeSerie(5);
  const d5 = renderDetail(document, fuenf[0], { termine: fuenf });
  assert.equal(offen(d5).length, 5);
  assert.equal(d5.querySelector('.termine button'), null);
  const voll = langeSerie(30);
  voll[29] = { ...voll[29], terminlisteVoll: true };
  assert.equal(renderDetail(document, voll[0], { termine: voll }).querySelector('.termine button').textContent, 'Alle bekannten Termine zeigen');
});

test('Einzelheiten: die Terminliste steht vor den Knöpfen; ohne termine gibt es sie nicht', () => {
  const termine = langeSerie(3);
  const d = renderDetail(document, termine[0], { termine });
  assert.equal(d.querySelector('.termine').nextElementSibling.getAttribute('class'), 'actions');
  assert.equal(renderDetail(document, ev()).querySelector('.termine'), null);
  assert.equal(renderDetail(document, ev(), { termine: null }).querySelector('.rhythmus'), null);
});

test('Einzelheiten: Zeilen der Terminliste sind reiner Text', () => {
  const termine = langeSerie(3);
  assert.equal(renderDetail(document, termine[0], { termine }).querySelectorAll('.terminliste a').length, 0);
});
```

- [ ] **Step 2: Tests laufen lassen** → schlagen fehl.
- [ ] **Step 3: Umsetzen.** Der Knopf bekommt `type="button"`. `style.css`: `.detail .termine` mit Abstand nach oben wie die Beschreibung, `.terminliste` ohne Listenpunkte und Einzug, Zeilen in der Größe der Ortszeile, Überschrift wie die übrigen kleinen Überschriften der Seite; Knopf mindestens 44 px hoch (wie die anderen Knöpfe).
- [ ] **Step 4: `npm test`** → grün.
- [ ] **Step 5: Commit** `git add site/js/render.js site/js/app.js site/style.css test/render.test.js` · `feat: Einzelheiten einer Serie zeigen die Terminliste`

---

### Task 8: Version, Prüfskript und Abnahme an echten Daten

**Files:**
- Create: `scripts/serien-pruefen.js`, `test/serien-pruefen.test.js`
- Modify: `package.json` und `package-lock.json` (Version `1.7.0`, beide Stellen in der Lock-Datei)

**Interfaces:**
- Consumes: `fertigstellen`, `ortsliste` aus `src/build.js`; `markiereSerien`; `applyFilters`, `zaehleRubriken`, `DEFAULT_PREFS` aus `site/js/filter.js`; `RUBRIKEN`, `rubrikVon` aus `site/js/arten.js`.
- Produces: `export function zaehleVorherNachher(events, nowIso) → { zeilen: { key, name, vorher, nachher, serien }[], gesamt: { vorher, nachher, serien } }`. Filter: `{ ...DEFAULT_PREFS, zeit: 'alle' }`. `vorher`: gefilterte Einzeltermine je Rubrik; `nachher`: `zaehleRubriken`; `serien`: Kennungen mit mindestens zwei gefilterten Einträgen. `zeilen`: alle 14 Rubriken aus `RUBRIKEN` (auch mit 0), nach `vorher` absteigend; `name` über `rubrikName`. Aufruf: `node scripts/serien-pruefen.js <events.json> [--jetzt <ISO-Zeit>] [--schreibe <Ordner>]` liest `{ events }`, ordnet mit `fertigstellen` neu ein, markiert mit `markiereSerien`, gibt die Tabelle als Markdown aus und schreibt mit `--schreibe` `events.json`, `status.json` (`sources: []`) und `places.json` in den Ordner. Kein Netz. Das Skript startet nur, wenn es direkt aufgerufen wird (wie `scripts/einsortierung-pruefen.js`).

- [ ] **Step 1: Test schreiben** (`test/serien-pruefen.test.js`)

```js
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
```

- [ ] **Step 2: Test laufen lassen** → schlägt fehl. **Step 3:** Skript schreiben, Version setzen. **Step 4:** `npm test` → grün.
- [ ] **Step 5: Commit** `git add scripts/serien-pruefen.js test/serien-pruefen.test.js package.json package-lock.json` · `feat: Serien zusammenfassen (1.7.0), Prüfskript für Vorher/Nachher`

- [ ] **Step 6: Zählung am Bestand.** `node scripts/serien-pruefen.js E:/ClaudeCode/Eventcalender/.superpowers/bestand-2026-11-23/events.json --jetzt 2026-11-24T12:00:00+01:00 --schreibe site/data` (der Ordner `site/data/` ist von git ausgenommen). Erwartet wird die Tabelle aus der Spec, Abschnitt „Tests und Abnahme“ (Gesamt 2593 → 1265, 162 Serien). Jede Abweichung wird Zeile für Zeile erklärt (bekannte Quellen: der Umkreisfilter 75 km und die Mitternachtsregel von `lastDay`, die die Probezählung nicht hatte); eine nicht erklärbare Abweichung ist ein Fehler und wird behoben.

- [ ] **Step 7: Liste im Browser prüfen** (Vorschau „site“ aus `.claude/launch.json`, Handybreite, hell und dunkel; kein Abruf im Netz):
  - Zeitraum „Alle Termine“, Rubrik Märkte: „Dresdner Striezelmarkt“ steht einmal, mit „Nächster Termin: …“ und „täglich bis …“.
  - „Yoga am Morgen“: „jeden Donnerstag bis …“.
  - Rubrik Theater & Lesungen: ein Stück mit mehreren Vorstellungen steht weiter je Vorstellung.
  - Zeitraum „Heute“ und ein einzelner Kalendertag: die Serienkarte nennt den Termin dieses Tages; eine Serie ohne Termin an dem Tag fehlt.
  - Die Zahl am Knopf der Filterseite ist die Zahl der Karten in der Liste (im Browser nachgezählt über `document.querySelectorAll('article.card').length`).
  - Tipp auf die Serienkarte: Fenster mit Abschnitt „Termine“, fünf Zeilen, Knopf klappt auf.
  - Eine Serie von Tourismus Sachsen mit 30 Terminen: am Bestand fehlt das Feld `terminlisteVoll` (die Daten sind älter als Task 2); hier wird nur festgehalten, dass der Text dann „bis …“ lautet und sich erst mit dem nächsten Datenlauf ändert.
  - Konsole ohne Fehler.
  - Bilder: Liste hell, Liste dunkel, Fenster einer Serie.

- [ ] **Step 8: Bericht.** Tabelle Vorher/Nachher je Rubrik und die Bilder gehen an den Betreiber. Kein Push, kein Merge, kein Veröffentlichen.
