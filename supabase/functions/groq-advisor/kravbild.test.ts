/// <reference lib="deno.ns" />
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { delaSvar, hastighetensFormal, kravetsVarde, tolkaKravbild, type Kravbild } from "./kravbild.ts";

import { SORTERING } from "./fixtur-sortering.ts";

const hitta = (kb: Kravbild, objekt: string, egenskap: string) => kb.krav.filter((k) => k.objektId === objekt && k.egenskap === egenskap);
const ett = (kb: Kravbild, objekt: string, egenskap: string) => {
  const k = hitta(kb, objekt, egenskap);
  assertEquals(k.length, 1, `${objekt}.${egenskap}: ${JSON.stringify(k)}`);
  return k[0];
};

Deno.test("sortering: bandets hastighet är bandets, och utskjutarens är okänd", () => {
  const kb = tolkaKravbild(SORTERING);
  assertEquals(kb.tillampning, "sortering_utskjutning");
  const band = ett(kb, "transportband", "hastighet");
  assertEquals(band.varde, 0.25);
  assertEquals(band.enhet, "m/s");
  assertEquals(hitta(kb, "aktuator", "hastighet"), []);
  assert(kb.saknas.some((s) => s.id === "saknas-utskjutarhastighet"));
  // Ingen fråga om vilken del 0,25 m/s gäller: meningen säger det.
  assertEquals(kb.osakra.filter((o) => o.kravId.startsWith("krav-hastighet")), []);
});

Deno.test("sortering: massintervallet bevaras och maxvärdet är ett eget härlett lastfall", () => {
  const kb = tolkaKravbild(SORTERING);
  const massa = ett(kb, "produkt", "massa");
  assertEquals(massa.intervall, { min: 0.5, max: 3 });
  assertEquals(kravetsVarde(massa), "0,5–3 kg");
  const dim = ett(kb, "produkt", "dimensionerande_massa");
  assertEquals(dim.varde, 3);
  assertEquals(dim.ursprung, "berakning");
  assertEquals(dim.kalla.utdrag, massa.id);
});

Deno.test("sortering: hela den förväntade kravbilden finns, med enheter", () => {
  const kb = tolkaKravbild(SORTERING);
  assertEquals(kravetsVarde(ett(kb, "produkt", "matt")), "upp till 300 × 200 × 150 mm");
  const flode = ett(kb, "produkt", "flode");
  assertEquals([flode.varde, flode.enhet, flode.grans], [15, "st/min", "max"]);
  assertEquals(kravetsVarde(flode), "upp till 15 st/min");
  assertEquals(ett(kb, "produkt", "sidoforflyttning").varde, 350);
  assertEquals(hitta(kb, "aktuator", "slaglangd"), []);
  assertEquals(ett(kb, "produkt", "avstand").text, "Varierande");
  assertEquals(ett(kb, "kontrollstation", "signal").text, "Signal för utsortering");
  assertEquals(ett(kb, "produkt", "hantering").text, "Utan att välta eller skadas");
  assertEquals(ett(kb, "matning", "tryck").varde, 6);
  assertEquals(ett(kb, "matning", "spanning").text, "24 V DC");
  assertEquals(ett(kb, "styrsystem", "befintlig").text, "Befintligt styrsystem");
  assertEquals(ett(kb, "styrsystem", "io").text, "Digitala I/O");
  assertEquals([ett(kb, "maskin", "drifttid").varde, ett(kb, "maskin", "drifttid").enhet], [16, "h/dag"]);
  assertEquals(ett(kb, "maskin", "miljo").text, "torr, lätt damm");
  assert(kb.objekt.some((o) => o.typ === "mottagning"));
});

Deno.test("sortering: de okända uppgifterna listas och fylls inte med påhittade värden", () => {
  const kb = tolkaKravbild(SORTERING);
  const ids = kb.saknas.map((s) => s.id);
  for (const id of [
    "saknas-utskjutarhastighet", "saknas-rorelseprofil", "saknas-cykeltid", "saknas-minsta-avstand",
    "saknas-utsorteringar-i-foljd", "saknas-plc-modell", "saknas-signaladresser", "saknas-produktdetektering",
    "saknas-blockerad-mottagning",
  ]) assert(ids.includes(id), `saknas: ${id}`);
  // Inget krav för de okända storheterna.
  for (const [o, e] of [["aktuator", "hastighet"], ["aktuator", "cykeltid"], ["styrsystem", "modell"]]) {
    assertEquals(hitta(kb, o, e), [], `${o}.${e}`);
  }
  // Varje saknad uppgift säger varför den behövs.
  assert(kb.saknas.every((s) => s.varfor.sv.length > 20));
});

Deno.test("sortering: 350 mm är en osäker tolkning som användaren avgör", () => {
  const kb = tolkaKravbild(SORTERING);
  const t = kb.osakra.find((o) => o.kravId === "krav-produkt-sidoforflyttning");
  assert(t, JSON.stringify(kb.osakra));
  assertEquals(t.forval, "sidoforflyttning");
  assertEquals(t.alternativ.map((a) => a.id), ["sidoforflyttning", "slaglangd"]);
  // Användaren säger att det är slaglängden.
  const kb2 = tolkaKravbild(SORTERING, {}, { "tolkning-krav-produkt-sidoforflyttning": "slaglangd" });
  assertEquals(hitta(kb2, "produkt", "sidoforflyttning"), []);
  assertEquals(ett(kb2, "aktuator", "slaglangd").bekraftelse, "bekraftat");
  assertEquals(kb2.osakra.filter((o) => o.kravId === "krav-produkt-sidoforflyttning"), []);
});

Deno.test("tolkningen är systemets: ej bekräftad tills användaren bekräftar", () => {
  const kb = tolkaKravbild(SORTERING);
  assert(kb.krav.every((k) => k.bekraftelse === "ej_bekraftat"));
  assert(kb.krav.filter((k) => k.kalla.typ === "beskrivning").every((k) => k.ursprung === "anvandare"));
  const alla = tolkaKravbild(SORTERING, {}, { alla: "bekraftat" });
  assert(alla.krav.every((k) => k.bekraftelse === "bekraftat"));
  const avvisad = tolkaKravbild(SORTERING, {}, { "krav-maskin-miljo": "avvisat" });
  assertEquals(ett(avvisad, "maskin", "miljo").bekraftelse, "avvisat");
});

Deno.test("hastigheten knyts till föremålet närmast före talet i meningen", () => {
  // Regressionssvitens T1: ordet transportband finns, men 400 mm/s hör till slaget.
  const t1 = "Horisontell cylinder knuffar 12kg kartonger på transportband, stroke 200mm, 400mm/s, 6 bar";
  assertEquals(hastighetensFormal(t1, t1.indexOf("400mm/s")), "aktuator");
  const kb1 = tolkaKravbild(t1);
  assertEquals(ett(kb1, "aktuator", "hastighet").varde, 0.4);
  assertEquals(ett(kb1, "aktuator", "slaglangd").varde, 200);
  // Geminis fall: "minst 1 m/s" efter slaglängden.
  const gemini = "Horisontell förflyttning av en last på 80 kg, slaglängd 2000 mm, minst 1 m/s, noggrannhet ±0,1 mm.";
  const kb2 = tolkaKravbild(gemini);
  const v = ett(kb2, "aktuator", "hastighet");
  assertEquals([v.varde, v.grans], [1, "minst"]);
  assertEquals(ett(kb2, "aktuator", "noggrannhet").varde, 0.1);
  // Bandet efter talet.
  const efter = "Lådorna kommer i 0,3 m/s på bandet.";
  assertEquals(hastighetensFormal(efter, efter.indexOf("0,3")), "produkt");
});

Deno.test("en hastighet utan föremål blir en fråga, inte en tyst tilldelning", () => {
  const kb = tolkaKravbild("Vi behöver 0,8 m/s.");
  const t = kb.osakra.find((o) => o.kravId.startsWith("krav-hastighet"));
  assert(t);
  assertEquals(t.alternativ.map((a) => a.id), ["aktuator", "transportband"]);
  // Användaren avgör: det är bandet.
  const kb2 = tolkaKravbild("Vi behöver 0,8 m/s.", {}, { [t.id]: "transportband" });
  assertEquals(kb2.osakra, []);
  assertEquals(ett(kb2, "transportband", "hastighet").varde, 0.8);
  assertEquals(hitta(kb2, "aktuator", "hastighet"), []);
});

Deno.test("svaren följer med med frågans id som källa; 'Vet inte' blir en lucka", () => {
  const kb = tolkaKravbild("Lyfta lådor", { last_kg: "12", slaglangd_mm: "300", styrning: "Ventilterminal", hastighet: "Vet inte" });
  const massa = ett(kb, "produkt", "massa");
  assertEquals([massa.varde, massa.kalla.typ, massa.kalla.svarId], [12, "svar", "last_kg"]);
  assertEquals(ett(kb, "aktuator", "slaglangd").varde, 300);
  assertEquals(kb.krav.find((k) => k.kalla.svarId === "styrning")?.text, "Ventilterminal");
  assertEquals(hitta(kb, "aktuator", "hastighet"), []);
  const intervall = tolkaKravbild("Lyfta lådor", { last_kg: "5–20" });
  assertEquals(ett(intervall, "produkt", "massa").intervall, { min: 5, max: 20 });
});

Deno.test("delaSvar håller tolkningsbesluten borta från detektorernas text", () => {
  const { svar, tolkning } = delaSvar({ last_kg: "3", "tolkning:tolkning-krav-hastighet-0_8": "transportband", "tolkning:alla": "bekraftat" });
  assertEquals(svar, { last_kg: "3" });
  assertEquals(tolkning, { "tolkning-krav-hastighet-0_8": "transportband", alla: "bekraftat" });
});

Deno.test("mått, flöde och slaglängd blandas inte ihop", () => {
  const kb = tolkaKravbild("Cylinder 150mm stroke, hastighet 1200mm/s, 30 cykler per minut, detaljen är 100 x 50 mm.");
  assertEquals(ett(kb, "aktuator", "slaglangd").varde, 150);
  assertEquals(ett(kb, "aktuator", "hastighet").varde, 1.2);
  assertEquals(ett(kb, "aktuator", "takt").varde, 30);
  assertEquals(ett(kb, "produkt", "matt").text, "100 × 50");
});

Deno.test("sorteringsfrågornas svar fyller kravbilden och tar bort luckorna", () => {
  const kb = tolkaKravbild(SORTERING, {
    band_vid_utskjutning: "Bandet går hela tiden", utskjutningstid_s: "1,2", minsta_avstand_mm: "150",
    utsorteringar_i_foljd: "Ja, två i följd", rorlig_massa_kg: "Vet inte",
  });
  assertEquals(ett(kb, "transportband", "vid_utskjutning").text, "Bandet går hela tiden");
  assertEquals(ett(kb, "aktuator", "cykeltid").varde, 1.2);
  assertEquals(ett(kb, "produkt", "minsta_avstand").varde, 150);
  assertEquals(ett(kb, "produkt", "utsorteringar_i_foljd").text, "Ja, två i följd");
  assertEquals(hitta(kb, "aktuator", "rorlig_massa"), []);
  const ids = kb.saknas.map((s) => s.id);
  for (const borta of ["saknas-utskjutarhastighet", "saknas-cykeltid", "saknas-minsta-avstand", "saknas-utsorteringar-i-foljd"]) {
    assert(!ids.includes(borta), borta);
  }
  // Programfrågorna står kvar som luckor för PLC-delen.
  for (const kvar of ["saknas-produktdetektering", "saknas-blockerad-mottagning", "saknas-plc-modell"]) assert(ids.includes(kvar), kvar);
});

Deno.test("riktning, säkerhetskrav, temperatur, cykeltid och sammansatt damm läses", () => {
  const kb = tolkaKravbild("Lyfta lådor 12 kg, cykeltid 4 s, upp till 60 °C. Nödstopp krävs. Miljö med aluminiumdamm.");
  assertEquals(ett(kb, "aktuator", "riktning").text, "Lodrät (lyft)");
  assertEquals(ett(kb, "maskin", "sakerhet").text, "Säkerhetsfunktion nämnd");
  assertEquals([ett(kb, "maskin", "temperatur").varde, ett(kb, "maskin", "temperatur").enhet], [60, "°C"]);
  assertEquals(ett(kb, "aktuator", "cykeltid").varde, 4);
  assertEquals(ett(kb, "maskin", "miljo").text, "aluminiumdamm");
  assertEquals(ett(tolkaKravbild("Krav PLd på lyftet."), "maskin", "sakerhet").text, "PL d");
  assertEquals(ett(tolkaKravbild("Säkerhetsfunktionen ska klara SIL 2."), "maskin", "sakerhet").text, "SIL 2");
  // "PLC" är ett styrsystem, inget säkerhetskrav (lådsorteringen: "befintlig PLC").
  assertEquals(hitta(tolkaKravbild("Vi har en befintlig PLC med digitala I/O."), "maskin", "sakerhet"), []);
  assertEquals(hitta(tolkaKravbild(SORTERING), "maskin", "sakerhet"), []);
  assertEquals(hitta(tolkaKravbild("Dammfri miljö."), "maskin", "miljo"), []);
  // Sorteringen är vågrät.
  assertEquals(ett(tolkaKravbild(SORTERING), "aktuator", "riktning").text, "Vågrät");
  assertEquals(kravetsVarde(ett(tolkaKravbild("Noggrannhet ±0,1 mm."), "aktuator", "noggrannhet")), "±0,1 mm");
});
