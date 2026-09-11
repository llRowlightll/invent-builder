/**
 * Översättningsfilerna mot varandra.
 *
 * VARFÖR FILEN FINNS. Komponentsidan hade en handskriven kategorilista med
 * sluggarna pneumatics/ea/sensors/valves/air-prep, medan use_case_map i
 * databasen använder cylinder/gripper/valve/vacuum/electric-actuator/
 * linear-module. Inte en enda matchade. Följden: varje kategoriklick frågade
 * efter rader som inte finns, och sidan visade ingenting alls -- för samtliga
 * fem kategorier, på alla fyra språken. Ingen märkte det, för ingenting
 * jämförde listan mot databasen.
 *
 * Listan kommer nu ur databasen. Det som INTE kan komma därifrån är
 * översättningarna, och en kategori utan översättning faller tillbaka på
 * databasens engelska namn. Det här testet ser till att de fyra språken bär
 * samma nycklar, så att en ny kategori inte tyst blir engelsk på tre av dem.
 */
import { assertEquals } from "jsr:@std/assert@1";

const LOCALES = ["en", "sv", "de", "es"] as const;

async function dict(loc: string): Promise<Record<string, unknown>> {
  const url = new URL(`../../../src/locales/${loc}.json`, import.meta.url);
  return JSON.parse(await Deno.readTextFile(url));
}

/** Alla nycklar som punktnotation, så att jämförelsen blir läsbar när den fälls. */
function keys(o: unknown, prefix = ""): string[] {
  if (o === null || typeof o !== "object" || Array.isArray(o)) return [prefix];
  return Object.entries(o as Record<string, unknown>)
    .flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

Deno.test("alla fyra språken bär samma nycklar", async () => {
  const en = keys(await dict("en")).sort();
  for (const loc of LOCALES.slice(1)) {
    const other = keys(await dict(loc)).sort();
    const saknas = en.filter((k) => !other.includes(k));
    const extra = other.filter((k) => !en.includes(k));
    assertEquals(saknas, [], `${loc} saknar: ${saknas.join(", ")}`);
    assertEquals(extra, [], `${loc} har nycklar som en saknar: ${extra.join(", ")}`);
  }
});

Deno.test("varje kategori med användningsfall är översatt", async () => {
  // Sluggarna nedan är de som faktiskt bär rader i use_case_map (2026-09-11).
  // Står en kategori här utan översättning visas databasens engelska namn mitt
  // på den svenska sidan -- samma sorts fel som schemaspårets rubriker hade.
  const LEVANDE = [
    "cylinder", "gripper", "valve", "electric-actuator", "vacuum", "linear-module",
    "air-preparation",
  ];
  for (const loc of LOCALES) {
    const d = await dict(loc);
    const kat = ((d.components as Record<string, unknown>)?.categories ?? {}) as Record<string, string>;
    const saknas = LEVANDE.filter((s) => !kat[s]);
    assertEquals(saknas, [], `${loc} saknar kategorinamn: ${saknas.join(", ")}`);
  }
});

Deno.test("inga kategorinamn är kvar på fel språk", async () => {
  // Svenska och engelska ska inte vara identiska för de kategorier där orden
  // faktiskt skiljer sig -- en ren kopia betyder oftast att någon glömt.
  const en = await dict("en");
  const sv = await dict("sv");
  const katEn = ((en.components as Record<string, unknown>).categories) as Record<string, string>;
  const katSv = ((sv.components as Record<string, unknown>).categories) as Record<string, string>;
  // "Vakuum" heter samma sak på båda språken så när som på ett k, så listan
  // nedan är de som MÅSTE skilja sig.
  for (const slug of ["cylinder", "gripper", "valve", "linear-module"]) {
    assertEquals(
      katEn[slug] === katSv[slug],
      false,
      `${slug}: "${katSv[slug]}" är inte översatt (samma som engelskan)`,
    );
  }
});
