/**
 * MFH-reglerna mot artikellistan.
 *
 * MFH är den första familjen där konfiguratorn KOMPONERAR ett namn ur delarna
 * fast katalogen listar färdiga artiklar. Det är tillåtet bara därför att
 * `mfh.test.ts` bevisar att kompositionen ger exakt katalogens namn för alla
 * 76 -- men det flyttar ansvaret till reglerna: allt som går att komponera och
 * inte finns MÅSTE larma.
 *
 * Testet nedan prövar hela korsprodukten, 8 serier x 2 funktioner x 4 gängor
 * x 2 pilotlägen x 2 ATEX x 2 B = 512 kombinationer, mot de 76 som finns.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { buildMfhDbRules } from "../../../src/lib/catalog/mfh-db-rules.ts";
import {
  MFH_ARTICLES,
  MFH_FUNCTIONS,
  MFH_SERIES,
  MFH_THREADS,
} from "../../../src/lib/catalog/mfh.ts";

const REGLER = buildMfhDbRules();

/** Bygger kontexten precis som configurator.$family.tsx gör (inga numeriska fält). */
function ctx(v: Record<string, string>): Record<string, unknown> {
  return {
    series: "", fn: "", thread: "", ext_pilot: "", atex: "", b_variant: "", ...v,
  };
}
function kor(v: Record<string, string>, niva: string): string[] {
  const c = ctx(v);
  return REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, c) === true)
    .map((r) => r.message_sv);
}
const fel = (v: Record<string, string>) => kor(v, "error");

/** Finns kombinationen som artikel? */
function finns(v: Record<string, string>): boolean {
  return MFH_ARTICLES.some((a) =>
    a.series === v.series && a.fn === v.fn && a.thread === v.thread &&
    Boolean(a.ext_pilot) === (v.ext_pilot === "S") &&
    Boolean(a.atex) === (v.atex === "EX") &&
    Boolean(a.b_variant) === (v.b_variant === "B")
  );
}

Deno.test("varje regel läser bara fält som finns", () => {
  const falt = new Set(["series", "fn", "thread", "ext_pilot", "atex", "b_variant"]);
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

Deno.test("UTTÖMMANDE: allt som inte finns larmar, allt som finns tiger", () => {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  let n = 0;
  for (const s of MFH_SERIES) {
    for (const f of MFH_FUNCTIONS) {
      for (const t of MFH_THREADS) {
        for (const p of ["", "S"]) {
          for (const a of ["", "EX"]) {
            for (const b of ["", "B"]) {
              const v = { series: s.code, fn: f.code, thread: t.code, ext_pilot: p, atex: a, b_variant: b };
              const larm = fel(v);
              n++;
              if (finns(v) && larm.length > 0) falsklarm.push(`${JSON.stringify(v)}: ${larm.join(" | ")}`);
              if (!finns(v) && larm.length === 0) missade.push(JSON.stringify(v));
            }
          }
        }
      }
    }
  }
  assertEquals(falsklarm.slice(0, 6), [], `${falsklarm.length} falsklarm av ${n}`);
  assertEquals(missade.slice(0, 6), [], `${missade.length} slank igenom av ${n}`);
  assertEquals(n, 512);
});

Deno.test("de bistabila finns bara som 5/2", () => {
  for (const s of ["JH", "JDH", "JMFH", "JMFDH", "VL"]) {
    const f = fel({ series: s, fn: "3", thread: "1/8" });
    assert(f.some((m) => m.includes("5/2-vägsventil")), `${s}: ${f.join(" | ")}`);
  }
  // Och MOFH och VL/O bara som 3/2.
  for (const s of ["MOFH", "VL/O"]) {
    assert(fel({ series: s, fn: "5", thread: "1/8" }).some((m) => m.includes("3/2-vägsventil")));
  }
  // MFH finns som båda.
  assertEquals(fel({ series: "MFH", fn: "3", thread: "1/8" }), []);
  assertEquals(fel({ series: "MFH", fn: "5", thread: "1/8" }), []);
});

Deno.test("MOFH har ingen extern pilotluft", () => {
  const f = fel({ series: "MOFH", fn: "3", thread: "1/8", ext_pilot: "S" });
  assert(f.some((m) => m.includes("intern pilotluft")), f.join(" | "));
  assertEquals(fel({ series: "MOFH", fn: "3", thread: "1/8" }), []);
});

Deno.test("5/2 i G3/4 larmar", () => {
  const f = fel({ series: "MFH", fn: "5", thread: "3/4" });
  assert(f.some((m) => m.includes("G1/8, G1/4 och G1/2")), f.join(" | "));
});

Deno.test("B-varianten är låst till VL/O i G1/8, åt båda hållen", () => {
  // Den finns bara där...
  assert(fel({ series: "MFH", fn: "3", thread: "1/8", b_variant: "B" })
    .some((m) => m.includes("B-utförandet")));
  assert(fel({ series: "VL/O", fn: "3", thread: "1/4", b_variant: "B" })
    .some((m) => m.includes("B-utförandet")));
  // ...och där finns BARA den.
  assert(fel({ series: "VL/O", fn: "3", thread: "1/8" })
    .some((m) => m.includes("bara i B-utförande")));
  assertEquals(fel({ series: "VL/O", fn: "3", thread: "1/8", b_variant: "B" }), []);
});

Deno.test("en tom konfiguration larmar inte", () => {
  assertEquals(fel({}), []);
  assertEquals(fel({ series: "MFH" }), []);
  assertEquals(kor({}, "warn"), []);
});

Deno.test("tryck- och ATEX-råden är varningar", () => {
  const v = kor({ series: "MFH", fn: "5", thread: "1/4" }, "warn");
  assert(v.some((m) => m.includes("8 bar")), v.join(" | "));
  assertEquals(fel({ series: "MFH", fn: "5", thread: "1/4" }), [], "och inget fel");

  const a = kor({ series: "MFH", fn: "3", thread: "1/8", atex: "EX" }, "warn");
  assert(a.some((m) => m.includes("II 2G Ex h IIC T4 Gb")), a.join(" | "));
});

Deno.test("varje regel har både svensk och engelsk text", () => {
  assertEquals(REGLER.filter((r) => !r.message_sv?.trim() || !r.message_en?.trim()).length, 0);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
});
