// Baut Karten und Fußzeile als DOM. Fremdwerte kommen ausschließlich über textContent und setAttribute hinein, nie über innerHTML.
import { sorteName } from './arten.js';

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

function kontaktKnoepfe(doc, ev) {
  const zeile = el(doc, 'p', 'actions');
  const c = ev.contact ?? {};
  const ziffern = typeof c.phone === 'string' ? c.phone.replace(/[^\d+]/g, '') : '';
  if (ziffern.replace(/\D/g, '').length >= 5) zeile.append(link(doc, 'Anrufen', `tel:${ziffern}`, 'btn'));
  const web = safeHref(c.url);
  if (web && /^https?:/i.test(web)) zeile.append(link(doc, 'Zur Webseite', web, 'btn'));
  if (typeof c.email === 'string' && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(c.email.trim())) {
    zeile.append(link(doc, 'E-Mail', `mailto:${c.email.trim()}`, 'btn'));
  }
  const ticket = safeHref(ev.ticketUrl);
  if (ticket && /^https?:/i.test(ticket)) zeile.append(link(doc, 'Tickets', ticket, 'btn'));
  return zeile.childNodes.length ? zeile : null;
}

/** Eine Terminkarte. */
export function renderEventCard(doc, ev) {
  const karte = el(doc, 'article', `card art-${ARTEN[ev.art] ? ev.art : 'sonstiges'}`);
  karte.append(el(doc, 'h3', 'title', ev.title));
  const meta = el(doc, 'p', 'meta');
  meta.append(el(doc, 'span', 'art', artName(ev.art)));
  const sorte = sorteName(ev);
  if (sorte) meta.append(' · ', el(doc, 'span', 'genre', sorte));
  if (ev.ticketStatus && STATUS[ev.ticketStatus]) meta.append(' ', el(doc, 'span', `status status-${ev.ticketStatus}`, STATUS[ev.ticketStatus]));
  karte.append(meta);
  karte.append(el(doc, 'p', 'when', wannText(ev)));
  const ort = [ev.placeName, ev.distanceKm != null ? `${Math.round(ev.distanceKm)} km` : null, ev.country === 'CZ' ? 'Tschechien' : null].filter(Boolean);
  if (ort.length) karte.append(el(doc, 'p', 'where', ort.join(' · ')));
  if (ev.needsReview) karte.append(el(doc, 'p', 'review', 'bitte prüfen – Angaben noch nicht bestätigt'));
  if (ev.description) karte.append(el(doc, 'p', 'desc', ev.description));
  const knoepfe = kontaktKnoepfe(doc, ev);
  if (knoepfe) karte.append(knoepfe);
  const quellen = el(doc, 'p', 'sources', 'Quelle: ');
  (ev.sources ?? []).forEach((q, i) => {
    if (i) quellen.append(', ');
    const href = safeHref(q.url);
    quellen.append(href && /^https?:/i.test(href) ? link(doc, q.name, href) : String(q.name ?? ''));
  });
  if ((ev.sources ?? []).length) karte.append(quellen);
  return karte;
}

const deutschesDatum = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : 'unbekannt';
};

/** Fußzeile: nennt nur Quellen mit ok:false. */
export function renderStatusFooter(doc, status) {
  const fuss = el(doc, 'div', 'status-footer');
  for (const s of (status ?? []).filter((x) => x && x.ok === false)) {
    fuss.append(el(doc, 'p', 'source-warning', `Quelle ${s.name} seit ${deutschesDatum(s.lastOkAt)} ohne Daten`));
  }
  return fuss;
}
