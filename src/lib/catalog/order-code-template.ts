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
      new RegExp(`\\{${key}(?::([A-Z]+))?\\}`, "g"),
      (_m, suffix: string | undefined) => (v ? `${v}${suffix ?? ""}` : ""),
    );
  }

  code = code.replace(/\{([^}:]+)(?::[A-Z]+)?\}/g, (_m, key: string) =>
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
export function stripLeadingCode(label: string, code: string): string {
  if (!code) return label.slice(0, 28);
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = label.replace(new RegExp(`^${escaped}(?=[\\s\\-–:]|$)\\s*`), "");
  // Blev ingenting kvar var etiketten bara koden -- behåll originalet då.
  return (stripped.trim() || label).slice(0, 28);
}
