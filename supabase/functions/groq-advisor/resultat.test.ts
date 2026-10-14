/// <reference lib="deno.ns" />
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { bedomLosning, type BomRow } from "./bom-builder.ts";
import { tolkaKravbild } from "./kravbild.ts";
import { byggResultat, SAKERHETSTEXT, utanSakerhetspastaenden } from "./resultat.ts";
import { detectHazards } from "./signals.ts";
import { SORTERING } from "./fixtur-sortering.ts";

const rad = (r: Partial<BomRow> & Pick<BomRow, "sku" | "kind">): BomRow => ({ quantity: 1, role: r.kind, reason: "", ...r });

const RADER: BomRow[] = [
  rad({
    sku: "FE-DSBC-32-400", kind: "actuator", role: "Primär aktuator", verifiering: "avvikelse",
    verifieringsskal: "Vald artikel har 400 mm slag; önskad rörelse är 350 mm. Öppen konfigurationspunkt: välj en variant med 350 mm slag, begränsa rörelsen med ett ställbart ändstopp, eller bekräfta att 400 mm fungerar. Punkten stängs först med en dokumenterad lösning.",
    kontroller: [{ krav: "tryck 6 bar", utfall: "uppfyllt", text: "artikeln klarar 1–10 bar" }, { krav: "miljö (torr, lätt damm)", utfall: "stods_inte", text: "" }],
  }),
  rad({ sku: "FE-VUVG", kind: "valve", role: "Magnetventil", verifiering: "underlag_saknas", kontroller: [{ krav: "24 V DC", utfall: "underlag_saknas", text: "" }] }),
  rad({ sku: "FE-SME-8M", kind: "sensor", role: "Ändlägesgivare", quantity: 2, verifiering: "verifierad", kontroller: [{ krav: "24 V DC", utfall: "uppfyllt", text: "" }] }),
  rad({ sku: "FE-QS", kind: "fitting", role: "Snabbkoppling", verifiering: "ej_tillampligt" }),
];

function sorteringsresultat() {
  const kb = tolkaKravbild(SORTERING);
  const h = detectHazards(SORTERING, {}, "sv");
  return byggResultat({ locale: "sv", kravbild: kb, rows: RADER, primarySku: "FE-DSBC-32-400", isElectric: false, kraftkrav: h.kraftkrav, dom: bedomLosning(RADER) });
}

Deno.test("sammanfattningen bygger på kravbilden och säger att den inte är bekräftad", () => {
  const r = sorteringsresultat();
  assert(/Kravbild \(tolkad ur beskrivningen, ej bekräftad\)/.test(r.text), r.text);
  assert(/Transportbandet: hastighet 0,25 m\/s/.test(r.text), r.text);
  assert(/Produkten: massa 0,5–3 kg; dimensionerande massa 3 kg/.test(r.text), r.text);
  assert(/Matningen: tryckluft 6 bar; spänning 24 V DC/.test(r.text), r.text);
  assertEquals(r.titel, "Pneumatisk utskjutare för utsortering — FE-DSBC-32-400");
  assertEquals(r.princip, "Pneumatisk cylinder med styrventil");
});

Deno.test("kraften är en preliminär uppskattning med det som saknas", () => {
  const r = sorteringsresultat();
  const kraft = r.berakningar.find((b) => b.id === "berakning-kraft")!;
  assertEquals([kraft.status, kraft.resultat], ["preliminar", "59 N"]);
  assert(/Kraft: 59 N \(preliminär uppskattning\)\. Saknas: friktionstal/.test(r.text), r.text);
  const cykel = r.berakningar.find((b) => b.id === "berakning-cykeltid")!;
  assertEquals(cykel.status, "underlag_otillrackligt");
});

Deno.test("slagavvikelsen står som öppen konfiguration och lovar inte 350 mm", () => {
  const r = sorteringsresultat();
  assert(/Öppen konfiguration: Primär aktuator — Vald artikel har 400 mm slag; önskad rörelse är 350 mm/.test(r.text), r.text);
  assertEquals(r.konfiguration.map((k) => k.sku), ["FE-DSBC-32-400"]);
  assertEquals(r.status.bestallningskoderKompletta, true);
});

Deno.test("kontrollerna och luckorna står i sammanfattningen", () => {
  const r = sorteringsresultat();
  assert(/Kontroller: 1 av 4 rader kontrollerade mot angivna krav, 2 med krav som inte kunde prövas/.test(r.text), r.text);
  assertEquals(r.status.kompatibilitetKontrollerad, false);
  assertEquals(r.status.underlagKomplett, false);
  assertEquals(r.status.dimensioneringUtford, false);
  assert(/Öppna frågor: .*Utskjutarens hastighet eller utskjutningstid/.test(r.text));
});

Deno.test("inga påståenden om funktioner eller säkerhet som underlaget inte bär", () => {
  const r = sorteringsresultat();
  for (const fel of [/transducer/i, /vridskydd/i, /säkerställ/i, /Servomotor|servodriv|Stegmotor|Motorkabel/]) {
    assert(!fel.test(r.text), `${fel}: ${r.text}`);
  }
  assert(r.text.endsWith(SAKERHETSTEXT.sv));
});

Deno.test("modellens säkerhetspåståenden tas bort ur prosan, resten står kvar", () => {
  assertEquals(
    utanSakerhetspastaenden("Cylindern ger 480 N vid 6 bar. Säkerheten säkerställs av backslagsventilen. Passar 350 mm."),
    "Cylindern ger 480 N vid 6 bar. Passar 350 mm.",
  );
  assertEquals(utanSakerhetspastaenden("Safety is ensured by the valve. Good stroke."), "Good stroke.");
  assertEquals(utanSakerhetspastaenden("Kort slag och hög kraft."), "Kort slag och hög kraft.");
});

Deno.test("ett gripdon som primär kallas inte cylinder", () => {
  const kb = tolkaKravbild("Lyfta lådor 50 kg med gripdon");
  const rader: BomRow[] = [
    { sku: "MW-P1-32", quantity: 1, kind: "actuator", role: "Primär aktuator", reason: "" },
    { sku: "FE-MFH", quantity: 1, kind: "valve", role: "Magnetventil", reason: "" },
  ];
  const r = byggResultat({ locale: "sv", kravbild: kb, rows: rader, primarySku: "MW-P1-32", isElectric: false, dom: bedomLosning(rader), primaryCategory: "gripper" });
  assertEquals(r.princip, "Pneumatiskt gripdon med styrventil");
  assert(/^Pneumatiskt grepp/.test(r.titel), r.titel);
  // Utan kategori är primären en cylinder, som förut.
  const r2 = byggResultat({ locale: "sv", kravbild: kb, rows: rader, primarySku: "MW-P1-32", isElectric: false, dom: bedomLosning(rader) });
  assertEquals(r2.princip, "Pneumatisk cylinder med styrventil");
});
