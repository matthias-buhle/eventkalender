# Quellen-Probe

Stand der Abrufe gegen die echten Quellen. Wird in Task 12 (Live-Abnahme) fortgeschrieben.

## GoOut (Tschechien), Probe vom 08.11.2026

Abruf mit dem höflichen Client (robots.txt beachtet, 2 s Pause), Seiten laut Sitemap `city-CS-0.xml`:
7 Kategorieseiten (Děčín: Konzerte; Ústí: Konzerte, Andere; Liberec: Konzerte, Partys, Andere; Česká Lípa: Konzerte).
Ergebnis: **20 Termine** (Děčín 2, Ústí nad Labem 6, Liberec 9, Česká Lípa 3), alle mit Ort, Uhrzeit und Ticketlink.
Grenze: Die Seiten liefern serverseitig nur die ersten Termine je Kategorie (JSON-LD), nicht die ganze Liste.
Beschreibungen sind Tschechisch (Übersetzung ist Teil von Plan 2).

## Ticketmaster (Discovery API v2): Probe steht aus

Ein Schlüssel liegt noch nicht vor (wird in Task 12 gemeinsam angelegt, `TICKETMASTER_API_KEY`).
Die Testdaten in `test/fixtures/ticketmaster-p0.json` sind nach der dokumentierten API-Antwort gebaut, nicht echt abgerufen.
Ohne Schlüssel meldet die Quelle im Status `kein Schlüssel` und liefert nichts.

Sobald der Schlüssel da ist, hier eintragen: Anzahl Termine im Radius 75 km um 01855, davon in Bautzen / Görlitz / Zittau.
Sind es 0 Termine, in `sources.json` `"enabled": false` setzen und hier vermerken.
