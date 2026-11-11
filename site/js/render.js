// Baut Karten und Fußzeile als DOM. Fremdwerte kommen ausschließlich über textContent und setAttribute hinein, nie über innerHTML.
import { sorteName } from './arten.js';
import { gemeindeVon, spielstaetteVon, plattform, navigationsLink } from './ort.js';

const ARTEN = { markt: 'Markt', konzert: 'Konzert', party: 'Party', fest: 'Fest', schau: 'Schau', sonstiges: 'Sonstiges' };
const STATUS = { verfuegbar: 'Karten verfügbar', ausverkauft: 'ausverkauft', abgesagt: 'abgesagt', verlegt: 'verlegt' };
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const artName = (art) => ARTEN[art] ?? ARTEN.sonstiges;

/** Gibt die Adresse nur zurück, wenn sie mit https://, http://, tel: oder mailto: beginnt. */
export function safeHref(url) {
  const t = typeof url === 'string' ? url.trim() : '';
  return /^(https?:\/\/|tel:|mailto:)/i.test(t) ? t : null;
}

const tagTeile = (tag) => {
  const d = new Date(`${tag}T00:00:00Z`);
  return { wochentag: WOCHENTAGE[d.getUTCDay()], tag: d.getUTCDate(), monat: MONATE[d.getUTCMonth()] };
};

/** "Heute", "Morgen", sonst "Samstag, 14. November". */
export function dayLabel(day, today) {
  if (day === today) return 'Heute';
  const morgen = new Date(`${today}T00:00:00Z`);
  morgen.setUTCDate(morgen.getUTCDate() + 1);
  if (day === morgen.toISOString().slice(0, 10)) return 'Morgen';
  const t = tagTeile(day);
  return `${t.wochentag}, ${t.tag}. ${t.monat}`;
}

const kurz = (tag) => {
  const t = tagTeile(tag);
  return `${t.wochentag.slice(0, 2)}, ${t.tag}. ${t.monat.slice(0, 3)}.`;
};

function wannText(ev) {
  const startTag = ev.start.slice(0, 10);
  const endTag = ev.end ? ev.end.slice(0, 10) : null;
  const von = ev.hasTime ? ev.start.slice(11, 16) : null;
  const bis = ev.hasTime && ev.end ? ev.end.slice(11, 16) : null;
  if (endTag && endTag !== startTag) {
    const ende = ev.hasTime && bis === '00:00' ? null : endTag;
    if (ende) return `${kurz(startTag)}${von ? ` ${von}` : ''} – ${kurz(ende)}${bis ? ` ${bis}` : ''}`;
  }
  return `${kurz(startTag)}${von ? `, ${von}${bis && bis !== '00:00' ? `–${bis}` : ''} Uhr` : ''}`;
}

function el(doc, tag, klasse, text) {
  const e = doc.createElement(tag);
  if (klasse) e.setAttribute('class', klasse);
  if (text != null) e.textContent = text;
  return e;
}

function link(doc, text, href, klasse) {
  const a = el(doc, 'a', klasse, text);
  a.setAttribute('href', href);
  if (/^https?:/i.test(href)) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
  return a;
}

/** Die Adresse, wenn sie ein sicherer http(s)-Link ist, sonst null. */
const webAdresse = (url) => {
  const href = safeHref(url);
  return href && /^https?:/i.test(href) ? href : null;
};

/**
 * Die Knöpfe in der Reihenfolge Webseite, Tickets, Anrufen, E-Mail; der erste Webknopf ist der Hauptknopf.
 * "Zur Webseite" nimmt die Adresse des Veranstalters, ersatzweise die Terminseite der ersten Quelle mit sicherem Link.
 */
function kontaktKnoepfe(doc, ev) {
  const zeile = el(doc, 'p', 'actions');
  const c = ev.contact ?? {};
  const web = webAdresse(c.url) ?? (ev.sources ?? []).map((q) => webAdresse(q.url)).find(Boolean);
  if (web) zeile.append(link(doc, 'Zur Webseite', web, 'btn'));
  const ticket = safeHref(ev.ticketUrl);
  if (ticket && /^https?:/i.test(ticket)) zeile.append(link(doc, 'Tickets', ticket, 'btn'));
  zeile.firstElementChild?.setAttribute('class', 'btn primaer');
  const ziffern = typeof c.phone === 'string' ? c.phone.replace(/[^\d+]/g, '') : '';
  if (ziffern.replace(/\D/g, '').length >= 5) zeile.append(link(doc, 'Anrufen', `tel:${ziffern}`, 'btn'));
  if (typeof c.email === 'string' && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(c.email.trim())) {
    zeile.append(link(doc, 'E-Mail', `mailto:${c.email.trim()}`, 'btn'));
  }
  return zeile;
}

/** Zeile 1: links Art, Sorte und Land, rechts die Gemeinde. */
function kopfzeile(doc, ev, gemeinde) {
  const kopf = el(doc, 'div', 'kartenkopf');
  const art = el(doc, 'span', 'art-zeile');
  art.append(el(doc, 'span', 'art', artName(ev.art)));
  const sorte = sorteName(ev);
  if (sorte) art.append(' · ', el(doc, 'span', 'genre', sorte));
  if (ev.country === 'CZ') art.append(' · ', el(doc, 'span', 'land', 'Tschechien'));
  kopf.append(art);
  if (gemeinde) kopf.append(el(doc, 'span', 'ort-rechts', gemeinde));
  return kopf;
}

/** Datum und Uhrzeit, daneben der Ticketstatus. */
function wannZeile(doc, ev) {
  const wann = el(doc, 'p', 'when', wannText(ev));
  if (ev.ticketStatus && STATUS[ev.ticketStatus]) wann.append(' ', el(doc, 'span', `status status-${ev.ticketStatus}`, STATUS[ev.ticketStatus]));
  return wann;
}

const kmText = (ev) => (ev.distanceKm != null ? `${Math.round(ev.distanceKm)} km` : null);

function quellenZeile(doc, ev) {
  const quellen = el(doc, 'p', 'sources', 'Quelle: ');
  (ev.sources ?? []).forEach((q, i) => {
    if (i) quellen.append(', ');
    const href = safeHref(q.url);
    quellen.append(href && /^https?:/i.test(href) ? link(doc, q.name, href) : String(q.name ?? ''));
  });
  return (ev.sources ?? []).length ? quellen : null;
}

/** Lizenz und Urheber des Termins; der Lizenzname ist nur bei einer sicheren http(s)-Adresse ein Link. Ohne Lizenz entfällt die Zeile. */
function lizenzZeile(doc, ev) {
  const l = ev.lizenz;
  if (!l || !l.name) return null;
  const zeile = el(doc, 'p', 'lizenz', 'Lizenz: ');
  const href = webAdresse(l.url);
  zeile.append(href ? link(doc, l.name, href) : String(l.name));
  if (l.urheber) zeile.append(' · Urheber: ', String(l.urheber));
  return zeile;
}

/** Hinweis unter einem gekürzten Text ("…" am Ende); der Weg zur Webseite ist der Knopf "Zur Webseite" darunter. */
function gekuerztHinweis(doc, ev) {
  if (!/(…|\.\.\.)\s*$/.test(ev.description ?? '')) return null;
  return el(doc, 'p', 'gekuerzt', 'Text gekürzt – vollständig auf der Webseite.');
}

/**
 * Eine Terminkarte.
 * @param {{orte?: string[]}} [optionen] orte: bekannte Ortsnamen, um die Gemeinde auch bei Namen ohne Komma zu erkennen
 */
export function renderEventCard(doc, ev, optionen = {}) {
  const orte = optionen.orte ?? [];
  const karte = el(doc, 'article', `card art-${ARTEN[ev.art] ? ev.art : 'sonstiges'}`);
  karte.append(kopfzeile(doc, ev, gemeindeVon(ev.placeName, orte)));
  karte.append(el(doc, 'h3', 'title', ev.title));
  karte.append(wannZeile(doc, ev));
  const ort = [spielstaetteVon(ev.placeName, orte), kmText(ev)].filter(Boolean);
  if (ort.length) karte.append(el(doc, 'p', 'where', ort.join(' · ')));
  if (ev.needsReview) karte.append(el(doc, 'p', 'review', 'bitte prüfen – Angaben noch nicht bestätigt'));
  if (ev.description) karte.append(el(doc, 'p', 'desc', ev.description));
  const knoepfe = kontaktKnoepfe(doc, ev);
  if (knoepfe.childNodes.length) karte.append(knoepfe);
  const quellen = quellenZeile(doc, ev);
  if (quellen) karte.append(quellen);
  return karte;
}

/**
 * Der Inhalt des Detailfensters: alles zum Termin, die ganze Beschreibung und, wenn Koordinaten da sind, ein Navigationsknopf.
 * @param {{orte?: string[], userAgent?: string}} [optionen]
 */
export function renderDetail(doc, ev, optionen = {}) {
  const orte = optionen.orte ?? [];
  const gemeinde = gemeindeVon(ev.placeName, orte);
  const detail = el(doc, 'div', `detail art-${ARTEN[ev.art] ? ev.art : 'sonstiges'}`);
  const kopf = kopfzeile(doc, ev, null);
  detail.append(kopf, el(doc, 'h2', 'title', ev.title), wannZeile(doc, ev));
  const ort = [spielstaetteVon(ev.placeName, orte), gemeinde, kmText(ev)].filter(Boolean);
  if (ort.length) detail.append(el(doc, 'p', 'where', ort.join(' · ')));
  if (ev.needsReview) detail.append(el(doc, 'p', 'review', 'bitte prüfen – Angaben noch nicht bestätigt'));
  if (ev.description) detail.append(el(doc, 'p', 'desc', ev.description));
  const gekuerzt = gekuerztHinweis(doc, ev);
  if (gekuerzt) detail.append(gekuerzt);
  const knoepfe = kontaktKnoepfe(doc, ev);
  const nav = navigationsLink(ev, plattform(optionen.userAgent));
  if (nav) knoepfe.append(link(doc, 'Navigation', nav, 'btn'));
  if (knoepfe.childNodes.length) detail.append(knoepfe);
  const quellen = quellenZeile(doc, ev);
  if (quellen) detail.append(quellen);
  const lizenz = lizenzZeile(doc, ev);
  if (lizenz) detail.append(lizenz);
  return detail;
}

const deutschesDatum = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : 'unbekannt';
};

/** Fußzeile: nennt nur Quellen mit ok:false; wurden ihre alten Termine übernommen, steht das dabei. */
export function renderStatusFooter(doc, status) {
  const fuss = el(doc, 'div', 'status-footer');
  for (const s of (status ?? []).filter((x) => x && x.ok === false)) {
    const text = s.uebernommen === true
      ? `Quelle ${s.name} seit ${deutschesDatum(s.lastOkAt)} nicht erreichbar, gezeigt werden die Termine vom letzten Abruf`
      : `Quelle ${s.name} seit ${deutschesDatum(s.lastOkAt)} ohne Daten`;
    fuss.append(el(doc, 'p', 'source-warning', text));
  }
  return fuss;
}
