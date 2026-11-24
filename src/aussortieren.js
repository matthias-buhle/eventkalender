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
const SCHULE_AUSNAHME = /\bauch\b|zus[aä]tzlich|auf anfrage|buchbar|[oö]ffentlich/;
const VERKAUF = /werksverkauf|lagerverkauf|fabrikverkauf|weihnachtsbaumverkauf/;
const HAT_GEOEFFNET = /hat ge[oö]ffnet/;
const LADEN_WORT = /laden|shop|gesch[aä]ft|verkauf|boutique/;
const LADEN_NICHT = /markt|fest\b|f[uü]hrung|konzert|musik|ausstellung/;
const GRUPPE = /selbsthilfegruppe|selbsthilfetreff|trauercaf[eé]|trauergruppe|trauerkreis|trauertreff|bibelkreis|bibelstunde|gespr[aä]chskreis|seniorennachmittag|seniorenkreis|chorprobe|orchesterprobe|bandprobe|theaterprobe|probenabend|probenwochenende/;
const GRUPPE_NICHT = /[oö]ffentlich|offene|mitsing|schnupper/;

export function aussortierGrund(e) {
  const titel = klein(e?.title);
  const beschreibung = klein(e?.description).slice(0, BESCHREIBUNG_ZEICHEN);
  if (SCHULE.test(titel) || (SCHULE.test(beschreibung) && !SCHULE_AUSNAHME.test(beschreibung))) return 'schulvorstellung';
  if (e?.art === 'sonstiges' && (VERKAUF.test(titel) || (HAT_GEOEFFNET.test(titel) && LADEN_WORT.test(titel))) && !LADEN_NICHT.test(titel)) return 'ladenoeffnung';
  if (GRUPPE.test(titel) && !GRUPPE_NICHT.test(titel)) return 'gruppentreffen';
  return null;
}
