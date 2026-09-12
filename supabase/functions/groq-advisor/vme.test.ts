/**
 * VME-modellen mot Metal Works ORDERING CODES-tabell.
 *
 * Tabellen är avskriven, och avskriften är det som kan gå fel: i den inlästa
 * texten står artikelnumren ihopklistrade med symbolkolumnen -- "a13
 * 2W3501000100 3/2 NC Axial fittings Ø 4 22". Testerna nedan kontrollerar
 * därför formen och unikheten hårt, för en enda felläst siffra ger ett
 * artikelnummer som inte finns.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  VME_ACCESSORIES,
  VME_ARTICLES,
  VME_FITTINGS,
  VME_FUNCTIONS,
  VME_PORTS,
  VME_SOURCE,
  parseVmePartNo,
  vmePartNo,
} from "../../../src/lib/catalog/vme.ts";

Deno.test("åtta ventiler — två funktioner × två lägen × två portar", () => {
  assertEquals(VME_ARTICLES.length, 8);
  assertEquals(VME_FUNCTIONS.length * VME_FITTINGS.length * VME_PORTS.length, 8);
  // Varje kombination ska finnas exakt en gång.
  const saknas: string[] = [];
  for (const fn of VME_FUNCTIONS) {
    for (const f of VME_FITTINGS) {
      for (const p of VME_PORTS) {
        if (!vmePartNo(fn, f, p)) saknas.push(`${fn} ${f} ${p}`);
      }
    }
  }
  assertEquals(saknas, [], saknas.join(", "));
});

Deno.test("varje artikelnummer är unikt", () => {
  // En avskriven tabell kan få dubbletter av ett slarvfel.
  const nr = VME_ARTICLES.map((a) => a.part_no);
  assertEquals(new Set(nr).size, 8, `dubbletter: ${nr.filter((x, i) => nr.indexOf(x) !== i)}`);
});

Deno.test("varje nummer har Metal Works form: W plus tio siffror", () => {
  // Det var precis den här formen som lät mig plocka ut numren ur texten utan
  // att symbolkolumnen följde med.
  const fel = VME_ARTICLES.filter((a) => !/^W\d{10}$/.test(a.part_no)).map((a) => a.part_no);
  assertEquals(fel, [], `fel form: ${fel.join(", ")}`);
  // Alla ventiler delar serieprefix; tillbehören har ett annat.
  assert(VME_ARTICLES.every((a) => a.part_no.startsWith("W3501")), "ventilerna börjar på W3501");
  assert(VME_ACCESSORIES.every((a) => a.part_no.startsWith("W0351")), "tillbehören på W0351");
});

Deno.test("uppslaget ger katalogens nummer", () => {
  assertEquals(vmePartNo("3/2 NC", "axial", "Ø4"), "W3501000100");
  assertEquals(vmePartNo("3/2 NC", "side", "M5"), "W3501001111");
  assertEquals(vmePartNo("3/2 NO", "axial", "M5"), "W3501000110");
  assertEquals(vmePartNo("3/2 NO", "side", "Ø4"), "W3501001100");
  assertEquals(vmePartNo("5/2", "axial", "Ø4"), null, "VME har bara 3/2");
});

Deno.test("artikelnumret går att läsa tillbaka", () => {
  const fel: string[] = [];
  for (const a of VME_ARTICLES) {
    const l = parseVmePartNo(a.part_no);
    if (!l) { fel.push(`${a.part_no}: hittades inte`); continue; }
    if (l.function !== a.function || l.fittings !== a.fittings || l.port !== a.port) {
      fel.push(`${a.part_no}: läste ${l.function} ${l.fittings} ${l.port}`);
    }
  }
  assertEquals(fel, [], fel.join("\n"));
  assertEquals(parseVmePartNo("W3501999999"), null);
});

Deno.test("vikten följer portstorleken, inte funktionen", () => {
  // Katalogen: Ø4-varianterna väger 22 g, M5-varianterna 24 g -- oavsett om
  // ventilen är NC eller NO. Ett oberoende kryss på att kolumnerna lästs ihop
  // rätt: hade en rad hamnat fel skulle vikten inte följa mönstret.
  const fel: string[] = [];
  for (const a of VME_ARTICLES) {
    const vantat = a.port === "Ø4" ? 22 : 24;
    if (a.weight_g !== vantat) fel.push(`${a.part_no}: ${a.weight_g} g, väntade ${vantat}`);
  }
  assertEquals(fel, [], fel.join("\n"));
});

Deno.test("våra nuvarande artikelnummer är påhittade", () => {
  // MW-VME-14 och MW-VME-18: Metal Work numrerar inte så, och VME finns
  // varken i storlek 14 eller 18. Serien har EN ventilstorlek och varierar i
  // funktion, anslutningsläge och portgänga.
  for (const sku of ["MW-VME-14", "MW-VME-M5", "MW-VME-18"]) {
    assertEquals(parseVmePartNo(sku), null, `"${sku}" finns inte i katalogen`);
  }
});

Deno.test("modellen bär sin källa", () => {
  assertEquals(VME_SOURCE.brand, "Metal Work");
  assertEquals(VME_SOURCE.section, "B1.4–B1.7");
});
