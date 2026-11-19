/// <reference lib="deno.ns" />
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { bedomLosning, type BomRow } from "./bom-builder.ts";
import { tolkaKravbild } from "./kravbild.ts";
import { byggResultat } from "./resultat.ts";
import { rensaMotsagelser, svarForPrompt, svenskFix, utanSvarsId } from "./prosavakt.ts";

// Första provet med AI-texterna sedan Groq-kvoten kom tillbaka (2026-11-19).

Deno.test("\"väger upp till 800 kg\" är en massa, inte slutet på ett intervall", () => {
  const kb = tolkaKravbild("Pallstopp på en rullbana, pallarna väger upp till 800 kg och kommer i 0,3 m/s.");
  const m = kb.krav.find((k) => k.egenskap === "massa");
  assertEquals(m?.varde, 800);
  assert(!kb.saknas.some((s) => s.id === "saknas-massa"), JSON.stringify(kb.saknas));
  // Intervallen står kvar.
  const iv = tolkaKravbild("Lådor 2 till 5 kg").krav.find((k) => k.egenskap === "massa");
  assertEquals(iv?.intervall, { min: 2, max: 5 });
});

Deno.test("pallstoppet räknas på rörelseenergi och kallas inte cylinder", () => {
  const kb = tolkaKravbild("Pallstopp på en rullbana, pallarna väger upp till 800 kg och kommer i 0,3 m/s. Stoppet ska fällas upp och ner.");
  const rader: BomRow[] = [
    { sku: "SMC-RB2015", quantity: 1, kind: "actuator", role: "Stötdämpare (bromsar lasten)", reason: "" },
    { sku: "SPECIFY", quantity: 1, kind: "actuator", role: "Stoppcylinder (fäller upp och ned stoppet)", reason: "" },
    { sku: "FE-MFH", quantity: 1, kind: "valve", role: "Magnetventil", reason: "" },
  ];
  const r = byggResultat({ locale: "sv", kravbild: kb, rows: rader, primarySku: "SMC-RB2015", isElectric: false, dom: bedomLosning(rader), primaryCategory: "shock-absorber" });
  assertEquals(r.princip, "Stötdämpare som bromsar lasten, och en cylinder som fäller upp och ned stoppet");
  assert(/^Stopp med stötdämpare/.test(r.titel), r.titel);
  const e = r.berakningar.find((b) => b.id === "berakning-energi");
  assertEquals(e?.resultat, "36 J");
  assert(!r.berakningar.some((b) => b.id === "berakning-kraft"), JSON.stringify(r.berakningar));
  assert(!/Lastens massa/.test(r.text), r.text);
  // Utan hastighet går energin inte att räkna, och det sägs.
  const utan = byggResultat({ locale: "en", kravbild: tolkaKravbild("Pallet stop, pallets up to 800 kg"), rows: rader, primarySku: "SMC-RB2015", isElectric: false, dom: bedomLosning(rader), primaryCategory: "shock-absorber" });
  const e2 = utan.berakningar.find((b) => b.id === "berakning-energi");
  assertEquals(e2?.status, "underlag_otillrackligt");
  assert(e2?.saknas.includes("speed at impact"), JSON.stringify(e2));
});

Deno.test("en nackdel om saknad lägesavkänning stryks när datan har magnetkolv eller givare", () => {
  const con = "Ingen positionsavkänning i båda ändlägena (krav på andlagesavkanning saknas i katalogen)";
  assertEquals(rensaMotsagelser([con], "AVENTICS PRA ; Optional reed/PNP sensor"), []);
  assertEquals(rensaMotsagelser([con], "Serie 63 ; Magnetic piston, T-slot sensor"), []);
  assertEquals(rensaMotsagelser(["No end-position sensing"], "position_sensing Magnetic piston"), []);
  // Utan stöd i datan står nackdelen kvar.
  assertEquals(rensaMotsagelser([con], "Compact cylinder ; Double-acting"), [con]);
});

Deno.test("svarens interna nycklar når aldrig modellen eller kunden", () => {
  const p = svarForPrompt({ andlagesavkanning: "Ja, i båda ändlägena", slaglangd_mm: "50", okand_nyckel: "x" });
  assert(!/andlagesavkanning|slaglangd_mm/.test(p), p);
  assert(/end-position sensing: Ja, i båda ändlägena/.test(p), p);
  assert(/okand nyckel: x/.test(p), p);
  assertEquals(
    utanSvarsId("krav på andlagesavkanning saknas", ["andlagesavkanning", "takt"], "sv"),
    "krav på lägesavkänning i ändlägena saknas",
  );
});

Deno.test("svenska böjningsfel rättas, t-ord lämnas", () => {
  assertEquals(svenskFix("En dubbelverkande pneumatiskt cylinder med slag 300 mm"), "En dubbelverkande pneumatisk cylinder med slag 300 mm");
  assertEquals(svenskFix("en elektriskt axel och en pneumatiskt ventilö"), "en elektrisk axel och en pneumatisk ventilö");
  assertEquals(svenskFix("Ett pneumatiskt gripdon"), "Ett pneumatiskt gripdon");
  assertEquals(svenskFix("Sittar komponenten i livsmedelszonen?"), "Sitter komponenten i livsmedelszonen?");
});

// ── Omgång 2: rangordningen ──────────────────────────────────────────────────
import { grovtOverdimensionerad, kodensSerie, rankActuators, type CatalogProduct, type ScoringCtx } from "./scoring.ts";

const ctx = (x: Partial<ScoringCtx>): ScoringCtx => ({
  requiredStroke: 0, minBoreMm: 0, isHighPrecision: false, isHighSpeed: false, isVertical: false, isWashdown: false, isAtex: false, ...x,
} as ScoringCtx);
const cyl = (sku: string, name: string, brand: string, ks: Record<string, unknown>): CatalogProduct => ({ sku, name, brand, category: "cylinder", key_specs: ks });

Deno.test("ett utbyte får kodens egen serie, om den täcker kravet", () => {
  const dsbc = cyl("FESTO-DSBC", "DSBC – ISO 15552 Standard Cylinder", "festo", { stroke_mm: "2800", bore_mm: "50", is_family: true });
  const pra = cyl("0822122007", "AVENTICS PRA Ø50 200mm", "aventics", { stroke_mm: "200", bore_mm: "50", force_n: "1178" });
  const kort = cyl("FESTO-DSBC-K", "DSBC kort", "festo", { stroke_mm: "100", bore_mm: "50" });
  const c = ctx({ kodFamilj: "DSBC", requiredStroke: 200 });
  assertEquals(rankActuators([dsbc, pra], c)[0].sku, "0822122007"); // rangordningen själv ändras inte
  assertEquals(kodensSerie([pra, dsbc, kort], c)?.sku, "FESTO-DSBC");
  assertEquals(kodensSerie([pra, kort], c), null); // för kort slag täcker inte kravet
  assertEquals(kodensSerie([pra, dsbc], ctx({ requiredStroke: 200 })), null);
});

Deno.test("en lagerartikel med tio gånger kraften hamnar efter serien i rätt storlek", () => {
  const o63 = cyl("90M2A063A200", "Serie 90 – Stainless Steel Cylinder Ø63×200", "camozzi", { stroke_mm: "200", bore_mm: "63", force_n: "1870" });
  const crd = cyl("FESTO-CRDSNU-12", "Festo CRDSNU-12", "festo", { stroke_mm: "320", bore_mm: "12", force_n: "68", is_family: true });
  const c = ctx({ requiredStroke: 150, requiredForceN: 39 });
  assert(grovtOverdimensionerad(o63, c));
  assertEquals(rankActuators([o63, crd], c).map((p) => p.sku), ["FESTO-CRDSNU-12", "90M2A063A200"]);
  // En borrning kunden själv angett är ett krav.
  assert(!grovtOverdimensionerad(o63, ctx({ requiredStroke: 150, requiredForceN: 39, explicitBoreMm: 63 })));
  // Med en kraft i rätt storleksordning är lagerartikeln fortfarande först.
  assertEquals(rankActuators([o63, crd], ctx({ requiredStroke: 150, requiredForceN: 800 }))[0].sku, "90M2A063A200");
});
