import { makeEvent } from '../model.js';
import { berlinIsoAt, plusTage } from '../time.js';
import { cleanText, normalizeArt } from '../normalize.js';

export const name = 'varnsdorf';

const QUELLE = 'Varnsdorf – varnsdorf.cz';
const STANDARD_URL = 'https://www.varnsdorf.cz/rest/public/event-calendar/events';
const KALENDER_URL = 'https://www.varnsdorf.cz/cz/volny-cas/kalendar-akci/';
const TERMIN_URL = 'https://www.varnsdorf.cz/cz/volny-cas/kalendar-akci/kalendar-udalosti.html';

// Zusage an die Stadt (Hinweis-Mail vom 24.11.2026): nur Titel, Datum und Uhrzeit, Ort, Link.
// Keine Bilder (galleryPhotos u. a.) und keine Beschreibungstexte (popis); description bleibt null.

/** Titelwörter, die stärker sind als die Kategorie ("Rozsvícení vánočního stromu" steht unter "trh"). */
const FEST_TITEL = /festival|slavnost|rozsv[ií]cen[ií]|masopust|\bpou[tť]/i;
/** Kategorienamen der Stadt (akatg3Name) → Art. Theater, Vorträge, Sport u. a. bleiben "sonstiges". */
const ART_NACH_KATEGORIE = [
  ['konzert', /koncert|hudb/i],
  ['markt', /jarmark|\btrh|bazar/i],
  ['schau', /v[yý]stava|vernis[aá][zž]/i],
  ['party', /\bples\b|party|diskot[eé]ka|z[aá]bava/i],
  ['fest', /festival|slavnost|pou[tť]/i],
];
const ART_NACH_TITEL = [
  ['konzert', /koncert|jam session|kapela|recit[aá]l|orchestr|\bsbor/i],
  ['markt', /jarmark|\btrh|ble[sš][ií]/i],
  ['schau', /v[yý]stava|vernis[aá][zž]/i],
  ['party', /\bparty\b|diskot[eé]ka|\bples\b/i],
];

function artVon(kategorie, titel) {
  if (FEST_TITEL.test(titel)) return 'fest';
  for (const [art, regel] of ART_NACH_KATEGORIE) if (regel.test(kategorie)) return art;
  for (const [art, regel] of ART_NACH_TITEL) if (regel.test(titel)) return art;
  return normalizeArt(kategorie, titel);
}

const zeitpunkt = (wert) => {
  const n = Number(wert);
  return Number.isFinite(n) && n > 0 ? berlinIsoAt(n) : null;
};

/** 'JJJJ-MM-TT' → 'TT.MM.JJJJ', wie es die Schnittstelle in der Anfrage verlangt. */
const datumFuerAnfrage = (tag) => tag.split('-').reverse().join('.');

const koordinate = (wert) => {
  const n = parseFloat(wert);
  return Number.isFinite(n) ? n : null;
};

/**
 * Ort aus den Daten: `misto` (genauer Ort) vor dem Namen der Einrichtung ("Ostatní" = sonstige, kein Name).
 * "Varnsdorf" (facilityCity) kommt dazu, wenn es der Ortsname nicht schon nennt; ohne Stadt in den Daten bleibt der Ort wie er ist.
 */
function ortVon(roh) {
  const misto = cleanText(roh.misto);
  const einrichtung = cleanText(roh.facilityName);
  const stadt = cleanText(roh.facilityCity);
  const ort = misto || (/^ostatn[ií]$/i.test(einrichtung) ? '' : einrichtung);
  if (!ort) return stadt || 'Varnsdorf';
  if (!stadt || ort.toLowerCase().includes(stadt.toLowerCase())) return ort;
  return `${ort}, ${stadt}`;
}

function zuEvent(roh) {
  const titel = cleanText(roh.nazev);
  const start = zeitpunkt(roh.startDate ?? roh.datumOd);
  if (!titel || !start) return null;
  const endeRoh = zeitpunkt(roh.endDate ?? roh.datumDo);
  // Ein Ende um 23:59 ist ein Platzhalter ("bis Tagesende"), kein echtes Ende.
  const ende = endeRoh && endeRoh > start && endeRoh.slice(11, 16) !== '23:59' ? endeRoh : null;
  const hatId = roh.id !== undefined && roh.id !== null && roh.id !== '';
  const url = hatId ? `${TERMIN_URL}?detail=true&id=${encodeURIComponent(roh.id)}` : KALENDER_URL;
  return makeEvent({
    sourceName: QUELLE,
    sourceId: hatId ? String(roh.id) : `${titel}|${start}`,
    sourceUrl: url,
    title: titel,
    art: artVon(cleanText(roh.akatg3Name), titel),
    start,
    end: ende,
    hasTime: start.slice(11, 16) !== '00:00',
    placeName: ortVon(roh),
    lat: koordinate(roh.facilityGpsLat),
    lon: koordinate(roh.facilityGpsLon),
    country: 'CZ',
    sprache: 'cs',
    contact: { url },
    description: null,
  });
}

/**
 * Veranstaltungskalender der Stadt Varnsdorf (offene Schnittstelle): Termine von heute bis `horizonDays`
 * (Standard 90) Tage voraus, seitenweise (höchstens `maxPages`, Standard 5). Es werden nur Titel, Datum/Uhrzeit,
 * Ort und Link übernommen.
 */
export async function fetchEvents({ http, today, config = {} }) {
  const basis = config.url ?? STANDARD_URL;
  const pageSize = config.pageSize ?? 200;
  const maxPages = config.maxPages ?? 5;
  const von = datumFuerAnfrage(today);
  const bis = datumFuerAnfrage(plusTage(today, config.horizonDays ?? 90));

  const events = new Map();
  for (let seite = 0; seite < maxPages; seite++) {
    const url = `${basis}?datumOd=${von}&datumDo=${bis}&page=${seite}&pageSize=${pageSize}`;
    const { body } = await http.get(url, { as: 'json' });
    if (!Array.isArray(body?.events)) throw new Error('varnsdorf: Antwort ohne Terminliste');
    for (const roh of body.events) {
      const event = zuEvent(roh);
      if (event && !events.has(event.id)) events.set(event.id, event);
    }
    if (!body.hasNext || !body.events.length) break;
  }
  return [...events.values()];
}
