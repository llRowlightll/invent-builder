/**
 * C85-modellen och dess regler mot katalogen.
 *
 * Facit: nyckelns exempel CD85N20-40CJLV-B-M9BWS (sida 6) och katalogens
 * beställningsexempel CD85N20-50CNW-B-M9BW (sida 7), standardslagen och
 * gränserna (sida 7) avskrivna här igen, fäste-mot-gavel-matrisen (sida 6).
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { fillOrderCodeTemplate } from "../../../src/lib/catalog/order-code-template.ts";
import { buildC85DbRules } from "../../../src/lib/catalog/c85-db-rules.ts";
import {
  C85_ACCESSORIES,
  C85_BORES,
  C85_BRACKETS,
  C85_COVERS,
  C85_LEADS,
  C85_MTO,
  C85_ORDER_CODE_TEMPLATE,
  C85_SOURCE,
  C85_SWITCHES,
  type C85Config,
  c85BuildCode,
  c85ParseCode,
} from "../../../src/lib/catalog/c85.ts";

Deno.test("modellen bär sin källa", () => {
  assertEquals(C85_SOURCE.file, "smc-kat-c85.pdf");
  assertEquals(C85_BORES.map((b) => b.bore_mm), [8, 10, 12, 16, 20, 25], "ISO 6432 slutar vid ø25");
});

Deno.test("katalogens exempel byggs tecken för tecken", () => {
  const fall: Array<[C85Config, string]> = [
    [{ bore: "20", cover: "N", stroke_mm: 40, magnet: true, cushion: true, boot: "J", bracket: "L", accessory: "V", switch_mount: "B", switch: "M9BW", count: "S" }, "CD85N20-40CJLV-B-M9BWS"],
    [{ bore: "20", cover: "N", stroke_mm: 50, magnet: true, cushion: true, bracket: "N", accessory: "W", switch_mount: "B", switch: "M9BW" }, "CD85N20-50CNW-B-M9BW"],
    [{ bore: "16", cover: "N", stroke_mm: 100 }, "C85N16-100"],
    [{ bore: "12", cover: "E", stroke_mm: 25, bracket: "M" }, "C85E12-25M"],
    [{ bore: "25", cover: "Y", stroke_mm: 300, magnet: true, switch_mount: "A", switch: "F79F", lead: "L" }, "CD85Y25-300-A-F79FL"],
    [{ bore: "10", cover: "N", stroke_mm: 250, mto: "X2018" }, "C85N10-250-X2018"],
  ];
  for (const [c, kod] of fall) {
    assertEquals(c85BuildCode(c), kod);
    assertEquals(c85BuildCode(c85ParseCode(kod)!.config), kod);
  }
});

Deno.test("standardslag och gränser följer sida 7", () => {
  const b = (k: string) => C85_BORES.find((x) => x.code === k)!;
  assertEquals(b("8").standard_strokes, [10, 25, 40, 50, 80, 100]);
  assertEquals(b("16").standard_strokes, [10, 25, 40, 50, 80, 100, 125, 160, 200]);
  assertEquals(b("25").standard_strokes, [10, 25, 40, 50, 80, 100, 125, 160, 200, 250, 300]);
  assertEquals([b("8").max_stroke_mm, b("12").max_stroke_mm, b("20").max_stroke_mm], [200, 400, 1000]);
  assertEquals(b("8").min_pressure_cushion_mpa, null, "ø8 utan luftdämpning");
});

Deno.test("fäste-mot-gavel-matrisen (sida 6)", () => {
  const matris: Record<string, string> = { N: "LMGUN", E: "LMGU", F: "LGU", Y: "LGU" };
  for (const c of C85_COVERS) {
    for (const br of C85_BRACKETS) {
      const kod = c85BuildCode({ bore: "20", cover: c.code, stroke_mm: 50, bracket: br.code });
      assertEquals(kod !== null, matris[c.code].includes(br.code), `${c.code} × ${br.code}`);
    }
  }
});

Deno.test("modellen vägrar det katalogen inte har", () => {
  const b = c85BuildCode;
  assertEquals(b({ bore: "8", cover: "N", stroke_mm: 40, cushion: true }), null);
  assertEquals(b({ bore: "20", cover: "E", stroke_mm: 40, cushion: true }), null);
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 10, cushion: true }), null, "minsta slag 25 med luftdämpning");
  assertEquals(b({ bore: "16", cover: "N", stroke_mm: 40, boot: "J" }), null);
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, switch_mount: "B" }), null, "givarfäste utan magnet");
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, magnet: true }), null, "magnet utan givarfäste");
  assertEquals(b({ bore: "12", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "B", switch: "A96" }), null, "A96 inte ø8–12");
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "A", switch: "M9BW" }), null, "M9 inte på skena ø20/25");
  assert(b({ bore: "16", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "A", switch: "M9BW" }));
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "A", switch: "H7C" }), null, "H7C bara band");
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "B", switch: "J79C" }), null, "J79C bara skena");
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "B", switch: "A72" }), null, "A72 är skentyp (kolumnen Rail mounting, vinklad)");
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "A", switch: "A72" }), "CD85N20-40-A-A72");
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "A", switch: "A72H" }), "CD85N20-40-A-A72H");
  assertEquals(b({ bore: "10", cover: "N", stroke_mm: 250 }), null);
  assertEquals(b({ bore: "10", cover: "N", stroke_mm: 100, mto: "X2018" }), null);
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, cushion: true, mto: "XB9" }), null);
  assertEquals(b({ bore: "16", cover: "N", stroke_mm: 40, mto: "XB7" }), null);
  assertEquals(b({ bore: "20", cover: "N", stroke_mm: 40, accessory: "W", mto: "XB6" }), null);
});

// ── reglerna mot modellen ──────────────────────────────────────────────────
const REGLER = buildC85DbRules();
function ctx(c: C85Config): Record<string, unknown> {
  return {
    bore: c.bore, cover: c.cover, stroke_mm: Number(c.stroke_mm || 0), magnet: c.magnet ? "D" : "", cushion: c.cushion ? "C" : "",
    boot: c.boot ?? "", bracket: c.bracket ?? "", accessory: c.accessory ?? "", switch_mount: c.switch_mount ?? "",
    switch: c.switch ?? "", lead: c.lead ?? "", count: c.count ?? "", mto: c.mto ?? "",
  };
}
const kor = (c: C85Config, niva: string) => REGLER.filter((r) => r.severity === niva && evalLogic(r.if_json, ctx(c)) === true).map((r) => r.message_sv);
const fel = (c: C85Config) => kor(c, "error");

function kontrollera(namn: string, prov: C85Config[], minst: number) {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const c of prov) {
    const kod = c85BuildCode(c);
    const f = fel(c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(c));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  assertEquals(missade.slice(0, 5), [], `${namn}: ${missade.length} av ${prov.length} slank igenom`);
  assertEquals(falsklarm.slice(0, 5), [], `${namn}: ${falsklarm.length} falsklarm`);
  assert(prov.length >= minst);
}

Deno.test("borrning × gavel × dämpning × bälg × fäste × slag", () => {
  const prov: C85Config[] = [];
  for (const b of C85_BORES) for (const c of C85_COVERS) for (const cushion of [false, true]) for (const boot of ["", "J"])
    for (const bracket of ["", ...C85_BRACKETS.map((x) => x.code)]) for (const stroke_mm of [10, 25, 100, 250, 500, 1001])
      prov.push({ bore: b.code, cover: c.code, stroke_mm, cushion, boot: boot || undefined, bracket: bracket || undefined });
  kontrollera("A", prov, 3000);
});

Deno.test("borrning × magnet × givarfäste × givare × kabel × antal", () => {
  const prov: C85Config[] = [];
  for (const b of C85_BORES) for (const magnet of [false, true]) for (const mount of ["", "A", "B"])
    for (const sw of ["", ...C85_SWITCHES.map((s) => s.code)]) for (const lead of ["", "L"]) for (const count of ["", "S"])
      prov.push({ bore: b.code, cover: "N", stroke_mm: 50, magnet, switch_mount: mount || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined });
  kontrollera("B", prov, 4000);
  assert(C85_LEADS.length === 4);
});

Deno.test("borrning × dämpning × tillbehör × specialutförande × slag", () => {
  const prov: C85Config[] = [];
  for (const b of C85_BORES) for (const cushion of [false, true]) for (const acc of ["", ...C85_ACCESSORIES.map((a) => a.code)])
    for (const mto of ["", ...C85_MTO.map((m) => m.code)]) for (const stroke_mm of [50, 300, 500, 1200])
      prov.push({ bore: b.code, cover: "N", stroke_mm, cushion, accessory: acc || undefined, mto: mto || undefined });
  kontrollera("C", prov, 1000);
});

Deno.test("mallen i databasen bygger samma kod", () => {
  const val = (c: C85Config) => ({ ...ctx(c), stroke_mm: c.stroke_mm });
  for (const c of [
    { bore: "20", cover: "N", stroke_mm: 40, magnet: true, cushion: true, boot: "J", bracket: "L", accessory: "V", switch_mount: "B", switch: "M9BW", count: "S" },
    { bore: "16", cover: "N", stroke_mm: 100 },
    { bore: "10", cover: "F", stroke_mm: 250, bracket: "G", mto: "X2018" },
  ] as C85Config[]) {
    assertEquals(fillOrderCodeTemplate(C85_ORDER_CODE_TEMPLATE, val(c), new Set(["bore", "cover", "stroke_mm"])), c85BuildCode(c));
  }
});

Deno.test("meddelanden, råd och tomt", () => {
  const f = fel({ bore: "20", cover: "N", stroke_mm: 40, magnet: true, switch_mount: "A", switch: "M9BW" });
  assertEquals(f.length, 1, f.join(" | "));
  assert(f[0].includes("skena"), f[0]);
  assert(kor({ bore: "20", cover: "N", stroke_mm: 40 }, "info").some((m) => m.includes("157 N")));
  const tom = { bore: "", cover: "", stroke_mm: 0 } as C85Config;
  assertEquals(fel(tom), []);
  assertEquals(kor(tom, "info"), []);
  assertEquals(REGLER.filter((r) => r.message_sv === r.message_en).length, 0);
  const n = REGLER.map((r) => `${r.severity}|${r.message_sv}|${JSON.stringify(r.if_json)}`);
  assertEquals(n.filter((x, i) => n.indexOf(x) !== i), []);
});
