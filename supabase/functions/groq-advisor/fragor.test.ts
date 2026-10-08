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
  const slut = slutligaFragor(modellen, LYFT, "sv");
  assertEquals(ids(slut), ["greppsatt", "lasthallning", "guiding_anti_rotation", "fieldbus_type"]);
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
  assertEquals(ids(slut), ["greppsatt", "guiding_anti_rotation", "control_system_fieldbus", "ambient_temperature", "livsmedelskontakt"]);
});

Deno.test("reservfrågor utan modellen: alltid minst fyra relevanta, högst sex", () => {
  for (const t of [LYFT, LUFT, LUCKA, BAT, BAGERI, "Behöver fem magnetventiler.", "Givare till cylinder.", "Slang och kopplingar."]) {
    const qs = slutligaFragor([], t, "sv");
    assert(qs.length >= 4 && qs.length <= 6, `${t}: ${qs.length}`);
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
