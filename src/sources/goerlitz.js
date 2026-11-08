import { holeZeilen, plusTage, zuEvents } from './culturebase.js';

export const name = 'goerlitz';

/** Terminkalender der Stadt Görlitz (CultureBase-Schnittstelle), die nächsten 60 Tage. */
export async function fetchEvents({ http, today, config }) {
  const von = today;
  const bis = plusTage(today, config.days ?? 60);
  const zeilen = await holeZeilen({
    http,
    maxPages: config.maxPages ?? 150,
    urlFuerSeite: (p) => `${config.url}?date_from=${von}&date_to=${bis}&p=${p}`,
  });
  return zuEvents(zeilen, {
    quelle: 'Görlitz Termine',
    linkFuer: (row) => `https://www.goerlitz.de/termine/detail/${row.Id}`,
  });
}
