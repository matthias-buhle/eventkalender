// Inhalt des Fensters "Über Bühnenlicht": wofür die Seite da ist, woher die Termine kommen, Lizenzen, Datenschutz, Kontakt.
// Alles als DOM über textContent, nie über innerHTML.

/** Kontaktadresse des Projekts (Rückfragen, Löschwünsche). Auf null gesetzt entfällt die Zeile. */
export const KONTAKT_MAIL = 'buehnenlicht@mbuhle.de';

/**
 * Jede Quelle aus sources.json mit ihrem Namen, den Webseiten und einer Zeile dazu, wer die Daten herausgibt.
 * Der Test test/ueber.test.js stellt sicher, dass keine Quelle fehlt oder übrig ist.
 */
export const QUELLEN = [
  {
    schluessel: 'satourn',
    name: 'Sebnitz, Sächsische Schweiz und Umgebung',
    hinweis: 'Offene Tourismusdaten Sachsen (Open Data Finder der TMGS) und Termine der Touristinformation Sebnitz.',
    links: [
      { text: 'sebnitz.org', url: 'https://www.sebnitz.org/Veranstaltungskalender/' },
      { text: 'saechsische-schweiz.de', url: 'https://www.saechsische-schweiz.de/' },
    ],
  },
  {
    schluessel: 'aust',
    name: 'Alter Schlachthof und Junge Garde (Dresden)',
    hinweis: 'Programm der Bernd Aust KulturManagement GmbH.',
    links: [
      { text: 'alter-schlachthof.de', url: 'https://www.alter-schlachthof.de' },
      { text: 'junge-garde.com', url: 'https://www.junge-garde.com' },
    ],
  },
  {
    schluessel: 'ticketmaster',
    name: 'Ticketmaster',
    hinweis: 'Veranstaltungen im Umkreis, über die offizielle Schnittstelle (Discovery API) von Ticketmaster.',
    links: [{ text: 'ticketmaster.de', url: 'https://www.ticketmaster.de' }],
  },
  {
    schluessel: 'goerlitz',
    name: 'Stadt Görlitz',
    hinweis: 'Veranstaltungskalender der Stadt.',
    links: [{ text: 'goerlitz.de', url: 'https://www.goerlitz.de/' }],
  },
  {
    schluessel: 'augusto',
    name: 'Augusto (Stadt Bautzen)',
    hinweis: 'Veranstaltungskalender der DDV Mediengruppe.',
    links: [{ text: 'augusto-sachsen.de', url: 'https://augusto-sachsen.de' }],
  },
  {
    schluessel: 'kamenz',
    name: 'Stadt Kamenz',
    hinweis: 'Veranstaltungskalender der Stadt.',
    links: [{ text: 'kamenz.de', url: 'https://www.kamenz.de/veranstaltungskalender.html' }],
  },
  {
    schluessel: 'bischofswerda',
    name: 'Stadt Bischofswerda',
    hinweis: 'Veranstaltungen der Stadt.',
    links: [{ text: 'bischofswerda.de', url: 'https://www.bischofswerda.de/veranstaltungen' }],
  },
  {
    schluessel: 'stolpen',
    name: 'Stadt Stolpen',
    hinweis: 'Veranstaltungsliste der Stadt.',
    links: [{ text: 'stolpen.de', url: 'https://www.stolpen.de' }],
  },
  {
    schluessel: 'neustadthalle',
    name: 'Neustadthalle',
    hinweis: 'Programm der Neustadthalle in Neustadt in Sachsen.',
    links: [{ text: 'neustadthalle.de', url: 'https://www.neustadthalle.de' }],
  },
  {
    schluessel: 'l2club',
    name: 'L2 Club Görlitz',
    hinweis: 'Programm des Clubs (Purevision Events GmbH).',
    links: [{ text: 'l2club.de', url: 'https://www.l2club.de/events' }],
  },
  {
    schluessel: 'steinhaus',
    name: 'Steinhaus Bautzen',
    hinweis: 'Programm des Steinhaus e. V.',
    links: [{ text: 'steinhaus-bautzen.de', url: 'https://www.steinhaus-bautzen.de/termine' }],
  },
  {
    schluessel: 'idecin',
    name: 'Děčín (Stadt)',
    hinweis: 'Kulturprogramm der Stadt Děčín.',
    links: [{ text: 'idecin.cz', url: 'https://www.idecin.cz/program' }],
  },
  {
    schluessel: 'goout',
    name: 'GoOut (Nordböhmen)',
    hinweis: 'Veranstaltungen in Děčín, Ústí nad Labem, Liberec und Česká Lípa.',
    links: [{ text: 'goout.net', url: 'https://goout.net' }],
  },
  {
    schluessel: 'gefluegel',
    name: 'Rassegeflügelzüchter Oberlausitz',
    hinweis: 'Schauen und Termine der Züchter.',
    links: [{ text: 'rassegefluegel-oberlausitz.de', url: 'https://www.rassegefluegel-oberlausitz.de/' }],
  },
];

/**
 * Die Quellen in der Liste nach Art gegliedert. Jede Quelle steht in genau einer Gruppe;
 * der Test test/ueber.test.js stellt das sicher.
 */
export const GRUPPEN = [
  { titel: 'Städte und Tourismus', schluessel: ['satourn', 'bischofswerda', 'kamenz', 'stolpen', 'goerlitz', 'augusto'] },
  { titel: 'Clubs, Hallen und Vereine', schluessel: ['aust', 'neustadthalle', 'l2club', 'steinhaus', 'gefluegel'] },
  { titel: 'Ticketverkauf', schluessel: ['ticketmaster'] },
  { titel: 'Tschechien', schluessel: ['idecin', 'goout'] },
];

function el(doc, tag, klasse, text) {
  const e = doc.createElement(tag);
  if (klasse) e.setAttribute('class', klasse);
  if (text != null) e.textContent = text;
  return e;
}

function link(doc, text, href) {
  const a = el(doc, 'a', null, text);
  a.setAttribute('href', href);
  if (/^https?:/i.test(href)) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
  return a;
}

/** Ein aufklappbarer Abschnitt (details/summary: geht ohne Skript und ist mit Tastatur und Vorlesehilfe bedienbar). */
function abschnitt(doc, titel, offen = false) {
  const d = el(doc, 'details', 'abschnitt');
  if (offen) d.setAttribute('open', '');
  d.append(el(doc, 'summary', null, titel));
  const inhalt = el(doc, 'div', 'abschnitt-inhalt');
  d.append(inhalt);
  return { d, inhalt };
}

/** "10.11.2026" aus einem ISO-Zeitpunkt; ungültige Angaben ergeben null. */
function datumVon(iso) {
  const t = Date.parse(iso ?? '');
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(t);
}

/** "Version 1.4.0 (ec29751) · gebaut am 10.11.2026"; ohne Angaben entfällt die Zeile. */
export function versionsZeile(info) {
  if (!info?.version) return null;
  const teile = [`Version ${info.version}${info.commit ? ` (${info.commit})` : ''}`];
  const datum = datumVon(info.gebaut);
  if (datum) teile.push(`gebaut am ${datum}`);
  return teile.join(' · ');
}

function quelleEintrag(doc, q) {
  const punkt = el(doc, 'li');
  punkt.append(el(doc, 'strong', null, q.name), ' – ', q.hinweis, ' ');
  q.links.forEach((l, i) => {
    if (i) punkt.append(', ');
    punkt.append(link(doc, l.text, l.url));
  });
  return punkt;
}

/**
 * Der Inhalt des Fensters "Über Bühnenlicht", in aufklappbaren Abschnitten; nur "Wofür" ist beim Öffnen aufgeklappt.
 * @param {{kontaktMail?: string|null, version?: {version:string, commit?:string|null, gebaut?:string}|null}} [optionen]
 *   kontaktMail: Adresse für Rückfragen und Löschwünsche; ohne sie entfällt die Zeile.
 *   version: Angaben aus data/version.json; ohne sie entfällt die Versionszeile.
 */
export function renderUeber(doc, optionen = {}) {
  const mail = optionen.kontaktMail === undefined ? KONTAKT_MAIL : optionen.kontaktMail;
  const wurzel = el(doc, 'div', 'ueber');

  const wofuer = abschnitt(doc, 'Wofür', true);
  wofuer.inhalt.append(
    el(doc, 'p', null, 'Bühnenlicht sammelt Konzerte, Feste, Märkte und Partys aus Ostsachsen und Umgebung an einem Ort. '
      + 'Es ist ein privates Projekt ohne Werbung und ohne Gewinn, gedacht für Familie, Freunde und den Heimatverein. '
      + 'Die Termine werden einmal täglich neu geholt. Bitte den Link nicht weitergeben.'),
    el(doc, 'p', null, 'Mit den Filtern (Zeitraum, Ort und Umkreis, Art, Sorte) und der Suche lässt sich die Liste Schritt für Schritt eingrenzen, bis nur noch passende Termine übrig sind.'),
    el(doc, 'p', null, 'Ein Klick oder Tipp auf einen Termin öffnet die Einzelheiten mit der ganzen Beschreibung und weiteren Knöpfen: '
      + 'zur Webseite, Tickets bestellen, anrufen, E-Mail schreiben und Navigation zum Veranstaltungsort.'),
  );

  const quellen = abschnitt(doc, `Woher die Termine kommen (${QUELLEN.length} Quellen)`);
  const nachSchluessel = new Map(QUELLEN.map((q) => [q.schluessel, q]));
  const gruppiert = new Set();
  for (const gruppe of GRUPPEN) {
    const eintraege = gruppe.schluessel.map((s) => nachSchluessel.get(s)).filter(Boolean);
    if (!eintraege.length) continue;
    eintraege.forEach((q) => gruppiert.add(q.schluessel));
    const liste = el(doc, 'ul', 'quellenliste');
    eintraege.forEach((q) => liste.append(quelleEintrag(doc, q)));
    quellen.inhalt.append(el(doc, 'h4', null, gruppe.titel), liste);
    if (gruppe.schluessel.includes('idecin')) {
      const uebersetzung = el(doc, 'p', 'klein', 'Texte aus Tschechien werden maschinell mit ');
      uebersetzung.append(
        link(doc, 'DeepL', 'https://www.deepl.com'),
        ' ins Deutsche übersetzt und können Fehler enthalten. Der tschechische Originaltitel steht dann am Anfang der Beschreibung.',
      );
      quellen.inhalt.append(uebersetzung);
    }
  }
  // Eine Quelle, die in keiner Gruppe steht, soll trotzdem sichtbar sein.
  const uebrige = QUELLEN.filter((q) => !gruppiert.has(q.schluessel));
  if (uebrige.length) {
    const liste = el(doc, 'ul', 'quellenliste');
    uebrige.forEach((q) => liste.append(quelleEintrag(doc, q)));
    quellen.inhalt.append(el(doc, 'h4', null, 'Weitere'), liste);
  }
  quellen.inhalt.append(
    el(doc, 'p', 'klein', 'Übernommen werden Titel, Zeit, Ort und eine kurze Beschreibung, keine Bilder. Jeder Eintrag führt zur Seite des Anbieters. '
      + 'Wo die Erlaubnis noch nicht vorliegt, ist sie angefragt; bei einem Nein wird die Quelle abgeschaltet.'),
  );

  const lizenzen = abschnitt(doc, 'Lizenzen');
  const cc = el(doc, 'p', null, 'Termine aus den offenen Tourismusdaten Sachsen stehen je Termin unter CC0 1.0, CC BY 4.0 oder ');
  cc.append(
    link(doc, 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.de'),
    '; Lizenz und Urheber stehen im Detailfenster des Termins. Bei CC BY-SA 4.0 gilt die Namensnennung: Touristinformation Sebnitz u. a.',
  );
  const schriften = el(doc, 'p', null, 'Schriften: Barlow Condensed (Jeremy Tribby) und Inter (Rasmus Andersson), beide unter der SIL Open Font License 1.1 (');
  schriften.append(link(doc, 'openfontlicense.org', 'https://openfontlicense.org'), ').');
  lizenzen.inhalt.append(cc, schriften);

  const tm = el(doc, 'p', null, 'Ticketmaster-Termine kommen über die Schnittstelle von Ticketmaster. Wer etwas davon entfernt haben möchte, '
    + 'meldet sich; es wird binnen 24 Stunden entfernt. Beim Klick auf „Tickets“ gilt die ');
  tm.append(link(doc, 'Datenschutzerklärung von Ticketmaster', 'https://privacy.ticketmaster.de/de/privacy-policy#privacy-notice'), '.');
  const datenschutz = abschnitt(doc, 'Datenschutz');
  datenschutz.inhalt.append(
    el(doc, 'p', null, 'Die Seite setzt keine Cookies und keine Zähler. Auf dem Gerät werden nur deine Einstellungen (Suche, Filter, Design) und die zuletzt geladenen Termine gemerkt.'),
    tm,
  );

  const kontaktAbschnitt = abschnitt(doc, 'Kontakt');
  const kontakt = el(doc, 'p');
  if (mail) {
    kontakt.append('Rückfragen und Löschwünsche: ', link(doc, mail, `mailto:${mail}`), '.');
  } else {
    kontakt.append('Rückfragen und Löschwünsche bitte an die Person, von der du den Link bekommen hast.');
  }
  kontaktAbschnitt.inhalt.append(kontakt);

  wurzel.append(wofuer.d, quellen.d, lizenzen.d, datenschutz.d, kontaktAbschnitt.d);

  const fuss = el(doc, 'p', 'klein fussnote', 'Bühnenlicht – von Matthias B.');
  const zeile = versionsZeile(optionen.version);
  if (zeile) fuss.append(el(doc, 'br'), el(doc, 'span', 'versionszeile', zeile));
  wurzel.append(fuss);
  return wurzel;
}
