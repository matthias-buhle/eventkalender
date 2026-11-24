// Sprache des Termins: nennt der Titel eine Sprache, gilt sie; sonst sind Termine aus Tschechien tschechisch.
// Reine Funktion, wirft nie; null heißt "keine Angabe nötig" (deutsch oder unbekannt).

const POLNISCH = /po polsku|in polnischer sprache|auf polnisch|polnischsprachig/;
const TSCHECHISCH = /auf tschechisch|in tschechischer sprache|tschechischsprachig|česky|v češtině/;
const DEUTSCH = /auf deutsch|in deutscher sprache|německy|v němčině/;

/** @returns {'cs'|'pl'|null} */
export function spracheVon(e) {
  const titel = typeof e?.title === 'string' ? e.title.toLowerCase() : '';
  if (POLNISCH.test(titel)) return 'pl';
  if (TSCHECHISCH.test(titel)) return 'cs';
  if (DEUTSCH.test(titel)) return null;
  return e?.country === 'CZ' ? 'cs' : null;
}
