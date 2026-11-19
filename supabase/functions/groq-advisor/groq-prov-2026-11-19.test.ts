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
