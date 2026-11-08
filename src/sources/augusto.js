import { holeZeilen, plusTage, zuEvents } from './culturebase.js';

export const name = 'augusto';

/** Augusto (Kulturportal Sachsen), je Ort eine Liste. Ein gesperrter Ort stoppt die anderen nicht; fallen alle aus, ist es ein Fehler. */
export async function fetchEvents({ http, today, config }) {
  const von = today;
  const bis = plusTage(today, config.days ?? 60);
  const events = [];
  let ersterFehler = null;
  let geklappt = 0;
  for (const slug of config.slugs ?? []) {
    try {
      const zeilen = await holeZeilen({
        http,
        maxPages: config.maxPages ?? 80,
        urlFuerSeite: (p) => `${config.baseUrl}/${slug}/list?date_from=${von}&date_to=${bis}&p=${p}`,
      });
      events.push(...zuEvents(zeilen, {
        quelle: 'Augusto',
        linkFuer: (row) => `https://augusto-sachsen.de/veranstaltungen/t/${row.Id}/${encodeURIComponent(row.Slug)}`,
      }));
      geklappt++;
    } catch (fehler) {
      ersterFehler ??= fehler;
    }
  }
  if (!geklappt && ersterFehler) throw ersterFehler;
  return events;
}
