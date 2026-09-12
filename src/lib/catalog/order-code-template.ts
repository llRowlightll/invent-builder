/**
 * Mallmotorn som konfiguratorn bygger orderkoder med.
 *
 * Bruten ur configurator.$family.tsx för att kunna testas. Den byggde tidigare
 * koden med naiv strängersättning och kontrollerade ingenting, och mallen för
 * DSBC täckte 6 av 21 positioner -- en kund som valde korrosionsskydd R3 eller
 * ATEX-varianten EX4 fick en orderkod utan dem och hade beställt fel del.
 *
 * Testet i dsbc.test.ts kör den mot 455 verifierade katalogkoder, så en mall
 * som tappar en position failar bygget.
 */

/**
 * Sätter in valen i mallen.
 *
 * `{key}` sätter in värdet rakt av. `{key:SUFFIX}` lägger till suffixet bara
 * när ett värde finns -- Festos numeriska positioner bär sin bokstav i koden
 * (25 blir "25KE", 500 blir "500E"), och utan den formen skulle en tom
 * position lämna ett ensamt "KE" efter sig.
 *
 * Ovalda positioner försvinner helt; obligatoriska visas som "..." så att
 * kunden ser att något fattas. En beställnyckel utelämnar sina ovalda
 * positioner -- DSBC har 21 stycken varav de flesta är valfria.
 */
export function fillOrderCodeTemplate(
  template: string,
  selections: Record<string, string | string[] | number>,
  required: Set<string> = new Set(),
): string {
  let code = template;

  for (const [key, val] of Object.entries(selections)) {
    const v = Array.isArray(val) ? val.join("-") : String(val ?? "");
    code = code.replace(
      new RegExp(`\\{${key}(?::([A-Z]+))?(?:#(\\d))?\\}`, "g"),
      (_m, suffix: string | undefined, pad: string | undefined) => {
        if (!v) return "";
        // {key#3} nollutfyller till tre tecken. Parkers P1D-koder är
        // POSITIONELLA: "P1D-S050MS-0200" finns, "P1D-S50MS-200" gör det inte.
        // Utan utfyllnad producerade mallen koder som inte går att beställa --
        // och det gällde varenda en av de 25 P1D-artiklar vi säljer.
        const t = pad ? v.padStart(Number(pad), "0") : v;
        return `${t}${suffix ?? ""}`;
      },
    );
  }

  code = code.replace(/\{([^}:#]+)(?::[A-Z]+)?(?:#\d)?\}/g, (_m, key: string) =>
    required.has(key) ? "..." : "",
  );

  // Städa separatorerna som blev över när valfria positioner föll bort.
  return code.replace(/-{2,}/g, "-").replace(/-+$/g, "");
}

/**
 * Koden visas redan på egen rad ovanför etiketten, så en etikett som inleds
 * med samma kod ska inte upprepa den.
 *
 * Den tidigare varianten gjorde `.replace(code, "")` utan ankare och klippte
 * därför koden var den än råkade förekomma: "Låg friktion" med koden "L" blev
 * "åg friktion". Här klipps bara ett ledande förekomst, och bara när ett
 * avgränsningstecken följer.
 */
/**
 * Taket på etikettens längd.
 *
 * Det stod på 28 tecken utan förklaring, och det var för lågt. En knapp i
 * konfiguratorn renderar etiketten i en `block`-span med `text-left`, så en
 * längre text RADBRYTS -- den spräcker ingen layout, den gör bara knappen
 * högre, och knapparna i ett rutnät sträcker sig ändå till den högsta.
 *
 * Vad kapningen däremot gjorde var att göra alternativ OMÖJLIGA ATT SKILJA ÅT.
 * P1D:s funktionsposition har tolv värden som föll ihop till fyra grupper:
 * koderna A, H och W visades alla som "Dubbelverkande, rostfria skr". Kunden
 * ser tre likadana knappar och kan inte veta vilken som är rätt. Det är inte
 * ett skönhetsfel utan en felbeställning som väntar.
 *
 * 64 räcker för varje etikett som finns i dag (den längsta är 62 tecken) och
 * lämnar marginal. Taket finns kvar för att en enskild orimlig etikett inte
 * ska kunna spränga rutnätet -- men det ska inte vara så lågt att det suddar
 * ut skillnader.
 */
export const LABEL_MAX = 64;

export function stripLeadingCode(label: string, code: string): string {
  if (!code) return label.slice(0, LABEL_MAX);
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Koden tas bort TILLSAMMANS med avskiljaren. Den tidigare varianten lämnade
  // kvar tankstrecket, så "D3 – Givarspår" visades som "– Givarspår".
  //
  // Ett bindestreck UTAN mellanslag är däremot ingen avskiljare utan en
  // sammansättning: svenskan skriver "M5-gänga", och att klippa där gav
  // "-gänga" i ventilkonfiguratorn. Därför krävs blanksteg runt strecket.
  const stripped = label.replace(
    new RegExp(`^${escaped}(?:\\s*[-–—:]\\s+|\\s*[-–—:]$|\\s+|$)`),
    "",
  );
  // Blev ingenting kvar var etiketten bara koden -- behåll originalet då.
  return (stripped.trim() || label).slice(0, LABEL_MAX);
}
