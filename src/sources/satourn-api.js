import { makeEvent } from '../model.js';
import { berlinIso, imFenster, plusTage } from '../time.js';
import { CENTER, RADIUS_KM } from '../geo.js';
import { cleanText, detectStatus, normalizeArt, normalizePhone, shorten } from '../normalize.js';

const QUELLE = 'Tourismus Sachsen (Open Data)';

// Nur diese drei Lizenzen sind offen genug, um Termine zu übernehmen; alles andere wird übersprungen.
const LIZENZEN = {
  'https://creativecommons.org/licenses/by-sa/4.0/': 'CC BY-SA 4.0',
  'https://creativecommons.org/licenses/by/4.0/': 'CC BY 4.0',
  'https://creativecommons.org/publicdomain/zero/1.0/': 'CC0 1.0',
};

// Art aus dem Typ-Array der API (letztes Stück der Adresse); sonst entscheidet der Titel.
const TYP_ART = {
  TemporaryExhibition: 'schau',
  ChristmasMarket: 'markt',
  RegionalMarket: 'markt',
  HistoricalMarket: 'markt',
  MusicEvent: 'konzert',
  Party: 'party',
  DanceShow: 'party',
  Funfair: 'fest',
};

const liste = (wert) => (wert === undefined || wert === null ? [] : [].concat(wert));
const text = (wert) => (typeof wert === 'string' ? wert.trim() : '');
const zahl = (wert) => (wert === null || wert === undefined || wert === '' || !Number.isFinite(Number(wert)) ? null : Number(wert));

function lizenzAus(roh, urheber) {
  const adresse = text(roh);
  const schluessel = adresse.endsWith('/') ? adresse : `${adresse}/`;
  if (!Object.hasOwn(LIZENZEN, schluessel)) return null;
  return { name: LIZENZEN[schluessel], url: `${schluessel}deed.de`, urheber: urheber || null };
}

function artAus(typen, titel) {
  for (const typ of liste(typen)) {
    const art = TYP_ART[String(typ).split('/').pop()];
    if (art) return art;
  }
  return normalizeArt('', titel);
}

function zuEvent(e, config) {
  const titel = cleanText(e.name);
  const start = text(e.startDate);
  if (!titel || !start) return null;
  const urheber = e.author ?? {};
  const lizenz = lizenzAus(e.license, text(urheber.name));
  if (!lizenz) return null;

  const ort = liste(e.location)[0] ?? {};
  const beschreibung = cleanText(e.description);
  const kennung = text(liste(e.identifier)[0]) || titel;
  const quelle = [e.url, urheber.url].map(text).find((u) => /^https?:\/\//.test(u)) ?? config.fallbackUrl;

  return makeEvent({
    sourceName: QUELLE,
    sourceId: `${kennung}:${start}`,
    sourceUrl: quelle,
    title: titel,
    art: artAus(e['@type'], titel),
    start,
    end: text(e.endDate) || null,
    hasTime: !/T00:00:00/.test(start),
    placeName: [text(ort.name), text(ort.address?.addressLocality)].filter(Boolean).join(', '),
    lat: zahl(ort.geo?.latitude),
    lon: zahl(ort.geo?.longitude),
    contact: { phone: normalizePhone(urheber.telephone), url: text(urheber.url) || null, email: text(urheber.email) || null },
    ticketUrl: text(liste(e.offers)[0]?.url) || null,
    ticketStatus: detectStatus(`${titel} ${beschreibung.slice(0, 160)}`),
    description: shorten(beschreibung, 300) || null,
    lizenz,
  });
}

/**
 * SaTourN-Open-Data-API (Tourismus Sachsen): ein Abruf je Lauf für den Umkreis um Sebnitz.
 * Jeder Eintrag ist ein einzelner Termin; das Zeitfenster filtert der Adapter selbst, weil die API
 * alle Termine eines gewählten Datensatzes liefert.
 */
export async function fetchApiEvents({ http, today, config }) {
  const letzterTag = plusTage(today, config.horizonDays ?? 90);
  const url = new URL(config.apiUrl);
  url.search = new URLSearchParams({
    experience: config.experience,
    type: 'Event',
    template: 'schemaorg',
    limit: String(config.limit),
    distance: String(RADIUS_KM * 1000),
    latitude: String(CENTER.lat),
    longitude: String(CENTER.lon),
    startdate: berlinIso(today, null),
    enddate: berlinIso(letzterTag, '23:59'),
  }).toString();

  const { body } = await http.get(url.href, { as: 'json' });
  if (!Array.isArray(body)) throw new Error('SaTourN-API: Antwort ist kein Array');

  // Fast so viele verschiedene Datensätze wie das Limit: die Antwort ist vermutlich abgeschnitten.
  const datensaetze = new Set(body.map((e) => liste(e?.identifier)[0] ?? e?.name));
  if (datensaetze.size >= Math.floor(config.limit * 0.9)) {
    throw new Error(`SaTourN-API: ${datensaetze.size} Datensätze nahe am limit ${config.limit}, Antwort vermutlich unvollständig`);
  }

  return body
    .filter((e) => e && typeof e === 'object' && typeof e.startDate === 'string' && imFenster(e.startDate, e.endDate ?? null, today, letzterTag))
    .map((e) => zuEvent(e, config))
    .filter(Boolean);
}
