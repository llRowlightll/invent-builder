/**
 * Valen i familjekonfiguratorn.
 *
 * Bruten ur configurator.$family.tsx av samma skäl som mallmotorn: logiken
 * går inte att testa så länge den sitter i en komponent.
 *
 * VARFÖR DEN FINNS. Konfiguratorn gick bara att TRYCKA PÅ. Ett andra klick på
 * en redan vald knapp gjorde ingenting, så den som klickat fel på "Dämpning"
 * var tvungen att välja ett annat värde -- eller trycka "Rensa alla val" och
 * börja om från början. Festos konfigurator, som är förlagan, har kryssrutor
 * som går att bocka av en och en plus en "Reset filters" för allt; att ta bort
 * ett val ska kosta ett klick, inte hela konfigurationen.
 */

export type Val = string | string[];

/**
 * Nytt valläge efter ett klick på `value` i parametern `key`.
 *
 * Enkelval togglar: samma värde igen tar bort valet. Flerval togglar per värde.
 *
 * BORTVALT = NYCKELN TAS BORT, inte sätts till "". Skillnaden är inte
 * kosmetisk. fillOrderCodeTemplate går igenom de valda nycklarna först och
 * ersätter tomma värden med ingenting; en obligatorisk position som finns med
 * som tom sträng FÖRSVINNER därför tyst, och separatorstädningen döljer hålet:
 *
 *   {bore_mm: ""}      ->  DSNU-25-PPS      ser komplett ut, saknar borrning
 *   nyckeln borttagen  ->  DSNU-...-25-PPS  syns att något fattas
 *
 * Det är samma sorts fel som mallen hade för DSBC (en kod som går att läsa men
 * inte att beställa), så bortval måste lämna positionen OVALD på riktigt.
 */
export function toggleValue(
  selections: Record<string, Val>,
  key: string,
  value: string,
  paramType: string,
): Record<string, Val> {
  if (paramType === "multiselect") {
    const nuvarande = (selections[key] as string[]) || [];
    const nästa = nuvarande.includes(value)
      ? nuvarande.filter((v) => v !== value)
      : [...nuvarande, value];
    return nästa.length === 0
      ? utan(selections, key)
      : { ...selections, [key]: nästa };
  }
  return selections[key] === value
    ? utan(selections, key)
    : { ...selections, [key]: value };
}

/** Kopia utan nyckeln. */
function utan(selections: Record<string, Val>, key: string): Record<string, Val> {
  const kopia = { ...selections };
  delete kopia[key];
  return kopia;
}

/** Är värdet valt? Samma regel som knappen målas efter. */
export function isSelected(selections: Record<string, Val>, key: string, value: string): boolean {
  const v = selections[key];
  return Array.isArray(v) ? v.includes(value) : v === value;
}

/** Har parametern något val alls? Styr om "Rensa"-länken visas per steg. */
export function hasValue(selections: Record<string, Val>, key: string): boolean {
  const v = selections[key];
  return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
}

/** Nollställer en enskild parameter utan att röra de andra. */
export function clearValue(selections: Record<string, Val>, key: string): Record<string, Val> {
  return utan(selections, key);
}
