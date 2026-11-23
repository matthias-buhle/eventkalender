# Neue Filterseite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App öffnet mit einer Filterseite (Wann mit Kalender, Was als Kacheln mit Zähler, Wo mit Umkreis um den gewählten Ort); „Sonstiges“ ist in 13 Rubriken zerlegt, und Termine ohne Koordinaten werden automatisch verortet.

**Architecture:** Zuerst die Daten (Tasks 1–5, `src/`): jeder Termin bekommt die Felder `rubrik`, `advent` und, wo der Ort nur grob bekannt ist, `ortRegionKm`; fehlende Orte löst der tägliche Lauf über Region der Quelle und Nominatim mit Zwischenspeicher auf. Dann die Anzeige (Tasks 6–11, `site/`): reine Funktionen in `filter.js`/`kalender.js`, DOM-Aufbau in `filterseite.js`, Verdrahtung in `app.js`. Die alten Felder (`art`, `genre`) bleiben, bis einschließlich Task 6 läuft die alte Oberfläche unverändert weiter; ab Task 7 ist die Oberfläche bis Task 10 im Umbau (nicht veröffentlichen). Jede Task endet mit grünem `npm test`.

**Tech Stack:** Node 24 (ES-Module, `node --test`), cheerio, linkedom (nur Tests), reines JavaScript ohne Framework in `site/`, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-23-filterseite-design.md`

## Global Constraints

- Deutsche Texte in der Oberfläche; Handy zuerst; hell und dunkel (Farben nur über die Variablen in `site/style.css`).
- Fremdwerte kommen nur über `textContent`/`setAttribute` ins DOM, nie über `innerHTML` (Regel aus `site/js/render.js`).
- Kein Framework, keine neuen Laufzeit-Abhängigkeiten. `site/` kann `src/` nicht laden (und umgekehrt nur über Tests); Schlüssel und Namen, die beide Seiten brauchen, werden doppelt geführt und durch einen Gleichlauf-Test gesichert (wie `test/normalize.test.js`, „Unterarten stehen in Erkennung …“).
- 13 Rubriken in dieser Reihenfolge: Konzerte, Märkte, Ausstellungen & Museen, Schauen, Feste, Partys, Führungen, Wandern & Natur, Kurse & Vorträge, Theater & Lesungen, Essen & Trinken, Kinder & Familie, Sonstiges. Jeder Termin gehört genau einer Rubrik; kein Termin verschwindet; keine Rubrik enthält mehr als 20 % aller Termine.
- Umkreisstufen **10, 25, 50, 75 km**, Standard **75 km**. Mittelpunkt = gewählter Ort (Standard Sebnitz).
- **Wochenende steht bei jedem Start vorgewählt; der Zeitraum (`zeit`, `von`, `bis`) und der Suchtext werden nie gespeichert.** Gemerkt werden Rubriken, Unterfilter, Advent-Schalter, Ort, Umkreis, Tschechien-Schalter.
- Nominatim: höchstens 1 Anfrage pro Sekunde, jede Antwort (auch „kein Treffer“) in `site/data/orte-cache.json`, nie zweimal fragen; Annahmeradius 15 km (Augusto 30 km), je Quelle in `sources.json` als `nachschlagenKm`.
- Vermerk bei Terminen ganz ohne Ort: **„Ort nicht genau bekannt“**. Im Über-Fenster: **„© OpenStreetMap-Mitwirkende (ODbL)“** und der Abschnitt **„Anbieter und Kontakt“** mit „Matthias | B“, „Schönbach, Sebnitz“ und `buehnenlicht@mbuhle.de`, ohne Straße und Telefon.
- Termine am Regionsmittelpunkt zählen für den Umkreis wie genau verortete und tragen keinen Vermerk. Termine ganz ohne Koordinaten bleiben bei jedem Umkreis sichtbar.
- Die bestehenden Tests laufen weiter (`npm test`, heute 351) und werden angepasst, wo sich gewolltes Verhalten ändert. Commit-Nachrichten deutsch im Stil `feat:`/`fix:`/`docs:`, mit der Zeile `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- `npm run build` (greift die Quellen ab) und Pushen nur auf Anweisung des Nutzers; `site/data/` ist git-ignoriert.

## Review Focus

1. **Alte Daten ohne `rubrik`** (die Seite zeigt noch ein zwischengespeichertes `events.json`): der Termin fällt nach seiner `art` in eine Rubrik, verschwindet nie und bricht nichts. Test in Task 6.
2. **Termin ohne Koordinaten bei Umkreis um Görlitz/Dresden**: bleibt sichtbar, trägt „Ort nicht genau bekannt“. Tests in Task 6 und 7.
3. **Mehrtägiger Termin** (Weihnachtsmarkt 24.11.–23.12., Ausstellung über Monate): zählt auf Kacheln und Kalenderpunkten an jedem Tag, an dem er läuft, auch über den Jahreswechsel. Tests in Task 7 und 8.
4. **Alte gespeicherte Einstellungen** (`hiddenArt`, `zeit: "60"`, `maxKm: 5`, kaputtes JSON): kein Absturz, Zeitraum = Wochenende, Umkreis rastet auf die nächste Stufe ≥ Wert. Test in Task 7.
5. **Nominatim fällt aus** (Zeitüberschreitung, 429, 5xx, leere Antwort): der Lauf endet erfolgreich, vorübergehende Fehler werden nicht zwischengespeichert, nach 5 Fehlern in Folge werden keine weiteren Anfragen mehr gestellt. Test in Task 5.
6. **Wörter wie „Stollen“ in Bergwerksführungen** dürfen nicht als Advent zählen. Test in Task 3.

---

### Task 1: Rubriken zuordnen (Daten)

**Files:**
- Create: `src/rubriken.js`, `test/rubriken.test.js`, `scripts/bericht.js`
- Modify: `src/model.js` (Typ `Event` und `makeEvent`: Feld `rubrik`, Vorgabe `null`), `src/build.js:19-31` (`genreVon`/`anreichern`), `test/model.test.js`, `test/build.test.js`

**Interfaces:**
- Produces in `src/rubriken.js`:
  - `RUBRIKEN: {key:string, name:string, karte:string, art:string}[]` — die 13 Rubriken in Kachelreihenfolge. Schlüssel: `konzert, markt, ausstellung, schau, fest, party, fuehrung, wandern, kurse, theater, essen, kinder, sonstiges`. `name` = Kachelname (Global Constraints), `karte` = Einzahl für die Karte (Konzert, Markt, Ausstellung, Schau, Fest, Party, Führung, Wandern & Natur, Kurs & Vortrag, Theater & Lesung, Essen & Trinken, Kinder & Familie, Sonstiges), `art` = bestehende Farbfamilie (`konzert`, `markt`, `schau` für ausstellung und schau, `fest`, `party`, alle übrigen `sonstiges`).
  - `UNTERARTEN: Record<string, Record<string,string>>` — Unterfilter je Rubrik (Schlüssel → Anzeigename): `konzert` = `GENRES`, `markt` = `MARKT_SORTEN`, `party` = `PARTY_SORTEN`, `fest` = `FEST_SORTEN` (alle aus `normalize.js`), `schau` = `{tiere:'Tier- & Zuchtschau', hobby:'Messe & Hobby'}`, `ausstellung` = `{kunst:'Kunst & Foto', museum:'Museum & Geschichte'}`, `fuehrung` = `{stadt:'Stadt & Ort', untertage:'Untertage & Bergwerk', brauerei:'Brauerei & Bäckerei', kinder:'Kinderführung'}`. Rubriken ohne Eintrag haben keine Unterfilter.
  - `rubrikUndGenre(e: {art:string, genre?:string|null, title:string, description?:string|null}): {rubrik:string, genre:string|null}`
- `src/build.js` `anreichern` setzt `rubrik` und `genre` aus `rubrikUndGenre`; `art` bleibt unverändert.
- `scripts/bericht.js` (Prüfwerkzeug für diese und die nächsten Tasks): `node scripts/bericht.js [--schreiben]` liest die lokale, git-ignorierte `site/data/events.json`, wendet `rubrikUndGenre` (ab Task 3 auch `istAdvent`) an und druckt je Rubrik Anzahl und Anteil, die Konzert-Genres, die Zahl der Advent-Termine, die Zahl der Termine ohne Koordinaten und eine Stichprobe von 15 Titeln je Rubrik; mit `--schreiben` schreibt es `rubrik`, `genre` und `advent` in die Datei zurück (für die Browserprüfung in Task 10).

- [ ] **Step 1: Failing tests in `test/rubriken.test.js`** (Namen und Zusicherungen):
  - `RUBRIKEN hat 13 eindeutige Schlüssel in der Reihenfolge der Spec` (`RUBRIKEN.map(r=>r.key)` deepEqual obiger Liste).
  - `art konzert/markt/party/fest bleibt gleichnamige Rubrik`: `rubrikUndGenre({art:'markt', title:'Weihnachtsmarkt Sebnitz'})` → `{rubrik:'markt', genre:'weihnachtsmarkt'}`.
  - `schau: Kunst und Museum werden Ausstellungen, Tier und Hobby bleiben Schauen`: Titel „Kunstausstellung in der Galerie“ → `ausstellung`/`kunst`; „Kleintierschau Hainewalde“ → `schau`/`tiere`; „Sonderausstellung im Museum“ → `ausstellung`/`museum`; Titel „Ausstellung“ ohne weitere Wörter → `ausstellung`/`null`; Titel „Modellbahnbörse“ (art schau) → `schau`/`hobby`.
  - `Führung im Titel gewinnt vor Museum und vor Sonstigem`: art schau, Titel „Führung durch das Museum“ → `fuehrung`; art sonstiges, „Mühlen- und Bäckereiführung“ → `fuehrung`/`brauerei`; „Kuratorenführung zur TRAUMZEIT“ → `fuehrung`; „Kinderführung im Schloss“ → `fuehrung`/`kinder`; „Besichtigung des Stollens“ → `fuehrung`/`untertage`.
  - `sonstiges wird nach Stichwörtern zerlegt` (je `art:'sonstiges'`): „Geführte Wanderung rund um Berggießhübel“ → `wandern`; „Archäologischer Vortrag: Von Teufelssteinen“ → `kurse`; „Vorlesestunde“ → `theater`; „Steinhaus-Kino: Vaterland“ → `theater`; „Kaffeeklatsch“ → `essen`; „Laternebasteln im Schuberts e.V.“ → `kinder`; „Karaoke-Abend“ → `sonstiges`; „Carmen“ mit Beschreibung „Oper am Theater“ → `theater`.
  - `Reihenfolge der Regeln`: „Kindertheater“ → `theater` (Theater vor Kinder); „Theaterdinner“ → `theater`.
  - `Quellen-Genre zählt nur, wenn es zur Rubrik passt`: `{art:'konzert', genre:'jazz', title:'X'}` → `genre:'jazz'`; `{art:'markt', genre:'jazz', title:'Flohmarkt'}` → `genre:'troedel'`.
  - `jeder Termin bekommt genau eine bekannte Rubrik`: für ein Feld aus unsinnigen Eingaben (`art:undefined`, `title:''`, `description:null`) liefert die Funktion `sonstiges`, wirft nie.
- [ ] **Step 2: Run** `node --test test/rubriken.test.js` — Expected: FAIL (Modul fehlt).
- [ ] **Step 3: Implement `src/rubriken.js`** wie oben. Ablauf in `rubrikUndGenre`: Art `konzert|markt|party|fest` → gleichnamige Rubrik, Unterart `passendeSorte(art, e.genre) ?? detectSorte(art, e.title, e.description)` (beide aus `normalize.js`). Art `schau`: Titel mit `f[uü]hrung` → Rubrik `fuehrung`; sonst `sorte = passendeSorte('schau', e.genre) ?? detectSorte('schau', title, description)`, `kunst|museum` → `ausstellung`, `tiere|hobby` → `schau`, `null` → `ausstellung`, wenn Titel oder Beschreibung `ausstellung` enthält, sonst `schau`. Alle anderen Arten: erste passende Regel in der Reihenfolge `fuehrung, theater, kurse, wandern, essen, kinder`, sonst `sonstiges`. Startwerte der Regeln (Kleinschreibung, Titel vor Beschreibung, an den echten Daten nachschärfen): fuehrung `/f[uü]hrung|rundgang|besichtigung|stadtrundfahrt/`; theater `/theater|lesung|vorlese|b[uü]hne|schauspiel|puppenspiel|kabarett|\bkino\b|\bfilm\b|oper\b|autorengespr/`; kurse `/\bkurs\b|workshop|vortrag|seminar|schulung|infoabend|lehrgang|sprechstunde|kinderuni/`; wandern `/wander|spaziergang|exkursion|radtour|nachtwanderung|vogelbeobacht|naturf/`; essen `/essen\b|kulinar|brunch|dinner|verkostung|\bwein|\bbier|brauerei|backen|k[oö]chen|schlachtfest|gans\b|grill|fr[uü]hst[uü]ck|kaffee|kuchen|glühwein/`; kinder `/kinder|familie|m[aä]rchen|krabbel|ferienprogramm|zirkus|basteln/`. Führungs-Unterarten in dieser Reihenfolge: `kinder` `/kinder|familie/`, `untertage` `/bergwerk|untertage|stollen|h[oö]hle|schacht|bergbau|salz/`, `brauerei` `/brau|b[aä]cker|m[uü]hle|manufaktur|distill|r[oö]sterei/`, `stadt` `/stadt|altstadt|rundgang|dorf|spazier/`, sonst `null`.
- [ ] **Step 4: In `src/model.js`** `rubrik: rest.rubrik ?? null` in `makeEvent` (Typ ergänzen); Test in `test/model.test.js`: `makeEvent(...)` ohne Angabe → `rubrik === null`, mit Angabe bleibt sie.
- [ ] **Step 5: In `src/build.js`** `anreichern` ersetzt `genre: genreVon(e)` durch `const { rubrik, genre } = rubrikUndGenre(e)` (Rückgabe `{...e, rubrik, genre, ...}`); `genreVon` und die Importe `detectSorte, passendeSorte` entfallen dort. Test in `test/build.test.js`: ein Termin `art:'sonstiges', title:'Mühlen- und Bäckereiführung'` aus `runAll` hat `rubrik:'fuehrung'`, `genre:'brauerei'`; ein Konzert hat `rubrik:'konzert'`. Bestehende Tests, die `genre` prüfen, bleiben grün.
- [ ] **Step 6: Bestand prüfen**: `scripts/bericht.js` anlegen, `node scripts/bericht.js`. Expected: alle 13 Rubriken ≥ 1 Termin, **keine Rubrik > 20 %** (insbesondere `sonstiges`), Summe = Gesamtzahl. Regeln nachschärfen, bis das stimmt; auffällige Fehlzuordnungen in der Stichprobe je Rubrik korrigieren.
- [ ] **Step 7: Run** `npm test` — Expected: PASS.
- [ ] **Step 8: Commit** `git add src test scripts && git commit -m "feat: 13 Rubriken statt Sonstiges-Sammelbecken (Feld rubrik)"`

---

### Task 2: Konzert-Genres verbessern, Kirchenmusik

**Files:**
- Modify: `src/normalize.js` (`GENRES`, `GENRE_REGELN`), `test/normalize.test.js` (inkl. Gleichlauf-Test auf `UNTERARTEN`)

**Interfaces:**
- Produces: neuer Genre-Schlüssel `kirche` mit Namen `Kirchenmusik` in `GENRES` (steht in der Anzeige nach „Klassik & Chor“); `detectGenre` erkennt mehr Konzerte.

- [ ] **Step 1: Failing tests** in `test/normalize.test.js` (`detectGenre` mit dem Titel als einzigem Argument): „Camerata Cantorum - Ein Chorkonzert zur Einstimmung auf die Adventszeit“ → `klassik`; „A4u – DIE ABBA REVIVAL SHOW“ → `rock-pop`; „Herbstkonzert "Böhmisch mit Herz"“ → `schlager-folk`; „Alive Worship“ → `kirche`; „Gottesdienstmusik zum Drittletzten Sonntag“ → `kirche`; „Kirchenkonzert“ → `kirche`; „Orgelkonzert“ → `klassik` (Orgel bleibt Klassik); „Milow“ → `null`. Der bestehende Test auf `SORTEN`-Gleichlauf zwischen `src` und `site` wird in Task 6 auf `UNTERARTEN` umgestellt, hier nur `kirche` in beide Listen (`src/normalize.js`, `site/js/arten.js` `SORTEN.konzert.liste`) aufnehmen, damit er grün bleibt.
- [ ] **Step 2: Run** `node --test test/normalize.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** in `src/normalize.js`: `kirche: 'Kirchenmusik'` in `GENRES` (nach `klassik`), eine Regel `['kirche', /kirchenmusik|kirchenkonzert|kirchenschiff|gottesdienst|andacht|gospel|worship|choral|kantorei/]` **vor** der Regel `klassik` einfügen; `rock-pop` um `revival|tribute|cover.?band|\bcoverband` erweitern, `schlager-folk` um `b[oö]hmisch|egerl[aä]nder|dudelsack|tanzmusik`, `klassik` um `camerata|cantorum|adventskonzert|weihnachtskonzert|weihnachtsoratorium`. Gleiches Feld `kirche` in `site/js/arten.js` (`SORTEN.konzert.liste`, gleiche Position).
- [ ] **Step 4: Bestand prüfen**: `node scripts/bericht.js` — Expected: Anteil der Konzerte mit Genre **≥ 55 %** (heute 34 %); die Stichprobe der verbliebenen genrelosen Titel ansehen und offensichtlich Lohnendes (Bandnamen mit Zusatz „Live“, „Konzert & …“) nur aufnehmen, wenn die Regel nicht Fremdes trifft.
- [ ] **Step 5: Run** `npm test` — Expected: PASS. **Commit** `git commit -am "feat: Konzert-Genres besser erkannt, neues Genre Kirchenmusik"`

---

### Task 3: Advent-Kennzeichen

**Files:**
- Modify: `src/rubriken.js`, `src/model.js` (`advent: rest.advent ?? false`), `src/build.js` (`anreichern`), `scripts/bericht.js`, `test/rubriken.test.js`, `test/model.test.js`, `test/build.test.js`

**Interfaces:**
- Produces: `istAdvent(e: {rubrik:string|null, genre:string|null, title:string, description?:string|null}): boolean` in `src/rubriken.js`; Feld `advent: boolean` am Termin.

- [ ] **Step 1: Failing tests** in `test/rubriken.test.js`: `istAdvent` ist wahr bei `genre:'weihnachtsmarkt'` (rubrik markt) und bei `genre:'weihnachten'` (rubrik fest) ohne Wörter im Text; wahr bei Titel „Adventskonzert“ und Beschreibung mit „Nikolaus“, „Weihnacht“, „Christkind“, „Pyramide“, „Winterzauber“; wahr bei Titel „Lichterglanz auf dem Markt“ und „Original Dresdner Stollen backen“; **falsch** bei Rubrik `fuehrung`, Titel „Führung durch den Stollen“ (Bergwerk) und bei Beschreibung „… durch die Lichter der Stadt“ (Stollen/Lichter zählen nur im Titel); wahr bei Rubrik `fuehrung`, Titel „Adventsführung“; falsch bei „Sommerfest“; wirft nie bei `description: null`. In `test/model.test.js`: Vorgabe `advent === false`. In `test/build.test.js`: ein Termin „Weihnachtsmarkt Sebnitz“ hat nach `runAll` `advent === true`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `istAdvent` (Wörter `advent|weihnacht|nikolaus|christkind|pyramide|winterzauber` in Titel oder Beschreibung; `stollen|lichter` nur im Titel; Rubrik `fuehrung` zählt nur über die erste Wortgruppe), in `anreichern` aufrufen (`advent: istAdvent({ rubrik, genre, title, description })`), in `makeEvent` das Feld ergänzen, `scripts/bericht.js` ruft `istAdvent` auf (Zahl und 20 Beispieltitel).
- [ ] **Step 4: Bestand prüfen**: `node scripts/bericht.js` — Expected: eine plausible Zahl (Stichprobe von 20 Titeln ansehen: keine Fremdtreffer wie „Stollen“-Führungen).
- [ ] **Step 5: Run** `npm test` — PASS. **Commit** `git commit -am "feat: Advent-Kennzeichen beim täglichen Lauf"`

---

### Task 4: Ortszuordnung Teil 1 — Region und Titel

**Files:**
- Modify: `src/model.js` (`ortRegionKm: rest.ortRegionKm ?? null`, Typ), `src/sources/culturebase.js` (`zuEvents`, `ortVon`, `zuEvent`), `src/sources/augusto.js`, `src/sources/goerlitz.js`, `src/build.js` (`anreichern`), `src/dedupe.js` (`merge`), `sources.json`, Tests `test/augusto.test.js`, `test/goerlitz.test.js`, `test/build.test.js`, `test/dedupe.test.js`, `test/model.test.js`

**Interfaces:**
- Produces: Feld `ortRegionKm: number|null` — gesetzt, wenn `lat/lon` nur der Mittelpunkt der Region der Quelle sind; Wert = Annahmeradius in km für die spätere Feinsuche (Task 5). `zuEvents(zeilen, {quelle, linkFuer, fallbackPlace, fallbackKm})`.

- [ ] **Step 1: Failing tests**:
  - `augusto`/`goerlitz`: wie die bestehenden `fallbackPlace`-Tests (`test/augusto.test.js:87`, `test/goerlitz.test.js:122`) mit `config.nachschlagenKm: 30` bzw. `15` → `e.ortRegionKm === 30` bzw. `15`; ohne Angabe in der Config `15`; Spielstätte, die `resolvePlace` selbst kennt → `ortRegionKm === null`.
  - `build`: Termin ohne `lat/lon`, `placeName:'Vereinsheim, Neusalza-Spremberg'` bekommt Koordinaten, wenn der Ort im Verzeichnis steht (bestehendes Verhalten); Termin ohne Koordinaten, dessen `placeName` unbekannt ist, aber dessen **Titel** einen Ort aus `src/places.json` nennt („Lokalschau Neusalza-Spremberg“ mit `placeName:'Vereinsheim, Unbekanntdorf'`) bekommt die Koordinaten dieses Orts; Termin mit `ortRegionKm` gesetzt nutzt den Titel **nicht** (Titel „Weihnachtsmarkt Dresden“ bleibt am Regionsmittelpunkt Bautzen); Termin ohne Koordinaten und ohne Treffer bleibt `lat:null`, `distanceKm:null`, im Ergebnis sichtbar.
  - `dedupe`: `a` hat Regionskoordinaten (`ortRegionKm:30`), `b` (gleicher Termin) genaue → Ergebnis hat die Koordinaten von `b` und `ortRegionKm:null`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**: `ortVon` gibt zusätzlich `ortRegionKm: fallbackKm ?? 15` zurück, wenn die Region greift; `augusto.js`/`goerlitz.js` reichen `config.nachschlagenKm` als `fallbackKm` durch; `anreichern` sucht bei `lat == null` und `ortRegionKm == null` zuerst `resolvePlace(e.placeName)`, dann `resolvePlace(e.title)`; `merge` in `dedupe.js` übernimmt genaue Koordinaten von `b`, wenn `a.ortRegionKm != null && b.ortRegionKm == null && b.lat != null`. `sources.json`: `goerlitz.nachschlagenKm: 15`, `augusto.nachschlagenKm: 30`.
- [ ] **Step 4: Run** `npm test` — PASS. Hinweis: Die lokale `events.json` vom 8.11. stammt aus der Zeit vor `fallbackPlace` (`augusto.js` reicht ihn schon durch, siehe `test/augusto.test.js:87`); ob Augusto und Görlitz im echten Lauf keine Termine ohne Koordinaten mehr liefern, zeigt erst der nächste Tageslauf (Übergabe in Task 11).
- [ ] **Step 5: Commit** `git commit -am "feat: Ort aus Region der Quelle und aus dem Titel, Feld ortRegionKm"`

---

### Task 5: Ortszuordnung Teil 2 — Nominatim mit Zwischenspeicher

**Files:**
- Create: `src/ortssuche.js`, `test/ortssuche.test.js`
- Modify: `src/build.js` (`main`, neue exportierte Hilfe `mitEntfernung`), `.github/workflows/daily.yml`, `docs/SETUP.md` (ein Absatz zum Zwischenspeicher, falls dort die anderen beschrieben sind)

**Interfaces:**
- Consumes: `resolvePlace`, `distanceKm`, `CENTER`, `RADIUS_KM` aus `src/geo.js`; `ortskandidaten(name)` aus `src/ortsname.js`; den Client aus `createPoliteClient` (`http.get(url, {as:'json', minDelayMs})`).
- Produces in `src/ortssuche.js`:
  - `suchtexteFuer(e: Event): string[]` — Fragen in Reihenfolge: bei `ortRegionKm != null` genau `"<Spielstätte>, <Region>"` (Spielstätte = `placeName` ohne den Anhang `, Raum <Region>`; leer → keine Frage); bei `lat == null` zuerst der volle `placeName`, dann `ortskandidaten(placeName).hauptort`; sonst `[]`.
  - `ergaenzeOrte(events: Event[], opt: {http, cache: Record<string,Eintrag>, heute: string, maxAnfragen?: number}): Promise<{events: Event[], cache: Record<string,Eintrag>, stats: {treffer:number, ohneTreffer:number, ausCache:number, fehler:number, offen:number}}>` mit `Eintrag = {lat:number|null, lon:number|null, zuletzt:string}` (`lat:null` = endgültig kein Treffer). `maxAnfragen` Vorgabe 400.
  - In `src/build.js`: `mitEntfernung(e): Event` setzt `distanceKm` neu aus `lat/lon`.

- [ ] **Step 0: robots.txt prüfen**: `curl -s https://nominatim.openstreetmap.org/robots.txt`. Sperrt sie `/search`, darf `ergaenzeOrte` nicht über `createPoliteClient` laufen (der bricht dann ab); stattdessen nimmt es eine Funktion `abruf(url) => Promise<json>` mit eigenem Abstand von 1100 ms und demselben `User-Agent`. Andernfalls den Client nutzen. Entscheidung in einem Satz im Kopfkommentar der Datei festhalten.
- [ ] **Step 1: Failing tests** in `test/ortssuche.test.js` (mit Fake-Abruf, der Antworten wie `[{lat:'51.18',lon:'14.43'}]` liefert und Aufrufe zählt):
  - `Treffer in der Nähe wird übernommen`: Termin mit Regionskoordinaten Bautzen (`ortRegionKm:30`), Treffer 8 km entfernt → neue `lat/lon`, `ortRegionKm === null`.
  - `Treffer außerhalb des Annahmeradius wird verworfen und als kein Treffer gemerkt`: Treffer 60 km entfernt bei `ortRegionKm:15` → Koordinaten unverändert, Cache-Eintrag `lat:null`.
  - `ohne Koordinaten und ohne Region zählt der Umkreis um Sebnitz`: Treffer 40 km von `CENTER` → übernommen; Treffer 100 km → verworfen.
  - `zweiter Lauf fragt nicht noch einmal`: mit dem zurückgegebenen `cache` ruft der zweite `ergaenzeOrte`-Lauf den Abruf null Mal auf, `stats.ausCache` > 0; auch „kein Treffer“ wird nicht erneut gefragt.
  - `Abfrageurl`: enthält `format=jsonv2`, `limit=1`, `countrycodes=de`, `bounded=1` und ein `viewbox` um `CENTER` (±1,1° Länge, ±0,7° Breite), der Suchtext ist URL-kodiert.
  - `Fehler`: wirft der Abruf (Zeitüberschreitung/HTTP 429/500) → Termin unverändert, `stats.fehler` zählt, **nichts** im Cache; nach 5 Fehlern in Folge keine weiteren Aufrufe, `stats.offen` zählt den Rest; leere Antwort `[]` ist kein Fehler (Eintrag `lat:null`).
  - `maxAnfragen`: bei `maxAnfragen:2` und 5 neuen Fragen genau 2 Aufrufe, `stats.offen === 3`.
  - `Aufräumen`: Cache-Einträge mit `zuletzt` älter als 120 Tage und ohne Verwendung in diesem Lauf fehlen im Ergebnis.
  - `Termine ohne Frage bleiben unberührt` (Termin mit genauen Koordinaten, Termin ohne Ortsname).
- [ ] **Step 2: Run** `node --test test/ortssuche.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement `src/ortssuche.js`** wie oben; die Pause von 1100 ms über `sleep` aus den Optionen (Vorgabe echte Pause), damit Tests sie überspringen können. Keine Ausnahme verlässt `ergaenzeOrte`.
- [ ] **Step 4: `src/build.js`**: `mitEntfernung` aus dem Rechenteil von `anreichern` herauslösen und exportieren. In `main()` nach `runAll` und `pruefeLauf`: `orte-cache.json` aus `outDir` lesen (`readJson(…, {})`), `ergaenzeOrte(roh, {http, cache, heute: todayBerlin(now)})` aufrufen (in `try/catch`: bei Fehler `console.warn` und mit `roh` weiter), das Ergebnis mit `mitEntfernung` neu berechnen und auf `distanceKm == null || distanceKm <= RADIUS_KM` zurückfiltern, Zwischenspeicher nach `site/data/orte-cache.json` schreiben, Kurzbericht ausgeben (`Orte: N neu verortet, M ohne Treffer, K aus dem Zwischenspeicher, F Fehler, O offen`). Test in `test/build.test.js` für `mitEntfernung` (setzt `distanceKm` aus `lat/lon`, `null` ohne).
- [ ] **Step 5: `.github/workflows/daily.yml`**: nach „Rohtermine vom letzten Stand holen“ einen Schritt „Orte-Zwischenspeicher holen“ nach dem Muster der DeepL-Datei (`curl … data/orte-cache.json -o site/data/orte-cache.json || rm -f …`).
- [ ] **Step 6: Run** `npm test` — PASS. **Commit** `git add src test .github docs && git commit -m "feat: Orte ohne Koordinaten über Nominatim mit Zwischenspeicher nachschlagen"`

---

### Task 6: Rubriken und Hinweise in der Anzeige (Seitenbausteine)

**Files:**
- Modify: `site/js/arten.js`, `site/js/render.js`, `test/render.test.js`, `test/normalize.test.js` (Gleichlauf), `test/filter-ort-zeit.test.js` (nur wo `ARTEN` gebraucht wird: bleibt bis Task 7 gültig)

**Interfaces:**
- Produces in `site/js/arten.js` (bestehende Exporte `ARTEN`, `SORTEN`, `sorteFilter`, `sorteName` bleiben, `ARTEN` bis Task 7):
  - `RUBRIKEN: {key, name, karte, farbe}[]` (gleiche 13 wie `src/rubriken.js`; `farbe` = dessen `art`).
  - `SORTEN` jetzt je **Rubrik** (`konzert, party, markt, fest, schau, ausstellung, fuehrung`), gleiche Form wie heute (`titel`, `sonstige`, `sonstigeText`, `liste`); neue Sonstige-Schlüssel `sonstige-ausstellung`, `sonstige-fuehrung`; Titel „Ausstellungen: Sorte“, „Führungen: Sorte“.
  - `rubrikVon(e): string` — `e.rubrik`, wenn bekannt; sonst nach `e.art` (`konzert→konzert, markt→markt, party→party, fest→fest, schau→schau, sonst→sonstiges`).
  - `rubrikName(key): string` (Kachelname), `rubrikKarte(key): string` (Einzahl).
  - `sorteFilter(e)`/`sorteName(e)` arbeiten mit `rubrikVon(e)`.
- `render.js`: Kartenkopf zeigt `rubrikKarte(rubrikVon(ev))` statt `artName`; die CSS-Klasse `art-<art>` bleibt. Liegen weder `lat` noch `lon` als endliche Zahl vor, endet die Ortszeile (Karte **und** Detail) mit „Ort nicht genau bekannt“ (statt der Kilometerangabe).

- [ ] **Step 1: Failing tests**:
  - `test/normalize.test.js`: der Gleichlauf-Test vergleicht `site SORTEN[r].liste` mit `src UNTERARTEN[r]` für jede Rubrik mit Unterarten und `RUBRIKEN` (`key`, `name`, `karte`, `art`↔`farbe`) in beiden Dateien.
  - `test/render.test.js`: Karte mit `rubrik:'fuehrung'` zeigt „Führung“ im `.art`-Element, Karte **ohne** `rubrik` (alte Daten) und `art:'konzert'` zeigt „Konzert“ und bleibt in `.card.art-konzert`; Karte eines `ausstellung`-Termins mit `genre:'kunst'` zeigt „Ausstellung · Kunst & Foto“; Ort-Zeile eines Termins ohne Koordinaten (`lat:null, lon:null, distanceKm:null`) enthält „Ort nicht genau bekannt“, bei einem mit Koordinaten nicht; im Detailfenster gilt dasselbe.
  - neuer Test in `test/filter.test.js` oder `test/arten.test.js`: `rubrikVon({art:'unbekannt'})` → `sonstiges`; `rubrikVon({art:'schau', rubrik:'quatsch'})` → `schau` (unbekannte Rubrik fällt auf `art` zurück).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** wie oben (Schlüssel und Namen exakt wie in Task 1 und 2).
- [ ] **Step 4: Run** `npm test` — PASS. **Commit** `git commit -am "feat: Rubriken in arten.js, Kartenbeschriftung nach Rubrik, Vermerk Ort nicht genau bekannt"`

---

### Task 7: Filterlogik (reine Funktionen)

**Files:**
- Modify: `site/js/filter.js`, `site/js/arten.js` (`ARTEN` entfällt), `test/filter.test.js`, `test/filter-ort-zeit.test.js`

**Interfaces:**
- Consumes: `RUBRIKEN`, `SORTEN`, `rubrikVon`, `sorteFilter`, `rubrikName` aus `site/js/arten.js`.
- Produces in `site/js/filter.js`:
  - `@typedef Prefs = {rubriken:string[], hiddenGenres:string[], hiddenTags:string[], maxKm:10|25|50|75, showCZ:boolean, ort:string|null, advent:boolean, zeit:'alle'|'heute'|'wochenende'|'7'|'30'|'tage', von:string|null, bis:string|null, suche:string}`
  - `UMKREISE = [10,25,50,75]`, `ZEITEN = ['alle','heute','wochenende','7','30','tage']`, `DEFAULT_PREFS` (`zeit:'wochenende'`, `rubriken:[]`, `advent:false`, `maxKm:75`, `von/bis:null`, `ort:null`, `showCZ:true`).
  - `zeitfenster(prefs, heute)`: wie heute, zusätzlich `'tage'` → `{von: max(prefs.von, heute), bis: prefs.bis}`; `'60'` entfällt.
  - `rubrikWaehlen(rubriken: string[], key: string): string[]` (ersetzt `artWaehlen`: antippen schaltet die Rubrik in der Auswahl um; leer = alle; sind am Ende alle 13 gewählt, kommt `[]`), `einzelneRubrik(rubriken): string|null`, `wirksameSorten(prefs)` (nutzt `einzelneRubrik`).
  - `applyFilters(events, prefs, nowIso, orte = {}, optionen = {})` mit `optionen = {ohneRubrik?:boolean, ohneZeit?:boolean, ohneAdvent?:boolean}`; `ohneRubrik` überspringt auch die Unterfilter. Filter: Rubrik über `rubrikVon(e)`, `prefs.advent` verlangt `e.advent === true`.
  - `zaehleRubriken(events, prefs, nowIso, orte): Record<string, number>` — alle 13 Schlüssel, gezählt mit `ohneRubrik`.
  - `zaehleAdvent(events, prefs, nowIso, orte): number` — Termine, die alle Filter außer dem Advent-Schalter erfüllen und `advent` sind.
  - `zusammenfassung(prefs, heute: string): string`, Teile mit „ · “: Zeit („Heute“, „Wochenende“, „7 Tage“, „30 Tage“, „Alle Termine“, ein Tag „Sa 28.11.“, ein Zeitraum „Fr 27.11. – So 29.11.“), Rubriken (keine → „Alle Rubriken“; 1–2 Namen mit „, “; mehr → „N Rubriken“), „Advent“ bei `advent`, Ort „<Ort oder Sebnitz> <maxKm> km“, „ohne Tschechien“ bei `showCZ:false`.
  - `loadPrefs(storage)`/`savePrefs(storage, prefs)`: `savePrefs` lässt `suche`, `zeit`, `von`, `bis` weg; `loadPrefs` liefert immer `zeit:'wochenende'`, `von/bis:null`, ignoriert unbekannte alte Felder (`hiddenArt`), filtert `rubriken` auf bekannte Schlüssel, rastet `maxKm` auf die kleinste Stufe ≥ Wert (über 75 oder ungültig → 75).

- [ ] **Step 1: Failing tests** (bestehende Tests umschreiben, wo sie `hiddenArt`/`artWaehlen`/`'60'` verwenden; neue):
  - `Rubrik filtern`: `prefs({rubriken:['fuehrung']})` lässt nur Termine mit `rubrikVon === 'fuehrung'`; ein Termin ohne `rubrik`, `art:'konzert'` gilt als `konzert` (Review Focus 1).
  - `rubrikWaehlen`: `([], 'konzert')` → `['konzert']`; `(['konzert'], 'markt')` → `['konzert','markt']`; `(['konzert'], 'konzert')` → `[]`; alle 13 → `[]`.
  - `Unterfilter nur bei genau einer Rubrik`: `rubriken:['fuehrung'], hiddenGenres:['kinder']` blendet Kinderführungen aus; bei zwei Rubriken wirkt `hiddenGenres` nicht.
  - `Advent`: `advent:true` lässt nur `advent:true`-Termine durch; `zaehleAdvent` zählt nur Advent-Termine, ignoriert dabei den Schalter selbst.
  - `zaehleRubriken`: gibt alle 13 Schlüssel zurück (0 für leere), zählt bei gewähltem Zeitfenster `tage` 2026-11-28 nur Termine dieses Tages, berücksichtigt `ort` + `maxKm`, `advent` und `showCZ`, ignoriert `rubriken`.
  - `Mehrtägiger Termin` (Review Focus 3): Markt `start 2026-11-24 … end 2026-12-23` wird bei `zeit:'tage', von:'2026-12-31', bis:'2027-01-02'` nicht gezählt, bei `von:'2026-12-20', bis:'2026-12-20'` gezählt.
  - `Ohne Koordinaten sichtbar` (Review Focus 2): Termin `lat:null, lon:null, distanceKm:null` bleibt bei `ort:'Görlitz', maxKm:10` sichtbar.
  - `zeitfenster tage`: `von` vor heute wird auf heute angehoben; `bis:null` bleibt offen.
  - `zusammenfassung`: `DEFAULT_PREFS` → „Wochenende · Alle Rubriken · Sebnitz 75 km“; `{rubriken:['konzert'], ort:'Görlitz', maxKm:25, advent:true}` → „Wochenende · Konzerte · Advent · Görlitz 25 km“; `{zeit:'tage', von:'2026-11-28', bis:'2026-11-28'}` → beginnt mit „Sa 28.11.“.
  - `Einstellungen` (Review Focus 4): `savePrefs` schreibt kein `zeit`/`von`/`bis`/`suche`; `loadPrefs` von `{"hiddenArt":["markt"],"zeit":"60","maxKm":5}` → `rubriken:[]`, `zeit:'wochenende'`, `maxKm:10`; `maxKm:30` → 50; `maxKm:200` → 75; kaputtes JSON und fehlender Speicher → Standard; gespeichertes `{"rubriken":["konzert","gibtsnicht"]}` → `['konzert']`.
- [ ] **Step 2: Run** `node --test test/filter.test.js test/filter-ort-zeit.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** wie oben; `ARTEN` aus `arten.js` entfernen. `site/js/app.js` wird erst in Task 10 neu verdrahtet; bis dahin importiert es entfernte Namen und die Seite startet nicht (Zwischenstand, nicht veröffentlichen). Kein Test lädt `app.js`.
- [ ] **Step 4: Run** `npm test` — PASS. **Commit** `git commit -am "feat: Filterlogik mit Rubriken, Advent, Zeitraum Tage, Umkreisstufen und Zählern"`

---

### Task 8: Kalenderlogik

**Files:**
- Create: `site/js/kalender.js`, `test/kalender.test.js`

**Interfaces:**
- Consumes: `applyFilters`, `lastDay`, `zeitfenster` aus `site/js/filter.js`.
- Produces in `site/js/kalender.js` (rein, ohne DOM):
  - `tageMitTerminen(events, prefs, nowIso, orte): Set<string>` — Tage (`JJJJ-MM-TT`, nie vor heute, höchstens 400 Tage voraus), an denen mindestens ein Termin läuft, der alle Filter außer dem Zeitraum erfüllt (`ohneZeit`); mehrtägige Termine zählen an jedem Tag von `max(start, heute)` bis `lastDay`.
  - `monateMitTerminen(tage: Set<string>, heute: string): string[]` — aufsteigende `JJJJ-MM`; enthält den Monat von `heute` immer.
  - `monatsRaster(monat: string): (string|null)[]` — Zellen für 6 Wochen ab Montag (42 Einträge), `null` für Leerzellen vor und nach dem Monat.
  - `monatsName(monat: string): string` — „November 2026“.
  - `tagWaehlen(prefs, tag): {zeit:'tage', von:string, bis:string}` — erster Tipp (oder Auswahl war keine einzelne Tage-Auswahl, oder `tag` liegt vor dem bisherigen Tag) → ein Tag; zweiter Tipp auf einen späteren Tag bei vorhandenem Einzeltag → Zeitraum; ist schon ein Zeitraum gewählt → neuer Einzeltag; gleicher Tag noch einmal → bleibt Einzeltag.
  - `markierterBereich(prefs, heute): {von:string, bis:string}|null` — das Fenster der Schnellwahl bzw. Tage-Auswahl für die Hervorhebung im Kalender; `null` bei `alle` (offen).

- [ ] **Step 1: Failing tests** in `test/kalender.test.js`: `tageMitTerminen` zählt einen Eintagstermin nur an seinem Tag, einen Markt 24.11.–23.12. an jedem Tag dazwischen, lässt vergangene Tage weg, berücksichtigt `rubriken`, `ort`/`maxKm`, `advent` (Punkte folgen Was und Wo), ignoriert den Zeitraum der Prefs; **Jahreswechsel**: Termin 30.12.–02.01. liefert vier Tage über zwei Jahre, `monateMitTerminen` liefert `['2026-12','2027-01']`; `monatsRaster('2026-11')` beginnt mit sechs `null` (1.11.2026 ist ein Sonntag), enthält `'2026-11-30'` und hat Länge 42; `monatsRaster('2028-02')` enthält `'2028-02-29'`; `monatsName('2026-11') === 'November 2026'`; `tagWaehlen`-Fälle der Beschreibung (je ein Assert, Eingaben als `prefs`-Objekte); `markierterBereich({zeit:'wochenende'}, '2026-11-23')` → `{von:'2026-11-27', bis:'2026-11-29'}`, `{zeit:'alle'}` → `null`, `{zeit:'tage', von, bis}` → dieselben Tage.
- [ ] **Step 2: Run** `node --test test/kalender.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `site/js/kalender.js` wie oben (Tagesrechnung über UTC-Strings wie `tagPlus` in `filter.js`; `tagPlus` dafür aus `filter.js` exportieren, statt zu kopieren).
- [ ] **Step 4: Run** `npm test` — PASS. **Commit** `git add site test && git commit -m "feat: Kalenderlogik (Tage mit Terminen, Raster, Auswahl)"`

---

### Task 9: Filterseite (DOM-Aufbau und Gestaltung)

**Files:**
- Create: `site/js/filterseite.js`, `test/filterseite.test.js`
- Modify: `site/style.css`

**Interfaces:**
- Consumes: alles aus Task 7 und 8, `RUBRIKEN`/`SORTEN`/`rubrikName` aus `arten.js`, `anzeigeText` aus `filter.js`.
- Produces: `baueFilterseite(doc: Document, container: Element, ctx): {aktualisieren(): void}` mit `ctx = {prefs: Prefs, events: object[], orteListe: {name,lat,lon}[], orte: Record<string,{lat,lon}>, jetzt: () => string (ISO), beiAenderung: () => void, beiAnzeigen: () => void}`. Jede Bedienung ändert `ctx.prefs`, ruft `ctx.beiAenderung()` und danach intern `aktualisieren()` (Zahlen, Kalenderpunkte, Markierungen, Knopftext neu). `ctx.events` darf später (nach dem Laden) durch Zuweisung ersetzt und `aktualisieren()` erneut gerufen werden.
- Aufbau (von oben nach unten, alles `textContent`):
  1. Abschnitt **Wann?**: Schnellwahl-Chips `Heute`, `Wochenende`, `7 Tage`, `30 Tage`, `Alle` (`aria-pressed`), darunter ein Chip mit dem gewählten Tag/Zeitraum („Sa 28.11.“), wenn `zeit:'tage'`; darunter der Monatskalender: Kopf `‹ <Monatsname> ›` (Pfeile blättern nur durch `monateMitTerminen`, an den Enden `disabled`), Wochentagszeile `Mo … So`, 42 Zellen als `button` (Leerzellen als `span`), vergangene Tage `disabled`, Tage mit Terminen Klasse `punkt`, heute Klasse `heute`, markierter Bereich (`markierterBereich`) Klasse `gewaehlt` (Anfang `a`, Ende `e`), `aria-label` je Zelle „Samstag, 28. November“ (`dayLabel` aus `render.js` genügt nicht — vollen Wochentag und Monat ausschreiben).
  2. Abschnitt **Was?**: 13 Kacheln `button.kachel` (Name + Zahl aus `zaehleRubriken`, `aria-pressed` bei Auswahl, farbiger linker Rand über die Variable der Farbfamilie `--art-<farbe>`); Kachel mit Zahl 0 trägt zusätzlich Klasse `leer` (blass, bleibt antippbar); bei genau einer gewählten Rubrik mit Unterarten darunter deren Unterfilter-Chips (Logik wie heute, `hiddenGenres`); darunter der Schalter „Nur Advent und Weihnachten (N)“ mit `zaehleAdvent`.
  3. Abschnitt **Wo?**: `select` „Mittelpunkt“ (Orte aus `orteListe`, Standard „Sebnitz“), Umkreis-Chips `10 km`, `25 km`, `50 km`, `75 km`, Kontrollkästchen „Tschechien“.
  4. Knopf `button.btn.primaer` mit `anzeigeText(n)` (n = `applyFilters(...).length`), Klick → `ctx.beiAnzeigen()`.
- `style.css`: Klassen `.filterseite`, `.kacheln` (zwei Spalten), `.kachel`, `.kachel.leer`, `.kalender` (7-Spalten-Raster), `.kalender .punkt::after`, `.kalender .gewaehlt`, `.schalter-advent`; nur vorhandene Farbvariablen verwenden, Zielgröße der Tippflächen ≥ 40 px.

- [ ] **Step 1: Failing tests** in `test/filterseite.test.js` (linkedom wie `test/render.test.js`; `ctx.jetzt` fest `'2026-11-23T10:00:00Z'`, kleine Termin-Liste): 13 Kacheln in der Reihenfolge der Spec mit den erwarteten Zahlen bei `zeit:'wochenende'`; Tipp auf den Kalendertag 28.11. setzt `prefs.zeit === 'tage'`, `von === bis === '2026-11-28'`, ruft `beiAenderung` einmal und die Kachelzahlen ändern sich; zweiter Tipp auf den 29.11. ergibt den Zeitraum; Tage vor dem 23.11. sind `disabled`; Tag mit Termin trägt `punkt`, ohne nicht; Tipp auf Kachel „Konzerte“ → `prefs.rubriken` deepEqual `['konzert']` und die Unterfilter-Gruppe „Konzerte: Genre“ ist sichtbar, bei zwei gewählten Rubriken nicht; Kachel mit Zahl 0 hat Klasse `leer`, ist nicht `disabled`, und ein Tipp darauf ändert die Auswahl; Advent-Schalter setzt `prefs.advent`; Umkreis-Chip „25 km“ setzt `maxKm: 25`; Ortsauswahl „Görlitz“ setzt `prefs.ort`; Knopftext „2 Termine anzeigen“ bzw. „Keine Termine gefunden“; Klick auf den Knopf ruft `beiAnzeigen`; Markierung der Schnellwahl `Wochenende` im Kalender (`gewaehlt` an Fr–So); ein Titel mit `<img src=x onerror=alert(1)>` erzeugt kein `img` im Aufbau.
- [ ] **Step 2: Run** `node --test test/filterseite.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `site/js/filterseite.js` und die Stile (Vorlage: die Entwürfe `.superpowers/brainstorm/*/content/filterseite-entwurf-v2.html`, Variante „Kacheln“).
- [ ] **Step 4: Run** `npm test` — PASS. **Commit** `git add site test && git commit -m "feat: Filterseite mit Kalender, Kacheln und Umkreisstufen"`

---

### Task 10: Verdrahtung in der App, Liste mit Zusammenfassung, Service Worker

**Files:**
- Modify: `site/index.html`, `site/js/app.js`, `site/js/render.js` (`artName` entfällt, wenn ungenutzt), `site/style.css`, `site/sw.js`

**Interfaces:**
- Consumes: `baueFilterseite` (Task 9), `zusammenfassung`, `applyFilters`, `groupByDay` (Task 7).
- Produces: zwei Ansichten in `index.html`: `<section id="filterseite">` (sichtbar beim Start) und `<div id="listenansicht" hidden>` mit Kopfzeile (`<p id="zusammenfassung">` + `<button id="filter-aendern">Filter ändern</button>`), Suchfeld (aus `baueFilterleiste` herausgelöst, bleibt auf der Liste) und `<main id="liste">`. Der Filter-Dialog von unten (`filterfenster`, `aktiveFilter`, `baueFilterleiste`, `ZEIT_CHIPS`) entfällt. `sw.js`: `CACHE = 'eventkalender-v6'`, `GRUNDSTOCK` um `js/filterseite.js`, `js/kalender.js` ergänzt.

- [ ] **Step 1: Verhalten festlegen und umsetzen**:
  - Start: Filterseite sichtbar, Liste verborgen; `prefs = loadPrefs(...)` (Wochenende vorgewählt). Tipp auf „N Termine anzeigen“: `history.pushState({ansicht:'liste'}, '')`, Ansicht wechseln, Liste zeichnen, an den Anfang scrollen.
  - Liste zeigt oben `zusammenfassung(prefs, heute)` und „Filter ändern“ (→ `history.back()`, wenn der aktuelle Verlaufseintrag `ansicht:'liste'` trägt, sonst direkt umschalten); `popstate` ohne `ansicht:'liste'` und ohne offenes Fenster zeigt die Filterseite. Die vorhandenen Fenster (`neuesFenster`: Detail, Über) funktionieren in beiden Ansichten; ihr `history.back()` darf die Ansicht nicht wechseln.
  - Rückkehr aus dem Hintergrund lässt die App im Zustand (kein Neuaufbau); jeder frische Start beginnt mit der Filterseite.
  - `beiAenderung` speichert `savePrefs` und ruft `filterseite.aktualisieren()`; die Liste wird beim Wechsel zur Listenansicht und bei Änderung des Suchtexts neu gezeichnet. Nach dem Laden von `events.json` und `places.json` `ctx.events/orteListe/orte` setzen und `aktualisieren()` rufen; vorher zeigt die Filterseite den Knopf „Termine werden geladen …“ deaktiviert.
  - Ladefehler (`events.json` nicht ladbar): Filterseite bleibt benutzbar, der Knopf führt zur Liste mit der bestehenden Fehlermeldung.
  - `index.html`: `<nav class="filters">` entfällt, Fußzeile und Kopf bleiben in beiden Ansichten.
- [ ] **Step 2: Run** `npm test` — PASS (Tests, die `baueFilterleiste` o. Ä. berühren, gibt es nicht; `test/ort-navigation.test.js` und `render`-Tests bleiben grün).
- [ ] **Step 3: Im Browser prüfen** (`preview_start` mit `{name:"site"}` aus `.claude/launch.json`; vorher `node scripts/bericht.js --schreiben`, damit die lokalen Daten Rubriken haben): Start zeigt die Filterseite mit „Wochenende“ markiert und Zahlen auf den Kacheln; Tipp auf einen Kalendertag ändert die Zahlen und den Knopftext; Kachel „Konzerte“ wählen blendet den Genre-Unterfilter ein; Umkreis „25 km“ + Ort „Görlitz“ ändert die Zahlen; „N Termine anzeigen“ öffnet die Liste mit Zusammenfassungszeile; „Filter ändern“ und die Zurück-Taste des Browsers führen zur Filterseite, die Auswahl bleibt; Neuladen der Seite: Rubrik/Ort/Umkreis sind noch gewählt, der Zeitraum steht wieder auf „Wochenende“; Termin antippen öffnet das Detailfenster, Zurück schließt nur das Fenster; ☰ öffnet „Über“ auf beiden Ansichten; Handybreite 375 px (`resize_window` `mobile`), hell und dunkel; `read_console_messages` ohne Fehler. Screenshots der Filterseite (dunkel, Handy) und der Liste als Beleg.
- [ ] **Step 4: Commit** `git add site && git commit -m "feat: App startet mit der Filterseite, Liste mit Zusammenfassung und Filter-ändern-Knopf"`

---

### Task 11: Über-Fenster, Version, Abschlussprüfung

**Files:**
- Modify: `site/js/ueber.js`, `test/ueber.test.js`, `package.json` (Version `1.5.0`), `docs/SETUP.md` (falls dort Zwischenspeicher/Aufbau beschrieben sind)

**Interfaces:**
- `renderUeber(doc, optionen)` liefert statt „Kontakt“ den aufklappbaren Abschnitt **„Anbieter und Kontakt“**; im Abschnitt „Lizenzen“ steht die Zeile mit **„© OpenStreetMap-Mitwirkende (ODbL)“** (Link `https://www.openstreetmap.org/copyright`) samt Hinweis, dass Ortsangaben mit Nominatim ergänzt werden.

- [ ] **Step 1: Failing tests** in `test/ueber.test.js`: die Abschnittstitel (bisher `[… 'Kontakt']`, `test/ueber.test.js:113`) lauten `['Wofür', 'Woher die Termine kommen', 'Lizenzen', 'Datenschutz', 'Anbieter und Kontakt']`; der Text des Abschnitts enthält „Matthias | B“, „Schönbach“, „Sebnitz“ und den `mailto:`-Link auf `KONTAKT_MAIL`, aber weder „Straße“, „Tel“ noch eine Postleitzahl; ohne hinterlegte Adresse (`kontaktMail: null`) entfällt die Zeile wie bisher; der Lizenzabschnitt enthält „© OpenStreetMap-Mitwirkende (ODbL)“ und den Link; der Text unter „Wofür“ nennt „Zeitraum, Rubrik, Ort und Umkreis“ statt „Art, Sorte“ und erwähnt die Filterseite; die Fußnote lautet „Bühnenlicht – vom Betreiber | B“.
- [ ] **Step 2: Run** `node --test test/ueber.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** in `site/js/ueber.js`; `package.json` auf `1.5.0`.
- [ ] **Step 4: Abschluss**: `npm test` (alle grün, Anzahl höher als 351 — Zahl nennen), `git status` sauber bis auf Gewolltes. **Nicht pushen.**
- [ ] **Step 5: Commit** `git commit -am "feat: Anbieter und Kontakt, OpenStreetMap-Hinweis, Version 1.5.0"`
- [ ] **Step 6: Übergabe an den Nutzer**: berichten, was geprüft ist (Tests, Browserprüfung), was erst nach dem Veröffentlichen prüfbar ist (Nominatim-Lauf, Zahl der Termine ohne Koordinaten nach dem ersten Tageslauf, dann `status`/Konsole des Laufs) und fragen, ob gepusht und der Lauf (`workflow_dispatch`) gestartet werden soll.
