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
    name: 'Sebnitz und Sächsische Schweiz',
    hinweis: 'Termine der Touristinformation Sebnitz u. a. und des Tourismusverbands Sächsische Schweiz.',
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

const abschnitt = (doc, titel) => el(doc, 'h3', null, titel);

/**
 * Der Inhalt des Fensters "Über Bühnenlicht".
 * @param {{kontaktMail?: string|null}} [optionen] kontaktMail: Adresse für Rückfragen und Löschwünsche; ohne sie entfällt die Zeile
 */
export function renderUeber(doc, optionen = {}) {
  const mail = optionen.kontaktMail === undefined ? KONTAKT_MAIL : optionen.kontaktMail;
  const wurzel = el(doc, 'div', 'ueber');

  wurzel.append(
    abschnitt(doc, 'Wofür'),
    el(doc, 'p', null, 'Bühnenlicht sammelt Konzerte, Feste, Märkte und Partys aus Ostsachsen und Umgebung an einem Ort. '
      + 'Es ist ein privates Projekt ohne Werbung und ohne Gewinn, gedacht für Familie, Freunde und den Heimatverein. '
      + 'Die Termine werden einmal täglich neu geholt. Bitte den Link nicht weitergeben.'),
    el(doc, 'p', null, 'Mit den Filtern (Zeitraum, Ort und Umkreis, Art, Sorte) und der Suche lässt sich die Liste Schritt für Schritt eingrenzen, bis nur noch passende Termine übrig sind.'),
    el(doc, 'p', null, 'Ein Klick oder Tipp auf einen Termin öffnet die Einzelheiten mit der ganzen Beschreibung und weiteren Knöpfen: '
      + 'zur Webseite, Tickets bestellen, anrufen, E-Mail schreiben und Navigation zum Veranstaltungsort.'),
  );

  wurzel.append(abschnitt(doc, 'Woher die Termine kommen'));
  const liste = el(doc, 'ul', 'quellenliste');
  for (const q of QUELLEN) {
    const punkt = el(doc, 'li');
    punkt.append(el(doc, 'strong', null, q.name), ' – ', q.hinweis, ' ');
    q.links.forEach((l, i) => {
      if (i) punkt.append(', ');
      punkt.append(link(doc, l.text, l.url));
    });
    liste.append(punkt);
  }
  wurzel.append(
    liste,
    el(doc, 'p', 'klein', 'Übernommen werden Titel, Zeit, Ort und eine kurze Beschreibung, keine Bilder. Jeder Eintrag führt zur Seite des Anbieters. '
      + 'Wo die Erlaubnis noch nicht vorliegt, ist sie angefragt; bei einem Nein wird die Quelle abgeschaltet.'),
  );

  wurzel.append(abschnitt(doc, 'Lizenzen'));
  const cc = el(doc, 'p', null, 'Termine aus Sebnitz und der Sächsischen Schweiz stehen je Termin unter CC0 oder unter ');
  cc.append(
    link(doc, 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.de'),
    '. Bei CC BY-SA 4.0 gilt die Namensnennung: Touristinformation Sebnitz u. a.',
  );
  const schriften = el(doc, 'p', null, 'Schriften: Barlow Condensed (Jeremy Tribby) und Inter (Rasmus Andersson), beide unter der SIL Open Font License 1.1 (');
  schriften.append(link(doc, 'openfontlicense.org', 'https://openfontlicense.org'), ').');
  wurzel.append(cc, schriften);

  const tm = el(doc, 'p', null, 'Ticketmaster-Termine kommen über die Schnittstelle von Ticketmaster. Wer etwas davon entfernt haben möchte, '
    + 'meldet sich; es wird binnen 24 Stunden entfernt. Beim Klick auf „Tickets“ gilt die ');
  tm.append(link(doc, 'Datenschutzerklärung von Ticketmaster', 'https://privacy.ticketmaster.de/de/privacy-policy#privacy-notice'), '.');
  wurzel.append(
    abschnitt(doc, 'Datenschutz'),
    el(doc, 'p', null, 'Die Seite setzt keine Cookies und keine Zähler. Auf dem Gerät werden nur deine Einstellungen (Suche, Filter, Design) und die zuletzt geladenen Termine gemerkt.'),
    tm,
  );

  const kontakt = el(doc, 'p');
  if (mail) {
    kontakt.append('Rückfragen und Löschwünsche: ', link(doc, mail, `mailto:${mail}`), '.');
  } else {
    kontakt.append('Rückfragen und Löschwünsche bitte an die Person, von der du den Link bekommen hast.');
  }
  wurzel.append(abschnitt(doc, 'Kontakt'), kontakt, el(doc, 'p', 'klein', 'Bühnenlicht – von Matthias B.'));
  return wurzel;
}
