/**
 * Zerlegt einen Ortsnamen wie `Turnhalle, Kubschütz / Kreckwitz` in den Hauptort (Gemeinde) und weitere Namen (Ortsteile).
 * Die Spielstätte vor dem letzten Komma fällt weg; Kommas in Anführungszeichen zählen nicht.
 * @param {string} name
 * @returns {{hauptort:string, weitere:string[]}}
 */
export function ortskandidaten(name) {
  const ohneZitat = name.replace(/"[^"]*"/g, (m) => m.replace(/,/g, '\u0000'));
  const teile = ohneZitat.split(',').map((t) => t.replaceAll('\u0000', ',').trim()).filter(Boolean);
  const ort = teile.at(-1) ?? '';
  const [hauptort = '', ...weitere] = ort.split('/').map((t) => t.trim()).filter(Boolean);
  return { hauptort, weitere };
}
