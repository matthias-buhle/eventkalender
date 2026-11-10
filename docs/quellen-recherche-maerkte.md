# Ersatzquellen für Flohmärkte, Handwerksmärkte und Weihnachtsmärkte

Stand der Recherche: **10.11.2026** (alle Abrufe an diesem Tag). Nur recherchiert: nichts gebaut, keine Mails gesendet, `sources.json` unverändert.
Das ist **keine Rechtsauskunft**; die Regeln der Betreiber sind auf Stichwörter (Vervielfältigung, Zustimmung, Data-Mining, Lizenz) gelesen, nicht juristisch geprüft.

Auslöser: Die Kampagne Spezial GmbH (meine-flohmarkt-termine.de, meine-kunsthandwerker-termine.de, krencky24.de) hat die Übernahme verweigert, die Quelle `maerkte` ist entfernt. Diese drei Domains wurden bei der Recherche **nicht geöffnet**.
Auf keiner der geprüften Ersatzseiten fand sich ein Hinweis, dass sie dort abschreibt (Stichprobe per Textsuche in den geladenen Seiten). Beweisen lässt sich das nicht; bei Aggregatoren bleibt es offen (siehe Einschätzung „besser nicht“).

## 1. Kurzfazit

Es gibt **keine einzelne Quelle**, die alles ersetzt. Weihnachtsmärkte lassen sich über zwei Zugänge fast vollständig zurückholen, Flohmärkte nur für Dresden und (ein wenig) Bautzen, bei Handwerksmärkten gibt es **keine** Feed-Quelle.
Alle empfohlenen Quellen brauchen nach der Projektregel (Impressum verlangt Zustimmung) eine **Anfrage**. Einzige Ausnahme sind Seiten ohne erkennbare Regel (dazu unten); auch dort ist eine kurze Info-Mail höflich.

### Empfohlene Reihenfolge (zuerst anfragen und bauen)

1. **sachsen-tourismus.de (TMGS, landesweite SaTourN-Event-Sitemap)** – größter Hebel, kleiner Aufwand.
   Dieselbe Plattform wie `saechsische-schweiz.de`, die der Adapter `satourn` schon liest (Sitemap + Event-JSON-LD je Seite). 231 Event-URLs; darin u. a. Dresdner Striezelmarkt, Augustusmarkt, Schloss, Neumarkt, Stallhof, Meißner Weihnacht, Radebeul-Altkötzschenbroda, Freital, Moritzburg, Wenzelsmarkt Bautzen, Großenhain, **Schlesischer Christkindelmarkt Görlitz** (steht *nicht* in der Görlitz-API), Weihnachtsmarkt Zittau, Altenberg/Geising.
   Die Lizenz steht je Event im JSON-LD (CC BY 4.0 bei den Dresden-Marketing-Events, CC0 beim Christkindelmarkt; bei Striezelmarkt und Wenzelsmarkt fehlt sie). Das Impressum verlangt dennoch schriftliche Zustimmung → **Anfrage nötig**, aber aussichtsreich: `info@sachsen-tour.de`, dazu für die Dresdner Daten `info@marketing.dresden.de`.
2. **flohmarkt-sachsen.de (DDV Sachsen / Sächsische Zeitung)** – die großen Dresdner Trödelmärkte vom Veranstalter selbst (Elbeflohmarkt Albertbrücke, Neustädter Markthalle, Galopprennbahn Seidnitz, Elbepark, Kaufpark Nickern, Haus der Presse).
   Sammel-iCal `https://flohmarkt-sachsen.de/markttermine/ical/` (50 Termine 14.11.2026–24.04.2027, selbst geprüft). Impressum: Zustimmung nötig → **Anfrage** an `info@flohmarkt-sachsen.de`. Aufwand klein.
3. **dresden.de „Weitere Weihnachtsmärkte“** (Landeshauptstadt / Dresden Information GmbH) – zehn Dresdner Märkte mit Datum 2026, darunter die in SaTourN fehlenden (Winterlichter, Finn Village, Hüttenzauber, Frauenkirche, Elbhangfest). Reines HTML, ein Abruf pro Tag (robots: Crawl-delay 5). Impressum: Vervielfältigung nur privat → **Anfrage** an `info@dresden.info`. Aufwand klein. Alternative/Gegenprüfung: weihnachtsmarktkarte-dresden.de (TU Dresden, neun Märkte als JSON, Lizenz offen).
4. **oberlausitzer-troedelmarkt.de** (Michael Schattling, Bautzen) – einzige belegte Trödelquelle der Oberlausitz (Bautzen, Königswartha, Wilthen). Kleiner Privatveranstalter, keine Regel gefunden, keine robots.txt → **Anfrage sinnvoll** an `kontakt@oberlausitzer-troedelmarkt.de`. Haken: Termine nur bis 17.10.2026 gelistet, Freitext ohne Struktur.
5. **Handgepflegte Liste „Jahresmärkte“** (Handwerks-/Töpfer-/Kunsthandwerkermärkte, ca. 10–15 Einträge: Meißner Töpfermarkt, Kunsthandwerkermarkt Neschwitz, Erlichthof Rietschen, Schlesischer Tippelmarkt Görlitz …), einmal pro Jahr aktualisiert, nur Fakten und Link zum Veranstalter. Hier gibt es keine Feed-Quelle; dafür fällt auch keine Zustimmungsfrage für ein Scraping an. Ob reine Faktenangaben ohne Anfrage übernommen werden, ist **Entscheidung des Betreibers** (kurze Info-Mail an die Veranstalter wäre höflich).

**Danach (optional):** `oberlausitz.com`-JSON-Feed (ca. 50 Weihnachtsmärkte der Oberlausitz, Anfrage `info@oberlausitz.com`), Meißner Weihnacht über den Veranstalter (`meissner-weihnacht.de`, Event-JSON-LD, robots offen), Altenberg/Osterzgebirge, Großenhain (Event-JSON-LD), regioactive.de als Notnagel.

**Zeitdruck:** Die Dresdner und Bautzener Märkte beginnen am 25./27.11.2026. Antworten per Mail dauern; bis dahin deckt die bereits laufende SaTourN-Quelle (Sächsische Schweiz, u. a. Canalettomarkt Pirna, Königstein) einen Teil ab.

**Nicht empfohlen:** rausgegangen.de, eventfinder.de, ortsdienst.de, meinestadt.de, festivalsindeutschland.de, freizeitmonster.de, tradefairdates.com (Bot-Sperren, strenge AGB oder Herkunft der Termine unklar), die Dresdner Veranstaltungs-API (robots sperrt alles), der Hoyerswerdaer Kreevo-Zugang (fremder Schlüssel), stadt-meissen.de (robots sperrt alle Roboter).

## 2. Was fehlt, was die Empfehlung abdeckt

| Lücke | Abdeckung durch | Rest-Lücke |
|---|---|---|
| Dresden: Augustusmarkt, Stallhof, Schloss, Neumarkt, Striezelmarkt | 1 (sachsen-tourismus.de) und 3 (dresden.de) | – |
| Dresden: Winterlichter, Finn Village, Hüttenzauber, Frauenkirche, Elbhangfest | 3 (dresden.de) oder weihnachtsmarktkarte-dresden.de; in SaTourN laut Teilbericht nicht enthalten | – |
| Meißen, Radebeul, Freital, Moritzburg, Großenhain | 1; Meißen zusätzlich über meissner-weihnacht.de | Radeberg, Löbau (nur Stadtseiten, siehe 4.14) |
| Pirna Canalettomarkt | schon da (saechsische-schweiz.de, aber Beginn 30.11. statt amtlich 24.11.) | Datumsabweichung beachten |
| Bautzen Wenzelsmarkt, Görlitz Christkindelmarkt, Zittau | 1 | Wenzelsmarkt und Striezelmarkt ohne Lizenzangabe im JSON-LD |
| Flohmärkte Dresden | 2 | – |
| Flohmärkte Oberlausitz | 4 (Bautzen/Königswartha/Wilthen) | Görlitz, Zittau, Pirna, Großenhain, Kamenz, Hoyerswerda, Freital, Heidenau, Riesa, Bad Muskau: keine eigene Quelle gefunden |
| Handwerks-/Kunsthandwerkermärkte | 5 (handgepflegt) | keine Feed-Quelle |
| Hoyerswerda Teschenmarkt, Kamenz, Heidenau, Dippoldiswalde, Neustadt/Sa. (Weihnachtsmarkt) | – | nicht belegt |

## 3. Übersicht aller geprüften Kandidaten

Einschätzung: **frei** = ohne Anfrage nutzbar, **Anfrage** = nach Projektregel vorher fragen, **nein** = besser nicht. Aufwand: klein / mittel / groß.

| Nr | Quelle | Märkte-Umfang | Format | Regeln | Einschätzung | Aufwand |
|---|---|---|---|---|---|---|
| 1 | sachsen-tourismus.de (TMGS, SaTourN landesweit) | 231 Events, ca. 105 mit Weihnachts-/Marktbezug, ca. 30 im Radius; kaum Flohmärkte/Handwerk | Event-Sitemap + Event-JSON-LD je Termin | robots frei; Impressum: Zustimmung für Vervielfältigung; Lizenz je Event CC0/CC BY 4.0/CC BY-SA, teils leer | **Anfrage** (aussichtsreich) | klein |
| 2 | flohmarkt-sachsen.de (DDV Sachsen/SZ) | Dresden + Umland, 50 Termine im Sammel-iCal bis 04/2027, ca. 130 bis 11/2027 laut Sitemap | iCal (Sammel + je Termin), HTML | robots frei; Impressum: schriftliche Zustimmung, TDM-Vorbehalt | **Anfrage** | klein |
| 3 | dresden.de Weitere Weihnachtsmärkte | 10 Dresdner Märkte 2026 | HTML, kein Event-JSON-LD | robots Crawl-delay 5; Impressum: Vervielfältigung nur privat | **Anfrage** | klein |
| 4 | weihnachtsmarktkarte-dresden.de (TU Dresden) | 9 Dresdner Märkte 2026/27 mit Öffnungszeiten | JSON in `__NEXT_DATA__` | keine Lizenz, keine robots.txt, Beta-Projekt | **Anfrage** (Alternative zu 3) | klein |
| 5 | striezelmarkt.dresden.de | Striezelmarkt 25.11.–24.12. mit Thementagen | HTML | robots nur `/cron/` gesperrt; Regeln wie dresden.de | **Anfrage** (mit 3) | klein |
| 6 | visit-dresden-elbland.de/de/weihnachten | ca. 20 Märkte Dresden/Elbland (Freital, Radebeul, Radeburg, Weinböhla, Coswig, Moritzburg, Zabeltitz, Torgau) | HTML, Datum als Freitext | robots offen (Content-Signal erlaubt); Impressum: Zustimmung für Wiederverwendung | **Anfrage** | klein–mittel |
| 7 | veranstaltungen.dresden.de + veranstaltungen-api.dresden.de | größte Dresdner Eventdatenbank | JS-App + API | API-robots: alles gesperrt | **nein** (nur über Anfrage; ist vermutlich der angefragte Stadtkalender) | groß/offen |
| 8 | oberlausitzer-troedelmarkt.de | Bautzen, Königswartha, Wilthen; Termine nur bis 17.10.2026 | HTML-Aufzählung | keine Klausel, keine robots.txt | **Anfrage** (sinnvoll, klein) | klein |
| 9 | regioactive.de | Märkte in Dresden, Bautzen, Löbau, Zittau u. a. (Dresden überschneidet sich mit 2) | Event-JSON-LD je Termin | Impressum: Kopieren auch privat nur schriftlich gestattet | **Anfrage** (zweite Wahl) | mittel |
| 10 | oberlausitz.com Events-Feed | 137 Events, ca. 50 Weihnachtsmärkte, kaum Flohmarkt/Handwerk | JSON (`olevents.php`) | Impressum: Zustimmung der Marketing-Gesellschaft; keine robots.txt | **Anfrage** | klein |
| 11 | meissner-weihnacht.de / gewerbeverein-meissen.de | Meißner Weihnacht 23.11.–24.12., Wintermarkt bis 01.01. | HTML + Event-JSON-LD (Offset +00:00 falsch) | robots offen; keine Klausel gefunden | **frei** (Info-Mail an Verein höflich) | klein–mittel |
| 12 | stadt-meissen.de | Veranstaltungskalender | HTML | robots: `Disallow: /` für alle außer wenigen Suchmaschinen (selbst geprüft) | **nein** | – |
| 13 | wenzelsmarkt-bautzen.de, bautzen.de | Wenzelsmarkt 27.11.–22.12. mit Tagesprogramm | HTML, Monats-PDF | robots offen; bautzen.de-Impressum: Vervielfältigung nicht gestattet | **Anfrage** (Stadt) | klein |
| 14 | schlesischer-christkindelmarkt-goerlitz.de | Christkindelmarkt 04.–20.12., Brückenadvent, Eislaufbahn | HTML | Crawl-delay 5; Impressum: Kopien nur privat, nicht kommerziell | **Anfrage** (oder über 1) | klein |
| 15 | grossenhain.de Veranstaltungskalender | Weihnachtsmarkt 27.11.–20.12. | HTML + Event-JSON-LD | robots offen; Impressum nur zu Grafiken | **frei** für Termindaten (Mail empfohlen), über 1 ohnehin abgedeckt | klein |
| 16 | altenberg.de (Outdooractive) | ca. 8 Märkte Osterzgebirge | HTML + Event-JSON-LD | robots sperrt `/api/*`; AGB ungelesen | **Anfrage** | mittel |
| 17 | visitsaxony.com (TMGS) | 137 Events, wenige Märkte, teils veraltete Texte | Event-JSON-LD | wie 1 | **Anfrage** (in Mail 1 mitnehmen) | mittel |
| 18 | Stadtseiten Radebeul, Radeberg, Löbau, Zittau, Freital, Pirna | je 1–2 Weihnachtsmärkte mit Datum | HTML | Radeberg/Löbau: Zustimmung nötig; Radebeul: robots sperrt URLs mit `?` | **Anfrage** oder handgepflegt | klein je Stadt |
| 19 | festivalsindeutschland.de | Sachsen 386 Einträge (Töpfermärkte, Kunsthandwerk, Weihnachtsmärkte), 2027 kaum | Event-JSON-LD | AGB: Vervielfältigung untersagt; Kontakt nur Formular | **nein** | mittel |
| 20 | DZT Knowledge Graph (open-data-germany.org) | Veranstaltungen bundesweit, Sachsen via SaTourN | REST/JSON, API-Key per Mail | Lizenz je Objekt; Limits 10/s, 10 000/Tag | **Anfrage** (Plan B) | mittel |
| 21 | Dresden Open Data, GovData, Sachsen-Register | nur Marktstandorte, keine Termine | OGC API / GWT | Dresden dl-de/by-2-0; GovData und Register sperren Crawler | **frei**, aber ohne Nutzen | groß für wenig |
| 22 | rausgegangen.de, eventfinder.de, ortsdienst.de, meinestadt.de, SZ-Kalender, dawo-dresden.de, freizeitmonster.de, tradefairdates.com | gemischt | HTML | Bot-Sperren, Content-Signal gegen KI-Training, strenge AGB oder Fließtext | **nein** | – |
| 23 | kreativmaerkte.de, markt-wert.net | je ein Termin im oder am Rand des Radius | HTML | robots sperrt `/feed/` und `?`-URLs (kreativmaerkte) | kein Mehrwert | – |
| 24 | dvk-lausitz.de / Hoyerswerda (Kreevo) | Kalender der Stadt Hoyerswerda | JSON mit fremdem Schlüssel | kein öffentlicher Zugang | **nein** | – |

## 4. Belege je Kandidat

Alle Angaben: geprüft am 10.11.2026. „Selbst geprüft“ heißt: von mir nach dem Teilbericht erneut abgerufen.

### 4.1 sachsen-tourismus.de (TMGS, landesweite SaTourN-Instanz)

- **Was:** Sitemap-Index `https://www.sachsen-tourismus.de/sitemap.xml` enthält die Teil-Sitemap `?sitemap=ndsdestinationdataevent&type=1533906435&cHash=…` mit **231** Event-URLs (selbst gezählt), Detailseiten `https://www.sachsen-tourismus.de/event/<slug>`. Gleiche Struktur wie die schon genutzte Sitemap von saechsische-schweiz.de (274 Event-URLs laut Teilbericht). Die Teilrecherche zählte ca. 105 Slugs mit Weihnachts-/Advent-/Markt-Bezug.
  Selbst bestätigt: Slugs `dresdner-striezelmarkt`, `wenzelsmarkt-bautzen`, `schlesischer-christkindelmarkt-zu-goerlitz`, `weihnachtsmarkt-zittau` und `augustusmarkt-dresden` sind vorhanden. Laut Teilbericht außerdem Schloss, Neumarkt, Stallhof, Christmas Garden Pillnitz, Meißner Weihnacht, Altkötzschenbroda, Freital, Moritzburg, Großenhain, Königstein, Altenberg/Geising/Lauenstein, Hoyerswerda-Teschenmarkt, Oybin.
  **Nicht enthalten** (Teilbericht): Winterlichter, Finn Village, Hüttenzauber, Elbhangfest-Weihnachtsmarkt; Pirnaer Canalettomarkt steht nur bei saechsische-schweiz.de. Flohmärkte/Handwerk praktisch nicht vertreten.
- **Format:** je Einzeltermin ein `Event`-Block im JSON-LD (Name, `startDate`/`endDate` mit +01:00, Ort mit Geo, `author`, `license`). Selbst geprüft: Augustusmarkt 30 Termine, Lizenz CC BY 4.0; Christkindelmarkt Görlitz 20 Termine ab 04.12.2026, Lizenz CC0; Zittau ein Termin 05.12., CC BY 4.0; Striezelmarkt und Wenzelsmarkt Termine ja, Lizenzfeld nicht gefunden. Mehrtägige Märkte kommen als viele Einzeltermine, anscheinend bei ca. 30 gekappt (nicht abschließend geprüft). Beschreibungstexte nennen teils noch 2025, strukturierte Daten sind 2026: nur Felder, nicht Fließtext auswerten.
- **Regeln:** `robots.txt` sperrt nur `/fileadmin`, `/uploads`, Formulare (selbst geprüft). Impressum (selbst geprüft): Inhalt und Struktur seien urheberrechtlich geschützt, die Vervielfältigung von Informationen oder Daten, insbesondere von Texten, Textteilen und Bildmaterial, bedürfe der vorherigen schriftlichen Zustimmung der TMGS. Keine Passage zu automatisiertem Abruf gefunden. Im Widerspruch dazu steht die maschinenlesbare Lizenz je Event. Bei CC BY: Namensnennung („Dresden Marketing GmbH“, Link zur Lizenz); bei CC BY-SA: Namensnennung und Weitergabe unter gleicher Lizenz.
- **Einschätzung:** Anfrage (Projektregel); Mail sollte um Bestätigung bitten, dass die JSON-LD-Lizenz je Event gilt, und fragen, wie Events ohne Lizenzfeld zu behandeln sind (Striezelmarkt, Wenzelsmarkt).
- **Aufwand:** klein. Der Adapter `satourn` braucht eine zweite Sitemap-Konfiguration plus Filter auf Markt-Slugs und Geo-Radius (nur ca. 30–60 Detailseiten statt 231), Namensnennung je Event mitführen. Ob die vorhandene Obergrenze `maxDetailPages: 150` in der Adventszeit Märkte abschneidet, ist ungeprüft.
- **Mail:** `info@sachsen-tour.de` (Impressum, selbst geprüft; Plattformbetreiber neusta destination.one GmbH: `info@neusta-ds.de`). Für die Dresdner Daten zusätzlich `info@marketing.dresden.de` (Dresden Marketing GmbH, laut Teilbericht aus dem JSON-LD und https://www.visit-dresden-elbland.de/de/weihnachten/ ; nicht erneut geprüft).
- **Belege:** https://www.sachsen-tourismus.de/sitemap.xml , https://www.sachsen-tourismus.de/robots.txt , https://www.sachsen-tourismus.de/impressum , https://www.sachsen-tourismus.de/event/augustusmarkt-dresden , …/event/dresdner-striezelmarkt , …/event/schlesischer-christkindelmarkt-zu-goerlitz , …/event/weihnachtsmarkt-zittau , …/event/wenzelsmarkt-bautzen .

### 4.2 flohmarkt-sachsen.de (DDV Sachsen GmbH, Sächsische Zeitung)

- **Was:** Elbeflohmarkt Albertbrücke, Trödelmarkt Neustädter Markthalle, Riesentrödelmarkt Galopprennbahn Seidnitz, Elbepark, Nickerner Trödelmarkt (Kaufpark), Haus der Presse, Waldtrödelmarkt Hofewiese, Radeberg (Innenstadt-Trödelmarkt), Glashütte, Schloss Proschwitz; ein Kreativmarkt (Japanfestival). Ortsbezug Dresden/Umland, nichts für Oberlausitz oder Sächsische Schweiz. Der Veranstalter ist die Betreiberin selbst; elbeflohmarkt-dresden.de leitet auf die Seite weiter.
- **Format:**
  - **Sammel-iCal** `https://flohmarkt-sachsen.de/markttermine/ical/`: selbst geprüft, HTTP 200, `text/calendar`, **50 VEVENT** (14.11.2026–24.04.2027), PRODID wp-events-plugin. Mit Zeitzone Europe/Berlin, `URL`, `SUMMARY`, `LOCATION`; Texte HTML-kodiert (`&uuml;`), vor Verwendung dekodieren.
  - **Achtung, ein Teilbericht irrte:** `/termine/?ical=1` ist dagegen auf alte Termine gedeckelt und unbrauchbar. Brauchbar ist `/markttermine/ical/`. Dass der Sammelfeed bei 50 Einträgen endet, deutet auf eine Kappung hin; die Event-Sitemap (`/wp-sitemap-posts-event-1.xml`, lastmod 2026-11-06) zeigt ca. 130 datierte Termine bis 27.11.2027 (Slug-Auswertung, nicht jede Seite geprüft). Für den Tageslauf genügen die nächsten fünf Monate.
  - Einzel-iCal je Termin: `…/markttermine/<slug>/ical/`. Kein JSON-LD. WordPress-REST antwortet 401 (nicht verwendet).
- **Regeln:** robots sperrt nur `/wp-admin/`. Impressum (selbst geprüft): Inhalte dürften grundsätzlich nur mit vorheriger schriftlicher Zustimmung vervielfältigt oder verbreitet werden, kommerzielle Weitervermarktung sei untersagt; zusätzlich TDM-Vorbehalt (§ 44b UrhG) für kommerzielles Data-Mining. Keine Lizenz am Feed. Der Feed wird öffentlich angeboten („ICS herunterladen“).
- **Einschätzung:** Anfrage (hohe Priorität, gute Chancen: privat, nichtkommerziell, Besucher werben).
- **Aufwand:** klein (iCal-Parser, Entities dekodieren, Art = Trödelmarkt).
- **Mail:** `info@flohmarkt-sachsen.de` (selbst geprüft); Lizenzfragen laufen über `sz.archiv@ddv-mediengruppe.de`. In der Mail auch fragen, ob der Sammelfeed absichtlich auf 50 Einträge begrenzt ist.
- **Belege:** https://flohmarkt-sachsen.de/impressum/ , https://flohmarkt-sachsen.de/markttermine/ical/ , https://flohmarkt-sachsen.de/robots.txt .

### 4.3 dresden.de „Weitere Weihnachtsmärkte“ und Striezelmarkt-Seite

- **Was:** https://www.dresden.de/de/tourismus/sehen/weihnachtszeit/weitere-weihnachtsmaerkte.php (Seitenstand 05.10.2026): zehn Märkte mit Ort und Datum 2026: Striezelmarkt 25.11.–24.12., Winterlichter Prager Straße 25.11.–23.12., Frauenkirche, Neumarkt, Stallhof (25.11.–23.12., Rauhnächte 27.–30.12. und 02.–06.01.), Schloss 27.11.–24.12., Finn Village 26.11.–22.12., Hüttenzauber 13.11.–02.01.2027, Augustusmarkt 25.11.–03.01.2027, Elbhangfest-Weihnachtsmarkt 05.–20.12. (Stichprobe selbst bestätigt: Datumszeilen für Winterlichter, Stallhof, Augustusmarkt, Hüttenzauber). Datum steht als Fließtext („25. November bis 24. Dezember 2026“), ohne Uhrzeit. Nur `BreadcrumbList`/`WebPage` im JSON-LD, kein iCal, kein Event-RSS.
- **Regeln:** robots: Crawl-delay 5, nur `/cron/`, `/apps/wicket/`, Login gesperrt. Impressum Tourismus (https://www.dresden.de/de/tourismus/information/information/impressum-und-agb.php): Texte, Bilder, PDFs urheberrechtlich geschützt, Vervielfältigung nur zum privaten Gebrauch, keine Weitergabe oder öffentliche Wiedergabe. Nichts zu automatisiertem Abruf. Der private Kreis passt zum „Privatgebrauch“, die Weitergabe an ca. 35 Personen und die Verarbeitung per Skript sind aber nicht ausdrücklich gedeckt.
- **Einschätzung:** Anfrage empfohlen. **Aufwand:** klein (ein Abruf pro Tag, ≥ 5 s Abstand).
- **Mail:** `info@dresden.info` (Dresden Information GmbH, selbst geprüft im Impressum); allgemein `stadtverwaltung@dresden.de`.
- **Striezelmarkt-Seite** https://striezelmarkt.dresden.de/de/ (Stand 09.11.2026): 592. Striezelmarkt 25.11.–24.12. mit Öffnungszeiten und Thementagen (28.11. bis 20.12.); robots sperrt nur `/cron/`; kein Feed. Regeln vermutlich wie dresden.de. Hinweis: `striezelmarkt-dresden.de` (mit Bindestrich) und `dresden-elbland.de` haben eine Anubis-Bot-Schranke; **nicht umgangen**, nicht gelesen.

### 4.4 weihnachtsmarktkarte-dresden.de (TU Dresden)

- **Was:** Selbst geprüft: neun Märkte 2026/27 im `__NEXT_DATA__` der Startseite (`props.pageProps.markets`): Striezelmarkt, Schloss, Augustusmarkt, Elbhangfest, Winterlichter, Neumarkt, Stallhof (bis 06.01.2027), Finn Village, Hüttenzauber. Felder `von`/`bis` (dd.mm.yyyy), Öffnungszeiten je Wochentag, Ausnahmen, Koordinaten, Webseite. Daten fest in die Seite gebaut; Projekt laut Teilbericht in Beta.
- **Regeln:** keine robots.txt (404), keine Lizenz, Impressum (Hans-Albrecht Schumann, TU Dresden, Professur Wirtschaftsinformatik) ohne Verbot der Weiterverwendung. Kooperation mit Open Data Dresden; ob dl-de/by-2-0 gilt, ist **nicht belegt**.
- **Einschätzung:** Anfrage empfohlen (Lizenz, Datenherkunft, stabiler Endpunkt); wegen Beta-Status und fehlendem Frauenkirchen-Markt nur zweite Wahl neben 4.3. **Aufwand:** klein. **Mail:** `isih@mailbox.tu-dresden.de` (Teilbericht, Impressum https://weihnachtsmarktkarte-dresden.de/impressum ; nicht erneut geprüft).

### 4.5 visit-dresden-elbland.de und veranstaltungen.dresden.de (Dresden Marketing GmbH)

- **visit-dresden-elbland.de/de/weihnachten/:** ca. 20 Märkte aus Dresden und Umland als HTML-Text mit Freitext-Datum („5. bis 6., 11. bis 13. und 19. bis 20. Dezember 2026“): Coswig, Weinböhla, Freital Schlossadvent (28./29.11. und 5./6.12.), Moritzburg, Radeburg, Manufakturzauber Schloss Wackerbarth, Nünchritz, Zabeltitz (13.12.), Torgau, Riesa, Strehla. Keine Event-Sitemap, JSON-LD nur Organisation. robots offen mit Content-Signal (Suche, KI-Input, KI-Training erlaubt); Impressum: Verwendung der Texte in anderen Publikationen nur mit Zustimmung. Anfrage empfohlen an `info@marketing.dresden.de` (Impressum). Aufwand klein–mittel (Datum parsen).
- **veranstaltungen.dresden.de** (React-App) und **veranstaltungen-api.dresden.de**: robots der API: `Disallow` für alle. Im Seitenquelltext steht ein API-Schlüssel für die Browser-App; er wurde **nicht benutzt**. Märkte sind laut Seitenbeschreibung eine Rubrik. Vermutlich der bereits angefragte Dresdner Stadtkalender (nicht bestätigt). **Nein** ohne Freigabe; wenn die Stadtkalender-Anfrage positiv ausgeht, wäre das die technisch beste Dresden-Quelle. Eine Mail an Dresden Marketing könnte beides bündeln (SaTourN-Dresden-Daten und Export/Feed).

### 4.6 oberlausitzer-troedelmarkt.de (Michael Schattling, Bautzen)

- **Was:** Trödelmärkte Bautzen (Wilthener Straße, laut Regioactive-Eintrag erster Samstag im Monat), Königswartha (Gutsplatz), Wilthen. Startseite listet Termine als Aufzählung, **zuletzt 17.10.2026**, keine für 2027. Statisches HTML, Freitext „dd.mm.yyyy – Titel, Ort“.
- **Regeln:** Kein Impressumstext, nur Kontaktblock und Datenschutz; keine Nutzungsklausel; keine robots.txt (404). Kleiner Privatveranstalter, die Termine bewerben seine Märkte.
- **Einschätzung:** Anfrage sinnvoll. **Aufwand:** klein, aber Freitext-Parser. Alternative für dieselben Termine: regioactive (4.7).
- **Mail:** `kontakt@oberlausitzer-troedelmarkt.de` (sichtbarer Kontaktblock, HTML-Entities selbst dekodiert); die Seitenmetadaten nennen zusätzlich `info@oberlausitzer-troedelmarkt.de`. Vor dem Senden eine der beiden prüfen.
- **Beleg:** https://www.oberlausitzer-troedelmarkt.de/ .

### 4.7 regioactive.de (Leitmotiv Online Medien GmbH & Co. KG, Mannheim)

Rubrik „Markt“ im allgemeinen Eventkalender: Elbeflohmarkt, Markthalle, Galopprennbahn (also Doppelung zu 4.2), dazu Oberlausitzer Antik- & Trödelmarkt Bautzen, Trödelmarkt Königswartha, Löbauer Tagesflohmarkt, **Lausitz-Markt für Handgemachtes** (Löbau, Messepark, 15.11.2026, ca. 100 Aussteller), Advents-Trödelmarkt Volkshaus Zittau (28.11.), Trödelmarkt Bad Gottleuba-Berggießhübel. Event-JSON-LD auf Detailseiten und `ItemList` je Tagesseite; keine Rubrikseite für Märkte, vergangene Termine liefern 410, Dresden zeigt nur wenige Märkte pro Tag. robots sperrt nur `/api/`. Impressum: Kopieren und Herunterladen auch privat nur mit schriftlicher Gestattung. **Anfrage** (zweite Wahl), Aufwand mittel. Mail `info@regioactive.de` (Impressum, kodiert). Beleg: https://www.regioactive.de/static/impressum .

### 4.8 oberlausitz.com Events-Feed (Tourismusverband Oberlausitz e. V.)

JSON-Feed `https://www.oberlausitz.com/fileadmin/tools/olevents/olevents.php` (selbst geprüft: HTTP 200, 292 KB), 137 Events laut Teilbericht, davon ca. 50 Weihnachtsmärkte (Bischofswerda, Radeberg, Bautzen, Görlitz, Löbau, Zittau, Herrnhut, Niesky), nur je einmal Handwerk/Historischer Markt/Markttag (Schlesischer Tippelmarkt Görlitz 17./18.07.2027). Felder id, title, teaser, address, nextDates, category, latlng, detail_url. **Das Feld `gpx_url` enthält einen API-Schlüssel von Outdooractive: nicht verwenden oder speichern.** Impressum: Vervielfältigung und elektronische Verarbeitung nur mit schriftlicher Genehmigung der Marketing-Gesellschaft Oberlausitz-Niederschlesien; keine robots.txt. **Anfrage** an `info@oberlausitz.com` (Teilbericht, Impressum https://www.oberlausitz.com/impressum ; nicht erneut geprüft). Aufwand klein; Überschneidung mit Görlitz/Bischofswerda/Kamenz-Quellen und SaTourN wahrscheinlich.

### 4.9 Meißen: Meißner Weihnacht (Veranstalter) und stadt-meissen.de

- **meissner-weihnacht.de / gewerbeverein-meissen.de** (Contao): Meißner Weihnacht 23.11.–24.12.2026 am Rathaus, verkaufsoffen 29.11. und 13.12., Wintermarkt 25.12.–01.01.2027; Tagesprogramm. Einzeltermine `/termin/…` mit `Event`-JSON-LD; **`startDate` trägt `+00:00`, ist aber Ortszeit** (Offset verwerfen, als Europe/Berlin lesen). robots: nur `/contao/` gesperrt. Impressum (Gewerbeverein Meißen e. V.): Nutzungsklausel nicht gefunden. **Ohne Anfrage nutzbar**, Info-Mail an `info@gewerbeverein-meissen.de` höflich (Teilbericht, kodiert im Impressum). Aufwand klein–mittel (nur Hauptmarkt-Eintrag laden).
- **stadt-meissen.de:** robots.txt (selbst geprüft) lässt nur einzelne Suchmaschinen (Googlebot, Bingbot u. a.) mit Crawl-delay zu, für alle anderen `Disallow: /`. **Kein automatischer Abruf.** (Ein Teilbericht hatte die Seite als „nicht gesperrt“ beschrieben; das ist falsch.) meissen.de und meissen-tourismus.de: TLS-Zertifikatsfehler, nicht geöffnet.

### 4.10 Bautzen: Wenzelsmarkt

wenzelsmarkt-bautzen.de (TYPO3): 643. Wenzelsmarkt 27.11.–22.12.2026 mit Tagesprogramm; zusätzlich monatliches PDF https://www.bautzen.de/fileadmin/media/aktuell/Termine_November_2026_WEB.pdf (Dezember-PDF noch nicht veröffentlicht). Kein JSON-LD, kein Feed. robots offen. bautzen.de-Impressum: Layout und Gestaltung geschützt, Vervielfältigung und Verwendung nicht gestattet. Die vorhandene Augusto-Quelle liefert nur Programmpunkte, nicht den Markt selbst; der Markt steht aber bei sachsen-tourismus.de (4.1). **Anfrage** an `stadtverwaltung@bautzen.de` oder `pressestelle@bautzen.de` (Impressum). Als einzelner Termin auch handpflegbar. `wenzelsmarkt.de`: Zertifikatsfehler, nicht geöffnet.

### 4.11 Görlitz: Schlesischer Christkindelmarkt

schlesischer-christkindelmarkt-goerlitz.de: 04.–20.12.2026 (Untermarkt), Eislaufbahn 20.11.–03.01., Brückenadvent 11.–13.12.; Veranstalter Görlitzer Kulturservicegesellschaft. HTML, kein Feed; robots Crawl-delay 5; Impressum: Kopien nur privat und nicht kommerziell, sonst schriftliche Zustimmung. Laut Teilbericht fehlt der Markt in `goerlitz.de/termine/api` (Stichprobe 04.–06.12.: 74 Treffer ohne Christkindelmarkt; von mir nicht wiederholt). Er steht aber bei sachsen-tourismus.de mit 20 Terminen unter CC0 (selbst geprüft) – damit ist eine eigene Anbindung überflüssig. Mail `info@kultur-goerlitz.de` (Teilbericht, Impressum, kodiert).

### 4.12 Weitere Weihnachtsmarkt-Quellen (nachrangig)

| Quelle | Befund | Regeln / Mail |
|---|---|---|
| grossenhain.de | Weihnachtsmarkt 27.11.–20.12.2026; `Event`-JSON-LD auf `/va-details/2072.html` (nur Datum) | robots nur `/contao/`; Impressum nur zu Grafiken; Mail `stadtverwaltung@grossenhain.de` |
| altenberg.de (Outdooractive) | ca. 8 Märkte Geising, Kipsdorf, Bärenstein, Schellerhau, Lauenstein, Altenberg (28.11.–13.12.), `Event`-JSON-LD | robots sperrt `/api/*` und PDFs; AGB/Impressum ungelesen; Mail nicht belegt |
| visitsaxony.com | Event-Sitemap 137 URLs, wenige Märkte, englisch, Texte teils veraltet | wie 4.1; in Mail 4.1 mitnehmen |
| radebeul.de/weihnachtsmarkt | Altkötzschenbroda 27.–29.11., 4.–6.12., 11.–13.12. | robots sperrt `/*?*`; Mail im Impressum nicht lesbar; Termine auch in SaTourN |
| radeberg.de | Weihnachtsmarkt 10.–13.12., Liegau-Augustusbad 05.12., Winterzauber 05./06.12. (Datumsformat JJ/MM/TT) | Impressum: Vervielfältigung nur privat; `info@radeberg.de` |
| loebau.de | Weihnachtsmarkt 10.–13.12.2026 | Impressum: Vervielfältigung nicht gestattet; `info@loebau.de` |
| zittau.de | Weihnachtsmarkt mit Lichterfest 05.–13.12.; Kalender ist 3mag-iframe (3mag bereits angefragt) | `stadt@zittau.de`; Termin auch in SaTourN |
| freital.de | Schlossadvent 28./29.11., 5./6.12. | robots offen; schon in SaTourN |
| pirna.de | Canalettomarkt amtlich **24.11.–23.12. und 27.–30.12.**; SaTourN-Eintrag beginnt erst 30.11. | robots sperrt `/*?tx_solr`; kein Event-Markup; Gegenprüfung des Datums |

### 4.13 Weitere Kandidaten

- **DZT Knowledge Graph** (Deutsche Zentrale für Tourismus; https://open-data-germany.org/ , Doku https://changelog-dzt-kg.readme.io/ ): REST/JSON, schema.org-Event, Lizenz je Objekt (CC0/CC BY/CC BY-SA), kostenloser API-Key per Mail an `open-data@germany.travel`, Limits 10/s und 10 000/Tag. **Nicht getestet** (kein Schlüssel; Konto darf nicht angelegt werden). Plan B, falls die TMGS ablehnt; vermutlich nicht mehr Märkte als 4.1.
- **Dresden Open Data** (opendata.dresden.de, Nutzungsbedingungen dl-de/by-2-0): Marktstandorte und Wochenmärkte, keine Termine; Items der OGC-Ebenen `L108`/`L1763` ließen sich nicht abrufen. **GovData** und `register.opendata.sachsen.de` sperren Crawler per robots.txt. Landkreis-Open-Data: nichts gefunden. Kein Nutzen für diese Aufgabe.
- **Handwerks- und Töpfermärkte** (alle ohne Feed; Angaben aus Aggregatoren, Veranstalterseiten waren nicht erreichbar): Meißner Töpfermarkt (2026: 16./17.05.; Gewerbeverein Meißen), Mitteldeutscher Kunsthandwerkermarkt Neschwitz (2026: 18./19.07.), Erlichthof Rietschen (Frühlingsgartenmarkt, Herbstmarkt), Schlesischer Tippelmarkt Görlitz (17./18.07.2027, im Oberlausitz-Feed), Töpfermarkt Neukirch (letzter Beleg 2024). Lausitz-Markt Löbau (15.11.2026) über regioactive. Sächsisch-Böhmischer Bauernmarkt Dohna, Keramikmarkt Bad Schandau und Trödelmarkt Königstein erscheinen laut Suchtreffern auf saechsische-schweiz.de und wären durch die vorhandene Quelle abgedeckt (Daten nicht geprüft).
- **festivalsindeutschland.de** (Einzelperson als Betreiber, Kontakt nur Formular): Event-JSON-LD, aber AGB untersagen Vervielfältigung; 2027 kaum Termine. Nein.
- **dawo-dresden.de, kreativmaerkte.de, markt-wert.net:** Fließtext beziehungsweise Termine außerhalb des Radius (ein Termin Riesa 14.02. bei kreativmaerkte.de). Kein Mehrwert.
- **Hoyerswerda:** Der Kalender der Stadt lädt Daten aus dem Digitalen Veranstaltungskalender Lausitz (Kreevo GmbH) mit einem im Quelltext sichtbaren Schlüssel der Stadt. **Nicht verwendet, nicht empfohlen.** Der Teschenmarkt (11.–13.12.) ist nur über Drittportale belegt, ebenso SaTourN; Klärung über die offene KuFa-Anfrage denkbar.

## 5. Nicht erreichbar, unklar, nicht geprüft

- **Nicht umgangen:** Anubis-Schranke bei `striezelmarkt-dresden.de` und `dresden-elbland.de`; 403 und Roboter-Sperre bei `rausgegangen.de`; TLS-Fehler bei `meissen.de`, `meissen-tourismus.de`, `wenzelsmarkt.de`; robots-Sperren bei `stadt-meissen.de`, `veranstaltungen-api.dresden.de`, GovData, Sachsen-Register.
- **Nicht gelesen/geladen:** Veranstalterseiten `erlichthof.de`, `neschwitz.de`, Gewerbeverein-Meißen-Terminseite, `bautzen-antik.de`, `messepark-loebau.de`; Programm-PDF der Meißner Weihnacht, Radebeuler Flyer, Großenhainer Jahresprogramm (nur Bild); AJAX-Paginierung von flohmarkt-sachsen.de `/termine/`; Impressum/AGB von altenberg.de, visitsaxony.com, Stadt Pirna, regioactive (AGB nur stichprobenartig).
- **Lücken im Inhalt:** keine Quelle gefunden für Trödelmärkte in Bad Muskau, Kamenz, Hoyerswerda, Freital, Heidenau, Riesa, Großenhain, Görlitz (ein Termin im Helenenbad am 02.05.2026 nur über Aggregator), Zittau (Advents-Trödelmarkt Volkshaus 28.11.2026 nur über regioactive), Pirna. Weihnachtsmärkte Kamenz, Heidenau, Dippoldiswalde, Neustadt/Sa., „Neustädter Advent“ nicht amtlich belegt. Veranstalter des Löbauer Lausitz-Markts und des Zittauer Advents-Trödelmarkts unbekannt.
- **Nicht ermittelt:** Lizenz bei Striezelmarkt, Wenzelsmarkt, Christmas Garden, Oybin, Teschenmarkt im JSON-LD (leer); ob die 30-Termine-Grenze in SaTourN-Events echt ist; Abdeckung des DZT-Graphen; Herkunft der Daten der Weihnachtsmarktkarte; Wikidata und OpenStreetMap (bewusst nicht abgefragt, liefern keine Termine); Zittauer Gebirge, Lausitzer Seenland, Wochenkurier, DNN.
- **Ob Aggregatoren von den Tabu-Seiten abschreiben:** nicht belegt, nur Stichproben ohne Treffer.

## 6. Hinweise zur Durchführung

- Abrufe: nur GET, ehrlicher User-Agent mit Projektkontakt, ≥ 2 s Pause je Host (bei dresden.de ≥ 5 s). Keine Formulare, keine Konten, keine Bot-Schranken umgangen.
- Zwei Verfehlungen bei der Teilrecherche, offen vermerkt: (1) Zwei HTML-Seiten von `stadt-meissen.de` wurden einmal abgerufen, bevor die robots.txt (`Disallow: /`) gelesen war; danach nichts mehr dort. (2) Ein einzelner Probeabruf an `register.opendata.sachsen.de/store/search` erfolgte vor dem Lesen der robots.txt (HTTP 400, keine Daten).
- Gefundene API-Schlüssel (Dresdner Veranstaltungs-API im Seitenquelltext, Outdooractive in `gpx_url`, Hoyerswerda-Kreevo) wurden **nicht** benutzt und stehen nicht in diesem Dokument.
- Selbst nachgeprüft (Stichproben nach den Teilberichten): flohmarkt-sachsen.de Impressum, Sammel-iCal (200, 50 Termine), sachsen-tourismus.de Impressum/robots/Event-Sitemap (231)/Lizenzen von fünf Eventseiten, weihnachtsmarktkarte-dresden.de (neun Märkte), dresden.de-Weihnachtsmarktseite (Datumszeilen), stadt-meissen.de robots.txt, oberlausitz.com Feed (200), Mailadressen aus drei Impressen. Alles übrige stammt aus den Teilberichten und wurde nicht erneut abgerufen.
- Zwei Widersprüche zwischen Teilberichten wurden dabei entschieden: Sammel-iCal von flohmarkt-sachsen.de (richtig: `/markttermine/ical/`) und robots der Stadt Meißen (gesperrt).

## 7. Offene Entscheidungen für den Betreiber

1. Anfrage-Mails an 1 und 2 zuerst (Weihnachtsmärkte beginnen am 25.11.); Entwürfe wie bisher selbst absenden. Die Mail an TMGS sollte die Lizenzfrage (CC BY je Event) und die Namensnennung ansprechen.
2. Beschreibungstexte nur übernehmen, wo Lizenz oder Zustimmung vorliegt (Titel, Zeit, Ort, Link zurück genügen); bei CC-BY-Events Namensnennung im Menü „Über Bühnenlicht“ ergänzen.
3. Handgepflegte „Jahresmärkte“-Liste (Handwerk, Töpfer, einzelne Weihnachtsmärkte als Notlösung bis zur Antwort): ja oder nein, und ob dafür vorab Info-Mails an die Veranstalter gehen.
4. Stadtkalender-Anfrage (veranstaltungen.dresden.de) mit der Mail an Dresden Marketing zusammenlegen.
