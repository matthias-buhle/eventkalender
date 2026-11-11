# SaTourN-API-Anbindung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Quelle `satourn` holt die Termine der Sächsischen Schweiz und des Umkreises aus der offenen SaTourN-API (Open Data Finder Sachsen) statt aus bis zu 150 Einzelseiten, und die Seite nennt je Termin Lizenz und Urheber.

**Architecture:** Ein neues Modul `src/sources/satourn-api.js` ruft die API einmal je Lauf ab und macht daraus Events. `src/sources/satourn.js` bleibt der einzige Adapter (ein Eintrag in `sources.json`, `site/js/ueber.js`, Status und Übernahme-Schutz bleiben unverändert) und ruft statt des Sitemap-Teils das neue Modul auf; der Sebnitzer Teil bleibt. Das Event-Modell bekommt das Feld `lizenz`, das Detailfenster zeigt es an.

**Tech Stack:** Node (ESM, `node --test`), vorhandene Helfer (`makeEvent`, `normalizeArt`, `cleanText`, `shorten`, `detectStatus`, `normalizePhone`, `berlinIso`), `linkedom` für Render-Tests.

**Spec:** Entwurf vom 11.11.2026 (im Chat bestätigt), Kurzfassung unten unter „Entwurf“; Gesamtdesign: `docs/superpowers/specs/2026-11-08-eventkalender-ostsachsen-design.md`.

## Entwurf (bestätigt)

- Mehr Termine bei weniger Aufwand: ein API-Abruf je Lauf ersetzt den Sitemap-Teil. Gemessen am 11.11.2026 (11.11.2026 bis 09.02.2027, 75 km): API 1393 verschiedene Termine, heutiger Adapter 549, 419 in beiden.
- Der Sebnitzer Teil (`sebnitzUrl`) bleibt vorerst bestehen.
- Je Termin Urheber und Lizenz mitführen und im Detailfenster zeigen (rund 90 % sind CC BY-SA oder CC BY).
- Der Tageslauf bleibt täglich.
- Nicht angefasst: alle anderen Quellen, der Zeitplan, `fast-xml-parser` in `package.json`.

**Meine Entscheidungen (nicht abgesprochen, bitte prüfen):**
1. Die neue Quelle heißt im Quellenlink „Tourismus Sachsen (Open Data)“.
2. Fällt der API-Teil aus, schlägt die ganze Quelle `satourn` fehl, damit die 14-Tage-Übernahme die letzten Termine stehen lässt. Fällt nur der Sebnitzer Teil aus, läuft der Lauf weiter.
3. Einträge mit anderer Lizenz als CC0, CC BY 4.0 oder CC BY-SA 4.0 werden übersprungen.
4. Erreicht die Antwort 900 oder mehr verschiedene Datensätze (bei `limit=1000`), ist das ein Fehler statt stillem Abschneiden.
5. Einträge ohne `url` bekommen ersatzweise die Adresse des Urhebers, sonst `fallbackUrl` aus `sources.json`.

## Global Constraints

- API-Adresse: `https://meta.et4.de/rest.ashx/search/`; Parameter `experience=open-data-sachsen-tourismus`, `type=Event`, `template=schemaorg`, `limit=1000`, `latitude`/`longitude` aus `CENTER` (`src/geo.js`), `distance=75000` (= `RADIUS_KM` · 1000), `startdate`/`enddate` als Berliner ISO-Zeit (`berlinIso(tag, null)`). Kein API-Schlüssel, nichts Persönliches in der URL.
- Die API liefert zu jedem gewählten Datensatz alle Termine (höchstens 30), auch außerhalb von `startdate`/`enddate`; der Adapter filtert das Fenster selbst (heute bis heute + `horizonDays`, laufende Mehrtagestermine zählen).
- Die API hat `limit` und `offset` für Datensätze; ohne `limit` schneidet sie ab. Es wird immer `limit` gesetzt.
- Ganztägig = `startDate` enthält `T00:00:00` → `hasTime: false`.
- Kein neues Gerüst: Tests mit `node --test`, Dateinamen `test/*.test.js`, Texte und Kommentare auf Deutsch.
- Commits auf Deutsch mit Präfix `feat:`/`fix:`/`docs:`/`chore:`, mit der Co-Authored-By-Zeile wie in den bisherigen Commits.
- Beim Abruf höflich bleiben: nur der eine Abruf je Lauf über `createPoliteClient` (`http.get(url, { as: 'json' })`).

## Review Focus

1. Eintrag mit nicht offener Lizenz (zum Beispiel `by-nc`) darf nicht im Kalender landen (Task 2).
2. Eintrag ohne `url` und ohne `author.url` braucht trotzdem einen sicheren Quellenlink (Task 2).
3. Antwort, die kein Array ist oder zu viele Datensätze enthält, muss als Fehler im Status stehen, nicht als leerer Kalender (Tasks 2 und 3).
4. Fremder Text in `author.name` oder `name` (zum Beispiel `<img onerror>`) darf im Detailfenster nur als Text erscheinen (Task 4).
5. Wiederholungstermine desselben Datensatzes dürfen sich nicht überschreiben: je Beginn eine eigene `id` (Task 2).

---

## File Structure

- Create: `src/sources/satourn-api.js` — ruft die API ab und macht Events daraus (`fetchApiEvents`).
- Create: `test/satourn-api.test.js`, `test/fixtures/satourn-api.json` — Tests und gekürzte Antwort.
- Modify: `src/model.js`, `src/dedupe.js` — Feld `lizenz`.
- Modify: `src/time.js` — `plusTage` und `imFenster` aus `satourn.js` hierher.
- Modify: `src/sources/satourn.js` — Sitemap-Teil durch API-Teil ersetzen.
- Modify: `sources.json` — Konfiguration von `satourn`.
- Modify: `site/js/render.js` — Zeile „Lizenz“ im Detailfenster.
- Modify: `site/js/ueber.js` — Texte zu Quelle und Lizenzen.
- Modify: `test/model.test.js`, `test/dedupe.test.js`, `test/time.test.js`, `test/render.test.js`, `test/satourn.test.js`.
- Delete: `test/fixtures/satourn-detail-1.html`, `satourn-detail-2.html`, `satourn-sitemap.xml`, `satourn-sitemap-index.xml`.

---

### Task 1: Feld `lizenz` im Event-Modell

**Files:**
- Modify: `src/model.js` (Typdefinition und `makeEvent`)
- Modify: `src/dedupe.js` (`merge`)
- Test: `test/model.test.js`, `test/dedupe.test.js`

**Interfaces:**
- Produces: `Event.lizenz: { name: string, url: string, urheber: string|null } | null`. `makeEvent(raw)` übernimmt `raw.lizenz`, Standard `null`. Beim Zusammenführen gilt `erster(a.lizenz, b.lizenz)`.

- [ ] **Step 1: Failing tests**
  - In `test/model.test.js`: `makeEvent setzt lizenz standardmäßig auf null` (`makeEvent(base).lizenz === null`) und `makeEvent übernimmt lizenz` (mit `{ name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de', urheber: 'Ottendorfer Hütte GmbH' }`, `deepEqual`).
  - In `test/dedupe.test.js`, im Stil der dortigen Tests: `dedupe behält die Lizenz, wenn nur einer der beiden Einträge eine hat` (zwei Events gleichen Titels, Tags und Orts aus verschiedenen Quellen, der zweite mit `lizenz`; das Ergebnis hat genau einen Eintrag mit dieser `lizenz`, in beiden Reihenfolgen).
- [ ] **Step 2:** `node --test test/model.test.js test/dedupe.test.js` zeigt die neuen Tests als FAIL.
- [ ] **Step 3:** `makeEvent` gibt `lizenz: rest.lizenz ?? null` zurück, das JSDoc-Typ `Event` bekommt das Feld; `merge` in `src/dedupe.js` bekommt `lizenz: erster(a.lizenz, b.lizenz)`.
- [ ] **Step 4:** `npm test` ist grün.
- [ ] **Step 5: Commit** `feat: Event-Feld lizenz (Lizenz und Urheber je Termin)`.

---

### Task 2: Modul `satourn-api.js`

**Files:**
- Create: `src/sources/satourn-api.js`, `test/fixtures/satourn-api.json`, `test/satourn-api.test.js`
- Modify: `src/time.js` (`plusTage`, `imFenster` hierher verschieben), `test/time.test.js`

**Interfaces:**
- Consumes: `makeEvent` mit `lizenz` (Task 1); aus `src/time.js`: `berlinIso`; aus `src/geo.js`: `CENTER`, `RADIUS_KM`; aus `src/normalize.js`: `cleanText`, `detectStatus`, `normalizeArt`, `normalizePhone`, `shorten`.
- Produces:
  - `src/time.js`: `plusTage(tag: string, tage: number): string` und `imFenster(start: string, ende: string|null, heute: string, letzterTag: string): boolean`, Verhalten wie die bisherigen gleichnamigen Funktionen in `src/sources/satourn.js`.
  - `src/sources/satourn-api.js`: `fetchApiEvents({ http, today, config }): Promise<Event[]>` mit `config = { apiUrl, experience, limit, horizonDays, fallbackUrl }`.

- [ ] **Step 1: Hilfen verschieben, Test zuerst.** In `test/time.test.js`: `plusTage rechnet über Monatsgrenzen` (`plusTage('2026-11-25', 10) === '2026-12-05'`) und `imFenster zählt laufende Mehrtagestermine` (`imFenster('2026-11-05T10:00:00+01:00', '2026-11-14T18:00:00+01:00', '2026-11-11', '2027-02-09') === true`; ein Termin mit Ende vor heute `false`; Beginn nach `letzterTag` `false`; `ende = null` zählt den Beginn). Verschiebe die beiden Funktionen aus `src/sources/satourn.js` nach `src/time.js` (exportiert) und importiere sie in `satourn.js`; `npm test` bleibt grün.
- [ ] **Step 2: Fixture.** Lege `test/fixtures/satourn-api.json` an: ein JSON-Array mit diesen Einträgen im schema.org-Format der API (nur diese Felder: `@type` als Array, `name`, `description` als HTML, `identifier` als Array, optional `url`, `location` als Array mit `name`, `address.addressLocality`, `geo.latitude`/`longitude`, `author` mit `name` mit führendem Leerzeichen, optional `url`/`telephone`/`email`, `license`, `startDate`, optional `endDate`, optional `offers`):

  | Kürzel | Inhalt |
  |---|---|
  | A | `["MusicEvent","Event","WebPage"]`, „Weihnachtskonzert „Freue dich, Welt““, `e_101382318`, Peter-Paul-Kirche Sebnitz (50.9667, 14.2833), Beginn 2026-12-13T16:00:00+01:00, Ende 17:30, `by-sa/4.0`, Urheber „ Große Kreisstadt Sebnitz Touristinformation Sebnitz “ mit Telefon `+49 35971 70960 ` und E-Mail `touristinfo@sebnitz.de`, `url` vorhanden |
  | B | `["https://odta.io/voc/TemporaryExhibition","WebPage"]`, ohne `url`, Urheber mit `url` `https://example.org/verein/`, `publicdomain/zero/1.0/`, Beginn 2026-11-20T10:00:00+01:00 |
  | C | `["Event","https://odta.io/voc/ChristmasMarket","WebPage"]`, „Adventsmarkt“, ganztägig 2026-11-28T00:00:00+01:00 ohne Ende, `by/4.0`, ohne `url`, Urheber ohne `url` |
  | D1, D2 | gleicher Datensatz `e_100916490`, `["FoodEvent","Event","WebPage"]`, „Brauhausweihnacht“, Beginn 2026-11-20T18:00:00+01:00 und 2026-11-26T18:00:00+01:00, `by-sa/4.0` |
  | E | „ABGESAGT: Lichterfahrt“, `["Event","WebPage"]`, Beginn 2026-12-01T18:00:00+01:00, `by-sa/4.0` |
  | F | Beginn 2026-10-20, Ende 2026-10-31 (vorbei) |
  | G | Beginn 2026-11-05T10:00:00+01:00, Ende 2026-11-14T18:00:00+01:00 (läuft noch) |
  | H | Beginn 2027-03-01T10:00:00+01:00 (hinter dem Fenster) |
  | I | Lizenz `https://creativecommons.org/licenses/by-nc/4.0/`, sonst gültig im Fenster |
  | J | ohne `name`; K: ohne `startDate` |

  F bis K haben jeweils eigene `identifier` und gültige Orte.
- [ ] **Step 3: Failing tests** in `test/satourn-api.test.js` (Kopf wie `test/satourn.test.js`; `TODAY = '2026-11-11'`, `config = { apiUrl: 'https://meta.et4.de/rest.ashx/search/', experience: 'open-data-sachsen-tourismus', limit: 1000, horizonDays: 90, fallbackUrl: 'https://www.sachsen-tourismus.de/' }`; Fake-Client `{ get: async (url) => { abgerufen.push(url); return { status: 200, body: <Fixture>, url }; } }`):
  - `ruft die API genau einmal mit den festen Parametern ab`: ein Abruf; die URL enthält `experience=open-data-sachsen-tourismus`, `type=Event`, `template=schemaorg`, `limit=1000`, `distance=75000`, `latitude=50.9399`, `longitude=14.291` und `startdate=2026-11-11T00%3A00%3A00%2B01%3A00`; `enddate` für `2027-02-09`.
  - `Termin A: Felder`: Titel mit Anführungszeichen unverändert, `start`/`end` wie in der Fixture, `hasTime true`, `placeName 'Ev.-Luth. Peter-Paul-Kirche Sebnitz, Sebnitz'` (Name und Ort aus der Fixture, Leerzeichen getrimmt), `lat 50.9667`, `lon 14.2833`, `contact { phone: '+4935971' + '70960', email: 'touristinfo@sebnitz.de', url: <author.url> }`, `lizenz { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.de', urheber: 'Große Kreisstadt Sebnitz Touristinformation Sebnitz' }`, `sources[0].name === 'Tourismus Sachsen (Open Data)'`.
  - `Lizenzen CC0 und CC BY`: B hat `lizenz.name 'CC0 1.0'` mit `url 'https://creativecommons.org/publicdomain/zero/1.0/deed.de'`; C hat `'CC BY 4.0'`.
  - `Art aus dem Typ`: B `schau`, C `markt`, A `konzert`, D1 `sonstiges`.
  - `ganztägig`: C hat `hasTime false` und `end null`.
  - `Quellenlink`: A nimmt `url`; B die Adresse des Urhebers; C `config.fallbackUrl`.
  - `Wiederholungen bleiben getrennt`: D1 und D2 haben verschiedene `id`.
  - `Abgesagt`: E hat `ticketStatus 'abgesagt'`.
  - `Fenster`: kein Event aus F, H; G ist dabei; mit `horizonDays: 20` fehlt D2 (26.11.).
  - `Nicht offene Lizenz, ohne Namen oder ohne Beginn werden übersprungen`: kein Event aus I, J, K.
  - `Antwort ohne Array ist ein Fehler`: Body `{ "fehler": 1 }` → `fetchApiEvents` wirft `/Array/`.
  - `Zu viele Datensätze sind ein Fehler`: Body mit 900 Einträgen verschiedener `identifier` und gültiger Termine → wirft `/limit/`.
- [ ] **Step 4:** `node --test test/satourn-api.test.js` zeigt alle als FAIL (Modul fehlt).
- [ ] **Step 5: Implementiere `fetchApiEvents`** in `src/sources/satourn-api.js`:
  - URL aus `config.apiUrl` mit `URLSearchParams` aufbauen (die `+` im Offset werden dabei als `%2B` kodiert); Abruf mit `http.get(url, { as: 'json' })`; Fenster mit `plusTage`/`imFenster`; Wiederholungen: `sourceId = ` erster `identifier` + `:` + `startDate`.
  - Lizenzzuordnung nach genau diesen drei Adressen: `https://creativecommons.org/licenses/by-sa/4.0/`, `…/by/4.0/`, `…/publicdomain/zero/1.0/`; Anzeigeadresse jeweils `…/deed.de`; andere Lizenz → Eintrag überspringen.
  - Art: über das Typ-Array (TemporaryExhibition → `schau`; ChristmasMarket, RegionalMarket, HistoricalMarket → `markt`; MusicEvent → `konzert`; Party, DanceShow → `party`; Funfair → `fest`), sonst `normalizeArt('', name)`.
  - Texte mit `cleanText`, Beschreibung `shorten(…, 300) || null`, Status mit `detectStatus` über Titel und die ersten 160 Zeichen der Beschreibung, Ticketlink aus `offers[0].url`, Telefon mit `normalizePhone`, Urheber und Ortsnamen mit `trim()`.
  - Die Grenze: gibt es 900 oder mehr verschiedene `identifier`, mit einer Meldung werfen, die `limit` enthält.
- [ ] **Step 6:** `npm test` ist grün.
- [ ] **Step 7: Commit** `feat: SaTourN-API-Abruf für Termine der Sächsischen Schweiz und des Umkreises`.

---

### Task 3: API in den Adapter `satourn` einbauen

**Files:**
- Modify: `src/sources/satourn.js`, `sources.json`, `test/satourn.test.js`
- Delete: `test/fixtures/satourn-detail-1.html`, `satourn-detail-2.html`, `satourn-sitemap.xml`, `satourn-sitemap-index.xml`

**Interfaces:**
- Consumes: `fetchApiEvents` (Task 2).
- Produces: `fetchEvents({ http, today, config })` von `satourn.js` liefert Sebnitzer Termine plus API-Termine; wirft, wenn der API-Teil fehlschlägt.

- [ ] **Step 1: Tests umbauen** in `test/satourn.test.js`: Fake-Client liefert für `config.sebnitzUrl` die Sebnitz-Fixture und für `config.apiUrl` (URL beginnt mit `https://meta.et4.de/`) `test/fixtures/satourn-api.json`; `config` neu: `{ enabled: true, sebnitzUrl: SEBNITZ, apiUrl, experience, limit: 1000, horizonDays: 90, fallbackUrl }`; `TODAY = '2026-11-11'` für die API-Tests, die Sebnitz-Tests behalten ihr bisheriges `TODAY` (jeweils per Konstante je Test). Entferne die Tests zu Sitemap, Detailseiten und `maxDetailPages`. Neue oder angepasste Tests:
  - `satourn: Termine aus Sebnitz und aus der API`: Ergebnis enthält Quellen `sebnitz.org` und `Tourismus Sachsen (Open Data)`.
  - `satourn: fällt der Sebnitzer Teil aus, kommen die API-Termine`: nur API-Quelle, kein Fehler.
  - `satourn: fällt der API-Teil aus, ist das ein Fehler`: `assert.rejects(…, /404/)`, auch wenn der Sebnitzer Teil geantwortet hätte.
  - `satourn: fallen beide aus, ist es ein Fehler`.
  - Die bisherigen Sebnitz-Tests (Kontakt, Koordinaten, Status, abgesagt, Fenster) bleiben, ohne den API-Teil zu stören (liefere in ihnen die API-Fixture mit).
- [ ] **Step 2:** `node --test test/satourn.test.js` zeigt die neuen Tests als FAIL.
- [ ] **Step 3:** In `src/sources/satourn.js` den Sitemap-Teil (`eventUrls`, `ausDetail`, Aufruf mit `maxDetailPages`) und nicht mehr benutzte Importe entfernen; `fetchEvents` ruft `ausSebnitz` (Fehler wird gemerkt) und `fetchApiEvents` (Fehler wird weitergegeben, nachdem der Sebnitzer Teil nicht mehr gebraucht wird) auf: API-Fehler → werfen; sonst Sebnitzer plus API-Termine. Den Kopfkommentar der Funktion auf den neuen Ablauf umschreiben.
- [ ] **Step 4:** `sources.json`, Eintrag `satourn`: `sitemapIndexUrl` und `maxDetailPages` entfernen; ergänzen `"apiUrl": "https://meta.et4.de/rest.ashx/search/"`, `"experience": "open-data-sachsen-tourismus"`, `"limit": 1000`, `"fallbackUrl": "https://www.sachsen-tourismus.de/"`; `sebnitzUrl` und `horizonDays` bleiben.
- [ ] **Step 5:** Die vier nicht mehr benutzten Fixtures löschen (`git rm`). `npm test` ist grün.
- [ ] **Step 6: Commit** `feat: Quelle satourn nutzt die SaTourN-API statt der Sitemap`.

---

### Task 4: Lizenz im Detailfenster und Texte

**Files:**
- Modify: `site/js/render.js` (`renderDetail`), `site/js/ueber.js`, `test/render.test.js`, bei Bedarf `test/ueber.test.js`

**Interfaces:**
- Consumes: `ev.lizenz` (Task 1), nur im Detailfenster.
- Produces: in `renderDetail` nach der Quellenzeile ein Absatz `p.lizenz` mit „Lizenz: “, dem Lizenznamen als Link (nur wenn `safeHref(lizenz.url)` sicher ist, sonst als Text) und, wenn `lizenz.urheber` gesetzt ist, „ · Urheber: “ plus Text. Ohne `ev.lizenz` kein Absatz.

- [ ] **Step 1: Failing tests** in `test/render.test.js` (Hilfen `ev`, `document` wie dort): 
  - `Detailfenster zeigt Lizenz und Urheber` (Absatz `.lizenz` enthält `CC BY-SA 4.0`, den Urheber, der Link hat die `deed.de`-Adresse).
  - `Karte ohne Lizenz und Detailfenster ohne Lizenz haben keinen Lizenz-Absatz`.
  - `Fremder Text im Urheber wird als Text dargestellt`: `urheber: '<img src=x onerror=alert(1)>'` → kein `img` im Detailfenster; und `url: 'javascript:alert(3)'` → kein Link im Absatz, Name steht als Text.
- [ ] **Step 2:** `node --test test/render.test.js` zeigt die neuen Tests als FAIL.
- [ ] **Step 3:** In `site/js/render.js` eine Funktion `lizenzZeile(doc, ev)` im Stil von `quellenZeile` schreiben und in `renderDetail` direkt nach der Quellenzeile anhängen; die Karte bleibt unverändert.
- [ ] **Step 4: Texte.** In `site/js/ueber.js`: den Eintrag `satourn` (Name „Sebnitz und Sächsische Schweiz“) auf „Sebnitz, Sächsische Schweiz und Umgebung“ ändern, `hinweis`: „Offene Tourismusdaten Sachsen (Open Data Finder der TMGS) und Termine der Touristinformation Sebnitz.“ Den Lizenzabsatz ändern auf: „Termine aus den offenen Tourismusdaten Sachsen stehen je Termin unter CC0 1.0, CC BY 4.0 oder CC BY-SA 4.0; Lizenz und Urheber stehen im Detailfenster des Termins.“ (Link zu `https://creativecommons.org/licenses/by-sa/4.0/deed.de` bleibt). `test/ueber.test.js` anpassen, falls es den alten Wortlaut prüft.
- [ ] **Step 5:** `npm test` ist grün.
- [ ] **Step 6: Commit** `feat: Lizenz und Urheber im Detailfenster, Texte zur Quelle satourn`.

---

### Task 5: Prüfung gegen die echte API

**Files:** keine Änderungen im Repo (Wegwerfskript im Scratchpad, nicht committen).

- [ ] **Step 1:** Ein Skript importiert `src/sources/satourn.js`, `src/http.js` (`createPoliteClient`, `perHostDelayMs: 2000`) und `sources.json` und ruft `fetchEvents` mit dem heutigen Datum auf (`todayBerlin(new Date())`). Erwartet: Dauer unter 20 Sekunden, mehr als 900 Events, Quellen `sebnitz.org` und `Tourismus Sachsen (Open Data)`, jedes Event mit `lizenz` bei der API-Quelle, alle `sources[0].url` mit `https://`.
- [ ] **Step 2:** Die Anzahl verschiedener `id` aus API-Quelle ausgeben (Erwartung: 900 oder mehr, kein Fehler wegen der Grenze) und die Anzahl verschiedener Datensätze (`identifier`-Anteil der `sourceId`, Erwartung: unter 900).
- [ ] **Step 3:** `npm test` ist grün; `git status` zeigt nur die geplanten Dateien.
- [ ] **Step 4:** Ergebnis berichten (Anzahlen, Dauer, Auffälligkeiten). Der erste Tageslauf auf GitHub (`workflow_dispatch` für „Taeglich aktualisieren“) ist ein eigener Schritt nach dem Push und bleibt Sache des Nutzers.
