import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  begardaVentilplatser, begardFaltbuss, faltbussar, provaDampenergi, provaFaltbuss, provaVentilplatser,
  valjDampare, ventilplatser, ventilpoang,
} from "./komponentkrav.ts";
import type { CatalogProduct } from "./scoring.ts";

const p = (sku: string, name: string, key_specs: Record<string, unknown>, category = "valve-terminal"): CatalogProduct =>
  ({ sku, name, category, brand: "", key_specs });

// Samma uppgifter som i katalogen 2026-11-18.
const RB0806 = p("SMC-RB0806", "RB0806 Hydraulic Shock Absorber M8", { energy_j: "2.94" }, "shock-absorber");
const RB1412 = p("SMC-RB1412", "RB1412 Hydraulic Shock Absorber M14", { energy_j: "19.6" }, "shock-absorber");
const RB2015 = p("SMC-RB2015", "RB2015 Hydraulic Shock Absorber M20", { energy_j: "58.8" }, "shock-absorber");
const SA20 = p("NOR-SA200625M", "Norgren SA200625M Adjustable Shock Absorber M20", { sizes: "M20×1.5" }, "shock-absorber");

const DM1 = p("D-M1-08-024DC", "Serie D – Valve Island Size 1, 8 stations, 24VDC", { fieldbus: "PROFIBUS-DP, PROFINET, CANopen, EtherNet/IP, EtherCAT, IO-Link", special_features: "Up to 8 valve stations" });
const MPA = p("FE-MPA-S-EX1-8", "MPA-S 8-stations IO-Link", { fieldbus: "IO-Link" });
const VTUG = p("FE-VTUG-10-5-M32-S", "VTUG-10 4-stations med EtherNet/IP", { fieldbus: "EtherNet/IP" });
const SY = p("SMC-SS5Y5", "SY5000 valve terminal, 8 stations", { stations: "8 (manifold available with 2–24) stations", fieldbus: "PROFINET (EX600-SPN1); DeviceNet" });
const UTAN = p("FESTO-546279", "Valve terminal", { ip_rating: "IP65" });

Deno.test("dämparenergi: pallstoppet på ≈ 36 J", () => {
  assertEquals(provaDampenergi(36, RB2015, true).utfall, "uppfyllt");
  assertEquals(provaDampenergi(36, RB0806, true).utfall, "ej_uppfyllt");
  assertEquals(provaDampenergi(36, SA20, true).utfall, "kan_inte_bedomas");
  assert(/2,94 J/.test(provaDampenergi(36, RB0806, true).text));
  const v = valjDampare([RB0806, RB1412, RB2015, SA20], 36);
  assertEquals(v.val.map((x) => x.sku), ["SMC-RB2015", "NOR-SA200625M"]);
  assert(v.nagonRacker);
  // Klarar ingen känd dämpare energin visas den största ändå, och anroparen säger det.
  const ingen = valjDampare([RB0806, RB1412, SA20], 100);
  assertEquals(ingen.val.map((x) => x.sku), ["SMC-RB1412", "NOR-SA200625M"]);
  assert(!ingen.nagonRacker);
});

Deno.test("fältbuss: begärd, angiven och prövad", () => {
  assertEquals(begardFaltbuss("ventilö för 8 dubbelverkande cylindrar med Profinet, 24 V DC"), "PROFINET");
  assertEquals(begardFaltbuss("valve terminal with EtherNet/IP"), "EtherNet/IP");
  assertEquals(begardFaltbuss("ventilö med 8 platser"), null);
  assertEquals(faltbussar(MPA), ["IO-Link"]);
  assertEquals(provaFaltbuss("PROFINET", DM1, true).utfall, "uppfyllt");
  assertEquals(provaFaltbuss("PROFINET", MPA, true).utfall, "ej_uppfyllt");
  assertEquals(provaFaltbuss("PROFINET", UTAN, true).utfall, "kan_inte_bedomas");
});

Deno.test("ventilplatser: begärda och artikelns", () => {
  assertEquals(begardaVentilplatser("ventilö för 8 dubbelverkande cylindrar med Profinet"), 8);
  assertEquals(begardaVentilplatser("en ventilö med 12 ventiler"), 12);
  assertEquals(begardaVentilplatser("ventilö för 8 cylindrar", { ventil_antal: "10" }), 10, "svaret går först");
  assertEquals(begardaVentilplatser("en ventilö"), 0);
  assertEquals(ventilplatser(DM1), 8);
  assertEquals(ventilplatser(VTUG), 4);
  assertEquals(ventilplatser(SY), 24, "ett spann ger största värdet");
  assertEquals(ventilplatser(UTAN), 0);
  assertEquals(provaVentilplatser(8, VTUG, true).utfall, "ej_uppfyllt");
  assertEquals(provaVentilplatser(8, DM1, true).utfall, "uppfyllt");
  assertEquals(provaVentilplatser(8, UTAN, true).utfall, "kan_inte_bedomas");
});

Deno.test("ventilpoäng: PROFINET och 8 platser före IO-Link och 4 platser", () => {
  const ordning = [MPA, VTUG, UTAN, DM1, SY].sort((a, b) => ventilpoang(b, "PROFINET", 8) - ventilpoang(a, "PROFINET", 8));
  assertEquals(ordning.slice(0, 2).map((x) => x.sku).sort(), ["D-M1-08-024DC", "SMC-SS5Y5"]);
  assertEquals(ordning[ordning.length - 1].sku, "FE-VTUG-10-5-M32-S");
});
