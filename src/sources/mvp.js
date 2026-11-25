import * as cheerio from 'cheerio';
import { extractSchemaEvents } from '../schemaorg.js';
import { makeEvent } from '../model.js';
import { berlinIso, berlinIsoAt, plusTage } from '../time.js';
import { cleanText } from '../normalize.js';
import { rubrikUndGenre } from '../rubriken.js';

export const name = 'mvp';

/**
 * mvp.de (MANET Marketing GmbH). Der Betreiber hat den Abruf für diesen privaten, nicht öffentlich zugänglichen Kalender
 * (höchstens 35 Personen) am 09. und 25.11.2026 schriftlich geduldet: Dresden und Umgebung, die Kategorien Party und
 * Konzerte sowie Theater, Tanz, Zirkus, Kino, Lesung, Kurs und Kinder, einmal täglich, mit Pausen und geringer Last.
 * Übernommen werden NUR Titel, Datum, Uhrzeit, Ort, der Link zur Veranstaltung auf mvp.de und der Ticketlink.
 * Keine Beschreibungstexte (description bleibt null), keine Fotos. Bei spürbarer Last behält sich mvp.de eine Sperre vor.
 */
const QUELLE = 'mvp.de';
const BASIS = 'https://www.mvp.de/dresden/veranstaltungen/';

/** Die Kategorieseiten für Dresden und Umgebung (nur die zugesagten Kategorien). */
const LISTEN = [
  'tanzevents-partys-discotheken',
  'konzerte',
  'theater-buehne-comedy-musicals',
  'tanz-ballett-events',
  'zirkus-variete-artistik',
  'kinos-filmvorfuehrungen',
  'lesungen-vortraege',
  'seminare-kurse-workshops',
  'veranstaltung-fuer-kinder',
].map((pfad) => `${BASIS}${pfad}/`);

/** Die Kategorie hinter dem Pfad der Liste, falls die Karte selbst keine der Kategorien nennt. */
const LISTEN_FAMILIE = {
  'tanzevents-partys-discotheken': 'party',
  konzerte: 'konzert',
  'theater-buehne-comedy-musicals': 'theater',
  'tanz-ballett-events': 'tanz',
  'zirkus-variete-artistik': 'zirkus',
  'kinos-filmvorfuehrungen': 'kino',
  'lesungen-vortraege': 'lesung',
  'seminare-kurse-workshops': 'kurs',
  'veranstaltung-fuer-kinder': 'kinder',
};

/** Kategoriebeschriftungen auf den Karten ("Konzert - Rock & Pop", "Tanz / Party & Disco" …) → Kategorie. */
const BESCHRIFTUNGEN = [
  ['konzert', /konzert - |volksmusik & schlager/i],
  ['party', /tanz \/ party|electro \/ techno/i],
  ['tanz', /tanz & ballett/i],
  ['theater', /theater, musical/i],
  ['zirkus', /zirkus/i],
  ['kino', /kino, film/i],
  ['lesung', /lesung, vortrag/i],
  ['kurs', /seminar, kurs/i],
  ['kinder', /kinderfreundlich/i],
];
const BUEHNE = ['theater', 'tanz', 'zirkus', 'kino', 'lesung'];
/** Karten, die nur Führungen, Rundfahrten oder Touren sind, gehören nicht zur Zusage. */
const FUEHRUNG = /f[uü]hrung|rundfahrt|aktiv \/ natur/i;

/** Die Rubrik, in die Termine einer Kategorie gehören (Kategorie → erlaubte Rubriken von src/rubriken.js). */
const RUBRIK_ZIEL = {
  konzert: ['konzert', 'theater', 'kinder'],
  party: ['party'],
  theater: ['theater'],
  tanz: ['theater'],
  zirkus: ['theater'],
  kino: ['theater'],
  lesung: ['theater', 'kurse'],
  kurs: ['kurse'],
  kinder: ['kinder'],
};
/** Ein Wort, das src/rubriken.js im Titel erkennt; wird nur angehängt, wenn die Rubrik sonst nicht stimmt. */
const RUBRIK_WORT = {
  theater: 'Theater',
  tanz: 'Tanztheater',
  zirkus: 'Zirkus',
  kino: 'Kino',
  lesung: 'Lesung & Vortrag',
  kurs: 'Kurs',
  kinder: 'für Kinder',
};

/** Hinweis auf das Genre (Schlüssel aus GENRES in normalize.js) nach der Kategorie der Karte; ohne Treffer rät die Seite aus dem Titel. */
const GENRE_NACH_BESCHRIFTUNG = [
  ['metal-punk', /metal|hard rock|punk/i],
  ['jazz', /jazz|blues/i],
  ['hiphop-elektro', /hip-hop/i],
  ['klassik', /klassik/i],
  ['schlager-folk', /volksmusik|schlager|folk|country|weltmusik/i],
  ['rock-pop', /rock|pop|indie|alternative/i],
];

const SPERRE = new Set([403, 429]);
const fruehestens = (tag, heute) => (tag > heute ? tag : heute);

function familienVon(beschriftung) {
  const treffer = BESCHRIFTUNGEN.filter(([, regel]) => regel.test(beschriftung)).map(([familie]) => familie);
  return new Set(treffer);
}

/** Die eine Kategorie eines Termins; null, wenn er nicht zur Zusage gehört. */
function kategorieVon(karte) {
  const aus = familienVon(karte.beschriftung);
  const stark = [...aus].filter((f) => f !== 'lesung' && f !== 'kurs');
  if (FUEHRUNG.test(karte.beschriftung) && !stark.length) return null;
  if (!aus.size && karte.listenFamilie) aus.add(karte.listenFamilie);
  if (!aus.size) return null;
  const buehne = BUEHNE.find((f) => aus.has(f));
  return {
    familien: aus,
    kinder: aus.has('kinder'),
    art: aus.has('konzert') ? 'konzert' : (aus.has('party') && !buehne && !aus.has('kinder') ? 'party' : 'sonstiges'),
    buehne,
  };
}

function genreHinweis(art, beschriftung) {
  if (art === 'konzert') return GENRE_NACH_BESCHRIFTUNG.find(([, regel]) => regel.test(beschriftung))?.[0] ?? null;
  if (art === 'party') return /electro \/ techno/i.test(beschriftung) ? 'club' : null;
  return null;
}

/** Versalien ("REITHALLE STRASSE E") werden Wortanfang groß, Rest klein; gemischte Schreibung bleibt. */
function schreibweise(text) {
  if (/\p{Ll}/u.test(text)) return text;
  return text.replace(/\p{L}+/gu, (wort) => (wort.length <= 2 ? wort : wort[0] + wort.slice(1).toLowerCase()));
}

/** "Location, Stadt": Teile einzeln in Schreibweise bringen; nennt die Location die Stadt schon, entfällt sie. */
function ortsname(text, stadtVomPfad = null) {
  const teile = cleanText(text).split(/\s*,\s*/).filter(Boolean).map(schreibweise);
  if (stadtVomPfad && !teile.some((t) => t.toLowerCase().includes(stadtVomPfad.toLowerCase()))) teile.push(stadtVomPfad);
  const stadt = teile.at(-1)?.toLowerCase();
  if (teile.length > 1 && teile.slice(0, -1).some((t) => t.toLowerCase().includes(stadt))) teile.pop();
  return teile.join(', ');
}

/** Titel ohne den Zusatz " - DRESDEN" und ohne das veraltete Datum am Ende ("Vivaldi - 15.09.2027"): das Datum steht im Termin. */
const bereinigt = (titel) => {
  let t = titel;
  for (let alt = null; alt !== t;) { alt = t; t = t.replace(/\s+[-–]\s+(?:DRESDEN|\d{1,2}\.\d{1,2}\.\d{4})$/i, '').trim(); }
  return t;
};

/** Liest eine Listenseite: Karten (Titel, Link, Kategorien, Ort, Datum, Ticketlink) und den Link zur nächsten Seite. */
function leseListe(html, listUrl, listenFamilie) {
  const $ = cheerio.load(html);
  const karten = [];
  $('.abl-entry-wrapper').each((_, el) => {
    const karte = $(el);
    const a = karte.find('h2.abl-entry-name a[href]').first();
    const datum = karte.find('.date-hint-js').first();
    const start = /^\d{4}-\d{2}-\d{2}$/.test(datum.attr('data-start') ?? '') ? datum.attr('data-start') : null;
    const titel = bereinigt(cleanText(a.text()));
    if (!a.attr('href') || !titel || !start) return;
    const ende = /^\d{4}-\d{2}-\d{2}$/.test(datum.attr('data-end') ?? '') ? datum.attr('data-end') : start;
    const ticket = karte.find('a.ticket-button[href]').first().attr('href');
    karten.push({
      url: new URL(a.attr('href'), listUrl).href,
      titel,
      beschriftung: cleanText(karte.find('.abl-card-meta.category span').first().text()),
      ort: cleanText(karte.find('.abl-card-meta.location span').first().text()),
      start,
      ende,
      ticket: ticket ? new URL(ticket, listUrl).href : null,
      listenFamilie,
    });
  });
  const weiter = $('a.abl-next-js[href]').first().attr('href');
  return { karten, weiter: weiter ? new URL(weiter, listUrl).href : null };
}

const verfuegbarkeit = (offers) => {
  const werte = offers.map((o) => String(o.availability ?? ''));
  if (werte.some((w) => /InStock|LimitedAvailability/i.test(w))) return 'verfuegbar';
  if (werte.some((w) => /OutOfStock|SoldOut/i.test(w))) return 'ausverkauft';
  return null;
};

function terminStatus(raw) {
  const status = String(raw?.eventStatus ?? '');
  if (/Cancel/i.test(status)) return 'abgesagt';
  if (/Postponed|Rescheduled/i.test(status)) return 'verlegt';
  return null;
}

/**
 * Die Termine einer Einzelseite: je Termin ein schema.org-Event mit Beginn, Ort und Ticketlink (Beschreibung und Bild
 * bleiben unbeachtet). Fehlt das, dienen die Terminblöcke der Seite ("Beginn: 19:30 Uhr").
 */
function leseDetail(html) {
  const aus = extractSchemaEvents(html).filter((e) => e.startDate && /^\d{4}-\d{2}-\d{2}T/.test(e.startDate));
  if (aus.length) {
    return aus.map((e) => {
      const ms = Date.parse(e.startDate);
      const start = Number.isNaN(ms) ? null : berlinIsoAt(ms);
      return start && {
        titel: e.name ? bereinigt(cleanText(e.name)) : null,
        tag: start.slice(0, 10),
        start,
        hasTime: start.slice(11, 16) !== '00:00',
        ort: [e.location?.name, e.location?.locality].filter(Boolean).join(', ') || null,
        ticket: e.offers.find((o) => o.url)?.url ?? null,
        ticketStatus: terminStatus(e.raw) ?? verfuegbarkeit(e.offers),
      };
    }).filter(Boolean);
  }
  const $ = cheerio.load(html);
  return $('.event-date-js[data-ed-date]').map((_, el) => {
    const block = $(el);
    const tag = block.attr('data-ed-date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag ?? '')) return null;
    const zeit = /Beginn:\s*(\d{1,2}):(\d{2})/.exec(block.text());
    const ticket = block.find('a[data-action="contact.ticket.click"][href]').first().attr('href');
    return {
      titel: null,
      tag,
      start: berlinIso(tag, zeit ? `${zeit[1].padStart(2, '0')}:${zeit[2]}` : null),
      hasTime: Boolean(zeit),
      ort: null,
      ticket: ticket ?? null,
      ticketStatus: null,
    };
  }).get().filter(Boolean);
}

/** Hängt das Rubrikwort an den Titel, wenn src/rubriken.js den Termin sonst nicht in die Rubrik der Kategorie legen würde. */
function titelMitRubrik(titel, art, genre, ort, kat) {
  const gewuenscht = kat.kinder ? 'kinder' : (art === 'sonstiges' ? (kat.buehne ?? (kat.familien.has('kurs') ? 'kurs' : null)) : null);
  const ziel = kat.kinder ? RUBRIK_ZIEL.kinder : (gewuenscht ? RUBRIK_ZIEL[gewuenscht] : null);
  if (!ziel) return titel;
  const rubrikVon = (t) => rubrikUndGenre({ art, genre, title: t, description: null, placeName: ort }).rubrik;
  if (ziel.includes(rubrikVon(titel))) return titel;
  const wort = RUBRIK_WORT[kat.kinder ? 'kinder' : gewuenscht];
  const neu = `${titel} (${wort})`;
  return ziel.includes(rubrikVon(neu)) ? neu : titel;
}

function zuEvent(karte, kat, termin, doppelt) {
  const stadt = /^\/dresden\//.test(new URL(karte.url).pathname) ? 'Dresden' : null;
  const ort = termin.ort ? ortsname(termin.ort) : ortsname(karte.ort, stadt);
  const genre = kat.kinder && kat.art !== 'konzert' ? 'kinder-buehne' : genreHinweis(kat.art, karte.beschriftung);
  const titel = titelMitRubrik(termin.titel ?? karte.titel, kat.art, genre, ort, kat);
  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${karte.url}#${termin.tag}${doppelt ? `#${termin.start.slice(11, 16)}` : ''}`,
    sourceUrl: karte.url,
    title: titel,
    art: kat.art,
    genre,
    start: termin.start,
    hasTime: termin.hasTime,
    placeName: ort,
    contact: { url: karte.url },
    ticketUrl: termin.ticket ?? null,
    ticketStatus: termin.ticketStatus ?? null,
    description: null,
  });
}

/** Die Termine einer Karte im Fenster; ohne Einzelseite nur der Tag aus der Liste (ohne Uhrzeit). */
function termineVon(karte, einzelseite, heute, letzterTag) {
  const imFenster = (t) => t.tag >= heute && t.tag <= letzterTag;
  if (einzelseite?.length) return einzelseite.filter(imFenster);
  if (karte.start < heute || karte.start > letzterTag) return [];
  return [{ titel: null, tag: karte.start, start: berlinIso(karte.start, null), hasTime: false, ort: null, ticket: karte.ende === karte.start ? karte.ticket : null, ticketStatus: null }];
}

/**
 * mvp.de führt dasselbe Konzert oft unter mehreren Seiten mit gleichem Titel, Ort und Zeitraum ("Vivaldi" fünfmal).
 * Ohne Einzelseite ergibt jede dieser Karten einen Eintrag am Reihenbeginn ohne Uhrzeit. Hier bleibt je Titel, Ort und
 * Tag nur ein Eintrag je Beginn: Einträge ohne Uhrzeit entfallen, sobald derselbe Tag mit Uhrzeit vorkommt.
 */
function ohneDoppelte(events) {
  const tagKey = (e) => `${e.title.toLowerCase()}|${(e.placeName ?? '').toLowerCase()}|${e.start.slice(0, 10)}`;
  const mitZeit = new Set(events.filter((e) => e.hasTime).map(tagKey));
  const behalten = new Map();
  for (const e of events) {
    if (!e.hasTime && mitZeit.has(tagKey(e))) continue;
    const k = `${tagKey(e)}|${e.start}`;
    const da = behalten.get(k);
    if (!da) behalten.set(k, e);
    else if (!da.ticketUrl && e.ticketUrl) { da.ticketUrl = e.ticketUrl; da.ticketStatus ??= e.ticketStatus; }
  }
  return [...behalten.values()];
}

/**
 * Veranstaltungslisten von mvp.de für Dresden und Umgebung: je zugesagter Kategorie die Listenseiten (40 Karten je Seite,
 * nach Datum sortiert, bis der Horizont erreicht ist), danach für die nächstliegenden Veranstaltungen die Einzelseite
 * (Uhrzeit, alle Termine, Ticketlink). Mindestens `minDelayMs` Abstand; bei 403 oder 429 endet der Lauf sofort.
 * Höchstens `maxListPages` Listenseiten je Kategorie und `maxDetailPages` Einzelseiten je Lauf.
 */
export async function fetchEvents({ http, today, config }) {
  const letzterTag = plusTage(today, config.horizonDays ?? 45);
  const abstand = config.minDelayMs ?? 5000;
  const holen = (url) => http.get(url, { as: 'text', minDelayMs: abstand });
  let ersterFehler = null;
  let gesperrt = false;
  const merken = (fehler) => {
    ersterFehler ??= fehler;
    if (SPERRE.has(fehler?.status)) gesperrt = true;
  };

  const karten = new Map();
  for (const listUrl of config.listUrls ?? LISTEN) {
    const listenFamilie = LISTEN_FAMILIE[new URL(listUrl).pathname.split('/').filter(Boolean).at(-1)] ?? null;
    let url = listUrl;
    for (let seite = 0; url && seite < (config.maxListPages ?? 6); seite += 1) {
      let ergebnis;
      try {
        ergebnis = leseListe((await holen(url)).body, url, listenFamilie);
      } catch (fehler) {
        merken(fehler);
        break;
      }
      for (const k of ergebnis.karten) if (!karten.has(k.url)) karten.set(k.url, k);
      const letzte = ergebnis.karten.at(-1);
      const gleicheListe = ergebnis.weiter && new URL(ergebnis.weiter).pathname === new URL(listUrl).pathname;
      url = gleicheListe && letzte && letzte.start <= letzterTag ? ergebnis.weiter : null;
    }
    if (gesperrt) break;
  }

  const regionen = new Set(config.regionen ?? ['dresden', 'sachsen']);
  const kandidaten = [...karten.values()]
    .filter((k) => regionen.has(new URL(k.url).pathname.split('/')[1]))
    .map((k) => ({ karte: k, kat: kategorieVon(k) }))
    .filter(({ karte, kat }) => kat && karte.ende >= today && karte.start <= letzterTag)
    .sort((a, b) => fruehestens(a.karte.start, today).localeCompare(fruehestens(b.karte.start, today)) || a.karte.titel.localeCompare(b.karte.titel, 'de'));

  const einzelseiten = new Map();
  for (const { karte } of kandidaten.slice(0, config.maxDetailPages ?? 40)) {
    if (gesperrt) break;
    try {
      einzelseiten.set(karte.url, leseDetail((await holen(karte.url)).body));
    } catch (fehler) {
      merken(fehler); // der Termin bleibt mit den Angaben der Liste
    }
  }

  const events = [];
  for (const { karte, kat } of kandidaten) {
    const termine = termineVon(karte, einzelseiten.get(karte.url), today, letzterTag)
      .sort((a, b) => a.start.localeCompare(b.start));
    for (const [i, termin] of termine.entries()) {
      events.push(zuEvent(karte, kat, termin, termine.findIndex((t) => t.tag === termin.tag) !== i));
    }
  }
  if (!events.length && ersterFehler) throw ersterFehler;
  return ohneDoppelte(events);
}
