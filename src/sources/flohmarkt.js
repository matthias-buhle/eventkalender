import { makeEvent } from '../model.js';
import { berlinIso, berlinIsoAt, plusTage } from '../time.js';
import { cleanText, detectStatus, shorten } from '../normalize.js';

export const name = 'flohmarkt';

const QUELLE = 'flohmarkt-sachsen.de';

/** Entfernt die Faltung: eine Fortsetzungszeile beginnt mit genau einem Leerzeichen oder Tabulator. */
function entfalten(text) {
  return text.replace(/\r?\n[ \t]/g, '');
}

/** Löst die iCal-Escape-Zeichen (\n, \, \; \\) auf. */
function entschluesseln(wert) {
  return wert.replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Liest eine Zeile "NAME;PARAM=x:Wert" in Name, Parameter und Wert; der erste Doppelpunkt außerhalb von Anführungszeichen trennt. */
function leseZeile(zeile) {
  let inAnfuehrung = false;
  let trenner = -1;
  for (let i = 0; i < zeile.length; i += 1) {
    const c = zeile[i];
    if (c === '"') inAnfuehrung = !inAnfuehrung;
    else if (c === ':' && !inAnfuehrung) { trenner = i; break; }
  }
  if (trenner < 0) return null;
  const [kopf, ...paramTeile] = zeile.slice(0, trenner).split(';');
  const params = {};
  for (const p of paramTeile) {
    const gleich = p.indexOf('=');
    if (gleich > 0) params[p.slice(0, gleich).toUpperCase()] = p.slice(gleich + 1).replace(/^"|"$/g, '');
  }
  return { name: kopf.toUpperCase(), params, wert: zeile.slice(trenner + 1) };
}

/** Liest alle VEVENT-Blöcke (ohne die Zeitzonenangaben im VTIMEZONE) als { FELD: { params, wert } }. */
export function leseIcal(text) {
  const ereignisse = [];
  let aktuell = null;
  for (const zeile of entfalten(String(text ?? '')).split(/\r?\n/)) {
    if (/^BEGIN:VEVENT\s*$/i.test(zeile)) { aktuell = {}; continue; }
    if (/^END:VEVENT\s*$/i.test(zeile)) { if (aktuell) ereignisse.push(aktuell); aktuell = null; continue; }
    if (!aktuell) continue;
    const feld = leseZeile(zeile);
    if (feld && !(feld.name in aktuell)) aktuell[feld.name] = feld;
  }
  return ereignisse;
}

/**
 * Wandelt DTSTART/DTEND in { tag, zeit, iso }. Ohne Uhrzeit (VALUE=DATE) ist zeit null; mit "Z" ist es UTC und wird
 * zur Berliner Zeit; mit TZID=Europe/Berlin oder ohne Angabe gilt die Uhrzeit als Berliner Ortszeit.
 */
function leseZeit(feld) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(feld?.wert?.trim() ?? '');
  if (!m) return null;
  const tag = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] === undefined) return { tag, zeit: null, iso: berlinIso(tag, null) };
  if (m[7]) {
    const iso = berlinIsoAt(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return { tag: iso.slice(0, 10), zeit: iso.slice(11, 16), iso };
  }
  const zeit = `${m[4]}:${m[5]}`;
  return { tag, zeit, iso: berlinIso(tag, zeit) };
}

function text(feld) {
  return feld ? cleanText(entschluesseln(feld.wert)) : '';
}

function zuEvent(roh, feedUrl) {
  const titel = text(roh.SUMMARY);
  const start = leseZeit(roh.DTSTART);
  if (!titel || !start) return null;
  const ende = leseZeit(roh.DTEND);
  let endIso = null;
  if (ende) {
    if (start.zeit === null) {
      // Bei Ganztagstagen ist DTEND der Folgetag (exklusiv): das Ende ist der letzte volle Tag.
      const letzter = plusTage(ende.tag, -1);
      if (letzter > start.tag) endIso = berlinIso(letzter, null);
    } else if (ende.iso > start.iso) {
      endIso = ende.iso;
    }
  }
  const url = roh.URL?.wert?.trim() || feedUrl;
  const uid = roh.UID?.wert?.trim() || `${url}#${start.iso}`;
  const beschreibung = text(roh.DESCRIPTION);
  return makeEvent({
    sourceName: QUELLE,
    sourceId: uid,
    sourceUrl: url,
    title: titel,
    art: 'markt',
    start: start.iso,
    end: endIso,
    hasTime: start.zeit !== null,
    // wie geliefert ("Neustädter Markthalle, Metzer Str. 1, Dresden, Sachsen, 01097, Deutschland"); die Verortung folgt später
    placeName: text(roh.LOCATION),
    contact: { url },
    ticketStatus: /^CANCELLED$/i.test(roh.STATUS?.wert?.trim() ?? '') ? 'abgesagt' : detectStatus(titel),
    description: shorten(beschreibung, 300) || null,
  });
}

/**
 * Markt- und Flohmarkttermine von flohmarkt-sachsen.de (DDV Sachsen) aus dem Sammelkalender (iCal, ein Abruf).
 * Der Feed endet bei 50 Terminen; weiter in die Zukunft reicht er nicht.
 */
export async function fetchEvents({ http, today, config }) {
  const { body } = await http.get(config.url, { as: 'text' });
  const roh = leseIcal(body);
  if (!roh.length) throw new Error('flohmarkt: keine Termine im iCal-Feed gefunden');
  const bekannt = new Set();
  const events = [];
  for (const r of roh) {
    const e = zuEvent(r, config.url);
    if (!e || bekannt.has(e.id)) continue;
    bekannt.add(e.id);
    if ((e.end ?? e.start).slice(0, 10) >= today) events.push(e);
  }
  return events;
}
