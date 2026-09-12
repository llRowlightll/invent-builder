/**
 * ELEKTRO-reglerna som faktiskt körs, mot modellen som faktiskt bygger koden.
 *
 * Modellen kan vara rätt och översättningen till JSON-logik ändå fel. P1D
 * visade hur: en regel läste `atex`, som inte var ett fält, och kunde därför
 * aldrig larma. En annan jämförde borrningen mot "80" medan konfiguratorn
 * skickar den nollutfyllda "080" -- regeln fanns, fältet fanns, och den
 * larmade ändå aldrig. Ingen av dem fångades av att modellen stämde.
 *
 * Därför körs reglerna här genom samma `evalLogic` som produktionen, mot
 * samma kontext `buildRuleContext` bygger, och utfallet jämförs med
 * `elektroBuildCode`. En kombination som modellen vägrar bygga MÅSTE ge minst
 * ett fel, och en som den bygger får inte ge något.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildRuleContext, evalLogic } from "../../../src/lib/configurator-engine.ts";
import { buildElektroDbRules } from "../../../src/lib/catalog/elektro-db-rules.ts";
import {
  ELEKTRO_COMBOS,
  ELEKTRO_PITCHES,
  ELEKTRO_SIZES,
  ELEKTRO_VERSIONS,
  elektroBuildCode,
  elektroDrivePacks,
  elektroMinStroke,
} from "../../../src/lib/catalog/elektro.ts";

const REGLER = buildElektroDbRules();
const NUMERISKA = ["stroke_mm"];

/** Körs precis som konfiguratorn gör det. */
function fel(val: Record<string, string | number>): string[] {
  const ctx = buildRuleContext(val, NUMERISKA);
  return REGLER
    .filter((r) => r.severity === "error" && evalLogic(r.if_json, ctx) === true)
    .map((r) => r.message_sv);
}

Deno.test("varje regel läser bara fält som finns", () => {
  // Invarianten från P1D: en regel som läser en variabel konfiguratorn aldrig
  // skickar kan inte larma, och ser ändå ut att göra sitt jobb.
  const falt = new Set(["size", "stroke_mm", "pitch", "version", "drive_pack"]);
  const okanda = new Set<string>();
  const gaIgenom = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(gaIgenom);
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.var === "string" && !falt.has(o.var)) okanda.add(o.var);
    Object.values(o).forEach(gaIgenom);
  };
  REGLER.forEach((r) => gaIgenom(r.if_json));
  assertEquals([...okanda], [], `regler läser fält som inte finns: ${[...okanda]}`);
});

Deno.test("varje beställbar kombination passerar utan fel", () => {
  const trasiga: string[] = [];
  for (const s of ELEKTRO_SIZES) {
    for (const c of ELEKTRO_COMBOS[s.code]) {
      for (const pitch of c.pitches) {
        for (const version of c.versions) {
          for (const pack of c.packs) {
            const stroke = elektroMinStroke(s.code, version, pitch)!;
            const f = fel({ size: s.code, stroke_mm: stroke, pitch, version, drive_pack: pack.code });
            if (f.length) {
              trasiga.push(`${s.code}/${pitch}/${version}/${pack.code}@${stroke}: ${f.join(" | ")}`);
            }
          }
        }
      }
    }
  }
  assertEquals(trasiga.slice(0, 8), [], `${trasiga.length} beställbara kombinationer larmade`);
});

Deno.test("varje icke-beställbar kombination ger minst ett fel", () => {
  // Uttömmande över hela korsprodukten: 6 storlekar × 8 stigningar ×
  // 8 versioner × alla drivgrupper som förekommer någonstans. Det mesta av
  // den produkten är INTE beställbart, och det är precis poängen.
  const allaPaket = [...new Set(ELEKTRO_SIZES.flatMap((s) => elektroDrivePacks(s.code)))];
  const missade: string[] = [];
  let provade = 0;
  for (const s of ELEKTRO_SIZES) {
    for (const p of ELEKTRO_PITCHES) {
      for (const v of ELEKTRO_VERSIONS) {
        for (const pack of allaPaket) {
          const stroke = 500;  // inom alla storlekars gränser
          const kod = elektroBuildCode({
            size: s.code, stroke_mm: stroke, pitch: p.code, version: v.code, drive_pack: pack,
          });
          provade++;
          if (kod) continue;
          if (fel({ size: s.code, stroke_mm: stroke, pitch: p.code, version: v.code, drive_pack: pack }).length === 0) {
            missade.push(`${s.code}/${p.code}/${v.code}/${pack}`);
          }
        }
      }
    }
  }
  assertEquals(missade.slice(0, 8), [], `${missade.length} av ${provade} slank igenom`);
  assert(provade > 5000, `bara ${provade} kombinationer prövade`);
});

Deno.test("slaglängdens gränser larmar åt båda hållen", () => {
  // Taket: Ø32 slutar vid 1370, inte 1500.
  assert(fel({ size: "032", stroke_mm: 1371, pitch: "1", version: "1", drive_pack: "2220" })
    .some((m) => m.includes("1370")));
  assertEquals(fel({ size: "032", stroke_mm: 1370, pitch: "1", version: "1", drive_pack: "2220" }), []);
  // Ø50 får gå till 1500.
  assertEquals(fel({ size: "050", stroke_mm: 1500, pitch: "2", version: "1", drive_pack: "1430" }), []);

  // Golvet utan vridningsskydd: 80 mm för Ø32, 125 för Ø80.
  assert(fel({ size: "032", stroke_mm: 79, pitch: "1", version: "1", drive_pack: "2220" })
    .some((m) => m.includes("smörja om")));
  assert(fel({ size: "080", stroke_mm: 124, pitch: "4", version: "3", drive_pack: "1890" })
    .some((m) => m.includes("125")));
  assertEquals(fel({ size: "080", stroke_mm: 125, pitch: "4", version: "3", drive_pack: "1890" }), []);

  // Golvet MED vridningsskydd är två gånger stigningen -- alltså LÄGRE.
  assertEquals(fel({ size: "032", stroke_mm: 8, pitch: "1", version: "2", drive_pack: "2220" }), [],
    "8 mm går med vridningsskydd och stigning 4");
  assert(fel({ size: "032", stroke_mm: 7, pitch: "1", version: "2", drive_pack: "2220" })
    .some((m) => m.includes("kulorna")));
});

Deno.test("ett felval ger en rad, inte tre", () => {
  // Kombinationsregeln är vaktad så att den inte larmar ovanpå stignings- och
  // versionsreglerna. En kund som väljer fel stigning för Ø63 HD ska få veta
  // vilka stigningar som finns -- inte tre överlappande meningar.
  const f = fel({ size: "H63", stroke_mm: 400, pitch: "1", version: "1", drive_pack: "1450" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("5 eller 10"), f[0]);
});

Deno.test("den nästade skillnaden larmar med egen text", () => {
  // Ø32 stigning 1, version 3 (IP55), motor 1110: varje del finns för Ø32,
  // men just den kombinationen står inte i tabellen.
  const f = fel({ size: "032", stroke_mm: 500, pitch: "1", version: "3", drive_pack: "1110" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("inte tillsammans"), f[0]);
  // Och samma motor med en IP40-version går bra.
  assertEquals(fel({ size: "032", stroke_mm: 500, pitch: "1", version: "1", drive_pack: "1110" }), []);
});

Deno.test("vridningsvarningen är en varning, inte ett fel", () => {
  const ctx = buildRuleContext(
    { size: "032", stroke_mm: 500, pitch: "1", version: "1", drive_pack: "2220" },
    NUMERISKA,
  );
  const varningar = REGLER.filter((r) => r.severity === "warn" && evalLogic(r.if_json, ctx) === true);
  assertEquals(varningar.length, 1);
  assert(varningar[0].message_sv.includes("hindras från att"), varningar[0].message_sv);
  // Med vridningsskydd ska den tiga.
  const ctx2 = buildRuleContext(
    { size: "032", stroke_mm: 500, pitch: "1", version: "2", drive_pack: "2220" },
    NUMERISKA,
  );
  assertEquals(REGLER.filter((r) => r.severity === "warn" && evalLogic(r.if_json, ctx2) === true).length, 0);
});

Deno.test("en tom konfiguration larmar inte", () => {
  // Kunden ska inte mötas av röda rader innan hen valt något.
  assertEquals(fel({ size: "", stroke_mm: 0, pitch: "", version: "", drive_pack: "" }), []);
});

Deno.test("varje regel har både svensk och engelsk text", () => {
  const trasiga = REGLER.filter((r) => !r.message_sv?.trim() || !r.message_en?.trim());
  assertEquals(trasiga.length, 0);
  // Och ingen svensk text får ha blivit den engelska.
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
});
