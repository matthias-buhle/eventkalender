import { createHash } from 'node:crypto';

/**
 * @typedef {'markt'|'konzert'|'party'|'fest'|'schau'|'sonstiges'} Art
 * @typedef {{phone:string|null,url:string|null,email:string|null}} Contact
 * @typedef {'ausverkauft'|'verfuegbar'|'abgesagt'|'verlegt'} TicketStatus
 * @typedef {{
 *   id:string, title:string, art:Art, tags:string[],
 *   start:string, end:string|null, hasTime:boolean,
 *   placeName:string, lat:number|null, lon:number|null, distanceKm:number|null,
 *   country:'DE'|'CZ',
 *   sources:{name:string,url:string}[],
 *   contact:Contact, ticketUrl:string|null, ticketStatus:TicketStatus|null,
 *   description:string|null, needsReview:boolean, submittedBy:string|null
 * }} Event
 */

export const ARTEN = ['markt', 'konzert', 'party', 'fest', 'schau', 'sonstiges'];

/**
 * Baut einen vollständigen Event aus Rohwerten eines Adapters.
 * sourceName+sourceId bilden die stabile id; sourceUrl wird zum Quellenlink,
 * falls keine eigene sources-Liste mitgegeben wird.
 * @returns {Event}
 */
export function makeEvent(raw) {
  const { sourceName, sourceId, sourceUrl, ...rest } = raw;
  if (typeof rest.title !== 'string' || !rest.title.trim()) throw new Error('makeEvent: title fehlt');
  if (typeof rest.start !== 'string' || !rest.start) throw new Error('makeEvent: start fehlt');
  const sources = rest.sources ?? (sourceUrl ? [{ name: sourceName, url: sourceUrl }] : []);
  if (!sources.length || !sources[0].url) throw new Error('makeEvent: sources fehlt (sourceUrl angeben)');
  const id = createHash('sha1').update(`${sourceName}:${sourceId}`).digest('hex');
  return {
    id,
    title: rest.title.trim(),
    art: rest.art ?? 'sonstiges',
    tags: rest.tags ?? [],
    start: rest.start,
    end: rest.end ?? null,
    hasTime: rest.hasTime ?? true,
    placeName: rest.placeName ?? '',
    lat: rest.lat ?? null,
    lon: rest.lon ?? null,
    distanceKm: rest.distanceKm ?? null,
    country: rest.country ?? 'DE',
    sources,
    contact: { phone: null, url: null, email: null, ...(rest.contact ?? {}) },
    ticketUrl: rest.ticketUrl ?? null,
    ticketStatus: rest.ticketStatus ?? null,
    description: rest.description ?? null,
    needsReview: rest.needsReview ?? false,
    submittedBy: rest.submittedBy ?? null,
  };
}
