# Einrichtung: von „liegt auf dem Rechner“ bis „läuft täglich“

Alle Schritte machst du einmal. Hinter jedem Schritt steht, woran du erkennst, dass er geklappt hat.
Befehle gibst du im Terminal im Projektordner ein (`E:\ClaudeCode\Eventcalender`).

## 1. GitHub-Konto anlegen (du)

Auf <https://github.com/signup> ein kostenloses Konto anlegen, E-Mail-Adresse bestätigen.
**Erwartet:** Du bist auf github.com angemeldet und hast eine Bestätigungs-Mail geöffnet.

## 2. Am Rechner anmelden (du)

```bash
gh auth login
```

Antworten: `GitHub.com` → `HTTPS` → `Login with a web browser`. Den angezeigten Code im Browser eingeben.

```bash
gh auth status
```

**Erwartet:** „Logged in to github.com account <dein Name>“.

## 3. Repository verbinden und hochladen

Das Repository `eventkalender` muss **öffentlich** sein (nötig für die kostenlose Veröffentlichung).
Es enthält keine Schlüssel oder Passwörter, nur Programmcode.

```bash
git status
git remote add origin https://github.com/<dein Name>/eventkalender.git
git push -u origin phase1:main
```

(Gibt es das Repository noch nicht: `gh repo create eventkalender --public --source . --remote origin --push`.)

**Erwartet:** `git status` zeigt „nothing to commit“; nach dem Push siehst du die Dateien im Browser unter
`https://github.com/<dein Name>/eventkalender`.

## 4. GitHub Pages einschalten

```bash
gh api --method POST repos/{owner}/{repo}/pages -f build_type=workflow
```

**Erwartet:** Eine Antwort mit `"build_type": "workflow"`.
(Alternativ im Browser: Repository → Settings → Pages → Source: **GitHub Actions**.)

## 5. Geheimen Zufallscode für die Adresse festlegen

```bash
node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))"
```

Das Ergebnis (zwölf Zeichen) ist dein Code. Dann, mit deinem Code statt `<Code>`:

```bash
gh variable set SITE_CODE --body "<Code>"
```

**Erwartet:** „✓ Created variable SITE_CODE“.
Wichtig: Der Code ist nur eine Verschleierung der Adresse, **kein Schutz**. Wer die Adresse kennt, sieht den Kalender.
In dieser Phase stehen dort nur öffentliche Angaben aus den Quellen.

## 6. Ticketmaster-Schlüssel (du)

1. Auf <https://developer.ticketmaster.com> registrieren und eine App anlegen.
2. Den „Consumer Key“ kopieren.
3. Hinterlegen (der Befehl fragt nach dem Schlüssel; füge ihn dort ein, nicht in einen Chat):

```bash
gh secret set TICKETMASTER_API_KEY
```

**Erwartet:** „✓ Set Actions secret TICKETMASTER_API_KEY“.
Ohne Schlüssel läuft alles, nur die Quelle Ticketmaster meldet „kein Schlüssel“.

## 7. Kontaktangabe für die Quellen (empfohlen)

Die Abrufe stellen sich als „Eventkalender-Ostsachsen“ vor. Mit einer Kontaktadresse können Betreiber dich erreichen, statt zu sperren:

```bash
gh variable set EVENTKALENDER_CONTACT --body "deine-mailadresse@example.org"
```

**Erwartet:** „✓ Created variable EVENTKALENDER_CONTACT“. Die Adresse erscheint in den Abrufen bei den Quellen, nicht auf der Seite.

## 7b. DeepL-Schlüssel für die Übersetzung tschechischer Termine (optional)

Titel und Beschreibung der Termine aus Tschechien (GoOut, Děčín) werden beim Bauen mit DeepL ins Deutsche übersetzt;
der Originaltitel steht dann am Anfang der Beschreibung („Originaltitel: …“).

1. Auf <https://www.deepl.com/pro-api> den Tarif **Developer** (kostenlos, einmalige Gutschrift von 1 Million Zeichen) anlegen.
2. Den Schlüssel unter <https://www.deepl.com/your-account/keys> kopieren (Gratis-Schlüssel enden auf `:fx`).
3. Hinterlegen (der Befehl fragt nach dem Schlüssel; füge ihn dort ein, nicht in einen Chat):

```bash
gh secret set DEEPL_API_KEY
```

Ohne Schlüssel, bei Fehlern oder wenn die Gutschrift aufgebraucht ist, bleibt der tschechische Originaltext stehen; der Lauf bricht nie ab.
Jede Übersetzung wird in `uebersetzungen.json` zwischengespeichert (liegt auf der veröffentlichten Seite, der Workflow holt sie
vor dem Bauen wieder ab), sodass derselbe Text nur einmal Zeichen kostet. Im Lauf-Protokoll steht eine Zeile „Übersetzung: …“ mit dem Verbrauch.
Einträge, die 90 Tage nicht mehr vorkamen, werden verworfen.

## 8. Ersten Lauf starten

```bash
gh workflow run daily.yml
gh run watch
```

**Erwartet:** Beide Teile („build“ und „deploy“) werden grün. Das dauert etwa 10 bis 15 Minuten,
weil der Geflügelzüchterverband nur mit 10 Sekunden Abstand abgerufen wird. Danach läuft der Kalender täglich um 02:43 UTC (03:43 oder 04:43 Uhr bei uns) von selbst, GitHub kann geplante Läufe um Stunden verzögern oder ganz auslassen; dann den Lauf von Hand starten.
Fehlschlag? `gh run view --log-failed` zeigt den Grund. Steht „SITE_CODE fehlt“, Schritt 5 wiederholen.

## 9. Auf dem Handy öffnen

Adresse: `https://<dein Name>.github.io/eventkalender/<Code>/`

- **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü (⋮) → „App installieren“ oder „Zum Startbildschirm hinzufügen“.

**Erwartet:** Ein Symbol „Events“ auf dem Startbildschirm; es öffnet den Kalender ohne Browserleiste.
Im Flugmodus zeigt die App den zuletzt geladenen Stand.
Die Adresse gibst du nur persönlich weiter (WhatsApp), an Familie, Freunde und einige Mitglieder des Schönbacher Heimatvereins (höchstens 35 Personen). Jeder stellt seine Filter selbst ein; sie bleiben auf dem eigenen Handy gespeichert.

## 10. Prüfen, ob alle Quellen liefern

Die Fußzeile der Seite nennt Quellen, die ausgefallen sind („Quelle X seit <Datum> ohne Daten“).
Die Zahlen je Quelle stehen in `https://<dein Name>.github.io/eventkalender/<Code>/data/status.json`.
Der Stand der ersten Abnahme steht in `docs/quellen-probe.md`.

## Eine Quelle abschalten

In `sources.json` bei der Quelle `"enabled": false` setzen, speichern, dann:

```bash
git commit -am "Quelle abgeschaltet" && git push
gh workflow run daily.yml
```

**Erwartet:** Beim nächsten Lauf taucht die Quelle nicht mehr auf. Sagt ein Betreiber „Nein“, machst du das sofort.

## Programm und Daten getrennt veröffentlichen

Es gibt zwei Workflows (Reiter „Actions“ auf GitHub). Beide laufen nie gleichzeitig; der später gestartete wartet.
- **„Taeglich aktualisieren“** fragt alle Quellen ab (rund 25 Minuten) und veröffentlicht Daten und Programm. Läuft täglich um 02:43 UTC und auf Knopfdruck. Nötig bei Änderungen an `src/` (Quellen) und `sources.json`.
- **„Programm veröffentlichen“** (`.github/workflows/programm.yml`) veröffentlicht nur das Programm (alles unter `site/`) mit den **bereits vorhandenen** Daten. Dauert wenige Minuten. Startet von selbst, wenn etwas unter `site/` oder `package.json` auf `main` gepusht wird, und auf Knopfdruck („Run workflow“). „Stand: …“ bleibt dabei unverändert.
  - Er holt `events.json`, `status.json`, `places.json` und `uebersetzungen.json` von der laufenden Seite. Fehlt eine Datei oder ist `events.json` leer, bricht er ab und lässt die Seite unverändert.
  - Lokal die Versionsdatei erzeugen: `npm run versiondatei`.

## Menü „Über Bühnenlicht“

Der Knopf ☰ oben rechts öffnet ein Fenster mit Zweck der Seite, Quellenliste, Lizenzen, Datenschutz und Kontakt. Der Inhalt steht in `site/js/ueber.js`.
- **Kontaktadresse** (Rückfragen, Löschwünsche): `KONTAKT_MAIL`, derzeit `buehnenlicht@mbuhle.de`. Auf `null` gesetzt entfällt die Zeile.
- **Aufbau:** fünf aufklappbare Abschnitte (Wofür, Woher die Termine kommen, Lizenzen, Datenschutz, Kontakt); beim Öffnen ist nur „Wofür“ aufgeklappt. Die Quellen stehen nach `GRUPPEN` sortiert.
- **Neue Quelle** in `sources.json`: dazu gehört ein Eintrag in `QUELLEN` und in genau eine Gruppe in `GRUPPEN` in derselben Datei. `npm test` schlägt sonst fehl.
- **Versionsnummer:** steht oben in der Stand-Zeile („v1.4.0“) und unten im Menü („Version 1.4.0 (Commit) · gebaut am …“). Die Nummer kommt aus `package.json` (`version`, von Hand erhöhen, z. B. 1.5.0 bei neuen Funktionen, 1.4.1 bei Korrekturen). Commit und Datum schreibt jeder der beiden Workflows in `site/data/version.json` (Code in `src/version.js`).
- Das Fenster ist auch für die Auflagen von Ticketmaster und die Namensnennung bei Sebnitz (CC BY-SA 4.0) da; beides nicht entfernen.

## Anfragen an die Quellen

Die Vorlagen liegen in `docs/anfragen/`. Du verschickst sie selbst, Claude versendet nichts.
Bis eine Antwort da ist, bleiben Görlitz und Augusto eingeschaltet (offene Bedingungen, wenige Abrufe am Tag, Link zurück zur Quelle).

## Was in dieser Phase noch nicht dabei ist

Nachtragen durch Freunde (Formular und Foto), KI-Auswertung samt 5-€-Grenze, Zeitungs-PDFs, Übersetzung der tschechischen Beschreibungen
und ein schickeres Aussehen. Das sind Plan 2 und 3.
