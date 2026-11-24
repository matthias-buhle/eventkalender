# Serien zusammenfassen: Entwurf

Stand: 24.11.2026. Grundlage sind die Entscheidung des Betreibers (Projektinhaber, einziger Betreiber) vom 24.11.2026 („Serien zusammenfassen: eine Zeile mit Zeitraum/Rhythmus, Kacheln zählen Veranstaltungen“), eine Zählung am lokalen Bestand vom 23.11.2026 und seine Antworten im Gespräch am 24.11.2026 abends. Was er entschieden hat, steht ohne Zusatz. Was ich dazu festgelegt habe, ist mit **(Annahme)** markiert; die Annahmen im Abschnitt „Was der Betreiber gesehen hat“ hat er als Zusammenfassung gelesen und bestätigt, die übrigen kann er beim Lesen ändern.

## Warum

Viele Veranstaltungen stehen heute mehrfach in der Liste, weil die Quellen je Tag einen eigenen Eintrag liefern: der Striezelmarkt 29-mal, eine Ausstellung in Bautzen 60-mal, „Yoga am Morgen“ 13-mal. Am Bestand vom 23.11.2026 (2593 noch aktuelle Termine, mit den Regeln von 1.6.0 neu eingeordnet) gehören 1490 Termine zu solchen Wiederholungen. Die Liste wird dadurch lang, und die Zahlen auf den Kacheln sagen nicht, wie viel es wirklich zu erleben gibt: „Märkte 616“ sind 136 Märkte.

Wer das Projekt kennt: Web-App ohne Server (`site/`, reines JavaScript ohne Framework, deutsche Texte, Handy zuerst, PWA mit Service Worker). Ein täglicher Lauf (`src/`, Node 24, `npm run build`) sammelt Termine aus Quellen und schreibt `site/data/events.json`; jeder Eintrag ist ein einzelner Termin mit `start`, `end`, `hasTime`, `title`, `placeName`, `rubrik`, `genre`, `sources`, `ticketStatus` und weiteren Feldern (`src/model.js`). `src/dedupe.js` führt nur gleiche Termine am selben Tag zusammen. Die Seite filtert (`site/js/filter.js`, `applyFilters`), zählt (`zaehleRubriken`, `zaehleSorten`, `anzeigeText`), ordnet nach Tagen (`groupByDay`), zeichnet Karten und das Fenster „Einzelheiten“ (`site/js/render.js`, `site/js/app.js`) und markiert Tage im Kalender (`site/js/kalender.js`).

## Ziele

- Eine Serie steht in der Liste als **eine** Karte. Die Karte nennt den nächsten Termin und darunter Rhythmus, Ende und Anzahl.
- Kacheln, Unterpunkte und der Knopf der Filterseite zählen Veranstaltungen: eine Serie zählt 1.
- Am Bestand vom 23.11.2026 werden aus 2593 Einzelterminen 1265 Veranstaltungen (siehe „Abnahme“).
- Alles geschieht automatisch aus Titel, Ort, Rubrik und Datum.

## Nicht-Ziele

- Theater & Lesungen und Konzerte werden **nicht** zusammengefasst. Dort bleibt jede Vorstellung ein eigener Termin, auch wenn ein Stück 27-mal im selben Haus läuft oder eine Orgelmusik fast täglich stattfindet.
- Einträge, die heute schon ein Termin mit Anfang und Ende sind (eine Ausstellung vom 1.11. bis 31.1. als ein Eintrag), bleiben unverändert.
- Kein besseres Erkennen von Doppeln über Quellen hinweg. Fast gleiche Titel („Bigbandkonzert“ / „Bigbandkonzerte“) oder ein deutscher und ein englischer Eintrag derselben Veranstaltung bleiben getrennt und ergeben zwei Karten.
- Keine Änderung an Rubriken, Unterpunkten, Filtern, am Kalender oder an der Zeile mit der Zusammenfassung über der Liste.
- Keine Handpflege: keine Liste einzelner Veranstaltungen, Titel oder Orte.

## Anti-Ziele

- Ein Termin verschwindet oder ist nicht mehr zu finden, weil er in einer Serie steckt. Jeder Einzeltermin, den die Filter heute zeigen, muss danach entweder als eigene Karte oder als Termin einer gezeigten Serie erreichbar sein.
- Zwei verschiedene Veranstaltungen verschmelzen zu einer Karte (gleicher Titel an zwei Orten; dieselbe Show im November 2026 und im November 2027).
- Die Karte verspricht etwas Falsches: ein Ende, das die Quelle gar nicht kennt, oder „täglich“, obwohl Tage fehlen.
- Eine ältere, im Handy zwischengespeicherte Fassung der Seite kommt mit den neuen Daten nicht zurecht, oder die neue Seite mit alten Daten.

## Was als Serie zählt

Eine Serie sind mindestens zwei Termine mit

- gleichem Titel (verglichen wie in `src/dedupe.js`: `fold` aus `src/geo.js`),
- gleichem Ort (wie in `src/dedupe.js`: der über `resolvePlace` aufgelöste Ortsname, sonst `placeName`, gefaltet),
- gleicher Rubrik, und die Rubrik ist weder `theater` noch `konzert`,
- **(Annahme)** gleichem Unterpunkt (`genre`). So haben alle Termine einer Serie dieselbe Rubrik und denselben Unterpunkt, und die Filter der Seite können eine Serie nie halb zeigen. Am Bestand ändert das nichts (162 Serien mit und ohne diese Bedingung).

Liegen zwei aufeinanderfolgende Termine einer solchen Gruppe mehr als 42 Tage (sechs Wochen) auseinander, gemessen von Starttag zu Starttag, wird dort getrennt. Die Teile davor und danach sind eigene Serien, wenn sie mindestens zwei Termine haben, sonst Einzeltermine.

Dasselbe an zwei Orten sind zwei Serien. Welche Quelle einen Termin geliefert hat, spielt keine Rolle; Termine einer Serie dürfen aus verschiedenen Quellen stammen.

**(Annahme)** Ein Termin ohne Ortsangabe (leerer `placeName`) gehört nie zu einer Serie; sonst würden ortlose Termine mit gleichem Titel verschmelzen. Am Bestand gibt es keinen solchen Termin, die Zahlen unten ändern sich dadurch nicht.

Zwei Einträge einer Serie mit genau gleichem `start` (kommt vor: dieselbe Quelle führt einen Markt doppelt) gelten in der Anzeige und beim Zählen der Termine als **ein** Termin; gezeigt wird der erste. **(Annahme)**

## Wo zusammengefasst wird **(Annahme, technische Entscheidung von mir)**

Der Datenlauf erkennt die Serien und markiert sie; die Seite fasst die markierten Termine zusammen. `events.json` bleibt eine Liste einzelner Termine.

- **Datenlauf:** Ein neuer Baustein (Vorschlag: `src/serien.js`, reine Funktion) läuft nach `fertigstellen` in `src/build.js`, also nach Übersetzung, Aussortieren und endgültiger Einordnung. Er setzt an jedem Termin das Feld `serie`: bei Serienterminen eine Kennung, die innerhalb der Datei für genau diese Serie steht (Zeichenkette), sonst `null`. Wie die Kennung gebildet wird, entscheidet der Bau; sie muss nicht über mehrere Läufe gleich bleiben. Das ist der letzte Schritt vor dem Schreiben: Danach ändert nichts mehr Titel, Ort, Rubrik oder Unterpunkt (so ist `main` in `src/build.js` heute gebaut, und so muss es bleiben). Der Lauf schreibt eine Zeile ins Protokoll: wie viele Serien, wie viele Termine darin. `rohdaten.json` bleibt ohne dieses Feld (dort stehen die Termine vor dem Zusammenführen).
- **Seite:** Ein neuer Baustein (Vorschlag: `site/js/serien.js`, reine Funktionen ohne `window`/`document`) bildet aus gefilterten Terminen die Zeilen der Liste: Einzeltermine und Serien.

Warum so: Die Erkennung braucht `fold` und `resolvePlace`, die es nur im Datenlauf gibt. Die Filter der Seite (Zeitraum, Umkreis, Suche, Tschechien) wirken weiter auf einzelne Termine und müssen nicht neu gebaut werden. Und alt und neu vertragen sich in beiden Richtungen: Eine alte Seite übergeht das Feld `serie` und zeigt wie bisher jeden Termin; die neue Seite zeigt Daten ohne das Feld als Einzeltermine.

## Die Karte einer Serie

Aufbau wie die heutige Karte (Rubrik, Unterpunkt, Gemeinde, Titel, Ort mit Entfernung, Beschreibung, Knöpfe, Quelle). Anders ist nur die Zeitangabe; sie hat zwei Zeilen (vom Betreiber als „Variante B“ gewählt):

1. **„Nächster Termin: Do, 26. Nov., 10:00–21:00 Uhr“**: der nächste Termin der Serie im gewählten Zeitraum, im selben Format wie heute die Zeitangabe einer Karte (`wannText` in `site/js/render.js`), mit dem Wort „Nächster Termin: “ davor. Ein Ticketstatus (abgesagt, ausverkauft, verlegt) dieses Termins steht wie heute daneben.
2. **Rhythmus, Ende und Anzahl**, ruhiger gesetzt (Farbe und Größe wie die Ortszeile). Beispiele: „täglich bis Do, 24. Dez. · 29 Termine“, „jeden Donnerstag bis Do, 18. Feb. · 13 Termine“.

Titel, Ort, Beschreibung, Knöpfe, Quelle und Lizenz kommen vom nächsten Termin (dem aus Zeile 1). **(Annahme)** Unterscheiden sich Beschreibung oder Link zwischen den Terminen einer Serie (am Bestand bei 13 bzw. 44 von 162 Serien), zeigt die Karte also je nach Zeitraum die des jeweils nächsten Termins; das ist gewollt.

**(Annahme)** Ein abgesagter oder verlegter Termin wird nicht „nächster Termin“, solange die Serie im gewählten Zeitraum noch einen anderen Termin hat, der die Filter erfüllt; er erscheint dann nur in der Terminliste des Fensters. Sind alle passenden Termine abgesagt oder verlegt, führt der früheste die Karte an, mit seinem Status. „Ausverkauft“ ändert nichts an der Reihenfolge.

„Heute“ ist überall der Kalendertag in Berliner Zeit nach der Uhr des Geräts, wie in `applyFilters` (`berlinDay`), nicht der Tag des Datenlaufs. Eine Serie kann deshalb auf der Seite weniger Termine haben als im Lauf; hat sie nur noch einen, gilt die erste Zeile der Tabelle unten.

### Die zweite Zeile im Einzelnen

Sie beschreibt die ganze Serie ab heute, nicht nur den gewählten Zeitraum: alle Termine der Serie, deren letzter Tag nicht vor heute liegt. „Ende“ ist der letzte Tag des letzten Termins. Die Regeln, in dieser Reihenfolge; die erste passende gilt:

| Fall | Text | Beispiel am Bestand |
|---|---|---|
| Die Serie hat (ab heute) nur noch einen Termin | keine zweite Zeile, die erste Zeile ohne „Nächster Termin: “ | letzter Tag eines Marktes |
| Zwei oder drei Termine | die übrigen Tage aufgezählt: „auch So, 29. Nov.“, „auch Sa, 5. Dez. und Sa, 12. Dez.“; liegt ein weiterer Termin am selben Tag wie der nächste: „auch 16:00 Uhr“ | Adventsmarkt am Storchenhof (Sa + So) |
| Jeder Tag vom ersten bis zum letzten | „täglich bis Do, 24. Dez. · 29 Termine“ | Striezelmarkt |
| **(Annahme)** Mindestens fünf Tage und mindestens 60 % der Tage vom ersten bis zum letzten | „fast täglich bis So, 27. Dez. · 30 Termine“ | Augustusmarkt (an den Feiertagen zu); Ausstellung Di–So |
| Alle Termine am selben Wochentag, Abstand immer genau eine Woche | „jeden Donnerstag bis Do, 18. Feb. · 13 Termine“ | Yoga am Morgen |
| **(Annahme)** Alle am selben Wochentag, aber mit Lücken | „donnerstags bis Do, 18. Feb. · 11 Termine“ | Geselliger Kegelabend |
| **(Annahme)** Alle Termine an zwei oder drei Wochentagen | „freitags, samstags und sonntags bis So, 13. Dez. · 9 Termine“ (Wochentage in der Reihenfolge Montag bis Sonntag) | Weihnachtsmarkt Fr–So |
| Sonst | „10 Termine bis So, 13. Dez.“ | Weihnachtsführung Seiffen |

Der Betreiber hat „täglich bis …“, „jeden Donnerstag bis …“, das Aufzählen bei zwei oder drei Terminen und „12 Termine bis …“ gesehen. „fast täglich“, „donnerstags“ und die Form mit mehreren Wochentagen habe ich ergänzt, damit Karten wie die einer Ausstellung, die montags zu hat, nicht nur „29 Termine“ sagen. Die Grenze von 60 % ist ein Vorschlag; wichtig ist, dass „täglich“ nur steht, wenn kein Tag fehlt.

„Termine“ zählt die Termine ab heute (gleicher `start` nur einmal). Gezählt wird für diesen Text nach Starttagen; ein Termin, der selbst über mehrere Tage geht (Markt von Freitag 16 Uhr bis Sonntag 20 Uhr, drei Wochenenden lang), zählt als ein Termin.

### Wenn die Quelle das Ende nicht kennt

Die Quelle „Tourismus Sachsen (Open Data)“ liefert offenbar höchstens 30 Termine je Veranstaltung: Am Bestand haben 9 ihrer Serien genau 30 Termine und keine mehr, darunter zwei Führungen, die am 15.1. enden, obwohl der Abruf bis Ende Februar reicht. Bei solchen Serien wäre „bis 15. Jan.“ falsch.

- Der Adapter `src/sources/satourn-api.js` zählt in der Antwort der Schnittstelle die Einträge je Datensatz (gleiche `identifier`) und markiert die Termine von Datensätzen mit 30 oder mehr Einträgen (Vorschlag: Feld `terminlisteVoll: true`; die Grenze als benannte Konstante im Adapter). **(Annahme)** Ob die Grenze wirklich 30 ist und pro Datensatz gilt, lässt sich nur an einer echten Antwort prüfen; ein Abruf im Netz braucht das OK des Betreibers. Bis dahin gilt die Beobachtung am Bestand. Die gespeicherte Antwort im Projekt (`test/fixtures/satourn-api.json`, 13 Einträge, höchstens 2 je Datensatz) reicht dafür nicht; der Test für die Markierung baut sich seine Einträge selbst, wie es `test/satourn-api.test.js` für die Limit-Prüfung schon tut.
- Trägt der letzte Termin einer Serie diese Markierung, nennt die zweite Zeile keine Anzahl und sagt „mindestens bis“: „täglich, mindestens bis Fr, 15. Jan.“, „fast täglich, mindestens bis …“, „jeden Donnerstag, mindestens bis …“, „donnerstags, mindestens bis …“; im Fall „Sonst“ heißt sie „Termine mindestens bis Fr, 15. Jan.“.
- Nur dieser eine Adapter wird dafür angefasst. Die Adapter anderer Quellen und `src/sources/index.js` bleiben unberührt (dort baut gerade eine andere Sitzung eine neue Quelle).

## Wo die Serie in der Liste steht

Die Liste bleibt nach Tagen geordnet. Eine Serie steht **einmal**, unter dem Tag ihres nächsten Termins im gewählten Zeitraum (vom Betreiber gewählt; nicht in einem eigenen Block). Bei „Wochenende“ steht der Striezelmarkt also beim Freitag und nicht noch einmal bei Samstag und Sonntag. Ob ein Termin im Zeitraum liegt, entscheidet dieselbe Regel wie heute in `applyFilters`: Ein mehrtägiger Termin gilt an jedem Tag von seinem Start bis zu seinem letzten Tag. Die Karte steht dort, wo heute die Karte dieses Termins stünde (`groupByDay`): unter seinem Starttag, und wenn der vor heute liegt, unter „Heute“. Innerhalb eines Tages gilt die heutige Reihenfolge nach Startzeit; maßgeblich ist der nächste Termin.

## Zeitraum, Filter, Kalender, Suche

- Eine Serie erscheint, wenn mindestens einer ihrer Termine alle Filter erfüllt, auch den Zeitraum. Bei „Heute“ erscheint sie nur, wenn sie heute stattfindet.
- „Nächster Termin“ ist der früheste Termin der Serie, der alle Filter erfüllt. Ist im Kalender Samstag, der 5.12., gewählt, steht dort der 5.12.
- Der Kalender markiert weiter jeden Tag, an dem etwas stattfindet, also auch jeden Tag einer Serie. `site/js/kalender.js` bleibt unverändert.
- Die Suche findet eine Serie einmal.
- Umkreis, Tschechien, Rubriken und Unterpunkte wirken wie heute; weil alle Termine einer Serie Ort, Rubrik und Unterpunkt teilen, trifft es die Serie immer ganz.

## Zählen

- Die Zahl auf jeder Kachel und an jedem Unterpunkt zählt Veranstaltungen: Einzeltermine je 1, jede Serie mit mindestens einem passenden Termin 1. Es gelten dieselben Filter wie heute (alle außer der Rubrikwahl).
- Der Knopf unten heißt „128 Veranstaltungen anzeigen“, „1 Veranstaltung anzeigen“, „Keine Veranstaltungen gefunden“. Die Zahl ist die Zahl der Karten, die die Liste danach zeigt.
- Die Vorlese-Beschriftung der Kacheln („Konzerte, 12 Termine“) wird entsprechend „… 12 Veranstaltungen“.
- **(Annahme)** Übrige Texte, in denen „Termine“ im allgemeinen Sinn steht (leere Liste, Ladehinweise, Fenster „Über Bühnenlicht“), bleiben; nur der Satz im Über-Fenster, der den Knopf beschreibt, wird angepasst und um einen Satz zu Serien ergänzt.

## Fenster „Einzelheiten“ einer Serie

Ein Tipp auf die Serienkarte öffnet dasselbe Fenster wie heute (vom Betreiber am Bild bestätigt):

- Oben wie die Karte: Rubrik, Titel, die beiden Zeitzeilen, Ort, Beschreibung.
- Neu der Abschnitt **„Termine“**: die nächsten fünf Termine der Serie ab heute (nicht nur die im gewählten Zeitraum), je Zeile Tag und Uhrzeit. Hat ein einzelner Termin einen Ticketstatus, steht er nur in dessen Zeile („abgesagt“).
- Hat die Serie mehr als fünf Termine: ein Knopf „Alle 29 Termine zeigen“, der die Liste an Ort und Stelle aufklappt. Bei einer Serie mit Markierung `terminlisteVoll` heißt er „Alle bekannten Termine zeigen“. **(Annahme)**
- Darunter wie heute Knöpfe (Webseite, Tickets, Anrufen, E-Mail, Navigation), Quelle und Lizenz, vom nächsten Termin.
- **(Annahme)** Die Zeilen der Terminliste sind reiner Text, keine Links. Fremde Werte kommen wie überall nur über `textContent` und `setAttribute` in die Seite, nie über `innerHTML`.

## Was sich im Programm ändert

Als Orientierung für den Bauplan; die genaue Aufteilung entscheidet der Bau.

- `src/serien.js` (neu) und Aufruf in `src/build.js` nach `fertigstellen`; `src/model.js` kennt die Felder `serie` und `terminlisteVoll`.
- `src/sources/satourn-api.js`: Markierung voller Terminlisten.
- `site/js/serien.js` (neu): aus Terminen Zeilen bilden, nächster Termin, Text der zweiten Zeile.
- `site/js/filter.js`: `zaehleRubriken`, `zaehleSorten`, `anzeigeText` zählen Veranstaltungen; `groupByDay` bzw. die Listenbildung arbeitet mit Zeilen.
- `site/js/app.js`, `site/js/render.js`, `site/js/filterseite.js`, `site/js/ueber.js`, `site/style.css`: Karte, Fenster, Knopftext, Beschriftungen.
- `site/sw.js`: neue Datei in die Liste, Cache-Name hochzählen. `package.json`: Version 1.7.0.
- `src/dedupe.js`, `src/rubriken.js`, `src/normalize.js`, `site/js/kalender.js`, `site/js/arten.js` bleiben unverändert.

## Tests und Abnahme

- `npm test` bleibt grün (heute 608 Tests); neue Tests für die Serienerkennung (gleicher Titel an zwei Orten, Lücke über 42 Tage, Theater und Konzert bleiben einzeln, doppelter `start`), für jede Zeile der Rhythmus-Tabelle, für das Zählen und für die Listenbildung (Serie einmal, unter dem richtigen Tag, nächster Termin im Zeitraum).
- Am Bestand vom 23.11.2026 (`E:ClaudeCodeEventcalender.superpowersestand-2026-11-23events.json`; der Ordner `.superpowers` ist von git ausgenommen und liegt nur im Hauptordner, nicht im Arbeitsordner des Pakets; lokal mit `fertigstellen` neu eingeordnet, Stichtag 24.11.2026, ohne Abruf im Netz) ergibt die Zählung „alle Termine, alle Rubriken“:

| Rubrik | Einzeltermine vorher | Veranstaltungen nachher | Serien |
|---|---|---|---|
| Märkte | 616 | 136 | 54 |
| Konzerte | 377 | 377 | 0 |
| Ausstellungen & Museen | 320 | 29 | 13 |
| Theater & Lesungen | 305 | 305 | 0 |
| Führungen | 261 | 46 | 30 |
| Kurse & Vorträge | 162 | 92 | 20 |
| Feste | 147 | 62 | 7 |
| Wandern & Natur | 106 | 28 | 13 |
| Sonstiges | 100 | 58 | 8 |
| Sport & Freizeit | 49 | 11 | 5 |
| Partys | 47 | 43 | 3 |
| Kinder & Familie | 42 | 38 | 2 |
| Essen & Trinken | 35 | 15 | 6 |
| Schauen | 26 | 25 | 1 |
| **Gesamt** | **2593** | **1265** | **162** |

  Die Zahlen stammen aus einer Probezählung mit der Regel oben; der Bau weist sie mit dem fertigen Programm nach und erklärt Abweichungen.
- Die Liste wird lokal an diesen Daten im Browser geprüft (Handybreite, hell und dunkel): Striezelmarkt als eine Karte, „Yoga am Morgen“ mit „jeden Donnerstag“, ein Theaterstück weiter als einzelne Karten, „Heute“ und ein einzelner Kalendertag zeigen den richtigen nächsten Termin, das Fenster zeigt die Terminliste.
- Der Betreiber bekommt die Tabelle Vorher/Nachher und Bilder der Liste gezeigt.

## Was nicht zu diesem Paket gehört

Zusammenführen, Push und Veröffentlichen geschehen erst nach einem eigenen OK des Betreibers. `npm run build` (Abruf der Quellen im Netz) läuft in diesem Paket nicht ohne sein OK. Die Dateien unter `docs/anfragen/` werden nicht angefasst.

## Was der Betreiber gesehen hat

Vier Punkte hat er selbst gewählt: die Karte nach Variante B; Theater und Konzerte bleiben einzeln, alle anderen Rubriken werden zusammengefasst; die Serie steht unter ihrem nächsten Tag; das Fenster „Einzelheiten“ mit Terminliste. Als Zusammenfassung gelesen und mit „Stimmt, aufschreiben“ bestätigt hat er: Verhalten bei Zeitraum, Kalender und Suche; das Zählen und den Knopftext „Veranstaltungen anzeigen“; gleicher Titel, Ort und Rubrik als Merkmal; die Grenze von sechs Wochen; dass Einträge mit Anfang und Ende bleiben; die Formen „täglich bis“, „jeden Donnerstag bis“, Aufzählen bei zwei oder drei Terminen, „12 Termine bis“; „bis mindestens“ bei vollen 30 Terminen von Tourismus Sachsen; und dass der Datenlauf markiert und die Seite zusammenfasst.
