# Anfragen an die Quellen

Siebzehn Vorlagen, kurz und auf Deutsch (GoOut zusätzlich auf Englisch). **Du verschickst sie selbst**, Claude sendet nichts.
Der Nutzerkreis in den Mails: Familie, Freunde und einige Mitglieder des Schönbacher Heimatvereins, höchstens 35 Personen; der Link wird nur persönlich per WhatsApp weitergegeben.
Die ersten acht Mails wurden am 09.11.2026 gegen 11:36 Uhr abgeschickt, die an Dresden Nightlife um 12:47 Uhr (alle in Gmail unter „Gesendet“).
Die Anfragen an mvp.de, 3mag, Beatpol und die Kulturfabrik Hoyerswerda wurden um 13:04 Uhr abgeschickt.
Die letzten vier Vorlagen (TMGS/Dresden Marketing, flohmarkt-sachsen.de, dresden.de, Oberlausitzer Trödelmarkt) liegen seit dem 10.11.2026 als Gmail-Entwürfe bereit und sind **noch nicht abgeschickt**; Hintergrund: `docs/quellen-recherche-maerkte.md`.
Unterschrift: vollständige Signatur (Name, Anschrift, Mobil, Mail); die Adresse des Kalenders steht
absichtlich nicht drin (sie enthält den geheimen Code), die Mails bieten an, sie auf Wunsch zu nennen.
Alle Mails gehen von Gmail ab, Antworten kommen also dorthin. Die Projektadresse buehnenlicht@mbuhle.de steht im Menü der Seite.

| Datei | Empfänger | Quelle im Kalender | Warum angefragt |
|---|---|---|---|
| `ddv-augusto.md` | augusto.redaktion@ddv-mediengruppe.de | `augusto` (Stadt Bautzen) | Impressum verlangt Zustimmung zur Vervielfältigung, TDM-Vorbehalt, Schnittstelle nirgends erwähnt |
| `stadt-goerlitz.md` | info@goerlitz.de | `goerlitz` | Impressum: Zustimmung nötig über Privatgebrauch hinaus; Daten stammen aus SaTourN, Zuständigkeit unklar |
| `goout.md` | info@goout.net | `goout` (Tschechien) | Nutzungsbedingungen: nur private Nutzung ohne Zustimmung |
| `gefluegelzuechter.md` | info@rassegefluegel-oberlausitz.de | `gefluegel` | Impressum: Nachnutzung braucht schriftliche Genehmigung |
| `maerkte.md` | info@meine-flohmarkt-termine.de und info@meine-kunsthandwerker-termine.de (eine Mail an beide) | `maerkte` (**entfernt**, Nein vom 10.11.2026) | keine Regeln gefunden; Termine stellen Veranstalter ein, Firma ist Kampagne Spezial GmbH |
| `aust-konzerte.md` | info@aust-konzerte.com | `aust` (Alter Schlachthof, Junge Garde) | Impressum: Verwendung über Privates hinaus nur mit Zustimmung |
| `stadt-kamenz.md` | stadtverwaltung@kamenz.de | `kamenz` | Impressum: Vervielfältigung nur mit Zustimmung |
| `stadt-stolpen.md` | stadt@stolpen.de (evtl. stadtinfo@stolpen.de) | `stolpen` | Impressum: Vervielfältigung nur mit Zustimmung |
| `dresden-nightlife.md` | support@dresden-nightlife.de (perto.com UG) | noch nicht eingebaut | keine Regel zum Auslesen, aber AGB § 8 gegen belastende automatisierte Aufrufe; erst nach Antwort bauen |
| `dresdner-stadtkalender.md` | Betreiber des Dresdner Stadtkalenders | noch nicht eingebaut | erst nach Erlaubnis; Platzhalter noch offen, kein Entwurf angelegt |
| `mvp.md` | mail@manet-marketing.de (MANET Marketing GmbH; Adresse aus dem Impressum zusammengesetzt, vor dem Senden prüfen) | noch nicht eingebaut | Impressum verlangt ausdrückliche Genehmigung für Texte, Fotos und Gestaltung |
| `3mag.md` | kontakt@3mag.eu | noch nicht eingebaut | KI-Crawler auf der Hauptseite ausgeschlossen; sicherheitshalber vorab gefragt |
| `beatpol.md` | info@beatpol.de | noch nicht eingebaut | Impressum verlangt Zustimmung zur Verwertung der Inhalte |
| `kufa-hoyerswerda.md` | post@kufa-hoyerswerda.de (unbestätigt, im Impressum verschleiert, vor dem Senden prüfen) | noch nicht eingebaut | Impressum erlaubt Kopien nur privat und nicht kommerziell |
| `tmgs-sachsen-tourismus.md` | info@sachsen-tour.de und info@marketing.dresden.de (eine Mail an beide) | noch nicht eingebaut | Impressum verlangt Zustimmung zur Vervielfältigung; Lizenz je Termin (CC BY 4.0, CC0), bei Märkten ohne Lizenz Rückfrage |
| `flohmarkt-sachsen.md` | info@flohmarkt-sachsen.de (DDV Sachsen GmbH) | noch nicht eingebaut | Impressum verlangt Zustimmung zur Vervielfältigung; iCal-Feed endet nach 50 Terminen |
| `dresden-weihnachtsmaerkte.md` | info@dresden.info (Dresden Information GmbH) | noch nicht eingebaut | Impressum erlaubt Vervielfältigung nur privat, Weitergabe ausgeschlossen; robots.txt mit 5 s Pause |
| `oberlausitzer-troedelmarkt.md` | kontakt@oberlausitzer-troedelmarkt.de (alternativ info@, vor dem Senden prüfen) | noch nicht eingebaut | keine Nutzungsregel auf der Seite, Rückfrage der Höflichkeit halber; Termine nur bis 17.10.2026 |

Keine Anfrage nötig (Stand der Prüfung vom 09.11.2026, siehe `pruefung-2026-11-09.md`): Sebnitz und Sächsische Schweiz
(Lizenz je Termin CC0 oder CC BY-SA, bei CC BY-SA Namensnennung), Bischofswerda (Feed der Stadt, keine Bedingungen),
Neustadthalle (keine Bedingungen), Ticketmaster (offizielle Schnittstelle, Auflagen siehe Prüfbericht),
L2 Club Görlitz (`l2club`), Steinhaus Bautzen (`steinhaus`) und Děčín (`idecin`, Stadtprogramm idecin.cz): dort
sind Termine öffentlich als Schema.org- beziehungsweise Seitendaten ausgeliefert, Nutzungsregeln gegen das Auslesen fanden sich nicht.
Die Straße E Dresden wurde bewusst nicht eingebaut (Feed veraltet, gemischte Zeichencodierung, wenige künftige Termine).

Antwortet jemand mit **Nein**: in `sources.json` bei der Quelle `"enabled": false` setzen (siehe `docs/SETUP.md`, „Eine Quelle abschalten“).
Das gilt sofort und ohne Diskussion. Antworten bitte hier unten festhalten.

## Antworten

| Datum | Quelle | Antwort |
|---|---|---|
| 09.11.2026 | GoOut | nur automatische Eingangsbestätigung (Ticket 195939), noch keine inhaltliche Antwort |
| 10.11.2026 | Märkte (meine-flohmarkt-termine.de, meine-kunsthandwerker-termine.de, krencky24.de; Michael Krencky, Kampagne Spezial GmbH) | **Nein.** Keine Genehmigung zur automatisierten Übernahme und Weiterverwendung; Bitte, die Übernahme einzustellen, bereits übernommene Daten aus dem Kalender zu entfernen und das kurz schriftlich zu bestätigen. Besuchen und Verlinken bleibt erlaubt. Umgesetzt: Quelle abgeschaltet, dann Adapter, Test, Seitenabzüge und Konfiguration gelöscht (nur noch in der Git-Historie), Menüeintrag entfernt; Bestätigung als Gmail-Entwurf. Die Termine verschwinden mit dem ersten Lauf nach dem Push von der Seite. |
| 09.11.2026 | mvp.de (MANET Support, Ticket 586708) | Keine ausdrückliche Erlaubnis (viele Termine stammen von Veranstaltern und Partnern), aber: Abruf für den privaten, nicht kommerziellen, nicht öffentlich zugänglichen Kalender im beschriebenen Umfang wird geduldet, solange er in vernünftigem Rahmen bleibt; bei spürbarer Last behalten sie sich eine Sperre vor. Kein Feed, keine Schnittstelle. Rückfrage: Welcher User-Agent? Antwort steht aus. |
| | | |
