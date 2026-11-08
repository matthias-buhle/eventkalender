# Quellen-Probe

Stand der Abrufe gegen die echten Quellen. Wird in Task 12 (Live-Abnahme) fortgeschrieben.

## GoOut (Tschechien), Probe vom 08.11.2026

Abruf mit dem höflichen Client (robots.txt beachtet, 2 s Pause), Seiten laut Sitemap `city-CS-0.xml`:
7 Kategorieseiten (Děčín: Konzerte; Ústí: Konzerte, Andere; Liberec: Konzerte, Partys, Andere; Česká Lípa: Konzerte).
Ergebnis: **20 Termine** (Děčín 2, Ústí nad Labem 6, Liberec 9, Česká Lípa 3), alle mit Ort, Uhrzeit und Ticketlink.
Grenze: Die Seiten liefern serverseitig nur die ersten Termine je Kategorie (JSON-LD), nicht die ganze Liste.
Beschreibungen sind Tschechisch (Übersetzung ist Teil von Plan 2).

## Ticketmaster (Discovery API v2), Probe vom 08.11.2026

Erster GitHub-Lauf mit Schlüssel: **67 Termine** im Radius 75 km um 01855, **alle in Dresden**; aus Bautzen, Görlitz und Zittau kommt nichts.
Status `ok`, Ticketstatus „verfügbar“ stammt aus dem Verkaufsstatus der API (also belegt). Die Quelle bleibt eingeschaltet.

## Abnahme der Anzeige-Phase (Task 12), 08.11.2026

Vollständiger lokaler Lauf (`npm run build`, ohne Ticketmaster-Schlüssel), danach Rauchtest Görlitz/Augusto nach der Ortskorrektur.

| Quelle | Termine | Bemerkung |
|---|---|---|
| aust (Sebnitz) | 130 | |
| satourn | 545 | |
| kamenz | 69 | |
| bischofswerda | 47 | |
| goerlitz | 280 | offene Bedingungen, Anfrage in `docs/anfragen/` |
| augusto | 485 | offene Bedingungen, Anfrage in `docs/anfragen/` |
| goout (Tschechien) | 20 | siehe oben |
| ticketmaster | 67 | alle Dresden, Schlüssel seit 08.11. gesetzt |
| gefluegel | 49 | alle mit Ort (Detailseiten einzeln abgerufen, 10 s Abstand; Nachprüfung nach der Schlussprüfung: 49 von 49, keine Abruffehler) |
| maerkte | 45 | |
| neustadthalle | 16 | |
| stolpen | 13 | |

Insgesamt 1595 Termine (lokaler Lauf); der erste GitHub-Lauf ergab 1707 Termine bei 12 von 12 Quellen ok. Abnahmekriterien lokal erfüllt: mindestens 5 Quellen liefern, Termine mit Telefon, tschechische Termine, „ausverkauft“-Termine vorhanden.

Gefunden und behoben: CultureBase (Görlitz, Augusto) nennt nur die Spielstätte ohne Stadt; 245 Termine hatten dadurch keine Entfernung und umgingen Radius und km-Schieber. Jetzt ordnet `fallbackPlace` (Görlitz bzw. Bautzen) sie der Region zu und hängt „, Raum <Region>“ an den Ortsnamen. Rauchtest danach: 703 Termine im Radius, 0 ohne Entfernung. Grenze: Die Entfernung dieser Termine ist die der Regionsmitte, nicht der Spielstätte.

Erledigt am 08.11.: erster GitHub-Lauf grün (Dauer ca. 24 Minuten), Seite online, Ticketmaster-Schlüssel gesetzt. Offen: der Versand der Anfragen. Bekannt: 35 Geflügel-Termine haben einen Ortsnamen, den das Ortsverzeichnis nicht kennt (kleine Dörfer), und umgehen deshalb Radius und km-Schieber.
