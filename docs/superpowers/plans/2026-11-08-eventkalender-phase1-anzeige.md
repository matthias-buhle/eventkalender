# Eventkalender Ostsachsen, Plan 1 von 3: Datensammlung und Anzeige

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Handy-Webseite, die täglich automatisch Veranstaltungen der Kernquellen im Umkreis von 75 km um PLZ 01855 sammelt und mit Filtern, Entfernung, Kontakt und Quellenlink anzeigt.

**Architecture:** Ein Node-Programm (`src/build.js`) ruft pro Quelle einen Adapter auf, bringt alle Termine in ein gemeinsames Format, filtert nach Radius und Datum, führt Dubletten zusammen und schreibt `site/data/events.json` und `site/data/status.json`. Die statische Seite `site/` liest diese Dateien, filtert im Browser nach den persönlichen Einstellungen (localStorage) und ist als PWA installierbar. Ein täglicher GitHub-Actions-Lauf baut und veröffentlicht alles auf GitHub Pages.

**Tech Stack:** Node 24 (ES-Module, kein TypeScript, Typen als JSDoc), `node:test`, `cheerio`, `fast-xml-parser`, `node-ical`, `robots-parser`, `linkedom` (nur Tests), reines HTML/CSS/JS ohne Build-Schritt, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-08-eventkalender-ostsachsen-design.md`

**Aufteilung:** Das Konzept umfasst drei Bauabschnitte. Dieser Plan deckt Phase 1 ab (Abschnitte 2, 3, 4, 6, 7 Kern, 8, 9 des Konzepts). Plan 2 (Nachtragen per Formular und Foto, Zugang, KI-Kostenbremse) und Plan 3 (Zeitungs-PDFs) entstehen, wenn Phase 1 läuft, weil sie auf ihrer Infrastruktur und auf echten Daten aufbauen. Das Datenformat unten enthält die Felder dafür bereits (`needsReview`, `submittedBy`).

## Global Constraints

- Mittelpunkt PLZ 01855 (Sebnitz), Radius **75 km**, einschließlich Tschechien (`country: 'CZ'`).
- Oberfläche **deutsch**. Zeiten in `Europe/Berlin`.
- **Nie** "Karten verfügbar" anzeigen, außer eine strukturierte Quelle belegt es (Ticketmaster `onsale`, GoOut `InStock`). "Ausverkauft", "abgesagt", "verlegt" nur bei Beleg.
- Pro Termin Kontakt (Telefon, Link, E-Mail) und Quellenlink; Knöpfe nur, wenn der Wert existiert.
- Höflich auslesen: `robots.txt` und `Crawl-delay` beachten, höchstens **3 Läufe pro Tag**, keine Umgehung von Sperren, Logins oder Bot-Schutz, eindeutiger User-Agent mit Projektnamen.
- Gesperrt, nicht zu verwenden: `stadt-pirna.de`, `saechsische.de/veranstaltungskalender`, die Pfade `*site=`, `*search=`, `*month=` von `konzertkasse-dresden.de`, `/api/` von `events.3mag.eu`, in Seiten eingebettete Schlüssel fremder Anbieter (Dresdner Stadtkalender, oberlausitz.com, Hoyerswerda).
- Jede Quelle einzeln abschaltbar (`sources.json`). Ein Fehler einer Quelle stoppt die anderen nicht.
- Nur Fakten übernehmen (Name, Datum, Ort, Kontakt) und zur Quelle verlinken. Fremdtext wird nie als HTML ausgegeben.
- Höchstens 20 Nutzer; keine Benutzerkonten; persönliche Filter nur im Browser des Nutzers.
- Handy zuerst, installierbar (PWA), keine laufenden Kosten in Phase 1.

## Datenformat (von allen Tasks genutzt)

```js
/** @typedef {'markt'|'konzert'|'party'|'fest'|'schau'|'sonstiges'} Art */
/** @typedef {{phone:string|null,url:string|null,email:string|null}} Contact */
/** @typedef {'ausverkauft'|'verfuegbar'|'abgesagt'|'verlegt'} TicketStatus */
/** @typedef {{
 *   id:string,                    // sha1(sourceName+':'+sourceId), hex
 *   title:string, art:Art, tags:string[],
 *   start:string, end:string|null, // ISO 8601 mit Offset, z.B. '2026-11-14T10:00:00+01:00'
 *   hasTime:boolean,               // false = ganztägig, start dann 00:00
 *   placeName:string, lat:number|null, lon:number|null, distanceKm:number|null,
 *   country:'DE'|'CZ',
 *   sources:{name:string,url:string}[],   // mindestens ein Eintrag
 *   contact:Contact, ticketUrl:string|null, ticketStatus:TicketStatus|null,
 *   description:string|null, needsReview:boolean, submittedBy:string|null
 * }} Event */
```

## Review Focus

Eingaben und Fehlerfälle, die das Konzept voraussetzt, aber nicht ausdrücklich beschreibt. Der Test dazu steht jeweils im genannten Task.

1. Eine Quelle liefert 403, Timeout, leere Antwort oder geändertes Format: die übrigen Quellen laufen weiter, `status.json` nennt die Quelle mit Fehler (Task 5).
2. Dauerausstellungen und Mehrtagesmärkte (Görlitz liefert viele Dauerausstellungen, andere Märkte zerlegen Mehrtagesmärkte in Einzeltage): Ausstellungen werden verworfen, Mehrtagesmärkte bleiben ein Termin von Start bis Ende (Task 8).
3. Ort nicht auflösbar: der Termin bleibt sichtbar mit leerer Entfernung, er wird nicht verworfen (Tasks 2 und 5).
4. Fremdtext mit HTML oder Skript in Titel und Beschreibung wird als Text angezeigt (Tasks 4 und 11).
5. Sommer-/Winterzeit, Termine ohne Uhrzeit und "heute": ein Termin von heute bleibt bis Tagesende sichtbar, auch ohne Endzeit (Tasks 1 und 5).

---

### Task 1: Projektgerüst, Datenmodell, Zeit

**Files:**
- Create: `package.json`, `.gitignore`, `src/model.js`, `src/time.js`, `test/model.test.js`, `test/time.test.js`

**Interfaces:**
- Produces: `makeEvent(raw: Partial<Event> & {sourceName:string, sourceId:string}) -> Event` (setzt `id`, Standardwerte `tags=[]`, `needsReview=false`, `submittedBy=null`, `country='DE'`, `contact` mit drei `null`; wirft `Error` bei fehlendem `title` oder `start`). `berlinIso(date:'YYYY-MM-DD', time:'HH:MM'|null) -> string`. `parseGermanDate(text:string) -> 'YYYY-MM-DD'|null` (versteht `'Di, 10.11.2026'` und `'10.11.2026'`). `todayBerlin(now:Date) -> 'YYYY-MM-DD'`.

- [ ] **Step 1:** `git init`; `package.json` (`"type":"module"`, Skripte `test` = `node --test`, `build` = `node src/build.js`); `.gitignore` mit `node_modules/`, `.superpowers/`, `site/data/`.
- [ ] **Step 2: Tests schreiben.** `makeEvent wirft ohne title`; `makeEvent liefert stabile id für gleiche sourceName+sourceId`; `berlinIso('2026-07-01','20:00') === '2026-07-01T20:00:00+02:00'`; `berlinIso('2026-11-14','10:00') === '2026-11-14T10:00:00+01:00'`; `berlinIso('2026-03-29','12:00')` endet auf `+02:00` (Umstellung); `parseGermanDate('Di, 10.11.2026') === '2026-11-10'`; `todayBerlin(new Date('2026-11-14T23:30:00Z')) === '2026-11-15'`.
- [ ] **Step 3:** `node --test` ausführen; Erwartung: FAIL (Module fehlen).
- [ ] **Step 4:** Implementieren; Zeitzonen mit `Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'})`, keine Zeit-Bibliothek.
- [ ] **Step 5:** `node --test` ausführen; Erwartung: alle PASS. Commit `feat: Projektgerüst, Event-Modell, Zeitfunktionen`.

### Task 2: Geografie und Ortsverzeichnis

**Files:**
- Create: `src/geo.js`, `src/places.json`, `scripts/build-places.js`, `test/geo.test.js`

**Interfaces:**
- Consumes: nichts.
- Produces: `CENTER = {lat:50.972, lon:14.271}` (PLZ 01855, im Skript gegen Nominatim zu prüfen), `RADIUS_KM = 75`, `distanceKm(a:{lat,lon}, b:{lat,lon}) -> number` (Haversine), `resolvePlace(name:string) -> {name:string,lat:number,lon:number,country:'DE'|'CZ'}|null`.

- [ ] **Step 1: Tests schreiben.** `distanceKm Sebnitz–Dresden zwischen 30 und 50`; `distanceKm Sebnitz–Liberec zwischen 50 und 70`; `distanceKm Sebnitz–Cottbus größer 75`; `resolvePlace('Neustadt i. Sa.')` und `resolvePlace('Neustadt in Sachsen')` liefern denselben Ort; `resolvePlace('Děčín').country === 'CZ'`; `resolvePlace('Ortunbekanntdorf') === null`; `resolvePlace` ignoriert Groß-/Kleinschreibung und Umlautschreibweise (`Görlitz`/`Goerlitz`).
- [ ] **Step 2:** Tests laufen lassen; Erwartung: FAIL.
- [ ] **Step 3:** `scripts/build-places.js` fragt eine feste Namensliste (alle Orte aus Konzept Abschnitt 3 plus Ortsteile von Sebnitz und Neustadt, Pulsnitz, Radeberg, Radebeul, Pirna, Meißen, Heidenau, Dohna, Neukirch, Hoyerswerda, Weißwasser, Bad Muskau, Herrnhut, Niesky, Varnsdorf, Rumburk, Šluknov, Krásná Lípa, Česká Kamenice, Česká Lípa, Ústí nad Labem) bei Nominatim ab (1 Anfrage pro Sekunde, User-Agent mit Projektname) und schreibt `src/places.json` mit Alias-Liste je Ort. `resolvePlace` normalisiert (klein, Umlaute und Diakritika entfernt, "i. Sa." gleich "in Sachsen") und schlägt in `places.json` nach. Datei einchecken.
- [ ] **Step 4:** Tests; Erwartung: PASS. Commit `feat: Entfernung und Ortsverzeichnis`.

### Task 3: Höflicher HTTP-Client

**Files:**
- Create: `src/http.js`, `test/http.test.js`
- Modify: `package.json` (Abhängigkeit `robots-parser`)

**Interfaces:**
- Produces: `createPoliteClient({userAgent:string, perHostDelayMs:number, timeoutMs?:number, fetchImpl?:typeof fetch}) -> {get(url:string, opts?:{as?:'text'|'json'}) -> Promise<{status:number, body:string|object, url:string}>}`; `class RobotsDisallowedError extends Error`. Der User-Agent lautet `eventkalender-ostsachsen/1.0 (privates Projekt; Kontakt siehe Repository)`.

- [ ] **Step 1: Tests schreiben** gegen einen lokalen `node:http`-Server: `verweigert Pfad, den robots.txt sperrt (RobotsDisallowedError)`; `wartet mindestens Crawl-delay zwischen zwei Abrufen desselben Hosts`; `ruft robots.txt pro Host nur einmal ab`; `wiederholt genau einmal bei Status 503`; `bricht nach timeoutMs ab`; `liefert geparstes JSON bei as:'json'`; `fehlende robots.txt (404) erlaubt alles`.
- [ ] **Step 2:** Tests; Erwartung: FAIL.
- [ ] **Step 3:** Implementieren mit globalem `fetch`, `robots-parser`, pro-Host-Warteschlange; maßgeblich ist das größere von `perHostDelayMs` und `Crawl-delay`.
- [ ] **Step 4:** Tests; Erwartung: PASS. Commit `feat: höflicher HTTP-Client`.

### Task 4: Normalisierung (Art, Status, Telefon, Text)

**Files:**
- Create: `src/normalize.js`, `test/normalize.test.js`

**Interfaces:**
- Produces: `normalizeArt(categoryText:string, title:string) -> Art`; `detectStatus(text:string) -> TicketStatus|null` (nur negative/absagende Hinweise: 'ausverkauft', 'abgesagt', 'verlegt'; `'verfuegbar'` setzen ausschließlich Adapter mit strukturiertem Beleg); `normalizePhone(text:string) -> string|null` (liefert Ziffern mit führendem `+` oder `0`, ohne Leerzeichen, tauglich für `tel:`); `cleanText(htmlOrText:string) -> string` (Tags entfernt, Entitäten aufgelöst, Leerraum zusammengezogen).

- [ ] **Step 1: Tests schreiben.** `detectStatus('+++Ausverkauft+++') === 'ausverkauft'`; `detectStatus('Vyprodáno') === 'ausverkauft'`; `detectStatus('Prodej ukončen') === 'ausverkauft'`; `detectStatus('Konzert abgesagt') === 'abgesagt'`; `detectStatus('Eintritt frei') === null`; `normalizeArt('Rock & Pop','Band X') === 'konzert'`; `normalizeArt('Feiern & Ausgehen','80er Party') === 'party'`; `normalizeArt('', 'Töpfermarkt Pulsnitz') === 'markt'`; `normalizeArt('', 'Kreisschau Rassegeflügel') === 'schau'`; `normalizeArt('', 'Suppenfest') === 'fest'`; unbekannt → `'sonstiges'`; `normalizePhone('035955 / 12 345') === '03595512345'`; `normalizePhone('+49 (0) 351 123') === '+49351123'`; `normalizePhone('keine Nummer') === null`; `cleanText('<p>Hallo&nbsp;<b>Welt</b><script>alert(1)</script></p>') === 'Hallo Welt'`.
- [ ] **Step 2:** Tests; Erwartung: FAIL.
- [ ] **Step 3:** Implementieren, Schlüsselwortlisten als Konstanten oben in der Datei.
- [ ] **Step 4:** Tests; Erwartung: PASS. Commit `feat: Normalisierung`.

### Task 5: Sammellauf, Dublettenabgleich, Statusbericht

**Files:**
- Create: `src/build.js`, `src/dedupe.js`, `src/sources/index.js`, `sources.json`, `test/build.test.js`, `test/dedupe.test.js`

**Interfaces:**
- Consumes: `makeEvent`, `todayBerlin`, `distanceKm`, `resolvePlace`, `createPoliteClient`.
- Produces: Quellenmodul-Vertrag `export const name:string; export async function fetchEvents(ctx:{http, today:string, config:object}) -> Promise<Event[]>`. `runAll({sources:{name,fetchEvents,config}[], http, now:Date, previousStatus?:SourceStatus[]}) -> Promise<{events:Event[], status:SourceStatus[]}>` mit `SourceStatus = {name, ok:boolean, count:number, error:string|null, lastOkAt:string|null}`. `dedupe(events:Event[]) -> Event[]`. `sources.json` hat je Quelle `{enabled:boolean, ...adapterConfig}`. `node src/build.js` schreibt `site/data/events.json` und `site/data/status.json`.

- [ ] **Step 1: Tests schreiben.** `eine werfende Quelle erzeugt status ok:false und stoppt die anderen nicht` (Review Focus 1); `eine Quelle mit enabled:false wird nicht aufgerufen`; `Ergebnis mit 0 Terminen von einer sonst ergiebigen Quelle (previousStatus.count >= 5) wird als ok:false mit Fehlertext 'leere Antwort' gemeldet`; `Termine mit distanceKm > 75 werden entfernt, Termine mit unbekanntem Ort bleiben mit distanceKm null` (Review Focus 3); `Termin von heute 10:00 ohne Ende bleibt um 20:00 Berlin-Zeit erhalten, gestern verschwindet` (Review Focus 5); `lastOkAt wird aus previousStatus übernommen, wenn die Quelle ausfällt`; Dedupe: `gleicher Titel (normalisiert), Tag und Ort werden zu einem Termin mit beiden sources`, `gleicher Titel und Tag, aber anderer Ort bleiben getrennt`, `der zusammengeführte Termin nimmt vorhandene Kontaktfelder und 'ausverkauft' aus beliebigem Teiltermin`.
- [ ] **Step 2:** Tests; Erwartung: FAIL.
- [ ] **Step 3:** Implementieren. `runAll` füllt `lat/lon/distanceKm/country` über `resolvePlace(placeName)`, sofern der Adapter keine Koordinaten liefert. Der Client wird mit `perHostDelayMs: 2000` erstellt. `src/sources/index.js` exportiert die Liste aller Adapter; spätere Tasks tragen sich dort ein.
- [ ] **Step 4:** Tests; Erwartung: PASS. Commit `feat: Sammellauf, Dubletten, Statusbericht`.

### Task 6: Adapter Alter Schlachthof und Junge Garde

**Files:**
- Create: `src/sources/aust.js`, `scripts/capture-fixture.js`, `test/aust.test.js`, `test/fixtures/aust-getEvents.json`
- Modify: `src/sources/index.js`, `sources.json`

**Interfaces:**
- Consumes: Quellenvertrag (Task 5), `berlinIso`, `parseGermanDate`, `detectStatus`, `cleanText`, `normalizeArt`.
- Produces: Quelle `aust`. Konfiguration `venues:[{name, baseUrl, contact:{phone,url,email}}]` für `https://www.alter-schlachthof.de` und `https://www.junge-garde.com`; Abruf `GET <baseUrl>/api/getEvents`. Feldzuordnung laut Konzept: `titel`→title, `datum` ('Di, 10.11.2026') + `beginn`→start, `ort`/`stadt`→placeName, `tickets_url`→ticketUrl, `teaser` (HTML)→description und Quelle für `detectStatus`, `modrewrite`+`id`→Quellenlink `<baseUrl>/konzerte/<id>/<modrewrite>`. Kontakt: Telefon und E-Mail aus dem Impressum der Veranstaltungsorte in die Konfiguration eintragen.

- [ ] **Step 1:** `scripts/capture-fixture.js <url> <datei> [--limit N]` mit dem höflichen Client schreiben (speichert bei JSON-Listen höchstens N Einträge); damit 6 Einträge von `/api/getEvents` als Fixture speichern, darunter ein Eintrag mit `+++Ausverkauft+++` im Teaser, falls vorhanden.
- [ ] **Step 2: Test schreiben.** `liefert aus der Fixture Events mit title, start (ISO Berlin) und sources[0].url`; `Eintrag mit +++Ausverkauft+++ hat ticketStatus 'ausverkauft'`; `Eintrag ohne Hinweis hat ticketStatus null` (nie 'verfuegbar'); `contact stammt aus der Venue-Konfiguration`.
- [ ] **Step 3:** Test; Erwartung: FAIL. Adapter implementieren, in Registry und `sources.json` eintragen.
- [ ] **Step 4:** Test; Erwartung: PASS. Commit `feat: Adapter Alter Schlachthof und Junge Garde`.

### Task 7: schema.org-Helfer, Sächsische Schweiz und Kamenz

**Files:**
- Create: `src/schemaorg.js`, `src/sources/satourn.js`, `src/sources/kamenz.js`, `test/schemaorg.test.js`, `test/satourn.test.js`, `test/kamenz.test.js`, Fixtures unter `test/fixtures/`
- Modify: `src/sources/index.js`, `sources.json`

**Interfaces:**
- Produces: `extractSchemaEvents(html:string) -> {name,startDate,endDate,location,url,offers,raw}[]` (liest JSON-LD `@type: Event` auch in `@graph` und Microdata `itemtype=…/Event`; wird auch von Tasks 9 und 10 genutzt). Quelle `satourn` (Event-Sitemap von `saechsische-schweiz.de` plus JSON-LD je Termin; zusätzlich `sebnitz.org/Veranstaltungskalender` mit dem eingebetteten JSON und der Telefon-/Linkangabe aus dem Feld `Kontakt`; Daten dort CC0). Quelle `kamenz` (`kamenz.de/veranstaltungskalender.html`, Microdata).

- [ ] **Step 1:** Fixtures mit `capture-fixture.js` holen (je eine Listen-/Sitemap-Seite und 2 Detailseiten).
- [ ] **Step 2: Tests schreiben.** `extractSchemaEvents liest JSON-LD in @graph`; `liest Microdata`; `ignoriert kaputtes JSON-LD ohne Ausnahme`; `satourn: jedes Event hat title, start und Ort`; `satourn: Termin mit 'Ausverkauft' im Text hat ticketStatus 'ausverkauft'`; `kamenz: Reservix-Link wird ticketUrl, ticketStatus bleibt null`.
- [ ] **Step 3:** Tests; Erwartung: FAIL. Implementieren. Die Sitemap-Abrufe der Detailseiten höchstens 150 pro Lauf, fortlaufend nach Datum; Zeitraum nur kommende 90 Tage.
- [ ] **Step 4:** Tests; Erwartung: PASS. Commit `feat: schema.org-Helfer, Sächsische Schweiz, Kamenz`.

### Task 8: Bischofswerda, Görlitz, Augusto

**Files:**
- Create: `src/sources/bischofswerda.js`, `src/sources/goerlitz.js`, `src/sources/augusto.js`, je ein Test und Fixtures
- Modify: `src/sources/index.js`, `sources.json`

**Interfaces:**
- Produces: Quelle `bischofswerda` (RSS `/veranstaltungen/rss`, Kontakt aus dem Feed, `AUSVERKAUFT` im Titel→`ausverkauft`); Quelle `goerlitz` (`https://www.goerlitz.de/termine/api?date_from=…&date_to=…&p=<Seite>`, Zeitraum 60 Tage, alle Seiten bis leer); Quelle `augusto` (`https://augusto-sachsen.de/veranstaltungen/api/1.0/export/<stadt-slug>/list?date_from=…&date_to=…&p=<Seite>`, Konfiguration `slugs:[…]` zunächst `stadt-bautzen`; weitere Orte erst nach Fixture-Prüfung, welche Slugs existieren).

- [ ] **Step 1:** Fixtures holen (RSS; je eine Seite Görlitz und Augusto mit mindestens einer Dauerausstellung bzw. einem mehrtägigen Eintrag, falls vorhanden).
- [ ] **Step 2: Tests schreiben.** `bischofswerda: Eintrag mit AUSVERKAUFT hat ticketStatus 'ausverkauft' und bereinigten Titel`; `goerlitz: Dauerausstellung (Kategorie Ausstellung oder Dauer über 14 Tage) wird verworfen` (Review Focus 2); `goerlitz: mehrtägiger Markt bleibt ein Termin mit end nach start`; `augusto: Pagination endet bei leerer Seite`; `augusto: Telefonnummer im Text wird contact.phone`. Jeweils: `jeder Termin hat sources[0].url`.
- [ ] **Step 3:** Tests; Erwartung: FAIL. Implementieren; `goerlitz` und `augusto` stehen in `sources.json` mit `"enabled": true`, aber mit Kommentarfeld `"note":"Nutzungsrecht angefragt, bei Nein abschalten"`.
- [ ] **Step 4:** Tests; Erwartung: PASS. Commit `feat: Adapter Bischofswerda, Görlitz, Augusto`.

### Task 9: Tschechien (GoOut) und Ticketmaster

**Files:**
- Create: `src/sources/goout.js`, `src/sources/ticketmaster.js`, `test/goout.test.js`, `test/ticketmaster.test.js`, Fixtures
- Modify: `src/normalize.js` (tschechische Statuswörter ergänzen, falls fehlend), `src/sources/index.js`, `sources.json`

**Interfaces:**
- Consumes: `extractSchemaEvents`.
- Produces: Quelle `goout` (Städte `decin`, `usti-nad-labem`, `liberec`, `ceska-lipa`; Einstieg über `https://goout.net/sitemaps/city-CS-0.xml`, dann Kategorie-Seiten `koncerty`, `parties`, `jine-akce`; JSON-LD; `offers.availability` `InStock`→`verfuegbar`, `OutOfStock`→`ausverkauft`; Quelle setzt `country:'CZ'`; `startDate`-Text wie 'Sat Nov 14 2026 19:00:00 GMT+0000 (Coordinated Universal Time)' wird zu Berlin-ISO geparst). Quelle `ticketmaster` (Discovery API v2, Schlüssel aus `process.env.TICKETMASTER_API_KEY`, `latlong`=CENTER, `radius=75`, `unit=km`, `countryCode=DE`; `dates.status.code`: `onsale`→`verfuegbar`, `offsale`→`ausverkauft`, `cancelled`/`canceled`→`abgesagt`, `postponed`/`rescheduled`→`verlegt`). Ohne Schlüssel liefert die Quelle `[]` und der Status meldet `error:'kein Schlüssel'`.

- [ ] **Step 1:** Fixtures holen (GoOut: Liberec-Konzertseite; Ticketmaster: erst Test-Abruf, siehe Step 2).
- [ ] **Step 2: Probe (Auftraggeber legt den Schlüssel an, siehe Task 12).** Ein Abruf gegen die API, Ergebnis (Anzahl Termine im Radius, davon in Bautzen/Görlitz/Zittau) in `docs/quellen-probe.md` festhalten. Sind es 0 Termine, in `sources.json` `"enabled": false` setzen und das dort vermerken.
- [ ] **Step 3: Tests schreiben.** `goout: InStock ergibt 'verfuegbar', OutOfStock 'ausverkauft', fehlendes offers null`; `goout: country ist 'CZ'`; `goout: nicht-ISO startDate wird zu '2026-11-14T20:00:00+01:00' (Berlin) geparst`; `ticketmaster: Statuszuordnung für alle fünf Codes`; `ticketmaster: ohne Schlüssel leer und Fehlertext`.
- [ ] **Step 4:** Tests; Erwartung: FAIL. Implementieren.
- [ ] **Step 5:** Tests; Erwartung: PASS. Commit `feat: Adapter GoOut und Ticketmaster`.

### Task 10: Kleine Veranstaltungen

**Files:**
- Create: `src/sources/gefluegel.js`, `src/sources/maerkte.js`, `src/sources/neustadthalle.js`, `src/sources/stolpen.js`, je ein Test und Fixtures
- Modify: `src/sources/index.js`, `sources.json`

**Interfaces:**
- Produces: Quelle `gefluegel` (`https://www.rassegefluegel-oberlausitz.de/veranstaltungen/rubrik.php?nummer=5551`, Liste plus Detailseiten mit JSON-LD, `Art` immer `schau`, `perHostDelayMs` mindestens 10000 wegen Crawl-delay 10, alle 51 Detailseiten höchstens einmal je Lauf); Quelle `maerkte` (`meine-flohmarkt-termine.de` PLZ-Seite 01 und 02, `meine-kunsthandwerker-termine.de`, JSON-LD, `Art` `markt`); Quelle `neustadthalle` (`neustadthalle.de`, Text "Ausverkauft!"→`ausverkauft`, Reservix-Link→`ticketUrl`); Quelle `stolpen` (`stolpen.de/liste-aller-veranstaltungen`, Detailseiten nur wenn dort Kontaktangaben stehen).

- [ ] **Step 1:** Fixtures holen.
- [ ] **Step 2: Tests schreiben.** `gefluegel: Termine haben art 'schau' und einen Ort`; `gefluegel: zwei Detailabrufe liegen mindestens 10 s auseinander` (mit gefälschter Uhr); `maerkte: Mehrtagesmarkt bleibt ein Termin` (Review Focus 2); `neustadthalle: 'Ausverkauft!' erkannt`; `stolpen: Termin ohne Veranstalter hat leeren contact und weiterhin einen Quellenlink`.
- [ ] **Step 3:** Tests; Erwartung: FAIL. Implementieren.
- [ ] **Step 4:** Tests; Erwartung: PASS. Commit `feat: Adapter kleine Veranstaltungen`.

### Task 11: Webseite (PWA) mit Filtern

**Files:**
- Create: `site/index.html`, `site/style.css`, `site/js/filter.js`, `site/js/render.js`, `site/js/app.js`, `site/manifest.webmanifest`, `site/sw.js`, `site/icons/icon-192.png`, `site/icons/icon-512.png`, `test/filter.test.js`, `test/render.test.js`
- Modify: `package.json` (Entwicklungsabhängigkeit `linkedom`)

**Interfaces:**
- Consumes: Datenformat `Event` und `SourceStatus`.
- Produces: `applyFilters(events:Event[], prefs:Prefs, nowIso:string) -> Event[]`, `groupByDay(events:Event[]) -> {day:string, events:Event[]}[]`, `loadPrefs(storage:Storage) -> Prefs`, `savePrefs(storage:Storage, prefs:Prefs) -> void` mit `Prefs = {hiddenArt:Art[], hiddenTags:string[], maxKm:number, showCZ:boolean}` (Standard: nichts ausgeblendet, 75, true; kaputtes oder fehlendes Storage ergibt Standard ohne Ausnahme). `renderEventCard(doc:Document, ev:Event) -> HTMLElement`, `renderStatusFooter(doc:Document, status:SourceStatus[]) -> HTMLElement`.

Karte: Titel, Art, Datum/Uhrzeit, Ort mit Entfernung (leer bei `null`), Status-Marke nur bei gesetztem `ticketStatus`, Knöpfe "Anrufen" (`tel:`), "Zur Webseite", "E-Mail" jeweils nur wenn der Wert existiert, Quellenlinks, Hinweis "bitte prüfen" bei `needsReview`. Filterleiste: Art-Chips zum Aus-/Einblenden, Schieberegler Entfernung, Schalter "Tschechien". Gruppierung nach Tag, "Heute" und "Morgen" benannt. Fußzeile nennt Quellen mit `ok:false` ("Quelle X seit <lastOkAt> ohne Daten"). Der Service Worker legt `events.json` und die Seite zwischen (offline lesbar, nach Netz erneuert).

- [ ] **Step 1: Tests schreiben.** `applyFilters blendet hiddenArt aus`; `applyFilters blendet Termine über maxKm aus, behält distanceKm null`; `applyFilters blendet CZ bei showCZ false aus`; `applyFilters entfernt Termin von gestern, behält heute` (Review Focus 5); `groupByDay sortiert aufsteigend`; `loadPrefs liefert Standard bei kaputtem JSON`; Rendern: `Titel '<img src=x onerror=alert(1)>' wird als Text dargestellt, kein img-Element in der Karte` (Review Focus 4); `ohne contact keine Knöpfe Anrufen/Webseite/E-Mail`; `ticketStatus null zeigt keine Status-Marke`; `ticketStatus 'verfuegbar' zeigt 'Karten verfügbar', 'ausverkauft' zeigt 'ausverkauft'`; `tel:-Link enthält nur Ziffern und +`; `Linkziele mit javascript: werden nicht als Link ausgegeben`.
- [ ] **Step 2:** Tests; Erwartung: FAIL.
- [ ] **Step 3:** Implementieren, ausschließlich `textContent` und `setAttribute` für Fremdwerte (nie `innerHTML`); Linkziele nur wenn sie mit `https://`, `http://`, `tel:` oder `mailto:` beginnen. Layout handyzuerst, 16-px-Seitenränder, helles und dunkles Farbschema. Das Aussehen ist bewusst schlicht; der Feinschliff ist ein späterer Schritt.
- [ ] **Step 4:** Tests; Erwartung: PASS. Mit `node src/build.js` echte Daten erzeugen, `npx http-server site -p 8080` starten und die Seite auf Handybreite (375 px) prüfen: Filter schalten, Reload behält Filter, Flugmodus zeigt zuletzt geladene Daten.
- [ ] **Step 5:** Commit `feat: Webseite mit Filtern und PWA`.

### Task 12: Tägliche Veröffentlichung, Einrichtungsanleitung, Anfragen

**Files:**
- Create: `.github/workflows/daily.yml`, `docs/SETUP.md`, `docs/anfragen/` mit je einer Vorlage für DDV/Augusto, Stadt Görlitz, GoOut, Oberlausitzer Geflügelzüchterverband, Betreiber des Dresdner Stadtkalenders, `docs/quellen-probe.md` (falls nicht schon vorhanden)

**Interfaces:**
- Consumes: `npm test`, `npm run build`.
- Produces: Workflow, der täglich um 04:17 UTC und per Hand läuft: `npm ci`, `npm test`, `npm run build`, Seite nach `_pages/<SITE_CODE>/` kopieren (Repository-Variable `SITE_CODE`, Zufallszeichenfolge), `actions/upload-pages-artifact`, `actions/deploy-pages`. Das Geheimnis `TICKETMASTER_API_KEY` wird als Umgebungsvariable gereicht. Schlägt `npm test` fehl, wird nicht veröffentlicht; schlägt nur eine Quelle fehl, wird trotzdem veröffentlicht.

- [ ] **Step 1: Workflow schreiben.** Die Syntax wird durch den ersten Lauf in Step 4 geprüft.
- [ ] **Step 2: `docs/SETUP.md` für den Auftraggeber** (jeder Schritt mit erwartetem Ergebnis): GitHub-Konto anlegen (Auftraggeber), `gh auth login` (Auftraggeber), `gh repo create eventkalender --public --source . --push`, Pages aktivieren (Quelle: GitHub Actions), `gh variable set SITE_CODE --body <Zufallscode>`, Ticketmaster-Entwicklerschlüssel anlegen und mit `gh secret set TICKETMASTER_API_KEY` hinterlegen, Workflow per Hand starten, Adresse auf dem Handy öffnen und zum Startbildschirm hinzufügen.
- [ ] **Step 3: Anfrage-Vorlagen** (Deutsch, kurz): wer wir sind (privates Projekt, höchstens 20 Personen), was übernommen wird (Name, Datum, Ort, Kontakt), wie oft (höchstens 3-mal täglich), Link zurück zur Quelle, "bei Nein schalten wir diese Quelle sofort ab". Die Vorlagen werden nicht von Claude verschickt, der Auftraggeber sendet sie selbst.
- [ ] **Step 4: Abnahme am echten System.** Workflow starten, Lauf grün, `status.json` zeigt alle aktivierten Quellen mit `ok:true` oder einem erklärbaren Fehler; Seite zeigt Termine aus mindestens fünf Quellen, mindestens einen Termin mit Telefon-Knopf, einen tschechischen Termin und einen mit Status "ausverkauft". Ergebnis (Anzahl Termine je Quelle) in `docs/quellen-probe.md` eintragen.
- [ ] **Step 5:** Commit `feat: tägliche Veröffentlichung und Einrichtungsanleitung`.

## Hinweise für den Auftraggeber (Vorabinformation)

- **Erreichbarkeit:** GitHub Pages ist im kostenlosen Tarif technisch öffentlich. Der Zufallscode im Link ist nur Verschleierung, kein Schutz. In Phase 1 stehen dort ausschließlich öffentliche Fakten aus den Quellen. Der echte Zugangsschutz für Einträge von Freunden kommt in Plan 2.
- **Zu erledigen durch den Auftraggeber:** GitHub-Konto, Ticketmaster-Schlüssel, Versand der Anfragen an die Quellen.
- **Nicht in diesem Plan:** Nachtragen (Formular und Foto), KI-Auswertung samt 5-€-Grenze, Zeitungs-PDFs, Übersetzung tschechischer Beschreibungen (Plan 2 und 3), schickeres Aussehen.
- **Bewusst später, weil aufwendig oder erst nach Rückfrage:** Steinhaus Bautzen und Gerhart-Hauptmann-Theater Görlitz (Kartenstatus im Seitencode), Dresdner Stadtkalender (erst Erlaubnis beim Betreiber), Konzertkasse Dresden (nur erlaubte Pfade), Visit Liberec und Kudy z nudy, Bautzener Heimatzeitung. Sie lassen sich später als weitere Adapter nach dem Muster aus Task 5 ergänzen.
