# Neue Filterseite: Entwurf

Stand: 23.11.2026. Grundlage ist ein Gespräch mit dem Projektinhaber (einziger Betreiber). Was er entschieden hat, steht ohne Zusatz. Was ich dazu angenommen habe, ist mit **(Annahme)** markiert und kann geändert werden.

## Warum

Die Rückfragen bei den Nutzern (Familie, Freunde, Mitglieder des Schönbacher Heimatvereins, höchstens 35 Personen) haben ergeben, warum die App kaum benutzt wird:

1. Die Leute wollen **zuerst filtern**: „Ich will auf ein Konzert, auf einen Markt, auf eine Schau.“ Heute öffnet die App mit einer langen Terminliste, der Filter steckt hinter einem Knopf.
2. Die Rubrik „Sonstiges“ ist viel zu groß: 898 von 1595 Terminen (56 %). Darin findet niemand etwas.
3. Der Umkreis um Sebnitz passt nicht zu dem, was man tatsächlich sucht (zum Beispiel „was ist in Dresden los“).

Wer das Projekt kennt: Es ist eine Web-App ohne Server (`site/`, reines JavaScript ohne Framework, deutsche Texte, Handy zuerst). Ein täglicher Lauf bei GitHub (`src/`, Node, `npm run build`) sammelt Termine aus Quellen ein und schreibt `site/data/events.json`. Die Seite liegt unter einer Adresse mit geheimem Code auf GitHub Pages.

## Ziele

- Beim Start sieht man die Filterseite und kommt mit zwei, drei Tipps zur passenden Terminliste.
- Jede Rubrik ist so fein, dass keine mehr mehr als etwa 20 % aller Termine enthält.
- Man kann einen Tag oder einen Zeitraum im Kalender wählen.
- Der Umkreis gilt um den gewählten Ort, und Termine ohne Koordinaten verfälschen ihn nicht.

## Nicht-Ziele

- Keine Anmeldung, keine Konten, keine Server-Komponente.
- Keine Standortbestimmung per Handy (GPS). **(Annahme)** Das kann später kommen.
- Keine neuen Quellen und kein neues Aussehen der Termin-Karten und des Einzelfensters.
- Keine Handpflege von Listen (siehe unten, „Ortszuordnung“). Der Betreiber kann das auf Dauer nicht leisten.

## Anti-Ziele

- Die Seite darf nicht langsamer oder umständlicher werden. Wer nur „was ist am Wochenende los“ wissen will, muss mit einem Tipp zur Liste kommen.
- Die Daten der Quellen dürfen nicht verändert oder zusätzlich belastet werden. Mehrere Quellen haben die Nutzung nur unter der Bedingung erlaubt, dass der Kalender privat und klein bleibt.
- Kein Termin darf wegen der neuen Rubriken verschwinden. Jeder Termin gehört genau einer Rubrik an.

## Die Filterseite (Entscheidungen des Betreibers)

**Start.** Beim Öffnen erscheint die Filterseite, nicht die Terminliste. Sie hat von oben nach unten: **Wann**, **Was**, **Wo** und unten einen großen Knopf „N Termine anzeigen“ (N = Zahl der Treffer). Ein Entwurf als Bild liegt in `.superpowers/brainstorm/…/content/filterseite-entwurf-v2.html` (wird nicht eingecheckt, ist aber im Gespräch gezeigt worden): Variante A, Kacheln.

**Wann (oben).**
- Schnellwahlen **Heute, Wochenende, 7 Tage, 30 Tage, Alle** bleiben erhalten.
- Darunter ein **Monatskalender** als Ergänzung, nicht als Ersatz. Ein Tipp auf einen Tag wählt diesen Tag, ein zweiter Tipp auf einen späteren Tag macht daraus einen Zeitraum. Die Schnellwahlen markieren ihren Bereich im Kalender.
- **Bei jedem Start steht „Wochenende“ vorgewählt**, unabhängig davon, was beim letzten Mal gewählt war. Der Zeitraum wird also nicht gespeichert.
- Vergangene Tage sind nicht wählbar. Tage mit Terminen tragen einen Punkt, leere sind blass. Der Kalender zeigt nur Monate, in denen es Termine gibt. **(Annahme)**
- Mehrtägige Termine (heute 101, Märkte und Ausstellungen) zählen an jedem Tag, an dem sie laufen. Die Logik dafür gibt es schon (`lastDay`, `applyFilters` in `site/js/filter.js`).

**Was.**
- Die Rubriken sind große Kacheln mit der **Anzahl der Termine**. Die Anzahl richtet sich nach Wann und Wo (und nach dem gewählten Advent-Schalter). Wählt man einen anderen Tag, ändern sich alle Zahlen sofort. Eine Rubrik ohne Termine ist blass und nicht wählbar. **(Annahme)**
- Mehrere Rubriken lassen sich zugleich wählen. Ist keine gewählt, gilt „alle“. Es gibt keine eigene „Alle“-Kachel. **(Annahme)**
- Wird **genau eine** Rubrik gewählt, erscheinen darunter ihre **Unterfilter** (bei Konzerten die Genres, bei Märkten die Sorten und so weiter), wie heute.
- Ein Schalter **„Nur Advent und Weihnachten“** lässt sich mit jeder Rubrik kombinieren. **(Annahme)** Er ist keine Rubrik, weil Advent quer zu den Rubriken liegt (am Wochenende des 27. bis 29.11. betrifft er 53 von 162 Terminen).

**Wo.** Ein Mittelpunkt (die Orte aus `places.json` mit `auswahl`) und ein Umkreis. Der Umkreis gilt immer um den gewählten Mittelpunkt, nicht um Sebnitz (das ist heute schon so, siehe `applyFilters`). Die Daten reichen aber nur 75 km um Sebnitz, weil `src/build.js` alles Weitere schon beim Einsammeln verwirft. Ein Umkreis um Görlitz ist deshalb nach Westen und Süden abgeschnitten. Das bleibt so und wird auf der Seite nicht erklärt. **(Annahme)** Umkreisstufen **10, 25, 50, 75 km** statt des Schiebers, Standard 75 km. **(Annahme)**

**Merken.** Gemerkt werden (wie heute im Browser, `localStorage`): Rubriken, Unterfilter, Advent-Schalter, Mittelpunkt, Umkreis, Tschechien-Schalter. **Nicht gemerkt** wird der Zeitraum. Suchtext wird weiter nicht gemerkt.

**Suche.** Das Suchfeld bleibt auf der Terminliste (nicht auf der Filterseite). **(Annahme)**

**Filterseite und Liste (bestätigt vom Betreiber, 23.11.2026).**
- Die Filterseite erscheint bei jedem frischen Öffnen der App. Kehrt man aus dem Hintergrund zurück, bleibt die App so, wie man sie verlassen hat.
- Nach „N Termine anzeigen“ zeigt die Liste oben eine **Zusammenfassungszeile** der Auswahl (zum Beispiel „Wochenende · Konzerte · Sebnitz 75 km“) mit dem Knopf **„Filter ändern“**, der zurück zur Filterseite führt. Die Auswahl bleibt dabei erhalten.
- Das bisherige Filterfenster von unten (`baueFilterleiste`) entfällt. Es gibt nur noch eine Filteroberfläche.

## Die neuen Rubriken

Heute gibt es sechs Arten: Konzert, Party, Markt, Fest, Schau, Sonstiges. „Sonstiges“ wird zerlegt. Vorschlag für die Kacheln, in dieser Reihenfolge **(Annahme: Namen und Zuschnitt, Der Betreiber hat die Liste im Entwurf gesehen und nicht beanstandet)**:

| Kachel | Herkunft | grobe Menge heute |
|---|---|---|
| Konzerte | Art konzert (Unterfilter: Genre) | 247 |
| Märkte | Art markt | 108 |
| Ausstellungen & Museen | aus Art schau, Sorten kunst und museum | ca. 230 |
| Schauen | Rest von schau (Tier, Hobby, ohne Sorte) | ca. 70 |
| Feste | Art fest | 22 |
| Partys | Art party | 22 |
| Führungen | aus sonstiges (und aus museum, wo der Titel „Führung“ lautet) | ca. 200 |
| Wandern & Natur | aus sonstiges | ca. 100 |
| Kurse & Vorträge | aus sonstiges | ca. 130 |
| Theater & Lesungen | aus sonstiges | ca. 90 |
| Essen & Trinken | aus sonstiges | ca. 190 |
| Kinder & Familie | aus sonstiges | ca. 100 |
| Sonstiges | Rest (rund 270, zum Beispiel Tanzkurse, Treffs, Zirkus) | ca. 270 |

Die Mengen sind **Stichwortschätzungen** und überschneiden sich teilweise. Kirchenmusik gehört **(Annahme)** als Genre zu Konzerten („Klassik & Chor“ gibt es schon, „Orgelmusik“ ist dort schon über das Wort „orgel“ erfasst).

**Unterkategorien für große Rubriken (Annahme):**
- Konzerte: 163 von 247 haben kein Genre. Die Erkennung (`detectGenre` in `src/normalize.js`) wird verbessert, damit „Sonstige Konzerte“ kleiner wird.
- Ausstellungen & Museen: Kunst und Foto, Museum und Geschichte (wie die heutigen Sorten).
- Führungen: Stadt und Ort, Untertage und Bergwerk, Brauerei und Bäckerei, Kinderführung.
- Märkte: bleiben wie sie sind (Weihnachtsmarkt, Flohmarkt und Trödel, Handwerk und Kunst, Bauern- und Wochenmarkt).

**Wie ein Termin einer Rubrik zugeordnet wird (Annahme):** beim täglichen Lauf über Stichwörter in Titel und Beschreibung, wie es `src/normalize.js` heute schon für Genres und Sorten tut. Jeder Termin gehört genau einer Rubrik. Die Reihenfolge der Regeln entscheidet bei Überschneidungen (zum Beispiel „Kinderführung“: Führung oder Kinder?). Das Ergebnis steht in `events.json`; die Seite rät nichts.

## Ortszuordnung ohne Handarbeit (Entscheidung des Betreibers)

280 von 1595 Terminen haben keine Koordinaten, weil nur der Name der Spielstätte da ist (zum Beispiel „Galerie Budissin“, „Kulturforum Görlitzer Synagoge“). Sie stammen aus Augusto (150), Görlitz (95) und den Geflügelzüchtern (35), alle in Deutschland. Bisher bleiben sie bei jedem Umkreis sichtbar. Neu, vollautomatisch:

1. **Region der Quelle als Grundlage.** Erkennt das Ortsverzeichnis (`src/places.json`, `resolvePlace` in `src/geo.js`) den Namen nicht, bekommt der Termin die Stadtmitte der Region seiner Quelle (Görlitz für die Görlitzer Quelle, Bautzen für Augusto, die Geflügelzüchter nennen den Ort im Titel oder in der Beschreibung). Für Görlitz geht das teilweise schon (`fallbackPlace` in `src/sources/culturebase.js`), für Augusto ist zu prüfen, warum es noch nicht greift.
2. **Automatisch nachschlagen.** Beim täglichen Lauf sucht **Nominatim (OpenStreetMap)** nach „Spielstätte, Region“. Jede Antwort wird in einer **Zwischenspeicher-Datei** (zum Beispiel `site/data/orte-cache.json`) abgelegt und nie ein zweites Mal abgefragt; die Datei wird wie schon `uebersetzungen.json` beim nächsten Lauf von der veröffentlichten Seite geholt (siehe `.github/workflows/daily.yml`). Ein Treffer gilt nur, wenn er höchstens etwa **15 km** von der Region entfernt liegt **(Annahme)**, sonst bleibt es bei Weg 1. Höchstens eine Anfrage pro Sekunde, kenntlicher Programmname (der bestehende `userAgent` in `src/build.js` reicht), und negative Treffer werden ebenfalls gespeichert, damit sie nicht jeden Tag neu gefragt werden.
3. **Rest sichtbar mit Hinweis.** Was danach noch keinen Ort hat, bleibt bei jedem Umkreis sichtbar und trägt auf der Karte den Vermerk „Ort nicht genau bekannt“.

Wegen Nominatim muss im Über-Fenster **„© OpenStreetMap-Mitwirkende (ODbL)“** stehen. Der Betreiber pflegt keine Spielstättenliste von Hand.

## Impressum und Kontakt

Das Repo ist jetzt öffentlich, die Seite weiterhin nur über die geheime Adresse erreichbar (`noindex`, kein Eintrag bei Suchmaschinen, höchstens 35 Nutzer, keine Werbung). Das spricht für ein rein privates Angebot, für das die Impressumspflicht (§ 5 DDG) nicht greift. Das ist keine Rechtsberatung. Vorschlag **(Annahme)**: im Über-Fenster (`site/js/ueber.js`) ein kurzer Abschnitt **„Anbieter und Kontakt“** mit Ort (Schönbach, Sebnitz) und `buehnenlicht@mbuhle.de`, **ohne** Straße und Telefon. **Name (Entscheidung des Betreibers): „Matthias | B“**, wie im Seitenkopf, kein ausgeschriebener Name. Der Grund: Mehrere Quellen haben der Nutzung nur für einen nicht öffentlichen Kalender zugestimmt (zum Beispiel mvp.de, Görlitz, Kulturfabrik). Eine volle Anschrift passt schlecht dazu. Eine eigene Impressum-Seite gibt es nicht.

## Festlegungen nach der Prüfung (alle Annahme, vom Autor getroffen)

- **Advent und Weihnachten:** Beim täglichen Lauf bekommt jeder Termin ein Feld `advent` (wahr oder falsch). Es ist wahr, wenn die Sorte `weihnachtsmarkt` (Märkte) oder `weihnachten` (Feste) gilt oder Titel oder Beschreibung eines der Wörter Advent, Weihnacht, Nikolaus, Stollen, Lichter, Pyramide, Christkind, Winterzauber enthalten. Die Seite rät nichts. Die 53 im Entwurf stammen von einer ähnlichen Stichwortregel auf dem Titel; die Zahl in der App ergibt sich aus der echten Regel.
- **Termine am Regionsmittelpunkt** zählen für den Umkreis wie genau verortete Termine und tragen **keinen** Vermerk. Den Vermerk „Ort nicht genau bekannt“ bekommen nur Termine ganz ohne Ort. Die Geflügelzüchter haben keine Region: Dort wird zuerst der Ort im Titel gesucht (zum Beispiel „Lokalschau Neusalza-Spremberg“, mit `resolvePlace`), sonst kommt der Termin in den Rest mit Vermerk.
- **Annahmeradius beim Nachschlagen:** 15 km um die Region, bei Augusto 30 km, weil Augusto einen ganzen Landkreis abdeckt. Der Radius ist je Quelle in `sources.json` einstellbar.
- **Wochenende** heißt wie heute Freitag bis Sonntag, am Wochenende selbst der Rest davon (`zeitfenster` in `site/js/filter.js`). Die Punkte im Kalender und die Zahlen auf den Kacheln beziehen sich auf die jeweils aktuelle Wahl von **Was** und **Wo**.
- **Rubrik ohne Termine:** blass, aber weiter antippbar, damit eine gespeicherte Auswahl sich wieder abwählen lässt. Sie liefert dann eine leere Liste.

## Bereits geklärt, nicht Teil dieser Arbeit

- GitHub Pages ist aktiv und die Seite veröffentlicht (Lauf vom 23.11.2026 erfolgreich).
- Die Antworten der Quellen (Kamenz, Görlitz, Dresden Marketing) sind in `docs/anfragen/README.md` festgehalten. Die neue Schnittstelle von Dresden Marketing (`veranstaltungen-api.dresden.de`) wartet auf den Veranstalteraccount des Betreibers und ist eine eigene Aufgabe.

## Was dem Bauenden überlassen bleibt

- Die genauen Stichwortregeln je Rubrik und Unterfilter, die Reihenfolge bei Überschneidungen und das Nachprüfen an den echten Daten (`site/data/events.json`).
- Das Datenmodell: neue Werte im Feld `art` oder ein eigenes Feld für die Rubrik. Bereits gespeicherte Einstellungen im Browser (`hiddenArt`, `hiddenGenres`) müssen weiter lesbar bleiben oder sauber zurückgesetzt werden (`loadPrefs` ist heute tolerant gegen Unbekanntes).
- Farben der neuen Rubriken (heute eine Farbe je Art, `--art-*` in `site/style.css`) und die Gestaltung der Kacheln, passend zum bestehenden Aussehen (Nachtblau und Bernstein, hell und dunkel).
- Barrierefreiheit des Kalenders (Tastatur, Beschriftung) und das Verhalten der Zurück-Taste (die Fenster nutzen den Verlauf des Geräts, siehe `neuesFenster` in `site/js/app.js`).
- Die bestehenden 351 Tests laufen weiter (`npm test`) und werden dort angepasst, wo sich das gewollte Verhalten ändert. Neue Logik bekommt Tests. Der Dienst-Worker (`site/sw.js`) und die Versionsangabe müssen die geänderten Dateien ausliefern.
- Die Reihenfolge der Arbeit, zum Beispiel erst Rubriken und Ortszuordnung (Daten), dann Filterseite (Anzeige).
