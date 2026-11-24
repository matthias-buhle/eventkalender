// Aussortieren mit Grund: nur reine Ladenöffnungen/Werksverkäufe, Schulvorstellungen
// und Gruppentreffen. Reine Funktion, wirft nie; im Zweifel bleibt der Termin (null).

export const GRUENDE = {
  ladenoeffnung: 'Ladenöffnung',
  schulvorstellung: 'Schulvorstellung',
  gruppentreffen: 'Gruppentreffen',
};

const BESCHREIBUNG_ZEICHEN = 200;
const klein = (x) => (typeof x === 'string' ? x.toLowerCase() : '');

const SCHULE = /schulvorstellung|f[uü]r schulklassen|klassenzimmerst[uü]ck|geschlossene (?:veranstaltung|vorstellung)/;
const LADEN = /hat ge[oö]ffnet|werksverkauf|lagerverkauf|fabrikverkauf|weihnachtsbaumverkauf/;
const LADEN_NICHT = /markt|fest\b|f[uü]hrung|konzert|musik|ausstellung/;
const GRUPPE = /selbsthilfe|trauercaf[eé]|trauergruppe|trauerkreis|trauertreff|bibelkreis|bibelstunde|gespr[aä]chskreis|seniorennachmittag|seniorenkreis|chorprobe|\bprobe\b/;
const GRUPPE_NICHT = /[oö]ffentliche probe/;

export function aussortierGrund(e) {
  const titel = klein(e?.title);
  const beschreibung = klein(e?.description).slice(0, BESCHREIBUNG_ZEICHEN);
  if (SCHULE.test(titel) || SCHULE.test(beschreibung)) return 'schulvorstellung';
  if (e?.art === 'sonstiges' && LADEN.test(titel) && !LADEN_NICHT.test(titel)) return 'ladenoeffnung';
  if (GRUPPE.test(titel) && !GRUPPE_NICHT.test(titel)) return 'gruppentreffen';
  return null;
}
