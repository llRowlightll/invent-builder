/**
 * OSP-E-reglerna som faktiskt körs, mot modellen som faktiskt bygger koden,
 * för alla sju varianter.
 *
 * Invarianten: en kombination modellen vägrar bygga MÅSTE ge minst ett fel,
 * och en den bygger får inte ge något. Kombinationerna räknas upp per variant
 * över de positioner som beror på varandra: storlek, typ, vagn, riktning,
 * stigning, växel, sats, axel, styrning, ändlock och slag.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { evalLogic } from "../../../src/lib/configurator-engine.ts";
import { buildOspeDbRules } from "../../../src/lib/catalog/osp-e-db-rules.ts";
import {
  OSPE_BHD_DIRECTIONS,
  OSPE_BHD_TYPES,
  OSPE_GEARS,
  OSPE_VARIANTS,
  type OspeConfig,
  type OspeSlug,
  ospeBuildCode,
  ospeCarriages,
  ospeEndCaps,
  ospeGearKitOptions,
  ospeGuides,
  ospeMaxStroke,
  ospeMotorKitOptions,
  ospePitches,
  ospeShaftOrKitOptions,
  ospeShafts2,
  ospeVariant,
} from "../../../src/lib/catalog/osp-e.ts";

const FALT: Record<string, string[]> = {
  B: ["size", "carriage", "drive_shaft", "gear", "kit", "stroke_mm", "niro", "ext_guide", "guide_position", "end_cap", "profile_mounting", "sensors"],
  SCREW: ["size", "carriage", "pitch", "gear", "kit", "stroke_mm", "niro", "ext_guide", "end_cap", "profile_mounting", "sensors"],
  ROD: ["size", "pitch", "gear", "kit", "stroke_mm", "niro", "rod_mounting", "end_cap", "profile_mounting", "sensors"],
  BHD: ["type", "size", "carriage", "op_direction", "drive_shaft", "stroke_mm", "niro", "kit", "end_cap", "profile_mounting", "sensors"],
  BV: ["size", "carriage", "drive_shaft", "stroke_mm", "niro", "kit", "sensors"],
};

/** Kontexten som configurator.$family.tsx bygger: tal för numeriska fält, "" för ovalda. */
function ctx(slug: OspeSlug, v: Partial<OspeConfig>): Record<string, unknown> {
  const layout = ospeVariant(slug)!.layout;
  const ut: Record<string, unknown> = {};
  for (const f of FALT[layout]) {
    const raw = (v as Record<string, unknown>)[f];
    ut[f] = f === "stroke_mm" ? Number(raw || 0) : (raw ?? "");
  }
  return ut;
}

const REGLER = Object.fromEntries(OSPE_VARIANTS.map((v) => [v.slug, buildOspeDbRules(v.slug)]));

function kor(slug: OspeSlug, v: Partial<OspeConfig>, niva: string): string[] {
  const c = ctx(slug, v);
  return REGLER[slug].filter((r) => r.severity === niva && evalLogic(r.if_json, c) === true).map((r) => r.message_sv);
}
const fel = (slug: OspeSlug, v: Partial<OspeConfig>) => kor(slug, v, "error");

/** Prövar en uppsättning konfigurationer mot invarianten och rapporterar avvikelserna. */
function prova(slug: OspeSlug, prov: Array<Partial<OspeConfig>>): { n: number; missade: string[]; falsklarm: string[] } {
  const missade: string[] = [];
  const falsklarm: string[] = [];
  for (const p of prov) {
    const c: OspeConfig = { slug, size: p.size ?? "", stroke_mm: p.stroke_mm ?? 500, ...p };
    const kod = ospeBuildCode(c);
    const f = fel(slug, c);
    if (!kod && f.length === 0) missade.push(JSON.stringify(p));
    if (kod && f.length > 0) falsklarm.push(`${kod}: ${f.join(" | ")}`);
  }
  return { n: prov.length, missade, falsklarm };
}

function kontrollera(slug: OspeSlug, prov: Array<Partial<OspeConfig>>, minst: number) {
  const r = prova(slug, prov);
  assertEquals(r.missade.slice(0, 5), [], `${slug}: ${r.missade.length} av ${r.n} slank igenom`);
  assertEquals(r.falsklarm.slice(0, 5), [], `${slug}: ${r.falsklarm.length} falsklarm`);
  assert(r.n >= minst, `${slug}: bara ${r.n} kombinationer prövade`);
}

Deno.test("varje regel läser bara fält som finns i sin familj", () => {
  for (const v of OSPE_VARIANTS) {
    const falt = new Set(FALT[v.layout]);
    const okanda = new Set<string>();
    const ga = (n: unknown): void => {
      if (Array.isArray(n)) return void n.forEach(ga);
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if (typeof o.var === "string" && !falt.has(o.var)) okanda.add(o.var);
      Object.values(o).forEach(ga);
    };
    REGLER[v.slug].forEach((r) => ga(r.if_json));
    assertEquals([...okanda], [], `${v.slug} läser fält som inte finns: ${[...okanda]}`);
  }
});

Deno.test("B: storlek × vagn × axel × växel × sats", () => {
  const prov: Array<Partial<OspeConfig>> = [];
  const v = ospeVariant("osp-e-b")!;
  for (const size of v.sizes) for (const c of ospeCarriages("osp-e-b")) for (const s of ["0", "1", "2"])
    for (const g of OSPE_GEARS) for (const k of ospeMotorKitOptions())
      prov.push({ size, carriage: c.code, drive_shaft: s, gear: g.code, kit: k.code });
  kontrollera("osp-e-b", prov, 1400);
});

Deno.test("B: storlek × yttre styrning × styrläge × ändlock", () => {
  const prov: Array<Partial<OspeConfig>> = [];
  const v = ospeVariant("osp-e-b")!;
  for (const size of v.sizes) for (const g of ospeGuides("osp-e-b")) for (const p of ["0", "1"]) for (const e of ospeEndCaps("osp-e-b"))
    prov.push({ size, ext_guide: g.code, guide_position: p, end_cap: e.code });
  kontrollera("osp-e-b", prov, 300);
});

for (const slug of ["osp-e-sb", "osp-e-st"] as const) {
  Deno.test(`${slug}: storlek × vagn × stigning × växel × axel/sats`, () => {
    const prov: Array<Partial<OspeConfig>> = [];
    const v = ospeVariant(slug)!;
    for (const size of v.sizes) for (const c of ospeCarriages(slug)) for (const p of ospePitches(slug))
      for (const g of OSPE_GEARS) for (const k of ospeShaftOrKitOptions(slug))
        prov.push({ size, carriage: c.code, pitch: p.code, gear: g.code, kit: k.code });
    kontrollera(slug, prov, 700);
  });
  Deno.test(`${slug}: storlek × yttre styrning × ändlock`, () => {
    const prov: Array<Partial<OspeConfig>> = [];
    const v = ospeVariant(slug)!;
    for (const size of v.sizes) for (const g of ospeGuides(slug)) for (const e of ospeEndCaps(slug)) {
      const pitch = ospePitches(slug).find((p) => p.sizes.includes(size))!.code;
      prov.push({ size, pitch, ext_guide: g.code, end_cap: e.code });
    }
    kontrollera(slug, prov, 200);
  });
}

for (const slug of ["osp-e-sbr", "osp-e-str"] as const) {
  Deno.test(`${slug}: storlek × stigning × växel × axel/sats × stångfäste`, () => {
    const prov: Array<Partial<OspeConfig>> = [];
    const v = ospeVariant(slug)!;
    for (const size of v.sizes) for (const p of ospePitches(slug)) for (const g of OSPE_GEARS)
      for (const k of ospeShaftOrKitOptions(slug)) for (const r of ["0", "T", "U", "V"])
        prov.push({ size, pitch: p.code, gear: g.code, kit: k.code, rod_mounting: r });
    kontrollera(slug, prov, 1500);
  });
}

Deno.test("BHD: typ × storlek × vagn × riktning × axel × sats", () => {
  const prov: Array<Partial<OspeConfig>> = [];
  const v = ospeVariant("osp-e-bhd")!;
  for (const t of OSPE_BHD_TYPES) for (const size of v.sizes) for (const c of ospeCarriages("osp-e-bhd"))
    for (const d of OSPE_BHD_DIRECTIONS) for (const s of ospeShafts2("osp-e-bhd")) for (const k of ospeGearKitOptions("osp-e-bhd"))
      prov.push({ type: t.code, size, carriage: c.code, op_direction: d.code, drive_shaft: s.code, kit: k.code });
  kontrollera("osp-e-bhd", prov, 10000);
});

Deno.test("BV: storlek × huvud × axel × sats", () => {
  const prov: Array<Partial<OspeConfig>> = [];
  const v = ospeVariant("osp-e-bv")!;
  for (const size of v.sizes) for (const c of ospeCarriages("osp-e-bv")) for (const s of ospeShafts2("osp-e-bv"))
    for (const k of ospeGearKitOptions("osp-e-bv"))
      prov.push({ size, carriage: c.code, drive_shaft: s.code, kit: k.code });
  kontrollera("osp-e-bv", prov, 150);
});

Deno.test("slaglängdens tak följer variant, storlek och styrning", () => {
  for (const v of OSPE_VARIANTS) {
    for (const size of v.sizes) {
      const typer = v.layout === "BHD" ? OSPE_BHD_TYPES.filter((t) => t.sizes.includes(size)).map((t) => t.code) : [undefined];
      for (const type of typer) {
        const tak = ospeMaxStroke(v.slug, size, { type })!;
        const bas: Partial<OspeConfig> = {
          size, type,
          pitch: ospePitches(v.slug).find((p) => p.sizes.includes(size))?.code,
          drive_shaft: v.layout === "BHD" || v.layout === "BV" ? "0A" : undefined,
        };
        assertEquals(fel(v.slug, { ...bas, stroke_mm: tak }), [], `${v.slug} ${size} ${type ?? ""} vid taket`);
        const over = fel(v.slug, { ...bas, stroke_mm: tak + 1 });
        assert(over.some((m) => m.includes(String(tak))), `${v.slug} ${size} ${type ?? ""} över taket: ${over.join(" | ")}`);
      }
    }
  }
  // BHD: kullager 25 slutar vid 5 700 men rullstyrning 25 går till 7 000.
  assert(fel("osp-e-bhd", { type: "6", size: "25", drive_shaft: "0A", stroke_mm: 6000 }).length > 0);
  assertEquals(fel("osp-e-bhd", { type: "5", size: "25", drive_shaft: "0A", stroke_mm: 6000 }), []);
});

Deno.test("meddelandena säger vad som gäller", () => {
  // Växel utan motorsats: en rad, med satserna i klartext.
  const f1 = fel("osp-e-b", { size: "25", gear: "1", kit: "0-" });
  assertEquals(f1.length, 1, f1.join(" | "));
  assert(f1[0].includes("A0, A1 eller A2"), f1[0]);
  // Fel växel för storleken: en rad.
  const f2 = fel("osp-e-b", { size: "25", gear: "3", kit: "A1" });
  assertEquals(f2.length, 1, f2.join(" | "));
  assert(f2[0].includes("LP050 (i = 5 eller 10)"), f2[0]);
  // BHD: delad vagn med standardriktning.
  const f3 = fel("osp-e-bhd", { type: "6", size: "25", carriage: "2", op_direction: "0", drive_shaft: "0A" });
  assertEquals(f3.length, 1, f3.join(" | "));
  assert(f3[0].includes("2 eller 3"), f3[0]);
  // BHD: sats som kräver klämaxel, vald med slät axel.
  const f4 = fel("osp-e-bhd", { type: "6", size: "25", drive_shaft: "0A", kit: "C1" });
  assertEquals(f4.length, 1, f4.join(" | "));
  assert(f4[0].includes("slät axel"), f4[0]);
  // Skruv: stigningen finns inte i storleken.
  const f5 = fel("osp-e-sb", { size: "25", pitch: "5" });
  assertEquals(f5.length, 1, f5.join(" | "));
  assert(f5[0].includes("5 mm"), f5[0]);
});

Deno.test("råden är info, inte fel", () => {
  const i1 = kor("osp-e-sb", { size: "50", pitch: "5" }, "info");
  assertEquals(i1.length, 1, i1.join(" | "));
  assert(i1[0].includes("1,25 m/s") && i1[0].includes("1500 N"), i1[0]);
  const i2 = kor("osp-e-bhd", { type: "6", size: "25", drive_shaft: "0A" }, "info");
  assertEquals(i2.length, 1, i2.join(" | "));
  assert(i2[0].includes("10 m/s på begäran"), i2[0]);
  assert(kor("osp-e-bv", { size: "20", drive_shaft: "0A" }, "info").some((m) => m.includes("10 kg")));
  assert(kor("osp-e-str", { size: "25", pitch: "3" }, "info").some((m) => m.includes("självlåsande")));
  assertEquals(kor("osp-e-sb", { size: "25", pitch: "3" }, "info").filter((m) => m.includes("självlåsande")), []);
});

Deno.test("en tom konfiguration larmar inte", () => {
  for (const v of OSPE_VARIANTS) {
    assertEquals(fel(v.slug, {}), [], v.slug);
    assertEquals(kor(v.slug, {}, "info"), [], v.slug);
    assertEquals(fel(v.slug, { size: v.sizes[0] }), [], v.slug);
  }
});

Deno.test("varje regel har både svensk och engelsk text, och ingen förekommer två gånger", () => {
  for (const v of OSPE_VARIANTS) {
    const r = REGLER[v.slug];
    assert(r.length >= 10, `${v.slug} har bara ${r.length} regler`);
    assertEquals(r.filter((x) => !x.message_sv?.trim() || !x.message_en?.trim()).length, 0, v.slug);
    assertEquals(r.filter((x) => x.message_sv === x.message_en).length, 0, v.slug);
    const nycklar = r.map((x) => `${x.severity}|${x.message_sv}|${JSON.stringify(x.if_json)}`);
    const dubbletter = nycklar.filter((n, i) => nycklar.indexOf(n) !== i);
    assertEquals(dubbletter, [], `${v.slug} dubbletter: ${dubbletter.join(" ; ")}`);
  }
});
