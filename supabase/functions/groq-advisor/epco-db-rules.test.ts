/**
 * EPCO-reglerna som faktiskt körs, mot modellen som faktiskt bygger koden.
 *
 * Samma invariant som ELEKTRO och CCIV: en kombination modellen vägrar bygga
 * MÅSTE ge minst ett fel, och en den bygger får inte ge något.
 *
 * EPCO:s fall är det svåraste hittills, eftersom katalogens villkor är
 * KRAVFULLA och inte förbudande: "A måste väljas om E inte är vald" går inte
 * att uttrycka som "A finns inte tillsammans med X". Ett fel i den
 * översättningen skulle släppa igenom en cylinder utan lägesåterkoppling.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildRuleContext, evalLogic } from "../../../src/lib/configurator-engine.ts";
import { buildEpcoDbRules } from "../../../src/lib/catalog/epco-db-rules.ts";
import {
  EPCO_BRAKES,
  EPCO_BUS,
  EPCO_CONTROLLERS,
  EPCO_GUIDE_UNITS,
  EPCO_MEASURING,
  EPCO_POSITION_SENSING,
  EPCO_SIZES,
  EPCO_SWITCHING,
  epcoBuildCode,
} from "../../../src/lib/catalog/epco.ts";

const REGLER = buildEpcoDbRules();
const NUMERISKA = ["stroke_mm", "extension_mm"];

function kor(v: Record<string, string | number>, niva: string): string[] {
  const ctx = buildRuleContext(v, NUMERISKA);
  return REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx) === true)
    .map((r) => r.message_sv);
}
const fel = (v: Record<string, string | number>) => kor(v, "error");

/** Konfiguratorns fulla fältuppsättning, med tomma förval. */
function bas(over: Record<string, string | number> = {}): Record<string, string | number> {
  return {
    size: "", stroke_mm: 0, pitch: "", rod_thread: "", extension_mm: 0,
    position_sensing: "", measuring: "", brake: "", cable_direction: "",
    guide_unit: "", cable: "", controller: "", bus: "", switching: "",
    ...over,
  };
}

Deno.test("varje regel läser bara fält som finns", () => {
  const falt = new Set(Object.keys(bas()));
  const okanda = new Set<string>();
  const ga = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(ga);
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.var === "string" && !falt.has(o.var)) okanda.add(o.var);
    Object.values(o).forEach(ga);
  };
  REGLER.forEach((r) => ga(r.if_json));
  assertEquals([...okanda], [], `regler läser fält som inte finns: ${[...okanda]}`);
});

Deno.test("modellen och reglerna är överens, uttömmande över villkoren", () => {
  // Korsprodukten över de fält katalogens fem villkor rör: mätsystem,
  // positionsavkänning, styrenhet, förlängning, kabel, styrning, buss och
  // in-/utgång. Storlek och stigning hålls giltiga så att bara villkoren
  // prövas.
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  const kablar = ["", "5E"];
  for (const m of EPCO_MEASURING) {
    for (const ps of EPCO_POSITION_SENSING) {
      for (const g of EPCO_GUIDE_UNITS) {
        for (const ext of [0, 50]) {
          for (const kabel of kablar) {
            for (const ctrl of EPCO_CONTROLLERS) {
              for (const b of EPCO_BUS) {
                for (const sw of EPCO_SWITCHING) {
                  const v = bas({
                    size: "25", stroke_mm: 100, pitch: "3P",
                    measuring: m.code, position_sensing: ps.code,
                    guide_unit: g.code, extension_mm: ext, cable: kabel,
                    controller: ctrl.code, bus: b.code, switching: sw.code,
                  });
                  const kod = epcoBuildCode({
                    size: 25, stroke_mm: 100, pitch: "3P",
                    measuring: m.code, position_sensing: ps.code,
                    guide_unit: g.code, extension_mm: ext, cable: kabel,
                    controller: ctrl.code, bus: b.code, switching: sw.code,
                  });
                  const f = fel(v);
                  n++;
                  if (!kod && f.length === 0) missade.push(JSON.stringify(v));
                  if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
                }
              }
            }
          }
        }
      }
    }
  }
  assertEquals(missade.slice(0, 6), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 6), [], `${falsklarm.length} falsklarm`);
  assert(n > 400, `bara ${n} kombinationer prövade`);
});

Deno.test("modellen och reglerna är överens om storlek, slag och stigning", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  const alla = [...new Set(EPCO_SIZES.flatMap((s) => s.strokes))];
  const stigningar = [...new Set(EPCO_SIZES.flatMap((s) => s.pitches))];
  for (const s of EPCO_SIZES) {
    for (const slag of [...alla, 110]) {
      for (const p of stigningar) {
        const v = bas({ size: String(s.size), stroke_mm: slag, pitch: p, measuring: "E" });
        const kod = epcoBuildCode({ size: s.size, stroke_mm: slag, pitch: p, measuring: "E" });
        const f = fel(v);
        if (!kod && f.length === 0) missade.push(`${s.size}/${slag}/${p}`);
        if (kod && f.length > 0) falsklarm.push(`${s.size}/${slag}/${p}: ${f.join(" | ")}`);
      }
    }
  }
  assertEquals(missade.slice(0, 6), []);
  assertEquals(falsklarm.slice(0, 6), []);
});

Deno.test("villkor [1] larmar med en mening som säger varför", () => {
  const f = fel(bas({ size: "16", stroke_mm: 100, pitch: "3P" }));
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("var kolvstången är"), f[0]);
  // Med endera är det tyst.
  assertEquals(fel(bas({ size: "16", stroke_mm: 100, pitch: "3P", measuring: "E" })), []);
  assertEquals(fel(bas({ size: "16", stroke_mm: 100, pitch: "3P", position_sensing: "A" })), []);
});

Deno.test("villkor [1] tiger innan kunden valt något", () => {
  // Regeln är vaktad av att storlek och stigning redan är valda. Annars
  // skulle en tom konfigurator mötas av en röd rad.
  assertEquals(fel(bas()), []);
  assertEquals(fel(bas({ size: "16" })), []);
});

Deno.test("ingen regel larmar på en halvifylld sida", () => {
  // FÄLLAN: fälten är numeriska, så en tom ruta blir Number("") = 0. En vakt
  // skriven som {"!=": [stroke_mm, ""]} är då SANN för den tomma rutan --
  // 0 är inte lika med "" -- och slagregeln larmar innan kunden hunnit
  // skriva något. Vakten måste vara "> 0".
  assertEquals(fel(bas({ size: "16" })), [], "storlek vald, inget annat");
  assertEquals(fel(bas({ size: "16", pitch: "3P" })), [], "storlek och stigning");
  assertEquals(fel(bas({ size: "40", pitch: "5P", stroke_mm: 0 })), [],
    "slagrutan tom");
  // Och så fort ett slag är angivet ska den fungera.
  assertEquals(fel(bas({ size: "16", pitch: "3P", stroke_mm: 110, measuring: "E" })).length, 1);
  assertEquals(fel(bas({ size: "16", pitch: "3P", stroke_mm: 100, measuring: "E" })), []);
});

Deno.test("kontexten byggs som konfiguratorsidan bygger den", () => {
  // configurator.$family.tsx bygger INTE kontexten med buildRuleContext utan
  // inline: `p.param_type === "number" ? Number(v || 0) : v`. Testet härmar
  // det, för det är den koden som kör i produktion. Skulle sidan någon gång
  // gå över till buildRuleContext ska det här testet falla, inte tiga.
  const somSidan = (v: Record<string, string | number>) => {
    const numeriska = new Set(NUMERISKA);
    const ctx: Record<string, unknown> = {};
    for (const [k, raw] of Object.entries(v)) {
      ctx[k] = numeriska.has(k) ? Number(raw || 0) : raw;
    }
    return REGLER.filter((r) => r.severity === "error" && evalLogic(r.if_json, ctx) === true).length;
  };
  assertEquals(somSidan(bas({ size: "25", stroke_mm: 100, pitch: "3P", measuring: "E" })), 0);
  assertEquals(somSidan(bas({ size: "25", stroke_mm: 110, pitch: "3P", measuring: "E" })), 1);
  assertEquals(somSidan(bas({ size: "25", pitch: "3P" })), 0, "halvifyllt");
});

Deno.test("villkor [2] till [5] larmar var för sig", () => {
  const b = { size: "25", stroke_mm: 100, pitch: "3P", measuring: "E" };
  // [2] styrenhet + förlängning
  assert(fel(bas({ ...b, guide_unit: "KF", extension_mm: 50 }))
    .some((m) => m.includes("styrstängerna")));
  // [3] kabel utan pulsgivare
  assert(fel(bas({ size: "25", stroke_mm: 100, pitch: "3P", position_sensing: "A", cable: "5E" }))
    .some((m) => m.includes("Motorkabel")));
  // [4] styrning utan buss
  assert(fel(bas({ ...b, controller: "C5" }))
    .some((m) => m.includes("bussprotokoll")));
  // [5] NPN + IO-Link
  assert(fel(bas({ ...b, controller: "C5", bus: "LK", switching: "N" }))
    .some((m) => m.includes("IO-Link")));
});

Deno.test("nyttolastrådet är info, inte fel", () => {
  const info = kor(bas({ size: "16", stroke_mm: 100, pitch: "8P", measuring: "E" }), "info");
  assertEquals(info.length, 1, info.join(" | "));
  assert(info[0].includes("8 kg"), info[0]);
  assert(info[0].includes("24 kg"), info[0]);
  // Den långsamma skruven får inget råd.
  assertEquals(kor(bas({ size: "16", stroke_mm: 100, pitch: "3P", measuring: "E" }), "info"), []);
  // Och det är inte ett fel.
  assertEquals(fel(bas({ size: "16", stroke_mm: 100, pitch: "8P", measuring: "E" })), []);
});

Deno.test("slaglängden larmar med hela listan, inte ett intervall", () => {
  const f = fel(bas({ size: "16", stroke_mm: 110, pitch: "3P", measuring: "E" }));
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("50, 75, 100, 125, 150, 175 och 200"), f[0]);
  assert(f[0].includes("Mellanlängder"), f[0]);
});

Deno.test("varje regel har både svensk och engelsk text", () => {
  assertEquals(REGLER.filter((r) => !r.message_sv?.trim() || !r.message_en?.trim()).length, 0);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
});

Deno.test("bromsen och kabelriktningen har inga villkor", () => {
  // Katalogen sätter inga. Ett test som pinnar fast det, så att en framtida
  // regel inte smyger in utan källa.
  const b = { size: "25", stroke_mm: 100, pitch: "3P", measuring: "E" };
  for (const brake of EPCO_BRAKES) {
    for (const dir of ["", "D", "L", "R"]) {
      assertEquals(
        fel(bas({ ...b, brake: brake.code, cable_direction: dir })), [],
        `broms ${brake.code}, riktning ${dir}`,
      );
    }
  }
});
