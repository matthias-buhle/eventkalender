import { makeEvent } from '../model.js';
import { berlinIso } from '../time.js';
import { CENTER } from '../geo.js';
import { cleanText, normalizeArt } from '../normalize.js';

export const name = 'ticketmaster';

const STATUS = {
  onsale: 'verfuegbar', offsale: 'ausverkauft',
  cancelled: 'abgesagt', canceled: 'abgesagt',
  postponed: 'verlegt', rescheduled: 'verlegt',
};

function zuEvent(e) {
  const start = e.dates?.start;
  if (!e.name || !e.url || !start?.localDate) return null;
  const mitZeit = Boolean(start.localTime) && !start.timeTBA && !start.noSpecificTime;
  const venue = e._embedded?.venues?.[0];
  const klasse = e.classifications?.[0];
  const artText = [klasse?.genre?.name, klasse?.subGenre?.name].filter(Boolean).join(' ');
  const lat = Number(venue?.location?.latitude);
  const lon = Number(venue?.location?.longitude);
  return makeEvent({
    sourceName: 'Ticketmaster',
    sourceId: e.id,
    sourceUrl: e.url,
    title: cleanText(e.name),
    art: /music|musik/i.test(klasse?.segment?.name ?? '') ? 'konzert' : normalizeArt(artText, e.name),
    start: berlinIso(start.localDate, mitZeit ? start.localTime.slice(0, 5) : null),
    hasTime: mitZeit,
    placeName: [venue?.name, venue?.city?.name].filter(Boolean).join(', '),
    lat: venue?.location && Number.isFinite(lat) ? lat : null,
    lon: venue?.location && Number.isFinite(lon) ? lon : null,
    contact: { url: e.url },
    ticketUrl: e.url,
    ticketStatus: STATUS[String(e.dates?.status?.code ?? '').toLowerCase()] ?? null,
  });
}

/** Ticketmaster Discovery API v2: Veranstaltungen im Umkreis (benötigt TICKETMASTER_API_KEY). */
export async function fetchEvents({ http, today, config }) {
  const schluessel = process.env.TICKETMASTER_API_KEY;
  if (!schluessel) throw new Error('kein Schlüssel');
  const events = [];
  for (let seite = 0; seite < (config.maxPages ?? 5); seite++) {
    const url = new URL(config.url);
    url.search = new URLSearchParams({
      apikey: schluessel,
      latlong: `${CENTER.lat},${CENTER.lon}`,
      radius: String(config.radiusKm ?? 75),
      unit: 'km',
      countryCode: 'DE',
      startDateTime: `${today}T00:00:00Z`,
      sort: 'date,asc',
      size: '200',
      page: String(seite),
    }).toString();
    const { body } = await http.get(url.href, { as: 'json' });
    events.push(...(body?._embedded?.events ?? []).map(zuEvent).filter(Boolean));
    if (seite + 1 >= (body?.page?.totalPages ?? 0)) break;
  }
  return events;
}
