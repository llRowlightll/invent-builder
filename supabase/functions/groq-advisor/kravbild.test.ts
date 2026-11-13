/// <reference lib="deno.ns" />
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { delaSvar, hastighetensFormal, hastighetensObjekt, kravetsVarde, tolkaKravbild, type Kravbild } from "./kravbild.ts";

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

Deno.test("en hastighet vid ett produktord är aktuatorns när meningen inte nämner bandet", () => {
  // Sajtkritikens fynd 2026-10-13: Fas A gjorde de här till bandets, och motorn tappade dem.
  const fall: Array<[string, string, string]> = [
    ["Skjuta paket 5 kg 300 mm med 0,8 m/s", "0,8", "aktuator"],
    ["cylindern ska skjuta 25 kilos lådor 0,5m sidledes med 0.3m/s", "0.3", "aktuator"],
    ["Pick and place 0.2 kg parts, 3 positions, 1.5 m/s, cleanroom", "1.5", "aktuator"],
    ["Lådorna kommer i 0,3 m/s på bandet. En cylinder skjuter ut dem.", "0,3", "transportband"],
    // Bandet nämns i en annan mening och meningen saknar rörelseord: bandets.
    ["Ett transportband matar fram detaljerna. Detaljerna 0,2 m/s.", "0,2", "transportband"],
  ];
  for (const [text, tal, vantat] of fall) {
    assertEquals(hastighetensObjekt(text, text.indexOf(tal)), vantat, text);
    const kb = tolkaKravbild(text);
    assertEquals(kb.krav.find((k) => k.egenskap === "hastighet")?.objektId, vantat, text);
    // Fortfarande en fråga: systemet gissar, användaren avgör.
    assertEquals(kb.osakra.find((o) => o.kravId.startsWith("krav-hastighet"))?.forval, vantat, text);
  }
});

// ── Lyft, personal och enheter (sajtkritiken 2026-11-11) ────────────────────
import { langderITexten, personalUnderLasten, slagKravId } from "./kravbild.ts";
import { extractLoadKg, extractMinStroke } from "./signals.ts";

Deno.test("lyfthöjden syns som slaglängd, och motorn räknar med samma tal", () => {
  const fall: Array<[string, number]> = [
    ["Lyfta lådor 40 kg vertikalt 400 mm", 400],
    ["Cylindern ska lyfta en lucka 250 mm uppåt", 250],
    ["Höja bordet 30 mm", 30],
    ["Sänka plattan 120 mm, 6 bar", 120],
    ["Lift a 20 kg part 300 mm vertically", 300],
    ["Lyftet är 40 cm", 400],
    ["Lyfta 0,5 m", 500],
    ["Slaglängden är ca 200 mm", 200],
  ];
  for (const [text, mm] of fall) {
    const kb = tolkaKravbild(text);
    const slag = ett(kb, "aktuator", "slaglangd");
    assertEquals(slag.varde, mm, text);
    assertEquals(extractMinStroke({}, text), mm, text);
    assertEquals(kb.osakra.filter((o) => o.kravId.startsWith("krav-slag")), [], text);
  }
});

Deno.test("mått och avstånd blir aldrig en slaglängd", () => {
  const fall: Array<[string, number]> = [
    ["Lådor 400 mm långa ska lyftas 200 mm", 200],
    ["Avstånd 150 mm mellan lådorna, skjuta 300 mm i sidled", 300],
    ["Paketen har en bredd av 350 mm och ska lyftas 120 mm", 120],
    ["Ø63 mm cylinder, slag 160 mm", 160],
    ["Lådorna är 600 mm höga, slag 250 mm", 250],
  ];
  for (const [text, mm] of fall) {
    assertEquals(extractMinStroke({}, text), mm, text);
    const kb = tolkaKravbild(text);
    // Sidled är produktens förflyttning (en fråga om slaget), annars slaget.
    const k = hitta(kb, "aktuator", "slaglangd").concat(hitta(kb, "produkt", "sidoforflyttning"));
    assertEquals(k.map((x) => x.varde), [mm], text);
  }
  // "Lucka" är också en dörr som lyfts.
  assertEquals(extractMinStroke({}, "Cylindern ska lyfta en lucka 250 mm uppåt"), 250);
  const kb = tolkaKravbild("Minsta avstånd 150 mm mellan lådorna");
  assertEquals(ett(kb, "produkt", "minsta_avstand").varde, 150);
  assertEquals(hitta(kb, "aktuator", "slaglangd"), []);
  assertEquals(extractMinStroke({}, "Minsta avstånd 150 mm mellan lådorna"), 0);
  // En borrning är varken produktens mått eller ett slag.
  assertEquals(langderITexten("Ø50 mm"), []);
});

Deno.test("ett mått utan rörelseord är en synlig gissning som användaren avgör", () => {
  const text = "Kartong 400 mm, 5 kg";
  const kb = tolkaKravbild(text);
  const slag = ett(kb, "aktuator", "slaglangd");
  assertEquals([slag.varde, slag.ursprung, slag.id], [400, "antagande", slagKravId(400)]);
  assert(kb.osakra.some((o) => o.kravId === slagKravId(400)));
  assertEquals(extractMinStroke({}, text), 400);
  // "Nej, ett mått": motorn släpper talet och panelen stryker det.
  const beslut = { [`tolkning-${slagKravId(400)}`]: "inte_slag" };
  assertEquals(extractMinStroke({}, text, beslut), 0);
  assertEquals(ett(tolkaKravbild(text, {}, beslut), "aktuator", "slaglangd").bekraftelse, "avvisat");
  // Ett svar på slagfrågan gäller i stället för gissningen.
  const medSvar = tolkaKravbild(text, { slaglangd_mm: "150" });
  assertEquals(hitta(medSvar, "aktuator", "slaglangd").map((k) => k.varde), [150]);
});

Deno.test("personal under lasten står som säkerhetskrav", () => {
  for (const text of [
    "Lyfta lådor 50 kg med gripdon, personal arbetar under lasten",
    "Operatören står ibland under lyftet",
    "People work underneath the load",
    "Under lasten går personal",
  ]) {
    assert(personalUnderLasten(text), text);
    const kb = tolkaKravbild(text);
    assert(hitta(kb, "maskin", "sakerhet").some((k) => k.text === "Personal under lasten: lasten får inte falla"), text);
  }
  for (const text of ["Personalen lastar lådorna", "Under drift ska ingen personal vara i cellen", "Lasten under 5 kg"]) {
    assert(!personalUnderLasten(text), text);
  }
});

Deno.test("kilo, ton och tryckintervall läses", () => {
  assertEquals(ett(tolkaKravbild("Skjuta 25 kilos lådor"), "produkt", "massa").varde, 25);
  assertEquals(ett(tolkaKravbild("Lyfta 1,5 ton"), "produkt", "massa").varde, 1500);
  assertEquals(ett(tolkaKravbild("Detaljer 500 gram"), "produkt", "massa").varde, 0.5);
  assertEquals(ett(tolkaKravbild("Lådor 2–5 kilo"), "produkt", "massa").intervall, { min: 2, max: 5 });
  assertEquals(extractLoadKg("cylindern ska skjuta 25 kilos lådor", {}), 25);
  assertEquals(extractLoadKg("lyfta 1,5 ton", {}), 1500);
  assertEquals(extractLoadKg("gripkraft 50 kgf", {}), 0);
  const tryck = ett(tolkaKravbild("Nätet håller 6–8 bar"), "matning", "tryck");
  assertEquals([tryck.intervall, tryck.varde], [{ min: 6, max: 8 }, 6]);
  assertEquals(kravetsVarde(tryck), "6–8 bar");
  assertEquals(ett(tolkaKravbild("Tryck 6 bar"), "matning", "tryck").varde, 6);
});

Deno.test("med ett uttryckligt lyft är ett mått utan rörelseord bara ett mått", () => {
  const text = "Lyfta lådor 40 kilo vertikalt 400 mm. Kartong 350 mm.";
  const kb = tolkaKravbild(text);
  assertEquals(hitta(kb, "aktuator", "slaglangd").map((k) => k.varde), [400]);
  assertEquals(ett(kb, "produkt", "matt").varde, 350);
  assertEquals(kb.osakra.filter((o) => o.kravId.startsWith("krav-slag")), []);
  assertEquals(extractMinStroke({}, text), 400);
});

// Kundgranskningen 2026-11-13: personornas egna ord som tolkningen missade.
Deno.test("massa per styck, talord och gram nära 'väger' läses", () => {
  const massa = (t: string) => tolkaKravbild(t).krav.filter((k) => k.objektId === "produkt" && k.egenskap === "massa").map((k) => k.varde);
  assertEquals(massa("flaskor 1kg/st från bandet"), [1]);
  assertEquals(massa("ca 1 kg/flaska, 30 st/min"), [1]);
  assertEquals(massa("flaskorna väger ett kilo"), [1]);
  assertEquals(massa("lådan väger en halv kilo"), [0.5]);
  assertEquals(massa("flaskorna väger 800g"), [0.8]);
  // Oförändrat: kg/m är ingen massa, och G1/4 är en gänga.
  assertEquals(massa("profilen väger 5 kg/m"), []);
  assertEquals(massa("anslutning G1/4, 6 bar"), []);
});

Deno.test("takt med vilket ord som helst före /min läses, men inte en fart", () => {
  const flode = (t: string) => tolkaKravbild(t).krav.filter((k) => k.egenskap === "flode" || k.egenskap === "takt").map((k) => `${k.varde} ${k.enhet}`);
  assertEquals(flode("30 flaskor/min"), ["30 st/min"]);
  assertEquals(flode("30 flaskor per minut"), ["30 st/min"]);
  assertEquals(flode("typ 30 st i minuten"), ["30 st/min"]);
  assertEquals(flode("30 pcs/min"), ["30 st/min"]);
  assertEquals(flode("30 bottles per minute"), ["30 st/min"]);
  assertEquals(flode("40 cykler/min"), ["40 cykler/min"]);
  assertEquals(flode("bandet går 12 m/min"), []);
});

Deno.test("slag utan enhet och Ø<borrning>×<slag> ger slaglängden", () => {
  const slag = (t: string) => langderITexten(t).filter((l) => l.typ === "slag").map((l) => l.mm);
  assertEquals(slag("Ø50 slag 200"), [200]);
  assertEquals(slag("behöver DSBC Ø50×200"), [200]);
  assertEquals(slag("ø32x100 mm, 6 bar"), [100]);
  assertEquals(slag("slaglängd 150 mm"), [150]);
  // Inte en takt eller ett tryck.
  assertEquals(slag("30 slag/min"), []);
  assertEquals(slag("slag 30/min"), []);
});

Deno.test("kapslingsklassen står kvar i kravbilden (kundgranskning 2026-11-13)", () => {
  const kb = tolkaKravbild("6 rostfria cylindrar Ø32 slag 100 och en ventilö för tvättzonen, IP69K, livsmedelsgodkänt fett");
  assertEquals(kb.krav.find((k) => k.egenskap === "kapslingsklass")?.text, "IP69K");
});
