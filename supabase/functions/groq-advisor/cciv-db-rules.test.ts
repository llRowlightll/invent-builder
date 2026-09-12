/**
 * CCIV-reglerna som faktiskt körs, mot modellen som faktiskt bygger koden.
 *
 * Samma invariant som ELEKTRO fick: en kombination modellen vägrar bygga
 * MÅSTE ge minst ett fel, och en den bygger får inte ge något. Reglerna körs
 * genom samma evalLogic och samma kontext som produktionen.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildRuleContext, evalLogic } from "../../../src/lib/configurator-engine.ts";
import { buildCcivDbRules } from "../../../src/lib/catalog/cciv-db-rules.ts";
import {
  CCIV_BORES,
  CCIV_CONNECTIONS,
  CCIV_FITTINGS,
  CCIV_MAGNETS,
  CCIV_MATERIALS,
  CCIV_TYPES,
  ccivBuildCode,
} from "../../../src/lib/catalog/cciv.ts";

const REGLER = buildCcivDbRules();
const NUMERISKA = ["stroke_mm"];

function kor(val: Record<string, string | number>, niva: string): string[] {
  const ctx = buildRuleContext(val, NUMERISKA);
  return REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx) === true)
    .map((r) => r.message_sv);
}
const fel = (v: Record<string, string | number>) => kor(v, "error");
const varn = (v: Record<string, string | number>) => kor(v, "warn");

Deno.test("varje regel läser bara fält som finns", () => {
  const falt = new Set(["type", "action", "magnet", "bore", "stroke_mm",
    "material", "gaskets", "connection", "fittings"]);
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

Deno.test("modellen och reglerna är överens, uttömmande", () => {
  // Hela korsprodukten: 4 typer × 3 magneter × 4 borrningar × 2 material ×
  // 2 kontakter × 5 anslutningar × 3 slaglängder. Det mesta är beställbart,
  // och undantagen är precis de två fotnoterna.
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const t of CCIV_TYPES) {
    for (const mag of CCIV_MAGNETS) {
      for (const b of CCIV_BORES) {
        for (const m of CCIV_MATERIALS) {
          for (const c of CCIV_CONNECTIONS) {
            for (const f of CCIV_FITTINGS) {
              for (const slag of [5, 100, b.stroke_max_mm + 1]) {
                const v = {
                  type: t.code, action: "0", magnet: mag.code, bore: b.code,
                  stroke_mm: slag, material: m.code, gaskets: "P",
                  connection: c.code, fittings: f.code,
                };
                const kod = ccivBuildCode({
                  type: t.code, magnet: mag.code, bore: b.code, stroke_mm: slag,
                  material: m.code, connection: c.code, fittings: f.code,
                });
                const f_ = fel(v);
                n++;
                if (!kod && f_.length === 0) missade.push(JSON.stringify(v));
                if (kod && f_.length > 0) falsklarm.push(`${kod}: ${f_.join(" | ")}`);
              }
            }
          }
        }
      }
    }
  }
  assertEquals(missade.slice(0, 6), [], `${missade.length} av ${n} slank igenom`);
  assertEquals(falsklarm.slice(0, 6), [], `${falsklarm.length} falsklarm`);
  assert(n > 1000, `bara ${n} kombinationer prövade`);
});

Deno.test("de två fotnoterna larmar med var sin text", () => {
  const isoPaLiten = fel({
    type: "25", action: "0", magnet: "0", bore: "20", stroke_mm: 50,
    material: "X", gaskets: "P", connection: "2", fittings: "1",
  });
  assertEquals(isoPaLiten.length, 1, isoPaLiten.join(" | "));
  assert(isoPaLiten[0].includes("ISO-centrumavstånd"), isoPaLiten[0]);

  const c45PaLiten = fel({
    type: "23", action: "0", magnet: "0", bore: "20", stroke_mm: 50,
    material: "C", gaskets: "P", connection: "2", fittings: "1",
  });
  assertEquals(c45PaLiten.length, 1, c45PaLiten.join(" | "));
  assert(c45PaLiten[0].includes("rostfri kolvstång"), c45PaLiten[0]);
});

Deno.test("slaglängden larmar i tre steg", () => {
  const bas = { type: "23", action: "0", magnet: "G", bore: "20", material: "X", gaskets: "P", connection: "M", fittings: "1" };
  // Under 5 mm: fel.
  assert(fel({ ...bas, stroke_mm: 4 }).some((m) => m.includes("Minsta slaglängd")));
  // 5-50 mm: tyst.
  assertEquals(fel({ ...bas, stroke_mm: 50 }), []);
  assertEquals(varn({ ...bas, stroke_mm: 50 }), []);
  // 51-200 mm: varning om leveranstid, inget fel.
  assertEquals(fel({ ...bas, stroke_mm: 120 }), []);
  assert(varn({ ...bas, stroke_mm: 120 }).some((m) => m.includes("lagervara")));
  // Över 200: fel.
  assert(fel({ ...bas, stroke_mm: 201 }).some((m) => m.includes("200 mm")));
});

Deno.test("stick-slip-rådet gäller bara de små borrningarna", () => {
  const bas = { type: "23", action: "0", bore: "20", stroke_mm: 50, material: "X", gaskets: "P", connection: "M", fittings: "1" };
  assert(varn({ ...bas, magnet: "0" }).some((m) => m.includes("stick-slip")));
  assertEquals(varn({ ...bas, magnet: "G" }).filter((m) => m.includes("stick-slip")), []);
  // Ø32 har magnetisk kolv som standard och får inget råd.
  assertEquals(
    varn({ ...bas, bore: "32", magnet: "0" }).filter((m) => m.includes("stick-slip")),
    [],
  );
});

Deno.test("plug-in-kontakten får en IP-varning, M8 inte", () => {
  const bas = { type: "23", action: "0", magnet: "G", bore: "20", stroke_mm: 50, material: "X", gaskets: "P", fittings: "1" };
  assert(varn({ ...bas, connection: "2" }).some((m) => m.includes("IP51")));
  assertEquals(varn({ ...bas, connection: "M" }).filter((m) => m.includes("IP51")), []);
});

Deno.test("en tom konfiguration larmar inte", () => {
  assertEquals(fel({
    type: "", action: "", magnet: "", bore: "", stroke_mm: 0,
    material: "", gaskets: "", connection: "", fittings: "",
  }), []);
  assertEquals(varn({
    type: "", action: "", magnet: "", bore: "", stroke_mm: 0,
    material: "", gaskets: "", connection: "", fittings: "",
  }), []);
});

Deno.test("varje regel har både svensk och engelsk text", () => {
  assertEquals(REGLER.filter((r) => !r.message_sv?.trim() || !r.message_en?.trim()).length, 0);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
});

Deno.test("svenskan använder 'och' i uppräkningar, inte komma till slutet", () => {
  // "Ø32, Ø40" läser illa i en mening. Regeln byggs med en listfunktion, och
  // det här testet är det som gör att den används.
  const r = REGLER.find((x) => x.message_sv.includes("ISO-centrumavstånd"))!;
  assert(r.message_sv.includes("Ø32 och Ø40"), r.message_sv);
  assert(r.message_sv.includes("Ø20 och Ø25"), r.message_sv);
});
