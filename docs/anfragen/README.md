# Anfragen an die Quellen

Dreizehn Vorlagen, kurz und auf Deutsch (GoOut zusätzlich auf Englisch). **Du verschickst sie selbst**, Claude sendet nichts.
Der Nutzerkreis in den Mails: Familie, Freunde und einige Mitglieder des Schönbacher Heimatvereins, höchstens 35 Personen; der Link wird nur persönlich per WhatsApp weitergegeben.
Die ersten acht Mails wurden am 09.11.2026 gegen 11:36 Uhr abgeschickt, die an Dresden Nightlife um 12:47 Uhr (alle in Gmail unter „Gesendet“).
Die Anfragen an mvp.de, 3mag, Beatpol und die Kulturfabrik Hoyerswerda wurden um 13:04 Uhr abgeschickt.
Unterschrift: vollständige Signatur (Name, Anschrift, Mobil, Mail); die Adresse des Kalenders steht
absichtlich nicht drin (sie enthält den geheimen Code), die Mails bieten an, sie auf Wunsch zu nennen.
Alle Mails gehen von Gmail ab, Antworten kommen also dorthin. Die Projektadresse buehnenlicht@mbuhle.de steht im Menü der Seite.

| Datei | Empfänger | Quelle im Kalender | Warum angefragt |
|---|---|---|---|
| `ddv-augusto.md` | augusto.redaktion@ddv-mediengruppe.de | `augusto` (Stadt Bautzen) | Impressum verlangt Zustimmung zur Vervielfältigung, TDM-Vorbehalt, Schnittstelle nirgends erwähnt |
| `stadt-goerlitz.md` | info@goerlitz.de | `goerlitz` | Impressum: Zustimmung nötig über Privatgebrauch hinaus; Daten stammen aus SaTourN, Zuständigkeit unklar |
| `goout.md` | info@goout.net | `goout` (Tschechien) | Nutzungsbedingungen: nur private Nutzung ohne Zustimmung |
| `gefluegelzuechter.md` | info@rassegefluegel-oberlausitz.de | `gefluegel` | Impressum: Nachnutzung braucht schriftliche Genehmigung |
| `maerkte.md` | info@meine-flohmarkt-termine.de und info@meine-kunsthandwerker-termine.de (eine Mail an beide) | `maerkte` (**abgeschaltet**, Nein vom 10.11.2026) | keine Regeln gefunden; Termine stellen Veranstalter ein, Firma ist Kampagne Spezial GmbH |
| `aust-konzerte.md` | info@aust-konzerte.com | `aust` (Alter Schlachthof, Junge Garde) | Impressum: Verwendung über Privates hinaus nur mit Zustimmung |
| `stadt-kamenz.md` | stadtverwaltung@kamenz.de | `kamenz` | Impressum: Vervielfältigung nur mit Zustimmung |
| `stadt-stolpen.md` | stadt@stolpen.de (evtl. stadtinfo@stolpen.de) | `stolpen` | Impressum: Vervielfältigung nur mit Zustimmung |
| `dresden-nightlife.md` | support@dresden-nightlife.de (perto.com UG) | noch nicht eingebaut | keine Regel zum Auslesen, aber AGB § 8 gegen belastende automatisierte Aufrufe; erst nach Antwort bauen |
| `dresdner-stadtkalender.md` | Betreiber des Dresdner Stadtkalenders | noch nicht eingebaut | erst nach Erlaubnis; Platzhalter noch offen, kein Entwurf angelegt |
| `mvp.md` | mail@manet-marketing.de (MANET Marketing GmbH; Adresse aus dem Impressum zusammengesetzt, vor dem Senden prüfen) | noch nicht eingebaut | Impressum verlangt ausdrückliche Genehmigung für Texte, Fotos und Gestaltung |
| `3mag.md` | kontakt@3mag.eu | noch nicht eingebaut | KI-Crawler auf der Hauptseite ausgeschlossen; sicherheitshalber vorab gefragt |
| `beatpol.md` | info@beatpol.de | noch nicht eingebaut | Impressum verlangt Zustimmung zur Verwertung der Inhalte |
| `kufa-hoyerswerda.md` | post@kufa-hoyerswerda.de (unbestätigt, im Impressum verschleiert, vor dem Senden prüfen) | noch nicht eingebaut | Impressum erlaubt Kopien nur privat und nicht kommerziell |

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
| 10.11.2026 | Märkte (meine-flohmarkt-termine.de, meine-kunsthandwerker-termine.de, krencky24.de; Michael Krencky, Kampagne Spezial GmbH) | **Nein.** Keine Genehmigung zur automatisierten Übernahme und Weiterverwendung; Bitte, die Übernahme einzustellen, bereits übernommene Daten aus dem Kalender zu entfernen und das kurz schriftlich zu bestätigen. Besuchen und Verlinken bleibt erlaubt. Umgesetzt: `maerkte` auf `"enabled": false`, Menüeintrag entfernt; Bestätigung als Gmail-Entwurf. Die Termine verschwinden mit dem ersten Lauf nach dem Push von der Seite. |
| 09.11.2026 | mvp.de (MANET Support, Ticket 586708) | Keine ausdrückliche Erlaubnis (viele Termine stammen von Veranstaltern und Partnern), aber: Abruf für den privaten, nicht kommerziellen, nicht öffentlich zugänglichen Kalender im beschriebenen Umfang wird geduldet, solange er in vernünftigem Rahmen bleibt; bei spürbarer Last behalten sie sich eine Sperre vor. Kein Feed, keine Schnittstelle. Rückfrage: Welcher User-Agent? Antwort steht aus. |
| | | |
