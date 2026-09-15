/**
 * MXS-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel (MXS12-50ASFR-M9BW, sida 64), kombinationsmatrisen
 * justering × funktion (sida 64) avskriven här igen, kraften kontrollerad mot
 * kolvarean (dubbel kolvstång: arean står i tabellen på sida 65), och
 * dimensionstabellernas MXS6L-10 … som bekräftar den symmetriska formen.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildMxsDbRules } from "../../../src/lib/catalog/mxs-db-rules.ts";
import {
  MXS_ADJUSTERS,
  MXS_BORES,
  MXS_FUNCTIONALS,
  MXS_LEADS,
  MXS_MTO,
  MXS_ORDER_CODE_TEMPLATE,
  MXS_PORTS,
  MXS_SOURCE,
  MXS_SWITCHES,
  type MxsConfig,
  mxsBuildCode,
  mxsParseCode,
} from "../../../src/lib/catalog/mxs.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(MXS_SOURCE.file, "smc-kat-mxs.pdf");
  assertEquals(MXS_BORES.map((b) => b.bore_mm), [6, 8, 12, 16, 20, 25]);
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[MxsConfig, string]> = [
    [{ bore: "12", stroke_mm: 50, adjuster: "AS", functional: "FR", switch: "M9BW" }, "MXS12-50ASFR-M9BW"],
    [{ bore: "12", stroke_mm: 50, symmetric: true, adjuster: "AS", switch: "M9BW" }, "MXS12L-50AS-M9BW"],
    [{ bore: "6", stroke_mm: 10, symmetric: true }, "MXS6L-10"],
    [{ bore: "8", stroke_mm: 75 }, "MXS8-75"],
    [{ bore: "25", stroke_mm: 150, port: "TF" }, "MXS25TF-150"],
    [{ bore: "20", stroke_mm: 100, port: "TN", symmetric: true, adjuster: "B" }, "MXS20TNL-100B"],
    [{ bore: "16", stroke_mm: 125, switch: "M9NW", lead: "L", count: "S", mto: "X39" }, "MXS16-125-M9NWLS-X39"],
    [{ bore: "12", stroke_mm: 30, mto: "X12" }, "MXS12-30-X12"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(mxsBuildCode(c), kod);
    assertEquals(mxsBuildCode(mxsParseCode(kod)!.config), kod);
  }
});

Deno.test("kraften på sida 65 är kolvarean gånger trycket", () => {
  // Dubbel kolvstång: kolvarean är två gånger π·(d/2)². Tabellens area står
  // som 57, 101, 226, 402, 628, 982 mm² -- exakt 2·π·r².
  for (const b of MXS_BORES) {
    const area = 2 * Math.PI * (b.bore_mm / 2) ** 2;
    const kraft = area * 0.5;
    // SMC avrundar arean först (57 mm² för ø6), så små borrningar avviker en newton.
    assert(Math.abs(kraft - b.force_out_n_05mpa) <= Math.max(1, kraft * 0.01), `ø${b.bore_mm}: ${kraft.toFixed(1)} vs ${b.force_out_n_05mpa}`);
  }
});

Deno.test("kombinationsmatrisen justering × funktion (sida 64)", () => {
  // Rad för rad: Nil F R P FR FP -- ○ = går.
  const matris: Record<string, string> = {
    AS: "○○○○○○", AT: "○○××××", A: "○○××××", BS: "○×○○××", BT: "○○××××", B: "○×××××", ASBT: "○○××××", BSAT: "○×××××",
  };
  const kol = ["", "F", "R", "P", "FR", "FP"];
  for (const [adj, rad] of Object.entries(matris)) {
    for (let i = 0; i < kol.length; i++) {
      const kod = mxsBuildCode({ bore: "12", stroke_mm: 50, adjuster: adj, functional: kol[i] || undefined });
      assertEquals(kod !== null, rad[i] === "○", `${adj} × ${kol[i] || "Nil"}`);
    }
  }
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = mxsBuildCode;
  assertEquals(b({ bore: "6", stroke_mm: 75 }), null, "ø6 slutar vid 50");
  assertEquals(b({ bore: "12", stroke_mm: 60 }), null, "inga mellanslag");
  assertEquals(b({ bore: "12", stroke_mm: 50, port: "TN" }), null, "TN bara ø20/25");
  assertEquals(b({ bore: "6", stroke_mm: 50, adjuster: "BS" }), null, "stötdämpare inte ø6");
  assertEquals(b({ bore: "6", stroke_mm: 50, functional: "R" }), null, "ändlägeslås inte ø6");
  assertEquals(b({ bore: "12", stroke_mm: 50, symmetric: true, functional: "F" }), null, "L utan funktionsoptioner");
  assertEquals(b({ bore: "12", stroke_mm: 50, lead: "L" }), null);
  assertEquals(b({ bore: "12", stroke_mm: 50, switch: "M9BW", mto: "X33" }), null);
  assert(b({ bore: "12", stroke_mm: 50, mto: "X33" }));
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildMxsDbRules();
function ctx(c: MxsConfig): Record<string, unknown> {
  return {
    bore: c.bore, stroke_mm: Number(c.stroke_mm || 0), port: c.port ?? "", symmetric: c.symmetric ? "L" : "", adjuster: c.adjuster ?? "",
    functional: c.functional ?? "", switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: MxsConfig, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: MxsConfig) => kor(c, "error");

Deno.test("modellen och reglerna är överens", () => {
  const prov: MxsConfig[] = [];
  for (const b of MXS_BORES) for (const stroke_mm of [10, 50, 60, 75, 100, 150]) for (const port of ["", ...MXS_PORTS.map((p) => p.code)])
    for (const sym of [false, true]) for (const adjuster of ["", ...MXS_ADJUSTERS.map((a) => a.code)]) for (const functional of ["", ...MXS_FUNCTIONALS.map((f) => f.code)])
      prov.push({ bore: b.code, stroke_mm, port: port || undefined, symmetric: sym, adjuster: adjuster || undefined, functional: functional || undefined });
  for (const sw of ["", ...MXS_SWITCHES.map((s) => s.code)]) for (const lead of ["", ...MXS_LEADS.map((l) => l.code)]) for (const count of ["", "S"]) for (const mto of ["", ...MXS_MTO.map((m) => m.code)])
    prov.push({ bore: "12", stroke_mm: 50, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined });
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = mxsBuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${falsklarm.length} falsklarm`);
  assert(prov.length > 6000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: MxsConfig) => ({ ...ctx(c), stroke_mm: c.stroke_mm });
  for (const c of [
    { bore: "12", stroke_mm: 50, adjuster: "AS", functional: "FR", switch: "M9BW" },
    { bore: "6", stroke_mm: 10, symmetric: true },
    { bore: "25", stroke_mm: 150, port: "TF", switch: "A93", lead: "M", count: "S", mto: "X7" },
  ] as MxsConfig[]) {
    assertEquals(fillOrderCodeTemplate(MXS_ORDER_CODE_TEMPLATE, val(c), new Set(["bore", "stroke_mm"])), mxsBuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const f = fel({ bore: "12", stroke_mm: 50, adjuster: "BS", functional: "F" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("R eller P"), f[0]);
  assert(fel({ bore: "6", stroke_mm: 50, functional: "FR" }).some((m) => m.includes("Ändlägeslås")));
  assert(kor({ bore: "20", stroke_mm: 50 }, "info").some((m) => m.includes("314 N")));
  const tom = { bore: "", stroke_mm: 0 } as MxsConfig;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});
