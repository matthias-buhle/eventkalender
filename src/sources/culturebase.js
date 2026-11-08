// Gemeinsame Logik für Kalender im CultureBase-Format (Görlitz, Augusto):
// Seitenweise JSON mit einer Zeile je Termin ("EventDates"), Zeitraum des ganzen Laufs in DateFromTo.
import { makeEvent } from '../model.js';
import { resolvePlace } from '../geo.js';
import { berlinIso } from '../time.js';
import { cleanText, detectStatus, normalizeArt, normalizePhone, shorten } from '../normalize.js';

const MONATE = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

/** Kategorien, bei denen eine lange Spielzeit aus einzelnen Terminen mit Uhrzeit besteht (Aufführung statt Dauerangebot). */
const AUFFUEHRUNG = /auff[üu]hrung|konzert|theater|musik|kabarett|comedy|party|markt|fest|tanz|lesung|kino|film|show|revue|oper|ballett|musical|klassik|chor/i;

export function plusTage(tag, tage) {
  const d = new Date(`${tag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

function tagAusText(text) {
  const m = /(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)(?:\s+(\d{4}))?/.exec(text);
  const monat = m && MONATE[m[2].toLowerCase()];
  return monat ? { tag: Number(m[1]), monat, jahr: m[3] ? Number(m[3]) : null } : null;
}

/**
 * Liest "11. September - 15. November 2026" oder "08. November 2026" und gibt die Zahl der Kalendertage des Laufs zurück.
 * Nicht lesbar → 1, damit nichts Unklares verworfen wird.
 */
export function laufTage(dateFromTo) {
  const teile = String(dateFromTo ?? '').split(/\s+-\s+/);
  const bis = tagAusText(teile[teile.length - 1]);
  if (!bis?.jahr) return 1;
  const von = teile.length > 1 ? tagAusText(teile[0]) : bis;
  if (!von) return 1;
  const ms = (t, jahr) => Date.UTC(jahr, t.monat - 1, t.tag);
  const ende = ms(bis, bis.jahr);
  let start = ms(von, von.jahr ?? bis.jahr);
  if (start > ende && !von.jahr) start = ms(von, bis.jahr - 1);
  return Math.max(1, Math.round((ende - start) / 86400000) + 1);
}

/** Märkte, Feste und Schauen dürfen bis zu sechs Wochen laufen (Weihnachtsmärkte); sie werden ein Termin. */
const MEHRTAEGIG_MAX_TAGE = 45;
const MEHRTAEGIG_ARTEN = ['markt', 'fest', 'schau'];

const lauf = (row) => (row.Production1 ?? row.Production)?.DateFromTo;
const kategorie = (row) => `${row.FormalCategoryName ?? ''} ${row.ContentCategoryName ?? ''}`.trim();

/** "2026-11-08T10:00:00+0100" → Tag und Uhrzeit; der Offset der Quelle wird durch den Berliner ersetzt. */
function zeitteile(row) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(row.DateTime ?? '');
  return m ? { tag: m[1], zeit: m[2] } : null;
}

/** Dauerangebote (Ausstellungen über 2 Tage, Läufe über 14 Tage ohne Aufführungscharakter) sind keine Veranstaltung. */
export function behalten(row) {
  const t = zeitteile(row);
  if (!t || !row.Title) return false;
  const tage = laufTage(lauf(row));
  const kat = kategorie(row);
  if (/ausstellung/i.test(kat) && tage > 2) return false;
  const mehrtaegig = MEHRTAEGIG_ARTEN.includes(normalizeArt(kat, row.Title));
  if (mehrtaegig && tage <= MEHRTAEGIG_MAX_TAGE) return true;
  if (tage > 14 && (t.zeit === '00:00' || !AUFFUEHRUNG.test(kat))) return false;
  return true;
}

/**
 * Holt alle Seiten, bis eine leer ist, die letzte erreicht wird oder maxPages gelesen sind.
 * @returns {Promise<object[]>} alle Zeilen
 */
export async function holeZeilen({ http, urlFuerSeite, maxPages }) {
  const zeilen = [];
  for (let seite = 1; seite <= maxPages; seite++) {
    const { body } = await http.get(urlFuerSeite(seite), { as: 'json' });
    const rows = body?.EventDates ?? [];
    if (!rows.length) break;
    zeilen.push(...rows);
    if (body.Pager?.IsLastPage === true) break;
  }
  return zeilen;
}

/**
 * Wandelt Zeilen in Events. Mehrtägige Märkte/Feste/Schauen (2–45 Tage, gleiche Uhrzeit) werden ein Termin
 * von der ersten bis zur letzten Zeile; alle anderen Zeilen bleiben einzelne Termine.
 * @param {object[]} zeilen
 * @param {{quelle:string, linkFuer:(row:object)=>string, fallbackPlace?:string}} opt
 * `fallbackPlace`: Region der Quelle; die Zeilen nennen nur die Spielstätte, nicht die Stadt.
 */
export function zuEvents(zeilen, { quelle, linkFuer, fallbackPlace }) {
  const gruppen = new Map();
  const einzeln = [];
  for (const row of zeilen.filter(behalten)) {
    const tage = laufTage(lauf(row));
    const art = normalizeArt(kategorie(row), row.Title);
    if (tage >= 2 && tage <= MEHRTAEGIG_MAX_TAGE && MEHRTAEGIG_ARTEN.includes(art)) {
      const key = [row.Title, row.LocationName, lauf(row), zeitteile(row).zeit].join('|');
      if (!gruppen.has(key)) gruppen.set(key, []);
      gruppen.get(key).push(row);
    } else {
      einzeln.push([row]);
    }
  }
  return [...einzeln, ...gruppen.values()].map((rows) => zuEvent(rows, { quelle, linkFuer, fallbackPlace }));
}

/** Spielstätte und, wenn sie sich nicht selbst einem Ort zuordnen lässt, Koordinaten der Region der Quelle. */
function ortVon(row, fallbackPlace) {
  const spielstaette = cleanText(row.LocationName);
  const region = fallbackPlace && !resolvePlace(spielstaette) ? resolvePlace(fallbackPlace) : null;
  if (!region) return { placeName: spielstaette };
  return { placeName: spielstaette ? `${spielstaette}, Raum ${region.name}` : `Raum ${region.name}`, lat: region.lat, lon: region.lon, country: region.country };
}

function zuEvent(rows, { quelle, linkFuer, fallbackPlace }) {
  rows.sort((a, b) => a.DateTime.localeCompare(b.DateTime));
  const erste = rows[0];
  const letzte = rows[rows.length - 1];
  const a = zeitteile(erste);
  const mitZeit = a.zeit !== '00:00';
  const b = zeitteile(letzte);
  const text = cleanText(erste.DescriptionTruncated);
  const veranstalter = erste.Url ? erste.Url.trim() : '';
  return makeEvent({
    sourceName: quelle,
    sourceId: String(erste.Id),
    sourceUrl: linkFuer(erste),
    title: cleanText(erste.Title),
    art: normalizeArt(kategorie(erste), erste.Title),
    start: berlinIso(a.tag, mitZeit ? a.zeit : null),
    end: rows.length > 1 ? berlinIso(b.tag, b.zeit === '00:00' ? null : b.zeit) : null,
    hasTime: mitZeit,
    ...ortVon(erste, fallbackPlace),
    contact: { phone: normalizePhone(text), url: veranstalter || null },
    ticketStatus: detectStatus(`${erste.Title} ${text}`),
    description: shorten(text, 300) || null,
  });
}
