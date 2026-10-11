/// <reference lib="deno.ns" />
// Körs med: deno test supabase/functions/groq-advisor/fragor.test.ts
//
// Fallen är riktiga: beskrivningarna och modellens frågor kommer från
// provkörningen mot drift 2026-10-08 (se fragor.ts).
import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  amne, arSakerhetskrav, forfragningstyp, kandaVarden, rensaFragor, reservfragor, slutligaFragor, type Fraga,
} from "./fragor.ts";
import {
  extractPrecisionMm, needsDirtyEnv, needsEndPositionDetection, needsHighCycle, needsOutdoor,
  needsRodLock, needsVerticalLoad, needsWashdown, sagerHorisontell,
} from "./signals.ts";

const LYFT = "Vi behöver lyfta kartonger på 12 kg från ett transportband upp till en hylla, ca 400 mm upp. Styrs av en Siemens PLC.";
const LUFT = "Jag ska byta luftberedning till vår maskin, 6 bar, ungefär 500 l/min.";
const LUCKA = "En cylinder ska öppna och stänga en lucka på ett elektronikskåp, två gånger per dag.";
const BAT = "Vi behöver en rostfri cylinder till en båt som ska tåla saltvatten, borrning 32.";
const BAGERI = "Pick and place av flaskor på ett bageri: plocka 2 kg flaskor från band A och placera på band B, 300 mm i sidled och 150 mm upp.";

const ids = (qs: Fraga[]) => qs.map((q) => q.id);
const amnen = (qs: Fraga[]) => qs.map((q) => amne(q));

Deno.test("förfrågans typ: luftberedning är ingen rörelse, en lucka är det", () => {
  assertEquals(forfragningstyp(LUFT), "luftberedning");
  assertEquals(forfragningstyp(LYFT), "rorelse");
  assertEquals(forfragningstyp(LUCKA), "rorelse");
  assertEquals(forfragningstyp("Behöver fem magnetventiler 5/2 för 24 V DC."), "ventil");
  assertEquals(forfragningstyp("Ändlägesgivare till en Festo-cylinder."), "givare");
  assertEquals(forfragningstyp("10 meter slang 8 mm och kopplingar G1/4."), "slang");
});

Deno.test("PLC är inget säkerhetskrav, PL d och nödstopp är det", () => {
  assertEquals(arSakerhetskrav(LYFT), false);
  assertEquals(arSakerhetskrav("Lyftet ska klara PL d enligt ISO 13849."), true);
  assertEquals(arSakerhetskrav("Det finns ett nödstopp på maskinen."), true);
});

Deno.test("det kunden redan sagt räknas som känt", () => {
  const k = kandaVarden(LYFT);
  assert(k.slag && k.last && k.riktning && k.styrning);
  assertEquals(k.faltbuss, false);
  assert(kandaVarden(LUCKA).takt, "två gånger per dag");
  assert(kandaVarden(LUFT).tryck && kandaVarden(LUFT).flode);
  assert(kandaVarden(BAGERI).slag, "300 mm i sidled och 150 mm upp");
  assertEquals(kandaVarden("Lyfter glasskivor 600x400 mm, 3 kg.").slag, false, "skivans mått är ingen slaglängd");
  assertEquals(kandaVarden(BAT).slag, false, "borrning 32 är ingen slaglängd");
});

Deno.test("luftberedning: inga cylinderfrågor, och det som är sagt frågas inte", () => {
  const modellen: Fraga[] = [
    { id: "required_stroke_length", label: "Vilken slaglängd (mm) krävs för cylindern?", type: "number" },
    { id: "mounting_orientation", label: "Vilken monteringsorientering krävs (t.ex. vertikal, horisontell, lutning)?", type: "choice", options: ["Vertikal (upp/down)", "Horisontell (vänster/höger)"] },
    { id: "anti_rotation", label: "Behöver cylindern anti-rotation eller guide?", type: "choice", options: ["Ja", "Nej"] },
    { id: "ambient_temperature", label: "Vilken är den maximala omgivande temperaturen (°C) där cylindern ska fungera?", type: "number" },
    { id: "duty_cycle", label: "Vilken är den förväntade driftscykeln?", type: "choice", options: ["Kontinuerlig (100%)", "50%"] },
    { id: "programmable_stops", label: "Behöver du programmerbara stopp eller positioner?", type: "choice", options: ["Ja", "Nej"] },
  ];
  assertEquals(rensaFragor(modellen, LUFT, "sv"), []);
  const slut = slutligaFragor(modellen, LUFT, "sv");
  assertEquals(ids(slut), ["luft_anslutning", "luft_filtergrad", "luft_dimsmorjning", "luft_kondensat"]);
  assert(!ids(reservfragor(LUFT, "sv")).some((id) => /tryck|flode/.test(id)), "6 bar och 500 l/min är sagda");
});

Deno.test("lyft med PLC: inga SIL-frågor, ingen riktningsfråga, rätt ord för stångbroms, och greppet frågas", () => {
  const modellen: Fraga[] = [
    { id: "safety_integrity_level", label: "Krävd säkerhetsnivå: SIL 1 / SIL 2 / SIL 3 (IEC 62061) eller PL c / PL d / PL e (ISO 13849)?", type: "choice", options: ["SIL 1 / PL c", "SIL 2 / PL d"] },
    { id: "mechanical_holding_requirement", label: "Krav på mekanisk hållning: fjärrapplicerad kolvblock (pneumatisk cylinder) eller integrerad motorbroms (elektrisk axel) eller extern låsningsenhet?", type: "choice", options: ["Fjärrapplicerad kolvblock", "Integrerad motorbroms", "Extern låsningsenhet"] },
    { id: "fail_safe_behavior", label: "Fail-safe beteende: Hålla position vid strömavbrott (fjärrapplicerad broms) eller kontrollerad återdragning?", type: "choice", options: ["Hålla position", "Kontrollerad återdragning"] },
    { id: "mounting_orientation", label: "Vilken orientering och monteringsläge krävs för den vertikala axeln?", type: "choice", options: ["Vertikal uppåt", "Vertikal nedåt", "Horisontell åt vänster"] },
    { id: "guiding_anti_rotation", label: "Behöver du anti-rotation eller linjär guide för rörelsen?", type: "choice", options: ["Ja, anti-rotation/guide behövs", "Nej, ingen guide behövs"] },
    { id: "fieldbus_type", label: "Vilken fältbus använder Siemens PLC:n?", type: "choice", options: ["PROFINET", "PROFIBUS", "Andra"] },
  ];
  // Modellens hållningsfråga rensas och får rätt ord ...
  const hallning = rensaFragor(modellen, LYFT, "sv").find((q) => q.id === "mechanical_holding_requirement")!;
  assert(!/fjärrapplicerad|kolvblock/i.test(hallning.label + hallning.options!.join(" ")));
  assert(/fjäderbelastat kolvstångslås/.test(hallning.options![0]));
  // ... och ersätts sedan av bankens, vars svar detektorerna läser rätt.
  // Vridskyddet likaså (2026-10-11), och fältbussen frågas inte för en enda
  // cylinder: den avgör bara valet av ventilterminal.
  const slut = slutligaFragor(modellen, LYFT, "sv");
  assertEquals(ids(slut), ["greppsatt", "lasthallning", "vridskydd", "takt"]);
});

Deno.test("lucka på elskåp: takten är sagd, vikten frågas först", () => {
  const modellen: Fraga[] = [
    { id: "stroke_length_mm", label: "Vilken slaglängd (resa) krävs för cylindern i millimeter?", type: "number" },
    { id: "mounting_orientation", label: "Vilken riktning ska cylindern monteras i?", type: "choice", options: ["Vertikal (upp/down)", "Horisontell (vänster/höger)"] },
    { id: "duty_cycle", label: "Hur många cykler per timme förväntas cylindern utföra?", type: "choice", options: ["1", "2", "5"] },
  ];
  assertEquals(rensaFragor(modellen, LUCKA, "sv").find((q) => q.id === "mounting_orientation")!.options![0], "Vertikal (upp/ned)");
  const slut = slutligaFragor(modellen, LUCKA, "sv");
  assertEquals(ids(slut), ["last_kg", "slaglangd_mm", "rorelseriktning", "andlagesavkanning"]);
});

Deno.test("rostfri cylinder till båt: inga livsmedels- eller IP69K-frågor, men frågan om korrosion", () => {
  const modellen: Fraga[] = [
    { id: "required_stroke_length", label: "Vilken slaglängd (i mm) krävs för cylindern?", type: "number" },
    { id: "ip_protection_class", label: "Vilken IP-klass krävs för att skydda mot saltvatten?", type: "choice", options: ["IP67 (splash/immersion)", "IP69K (high-pressure steam/chemical jets, 100 bar, 80°C)"] },
    { id: "material_class", label: "Vilken materialklass ska cylindern ha?", type: "choice", options: ["Stainless steel 316L", "Food-grade plastic (POM/PA)", "Standard material with coating"] },
    { id: "certifications_needed", label: "Vilka certifieringar behövs för den marina miljön?", type: "choice", options: ["FDA", "EC 1935/2004", "EHEDG", "None"] },
    { id: "lubrication_requirement", label: "Vilken typ av smörjmedel krävs?", type: "choice", options: ["Standard grease", "NSF-H1 food-grade lubricant"] },
    { id: "mounting_orientation", label: "Vilken orientering ska cylindern monteras i?", type: "choice", options: ["Horizontal", "Vertical", "Inclined"] },
  ];
  const slut = slutligaFragor(modellen, BAT, "sv");
  assertEquals(ids(slut), ["last_kg", "korrosion", "slaglangd_mm", "rorelseriktning"]);
  assert(!amnen(slut).some((a) => a === "livsmedel" || a === "ipklass"));
});

Deno.test("pick and place på bageri: greppet frågas, livsmedelsfrågan en gång", () => {
  const modellen: Fraga[] = [
    { id: "mounting_orientation", label: "Vilken orientering ska systemet monteras i?", type: "choice", options: ["Vertikal", "Horisontell", "Vinkel"] },
    { id: "guiding_anti_rotation", label: "Behöver du anti-rotation eller guidning för kolven?", type: "choice", options: ["Anti-rotation", "Guidning", "Båda", "Ingen"] },
    { id: "control_system_fieldbus", label: "Vilken typ av styrsystem och fältbus använder du?", type: "choice", options: ["PLC med Modbus TCP", "PLC med EtherCAT"] },
    { id: "ambient_temperature", label: "Vilken är den maximala omgivningstemperaturen där systemet ska fungera?", type: "number" },
    { id: "lubrication_nsf_h1", label: "Behöver du NSF-H1-lubrikation för livsmedelskontakt?", type: "choice", options: ["Ja", "Nej"] },
    { id: "surface_finish_ehedg", label: "Behöver du en ytfinish med Ra ≤ 0.8 µm för EHEDG?", type: "choice", options: ["Ja", "Nej"] },
  ];
  const slut = slutligaFragor(modellen, BAGERI, "sv");
  // Fältbussen avgör ventilterminalen i ett plock-och-placera och frågas med
  // bankens alternativ, som har med vanliga I/O (2026-10-11).
  assertEquals(ids(slut), ["greppsatt", "vridskydd", "ventil_inkoppling", "ambient_temperature", "livsmedelskontakt"]);
});

Deno.test("luftberedning: modellens smörj- och filterfrågor byts mot bankens", () => {
  const modellen: Fraga[] = [
    { id: "connection_size", label: "Vilken anslutningsstorlek behöver du?", type: "choice", options: ['1/2"', '3/4"', '1"'] },
    { id: "filtration", label: "Vilken filtreringsgrad krävs?", type: "choice", options: ["5 µm", "10 µm", "20 µm", "50 µm"] },
    { id: "lubrication", label: "Behöver du smörjning i luftberedningen?", type: "choice", options: ["Fett", "Ingen"] },
    { id: "drain", label: "Vill du ha automatisk kondensavrinning?", type: "choice", options: ["Ja", "Nej"] },
  ];
  assertEquals(ids(slutligaFragor(modellen, LUFT, "sv")), ["luft_anslutning", "luft_filtergrad", "luft_dimsmorjning", "luft_kondensat"]);
});

Deno.test("elaxel: ingen fråga om ändlägesgivare", () => {
  const t = "En elcylinder ska flytta en last på 8 kg mellan tre positioner längs 500 mm, ±0,1 mm.";
  assert(!ids(slutligaFragor([], t, "sv")).includes("andlagesavkanning"));
});

Deno.test("reservfrågor utan modellen: minst tre relevanta, högst sex", () => {
  // "Givare till cylinder." ger tre: vad givaren ska känna av är redan sagt.
  for (const t of [LYFT, LUFT, LUCKA, BAT, BAGERI, "Behöver fem magnetventiler.", "Givare till cylinder.", "Slang och kopplingar."]) {
    const qs = slutligaFragor([], t, "sv");
    assert(qs.length >= 3 && qs.length <= 6, `${t}: ${qs.length}`);
    assertEquals(new Set(ids(qs)).size, qs.length);
  }
});

Deno.test("svarsalternativen läses rätt av detektorerna i nästa steg", () => {
  assert(needsRodLock("Nej, lasten får inte falla ned"));
  assert(needsRodLock("No — load holding required, it must not drop"));
  assert(needsVerticalLoad("Vertikal, lyfter lasten"));
  assert(sagerHorisontell("Horisontell rörelse"));
  assert(needsWashdown("Högtrycksspolas eller tvättas"));
  assert(needsOutdoor("Utomhus"));
  assert(needsDirtyEnv("Dammigt eller smutsigt"));
  assert(needsHighCycle("60 slag/min eller mer", {}));
  assertEquals(needsHighCycle("10–59 slag/min", {}), false);
  assertEquals(needsHighCycle("Upp till 10 slag/min", {}), false);
  assertEquals(extractPrecisionMm("±0,1 mm", {}), 0.1);
  assert(needsEndPositionDetection("Ja, i båda ändlägena"));
  // Inga ord i bankens alternativ som slår på något kunden inte bett om.
  for (const t of [LYFT, LUFT, LUCKA, BAT, BAGERI, "Behöver fem magnetventiler.", "Givare till cylinder.", "Slang och kopplingar."]) {
    for (const q of reservfragor(t, "sv")) {
      for (const o of q.options ?? []) assert(!/styrning|montering|livsmedel|80\s*°c/i.test(o), `${q.id}: ${o}`);
    }
  }
});

// ── Granskningen 2026-10-11 ──────────────────────────────────────────────────
// En ingenjör tyckte att följdfrågorna var "lite knas". Femton vanliga
// förfrågningar kördes mot drift; beskrivningarna och modellens frågor nedan
// är därifrån.

Deno.test("vridning: vinkel och vridmoment, ingen slaglängd, kraft i N eller riktning", () => {
  const t = "Vrida en detalj 90 grader mellan två stationer";
  assertEquals(forfragningstyp(t), "vridning");
  const modellen: Fraga[] = [
    { id: "stroke_length", label: "Vilken slaglängd (i mm) krävs?", type: "number" },
    { id: "required_force", label: "Vilken kraft (N) behöver cylindern kunna hantera för att vrida detaljen?", type: "number" },
    { id: "mounting_orientation", label: "Hur rör sig lasten?", type: "choice", options: ["Horisontell", "Vertikal"] },
    { id: "holding_method", label: "Hur ska detaljen hållas fast under vridningen?", type: "choice", options: ["Klämma", "Magnet", "Vakuum", "Annat"] },
  ];
  const slut = slutligaFragor(modellen, t, "sv");
  const a = amnen(slut);
  assert(ids(slut).includes("vridmoment_nm") && ids(slut).includes("last_kg") && ids(slut).includes("havarm_mm"), ids(slut).join());
  assert(!a.includes("slag") && !a.includes("kraft") && !a.includes("riktning"), a.join());
  // 90 grader är sagt.
  assert(!ids(slut).includes("vridvinkel"));
  assert(ids(slutligaFragor([], "Vrida en detalj mellan två stationer", "sv")).includes("vridvinkel"));
  // Anti-rotation är vridskydd på en linjär cylinder, ingen vridning.
  assertEquals(forfragningstyp("Cylinder med anti-rotation som skjuter ut lådor"), "rorelse");
});

Deno.test("utbyte med orderkod: koden säger storleken, bara givare och miljö frågas", () => {
  const t = "Byta ut en trasig cylinder DSBC-50-200-PPVA-N3";
  const kod = { slagMm: 200, borrningMm: 50 };
  const modellen: Fraga[] = [
    { id: "stroke", label: "Vilken slaglängd behövs?", type: "number" },
    { id: "load", label: "Hur mycket väger lasten?", type: "number" },
  ];
  assertEquals(ids(slutligaFragor(modellen, t, "sv", kod)), ["andlagesavkanning", "miljo"]);
  // Utan upplöst kod är det en vanlig förfrågan.
  assert(ids(slutligaFragor([], t, "sv")).includes("slaglangd_mm"));
});

Deno.test("dubbletter: låsa luckan är en slaglängd, signaltyp och ventiltyp har ämnen", () => {
  const lucka = "Öppna och stänga en lucka på en siloutlastning utomhus";
  const m1: Fraga[] = [{ id: "stroke_length", label: "Vilken slaglängd (i mm) krävs för att öppna/låsa luckan?", type: "number" }];
  const s1 = slutligaFragor(m1, lucka, "sv");
  assertEquals(amnen(s1).filter((a) => a === "slag").length, 1);
  // Silo utomhus: kyla och brännbart damm frågas, och vikten gäller luckan.
  assert(ids(s1).includes("temperatur_lagsta") && ids(s1).includes("atex_damm"), ids(s1).join());
  assert(/luckan/.test(s1.find((q) => q.id === "last_kg")!.label));

  const terminal = "Jag behöver en ventilterminal till 8 cylindrar med PROFINET";
  const m2: Fraga[] = [{ id: "valve_type", label: "Vilken typ av ventiler ska terminalen hantera?", type: "choice", options: ["5/2", "5/3", "3/2"] }];
  const s2 = slutligaFragor(m2, terminal, "sv");
  assertEquals(amnen(s2).filter((a) => a === "ventilfunktion").length, 1);
  // PROFINET betyder 24 V DC, och 8 cylindrar är antalet.
  assert(!ids(s2).includes("ventil_spanning") && !ids(s2).includes("ventil_antal"), ids(s2).join());
  assertEquals(s2[0].label, "Vad ska ventilerna styra?");

  const givare = "Givare till Festo DSBC-cylindrar, behöver 10 st";
  const m3: Fraga[] = [
    { id: "signal_type", label: "Vilken signaltyp vill du ha?", type: "choice", options: ["PNP", "NPN", "IO-Link"] },
    { id: "connection_type", label: "Vilken anslutning föredrar du?", type: "choice", options: ["M8", "M12", "Kabel"] },
  ];
  assertEquals(ids(slutligaFragor(m3, givare, "sv")), ["givare_signal", "givare_inkoppling"]);
});

Deno.test("modellens knasiga frågor stryks eller byts mot bankens", () => {
  // "Pneumatisk, elektrisk eller hydraulisk?" för 12 kg plåt.
  const plat = "Lyfta upp plåtdetaljer 150 mm från en fixtur, ca 12 kg";
  const typ: Fraga = { id: "actuator_type", label: "Vilken typ av aktuator vill du använda?", type: "choice", options: ["Pneumatisk", "Elektrisk", "Hydraulisk"] };
  assertEquals(rensaFragor([typ], plat, "sv"), []);

  // Anti-rotation med svaret "fjädrande stöd" och fältbussar utan vanliga I/O.
  const burkar = "Plocka burkar från ett band och ställa dem i en låda, 0,5 kg per burk, ca 30 per minut";
  const m: Fraga[] = [
    { id: "anti_rotation", label: "Behöver aktuatorn ha anti-rotation eller guidning?", type: "choice", options: ["Ja, med fjädrande stöd", "Nej, ingen rotation"] },
    { id: "control_system", label: "Vilken typ av styrsystem eller fältbus vill du använda?", type: "choice", options: ["PLC med Modbus", "PLC med Profibus", "PLC med Ethernet/IP", "PLC med Profinet"] },
  ];
  const s = slutligaFragor(m, burkar, "sv");
  assert(ids(s).includes("vridskydd") && ids(s).includes("ventil_inkoppling"), ids(s).join());
  assert(!s.some((q) => (q.options ?? []).some((o) => /fjädrande/.test(o))));
  // Plock och placera: två slaglängder, ingen riktningsfråga.
  assert(ids(s).includes("slag_x_sidled_mm") && ids(s).includes("slag_z_hojd_mm"), ids(s).join());
  assert(!ids(s).includes("rorelseriktning"));

  // Stoppcylinder: "Krävda kraften (N)" och "Kontrolltyp".
  const stopp = "Stoppa paket på ett transportband med en stoppcylinder";
  const m4: Fraga[] = [
    { id: "required_force", label: "Krävda kraften (N)", type: "number" },
    { id: "control_type", label: "Kontrolltyp", type: "choice", options: ["Elektrisk styrning", "Pneumatisk styrning", "Manuell"] },
  ];
  const s4 = slutligaFragor(m4, stopp, "sv");
  assert(!ids(s4).includes("required_force") && !ids(s4).includes("control_type"), ids(s4).join());
  assert(!ids(s4).includes("rorelseriktning") && !ids(s4).includes("precision"), ids(s4).join());
  assert(/tyngsta paketet/.test(s4.find((q) => q.id === "last_kg")!.label));

  // Spänndon: "Vilken styrgränssnitt föredrar du?" och "Hur rör sig lasten?".
  const fixtur = "Spänna fast en detalj i en svetsfixtur med 4 spännpunkter";
  const m5: Fraga[] = [{ id: "control_interface", label: "Vilken styrgränssnitt föredrar du?", type: "choice", options: ["Manuell (tangenter eller fjärrkontroll)", "PLC (digitala I/O)", "Fältbus (t.ex. EtherCAT, Profinet)"] }];
  const s5 = slutligaFragor(m5, fixtur, "sv");
  // Frågan nämner fältbussar, och till ett spänndon utan ventilterminal stryks den.
  assert(!ids(s5).includes("control_interface"), ids(s5).join());
  assert(!ids(s5).includes("rorelseriktning"));
  assert(/spännpunkt/.test(s5.find((q) => q.id === "kraft_n")!.label));
});

Deno.test("skjuta av från ett band är en sidledsrörelse; syltmaskinen får livsmedel och kraft", () => {
  assert(kandaVarden("Skjuta av kartonger från ett transportband till en sidobana, kartongerna väger ca 8 kg").riktning);
  const sylt = slutligaFragor([], "Doseringsmaskin för sylt, cylinder som trycker ut produkt, daglig tvätt", "sv");
  assert(ids(sylt).includes("livsmedelskontakt") && ids(sylt).includes("kraft_n"), ids(sylt).join());
  assert(!ids(sylt).includes("last_kg"));
});

Deno.test("elaxel med lägen: inga ändlägesgivare, inget 'bara i ändlägena', riktningen frågas", () => {
  const t = "Elaxel som ska flytta en kamera mellan 5 positioner längs 600 mm";
  const m: Fraga[] = [{ id: "end_position_sensing", label: "Behöver du sensorer för att känna av slutpositionerna?", type: "choice", options: ["Ja, med enkla slutstopp", "Nej, utan sensorer"] }];
  const s = slutligaFragor(m, t, "sv");
  assert(!ids(s).includes("end_position_sensing") && !ids(s).includes("andlagesavkanning"), ids(s).join());
  assert(ids(s).includes("rorelseriktning"), ids(s).join());
  const precision = reservfragor(t, "sv").find((q) => q.id === "precision")!;
  assert(!precision.options!.some((o) => /ändläge/.test(o)));
});

Deno.test("vakuumlyft: lasthållningen gäller vakuumet, inte bara stångbromsen", () => {
  const q = reservfragor("Vakuumlyft för att lyfta glasskivor 20 kg", "sv").find((x) => x.id === "lasthallning")!;
  assert(/backventil/.test(q.hint!));
  assert(needsRodLock(q.options![0]));
});

// ── Andra körningen mot drift 2026-10-11 ─────────────────────────────────────
// Efter omgång 2 hittade modellen fortfarande på egna frågor som inte höll.
Deno.test("omgång 3: temperatur bara med anledning, styrning och givaruppgift läses på etiketten", () => {
  const temp: Fraga = { id: "operating_temperature", label: "Vilken är den förväntade driftstemperaturen?", type: "choice", options: ["-10°C till 50°C", "0°C till 40°C", "0°C till 70°C"] };
  assertEquals(rensaFragor([temp], "Lyfta upp plåtdetaljer 150 mm från en fixtur, ca 12 kg", "sv"), []);
  const pressTemp: Fraga = { id: "temp_env", label: "Vilken temperaturmiljö ska aktuatören klara?", type: "choice", options: ["0–40°C", "–20–60°C", "–40–80°C"] };
  assertEquals(rensaFragor([pressTemp], "Pressa in en bussning i ett hus, behöver 3 kN", "sv"), []);
  // Utomhus är en anledning, och då ställs bankens fråga i stället.
  const lucka = slutligaFragor([temp], "Öppna och stänga en lucka på en siloutlastning utomhus", "sv");
  assert(ids(lucka).includes("temperatur_lagsta") && !ids(lucka).includes("operating_temperature"), ids(lucka).join());

  // "Hur vill du styra vridningen? … Fältbuss" är en styrfråga och byts mot bankens.
  const styr: Fraga = { id: "control", label: "Hur vill du styra vridningen?", type: "choice", options: ["Manuell", "PLC-programmerad", "Fältbuss (t.ex. Modbus, EtherCAT)"] };
  assertEquals(amne(styr), "styrning");
  assert(ids(slutligaFragor([styr], "Vrida en detalj 90 grader mellan två stationer", "sv")).includes("manovrering"));

  // "Digital 24V | Analog 4-20mA" till en PROFINET-terminal stryks.
  const signal: Fraga = { id: "signal_type", label: "Vilken typ av signaler används för att styra ventilen?", type: "choice", options: ["Digital 24V", "Analog 4-20mA"] };
  assertEquals(rensaFragor([signal], "Jag behöver en ventilterminal till 8 cylindrar med PROFINET", "sv"), []);
  assertEquals(rensaFragor([signal], "Behöver fem magnetventiler.", "sv"), []);

  // "Vad ska givaren mäta? … Temperatur" är givarens uppgift, och den är sagd.
  const uppgift: Fraga = { id: "measure", label: "Vad ska givaren mäta?", type: "choice", options: ["Position (kolvposition)", "Tryck (cylindertryck)", "Temperatur (cylindertemperatur)", "Kollisionsdetektion"] };
  assertEquals(amne(uppgift), "givaruppgift");
  assertEquals(rensaFragor([uppgift], "Givare till Festo DSBC-cylindrar, behöver 10 st", "sv"), []);
});

Deno.test("omgång 3: materialfrågan byts mot bankens, decimaler får komma", () => {
  const sylt = "Doseringsmaskin för sylt, cylinder som trycker ut produkt, daglig tvätt";
  const material: Fraga = { id: "material", label: "Vilket material ska cylindern tillverkas av?", type: "choice", options: ["Stål (rostfritt)", "Plast (PE, PP)"] };
  const s = slutligaFragor([material], sylt, "sv");
  const m = s.find((q) => q.id === "material")!;
  assert(m && !m.options!.some((o) => /plast/i.test(o)), JSON.stringify(m));
  // Svaren slår inte på något kunden inte bett om.
  for (const o of m.options!) assert(!/vrid|rot|styrning|livsmedel/i.test(o), o);

  const fart: Fraga = { id: "speed", label: "Hur snabbt ska rörelsen vara?", type: "choice", options: ["≤ 0.1 m/s", "0.1–0.5 m/s", "0.5–1 m/s", "> 1 m/s"] };
  const r = rensaFragor([fart], "Elaxel som ska flytta en kamera mellan 5 positioner längs 600 mm", "sv")[0];
  assertEquals(r.options, ["≤ 0,1 m/s", "0,1–0,5 m/s", "0,5–1 m/s", "> 1 m/s"]);
});

// ── Tredje körningen mot drift 2026-10-11 ────────────────────────────────────
Deno.test("omgång 4: felstavad slaglängd, 45° i en riktningsfråga och grepp om en kamera", () => {
  const lucka = "Öppna och stänga en lucka på en siloutlastning utomhus";
  const m: Fraga[] = [
    { id: "stroke_length", label: "Vilken rörelse (slägelängd) krävs för att öppna/låsa luckan?", type: "number", unit: "mm" },
    { id: "direction", label: "Vilken riktning ska rörelsen gå?", type: "choice", options: ["Vertikal (upp/ner)", "Horisontell (fram/framåt)", "Vinkelriktad (t.ex. 45°)"] },
  ];
  assertEquals(amne(m[0]), "slag");
  assertEquals(amne(m[1]), "riktning");
  const s = slutligaFragor(m, lucka, "sv");
  assertEquals(amnen(s).filter((a) => a === "slag").length, 1, ids(s).join());

  const kamera: Fraga = { id: "camera_holding", label: "Hur ska kameran hållas fast under rörelsen?", type: "choice", options: ["Med ett statiskt grepp", "Med ett dynamiskt grepp", "Med ett magnetiskt grepp", "Ingen hållning behövs"] };
  assertEquals(rensaFragor([kamera], "Elaxel som ska flytta en kamera mellan 5 positioner längs 600 mm", "sv"), []);
  // Men vid plock frågas greppet, med bankens alternativ.
  assert(ids(slutligaFragor([kamera], "Plocka burkar från ett band och ställa dem i en låda", "sv")).includes("greppsatt"));
});

