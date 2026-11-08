# Eventkalender Ostsachsen: Konzept

Stand: 08.11.2026. Entwurf zur Freigabe durch den Auftraggeber.

Kennzeichnung: Was **entschieden** ist, hat der Auftraggeber so gesagt. Was als **Meine Annahme** markiert ist, ist ein Vorschlag des Entwurfsverfassers und noch nicht abgestimmt.

## 1. Absicht und Warum

Der Auftraggeber (PLZ 01855, Sebnitz) und sein Freundeskreis verpassen regelmäßig Veranstaltungen, die sie gerne besucht hätten. Es gibt zu viele verstreute Quellen. Auslöser: Ein Konzert der Red Hot Chilli Pipers im Alten Schlachthof Dresden wurde nicht rechtzeitig bemerkt. Nach der Romantica in Bautzen fiel erneut auf, wie viel in der Region stattfindet.

Gebaut wird ein kleines Webtool für den Freundeskreis (private Nutzung), das auf dem Handy gut funktioniert, sich täglich aktualisiert und zeigt, was im Umkreis los ist, mit einem Weg, den Veranstalter zu erreichen.

Das Problem ist in erster Linie das Nicht-Mitbekommen. Besonders wichtig sind deshalb kleine, regionale Veranstaltungen und Orte, in denen niemand aus dem Freundeskreis wohnt (zum Beispiel Bautzen, Stolpen).

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Eine gemeinsame Übersicht aller relevanten Veranstaltungen im Umkreis von 75 km um PLZ 01855, einschließlich der tschechischen Seite der Grenze (Děčín, Ústí nad Labem, Liberec, Česká Lípa, Varnsdorf u. a.). **Entschieden.**
- Tägliche automatische Aktualisierung.
- Persönliche Filter pro Freund (Kategorien ausblenden oder auswählen), ohne Konto. **Entschieden** (Speicherung am Handy: Meine Annahme).
- Zu jedem Termin ein Weg zum Veranstalter (Telefon, Link oder E-Mail), sofern bekannt. **Entschieden.**
- Freunde können Termine mit wenig Klicks und wenig Text nachtragen. **Entschieden.**
- Lokale Amtsblätter und Anzeiger werden als Quelle erschlossen, auch ohne Kontaktdaten. **Entschieden.**

**Nicht-Ziele**
- Der Ticketstatus ("noch Plätze frei") ist ausdrücklich **kein K.-o.-Kriterium**. **Entschieden.**
- Kein eigener Ticketverkauf, keine Zahlungen, kein öffentliches Angebot, keine Benutzerkonten.
- Keine Vollständigkeit um jeden Preis; lieber wenige verlässliche Quellen.

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)**
- Das Tool behauptet "Karten verfügbar", obwohl es das nicht weiß.
- Es zeigt veraltete oder abgesagte Termine ohne Hinweis.
- Das Nachtragen ist so mühsam, dass es niemand benutzt.
- Es verstößt gegen ausdrückliche Sperren der Quellen (siehe Abschnitt 7).

## 3. Region

Mittelpunkt PLZ 01855 (Sebnitz), Radius 75 km. Grob im Radius (Entfernungen nicht genau gemessen): Sebnitz, Neustadt in Sachsen, Stolpen, Hohnstein, Bad Schandau, Königstein, Bischofswerda, Pirna, Bautzen, Dresden, Kamenz, Löbau, Görlitz, Zittau, Meißen; auf der tschechischen Seite Děčín, Ústí nad Labem, Česká Lípa, Liberec (Randlage). Die genaue Entfernung berechnet das Tool aus Koordinaten der Veranstaltungsorte.

## 4. Kategorien

**Entschieden** (Wünsche des Auftraggebers): Konzerte (Rock, Pop, Liedermacher, Bands, auch Bands wie "Voltsbead", Schreibweise ungeklärt), Partys (80er/90er und medienbekannte Events), Märkte (Trödel, Töpfer, Handwerker u. a.), Geflügel- und Kleintierschauen, Vereinsfeiern und Feste.

**Meine Annahme:** Als Auswahl für Filter und Nachtragen genügen die Arten Markt, Konzert, Party, Fest, Schau und Sonstiges. Die Quellen liefern eigene Kategorien; das Tool ordnet sie diesen Arten zu.

## 5. Nachtragen durch Freunde

**Entschieden:** Foto und Formular in einem Ablauf (Entwurf: `.superpowers/brainstorm/707-1794147871/content/nachtragen-kombiniert.html`, ersatzweise Beschreibung hier).
- Oben ein großer Knopf "Plakat fotografieren". Darunter alternativ ein Formular mit Name, Art (Antippen), Tag (Antippen), Ort und dem freiwilligen Feld "Telefon oder Link".
- Nach dem Foto erkennt das Tool Name, Art, Tag, Ort und Telefonnummer; der Nutzer prüft und bestätigt mit einem Klick ("Passt, eintragen"). Alles Erkannte bleibt änderbar.
- Telefon oder Link ist **freiwillig**; auf dem Handy soll nichts abgetippt werden müssen.
- Zielwert: Mit Foto etwa drei Klicks, ohne Foto etwa sechs.
- Das **Aussehen** soll deutlich schicker werden; der Feinschliff folgt in einem späteren Schritt.

**Meine Annahme:** Jeder Termin zeigt den Namen des Eintragenden (Vorname). Eintragen darf, wer den privaten Freundeslink kennt; Moderation durch den Auftraggeber ist möglich.

## 6. Anzeige und Kontakt

- Pro Termin: Name, Art, Datum und Uhrzeit, Ort mit Entfernung, Quelle (Link).
- **Kontakt zum Veranstalter** (Telefon, Link, E-Mail) als Knopf "Anrufen" oder "Zur Webseite", wenn bekannt. Fehlt er, steht stattdessen die Quelle (zum Beispiel "Neues Grenzblatt Nr. 45", Link zur Ausgabe). **Entschieden** in der Sache.
- **Ticketstatus:** "ausverkauft" nur anzeigen, wenn die Quelle es belegt. Echte Verfügbarkeit liefern nur Ticketmaster (`dates.status.code`) und GoOut (schema.org `availability`); sonst ein Ticketlink ohne Behauptung. Nie "Karten frei" ohne Beleg. **Meine Annahme.**
- Abgesagte oder verlegte Termine kennzeichnen, wenn die Quelle das meldet (zum Beispiel Ticketmaster mit den Statuswerten canceled, postponed, rescheduled).
- Termine aus Zeitungen und von Freunden tragen eine Markierung "bitte prüfen", bis jemand sie bestätigt oder korrigiert. **Meine Annahme.**

## 7. Quellen

Stand der Prüfung: 08.11.2026, jeweils nur wenige Einzelabrufe. "Nicht verifiziert" heißt: nicht belegt, nicht "gibt es nicht".

**Kern (automatisch, gut nutzbar)**

| Quelle | Gebiet | Zugang | Hinweise |
|---|---|---|---|
| Alter Schlachthof Dresden, Junge Garde | Dresden | offene JSON-Liste `/api/getEvents` (112 bzw. 18 Termine) | kein Statusfeld, "Ausverkauft" nur im Text; Ticketlinks (Eventim, Konzertkasse Dresden u. a.); robots.txt erlaubt alles |
| Augusto (Portal der DDV/Sächsischen Zeitung) | Bautzen, Bischofswerda, Kamenz, Görlitz, Hoyerswerda, Löbau, Niesky, Sebnitz, Weißwasser, Zittau | JSON-Schnittstelle der Stadt-Bautzen-Einbindung; schema.org auf Seiten | Nutzungsrecht **nicht geklärt**, Anfrage nötig; kein Kartenstatus |
| saechsische-schweiz.de und sebnitz.org (gemeinsame Datenbank SaTourN/destination.one) | Sächsische Schweiz inkl. Bad Schandau, Königstein | Event-Sitemap + JSON-LD je Termin; Sebnitz mit eingebettetem JSON, iCal je Termin | Sebnitzer Daten laut Lizenzfeld CC0; Rock/Pop dünn |
| Bischofswerda | Bischofswerda | RSS (`/veranstaltungen/rss`) und iCal | "AUSVERKAUFT" teils im Titel |
| Kamenz | Kamenz | schema.org-Microdata im HTML | Reservix-Links |
| Görlitz (Culturebase-API der Stadtseite) | Görlitz, Löbau, Niesky, Umland | JSON `/termine/api` | viele Dauerausstellungen, die zu filtern sind; Bedingungen **nicht verifiziert** |
| Neustadthalle Neustadt in Sachsen | Neustadt | Einzelseite | Text "Ausverkauft!", Reservix-Links |
| Stolpen (Stadtkalender) | Stolpen | HTML-Liste `/liste-aller-veranstaltungen` | kein Veranstalter in der Liste |
| Steinhaus Bautzen | Bautzen | Wix-Seite | Badge "AUSVERKAUFT", Eventim-Links; Auslesen aufwendig |
| Ticketmaster Discovery API | überregional | kostenloser Schlüssel, Filter nach Ort/Radius, Statuscode | Abdeckung in der Region **ungeprüft**, vorher Testabruf (Deutschland, 75 km); Bedingungen: nicht-kommerzielle Nutzung scheint möglich |
| GoOut (Tschechien) | Děčín, Ústí, Liberec, Česká Lípa | JSON-LD in den Seiten, `availability` InStock/OutOfStock | Datumsformat nicht ISO (eigener Parser); Bedingungen zu Auslesen **nicht verifiziert**; Děčín dünn |
| Oberlausitzer Geflügelzüchterverband | Ostsachsen | HTML-Kalender (51 Schauen bis 22.01.2027), Detailseiten mit JSON-LD | `Crawl-delay: 10` beachten; Bedingungen **nicht verifiziert** |
| meine-flohmarkt-termine.de, meine-kunsthandwerker-termine.de | Märkte | JSON-LD auf Listenseiten | Abdeckung dünn und saisonal; Bedingungen **nicht verifiziert** |

**Ergänzung (nachrangig)**: Visit Liberec, Kudy z nudy (Tschechien, Märkte und Feste, kein Kartenstatus); Stadtkalender Dresden `veranstaltungen.dresden.de` (breit, aber Nutzung erst beim Betreiber klären; der im Seitencode eingebettete Schlüssel darf **nicht** verwendet werden); Konzertkasse Dresden (nur erlaubte Pfade; `site=`, `search=`, `month=` sind gesperrt); Eventbrite und Eventfrog (Dresden, nur Webseiten).

**Lokale Amtsblätter und Anzeiger (Entschieden: werden aufgenommen)**
- Neues Grenzblatt (Sebnitz, wöchentlich), Neustädter Anzeiger (14-täglich), Amtsblatt Bad Schandau (14-täglich), Stolpener Anzeiger (monatlich). Alle erscheinen bei LINUS WITTICH Medien und liegen als PDF auf den Webseiten der Städte (Beispiel: `rathaus.sebnitz.de/downloads/Neues_Grenzblatt_Nr._44_vom_07.11.2025.pdf`, `neustadt-sachsen.de/anzeiger_neustadtinsachsen/2025/anzeiger13_2025.pdf`). Text-PDFs, zweispaltig, Termine als Fließtext, meist ohne Veranstalterkontakt.
- **Meine Annahme (Vorgehen):** Das Tool prüft täglich auf neue Ausgaben, lässt eine KI Name, Datum, Ort und Art herausziehen, speichert die Seitenangabe als Quelle und markiert die Termine mit "bitte prüfen". Übernommen werden nur Fakten, nie Texte, und es wird zur Ausgabe verlinkt.
- Nicht brauchbar: Amtsblätter von Bautzen, Bischofswerda und Görlitz (fast nur Amtliches), Hohnstein (kaum Termine). Die "Heimat- und Bürgerzeitung im Landkreis Bautzen" ist noch nicht identifiziert (**offen**). Der Wochenkurier ließ sich nicht prüfen.

**Nicht nutzen (Sperren oder ungeeignet)**
- Eventim: keine öffentliche Schnittstelle; nur als Ticketlink. Reservix: `/events` per robots.txt gesperrt; Anfrage bei Reservix (Partnerprogramm) möglich.
- `saechsische.de/veranstaltungskalender` und `stadt-pirna.de` (per robots.txt gesperrt), Facebook, Bandsintown, Songkick, Google Events, Meetup, oberlausitz.com/events (undokumentierter Zugang mit Schlüssel), Hoyerswerda (Schlüssel eingebettet, nur nach Rücksprache), die API-Pfade von 3mag Events (gesperrt).

## 8. Technische Leitplanken

Die Umsetzung bleibt dem Baumeister überlassen. Vorgaben:
- **Handy zuerst**; als Startbildschirm-Symbol installierbar (PWA), keine App-Store-Pflicht. **Meine Annahme.**
- Möglichst **keine laufenden Kosten**; der einzige Kostenpunkt darf die KI-Auswertung (Zeitungs-PDFs und Plakatfotos) sein. Meine grobe Vermutung: wenige Euro im Monat. **Nicht belegt.**
- **Tägliche automatische Aktualisierung** ohne eigenen Server, wenn möglich (zum Beispiel geplanter Lauf bei einem kostenlosen Dienst). Das Nachtragen und die Fotoerkennung brauchen dagegen ein kleines Hintergrundprogramm mit Speicher. Wahl der Technik: Baumeister.
- Pro Quelle ein eigener kleiner Auslesebaustein ("Adapter"), damit eine kaputte Quelle die anderen nicht stört. Ein Ausfall einer Quelle wird sichtbar gemeldet.
- **Dubletten** (derselbe Termin aus mehreren Quellen) zusammenführen, anhand von Name, Datum und Ort; die Quellen bleiben alle als Links erhalten.
- Entfernung aus der PLZ 01855 berechnen; Veranstaltungsorte werden mit Koordinaten versehen.
- Vergangene Termine nicht anzeigen. Standardansicht: ab heute.
- Tschechische Quellen: Titel, Ort und Datum unübersetzt; Statuswörter ("Vyprodáno", "Prodej ukončen") über eine kleine Tabelle abbilden; Beschreibungen werden ins Deutsche übersetzt (nur einmal je Termin, danach gespeichert, um Kosten zu sparen).
- Höflichkeit gegenüber den Quellen: wenige Abrufe pro Tag, `robots.txt` und `Crawl-delay` beachten, keine Umgehung von Sperren, Anmeldung oder Bot-Schutz, eindeutige Kennung im Zugriff.

## 9. Recht und Umgang (keine Rechtsauskunft)

Privates, nicht-kommerzielles Projekt für einen Freundeskreis. Es werden nur Fakten übernommen (Name, Datum, Ort, Kontakt) und immer zur Quelle verlinkt. Vor dem Start sollen die Betreiber folgender Quellen **formlos angefragt** werden, weil die Nutzungsbedingungen offen sind: DDV/Augusto, Stadt Görlitz, GoOut, Oberlausitzer Geflügelzüchterverband, die Städte bzw. der Verlag Wittich (für die Amtsblätter), Betreiber des Dresdner Stadtkalenders. Für Ticketmaster gelten deren Nutzungsbedingungen (Datenschutzhinweis, begrenzte Speicherdauer).

## 10. Erfolg

- Ein Ereignis wie das Dudelsack-Konzert wäre früh im Kalender sichtbar gewesen.
- Der Freundeskreis nutzt die Übersicht tatsächlich; Nachtragen wird gebraucht und nicht umgangen.
- Auch aus Orten ohne Freunde vor Ort (Bautzen, Stolpen) erscheinen regelmäßig Termine.

## 11. Offene Punkte (vom Baumeister oder später zu klären)

1. Technische Plattform und Hosting für Seite, Nachträge und Fotoerkennung.
2. Wer darf eintragen und wer moderiert (Annahme: Freundeslink, Moderation durch den Auftraggeber).
3. Antworten der angefragten Betreiber (Abschnitt 9) und Ergebnis des Ticketmaster-Testabrufs.
4. Die Heimat- und Bürgerzeitung im Landkreis Bautzen und weitere Anzeiger (Zittau, Löbau, Pirna): nicht geprüft.
5. Optik: bewusst auf später verschoben ("schicker").
6. Welche Quelle in welcher Reihenfolge angebunden wird (siehe Abschnitt 12, Phasen).

## 12. Ergänzungen nach der Prüfung (alles **Meine Annahme**, außer es ist anders vermerkt)

- **Sprache:** Die Oberfläche ist deutsch. Tschechische Beschreibungen werden ins Deutsche übersetzt (**Entschieden**); Titel, Künstlernamen und Ortsnamen bleiben im Original. Die Übersetzung zählt zu den KI-Kosten und fällt unter die Grenze von 5 € im Monat (Abschnitt 13). Zeitungs- und Plakattexte sind deutsch.
- **"Bitte prüfen":** Jeder Freund darf einen so markierten Termin bestätigen oder korrigieren; eine Bestätigung reicht. Unbestätigte Termine bleiben sichtbar, mit Markierung, bis ihr Datum vorbei ist.
- **Dubletten:** Im Zweifel lieber doppelt zeigen als einen echten Termin verstecken. Zusammengeführt wird nur bei eindeutiger Übereinstimmung von Name, Datum und Ort.
- **Zugriff und Moderation:** Zugang über einen privaten Link mit Zufallscode. Jeder Freund kann eigene Einträge ändern oder löschen; der Auftraggeber kann alle löschen. Für Fotoerkennung und Zeitungsauswertung gilt eine feste Obergrenze pro Tag, damit ein geleakter Link keine hohen Kosten verursacht.
- **Phasen:**
  1. Anzeige der Kernquellen mit Filtern, Entfernung, Kontakt und Quellenlink.
  2. Nachtragen: zuerst das Formular, dann die Fotoerkennung.
  3. Lokale Zeitungen (nutzen dieselbe KI-Auswertung wie das Foto).
  Das Foto-Nachtragen und die Zeitungen sind **entschieden** und werden gebaut; die Reihenfolge ist nur ein Vorschlag.
- **Schalter pro Quelle:** Jede Quelle lässt sich einzeln abschalten.

## 13. Entscheidungen des Auftraggebers nach der Prüfung (**Entschieden**)

- **Einrichtung und Kosten:** Der Auftraggeber legt die nötigen Konten und Schlüssel selbst an (kostenloses Hosting-Konto, KI-Schlüssel, Ticketmaster-Schlüssel); der Baumeister führt ihn Schritt für Schritt durch. Die KI-Kosten sind auf **5 € pro Monat** begrenzt. Ist die Grenze erreicht, pausiert die KI-Auswertung (Fotoerkennung und Zeitungen) bis zum nächsten Monat, die übrige Anzeige läuft weiter.
- **Nutzerkreis:** höchstens **20 Personen**. Ein privater Link mit Zufallscode genügt als Zugangsschutz.
- **Quellen mit offenen Nutzungsbedingungen** (Augusto, Görlitz, GoOut, Oberlausitzer Geflügelzüchterverband, Amtsblätter und Anzeiger): werden trotzdem ausgelesen, aber nur wenige Male pro Tag, mit Link zur Quelle. Sagt ein Betreiber **Nein**, wird diese Quelle sofort abgeschaltet.
