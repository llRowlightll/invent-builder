/// <reference lib="deno.ns" />
// Körs med: deno test --no-lock --node-modules-dir=none tests/plc.test.ts
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@^1";
import { importeraKrav, jamforKomponenter, jamforKrav, type ProjektKalla } from "../src/lib/plc/krav.ts";
import { harleddaFragor, saknas, skillnader } from "../src/lib/plc/kontroll.ts";
import { arAldreImport, lasUnderlag, STATUSNAMN, tomtUnderlag, type Underlag } from "../src/lib/plc/modell.ts";
import { SORTERING } from "../supabase/functions/groq-advisor/fixtur-sortering.ts";
import { mojligheter, PLATTFORMAR } from "../src/lib/plc/plattformar.ts";

const NU = new Date("2026-10-12T10:00:00Z");
const projekt = (p: Partial<ProjektKalla>): ProjektKalla => ({
  name: "Prov", description: null, answers: {}, bom_lines: [], revision: 1, ...p,
});
const varde = (krav: { id: string; varde: string }[], id: string) => krav.find((k) => k.id === id)?.varde;

// ── Kravimporten (ur kravbilden, sedan 2026-10-13) ──────────────────────────

const krav = (imp: { krav: Array<{ objekt?: string; egenskap?: string; varde: string }> }, objekt: string, egenskap: string) =>
  imp.krav.filter((k) => k.objekt === objekt && k.egenskap === egenskap);

Deno.test("Gemini-fallet: kraven hämtas med föremål, ursprung och revision", () => {
  const imp = importeraKrav(projekt({
    description: "Horisontell förflyttning av en last på 80 kg, slaglängd 2000 mm, minst 1 m/s, noggrannhet ±0,1 mm. Miljö med aluminiumdamm, drift 24/7.",
    revision: 3,
  }), NU);
  assertEquals(imp.kallrevision, 3);
  assertEquals(imp.hamtat, "2026-10-12T10:00:00.000Z");
  assertEquals(krav(imp, "produkt", "massa")[0].varde, "80 kg");
  assertEquals(krav(imp, "aktuator", "slaglangd")[0].varde, "2000 mm");
  assertEquals(krav(imp, "aktuator", "hastighet")[0].varde, "minst 1 m/s");
  assertEquals(krav(imp, "aktuator", "noggrannhet")[0].varde, "±0,1 mm");
  assertEquals(krav(imp, "aktuator", "riktning")[0].varde, "Vågrät");
  assertEquals(krav(imp, "maskin", "miljo")[0].varde, "aluminiumdamm");
  assert(imp.krav.every((k) => k.kalla === "beskrivning" && k.ursprung === "anvandare" && k.bekraftelse === "ej_bekraftat"));
  assertEquals(imp.processbeskrivning?.startsWith("Horisontell förflyttning"), true);
});

Deno.test("lådsorteringen: bandets hastighet är bandets och intervallet står kvar", () => {
  const imp = importeraKrav(projekt({ description: SORTERING, revision: 2 }), NU);
  assertEquals(krav(imp, "transportband", "hastighet")[0].varde, "0,25 m/s");
  assertEquals(krav(imp, "aktuator", "hastighet"), []);
  assertEquals(krav(imp, "produkt", "massa")[0].varde, "0,5–3 kg");
  const dim = krav(imp, "produkt", "dimensionerande_massa")[0] as { varde: string; ursprung?: string; kalla: string; metod?: string };
  assertEquals([dim.varde, dim.ursprung, dim.kalla], ["3 kg", "berakning", "harlett"]);
  assert(/intervall/.test(dim.metod ?? ""));
  // Det som saknas och det som inte är avgjort följer med som luckor.
  const saknas = (imp.saknas ?? []).map((x) => x.id);
  for (const id of ["saknas-utskjutarhastighet", "saknas-minsta-avstand", "saknas-produktdetektering", "saknas-blockerad-mottagning", "saknas-plc-modell", "saknas-signaladresser"]) {
    assert(saknas.includes(id), id);
  }
  assert((imp.osakra ?? []).some((o) => /350 mm/.test(o.sv)));
});

Deno.test("24/7 blir drifttid, aldrig takt eller cykeltid", () => {
  const imp = importeraKrav(projekt({ description: "Pressa in en bussning med 2 kN, maskinen går 24/7" }), NU);
  assertEquals(krav(imp, "maskin", "drifttid")[0].varde, "Dygnet runt (24/7)");
  assertEquals(krav(imp, "aktuator", "takt"), []);
  assertEquals(krav(imp, "aktuator", "cykeltid"), []);
  assertEquals(krav(imp, "aktuator", "kraft")[0].varde, "2000 N");
});

Deno.test("takten kommer bara från kundens svar, och 'Vet inte' lämnar den tom", () => {
  const angiven = importeraKrav(projekt({ description: "Lyfta lådor", answers: { takt: "6 per minut" } }), NU);
  const t = krav(angiven, "aktuator", "takt")[0] as { varde: string; kalla: string; kallaDetalj?: string };
  assertEquals([t.varde, t.kalla, t.kallaDetalj], ["6 per minut", "svar", "takt"]);
  const okand = importeraKrav(projekt({ description: "Lyfta lådor", answers: { takt: "Vet inte" } }), NU);
  assertEquals(krav(okand, "aktuator", "takt"), []);
});

Deno.test("ett värde som bara står i ett svar får ursprunget svar", () => {
  const imp = importeraKrav(projekt({ description: "Lyfta lådor", answers: { last_kg: "12", slaglangd_mm: "300" } }), NU);
  assertEquals(imp.krav.find((k) => k.egenskap === "massa")?.kalla, "svar");
  assertEquals(imp.krav.find((k) => k.egenskap === "slaglangd")?.kalla, "svar");
  // Lyftet står i beskrivningen, inte i svaren.
  assertEquals(krav(imp, "aktuator", "riktning")[0].varde, "Lodrät (lyft)");
});

Deno.test("tolkningsbesluten från maskinbyggaren följer med och syns inte som svar", () => {
  const imp = importeraKrav(projekt({
    description: "Vi behöver 0,8 m/s.",
    answers: { "tolkning:tolkning-krav-hastighet-0_8": "transportband", "tolkning:alla": "bekraftat" },
  }), NU);
  assertEquals(krav(imp, "transportband", "hastighet")[0].varde, "0,8 m/s");
  assert(imp.krav.every((k) => k.bekraftelse === "bekraftat"));
  assert(!imp.krav.some((k) => k.kallaDetalj?.startsWith("tolkning")));
});

Deno.test("komponenterna följer med från stycklistan", () => {
  const imp = importeraKrav(projekt({
    description: "Lyfta lådor",
    bom_lines: [
      { sku: "FESTO-CMMP-AS", role: "Servodrivare (drivsteg)", qty: 1, name: "CMMP-AS" },
      { sku: "SPECIFY", role: "Hydraulisk stötdämpare", qty: 2 },
    ],
  }), NU);
  assertEquals(imp.komponenter, [
    { sku: "FESTO-CMMP-AS", roll: "Servodrivare (drivsteg)", antal: 1, namn: "CMMP-AS" },
    { sku: "SPECIFY", roll: "Hydraulisk stötdämpare", antal: 2 },
  ]);
});

Deno.test("en befintlig maskin utan beskrivning ger inga påhittade krav", () => {
  const imp = importeraKrav(projekt({ name: "Station 4", description: "" }), NU);
  assertEquals(imp.krav.filter((k) => k.egenskap !== "svar"), []);
  assertEquals(imp.komponenter, []);
});

Deno.test("ett underlag från före kravbilden känns igen som en äldre import", () => {
  assertEquals(arAldreImport({ kallrevision: 1, hamtat: "", komponenter: [], krav: [{ id: "hastighet", varde: "0,25 m/s", kalla: "beskrivning" }] }), true);
  assertEquals(arAldreImport(importeraKrav(projekt({ description: SORTERING }), NU)), false);
  assertEquals(arAldreImport({ kallrevision: 1, hamtat: "", komponenter: [], krav: [] }), false);
});

// ── Ändringar mellan två hämtningar ─────────────────────────────────────────

Deno.test("jamforKrav visar ändrade, nya och borttagna krav med gammalt och nytt värde", () => {
  const fore = [
    { id: "massa", varde: "80 kg", kalla: "beskrivning" as const },
    { id: "slag", varde: "2000 mm", kalla: "beskrivning" as const },
    { id: "drift", varde: "24_7", kalla: "beskrivning" as const },
  ];
  const efter = [
    { id: "massa", varde: "80 kg", kalla: "beskrivning" as const },
    { id: "slag", varde: "1500 mm", kalla: "svar" as const },
    { id: "miljo_damm", varde: "damm", kalla: "beskrivning" as const },
  ];
  assertEquals(jamforKrav(fore, efter), [
    { id: "slag", fore: "2000 mm", efter: "1500 mm" },
    { id: "miljo_damm", fore: null, efter: "damm" },
    { id: "drift", fore: "24_7", efter: null },
  ]);
  assertEquals(jamforKrav(fore, fore), []);
});

Deno.test("jamforKomponenter jämför per artikel och roll och summerar dubbletter", () => {
  const fore = [
    { sku: "FE-MFH-5-1-8", roll: "Magnetventil", antal: 1 },
    { sku: "FE-SME-8M", roll: "Ändlägesgivare", antal: 1 },
    { sku: "FE-SME-8M", roll: "Ändlägesgivare", antal: 1 },
  ];
  const efter = [
    { sku: "FE-SME-8M", roll: "Ändlägesgivare", antal: 2 },
    { sku: "FESTO-CMMP-AS", roll: "Servodrivare (drivsteg)", antal: 1 },
  ];
  assertEquals(jamforKomponenter(fore, efter), [
    { sku: "FESTO-CMMP-AS", roll: "Servodrivare (drivsteg)", fore: null, efter: 1 },
    { sku: "FE-MFH-5-1-8", roll: "Magnetventil", fore: 1, efter: null },
  ]);
});

// ── Capability-registret ────────────────────────────────────────────────────

Deno.test("okänd plattform spärrar plattformsexport och kod men aldrig underlaget", () => {
  for (const id of ["annan", "", "s5"]) {
    assertEquals(mojligheter(id), { underlag: true, plattformsexport: false, kod: false, orsak: "okand_plattform" });
  }
});

Deno.test("kända plattformar har underlag men ingen kod eller export förrän en adapter provats", () => {
  for (const p of PLATTFORMAR) {
    assertEquals(mojligheter(p.id), { underlag: true, plattformsexport: false, kod: false, orsak: "ingen_adapter" });
    assertEquals([p.kodgenerering, p.kompilering, p.simulering], [false, false, false]);
    assertEquals([p.exportformat.length, p.versionerSomStods.length, p.tillatnaBibliotek.length], [0, 0, 0]);
  }
});

Deno.test("PLC, programmeringsmiljö och språk hålls isär i registret", () => {
  const siemens = PLATTFORMAR.find((p) => p.id === "siemens");
  assertEquals(siemens?.miljo, "TIA Portal");
  assert(siemens?.plcExempel.includes("S7-1500"));
  assert(siemens?.sprak.includes("SCL"));
  assert(!siemens?.sprak.includes("TIA Portal"));
});

// ── Datamodellen ────────────────────────────────────────────────────────────

const IMPORTERAT = { kallrevision: 2, hamtat: "2026-10-12T10:00:00.000Z", krav: [], komponenter: [] };

Deno.test("alla sju statusar börjar som inte utförda", () => {
  const u = tomtUnderlag(IMPORTERAT);
  assertEquals(Object.keys(u.statusar).sort(), [...STATUSNAMN].sort());
  assert(Object.values(u.statusar).every((s) => s.status === "inte_utfort"));
});

Deno.test("lasUnderlag fyller delar som saknas i ett äldre underlag", () => {
  const u = lasUnderlag({ schemaVersion: 1, importerat: IMPORTERAT, plattform: { tillverkare: "siemens" } });
  assertEquals(u.plattform.tillverkare, "siemens");
  assertEquals(u.plattform.kravPaVal, "");
  assertEquals(u.omfattning.innehall, []);
  assertEquals(u.antaganden, []);
  assertEquals(u.statusar.kompilering, { status: "inte_utfort" });
});

Deno.test("lasUnderlag vägrar en okänd schemaversion i stället för att gissa", () => {
  assertThrows(() => lasUnderlag({ schemaVersion: 2, importerat: IMPORTERAT }), Error, "schemaversion");
  assertThrows(() => lasUnderlag(null), Error, "schemaversion");
});

// ── Kontrollerna ────────────────────────────────────────────────────────────

const ifyllt = (): Underlag => {
  const u = tomtUnderlag(IMPORTERAT);
  u.omfattning = { leverans: "underlag", omfattar: "Station 2, lyftaxel", arbete: "ny", andring: "", innehall: ["io_lista", "sekvens"] };
  u.plattform = { ...u.plattform, val: "befintlig", tillverkare: "siemens", plcModell: "S7-1500", miljo: "TIA Portal" };
  return u;
};

Deno.test("saknas listar luckorna i steg 1 och 2 i stegens ordning", () => {
  assertEquals(saknas(tomtUnderlag(IMPORTERAT)).map((s) => `${s.steg}:${s.kod}`), [
    "1:leverans", "1:omfattar", "1:arbete", "1:innehall", "2:plattformsval",
  ]);
  assertEquals(saknas(ifyllt()), []);
});

Deno.test("en ändring kräver en beskrivning av vad som ändras", () => {
  const u = ifyllt();
  u.omfattning.arbete = "andring";
  assertEquals(saknas(u), [{ steg: 1, kod: "andring" }]);
  u.omfattning.andring = "Ny stoppstation före lyftet";
  assertEquals(saknas(u), []);
});

Deno.test("en känd plattform kräver tillverkare, PLC och programmeringsmiljö", () => {
  const u = ifyllt();
  u.plattform = { ...u.plattform, tillverkare: "", plcModell: " ", miljo: "" };
  assertEquals(saknas(u).map((s) => s.kod), ["tillverkare", "plcModell", "miljo"]);
});

Deno.test("vet inte och bestäms senare blir öppna frågor, inte luckor", () => {
  const u = ifyllt();
  u.omfattning.arbete = "vet_inte";
  u.plattform = { ...u.plattform, val: "senare", tillverkare: "", plcModell: "", miljo: "" };
  assertEquals(saknas(u), []);
  assertEquals(harleddaFragor(u), ["arbete_okant", "plattform_senare"]);
  u.plattform = { ...u.plattform, val: "befintlig", tillverkare: "annan", plcModell: "X", miljo: "Y" };
  assertEquals(harleddaFragor(u), ["arbete_okant", "plattform_utanfor_registret"]);
});

Deno.test("skillnader visar varje fält som skiljer, med båda värdena", () => {
  const sparad = ifyllt();
  const din = ifyllt();
  din.plattform.plcModell = "S7-1200";
  din.omfattning.innehall = ["io_lista", "sekvens", "larm"];
  din.importerat = { ...din.importerat, kallrevision: 3 };
  assertEquals(skillnader(sparad, din), [
    { falt: "omfattning.innehall", sparad: "io_lista, sekvens", din: "io_lista, sekvens, larm" },
    { falt: "plattform.plcModell", sparad: "S7-1500", din: "S7-1200" },
    { falt: "importerat.kallrevision", sparad: "2", din: "3" },
  ]);
  assertEquals(skillnader(sparad, ifyllt()), []);
});
