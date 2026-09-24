/**
 * Vilken katalogpost hör ihop med en konfiguratorfamilj?
 *
 * Konfiguratorn bygger en KOD ("DSNU-32-100-PPS"). Katalogen har ingen sådan
 * rad -- den har familjen. Men den har oftast flera: DSNU har tolv rader, en
 * serierad ("FESTO-DSNU") och tio per borrning ("FESTO-DSNU-8" ... "-63").
 *
 * Ett `limit 1` utan ordning plockade "FESTO-DSNU-40" till en 32-konfiguration
 * och satte namnet "Festo DSNU-40 Round Cylinder" på raden. Alltså exakt det
 * här bygget finns till för att förhindra: en rad som säger en storlek och en
 * kod som säger en annan.
 *
 * DÄRFÖR: id:t är en KATALOGLÄNK (märke, leveranstid, dokument), aldrig
 * artikeln -- artikeln är koden. Och NAMNET tas aldrig härifrån, utan från
 * familjen, så det inte kan motsäga koden.
 */
export interface KatalogpostLite {
  id: string;
  sku: string;
  name: string;
}

/**
 * Serieraden om den finns, annars den minst specifika raden i familjen.
 *
 * Ordningen är bestämd, inte godtycklig:
 *   1. exakt serierad -- sku:t slutar på "-<slug>" ("FESTO-DSNU")
 *   2. annars rader vars sku bär familjens namn ("FESTO-DSNU-8"), kortast
 *      först och vid lika längd bokstavsordning
 *   3. annars samma regel på resten
 *
 * Steg 2 finns för att familjen också kan innehålla rader med ogenomskinliga
 * artikelnummer (DSNU har en "FESTO-193986"). De är lika långa som
 * "FESTO-DSNU-8" och hade vunnit på ren bokstavsordning, fast de säger
 * ingenting om familjen.
 *
 * Att steg 2 och 3 är heuristiker är avsiktligt och ofarligt: varianterna
 * byggs av serienamnet plus ett suffix, så den kortaste är den minst
 * specifika -- och även om den pekar på fel borrning kan den inte visa fel
 * storlek för kunden, eftersom NAMNET inte kommer härifrån utan från familjen.
 */
export function valjSerieprodukt(
  familySlug: string,
  produkter: KatalogpostLite[],
): KatalogpostLite | null {
  if (!familySlug || produkter.length === 0) return null;
  const slug = familySlug.trim().toUpperCase();

  const exakt = produkter.filter((p) => (p.sku ?? "").toUpperCase().endsWith(`-${slug}`));
  if (exakt.length > 0) return minstSpecifika(exakt);

  const barNamnet = produkter.filter((p) => (p.sku ?? "").toUpperCase().includes(slug));
  return minstSpecifika(barNamnet.length > 0 ? barNamnet : produkter);
}

function minstSpecifika(kandidater: KatalogpostLite[]): KatalogpostLite | null {
  return [...kandidater].sort(
    (a, b) => (a.sku ?? "").length - (b.sku ?? "").length || (a.sku ?? "").localeCompare(b.sku ?? ""),
  )[0] ?? null;
}
