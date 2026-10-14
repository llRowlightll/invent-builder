/// <reference lib="deno.ns" />
// Körs med: deno test --no-lock --node-modules-dir=none tests/plc-harledning.test.ts
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  foreslaLarm, foreslaParametrar, foreslaSekvens, foreslaSignaler, foreslaTestfall, komponentsort,
  kontrolleraSignaler, markeraInaktuella, sammanfoga,
} from "../src/lib/plc/harledning.ts";
import { importeraKrav } from "../src/lib/plc/krav.ts";
import { tomtUnderlag, type Signal } from "../src/lib/plc/modell.ts";
import { SORTERING } from "../supabase/functions/groq-advisor/fixtur-sortering.ts";

const NU = new Date("2026-10-13T10:00:00Z");
// Stycklistan maskinbyggaren gav för lådsorteringen, med ändlägesgivare.
const STYCKLISTA = [
  { sku: "R480156951", role: "Primär aktuator", qty: 1, name: "AVENTICS RTC-HD Ø16 kolvstångslös cylinder, 400 mm slag" },
  { sku: "FE-MFH-5-1-8", role: "Magnetventil (5/2-vägs styrventil)", qty: 1, name: "Festo MFH-5-1/8-S Tiger Classic 5/2-ventil" },
  { sku: "FE-SME-8M-DS-24V-K-2.5-M8D", role: "Ändlägesgivare (hemläge + utsträckt läge)", qty: 2, name: "SME-8M Reed T-spår M8-kontakt" },
  { sku: "FE-GRLA-14-QS-8-D", role: "Strypbackventil (hastighetsreglering)", qty: 2, name: "GRLA-1/4-QS-8" },
  { sku: "FE-MS4-LF-14-CRG", role: "FRL-enhet (Filter-Regulator-Smörjare)", qty: 1, name: "MS4 Filter G1/4" },
];
const importerat = () => importeraKrav({ name: "Sortering", description: SORTERING, answers: {}, bom_lines: STYCKLISTA, revision: 2 }, NU);

Deno.test("komponentsorten läses ur stycklistans roller", () => {
  const k = (roll: string, namn?: string) => komponentsort({ sku: "X", roll, antal: 1, namn });
  assertEquals(k("Magnetventil (5/2-vägs styrventil)"), "ventil52");
  assertEquals(k("Ändlägesgivare (hemläge + utsträckt läge)"), "givare");
  assertEquals(k("Servodrivare (drivsteg)"), "drivsteg");
  assertEquals(k("Servomotor"), "motor");
  assertEquals(k("Motorkabel"), "ovrig");
  assertEquals(k("Primär aktuator", "AVENTICS PRA Ø40 ISO 15552 Cylinder"), "cylinder");
  assertEquals(k("⚠️ Säkerhetscertifierad magnetventil SIL/PLd"), "sakerhetsventil");
  assertEquals(k("Pilotmanövrerad backslagsventil"), "ovrig");
  assertEquals(k("Strypbackventil (hastighetsreglering)"), "ovrig");
  assertEquals(k("Stångbroms/mekaniskt lås (fail-safe)"), "stangbroms");
});

Deno.test("I/O-listan ur stycklistan: ventil, två givare och kontrollstationens signal", () => {
  const s = foreslaSignaler(importerat());
  const rad = (tagg: string) => s.find((x) => x.tagg === tagg)!;
  assertEquals([rad("-QM1.Y1").typ, rad("-QM1.Y1").datatyp, rad("-QM1.Y1").namn], ["DO", "BOOL", "Rörelse ut"]);
  assertEquals([rad("-BG1").namn, rad("-BG2").namn], ["Ute", "Inne"]);
  assertEquals(rad("-KF1.Utsortering").typ, "DI");
  assert(/digitala I\/O/.test(rad("-KF1.Utsortering").beskrivning));
  // Inget hittas på: adresser och felsäkra lägen är tomma, allt är föreslaget.
  assert(s.every((x) => x.adress === "" && x.felsakert === "" && x.status === "foreslagen"));
  assert(s.every((x) => x.kalla.length > 0));
  // Strypbackventiler och luftberedning har ingen I/O.
  assertEquals(s.filter((x) => x.kalla.includes("GRLA") || x.kalla.includes("MS4")), []);
  assertEquals(kontrolleraSignaler(s), []);
});

Deno.test("ett nytt förslag skriver aldrig över användarens ändringar", () => {
  const forsta = foreslaSignaler(importerat());
  const andrad: Signal[] = forsta.map((x) => x.tagg === "-QM1.Y1" ? { ...x, adress: "%Q0.0", status: "bekraftad" } : x);
  const { lista, nya } = sammanfoga(andrad, foreslaSignaler(importerat()));
  assertEquals(nya, 0);
  assertEquals(lista.find((x) => x.tagg === "-QM1.Y1")?.adress, "%Q0.0");
  assertEquals(lista.length, forsta.length);
});

Deno.test("sekvensen för utsortering: grundläge, beslut, låda, ut, åter -- med tidsgränser", () => {
  const s = foreslaSignaler(importerat());
  const kedja = foreslaSekvens(importerat(), s);
  assertEquals(kedja.map((x) => x.nummer), ["S0", "S1", "S2", "S3", "S4"]);
  const ut = kedja.find((x) => x.nummer === "S3")!;
  assertEquals([ut.namn, ut.atgard, ut.slutvillkor, ut.tidsgrans], ["Skjut ut", "-QM1.Y1 = 1", "-BG1 Ute = 1", "par-steg-s3"]);
  assert(/öppen fråga/.test(kedja.find((x) => x.nummer === "S2")!.slutvillkor));
  assertEquals(kedja.find((x) => x.nummer === "S1")!.slutvillkor, "-KF1.Utsortering = 1");
  // Parametrarna: en tidsgräns per steg som har en, utan påhittade värden.
  const p = foreslaParametrar(kedja);
  assertEquals(p.map((x) => x.id), ["par-steg-s0", "par-steg-s3", "par-steg-s4"]);
  assert(p.every((x) => x.min === "" && x.max === "" && x.standard === "" && x.enhet === "ms"));
});

Deno.test("utan givare i stycklistan står ändlägena som öppna frågor, inga påhittade signaler", () => {
  const imp = importeraKrav({ name: "X", description: "Skjuta ut en låda 200 mm", answers: {}, bom_lines: STYCKLISTA.filter((r) => !/givare/i.test(r.role)), revision: 1 }, NU);
  const s = foreslaSignaler(imp);
  assertEquals(s.filter((x) => x.typ === "DI"), []);
  const kedja = foreslaSekvens(imp, s);
  assert(kedja.some((x) => /ingen givare i stycklistan/.test(x.slutvillkor)));
});

Deno.test("larmen: tidsgränser, givarfel, mottagning, och säkerhet som granskning -- aldrig logik", () => {
  const s = foreslaSignaler(importerat());
  const kedja = foreslaSekvens(importerat(), s);
  const l = foreslaLarm(importerat(), s, kedja);
  assertEquals(l.filter((x) => x.steg).map((x) => x.steg), ["steg-s0", "steg-s3", "steg-s4"]);
  assert(l.some((x) => x.id === "larm-givare-bada"));
  assert(l.some((x) => x.id === "larm-mottagning" && /givare saknas/.test(x.villkor)));
  const sak = l.filter((x) => x.typ === "sakerhetsgranskning");
  assertEquals(sak.length, 1);
  assert(/säkerhetskretsen/.test(sak[0].reaktion) && /Återställning är inte start/.test(sak[0].aterstallning));
});

Deno.test("testplanen: I/O först, sedan steg, larm och de fyra felfallen -- allt ej utfört", () => {
  const s = foreslaSignaler(importerat());
  const kedja = foreslaSekvens(importerat(), s);
  const l = foreslaLarm(importerat(), s, kedja);
  const t = foreslaTestfall(s, kedja, l);
  assert(t.every((x) => x.utfall === "ej_utfort" && x.ansvarig === "" && x.datum === "" && x.faktiskt === ""));
  assertEquals(t[0].id, `test-io-${s[0].id}`);
  for (const f of ["spanningsbortfall", "kommunikationsbortfall", "forloradProdukt", "aterstart"]) {
    assert(t.some((x) => x.id === `test-felfall-${f}`), f);
  }
  // Ingen testfall för säkerhetsgranskningen: den prövas i valideringen, inte här.
  assert(!t.some((x) => x.avser.includes("granskning-sakerhet")));
});

Deno.test("en ändrad artikel gör signal, steg, larm och testfall inaktuella -- inget raderas", () => {
  const imp = importerat();
  const s = foreslaSignaler(imp);
  const kedja = foreslaSekvens(imp, s);
  const l = foreslaLarm(imp, s, kedja);
  const u = { ...tomtUnderlag(imp), signaler: s, steg: kedja, larm: l, testfall: foreslaTestfall(s, kedja, l) };
  const efter = markeraInaktuella(u, ["FE-MFH-5-1-8"], "Ventilen ändrad i maskinprojektet rev. 3");
  assertEquals(efter.signaler.find((x) => x.tagg === "-QM1.Y1")?.status, "inaktuell");
  assertEquals(efter.signaler.find((x) => x.tagg === "-BG1")?.status, "foreslagen");
  assertEquals(efter.steg.find((x) => x.nummer === "S3")?.status, "inaktuell");
  assertEquals(efter.steg.find((x) => x.nummer === "S1")?.status, "foreslagen");
  assertEquals(efter.larm.find((x) => x.steg === "steg-s3")?.status, "inaktuell");
  assert(efter.testfall.some((x) => x.status === "inaktuell" && x.inaktuellOrsak === "Ventilen ändrad i maskinprojektet rev. 3"));
  assertEquals([efter.signaler.length, efter.steg.length, efter.larm.length, efter.testfall.length], [u.signaler.length, u.steg.length, u.larm.length, u.testfall.length]);
  assertEquals(markeraInaktuella(u, [], "x"), u);
});

Deno.test("I/O-kontrollen hittar dubbla taggar, dubbla adresser och fel datatyp", () => {
  const s = foreslaSignaler(importerat());
  const fel = kontrolleraSignaler([
    ...s.map((x, i) => i < 2 ? { ...x, adress: "%I0.0" } : x),
    { ...s[0], id: "kopia", adress: "" },
    { ...s[1], id: "fel-typ", tagg: "-BG9", datatyp: "INT" as const },
  ]);
  assertEquals(fel.map((f) => f.kod).sort(), ["datatyp", "dubbel_adress", "dubbel_tagg"]);
});

// ── Steg 8: statusar och export ─────────────────────────────────────────────
import { arKomplett, exportJson, exportMarkdown, exportSignalerCsv, leveransstatus, VARNINGSTEXT } from "../src/lib/plc/leverans.ts";

function fulltUnderlag() {
  const imp = importerat();
  const s = foreslaSignaler(imp);
  const kedja = foreslaSekvens(imp, s);
  const l = foreslaLarm(imp, s, kedja);
  return { ...tomtUnderlag(imp), signaler: s, parametrar: foreslaParametrar(kedja), steg: kedja, larm: l, testfall: foreslaTestfall(s, kedja, l) };
}

Deno.test("statustavlan: separata statusar, programförslag ej tillgängligt, kontroller ej utförda", () => {
  const rader = leveransstatus(fulltUnderlag());
  const s = (id: string) => rader.find((r) => r.id === id)!.status;
  assertEquals([s("krav"), s("signaler"), s("sekvens"), s("larm"), s("testplan")], ["ofullstandigt", "ofullstandigt", "ofullstandigt", "ofullstandigt", "ofullstandigt"]);
  assertEquals([s("programforslag"), s("kontroller"), s("granskning")], ["ej_tillgangligt", "ej_utfort", "ej_utfort"]);
  assert(/utan adress/.test(rader.find((r) => r.id === "signaler")!.text));
  assertEquals(arKomplett(fulltUnderlag()), false);
  assertEquals(leveransstatus(tomtUnderlag(importerat())).find((r) => r.id === "signaler")!.status, "saknas");
});

Deno.test("ett ofullständigt underlag kan exporteras, märkt, med revision och öppna frågor", () => {
  const text = exportMarkdown(fulltUnderlag(), { projektnamn: "Sortering", underlagsrevision: 7, datum: "2026-10-13" });
  assert(text.includes(VARNINGSTEXT));
  assert(text.includes("**OFULLSTÄNDIGT UNDERLAG.**"));
  assert(text.includes("Underlagets revision: 7 · Krav ur maskinprojektets revision: 2"));
  assert(/## Öppna frågor\n- Är 350 mm/.test(text));
  assert(text.includes("| -QM1.Y1 | Rörelse ut | DO | BOOL | — |"));
  assert(text.includes("Ej utfört"));
  assert(!/Godkänt \|/.test(text.split("## Testplan")[1].split("## Antaganden")[0].replace(/Ej godkänt/g, "")));
});

Deno.test("CSV-exporten skriver tom adress tom, aldrig noll", () => {
  const csv = exportSignalerCsv(fulltUnderlag().signaler);
  const rad = csv.split("\r\n").find((r) => r.startsWith("-QM1.Y1;"))!;
  assertEquals(rad.split(";")[4], "");
  assert(csv.startsWith("Tagg;Namn;Typ;Datatyp;Adress;"));
});

Deno.test("JSON-exporten bär varning, revision och ofullständighet", () => {
  const j = JSON.parse(exportJson(fulltUnderlag(), { projektnamn: "Sortering", underlagsrevision: 7, datum: "2026-10-13" }));
  assertEquals([j.varning, j.ofullstandigt, j.underlagsrevision, j.kallrevision], [VARNINGSTEXT, true, 7, 2]);
});

Deno.test("stegens lägen: det aktiva, det som saknas och en konflikt i signalerna", async () => {
  const { plcStegLagen } = await import("../src/lib/plc/steglagen.ts");
  const u = tomtUnderlag(importerat());
  const tomt = plcStegLagen(u, 1);
  assertEquals(tomt[0], "aktivt");
  // Kraven är hämtade men inte bekräftade (saknas); resten är inte påbörjat.
  assertEquals(tomt[1], "ny");
  assert(tomt.slice(2, 7).every((l) => l === "ny"), JSON.stringify(tomt));
  // Två signaler med samma adress är en konflikt i steg 4.
  const sig = foreslaSignaler(u.importerat);
  const krock = sig.slice(0, 2).map((s) => ({ ...s, adress: "%I0.0", typ: "DI" as const }));
  const med = { ...u, signaler: [...krock, ...sig.slice(2)] };
  assertEquals(plcStegLagen(med, 2)[3], "konflikt");
  assertEquals(plcStegLagen(med, 4)[3], "aktivt", "det aktiva steget visas som aktivt");
});
