# Neue Einsortierung: Entwurf

Stand: 24.11.2026. Grundlage sind der Bericht `reports/Quellen für alle Rubriken und Orte.md` (Abschnitt 3 und 4, dazu die Notiz `research_notes/Quellen für alle Rubriken und Orte/15 Bestandsprüfung Einsortierung.md`) und 23 Antworten des Projektinhabers (einziger Betreiber) vom 24.11.2026. Was er entschieden hat, steht ohne Zusatz. Was ich dazu angenommen habe, ist mit **(Annahme)** markiert und kann geändert werden.

## Warum

Die Prüfung des veröffentlichten Bestands vom 23.11.2026 (2620 Termine) hat ergeben:

1. In „Sonstiges“ liegen 339 Termine. 208 davon (61 %) gehören in vorhandene Rubriken, allein 79 sind Theater und Kabarett.
2. Unter „Sonstige Konzerte“ (161) ist etwa die Hälfte kein Konzert: 35 Comedy, rund 30 Lesungen und Shows.
3. „Kirchenmusik“ hat 3 Termine, obwohl 41 Orgelkonzerte unter „Klassik“ liegen.
4. Tschechische Termine werden einsortiert, bevor sie übersetzt sind. 43 Termine landen dadurch falsch.
5. In einer Stichprobe von 300 Terminen stimmte die Rubrik bei 84 %. Feste und „Essen & Trinken“ lagen bei 56 %, „Sonstiges“ bei 24 %.
6. Mehrere Unterpunkte sind leer und führen beim Antippen zu einer leeren Liste.

Wer das Projekt kennt: Web-App ohne Server (`site/`, reines JavaScript ohne Framework, deutsche Texte, Handy zuerst). Ein täglicher Lauf (`src/`, Node 24, `npm run build`) sammelt Termine aus Quellen und schreibt `site/data/events.json`. Jeder Termin hat drei Felder zur Einordnung: `art` (sechs alte Arten, vom Adapter gesetzt, bestimmt heute bei Konzert, Markt, Party und Fest fest die Rubrik), `rubrik` (Kachel) und `genre` (Unterpunkt). Die Regeln stehen in `src/rubriken.js` und `src/normalize.js`, die Namen für die Seite in `site/js/arten.js` (Gleichlauf durch einen Test gesichert).

## Ziele

- Ein Termin steht dort, wo ein Mensch ihn suchen würde. In der Stichprobe (siehe „Abnahme“) stimmen mindestens 92 % der Rubriken, keine Rubrik liegt unter 80 %.
- „Sonstiges“ enthält nur noch, was wirklich nirgends hingehört: am Bestand vom 23.11.2026 höchstens 110 Termine (heute 339).
- Unter Konzerten steht nur Musik.
- Jede Rubrik außer „Sonstiges“ und „Sport & Freizeit“ hat Unterpunkte, und kein sichtbarer Unterpunkt führt ins Leere.

## Nicht-Ziele

- Keine neuen Quellen. Heimspiele, Landesbühnen, Kirchenkalender und alles Weitere aus dem Bericht kommen in einem eigenen Paket.
- Serien werden hier noch nicht zusammengefasst (30 Markttage bleiben 30 Zeilen). Das ist entschieden, aber ein eigenes Paket.
- Keine Erweiterung des Sammelgebiets.
- Kein neues Aussehen der Karten, außer dem kurzen Sprachhinweis (siehe unten).
- Keine Handpflege: keine Liste einzelner Termine oder Künstlernamen, die jemand laufend ergänzen müsste. Regeln arbeiten mit Stichwörtern, mit der Kategorie der Quelle und mit dem Namen der Spielstätte.

## Anti-Ziele

- Ein Termin verschwindet, weil ihn eine neue Regel fälschlich als Ladenöffnung, Schulvorstellung oder Gruppentreffen einstuft. Aussortiert wird nur bei eindeutigen Wörtern im Titel, und jeder Lauf meldet, wie viele Termine aus welchem Grund aussortiert wurden.
- Gespeicherte Filter der Nutzer führen nach dem Umbau zu einer leeren Liste oder einem Fehler.
- Eine ältere, im Handy zwischengespeicherte Fassung der Seite kommt mit den neuen Daten nicht zurecht.

## Rubriken (Kacheln)

Es bleiben die 13 Rubriken in der heutigen Reihenfolge. Neu ist eine 14. Kachel **„Sport & Freizeit“** (Schlüssel `sport`, Name auf der Karte „Sport & Freizeit“), sie steht vor „Sonstiges“. **(Annahme)** Sie bekommt die Farbfamilie von „Sonstiges“ wie die anderen abgeleiteten Rubriken und vorerst keine Unterpunkte; die kommen mit den Heimspielen.

„Kinder & Familie“ bleibt eine eigene Kachel. Ein Kindertheater steht nur dort, nicht zusätzlich unter Theater. „Schauen“ und „Ausstellungen & Museen“ bleiben getrennt.

## Unterpunkte

Die Schlüssel müssen über alle Rubriken hinweg eindeutig sein, weil die Seite die abgewählten Unterpunkte in einer gemeinsamen Liste speichert (`hiddenGenres`). Die Schlüssel unten sind Vorschläge **(Annahme)**, die Namen sind entschieden. Jede Rubrik mit Unterpunkten hat zusätzlich ihren Sammelpunkt „Sonstige …“.

| Rubrik | Unterpunkte |
|---|---|
| Konzerte | Rock & Pop; Metal & Punk; Klassik & Chor; Kirchenmusik; Jazz & Blues; Schlager & Folk; Hip-Hop & Elektro. **Entfallen:** Comedy & Kabarett, Musical |
| Märkte | unverändert: Weihnachtsmarkt; Flohmarkt & Trödel; Handwerk & Kunst; Bauern- & Wochenmarkt |
| Ausstellungen & Museen | unverändert: Kunst & Foto; Museum & Geschichte |
| Schauen | unverändert: Tier- & Zuchtschau; Messe & Hobby |
| Feste | Familie & Kinder; Stadt- & Dorffest; Weihnachten & Lichter; **Brauchtum** (`brauchtum`); Festival. **Entfällt:** Essen & Trinken |
| Partys | unverändert: Disco & Tanz; Club & DJ; Silvester & Ball; Fasching & Karneval |
| Führungen | Stadt & Ort; Untertage & Bergwerk; Brauerei & Bäckerei; Kinderführung; **Museum & Schloss** (`hausfuehrung`); **Sonderfahrt Bahn** (`bahn`) |
| Wandern & Natur | **Geführte Wanderung** (`wanderung`); **Spaziergang & Rundgang** (`spaziergang`); **Tiere & Natur** (`natur`) |
| Kurse & Vorträge | **Vortrag & Reisebericht** (`vortrag`); **Kreativ, Handwerk & Kochen** (`kreativ`); **Bewegung & Entspannung** (`bewegung`); **Computer, Sprache & Beruf** (`lernen`) |
| Theater & Lesungen | **Schauspiel & Oper** (`schauspiel`); **Lesung & Literatur** (`lesung`); **Kabarett & Comedy** (`kabarett`); **Kino & Film** (`kino`); **Show, Zirkus & Musical** (`show`) |
| Essen & Trinken | **Dinner & Menü** (`dinner`); **Brunch** (`brunch`); **Verkostung** (`verkostung`) |
| Kinder & Familie | **Theater, Kino & Musik** (`kinder-buehne`); **Basteln, Backen & Mitmachen** (`kinder-mitmachen`); **Lesen & Lernen** (`kinder-lernen`) |
| Sport & Freizeit, Sonstiges | keine |

Der Betreiber hatte für Theater auch den Unterpunkt „Kinder- & Puppentheater“ angekreuzt. **(Annahme)** Er entfällt, weil er mit seiner Entscheidung „Kindertheater steht nur unter Kinder & Familie“ immer leer bliebe; Kinder- und Puppentheater steht unter Kinder & Familie, Unterpunkt „Theater, Kino & Musik“.

Ein Test stellt sicher, dass kein Unterpunkt-Schlüssel doppelt vorkommt (auch nicht der Sammelpunkt einer Rubrik) und dass `site/js/arten.js` und `src/` dieselben Listen führen.

## Regeln der Einordnung

Grundsatz, der sich ändert: Die Rubrik folgt nicht mehr zwingend der `art`. Ein Termin, den eine Quelle als Konzert liefert, kann unter Theater landen, wenn er Kabarett ist. Die `art` bleibt als Feld erhalten (Farbe alter Daten, Rückfall), entscheidet aber nicht mehr allein.

Rangfolge der Anhaltspunkte **(Annahme)**: zuerst eindeutige Wörter im Titel, dann der Name der Spielstätte, zuletzt der Anfang der Beschreibung.

Die Kategorie der Quelle ist in diesem Paket kein Pflichtteil: Der feste Bestand für die Abnahme enthält sie nicht, die Zielwerte müssen also mit Titel, Spielstätte und Beschreibung erreichbar sein. Für Häuser ohne das Wort „Theater“ im Namen (Haus Zittau, Apollo Görlitz und vergleichbare) gibt es eine kurze Liste von Spielstätten-Stichwörtern in den Regeln; das ist Regelwerk wie die übrigen Stichwörter, keine laufende Handpflege. Wo ein Adapter die Kategorie ohnehin in der Hand hat, darf der Plan sie als Feld `kategorie` durchreichen, das nur im Lauf und in `rohdaten.json` lebt und nicht in `events.json` erscheint.

### Vorrang zwischen den Rubriken **(Annahme)**

Was die Quelle als Art liefert, bleibt der Ausgangspunkt. Umgeleitet wird nur in diesen Fällen:

| Art der Quelle | darf umgeleitet werden nach |
|---|---|
| Konzert | Theater (Kabarett, Lesung, Show, Musical); Kinder & Familie (Kinderkonzert, Mitsingen für Kinder) |
| Markt | Feste, nur bei Lichter- und Adventsfest ohne „Markt“ im Titel. Ein Markt mit „Lichter“ im Namen bleibt Markt |
| Fest | Essen & Trinken (Weinfest, Bierfest, Streetfood, Schlemmerfest); Sport & Freizeit (Turnier, Lauf, Sportfest bleibt Fest) |
| Party | Sport & Freizeit (Tanzturnier, Tanzsport); Kurse (Tanzkurs). Tanzabend und Disco bleiben Party |
| Schau | wie heute: Führung, Ausstellung oder Schau |
| Sonstiges | alle Rubriken, nach der Reihenfolge unten |

Reihenfolge für Termine der Art „Sonstiges“ (die erste passende Rubrik gewinnt): Führungen (mit Sonderfahrt Bahn) → Kinder & Familie → Theater & Lesungen → Kurse & Vorträge → Sport & Freizeit → Wandern & Natur → Essen & Trinken → Feste (Advent, Brauchtum) → Partys → Ausstellungen → Konzerte → Sonstiges.

„Kinder & Familie“ rückt damit vor Theater, Kurse, Essen und Konzerte: Kindertheater, Bastelkurs für Kinder, Kinderbacken und Kinderkonzert stehen unter Kinder & Familie. Ausnahmen bleiben, wo eine Rubrik einen eigenen Kinder-Unterpunkt hat: Eine Kinderführung bleibt eine Führung, ein Kinder- oder Familienfest bleibt ein Fest.

Die Entscheidungen im Einzelnen:

1. **Comedy, Kabarett, Satire, Stand-up** → Theater, Unterpunkt Kabarett & Comedy. Gilt auch, wenn die Quelle „Konzert“ sagt.
2. **Musical, Show, Revue, Zirkus, Travestie, Zauberei** → Theater, Unterpunkt Show, Zirkus & Musical.
3. **Lesung, Buchvorstellung, Autorengespräch, Poetry Slam** → Theater, Unterpunkt Lesung & Literatur. Gilt auch, wenn die Quelle „Konzert“ sagt (heute 30 Termine unter „Sonstige Konzerte“).
4. **Kino & Film:** kein Tagesprogramm. Filmfestivals, Sommerkino, Filmabende mit Gespräch stehen unter Theater, Unterpunkt Kino & Film. In diesem Paket ändert das nur die Einordnung vorhandener Termine.
5. **Kirchenmusik:** Orgel, Vesper, Motette, Kantate, Oratorium, Adventsmusik, Christmette und Christvesper zählen als Kirchenmusik, nicht als Klassik. **(Annahme)** Ein klassisches Konzert in einer Kirche (Spielstätte heißt Kirche, Dom, Kloster, Kapelle) zählt ebenfalls als Kirchenmusik; ein Rock- oder Gospel-Pop-Konzert in einer Kirche bleibt bei seinem Genre.
6. **Lichter- und Adventsfeste** zählen als Fest (Unterpunkt Weihnachten & Lichter), auch wenn es Buden gibt. Als Markt zählt nur, was „Markt“ im Namen trägt.
7. **Brauchtum** (neuer Unterpunkt bei Festen): Hexenfeuer, Walpurgis, Maibaum, Osterfeuer, Osterreiten, Vogelhochzeit, Zampern, Sonnenwende, Kirmes und Kirchweih, Erntedank, Schlachtfest.
8. **Feste ohne „Essen & Trinken“:** **(Annahme)** Weinfest, Bierfest, Streetfood und Schlemmerfest gehen in die Rubrik Essen & Trinken; alle anderen Feste, die bisher über Wörter wie „Apfel“ oder „Kartoffel“ in diesem Unterpunkt landeten, gehen zu Stadt- & Dorffest.
9. **Führung schlägt Essen:** Eine Stadtführung mit Glühwein oder Verkostung ist eine Führung.
10. **Museum & Schloss:** Führungen durch Museum, Schloss, Burg, Kirche, Haus oder Ausstellung (heute 38 Termine unter „Sonstige Führungen“).
11. **Sonderfahrt Bahn:** Sonderzüge, Dampfzugfahrten, Nikolaus- und Glühweinfahrten der Schmalspurbahnen stehen unter Führungen (heute 12 Termine unter „Sonstiges“).
12. **Sport & Freizeit:** Sport zum Zuschauen und Mitmachen, Eislaufen, Läufe, Turniere, Spieleabende, Skat, Bowling, Tanzen als Sport.
13. **Disco & Tanz** hat Vorrang vor Club & DJ, sobald „Disco“, „Tanz“ oder ein Jahrzehnt („80er“) im Titel steht. Ein DJ allein macht noch keinen Club-Abend.
14. **Essen & Trinken wird enger:** Wörter wie „Kaffee“, „Kuchen“, „Bier“ oder „Backen“ reichen nur noch, wenn sie den Termin tragen (Brunch, Menü, Dinner, Verkostung, Weinprobe, Schlachteessen), nicht als Beiwerk eines anderen Termins. Am Bestand schrumpft die Rubrik dadurch von 98 auf etwa 45 Termine.
15. **Aus „Sonstiges“ heraus** (Zahlen vom 23.11.2026, aus der Bestandsprüfung): Theater und Kabarett 79, Advent 29 (zu Festen), Kurse 22, Führungen 22, Konzerte 20, Brauchtum 15, Ausstellungen 9, Sternwarte 9 (zu Kursen, Vortrag), Partys 8, Lesungen 6, Sport und Spiele 53 (neue Kachel). Das sind zusammen rund 270 von 339; der Zielwert „höchstens 110“ lässt Luft für Grenzfälle. 53 der Theatertermine liegen in Häusern ohne das Wort „Theater“ im Namen (Haus Zittau, Apollo Görlitz); dafür gibt es die Spielstätten-Stichwörter.
16. **Das Feld `advent`** wird von der Seite nicht mehr benutzt (der Advent-Schalter ist seit 1.5.1 entfernt), bleibt aber wie heute abgeleitet. Die neuen Regeln dürfen die bestehenden Tests dazu nicht brechen.

### Was aussortiert wird

Diese Termine erscheinen gar nicht mehr. **(Annahme)** Aussortiert wird in einem eigenen, benannten Schritt mit Grund, damit jeder Lauf im Protokoll meldet: „aussortiert: 12 Ladenöffnung, 0 Schulvorstellung, 0 Gruppentreffen“.

- **Ladenöffnung und Werksverkauf** ohne Veranstaltung (heute 12 Termine).
- **Schulvorstellungen:** Titel oder Beschreibung nennen „Schulvorstellung“, „für Schulklassen“, „Klassenzimmerstück“ oder „geschlossene Veranstaltung“. Die Regel „werktags am Vormittag“ kommt erst mit den Theaterquellen dazu.
- **Gruppentreffen:** Selbsthilfe- und Trauergruppen, Bibel- und Gesprächskreise, Seniorennachmittage, Proben. Im heutigen Bestand kaum vorhanden; die Regel wird für die Kirchenkalender gebraucht.

Wochenmärkte werden nicht eigens aussortiert; es gibt nur keine Quelle dafür.

### Reihenfolge im täglichen Lauf

Heute wird einsortiert, bevor tschechische Titel übersetzt sind. Künftig wird nach der Übersetzung (noch einmal) einsortiert. Das Einordnen muss deshalb wiederholbar sein: Ein zweiter Durchgang über schon eingeordnete Termine liefert dasselbe Ergebnis, und ein Hinweis des Adapters (zum Beispiel das Genre von Ticketmaster) geht dabei nicht verloren. Das gilt auch für Termine, die von einer ausgefallenen Quelle übernommen werden.

### Sprachhinweis

Fremdsprachige Termine bleiben im Kalender. Bei Terminen, bei denen die Sprache zählt (Theater & Lesungen, Kurse & Vorträge, Führungen, Kinder & Familie), steht auf der Karte ein kurzer Hinweis „auf Tschechisch“ oder „auf Polnisch“. **(Annahme)** Dafür bekommt der Termin ein neues Feld `sprache` (`cs`, `pl` oder leer) in `events.json`. Es wird so gesetzt: `cs` bei allen Terminen, die der Lauf zur Übersetzung aus dem Tschechischen vorsieht (heute: Land Tschechien), auch wenn die Übersetzung an dem Tag ausfällt; `pl` oder `cs`, wenn der Titel die Sprache nennt („in polnischer Sprache“, „po polsku“, „auf Tschechisch“). Eine polnische Quelle gibt es noch nicht; mit ihr kommt die Regel „Land Polen“ dazu. Bei Konzerten, Märkten, Festen und Ausstellungen zeigt die Karte keinen Hinweis. Ist die Sprache nicht erkennbar, steht nichts da.

## Filterseite

- **Leere Unterpunkte ausblenden.** **(Annahme)** Maßstab sind dieselben Filter, die auch die Zahl auf der Kachel bestimmen (Zeit, Ort, Umkreis, Suche): Ein Unterpunkt ohne Termin unter diesen Filtern wird nicht gezeigt. Ein Unterpunkt, den der Nutzer gerade gewählt hat, bleibt sichtbar, auch wenn er leer wird, damit man ihn wieder abwählen kann. Hat eine Rubrik weniger als zwei Unterpunkte mit Terminen, erscheint die ganze Gruppe nicht.
- **Gespeicherte Filter.** Schlüssel, die es nicht mehr gibt (`comedy`, `musical`, `essen` bei Festen), werden beim Laden stillschweigend verworfen.
- **Ältere Fassung im Handy.** Eine zwischengespeicherte alte Seite zeigt die neue Rubrik `sport` als „Sonstiges“ und unbekannte Unterpunkte als „Sonstige …“. Das ist heute schon so gebaut und muss so bleiben.

## Abnahme

1. **Vorher/Nachher am festen Bestand.** Der veröffentlichte Bestand vom 23.11.2026 liegt unter `.superpowers/bestand-2026-11-23/events.json` (nicht im Git). Ein kleines Prüfskript ordnet ihn mit den neuen Regeln ein und gibt je Rubrik und Unterpunkt die Zahl vorher und nachher aus, dazu die aussortierten Termine mit Grund. Zielwerte: „Sonstiges“ höchstens 110; Kirchenmusik mindestens 40; Kabarett & Comedy mindestens 15; unter Konzerten kein Termin mehr, dessen Titel oder Beschreibungsanfang ein Kabarett-, Comedy- oder Lesungswort enthält; aussortiert höchstens 20 Termine, alle mit erkennbarem Grund.

   **Berichtigung vom 24.11.2026 (nach der Freigabe, beim Schreiben des Bauplans am Bestand nachgezählt):** Ursprünglich standen hier „Sonstige Konzerte höchstens 90“ und „Kabarett & Comedy mindestens 50“. Beide Werte beruhten auf einer Zuordnung über Künstlernamen („Markus Krebs“, „Lisa Eckhart“). Der Alte Schlachthof und die Junge Garde liefern weder eine Kategorie noch ein Stichwort, nur den Namen und einen Programmtitel. Im ganzen Bestand tragen nur 16 Termine ein Kabarett- oder Comedy-Wort in Titel oder Beschreibungsanfang. Eine Liste von Künstlernamen wäre Handpflege und ist ausgeschlossen. „Sonstige Konzerte“ bleibt deshalb voraussichtlich bei 140 bis 160 Terminen (rund 30 gehen zu Theater, Kinder und Klassik, rund 20 echte Konzerte kommen aus „Sonstiges“ dazu); dafür gibt es keinen Zielwert mehr. Abhilfe wäre ein eigenes späteres Paket (Künstler automatisch nachschlagen oder beim Veranstalter nach einer Kategorie fragen).
2. **Stichprobe.** Ein unabhängiger Prüfer (ein frischer Unterauftrag, nicht der Autor der Regeln) bewertet 300 Termine, die das Prüfskript mit festem Startwert zufällig aus dem Bestand zieht: Rubrik richtig bei mindestens 92 %, keine Rubrik unter 80 %, Unterpunkt richtig bei mindestens 85 % der Termine, die einen haben. Die bewertete Stichprobe vom 23.11.2026 liegt nicht mehr vor und wird nicht wiederverwendet.

Die Zahlen in Punkt 1 und 2 sind Ziele, keine Sperren. Werden sie verfehlt, gibt es höchstens zwei Runden Nachbessern an den Regeln; danach geht die Tabelle mit den verfehlten Werten und den Gründen an den Betreiber, statt weiter zu schrauben.
3. **Tests.** Alle bestehenden Tests laufen (heute 517). Jede Entscheidung 1 bis 15 und jede Aussortier-Regel hat mindestens einen Test mit einem echten Titel aus dem Bestand, dazu je ein Gegenbeispiel, das nicht umsortiert werden darf.
4. **Ansehen.** Filterseite am Handy-Format: 14 Kacheln im ersten Bild (wie heute die 13), Unterpunkte erscheinen und verschwinden wie beschrieben.
5. Die Tabelle aus Punkt 1 geht an den Betreiber, bevor irgendetwas veröffentlicht wird.

## Was offen bleibt und der Plan entscheidet

- Die genauen Stichwortlisten und ihre Reihenfolge.
- Welche Adapter eine Kategorie liefern und wie sie durchgereicht wird.
- Ob das Aussortieren im Lauf vor oder nach dem Zusammenführen doppelter Termine geschieht.
- Wie der Hinweis des Adapters getrennt vom errechneten Unterpunkt aufbewahrt wird.

## Rahmen

- Version 1.6.0. Veröffentlicht wird erst nach einem ausdrücklichen OK des Betreibers; bis dahin kein Push und kein `npm run build` (der Lauf greift auf die Quellen zu).
- Die drei offenen Stil-Korrekturen in `site/style.css` (für 1.5.3 gedacht) liegen noch unveröffentlicht im Arbeitsverzeichnis und gehören nicht zu diesem Paket.
- Fremde Werte kommen wie bisher nur über `textContent` und `setAttribute` in die Seite, nie über `innerHTML`.
