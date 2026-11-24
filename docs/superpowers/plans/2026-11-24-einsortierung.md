# Neue Einsortierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Termin steht in der Rubrik und unter dem Unterpunkt, wo ein Mensch ihn suchen würde: 14 Rubriken (neu „Sport & Freizeit“), Unterpunkte für alle Rubriken außer Sport und Sonstiges, Umleitung über die Art der Quelle hinweg, Aussortieren mit Grund, Einordnen nach der Übersetzung, Sprachhinweis auf der Karte, leere Unterpunkte ausgeblendet.

**Architecture:** Die Regeln bleiben reine Funktionen in `src/` (`rubriken.js` entscheidet die Rubrik, `normalize.js` und das neue `unterpunkte.js` die Unterpunkte, neu `aussortieren.js` und `sprache.js`). Der Lauf ordnet wie bisher je Quelle ein und bekommt am Ende einen neuen Schritt `fertigstellen` (nach Zusammenführen, Ortssuche und Übersetzung): noch einmal einordnen, Sprache setzen, aussortieren, Hilfsfeld entfernen. Der Hinweis des Adapters lebt getrennt im Hilfsfeld `genreQuelle`, damit das Einordnen wiederholbar ist. Die Seite (`site/js/`) bekommt die neuen Listen, zählt Termine je Unterpunkt und blendet leere aus. Jede Task endet mit grünem `npm test`.

**Tech Stack:** Node 24 (ES-Module, `node --test`), linkedom (nur Tests), reines JavaScript ohne Framework in `site/`. Keine neuen Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-24-einsortierung-design.md` (mit der Berichtigung der Zielwerte vom 24.11.2026)

## Global Constraints

- **Kein Push, kein Merge, kein `npm run build`** (der Lauf greift auf die Quellen zu) ohne ausdrückliches OK des Betreibers. Alles bleibt lokal auf einem Arbeitszweig.
- **Keine Handpflege:** keine Listen einzelner Termine oder Künstlernamen in den Regeln. Erlaubt sind Stichwörter, die Art der Quelle und Stichwörter für Spielstätten.
- **Kein Termin verschwindet zu Unrecht:** Aussortiert wird nur über `aussortierGrund` (Task 3); jede andere Regel ordnet nur um. `fertigstellen` liefert stets `Eingang = Ausgang + Summe der aussortierten`.
- 14 Rubriken in dieser Reihenfolge: `konzert, markt, ausstellung, schau, fest, party, fuehrung, wandern, kurse, theater, essen, kinder, sport, sonstiges`. Unterpunkt-Schlüssel sind über alle Rubriken eindeutig (auch die Sammelpunkte `sonstige…`).
- `site/` kann `src/` nicht laden: Schlüssel und Namen stehen doppelt (`src/rubriken.js` und `site/js/arten.js`); der Gleichlauf-Test in `test/normalize.test.js` („Rubriken und Unterarten stehen in Erkennung …“) bleibt und wächst mit.
- Fremde Werte kommen nur über `textContent`/`setAttribute` in die Seite, nie über `innerHTML`. Deutsche Texte, Handy zuerst.
- **`site/style.css` wird nicht angefasst** (dort liegen fremde, unveröffentlichte Änderungen). `site/sw.js` bleibt unverändert (holt zuerst aus dem Netz).
- Commits: nur die in der Task genannten Dateien hinzufügen (**nie `git add -A`, nie `git commit -a`**; im Arbeitsverzeichnis liegen fremde Dateien unter `docs/anfragen/`). Nachrichten deutsch im Stil `feat:`/`fix:`/`test:`, letzte Zeile `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Die bestehenden Tests laufen weiter (`npm test`, heute 517) und werden nur dort angepasst, wo sich Verhalten gewollt ändert; jede solche Anpassung nennt im Commit die Entscheidung aus dem Entwurf.
- Fester Prüfbestand: `E:\ClaudeCode\Eventcalender\.superpowers\bestand-2026-11-23\events.json` (2620 Termine, nicht im Git, in einem Arbeitsbaum nicht vorhanden; deshalb immer mit diesem vollen Pfad aufrufen).
- `istAdvent` in `src/rubriken.js` und seine Tests bleiben unverändert (Entscheidung 16).
- Quelldateien haben Windows-Zeilenenden (CRLF); beibehalten.
- Stichwortlisten in diesem Plan sind **Startwerte**. Verbindlich sind die genannten Tests mit echten Titeln; die Listen dürfen am Prüfbestand nachgeschärft werden, solange die Tests grün bleiben.

## Festlegungen des Plans (vom Entwurf offen gelassen oder abweichend)

1. **Hinweis des Adapters:** eigenes Hilfsfeld `genreQuelle`. Es lebt nur im Lauf und in `rohdaten.json`, nie in `events.json`.
2. **Kein Feld `kategorie`** in diesem Paket: keine der betroffenen Quellen liefert eine (Alter Schlachthof und Junge Garde liefern nur Name und Programmtitel).
3. **Aussortiert wird nach Zusammenführen und Übersetzen**, im Schritt `fertigstellen`. `rohdaten.json` behält alle Termine.
4. **Aussortieren nur nach dem Titel.** Ausnahme: die vier Schulwörter zählen auch in den ersten 200 Zeichen der Beschreibung (so nennt es der Entwurf). Das Anti-Ziel „niemand verschwindet zu Unrecht“ geht vor.
5. **Jahreszeit-Wörter sind schwach:** „Advent“, „Weihnacht“ im Titel machen einen Termin der Art „sonstiges“ erst dann zum Fest, wenn kein starkes Wort einer anderen Rubrik und keine Spielstätte passt („Adventssingen“ bleibt Musik).
6. **Filmfestival** (Art Fest) geht zu Theater, Unterpunkt Kino & Film (Entscheidung 4 geht vor der Umleitungstabelle).
7. **Stück im Theaterhaus ohne weiteres Stichwort** bekommt den Unterpunkt Schauspiel & Oper, im Kino den Unterpunkt Kino & Film.
8. **Gespeicherte Unterpunkt-Auswahl wird einmal zurückgesetzt** (Feld `stand: 2` in den gespeicherten Einstellungen). Rubriken, Ort, Umkreis und Tschechien-Schalter bleiben. Grund: Wer bisher nur „Comedy & Kabarett“ oder bei Festen nur „Essen & Trinken“ gewählt hatte, bekäme sonst eine leere oder falsche Auswahl.
9. **Namen der Sammelpunkte:** „Sonstige Touren“ (Wandern), „Sonstige Kurse“, „Sonstiges Theater“, „Sonstiges Essen“, „Sonstiges für Kinder“.
10. **Zielwerte** wie im Entwurf berichtigt: Sonstiges ≤ 110, Kirchenmusik ≥ 40, Kabarett & Comedy ≥ 15, aussortiert ≤ 20. Kein Zielwert für „Sonstige Konzerte“.
11. **Sprachhinweis entfällt**, wenn der Titel eines tschechischen Termins ausdrücklich „auf Deutsch“ nennt.
12. **Stück als „Konzert“ geliefert:** Nennt Titel oder Beschreibungsanfang „Theaterstück“, „Theatererlebnis“ oder „Schauspiel“, geht der Termin zu Theater (die Tabelle im Entwurf nennt nur Kabarett, Lesung, Show, Musical; das Ziel „unter Konzerten steht nur Musik“ geht vor).

## Vorbereitung (vor Task 1)

Entwurf und Bauplan liegen noch nicht im Git und fehlen deshalb in einem frischen Arbeitsbaum. Beide Dateien (`docs/superpowers/specs/2026-11-24-einsortierung-design.md`, `docs/superpowers/plans/2026-11-24-einsortierung.md`) aus dem Hauptverzeichnis in den Arbeitsbaum kopieren und als ersten Commit des Arbeitszweigs ablegen: `git add docs/superpowers/specs/2026-11-24-einsortierung-design.md docs/superpowers/plans/2026-11-24-einsortierung.md && git commit -m "docs: Entwurf und Bauplan zur neuen Einsortierung"`. Danach `npm install` und `npm test` (Expected: 517 bestanden).

## Review Focus

1. **Gespeicherte Einstellungen aus 1.5.x** (Auswahl nur „Comedy & Kabarett“, nur Fest-„Essen & Trinken“, unbekannte Schlüssel, kaputte Liste): kein Absturz, keine leere Liste, Rubrikwahl bleibt. Test in Task 9.
2. **Seite und Daten aus verschiedenen Fassungen.** Alte Daten in neuer Seite (`genre: 'comedy'` unter Konzert, kein Feld `sprache`): Termin erscheint unter „Sonstige Konzerte“, kein Sprachhinweis, kein Fehler. Neue Daten in alter Seite: Die alte Seite kennt `sport` und die neuen Unterpunkte nicht und fällt über `rubrikVon` (unbekannte Rubrik → Art → „Sonstiges“) und `sorteFilter` (unbekannter Unterpunkt → Sammelpunkt) weich; diese beiden Rückfälle dürfen in der neuen Fassung nicht verschwinden. Tests in Task 2 und 4.
3. **Tschechischer Termin, zweiter Durchgang:** nach der Übersetzung neu eingeordnet, Hinweis der Quelle bleibt, zweiter und dritter Durchgang liefern dasselbe; fällt die Übersetzung aus (Titel noch tschechisch), wirft nichts und `sprache` ist `cs`. Tests in Task 1 und 5.
4. **Falsch aussortiert:** „Weinprobe“, „Öffentliche Probe“, „Geschlossene Gesellschaft“ (Sartre), „Weihnachtsmarkt mit Werksverkauf“, „Generalprobe“ bleiben im Kalender. Test in Task 3.
5. **Wörter im Vorbeigehen:** „Die Familie Alexander“ ist kein Kindertermin, „Führung auf Distanz“ keine Führung, „Vorführung“ kein Theater, „Kaffee und Kuchen“ in einer Beschreibung kein Essen-Termin, „Revival Show“ bleibt Konzert. Tests in Task 6 und 7.

---

### Task 1: Hinweis der Quelle getrennt aufbewahren, Einordnen wiederholbar

**Files:**
- Modify: `src/rubriken.js` (neu `quellHinweis`, `rubrikUndGenre` nutzt es), `src/build.js:29-33` (`einordnen`), `src/dedupe.js:37` (`merge`), `test/rubriken.test.js`, `test/build.test.js`, `test/dedupe.test.js`

**Interfaces:**
- Produces in `src/rubriken.js`: `quellHinweis(e: object): string|null` — der Unterpunkt-Hinweis, den der Adapter geliefert hat. Regel: hat `e` ein eigenes Feld `genreQuelle` (`Object.hasOwn`) → dessen Wert (`null` erlaubt); sonst, wenn `e.rubrik == null` (frisch vom Adapter) → `e.genre ?? null`; sonst (altes gespeichertes Format, `genre` ist errechnet) → `null`.
- `rubrikUndGenre(e)` liest den Hinweis nur noch über `quellHinweis(e)`, nie direkt `e.genre`.
- `einordnen(e)` in `src/build.js` gibt `{ ...e, genreQuelle: quellHinweis(e), rubrik, genre, advent }` zurück und wird exportiert (Task 5 und das Prüfskript brauchen es).
- `merge` in `src/dedupe.js`: `genreQuelle: erster(a.genreQuelle, b.genreQuelle)`, aber nur, wenn `a` oder `b` das Feld trägt (sonst bleibt das Ergebnis ohne das Feld).

- [ ] **Step 1: Failing tests**
  - `test/rubriken.test.js`, `quellHinweis: frisch, schon eingeordnet, altes Format`: `{genre:'jazz'}` → `'jazz'`; `{genre:'jazz', rubrik:'konzert'}` → `null`; `{genre:'rock-pop', rubrik:'konzert', genreQuelle:'jazz'}` → `'jazz'`; `{genreQuelle:null, genre:'jazz'}` → `null`; `undefined` → `null`.
  - `test/build.test.js`, `einordnen ist wiederholbar und behält den Hinweis der Quelle`: `a = einordnen({art:'konzert', genre:'jazz', title:'X'})` → `a.genre === 'jazz'`, `a.genreQuelle === 'jazz'`; `assert.deepEqual(einordnen(a), a)` und `assert.deepEqual(einordnen(einordnen(a)), a)`. Zweiter Fall: `b = einordnen({art:'konzert', rubrik:'konzert', genre:'klassik', title:'Sommerhits live'})` (altes Format) → `b.genreQuelle === null`, `b.genre` kommt aus dem Titel, nicht aus dem alten Wert.
  - `test/build.test.js`, `übernommene Termine einer ausgefallenen Quelle behalten den Hinweis`: `runAll` mit einer Quelle, die wirft, und `previousRohdaten` mit einem Konzert `{genreQuelle:'jazz', genre:'jazz', rubrik:'konzert', title:'X', …}` (Aufbau wie im bestehenden Test zu übernommenen Terminen) → der Termin im Ergebnis hat `genre: 'jazz'` und `genreQuelle: 'jazz'`. Ein gespeicherter Termin im alten Format (ohne `genreQuelle`) wirft nicht und bekommt `genreQuelle: null`.
  - `test/dedupe.test.js`: zwei gleiche Termine, `a.genreQuelle: null`, `b.genreQuelle: 'jazz'` → Ergebnis `genreQuelle: 'jazz'`; zwei Termine ohne das Feld → Ergebnis hat das Feld nicht (`!Object.hasOwn`).
- [ ] **Step 2: Run** `node --test test/rubriken.test.js test/build.test.js test/dedupe.test.js` — Expected: FAIL (`quellHinweis` fehlt, `einordnen` nicht exportiert).
- [ ] **Step 3: Implement** wie unter Interfaces.
- [ ] **Step 4: Run** `npm test` — Expected: PASS (517 + neue).
- [ ] **Step 5: Commit** `git add src/rubriken.js src/build.js src/dedupe.js test/rubriken.test.js test/build.test.js test/dedupe.test.js && git commit -m "feat: Hinweis der Quelle getrennt aufbewahrt, Einordnen wiederholbar"`

---

### Task 2: Listen der Rubriken und Unterpunkte (Daten und Seite)

**Files:**
- Create: `src/unterpunkte.js`
- Modify: `src/rubriken.js` (`RUBRIKEN`, `UNTERARTEN`), `src/normalize.js` (`GENRES`, `GENRE_REGELN`, `FEST_SORTEN`, `FEST_REGELN`), `site/js/arten.js` (`RUBRIKEN`, `SORTEN`), `site/js/filter.js` (nur Kommentare „13“ → 14), Tests `test/rubriken.test.js`, `test/arten.test.js`, `test/normalize.test.js`, `test/filterseite.test.js`, `test/filter-ort-zeit.test.js`, `test/render.test.js`, `test/build.test.js`

**Interfaces:**
- Produces in `src/unterpunkte.js` (in dieser Task nur die Listen, die Erkennung folgt in Task 8):
  - `FUEHRUNG_UNTER = { stadt:'Stadt & Ort', untertage:'Untertage & Bergwerk', brauerei:'Brauerei & Bäckerei', kinder:'Kinderführung', hausfuehrung:'Museum & Schloss', bahn:'Sonderfahrt Bahn' }`
  - `WANDERN_UNTER = { wanderung:'Geführte Wanderung', spaziergang:'Spaziergang & Rundgang', natur:'Tiere & Natur' }`
  - `KURSE_UNTER = { vortrag:'Vortrag & Reisebericht', kreativ:'Kreativ, Handwerk & Kochen', bewegung:'Bewegung & Entspannung', lernen:'Computer, Sprache & Beruf' }`
  - `THEATER_UNTER = { schauspiel:'Schauspiel & Oper', lesung:'Lesung & Literatur', kabarett:'Kabarett & Comedy', kino:'Kino & Film', show:'Show, Zirkus & Musical' }`
  - `ESSEN_UNTER = { dinner:'Dinner & Menü', brunch:'Brunch', verkostung:'Verkostung' }`
  - `KINDER_UNTER = { 'kinder-buehne':'Theater, Kino & Musik', 'kinder-mitmachen':'Basteln, Backen & Mitmachen', 'kinder-lernen':'Lesen & Lernen' }`
- `src/rubriken.js`: `RUBRIKEN` bekommt vor `sonstiges` den Eintrag `{ key:'sport', name:'Sport & Freizeit', karte:'Sport & Freizeit', art:'sonstiges' }`. `UNTERARTEN` hat Einträge für `konzert, markt, party, fest, schau, ausstellung, fuehrung, wandern, kurse, theater, essen, kinder` (keine für `sport`, `sonstiges`); die Liste der Führungs-Unterpunkte zieht aus `rubriken.js` nach `unterpunkte.js` um (dort `FUEHRUNG_UNTER`).
- `src/normalize.js`: `GENRES` ohne `comedy` und `musical` (auch die zwei Regeln dazu entfallen aus `GENRE_REGELN`). `FEST_SORTEN = { familie:'Familie & Kinder', stadtfest:'Stadt- & Dorffest', weihnachten:'Weihnachten & Lichter', brauchtum:'Brauchtum', festival:'Festival' }`; die Regel `essen` entfällt aus `FEST_REGELN`, ihre Wörter (`suppe|\bwein|bier|schlemm|kulinar|gourmet|ernte|kartoffel|k[aä]se|\bbrot|fisch|grill|wurst|genuss|apfel|pilz`) wandern in die Regel `stadtfest`. Die Erkennung von `brauchtum` kommt in Task 6.
- `site/js/arten.js`: `RUBRIKEN` mit `sport` (`farbe:'sonstiges'`) an gleicher Stelle; `SORTEN` mit denselben Listen wie `UNTERARTEN`. Neue Einträge (`titel`, `sonstige`, `sonstigeText`): wandern „Wandern & Natur: Sorte“, `sonstige-wandern`, „Sonstige Touren“; kurse „Kurse & Vorträge: Sorte“, `sonstige-kurse`, „Sonstige Kurse“; theater „Theater & Lesungen: Sorte“, `sonstige-theater`, „Sonstiges Theater“; essen „Essen & Trinken: Sorte“, `sonstige-essen`, „Sonstiges Essen“; kinder „Kinder & Familie: Sorte“, `sonstige-kinder`, „Sonstiges für Kinder“.

- [ ] **Step 1: Failing tests**
  - `test/rubriken.test.js`: Schlüsselliste auf die 14 oben; `UNTERARTEN`-Test: `Object.keys(UNTERARTEN).sort()` deepEqual der zwölf Rubriken oben, `UNTERARTEN.sport === undefined`, `UNTERARTEN.sonstiges === undefined`, `UNTERARTEN.konzert.comedy === undefined`, `UNTERARTEN.fest.brauchtum === 'Brauchtum'`, `UNTERARTEN.fest.essen === undefined`, `UNTERARTEN.theater.kabarett === 'Kabarett & Comedy'`.
  - `test/arten.test.js`: `RUBRIKEN.length === 14`, `RUBRIKEN.at(-2).key === 'sport'`; neuer Test `alte Daten: Genre comedy unter Konzert zählt als Sonstige Konzerte` → `sorteFilter({rubrik:'konzert', art:'konzert', genre:'comedy'}) === 'sonstige'`, `sorteName(…) === null`; `rubrikVon({rubrik:'sport', art:'sonstiges'}) === 'sport'`; neuer Test `Rückfälle bleiben`: `rubrikVon({rubrik:'gibtsnicht', art:'konzert'}) === 'konzert'`, `rubrikVon({rubrik:'gibtsnicht', art:'auchnicht'}) === 'sonstiges'`, `sorteFilter({rubrik:'theater', genre:'gibtsnicht'}) === 'sonstige-theater'`, `sorteFilter({rubrik:'sport', genre:'x'})` und `sorteFilter({rubrik:'sonstiges'})` werfen nicht.
  - `test/normalize.test.js`: `detectGenre('Comedy-Abend')` → `null`, `detectGenre('Musical-Gala')` → `null`; `detectSorte('fest','8. Lauterbacher Suppenfest')` → `'stadtfest'`; `detectSorte('fest','Weinfest am Schloss')` → `'stadtfest'` (die Umleitung nach Essen & Trinken geschieht in `rubrikUndGenre`, Task 6). Der Gleichlauf-Test bleibt wörtlich stehen und muss mit den neuen Listen grün sein.
  - Übrige Tests, die `comedy`, `musical`, Fest-`essen`, „13“ oder die Zahl der Konzert-Unterpunkte (`test/filterseite.test.js:244`: 9 → 7) fest erwarten, auf die neuen Listen umstellen.
- [ ] **Step 2: Run** `npm test` — Expected: FAIL in den geänderten Tests.
- [ ] **Step 3: Implement** die Listen wie unter Interfaces. In `site/js/filter.js` nur die Kommentare anpassen.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/unterpunkte.js src/rubriken.js src/normalize.js site/js/arten.js site/js/filter.js test && git commit -m "feat: 14 Rubriken und neue Unterpunkt-Listen (Sport & Freizeit, Brauchtum, Theater, Kurse, Wandern, Essen, Kinder)"`

---

### Task 3: Aussortieren mit Grund

**Files:**
- Create: `src/aussortieren.js`, `test/aussortieren.test.js`

**Interfaces:**
- Produces: `GRUENDE = { ladenoeffnung:'Ladenöffnung', schulvorstellung:'Schulvorstellung', gruppentreffen:'Gruppentreffen' }` (Reihenfolge = Reihenfolge im Protokoll) und `aussortierGrund(e: {art?:string, title?:string, description?:string|null}): 'ladenoeffnung'|'schulvorstellung'|'gruppentreffen'|null`. Wirft nie.

- [ ] **Step 1: Failing tests** in `test/aussortieren.test.js` (alle mit `art:'sonstiges'`, wenn nicht anders genannt)
  - `Ladenöffnung und Werksverkauf (echte Titel)`: „Der Domladen hat geöffnet und lädt Sie herzlich ein!“, „Winter Werksverkauf“, „Weihnachtsbaumverkauf zum Selbstschlagen im Revier Ottomühle“ → `'ladenoeffnung'`.
  - `Gegenbeispiele Laden`: „Weihnachtsmarkt mit Werksverkauf“ (`art:'markt'`), „Hoffest mit Werksverkauf“ (`art:'fest'`), „Werksverkauf mit Führung durch die Manufaktur“, „Das Museum hat geöffnet: Sonderausstellung“ (`art:'schau'`) → `null`.
  - `Schulvorstellung`: Titel „Der kleine Prinz (Schulvorstellung)“, „Klassenzimmerstück: Die Welle“; Titel „Der Zauberlehrling“ mit Beschreibung „Geschlossene Veranstaltung für Schulklassen.“ → `'schulvorstellung'`. Gegenbeispiele: Titel „Geschlossene Gesellschaft“ (Stück von Sartre), Titel „Faust“ mit dem Wort „Schulvorstellung“ erst an Stelle 400 der Beschreibung → `null`.
  - `Gruppentreffen (echte Titel)`: „Trauercafe Bautzen“, „Jugendtrauerkreis“, „Bibelkreis“, „Selbsthilfegruppe Diabetes“, „Seniorennachmittag“, „Chorprobe“ → `'gruppentreffen'`. Gegenbeispiele: „Weinprobe im Schlosskeller“, „Öffentliche Probe der Philharmonie“, „Generalprobe: Weihnachtsoratorium“, „Vereinstreffen der Modellbahner“, „Trauerfeier-Musik: Requiem“ → `null`.
  - `wirft nie`: `aussortierGrund(undefined)`, `{title:''}`, `{title:null, description:null}` → `null`.
- [ ] **Step 2: Run** `node --test test/aussortieren.test.js` — Expected: FAIL (Modul fehlt).
- [ ] **Step 3: Implement.** Alles in Kleinschreibung. Startwerte: Schule `/schulvorstellung|f[uü]r schulklassen|klassenzimmerst[uü]ck|geschlossene (?:veranstaltung|vorstellung)/` im Titel oder in den ersten 200 Zeichen der Beschreibung. Laden nur bei `art === 'sonstiges'`: Titel passt auf `/hat ge[oö]ffnet|werksverkauf|lagerverkauf|fabrikverkauf|weihnachtsbaumverkauf/` und nicht auf `/markt|fest\b|f[uü]hrung|konzert|musik|ausstellung/`. Gruppe: Titel passt auf `/selbsthilfe|trauercaf[eé]|trauergruppe|trauerkreis|trauertreff|bibelkreis|bibelstunde|gespr[aä]chskreis|seniorennachmittag|seniorenkreis|chorprobe|\bprobe\b/` und nicht auf `/[oö]ffentliche probe/`. Prüfreihenfolge: Schule, Laden, Gruppe.
- [ ] **Step 4: Run** `npm test` — PASS. **Commit** `git add src/aussortieren.js test/aussortieren.test.js && git commit -m "feat: Ladenöffnung, Schulvorstellung und Gruppentreffen mit Grund erkennen"`

---

### Task 4: Sprache des Termins und Hinweis auf der Karte

**Files:**
- Create: `src/sprache.js`, `test/sprache.test.js`
- Modify: `src/model.js` (Typ `Event`, `makeEvent`: `sprache: rest.sprache ?? null`), `site/js/arten.js` (neu `sprachHinweis`), `site/js/render.js:91-101` (`kopfzeile`), `test/model.test.js`, `test/arten.test.js`, `test/render.test.js`

**Interfaces:**
- Produces: `spracheVon(e: {title?:string, country?:string}): 'cs'|'pl'|null` in `src/sprache.js`. Regel in dieser Reihenfolge: Titel nennt Polnisch (`po polsku|in polnischer sprache|auf polnisch|polnischsprachig`) → `'pl'`; Titel nennt Tschechisch (`auf tschechisch|in tschechischer sprache|tschechischsprachig|česky|v češtině`) → `'cs'`; Titel nennt Deutsch (`auf deutsch|in deutscher sprache|německy|v němčině`) → `null`; `country === 'CZ'` → `'cs'`; sonst `null`.
- Produces in `site/js/arten.js`: `sprachHinweis(e): 'auf Tschechisch'|'auf Polnisch'|null` — nur wenn `rubrikVon(e)` eine von `theater, kurse, fuehrung, kinder` ist und `e.sprache` `'cs'` bzw. `'pl'`; jeder andere Wert → `null`.
- `kopfzeile` in `site/js/render.js` hängt nach Unterpunkt und Land an: `' · '` und `el(doc, 'span', 'land sprache', hinweis)` (vorhandene Klasse `land`, kein neues CSS).

- [ ] **Step 1: Failing tests**
  - `test/sprache.test.js`: `{title:'Rathausturm - Zwiedzanie Wieży Ratuszowej po polsku', country:'DE'}` → `'pl'`; `{title:'Stadtführung in polnischer Sprache'}` → `'pl'`; `{title:'Kabarett „Der nackte Shakespeare 2“', country:'CZ'}` → `'cs'`; `{title:'Divadlo: Lakomec', country:'CZ'}` (nicht übersetzt) → `'cs'`; `{title:'Stadtführung auf Deutsch', country:'CZ'}` → `null`; `{title:'Weihnachtsmarkt Sebnitz', country:'DE'}` → `null`; `spracheVon(undefined)` → `null`.
  - `test/model.test.js`: Vorgabe `sprache === null`, eine Angabe bleibt.
  - `test/arten.test.js`: `sprachHinweis({rubrik:'theater', sprache:'cs'})` → `'auf Tschechisch'`; `{rubrik:'fuehrung', sprache:'pl'}` → `'auf Polnisch'`; `{rubrik:'konzert', sprache:'cs'}`, `{rubrik:'markt', sprache:'pl'}`, `{rubrik:'theater'}` (alte Daten), `{rubrik:'theater', sprache:'xx'}` → `null`.
  - `test/render.test.js`: Karte eines Termins `{rubrik:'theater', genre:'kabarett', country:'CZ', sprache:'cs'}` enthält ein Element `.sprache` mit Text „auf Tschechisch“; ein Konzert mit `sprache:'cs'` enthält keins; ein Wert `sprache:'<b>x</b>'` erzeugt kein Element.
- [ ] **Step 2: Run** `node --test test/sprache.test.js test/model.test.js test/arten.test.js test/render.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** wie unter Interfaces.
- [ ] **Step 4: Run** `npm test` — PASS. **Commit** `git add src/sprache.js src/model.js site/js/arten.js site/js/render.js test/sprache.test.js test/model.test.js test/arten.test.js test/render.test.js && git commit -m "feat: Feld sprache und Hinweis auf der Karte (auf Tschechisch, auf Polnisch)"`

---

### Task 5: Abschluss im Lauf (`fertigstellen`) und Prüfskript

**Files:**
- Create: `scripts/einsortierung-pruefen.js`, `test/einsortierung-pruefen.test.js`
- Modify: `src/build.js` (neu `fertigstellen`, `aussortiertText`; `main` ruft sie nach `uebersetzeTermine`), `test/build.test.js`

**Interfaces:**
- Consumes: `einordnen` (Task 1), `aussortierGrund`, `GRUENDE` (Task 3), `spracheVon` (Task 4).
- Produces in `src/build.js`:
  - `fertigstellen(events: object[]): { events: object[], aussortiert: {ladenoeffnung:number, schulvorstellung:number, gruppentreffen:number} }` — je Termin: Grund vorhanden → zählen und weglassen; sonst `einordnen`, `sprache: spracheVon(…)` setzen, Feld `genreQuelle` entfernen. Reihenfolge der Termine bleibt.
  - `aussortiertText(zahlen): string` → genau `aussortiert: 12 Ladenöffnung, 0 Schulvorstellung, 0 Gruppentreffen` (Namen aus `GRUENDE`, alle drei immer genannt).
  - `main`: nach `uebersetzeTermine` `const fertig = fertigstellen(events)`, `console.log(aussortiertText(fertig.aussortiert))`, geschrieben und gezählt wird `fertig.events`. `rohdaten.json` bleibt unverändert (enthält `genreQuelle` und die aussortierten Termine).
- Produces in `scripts/einsortierung-pruefen.js` (als Modul ladbar, läuft nur bei direktem Aufruf):
  - `vorbereiten(events)` — setzt den Bestand in den Zustand vor dem Einordnen zurück: `rubrik: null`, `genre: null`, `genreQuelle` = altes `genre`, wenn eine Quelle des Termins `Ticketmaster` heißt, `art === 'konzert'` und der Schlüssel in `GENRES` steht, sonst `null`.
  - `vergleiche(events)` bekommt den Bestand, wie er gespeichert ist; `vorher` zählt die gespeicherten Felder `rubrik`/`genre`, `nachher` das Ergebnis von `fertigstellen(vorbereiten(events))`. Rückgabe: `{ vorher: Record<string, number>, nachher: Record<string, number>, aussortiert: {titel:string, ort:string, grund:string}[], ziele: {name:string, soll:string, ist:number, erreicht:boolean}[], konzertFremd: string[] }` — Zähler-Schlüssel `rubrik` und `rubrik/unterpunkt` (ohne Unterpunkt `rubrik/sonstige`). Ziele: `sonstiges ≤ 110`, `konzert/kirche ≥ 40`, `theater/kabarett ≥ 15`, `aussortiert ≤ 20`, `konzertFremd = 0` (Titel von Terminen der Rubrik Konzert, deren Titel oder erste 200 Zeichen der Beschreibung auf `kabarett|comedy|stand.?up|satire|lesung|\bliest\b` passen).
  - `zieheStichprobe(events, n, seed): object[]` — fester Zufall (mulberry32 mit `seed`), ohne Zurücklegen, Ergebnis in Zugreihenfolge.
  - Aufruf: `node scripts/einsortierung-pruefen.js <pfad> [--stichprobe 300] [--seed 20261124] [--aus <ordner>] [--schreiben <ziel.json>]`. Gibt die Tabelle (Rubrik und Unterpunkt, vorher, nachher), die aussortierten Termine mit Grund und die Ziele als Text aus. `--aus` (Vorgabe `.superpowers/einsortierung/`) bekommt `tabelle.md` und bei `--stichprobe` `stichprobe.json` (je Termin `id, title, placeName, start, art, rubrik, unterpunkt` als Namen, `beschreibung` = erste 300 Zeichen). `--schreiben` legt `{generatedAt, events}` mit den fertig eingeordneten Terminen ab (für die Ansicht in Task 10).

- [ ] **Step 1: Failing tests**
  - `test/build.test.js`, `fertigstellen: ordnet neu ein, setzt die Sprache, sortiert aus, entfernt genreQuelle`: Eingang vier Termine: (a) `{art:'konzert', genre:'jazz', genreQuelle:'jazz', rubrik:'konzert', title:'X', country:'DE'}`; (b) `{art:'sonstiges', rubrik:'sonstiges', title:'Kabarett „Der nackte Shakespeare 2“', country:'CZ'}`; (c) `{art:'sonstiges', title:'Winter Werksverkauf'}`; (d) `{art:'sonstiges', title:'Trauercafe Bautzen'}`. Erwartet: zwei Termine; (a) `genre:'jazz'`, `sprache:null`; (b) `sprache:'cs'` (die Rubrik `theater` prüft Task 7); kein Termin hat ein eigenes Feld `genreQuelle`; `aussortiert` deepEqual `{ladenoeffnung:1, schulvorstellung:0, gruppentreffen:1}`; `events.length + 2 === 4`.
  - `fertigstellen: zweimal angewendet gleich einmal` (`deepEqual(fertigstellen(f.events).events, f.events)`); `fertigstellen([])` → `{events:[], aussortiert:{…alle 0}}`; ein Termin mit tschechischem Titel und `country:'CZ'` (Übersetzung ausgefallen) wirft nicht.
  - `aussortiertText({ladenoeffnung:12, schulvorstellung:0, gruppentreffen:0})` → der Satz oben, wörtlich.
  - `test/einsortierung-pruefen.test.js`: `zieheStichprobe` mit gleichem `seed` liefert dieselben Termine, mit anderem andere, nie Doppelte, bei `n` größer als der Bestand alle; `vergleiche` über fünf Handtermine zählt `vorher`/`nachher` richtig, führt den Werksverkauf unter `aussortiert` mit Grund „Ladenöffnung“ und liefert fünf Ziele; `vorbereiten` behält den Hinweis nur beim Ticketmaster-Konzert.
- [ ] **Step 2: Run** `node --test test/build.test.js test/einsortierung-pruefen.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** wie unter Interfaces.
- [ ] **Step 4: Bestand prüfen** `node scripts/einsortierung-pruefen.js "E:\ClaudeCode\Eventcalender\.superpowers\bestand-2026-11-23\events.json"` — Expected: läuft durch, Summe „nachher“ + aussortiert = 2620, aussortiert zwischen 10 und 20 (erwartet 12 Ladenöffnung plus wenige Gruppentreffen). Die übrigen Ziele dürfen hier noch verfehlt sein; die Ausgabe ist der Ausgangswert für Task 6 bis 8.
- [ ] **Step 5: Run** `npm test` — PASS. **Commit** `git add src/build.js scripts/einsortierung-pruefen.js test/build.test.js test/einsortierung-pruefen.test.js && git commit -m "feat: Abschluss im Lauf (neu einordnen nach der Übersetzung, aussortieren mit Protokoll) und Prüfskript"`

---

### Task 6: Regeln für Konzert, Markt, Fest und Party (Unterpunkte und Umleitung)

**Files:**
- Modify: `src/normalize.js` (`GENRE_REGELN`, `FEST_REGELN`, `PARTY_REGELN`), `src/rubriken.js` (`rubrikUndGenre`: Zweig für `konzert|markt|party|fest`), `test/normalize.test.js`, `test/rubriken.test.js`

**Interfaces:**
- Consumes: `quellHinweis` (Task 1), Listen aus Task 2.
- Produces in `src/rubriken.js` (intern, nicht exportiert): `konzertUnterpunkt(e): string|null` — Unterpunkt eines Konzerts aus Hinweis, Titel, Beschreibung und Spielstätte; Task 7 nutzt sie für Konzerte aus der Art „sonstiges“.
- Produces: `rubrikUndGenre` leitet Termine dieser vier Arten in den erlaubten Fällen um; sonst bleibt die Rubrik die Art. Unterpunkte der Zielrubriken Theater, Kinder, Essen, Kurse werden hier fest gesetzt (die allgemeine Erkennung folgt in Task 8).

- [ ] **Step 1: Failing tests** in `test/rubriken.test.js` (`r = rubrikUndGenre`; echte Titel aus dem Bestand)
  - `Kirchenmusik (Entscheidung 5)`: `{art:'konzert', title:'Adventliche Orgelmusik am Mittag', placeName:'Dom St. Petri Bautzen'}` → `konzert/kirche`; `{art:'konzert', title:'"Orgelpunkt 12" in der Peterskirche, Görlitz'}` → `konzert/kirche`; `{art:'konzert', title:'Kammerkonzert', placeName:'Kirche Cunewalde'}` → `konzert/kirche` (Klassik im Kirchenraum); `{art:'konzert', title:'Kammerkonzert', placeName:'Kulturpalast Dresden'}` → `konzert/klassik`; `{art:'konzert', genre:'klassik', title:'Orgelkonzert'}` → `konzert/kirche` (Hinweis Klassik weicht dem Titel); `{art:'konzert', genre:'rock-pop', title:'Rock in der Kirche', placeName:'Kirche Cunewalde'}` → `konzert/rock-pop`; `{art:'konzert', title:'Liederabend', placeName:'Dom kultury Zgorzelec'}` → nicht `kirche`.
  - `Konzert wird Theater (Entscheidung 1 bis 3)`: `{art:'konzert', title:'Kabarett Herkuleskeule: Hüttenzauber'}` → `theater/kabarett`; `{art:'konzert', title:'Monchi', description:'Liest: Jenseits der Brandmauer'}` → `theater/lesung`; `{art:'konzert', title:'Die Nacht der Musicals'}` → `theater/show`; `{art:'konzert', title:'Sebastian Fitzek', description:'Die Einladung - Der Bestseller als packendes Theatererlebnis'}` → `theater/schauspiel`. Gegenbeispiele: `{art:'konzert', title:'A4u – DIE ABBA REVIVAL SHOW'}` → `konzert/rock-pop`; `{art:'konzert', title:'KARAT', description:'45 Jahre „Der blaue Planet“ – KARAT auf Tour 2027'}` → `konzert/null`.
  - `Konzert wird Kinder`: `{art:'konzert', title:'Kinderkonzert: Peter und der Wolf'}` → `kinder/kinder-buehne`; `{art:'konzert', title:'Familienkonzert der Elbland Philharmonie'}` → `kinder/kinder-buehne`.
  - `Lichterfest ist ein Fest (Entscheidung 6)`: `{art:'markt', title:'Lichterfest Kleinwelka'}` → `fest/weihnachten`; `{art:'markt', title:'Lichtelfest mit Weihnachtsmarkt'}` → `markt/weihnachtsmarkt`; `{art:'markt', title:'Lichtermarkt Pirna'}` → Rubrik `markt`.
  - `Brauchtum (Entscheidung 7)`, je `art:'fest'`: „Hexenfeuer in Ottendorf“, „Osterreiten in Wittichenau“, „Kirmes in Radibor“, „Vogelhochzeit im Kindergarten“, „Maibaumsetzen“, „Schlachtfest im Gasthof“ → `fest/brauchtum`; „Martinsumzug in Königstein“ → `fest/familie`; „Erntedankfestival“ → `fest/festival`.
  - `Feste ohne Essen & Trinken (Entscheidung 8)`: `{art:'fest', title:'Weinfest am Schloss'}`, `{art:'fest', title:'Weihnachts-Food-Festival'}`, `{art:'fest', title:'Streetfood-Festival Bautzen'}` → Rubrik `essen`; `{art:'fest', title:'8. Lauterbacher Suppenfest'}`, `{art:'fest', title:'Apfelfest im Museumshof'}` → `fest/stadtfest`.
  - `Fest wird Sport oder Kino`: `{art:'fest', title:'Fußballturnier zum Dorffest'}`, `{art:'fest', title:'Sebnitzer Stadtlauf'}` → Rubrik `sport`, `genre:null`; `{art:'fest', title:'Sportfest der Grundschule'}` → Rubrik `fest`; `{art:'fest', title:'17. Europäisches Filmfestival der Generationen - Im Taxi mit Madeleine'}` → `theater/kino`.
  - `Party (Entscheidung 13 und Umleitung)`: `{art:'party', title:'Tanzabend mit DJ Ulli'}` → `party/disco`; `{art:'party', title:'80er Party mit DJ Basti'}` → `party/disco`; `{art:'party', title:'QUERBEET PARTY mit DJ Basti'}` → `party/club`; `{art:'party', title:'Tanzturnier um den Stadtpokal'}` → Rubrik `sport`; `{art:'party', title:'Tanzkurs für Paare'}` → `kurse/bewegung`.
  - `test/normalize.test.js`: `detectGenre('Orgelkonzert')` → `'kirche'` (bisher `klassik`); `detectGenre('J. S. Bach: Weihnachtsoratorium I-III')` → `'kirche'`; `detectGenre('Musikalische Vesper')` → `'kirche'`; `detectGenre('Sinfoniekonzert')` → `'klassik'`; `detectSorte('fest','Kirmes in Radibor')` → `'brauchtum'` (bisher `stadtfest`); die Party-Fälle oben über `detectSorte('party', …)`; alle übrigen bestehenden Fälle bleiben.
- [ ] **Step 2: Run** `node --test test/rubriken.test.js test/normalize.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.** Startwerte:
  - `GENRE_REGELN`: Regel `kirche` zusätzlich `orgel|vesper|motette|kantate|oratori|adventsmusik|christmette|christvesper|christnacht`; diese Wörter (und `weihnachtsoratorium`) aus der Regel `klassik` streichen.
  - `konzertUnterpunkt`: `g = passender Hinweis ?? detectGenre(Titel, Beschreibung)`; ist `g === 'klassik'` und (`detectGenre(Titel) === 'kirche'` oder die Spielstätte passt auf `/kirche|\bdom\b(?! kultury)|kloster|kapelle|m[uü]nster/`) → `'kirche'`.
  - Art `konzert`, in dieser Reihenfolge: Titel `/kinderkonzert|familienkonzert|taschenlampenkonzert|kinderlieder|kindermusical|f[uü]r kinder/` → `kinder/kinder-buehne`; Titel oder Beschreibungsanfang `/kabarett|cabaret|comedy|comedian|stand.?up|satire/` → `theater/kabarett`; Titel oder Beschreibungsanfang `/lesung|\bliest\b|buchvorstellung|buchpremiere|autorengespr|poetry/` → `theater/lesung`; Titel `/musical|zirkus|circus|travestie|zauber|variet/` → `theater/show`; Titel `/\bshow\b|revue/` nur, wenn `detectGenre(Titel) === null` und der Titel nicht auf `/konzert|tribute|revival|\blive\b/` passt → `theater/show`; Titel oder Beschreibungsanfang `/theaterst[uü]ck|theatererlebnis|schauspiel(?!haus)/` → `theater/schauspiel`; sonst Konzert.
  - Art `markt`: Titel `/(?:lichter|lichtel|advents|pyramiden|weihnachts)fest/` und nicht `/markt|m[aä]rkte/` → Rubrik `fest`, Unterpunkt `detectSorte('fest', Titel) ?? 'weihnachten'`.
  - Art `fest`: Titel `/filmfest|kurzfilm|kinofest/` → `theater/kino`; `/weinfest|winzerfest|bierfest|street.?food|schlemmerfest|food.?festival/` → `essen/null`; `/turnier|marathon|\blauf\b|(?:stadt|volks|silvester|advents|nikolaus|cross|berg|wald|spenden|benefiz|neujahrs)lauf\b/` und nicht `/sportfest/` → `sport/null`; sonst Fest.
  - `FEST_REGELN`, Reihenfolge `festival, brauchtum, weihnachten, familie, stadtfest`; `brauchtum`: `/hexenfeuer|hexenbrennen|walpurgis|maibaum|osterfeuer|osterreiten|vogelhochzeit|zampern|sonnenwend|kirmes|kirchweih|erntedank|schlachtfest|mettenschicht|bergparade|bergaufzug|hutzen|lichterzug/`; `kirmes|kirchweih` aus `stadtfest` streichen.
  - Art `party`: Titel `/tanzturnier|tanzsport/` → `sport/null`; `/tanzkurs|tanzschule|tanzworkshop/` → `kurse/bewegung`. `PARTY_REGELN`, Reihenfolge `fasching, silvester, disco, club`; `club` zusätzlich `legt auf`; die Regel `disco` muss `disco|disko|tanz|\d0er` enthalten (ergänzen, was fehlt).
- [ ] **Step 4: Bestand prüfen** mit dem Skript aus Task 5 — Expected: `konzert/kirche ≥ 40`, `theater/kabarett` gestiegen, `konzertFremd = 0`. Die Liste „Sonstige Konzerte“ in der Ausgabe ansehen; nur nachschärfen, was ein Stichwort trägt, **keine Namen**.
- [ ] **Step 5: Run** `npm test` — PASS. **Commit** `git add src/normalize.js src/rubriken.js test/normalize.test.js test/rubriken.test.js && git commit -m "feat: Kirchenmusik, Brauchtum, Disco vor Club; Kabarett, Lesung und Lichterfest verlassen Konzert und Markt"`

---

### Task 7: Regeln für die Art „sonstiges“ (Rubrik)

**Files:**
- Modify: `src/rubriken.js` (`REGELN`, `FUEHRUNG`, Zweig für alle übrigen Arten in `rubrikUndGenre`), `test/rubriken.test.js`

**Interfaces:**
- Consumes: Konzert-Unterpunkt-Hilfe und Fest-Regeln aus Task 6.
- Produces: `rubrikUndGenre` für Art `sonstiges` (und jede unbekannte Art) nach der neuen Rangfolge. Unterpunkte setzt diese Task nur für Konzert, Fest, Party, Ausstellung und die Fälle mit festem Unterpunkt (Sternwarte → `vortrag`); alle anderen kommen in Task 8 und sind bis dahin `null`. Die Tests dieser Task prüfen deshalb nur dort den Unterpunkt, wo er hier genannt ist.

Rangfolge (die erste passende Stufe gewinnt):
1. Titel `/christmette|christvesper|christnacht/` → `konzert/kirche`.
2. Starke Wörter im Titel, in dieser Reihenfolge: Führungen (auch Sonderfahrt Bahn) → Kinder → Theater → Kurse → Sport → Wandern → Essen → Feste (nur Brauchtum-Wörter) → Partys → Ausstellungen → Konzerte.
3. Spielstätte (`placeName`): Theaterhaus → `theater`; Sternwarte → `kurse/vortrag`; Volkshochschule → `kurse`; Konzertbühne → `konzert`.
4. Jahreszeit im Titel (`advent(?!ure|urer)|weihnacht|nikolaus|christkind|pyramide|winterzauber|lichterfest|lichtelfest`) → `fest/weihnachten`.
5. Anfang der Beschreibung (200 Zeichen), nur: Führungen, Kinder (nur Wendungen wie „für Kinder“, „ab 4 Jahren“), Theater, Kurse, Wandern.
6. Sonst `sonstiges`.

- [ ] **Step 1: Failing tests** in `test/rubriken.test.js` (alle `art:'sonstiges'`, echte Titel; geprüft wird die Rubrik, der Unterpunkt nur wo genannt)
  - `Führung schlägt Essen (Entscheidung 9), Bahn (11)`: „Glühwein, Lichter & Geschichte - die WEIHNACHTSTOUR mit dem Stadtschleicher“, „Bautzener Lichterfahrt: Mit Panorama und Glühwein durch den Advent“, „Der Nachtwächter zu Bautzen“, „Rathausturm - Zwiedzanie Wieży Ratuszowej po polsku“, „Kleine Mühlentour mit Besuch der Max Bähr-Mühle“, „Adventszauber auf der Weißeritztalbahn“, „Nikolausfahrt mit dem Dampfzug“ → `fuehrung`. Gegenbeispiel: `{title:'Kommunikation in hybriden Teams – Führung auf Distanz wirksam gestalten (Onlinekurs)', placeName:'Kreisvolkshochschule Bautzen - Online'}` → `kurse`; „Seminar für Führungskräfte“ → `kurse`; „Modellbahnausstellung im Lokschuppen“ → `ausstellung` (keine Sonderfahrt).
  - `Kinder vor Theater, Kurse, Essen`: „Kindertheater: Der Grüffelo“, „Bastelkurs für Kinder“, „Plätzchenbacken für Kinder“, „Laternebasteln im Schuberts e.V.“ → `kinder`; „Kinderführung im Schloss“ → `fuehrung`. Gegenbeispiel: „Familienalbum ‒ aus dem Leben der Görlitzer Juden | Die Familie Alexander“ → nicht `kinder`.
  - `Theater (Entscheidung 1 bis 4, 15)`: `{title:'Kabarett „Der nackte Shakespeare 2“'}`, „Signierstunde“, „Buchpremiere "Serbska protyka 2027"“, „Kurzfilmtag mit den Senftenberger Videofilmern“, „Theaterdinner "Die Schneekönigin"“ → `theater`; über die Spielstätte: `{title:'Eine Woche voller Samstage', placeName:'Haus Zittau Großer Saal'}`, `{title:'Wunderwahr', placeName:'Haus Görlitz Apollo'}` → `theater`. Gegenbeispiele: „Vorführung der historischen Dampfmaschine“ → nicht `theater`; `{title:'Mark Reeder legt auf', placeName:'Haus Zittau Großer Saal'}` → `party`.
  - `Kurse`: `{title:'Liebesgeschichten am Nachthimmel', placeName:'Scultetus-Sternwarte, Raum Görlitz'}` → `kurse/vortrag`; „Tanzkursreihe 2026 – Kurs „A““ → `kurse`; „Französisch To Go - Einführungskurs“ → `kurse`.
  - `Sport & Freizeit (Entscheidung 12)`: „Eislaufen in Görlitz“, „Tischtennisspiel“, „Geselliger Kegelabend“, „Winterskat im Gasthof Hillig“, „Spieleabend im Jugendclub“, „Volleyballturnier“ → `sport`, `genre:null`. Gegenbeispiele: „Eröffnung des Skateparks“ → `sonstiges`; „Krippenspiel in der Stadtkirche“ → nicht `sport`.
  - `Essen wird enger (Entscheidung 14)`: „Adventsbrunch im Berghotel“, „Whisky-Tasting“, „Gänseessen im Landgasthof“, „Kaffeeklatsch“ → `essen`; `{title:'Lebendiger Adventskalender in Mulda', description:'Täglich vom 1. bis 23. Dezember … mit Kaffee und Kuchen'}` → `fest/weihnachten`; `{title:'Seniorentreff', description:'Bei Kaffee und Kuchen …'}` → `sonstiges`.
  - `Feste, Partys, Ausstellungen, Konzerte aus Sonstiges (Entscheidung 15)`: „Weihnachtliche Mettenschicht im Besucherbergwerk“, „Bergparade im Fackelschein“ → `fest/brauchtum`; „Lebendiger Adventskalender in Frauenstein“ → `fest/weihnachten`; „Ball Royale“ → `party/silvester`; „BKC Weiberfasching“ → `party/fasching`; „»HANS-PETER MENGE. Zeichnungen und Druckgrafik«“ → `ausstellung/kunst`; „Weihnachtszeit: Christmette“, „Christnacht mit Lichterzug in der Kirche“ → `konzert/kirche`; „Adventssingen im Rathaus“ → Rubrik `konzert` (Jahreszeit ist schwach); `{title:'FORCED TO MODE', placeName:'Hutbergbühne Kamenz'}` → Rubrik `konzert`.
  - Bestehende Tests: „Kindertheater → theater“ wird zu `kinder` (Entscheidung Kinder vor Theater); der Test „Haus mit Kino im Namen: letzter Hinweis“ bleibt im Ergebnis gleich; alle übrigen bestehenden Fälle bleiben grün (`Karaoke-Abend` → `sonstiges`, `Carmen` mit Beschreibung „Oper am Theater“ → `theater`, unsinnige Eingaben → `sonstiges`).
- [ ] **Step 2: Run** `node --test test/rubriken.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.** Startwerte der Titelregeln (Kleinschreibung):
  - `FUEHRUNG`: bisherige Regel, dazu `zwiedzanie|prohl[ií]dk|stadtschleicher|lichterfahrt|(?:stadt|altstadt|kneipen|gl[uü]hwein|laternen|fackel|m[uü]hlen|weihnachts)tour\b`; das Wort Führung zählt nicht vor `skr[aä]ft|sstil|skompetenz| auf distanz`. `BAHN`: `/sonderzug|sonderfahrt|dampfzug|dampflok|(?:nikolaus|gl[uü]hwein|advents|osterhasen|mondschein)(?:fahrt|express|zug)|schmalspurbahn|talbahn\b|grundbahn\b|museumsbahn|kleinbahn/`.
  - Kinder: `/kinder|m[aä]rchen|krabbel|ferienprogramm|basteln|puppentheater|kasper|familien(?:tag|nachmittag|sonntag|programm|theater|zeit|kino|vorstellung|konzert|st[uü]ck|musical|angebot)|f[uü]r (?:die ganze )?famili/`; Wendungen für die Beschreibung: `/f[uü]r kinder|ab \d+ jahren?|kindertheater|puppentheater|familienprogramm/`.
  - Theater: bisherige Regel ohne `vorf[uü]hrung`, dazu `filmvorf[uü]hrung|kurzfilm|filmabend|sommerkino|comedy|stand.?up|satire|signierstunde|buchpremiere|variet`.
  - Kurse: bisherige Regel.
  - Sport: `/eislauf|schlittschuh|tischtennis|kegel|bowling|skat\b|skatturnier|spiele(?:abend|nachmittag|tag|treff)|brettspiel|turnier|volleyball|fu[sß]ball|handball|basketball|eishockey|heimspiel|marathon|\blauf\b|(?:stadt|volks|silvester|advents|nikolaus|cross|berg|wald|spenden|benefiz|neujahrs)lauf\b|schwimm|tanzsport|billard|dart|schach|wettkampf|meisterschaft/`.
  - Wandern: bisherige Regel.
  - Essen (nur Titel): `/brunch|dinner|men[uü]\b|verkostung|weinprobe|bierprobe|tasting|whisky|kulinar|fr[uü]hst[uü]ck|schmaus|buffet|kaffeeklatsch|\bessen\b|(?:abend|mittag|sonntags|festtags|weihnachts|gourmet|ritter|wein|g[aä]nse|enten|schlacht)essen\b|g[aä]nsebraten|martinsgans/`.
  - Feste: die Brauchtum-Regel aus Task 6. Partys: `/party|disco|disko|\bball\b|tanzabend|tanznacht|fasching|karneval|\bbkc\b|legt auf|silvester/`, Unterpunkt `detectSorte('party', Titel)`. Ausstellungen: `/vernissage|finissage|ausstellung|zeichnungen|druckgrafik|malerei|fotografien|skulpturen/`, Unterpunkt `kunst` oder `museum` aus `detectSorte('schau', Titel)`, sonst `null`. Konzerte: bisherige Regel, Unterpunkt über die Hilfe aus Task 6.
  - Spielstätten: Theaterhaus `/theater|kino|divadl|kleinkunst|puppenb[uü]hne|\bhaus (?:zittau|g[oö]rlitz)\b|apollo/`; Sternwarte `/sternwarte|planetarium/`; Volkshochschule `/volkshochschule|\bk?vhs\b/`; Konzertbühne `/hutbergb[uü]hne/`.
- [ ] **Step 4: Bestand prüfen** mit dem Skript — Expected: `sonstiges ≤ 110`, `essen` zwischen 35 und 60, `sport ≥ 40`. Die verbliebenen Titel unter „Sonstiges“ in der Ausgabe ansehen und Regeln nur für Gruppen nachschärfen, die ein gemeinsames Stichwort tragen.
- [ ] **Step 5: Run** `npm test` — PASS. **Commit** `git add src/rubriken.js test/rubriken.test.js && git commit -m "feat: neue Rangfolge für Sonstiges (Titel, Spielstätte, Beschreibung), Sport & Freizeit, engeres Essen"`

---

### Task 8: Unterpunkte für Führungen, Theater, Kurse, Wandern, Essen, Kinder

**Files:**
- Modify: `src/unterpunkte.js` (neu `unterpunkt`), `src/rubriken.js` (ruft `unterpunkt` für diese sechs Rubriken; `FUEHRUNG_REGELN` zieht um), `test/rubriken.test.js`
- Create: `test/unterpunkte.test.js`

**Interfaces:**
- Produces: `unterpunkt(rubrik: string, titel: string, beschreibung?: string|null, ort?: string|null): string|null` in `src/unterpunkte.js` — erster Treffer im Titel, sonst in den ersten 200 Zeichen der Beschreibung; für `theater` als letzter Rückfall die Spielstätte (`kino` → `'kino'`, sonstiges Theaterhaus → `'schauspiel'`). Für andere Rubriken `null`. Wirft nie.
- `rubrikUndGenre` setzt für die sechs Rubriken `genre = passender Hinweis ?? unterpunkt(…)`, außer wo Task 6 oder 7 den Unterpunkt fest gesetzt hat.

- [ ] **Step 1: Failing tests** in `test/unterpunkte.test.js` (`u = unterpunkt`)
  - `fuehrung` (Reihenfolge bahn, kinder, untertage, brauerei, hausfuehrung, stadt): „Adventszauber auf der Weißeritztalbahn“ → `bahn`; „Kinderführung im Schloss“ → `kinder`; „Besichtigung des Stollens“ → `untertage`; „Mühlen- und Bäckereiführung“ → `brauerei`; „Kleine Mühlentour mit Besuch der Max Bähr-Mühle“ → `brauerei`; „Öffentliche Führung durch das Museum Bautzen“, „Führung durch das Stadtmuseum“, „Rathausturm - Zwiedzanie Wieży Ratuszowej po polsku“, „Kuratorenführung zur TRAUMZEIT“ mit Beschreibung „… in der Ausstellung“ → `hausfuehrung`; „Der Nachtwächter zu Bautzen“, „Bautzener Lichterfahrt: Mit Panorama und Glühwein durch den Advent“, „Altstadtrundgang“ → `stadt`; „Führung“ → `null`.
  - `theater` (Reihenfolge kabarett, lesung, kino, show, schauspiel): „Kabarett „Der nackte Shakespeare 2““ → `kabarett`; „Signierstunde“, „Buchpremiere "Serbska protyka 2027"“, „Vorlesestunde“ → `lesung`; „Kurzfilmtag mit den Senftenberger Videofilmern“, „Steinhaus-Kino: Vaterland“ → `kino`; „Travestie-Revue“, „Zirkus Probst“ → `show`; „Carmen“ mit Beschreibung „Oper am Theater“ → `schauspiel`; `u('theater','Wunderwahr',null,'Haus Görlitz Apollo')` → `schauspiel`; `u('theater','Vaterland',null,'Kunstbauerkino Großhennersdorf')` → `kino`; `u('theater','Abend',null,'Gasthof')` → `null`.
  - `kurse` (Reihenfolge bewegung, kreativ, lernen, vortrag): „Tanzkursreihe 2026 – Kurs „A““, „Yoga am Morgen“ → `bewegung`; „Töpferkurs“, „Kochkurs: Sächsische Küche“ → `kreativ`; „Französisch To Go - Einführungskurs“, „Smartphone-Sprechstunde“, „Kommunikation in hybriden Teams – Führung auf Distanz wirksam gestalten“ → `lernen`; „Archäologischer Vortrag: Von Teufelssteinen“, „Reisebericht Island“ → `vortrag`.
  - `wandern` (Reihenfolge wanderung, spaziergang, natur): „Geführte Wanderung rund um Berggießhübel“ → `wanderung`; „Abendspaziergang durch den Park“ → `spaziergang`; „Vogelbeobachtung am Stausee“, „Schaufütterung der Erdmännchen“ → `natur`.
  - `essen` (Reihenfolge brunch, verkostung, dinner): „Adventsbrunch im Berghotel“ → `brunch`; „Whisky-Tasting“, „Weinprobe im Schlosskeller“ → `verkostung`; „Gänseessen im Landgasthof“, „Krimidinner“ → `dinner`; „Kaffeeklatsch“ → `null`.
  - `kinder` (Reihenfolge kinder-buehne, kinder-mitmachen, kinder-lernen): „Kindertheater: Der Grüffelo“, „Kinderkino“ → `kinder-buehne`; „Laternebasteln im Schuberts e.V.“, „Plätzchenbacken für Kinder“ → `kinder-mitmachen`; „Vorlesestunde für Kinder“, „Kinderuni“ → `kinder-lernen`.
  - `wirft nie, andere Rubriken`: `u('konzert','Jazz')`, `u('sport','Lauf')`, `u('theater', undefined)` → `null`.
  - In `test/rubriken.test.js` ein Durchstich je Rubrik über `rubrikUndGenre` (z. B. `{art:'schau', title:'Öffentliche Führung durch das Museum Bautzen'}` → `fuehrung/hausfuehrung`; `{art:'sonstiges', title:'Eislaufen in Görlitz'}` → `sport/null`) und `Hinweis der Quelle zählt nur, wenn er zur Rubrik passt`: `{art:'sonstiges', genre:'kabarett', title:'Abendprogramm im Theater'}` → `theater/kabarett`; `{art:'sonstiges', genre:'jazz', title:'Abendprogramm im Theater'}` → `theater/schauspiel`.
- [ ] **Step 2: Run** `node --test test/unterpunkte.test.js test/rubriken.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement.** Startwerte:
  - fuehrung: `bahn` = `BAHN` aus Task 7; `kinder` `/kinder|familie/`; `untertage`, `brauerei` wie bisher; `hausfuehrung` `/museum|schloss|schlo[sß]|\bburg|kirche|\bdom\b|kloster|\bhaus|rathaus|turm|ausstellung|galerie|gedenkst[aä]tte|sammlung|festung|synagoge|bibliothek|kurator|zeitzeug/`; `stadt` `/stadt|rundgang|dorf|spazier|nachtw[aä]chter|stadtschleicher|lichterfahrt|g[aä]sschen/`.
  - theater: `kabarett` `/kabarett|cabaret|comedy|comedian|stand.?up|satire|kleinkunst|\bhumor/`; `lesung` `/lesung|vorlese|\bliest\b|buchvorstellung|buchpremiere|autorengespr|literatur|poetry|\bslam\b|signierstunde|erz[aä]hl/`; `kino` `/kino|\bfilm|kurzfilm|filmfest|filmabend|filmvorf/`; `show` `/musical|revue|\bshow\b|zirkus|circus|cyrkus|travestie|zauber|variet|artistik|akrobat/`; `schauspiel` `/theater|schauspiel|oper\b|operette|ballett|kom[oö]die|trag[oö]die|auff[uü]hrung|premiere|inszenierung|puppenspiel|marionett|divadel|b[uü]hne/`.
  - kurse: `bewegung` `/yoga|pilates|tanz|fitness|gymnastik|qi.?gong|tai.?chi|meditation|entspann|r[uü]cken|zumba|klangschal|achtsam/`; `kreativ` `/kreativ|mal(?:en|kurs|treff|nachmittag)|zeichn|t[oö]pfer|keramik|n[aä]h|strick|h[aä]kel|filz|bastel|handwerk|schnitz|kl[oö]ppel|koch|back|floristik|schmied|foto|photowalk|reparatur/`; `lernen` `/computer|\bpc\b|smartphone|handy|internet|digital|\bki\b|excel|sprach|englisch|franz[oö]sisch|tschechisch|polnisch|spanisch|italienisch|beruf|bewerb|weiterbildung|schulung|seminar|lehrgang|kommunikation|f[uü]hrungs?\b|f[uü]hrung auf|online/`; `vortrag` `/vortrag|reisebericht|multivision|infoabend|gespr[aä]ch|podium|diskussion|sternwarte|ratgeber/`.
  - wandern: `wanderung` `/wander|exkursion|radtour|\btour\b/`; `spaziergang` `/spazier|bummel/`; `natur` `/vogel|tier|\bzoo\b|natur|pilz|kr[aä]uter|wald|fledermaus|artenschutz|vivarium|f[uü]tter|erdm[aä]nn/`.
  - essen: `brunch` `/brunch|fr[uü]hst[uü]ck/`; `verkostung` `/verkostung|probe\b|tasting|whisky|degustation/`; `dinner` `/dinner|men[uü]|essen\b|buffet|schmaus|braten|gans\b/`.
  - kinder: `kinder-buehne` `/theater|puppen|kasper|marionett|kino|film|konzert|musik|zirkus|musical|zauber|b[uü]hne|m[aä]rchen/`; `kinder-mitmachen` `/bastel|back|pl[aä]tzchen|werkstatt|mitmach|kreativ|malen|t[oö]pfer|experiment|spiel|ferien|krabbel|laterne/`; `kinder-lernen` `/vorlese|lese|bibliothek|lern|kinderuni|forscher|entdecker|geschichten|bilderbuch/`.
- [ ] **Step 4: Bestand prüfen** mit dem Skript — Expected: in jeder der sechs Rubriken liegt der Sammelpunkt (`…/sonstige`) unter der Hälfte ihrer Termine; `fuehrung/hausfuehrung ≥ 30`, `fuehrung/bahn ≥ 10`, `theater/kabarett ≥ 15`. Wo nicht: Titel des Sammelpunkts ansehen, Stichwörter ergänzen.
- [ ] **Step 5: Run** `npm test` — PASS. **Commit** `git add src/unterpunkte.js src/rubriken.js test/unterpunkte.test.js test/rubriken.test.js && git commit -m "feat: Unterpunkte für Führungen, Theater, Kurse, Wandern, Essen und Kinder"`

---

### Task 9: Filterseite — leere Unterpunkte ausblenden, gespeicherte Auswahl schützen

**Files:**
- Modify: `site/js/filter.js` (`loadPrefs`, `savePrefs`, neu `zaehleSorten`), `site/js/filterseite.js:325-340` (`aktualisieren`, Abschnitt „Was?“), `test/filter-ort-zeit.test.js`, `test/filter.test.js`, `test/filterseite.test.js`

**Interfaces:**
- Consumes: `SORTEN`, `sorteFilter` aus `site/js/arten.js` (Task 2).
- Produces in `site/js/filter.js`:
  - `zaehleSorten(events, prefs, nowIso, orte = {}): Record<string, number>` — Termine je Unterpunkt-Schlüssel (alle Schlüssel aller Rubriken einschließlich der Sammelpunkte, 0 für leere), gezählt unter denselben Filtern wie `zaehleRubriken` (`{ ohneRubrik: true }`).
  - `savePrefs` schreibt zusätzlich `stand: 2`. `loadPrefs`: `hiddenGenres` wird nur übernommen, wenn `roh.stand === 2`, und dann auf bekannte Unterpunkt-Schlüssel beschränkt; sonst `[]`. Alles andere wie bisher. Das Feld `stand` gehört nicht zum Rückgabewert von `loadPrefs`.
- `aktualisieren` in `site/js/filterseite.js`: ein Unterpunkt-Chip ist `hidden`, wenn sein Zähler 0 ist und er nicht gerade gewählt ist (`wahl !== null && wahl.includes(schluessel)`); die Gruppe ist sichtbar, wenn die Rubrik gewählt ist und (mindestens zwei ihrer Chips Termine haben oder eine Auswahl aktiv ist, `wahl !== null`). „Alle“ bleibt immer in der Gruppe.

- [ ] **Step 1: Failing tests**
  - `test/filter-ort-zeit.test.js`:
    - `loadPrefs: Unterpunkt-Auswahl aus der Zeit vor Stand 2 wird einmal zurückgesetzt`: gespeichert `{rubriken:['konzert'], hiddenGenres:['rock-pop','metal-punk','klassik','kirche','jazz','schlager-folk','hiphop-elektro','musical','sonstige'], maxKm:50, ort:'Bautzen'}` (nur Comedy gewählt, ohne `stand`) → `hiddenGenres: []`, `rubriken: ['konzert']`, `maxKm: 50`, `ort: 'Bautzen'`; ebenso für `{rubriken:['fest'], hiddenGenres:['familie','stadtfest','weihnachten','festival','sonstige-fest']}` → `[]`. Danach liefert `applyFilters` mit einem Konzert ohne Genre genau diesen Termin (keine leere Liste).
    - `loadPrefs: mit Stand 2 bleiben bekannte Schlüssel, unbekannte fallen weg`: `{stand:2, hiddenGenres:['jazz', 3, 'comedy', 'gibtsnicht', 'kabarett']}` → `['jazz','kabarett']`; `{stand:2, hiddenGenres:'jazz'}` → `[]`. Der bestehende Test Zeile 374 ff. wird darauf umgestellt.
    - `savePrefs schreibt den Stand`: nach `savePrefs` enthält der gespeicherte Text `"stand":2`; `loadPrefs` danach gibt die gespeicherten `hiddenGenres` zurück und kein Feld `stand`.
    - `zaehleSorten`: drei Konzerte (jazz, jazz, ohne Genre), ein Theatertermin `kabarett`, ein vergangener Jazz-Termin → `jazz: 2`, `sonstige: 1`, `kabarett: 1`, `klassik: 0`, `sonstige-theater: 0`; mit `prefs.rubriken = ['markt']` dieselben Zahlen (Rubrikwahl wirkt nicht); mit `prefs.suche = 'gibtsnicht'` alle 0; mit `prefs.rubriken = ['konzert']` und einer Unterpunkt-Auswahl nur `klassik` (alle anderen Konzert-Schlüssel in `hiddenGenres`) bleiben `jazz: 2` und `sonstige: 1` (die Auswahl ändert die Zähler nicht, sonst verschwänden alle nicht gewählten Unterpunkte).
  - `test/filterseite.test.js`:
    - `leere Unterpunkte sind ausgeblendet`: Rubrik Konzerte gewählt, Termine nur mit `jazz` und `klassik` → Chips Jazz und Klassik sichtbar, „Rock & Pop“ `hidden`, Gruppe sichtbar.
    - `ein gewählter Unterpunkt bleibt sichtbar, auch wenn er leer wird`: Auswahl nur `rock-pop`, kein Rock-Termin → Chip „Rock & Pop“ sichtbar und `aria-pressed="true"`, Gruppe sichtbar.
    - `weniger als zwei Unterpunkte mit Terminen: keine Gruppe`: Rubrik Konzerte gewählt, alle Konzerte `jazz`, Auswahl „Alle“ → Gruppe `hidden`.
    - `14 Kacheln`: `.kachel` kommt 14-mal vor, die vorletzte heißt „Sport & Freizeit“ und hat keine Unterpunkt-Gruppe.
- [ ] **Step 2: Run** `node --test test/filter-ort-zeit.test.js test/filter.test.js test/filterseite.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** wie unter Interfaces. In `aktualisieren` `zaehleSorten` einmal je Durchlauf aufrufen.
- [ ] **Step 4: Run** `npm test` — PASS. **Commit** `git add site/js/filter.js site/js/filterseite.js test/filter-ort-zeit.test.js test/filter.test.js test/filterseite.test.js && git commit -m "feat: leere Unterpunkte ausgeblendet, gespeicherte Unterpunkt-Auswahl einmal zurückgesetzt"`

---

### Task 10: Abnahme am Bestand, Ansehen, Version 1.6.0

**Files:**
- Modify: `package.json`, `package-lock.json` (Version `1.6.0`); bei Nachbesserungen `src/rubriken.js`, `src/normalize.js`, `src/unterpunkte.js`, `src/aussortieren.js` und die zugehörigen Tests
- Erzeugt außerhalb des Git: `.superpowers/einsortierung/tabelle.md`, `stichprobe.json`, `bewertung.md` (im Hauptverzeichnis `E:\ClaudeCode\Eventcalender\.superpowers\einsortierung\`)

**Interfaces:**
- Consumes: Prüfskript aus Task 5, alle Regeln.

- [ ] **Step 1: Tabelle erzeugen** `node scripts/einsortierung-pruefen.js "E:\ClaudeCode\Eventcalender\.superpowers\bestand-2026-11-23\events.json" --stichprobe 300 --seed 20261124 --aus "E:\ClaudeCode\Eventcalender\.superpowers\einsortierung"` — Expected: Ziele `sonstiges ≤ 110`, `konzert/kirche ≥ 40`, `theater/kabarett ≥ 15`, `aussortiert ≤ 20`, `konzertFremd = 0` erreicht; jeder aussortierte Termin hat einen Grund, den man beim Lesen des Titels sofort einsieht.
- [ ] **Step 2: Stichprobe bewerten lassen.** Ein frischer Unterauftrag (nicht der Autor der Regeln) bekommt nur `stichprobe.json` und die Tabelle der Rubriken und Unterpunkte aus dem Entwurf. Auftrag: je Termin „Rubrik richtig?“ und, wo ein Unterpunkt vergeben ist, „Unterpunkt richtig?“; bei „falsch“ die richtige Rubrik nennen. Ergebnis nach `bewertung.md`: je Rubrik Anzahl, Anteil richtig, Liste der Fehler; gesamt Rubrik-Quote und Unterpunkt-Quote. Ziele: Rubrik ≥ 92 %, keine Rubrik unter 80 % (Rubriken mit weniger als 5 Terminen in der Stichprobe nur nennen, nicht werten), Unterpunkt ≥ 85 %.
- [ ] **Step 3: Nachbessern, höchstens zwei Runden.** Nur Fehler angehen, die eine Gruppe mit gemeinsamem Stichwort bilden; je Änderung ein Test mit dem echten Titel und einem Gegenbeispiel; danach Step 1 wiederholen (die Stichprobe wird nicht neu gezogen, die betroffenen Termine werden nachgeschlagen). Nach der zweiten Runde wird nicht weiter geschraubt: verfehlte Werte kommen mit Grund in die Tabelle. Keine Namen, keine Einzeltermine in den Regeln.
- [ ] **Step 4: Ansehen.** Mit `--schreiben <Arbeitsbaum>/site/data/events.json` die fertig eingeordneten Termine ablegen (im Arbeitsbaum fehlen `places.json`, `status.json`, `version.json`; aus `E:\ClaudeCode\Eventcalender\site\data\` kopieren, soweit vorhanden). Seite über die Vorschau starten (Eintrag aus `E:\ClaudeCode\Eventcalender\.claude\launch.json`; die Datei steht nicht im Git und muss in den Arbeitsbaum kopiert werden), Handy-Format 375 × 812. Diesen Schritt macht die steuernde Sitzung selbst, kein Unterauftrag. Prüfen und mit Bildschirmfotos belegen: 14 Kacheln ohne Scrollen im ersten Bild; „Sport & Freizeit“ hat eine Zahl und keine Unterpunkte; Theater zeigt die neuen Unterpunkte, leere fehlen; ein gewählter Unterpunkt bleibt sichtbar, wenn der Zeitraum ihn leert; eine Karte eines tschechischen Theatertermins trägt „auf Tschechisch“, ein tschechisches Konzert nicht; keine Fehler in der Konsole. Hell und dunkel je einmal.
- [ ] **Step 5: Version** in `package.json` und `package-lock.json` (beide Stellen) auf `1.6.0`. `npm test` — Expected: PASS, alle Tests.
- [ ] **Step 6: Commit** `git add package.json package-lock.json` (und geänderte Regel- und Testdateien einzeln) `&& git commit -m "feat: neue Einsortierung abgenommen (1.6.0)"`. **Kein Push.**
- [ ] **Step 7: Übergabe an den Betreiber:** `tabelle.md` (vorher/nachher je Rubrik und Unterpunkt, aussortierte Termine mit Grund), die Quoten aus `bewertung.md`, verfehlte Ziele mit Grund, die Bildschirmfotos. Veröffentlicht wird erst nach seinem ausdrücklichen OK.
