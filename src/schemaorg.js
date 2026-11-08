import * as cheerio from 'cheerio';

/**
 * @typedef {{name:string|null, locality:string|null, postalCode:string|null, street:string|null, lat:number|null, lon:number|null}} SchemaPlace
 * @typedef {{url:string|null, availability:string|null, price:string|null}} SchemaOffer
 * @typedef {{
 *   name:string|null, startDate:string|null, endDate:string|null, url:string|null, description:string|null,
 *   location:SchemaPlace|null, offers:SchemaOffer[], raw:any
 * }} SchemaEvent
 */

const EVENT_TYPE = /(^|\/)(\w*Event|Festival)$/;

const erstes = (wert) => (Array.isArray(wert) ? wert[0] : wert);
const text = (wert) => (typeof wert === 'string' && wert.trim() ? wert.trim() : null);
const zahl = (wert) => {
  const n = Number(wert);
  return wert !== null && wert !== undefined && wert !== '' && Number.isFinite(n) ? n : null;
};

function istEvent(typ) {
  return [].concat(typ ?? []).some((t) => typeof t === 'string' && EVENT_TYPE.test(t));
}

/** Ort aus einem JSON-LD-Place oder einem Microdata-Objekt in eine einheitliche Form bringen. */
function ort(location) {
  const l = erstes(location);
  if (!l) return null;
  if (typeof l === 'string') return text(l) ? { name: text(l), locality: null, postalCode: null, street: null, lat: null, lon: null } : null;
  const adresse = erstes(l.address);
  const geo = erstes(l.geo);
  const adr = typeof adresse === 'string' ? { addressLocality: adresse } : (adresse ?? {});
  return {
    name: text(l.name),
    locality: text(adr.addressLocality),
    postalCode: text(adr.postalCode),
    street: text(adr.streetAddress),
    lat: zahl(geo?.latitude),
    lon: zahl(geo?.longitude),
  };
}

function angebote(offers) {
  return [].concat(offers ?? []).filter((o) => o && typeof o === 'object').map((o) => ({
    url: text(o.url),
    availability: text(o.availability),
    price: text(o.price) ?? (typeof o.price === 'number' ? String(o.price) : null),
  }));
}

function zuEvent(node, extra = {}) {
  return {
    name: text(node.name),
    startDate: text(node.startDate),
    endDate: text(node.endDate),
    url: text(erstes(node.url)),
    description: text(node.description),
    location: ort(node.location),
    offers: angebote(node.offers),
    raw: node,
    ...extra,
  };
}

function* knoten(wert) {
  if (Array.isArray(wert)) for (const w of wert) yield* knoten(w);
  else if (wert && typeof wert === 'object') {
    yield wert;
    if (wert['@graph']) yield* knoten(wert['@graph']);
  }
}

function ausJsonLd($) {
  const events = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let daten;
    try {
      daten = JSON.parse($(el).text());
    } catch {
      return; // kaputtes JSON-LD einer einzelnen Seite darf den Lauf nicht stoppen
    }
    for (const k of knoten(daten)) if (istEvent(k['@type'])) events.push(zuEvent(k));
  });
  return events;
}

function wertVon($, el) {
  const e = $(el);
  if (e.is('[itemscope]')) return itemEigenschaften($, el);
  const tag = el.tagName?.toLowerCase();
  if (e.attr('content') !== undefined) return e.attr('content');
  if (tag === 'time' && e.attr('datetime')) return e.attr('datetime');
  if (['a', 'link', 'area'].includes(tag) && e.attr('href')) return e.attr('href');
  if (['img', 'source'].includes(tag) && e.attr('src')) return e.attr('src');
  if (tag === 'meta') return e.attr('content') ?? '';
  return e.text().replace(/\s+/g, ' ').trim();
}

/** Liest die direkten itemprop-Werte eines itemscope-Elements; bei doppelten Namen gewinnt der erste. */
function itemEigenschaften($, scope) {
  const props = {};
  $(scope).find('[itemprop]').each((_, el) => {
    if ($(el).parent().closest('[itemscope]').get(0) !== scope) return;
    const name = $(el).attr('itemprop');
    if (name in props) return;
    props[name] = wertVon($, el);
  });
  return props;
}

function ausMicrodata($) {
  const events = [];
  $('[itemscope][itemtype]').each((_, el) => {
    if (!istEvent($(el).attr('itemtype'))) return;
    const props = itemEigenschaften($, el);
    const raw = { ...props, html: $.html($(el)) };
    events.push(zuEvent(props, { raw }));
  });
  return events;
}

/**
 * Liest schema.org-Events aus HTML: JSON-LD (auch in @graph, Listen und Typ-Listen) und Microdata.
 * Kaputtes JSON-LD wird übersprungen. Bei Microdata enthält raw zusätzlich `html` des Event-Elements.
 * @param {string} html
 * @returns {SchemaEvent[]}
 */
export function extractSchemaEvents(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  return [...ausJsonLd($), ...ausMicrodata($)];
}
