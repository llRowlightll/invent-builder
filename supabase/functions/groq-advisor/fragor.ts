// ─────────────────────────────────────────────────────────────────────────────
// fragor.ts — maskinbyggarens följdfrågor (steg 1). Rent, utan I/O, som
// signals.ts.
//
// Granskning i drift 2026-10-08 (åtta riktiga beskrivningar):
//   • "Byta luftberedning, 6 bar, 500 l/min" fick sex frågor om en cylinder
//     (slaglängd, monteringsorientering, programmerbara stopp). Prompten
//     utgick från att varje förfrågan är en rörelse.
//   • "Lyfta kartonger … styrs av en Siemens PLC" fick tre SIL/PL-frågor:
//     säkerhetsuttrycket matchade "pl[bcd]" och därmed "PLC".
//   • "Rostfri cylinder till en båt" fick FDA, EHEDG och NSF-H1: "rostfri"
//     räknas som spolmiljö, och spolmiljö och livsmedel var en och samma regel.
//   • "Två gånger per dag" följdes av "Hur många cykler per timme?".
//   • Efter tre anrop svarade Groq 503 (kvot), och kunden fick ett fel i
//     stället för frågor -- steg 1 hade ingen egen reserv.
//
// Granskning 2026-10-11 (en ingenjör tyckte att frågorna var "lite knas";
// femton vanliga förfrågningar mot drift):
//   • "Vrida en detalj 90 grader" fick slaglängd i mm, kraft i N och
//     "Horisontell eller vertikal?" -- vridningar behandlades som cylindrar.
//     Ett svar på slaglängdsfrågan stängde dessutom av vridenhetsvalet.
//   • "Byta ut en trasig cylinder DSBC-50-200-PPVA-N3" fick slaglängd, vikt
//     och riktning -- allt som står i koden eller redan är bestämt.
//   • Dubbletter: "Vilken slaglängd krävs för att öppna/låsa luckan?" räknades
//     som lasthållning ("låsa"), "Vilken signaltyp?" och "Vilken typ av
//     ventiler?" hade inget ämne, så bankens likadana fråga lades till bredvid.
//   • Modellens frågor: "Pneumatisk, elektrisk eller hydraulisk?" för 12 kg
//     plåt, anti-rotation med svaret "Ja, med fjädrande stöd", "Kontrolltyp",
//     "Krävda kraften (N)", "Vilken styrgränssnitt".
//   • "Plocka burkar … och ställa dem i en låda" fick EN slaglängd och
//     "Horisontell eller vertikal?"; en skjutcylinder som skjuter av kartonger
//     från ett band fick också riktningsfrågan.
//   • "Givare till Festo DSBC-cylindrar" fick "Vad ska givaren känna av?".
//   • En lucka på en silo utomhus fick ingen fråga om kyla eller brännbart damm.
//
// Därför: förfrågans typ styr vad som får frågas, det kunden redan sagt
// räknas upp och frågas aldrig igen, modellens frågor rensas efter samma
// regler och byts mot bankens där banken har en egen, och när modellen inte
// svarar ställs egna frågor ur en fast bank. Svarsalternativen är formulerade
// så att detektorerna i signals.ts läser dem rätt (t.ex. "får inte falla" →
// stångbroms, "Högtrycksspolas" → spolmiljö, "brännbart damm (zon 21 eller
// 22)" → ATEX-damm), och undviker ord som felaktigt slår på något
// ("styrning" = vridskydd, "montering" = fästen, "livsmedel" =
// livsmedelsklass, "vrida"/"rotera" = vridenhet i katalogvalet).
// ─────────────────────────────────────────────────────────────────────────────

import {
  arHorisontellRorelse, extractExplicitBoreMm, extractMinStroke, extractMoveTimeS, extractPrecisionMm, extractRotationDeg, extractSpeedMs,
  needsElectricAxis, needsEndPositionDetection, needsFoodGrade, needsMultiAxis, needsPharmaGmp,
  needsSilSafety, needsSpolmiljo, needsValveTerminal, needsVerticalLoad, slagIMeterMm,
} from "./signals.ts";

export type Fraga = {
  id: string;
  label: string;
  hint?: string;
  /** "Varför behöver vi detta?": vilket beslut svaret påverkar (manualen 4.2). */
  varfor?: string;
  type: "choice" | "number";
  options?: string[];
  unit?: string;
};

/** Sortering eller utskjutning från ett transportband (lådsorteringstestet). */
export function arSortering(text: string): boolean {
  return /\bsortera\s+ut\b|\butsorter\w*|\bskjut\w*\s+av\b|\butskjut\w*|\bpush(?:er|es|ing)?\s+off\b|\breject\w*/i.test(text) &&
    /\b(?:transportband\w*|transportör\w*|band(?:et|en)?|conveyor\w*)\b/i.test(text);
}

export type Forfragan = "rorelse" | "vridning" | "luftberedning" | "ventil" | "givare" | "slang";

/** Det en orderkod i förfrågan redan säger (readOrderCodes i order-code.ts). */
export type Kodvarden = { slagMm: number | null; borrningMm: number | null };

const RORELSE = /\blyft|hissa|sänk[ae]|flytt|förflytt|skjut[ae]|knuff|\btrycka\b|trycker\b|press[ae]|\bpress\b|klämm|spänn[ae]|vrid[ae]|rotera|sväng[ae]|tippa|vippa|positioner|\baxel\b|axlar|elaxel|slaglängd|\bslag\b|pick|plock|placera|grip|greppa|sorter|matning|portal|släde|linjär|\bservo|stegmotor|luckan?\b|dörr|grind/i;
const LUFTBEREDNING = /luftberedning|\bfrl\b|filterregulator|filter.?regulator|tryckregulator|\bregulator|dimsmörj|smörjare|luftfilter|kondensat|avfukt|lufttork|tryckluftsfilter|mjukstart|avstängningsventil|huvudventil|tryckluftsnät/i;
const VENTIL = /magnetventil|ventil(?!ation)|ventilterminal|ventilö|ventilblock|manifold|\b[235]\/[23]\b/i;
const GIVARE = /givare|sensor|tryckvakt|reed|närhets/i;
const SLANG = /\bslang|koppling|instick|fitting|snabbkoppl|skarv/i;

const CYLINDER = /cylind|aktuator|ställdon/i;

/** En vridning: vrida, rotera, svänga, vända, indexera. */
const VRIDNING = /\bvrid(a|er|s|ning|enhet|don|bord|cylinder)?\b|\brotera\w*|\brotation\w*|\bsväng(a|er|ning|enhet|cylinder|don)?\b|\bvänd(a|er|ning)\b|\bindexer\w*|\brotary\b|\bswivel\b|\bturntable\b/i;
/** En linjär rörelse. Står den bredvid en vridning är det en fleraxlig rörelse. */
const LINJAR = /\blyft|hissa|sänk[ae]|flytt|förflytt|skjut[ae]|knuff|\btrycka\b|trycker\b|press[ae]|\bpress\b|klämm|spänn[ae]|elaxel|slaglängd|\bslag\b|pick|plock|placera|portal|släde|linjär|stopp/i;

/** "Anti-rotation" och "får inte vrida sig" handlar om vridskydd, inte om en vridning. */
function utanVridskydd(text: string): string {
  return text.replace(/anti.?rotation\w*|vridsäk\w*|vridskydd\w*|rotationssäk\w*|(får\s+)?inte\s+(vrida|rotera)(\s+sig)?/gi, " ");
}

/**
 * Vad förfrågan gäller. En rörelse (lyfta, flytta, pressa …) vinner alltid:
 * en cylinder med ventil och givare är en rörelse, och då är ventil- och
 * givarfrågorna en del av den. Men "givare till en cylinder" är en givare --
 * ordet cylinder ensamt gör inte förfrågan till en rörelse. En ren vridning
 * är en egen typ: den har en vinkel och ett vridmoment, ingen slaglängd.
 */
export function forfragningstyp(text: string): Forfragan {
  const t = utanVridskydd(text);
  if (VRIDNING.test(t) && !LINJAR.test(t)) return "vridning";
  if (RORELSE.test(text)) return "rorelse";
  if (LUFTBEREDNING.test(text)) return "luftberedning";
  if (VENTIL.test(text)) return "ventil";
  if (GIVARE.test(text)) return "givare";
  if (SLANG.test(text)) return "slang";
  if (CYLINDER.test(text)) return "rorelse";
  return "rorelse";
}

/** Ett utbyte av en identifierad artikel: storleken står redan i koden. */
export function arUtbyte(text: string, kod?: Kodvarden): boolean {
  return !!(kod?.slagMm || kod?.borrningMm) &&
    /\bbyt(a|er|s|t)?\b|ersätt|trasig|sönder|samma som|reservdel|likadan|utbyte|\breplace|\bspare\b/i.test(text);
}

export type Kanda = {
  slag: boolean; last: boolean; kraft: boolean; takt: boolean; hastighet: boolean;
  precision: boolean; borrning: boolean; tryck: boolean; flode: boolean; temperatur: boolean;
  riktning: boolean; styrning: boolean; faltbuss: boolean; spanning: boolean; anslutning: boolean; miljo: boolean;
  greppsatt: boolean; givare: boolean;
  vinkel: boolean; vridmoment: boolean; fabrikat: boolean; givaruppgift: boolean;
};

/** Det kunden redan har angett. Frågas aldrig igen (av modellen eller av oss). */
export function kandaVarden(text: string, kod?: Kodvarden): Kanda {
  return {
    slag: !!kod?.slagMm || slagIMeterMm(text) > 0 || /(slag(längd)?|lyfthöjd|lyft\w*|höj[ae]\w*|sänk\w*|flytt\w*|skjut\w*|förflytt\w*|rörelse\w*|vandring|travel|stroke|sträcka|sidled|längs)[^.\d]{0,25}\d{2,5}\s*mm|\d{2,5}\s*mm[^.\d]{0,20}(slag|upp\b|uppåt|ner\b|ned\b|nedåt|i sidled|lyft|stroke|travel|rörelse|förflyttning|framåt|bakåt)/i.test(text),
    last: /\d+(?:[.,]\d+)?\s*kg\b/i.test(text),
    kraft: /\d+(?:[.,]\d+)?\s*k?N\b/.test(text),
    takt: /(\d+|en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|tjugo|trettio|hundra)\s*(gånger|ggr|cykler|slag|takter?|st|lyft|rörelser)\s*(per|i|om|\/)\s*(sekund\w*|sek|s\b|minut\w*|min\b|timme\w*|tim\b|h\b|dag\w*|dygn\w*|vecka\w*|skift\w*)|\d+\s*\/\s*(min|h|s)\b|cykeltid|takttid|per\s+minut|i\s+minuten/i.test(text),
    hastighet: extractSpeedMs(text, {}) > 0,
    precision: extractPrecisionMm(text, {}) > 0,
    borrning: !!kod?.borrningMm || extractExplicitBoreMm(text, {}) > 0,
    tryck: /\d+(?:[.,]\d+)?\s*(bar|mpa|kpa)\b/i.test(text),
    flode: /\d+(?:[.,]\d+)?\s*(n?l\/min|l\/s|m3\/h|m³\/h|nl\/min)/i.test(text),
    temperatur: /-?\d+\s*°\s*c|\bminusgrader|\bfrysrum|\bkylrum|\bugn\b|\bvärmebehandl/i.test(text),
    // En skjutcylinder som skjuter av något från ett band rör sig i sidled.
    riktning: /vertikal|horisontell|lodrät|vågrät|\blyft|hissa|sänk|uppåt|nedåt|sidled|liggande|stående|\bupp\b|\bner\b|skjut\w*\s+(av|ut|bort|över|in|fram|tillbaka)\b|knuff|sidobana/i.test(text),
    styrning: /\bplc\b|profinet|ethercat|ethernet.?ip|io-?link|modbus|profibus|devicenet|cc-?link|fältbuss|styrsystem|siemens|beckhoff|omron|allen.?bradley|rockwell|schneider|\brelä|tryckknapp|handventil|fotventil|manuellt/i.test(text),
    faltbuss: /profinet|ethercat|ethernet.?ip|io-?link|modbus|profibus|devicenet|cc-?link/i.test(text),
    spanning: /\d+\s*v\s*(dc|ac)\b|\b(12|24|110|115|230)\s*v\b/i.test(text),
    anslutning: /\bg\s?\d\/\d\b|\bg\s?1\b|\bm5\b|\bnpt\b|\br\s?\d\/\d\b|\d+\s*mm\s*slang|slang\s*\d+\s*mm/i.test(text),
    miljo: /livsmedel|spol|tvätt|damm|smuts|utomhus|salt|rostfri|korros|kemikal|atex|explosion|renrum|cleanroom|fukt|vått|vatten/i.test(text),
    greppsatt: /sugkopp|vakuum|vacuum|gripdon|gripper|klo|fingrar|backar\b/i.test(text),
    givare: needsEndPositionDetection(text),
    vinkel: extractRotationDeg(text, {}) > 0,
    vridmoment: /\d+(?:[.,]\d+)?\s*Nm\b/i.test(text),
    fabrikat: /\b(festo|smc|parker|aventics|rexroth|norgren|camozzi|metal\s?work|bosch|imi)\b/i.test(text),
    givaruppgift: /(givare|sensor)\w*\s+(till|för|på)\b.{0,40}(cylind|dsbc|dsnu|adn|advu|dnc|cd85|cp96|cq2|p1d|kolv)|cylindergivare|ändlägesgivare|magnetgivare|reed|t-spår|kolvens magnet/i.test(text),
  };
}

/** Riktiga säkerhetskrav -- inte "PLC" eller ordet "guard" i förbifarten. */
export function arSakerhetskrav(text: string): boolean {
  return needsSilSafety(text) || /livsfara|fallskydd|fallrisk|klämrisk|personskada|skyddsdörr|skyddsgrind|safe.?stop|\bpl\s?[de]\b|\bpl\s[bc]\b/i.test(text);
}

/** Spolning eller tvätt -- inte bara rostfritt eller korrosion. */
export function arSpolmiljo(text: string): boolean {
  return needsSpolmiljo(text);
}

/** Korrosiv eller marin miljö utan livsmedel: frågan gäller medium och material. */
export function arKorrosiv(text: string): boolean {
  return /rostfri|stainless|korros|salt|saltvatten|marin|båt|offshore|kemikal|syra|lut\b|frätande/i.test(text);
}

export function arLivsmedel(text: string): boolean {
  return needsFoodGrade(text) || needsPharmaGmp(text);
}

/** ESD gäller elektronik, inte glas -- och inte ett elektronikskåp. */
export function arElektronikhantering(text: string): boolean {
  return /kretskort|\bpcb\b|elektronikkomponent|komponenter.*kort|ytmonter|\besd\b|antistat/i.test(text);
}

/**
 * Elaxelspåret: uttryckligt el/servo, ±0,5 mm eller bättre, fler än två lägen
 * eller ingen tryckluft (needsElectricAxis i signals.ts, samma gräns som
 * resultatsteget). Hittat 2026-10-11 (Geminis testfall): "±0,1 mm, 2 m, 1 m/s"
 * fick cylinderfrågor -- ändlägesgivare, kolvstång, slag per minut.
 */
export function arElaxel(text: string): boolean {
  return needsElectricAxis(text);
}

/**
 * Teknikvalet i klartext, före frågorna, när det följer av kraven och inte
 * står i förfrågan. Geminis punkt 1: frågefasen såg ut att ha bestämt sig för
 * en cylinder innan den förstått behovet. Tom sträng när inget behöver sägas.
 */
export function teknikval(text: string, locale: string): string {
  if (!arElaxel(text) || arElektrisk(text) || forfragningstyp(text) !== "rorelse") return "";
  const precision = extractPrecisionMm(text, {});
  const fart = extractSpeedMs(text, {});
  const slag = extractMinStroke({}, text);
  const tal = (n: number) => (locale === "sv" ? String(n).replace(".", ",") : String(n));
  let grund: string;
  if (precision > 0 && precision <= 0.5) {
    grund = g(locale, `±${tal(precision)} mm kräver en servostyrd elaxel — en pneumatisk cylinder stannar bara exakt i sina ändlägen.`,
      `±${tal(precision)} mm requires a servo-driven electric axis — a pneumatic cylinder only stops precisely at its end positions.`);
  } else if (/ingen\s+tryckluft|utan\s+tryckluft|saknar\s+tryckluft|bara\s+el\b|endast\s+el\b|no\s+compressed\s+air/i.test(text)) {
    grund = g(locale, "Utan tryckluft blir det en elektrisk axel.", "Without compressed air it will be an electric axis.");
  } else {
    grund = g(locale, "Flera stopplägen kräver en servostyrd elaxel — en pneumatisk cylinder har bara två ändlägen.",
      "Several stop positions require a servo-driven electric axis — a pneumatic cylinder only has two end positions.");
  }
  if (slag >= 1500 && fart >= 1 && precision > 0) {
    grund += " " + g(locale,
      `Över ${tal(slag / 1000)} m med ${tal(fart)} m/s talar farten för kuggrem och precisionen för kulskruv — frågorna nedan avgör.`,
      `Over ${tal(slag / 1000)} m at ${tal(fart)} m/s the speed favours a toothed belt and the precision a ball screw — the questions below decide.`);
  }
  return grund;
}

export function arElektrisk(text: string): boolean {
  return /elcylinder|elektrisk\w*\s+(cylinder|axel|linjär\w*|ställdon|aktuator|drivning)|eldriven|elaxel|\bservo|stegmotor|stepper|kuggrem|kulskruv|ball.?screw|linjärmodul|linear.?axis|electric\s+(actuator|cylinder|axis)/i.test(text);
}

/** Något ska plockas, gripas eller lyftas i: då frågas hur det hålls. */
function arGrepp(text: string): boolean {
  return /grip|greppa|plock|pick|lyft(a|er)?\s+(upp\s+)?(kartong|låd|flask|burk|säck|plåt|skiv|detalj|paket|förpackning)|sug/i.test(text);
}

/** Stoppcylinder vid ett transportband: lasten åker mot den, den lyfter ingenting. */
function arStopp(text: string): boolean {
  return /stoppcylinder|\bstopper\b|stopp(a|ar)\s+.{0,40}(band|paket|kartong|låd|produkt)/i.test(text);
}

/**
 * Spänndon: kraften räknas per spännpunkt, riktningen spelar ingen roll.
 * Inte "fixtur" ensamt: "Lyfta upp plåtdetaljer från en fixtur" är ett lyft.
 */
function arSpann(text: string): boolean {
  return /spänn(a|er|s|cylinder|don)?\b|klämm/i.test(text);
}

/** Pressa, spänna, trycka ut: kraften är kravet, inte vikten. */
function arPress(text: string): boolean {
  return /press[ae]|\bpress\b|klämm|spänn[ae]|stansa|nita|trycka\s+ihop|pressa\s+ihop|tryck(a|er)\s+ut|dosera|mata\s+ut|matar\s+ut/i.test(text);
}

/** Utomhus eller kallt: tätningar och slang behöver tåla kylan. */
function arKallt(text: string): boolean {
  return /utomhus|outdoor|\bute\b|vinter|frys|kylrum|kyllager|kylhus|kylcontainer/i.test(text);
}

/** Där brännbart damm kan finnas (mjöl, spannmål, socker, trä). */
function arDammRisk(text: string): boolean {
  return /\bsilo|kvarn|spannmål|\bmjöl|\bfoder\b|pellets|sågverk|\bspån|pulver|socker|kolpulver|aluminiumdamm|metalldamm|slipdamm|magnesium/i.test(text) &&
    !/atex|zon\s*2[012]|explosi/i.test(text);
}

function g(locale: string, sv: string, en: string): string {
  return locale === "sv" ? sv : en;
}

/** Bankens frågor har kända ämnen; modellens tolkas ur id och etikett. */
const BANKENS_AMNEN: Record<string, string> = {
  slaglangd_mm: "slag", slag_x_sidled_mm: "slag", slag_z_hojd_mm: "slag", last_kg: "last",
  kraft_n: "kraft", greppsatt: "grepp", rorelseriktning: "riktning", lasthallning: "hallning",
  takt: "takt", precision: "precision", andlagesavkanning: "givare", manovrering: "styrning",
  miljo: "miljo", korrosion: "korrosion", livsmedelskontakt: "livsmedel", luft_anslutning: "anslutning", luft_flode: "flode", luft_tryck: "tryck",
  luft_filtergrad: "filtergrad", luft_dimsmorjning: "dimsmorjning", luft_kondensat: "kondensat",
  luft_avstangning: "avstangning", ventil_uppgift: "ventilfunktion", ventil_vid_stromavbrott: "ventilaterstall",
  ventil_spanning: "spanning", ventil_anslutning: "anslutning", ventil_antal: "antal",
  ventil_inkoppling: "faltbuss", givare_uppgift: "givaruppgift", givare_signal: "givarsignal",
  givare_inkoppling: "givarinkoppling", givare_fabrikat: "fabrikat", slang_dimension: "slangdimension",
  slang_material: "slangmaterial", koppling_ganga: "anslutning", slang_langd_m: "langd",
  vridvinkel: "vinkel", vridmoment_nm: "vridmoment", havarm_mm: "havarm", vridskydd: "vridskydd",
  temperatur_lagsta: "temperatur", atex_damm: "atex", material: "material",
  antal_lagen: "lagen", noggrannhet_typ: "noggrannhetstyp", forflyttningstid_s: "tid",
  lastplacering: "lastplacering", styrning_axel: "styrning",
};

/** Ämnet en fråga handlar om. Används för att rensa och fylla på. */
export function amne(q: Pick<Fraga, "id" | "label"> & { options?: string[]; unit?: string }): string | null {
  if (BANKENS_AMNEN[q.id]) return BANKENS_AMNEN[q.id];
  // Alternativen räknas med: "Vilka certifieringar behövs?" är en
  // livsmedelsfråga först när alternativen är FDA och EHEDG.
  const s = `${q.id} ${q.label} ${(q.options ?? []).join(" ")}`.toLowerCase();
  // Etiketten ensam, för ämnen där ett svarsalternativ kan lura: "Vad ska
  // givaren mäta? … Temperatur" är ingen temperaturfråga, och "Hur vill du
  // styra vridningen? … Fältbuss" är en fråga om styrning (2026-10-11).
  const l = `${q.id} ${q.label}`.toLowerCase();
  // Att välja teknik är vårt jobb, inte kundens. Frågan känns igen på
  // etiketten eller på att alternativen är tekniker; "Krav på mekanisk
  // hållning … (pneumatisk cylinder) eller motorbroms (elektrisk axel)" är en
  // fråga om lasthållning och ska inte med.
  const tekniker = (q.options ?? []).filter((o) => /^\s*(pneumatisk|elektrisk|hydraulisk|pneumatic|electric|hydraulic)\b/i.test(o)).length;
  if (tekniker >= 2 || /typ av (aktuator|drivning|ställdon|kraftkälla)|aktuatortyp|actuator.?type|drive.?type|kraftkälla|drivkälla|pneumatisk(t)? eller elektrisk|elektrisk(t)? eller pneumatisk/.test(s)) return "aktuatortyp";
  // "PLC" är ingen prestandanivå: PL c skrivs med mellanslag, PLd/PLe utan.
  if (/\bsil\s?[1-4]?\b|\bpl\s?[de]\b|\bpl\s[a-c]\b|performance.level|säkerhetsnivå|iec\s*62061|iso\s*13849|safety.level|säkerhetsintegritet/.test(s)) return "sakerhetsniva";
  if (/nsf|\bh1\b|ehedg|\bfda\b|1935\/2004|livsmedelsgodk|food.?grade|ra\s*≤|ytfinish|surface.finish/.test(s)) return "livsmedel";
  if (/\batex\b|explosiv|brännbart damm|\bzon\s*2[012]\b/.test(s)) return "atex";
  if (/ip69|ip-?klass|ip.?class|ip.?rating|kapsling|högtryck|washdown/.test(s)) return "ipklass";
  if (/\besd\b|antistat/.test(s)) return "esd";
  if (/renrum|cleanroom|iso.?klass/.test(s)) return "renrum";
  // Luftberedningens ämnen först: "smörjning" och "filtrering" fanns inte, så
  // modellens "Fett | Ingen" och "10/20/50 µm" byttes aldrig mot bankens.
  if (/filtrer|filtergrad|filterfinhet|filtration/.test(s)) return "filtergrad";
  if (/smörj|dimsmörj|lubric|oljedimma/.test(s)) return "dimsmorjning";
  if (/kondens|avtapp|\bdrain/.test(s)) return "kondensat";
  if (/avstängningsventil|avluftningsventil|mjukstart|shut.?off|soft.?start/.test(s)) return "avstangning";
  // Ventilens och givarens ämnen: utan dem lades bankens likadana fråga till
  // bredvid modellens ("Vilken typ av ventiler?" + "Vad ska ventilen styra?").
  if (/\b[35]\/[23]\b|ventiltyp|typ av ventil|ventilfunktion|valve.?(type|function)/.test(s)) return "ventilfunktion";
  if (/monostabil|bistabil|monostable|bistable/.test(s)) return "ventilaterstall";
  // En givarsignal är PNP/NPN, eller en signalfråga om en givare -- inte
  // "Vilken typ av signaler används för att styra ventilen?" (id signal_type).
  if (/\bpnp\b|\bnpn\b/.test(s) || (/givare|sensor/.test(l) && /signal/.test(l))) return "givarsignal";
  if (/\bm8\b|\bm12\b|kontaktdon|fast kabel/.test(s)) return "givarinkoppling";
  if (/vad ska (givaren|sensorn) (känna av|mäta|detektera|registrera)|givarens uppgift|what should the sensor/.test(l)) return "givaruppgift";
  if (/fältbus|fieldbus|protokoll|protocol/.test(l) || (/kopplas|anslut|inkoppl|connect/.test(l) && /fältbus|profinet|ethercat|io-?link/.test(s))) return "faltbuss";
  if (/\bstyr(a|s|as|es)\b|styrsystem|styrsätt|styrgränssnitt|kontrolltyp|control.?(type|interface|system)|manövr|\bplc\b/.test(l)) return "styrning";
  // Före lasthållningen: "Vilken slaglängd krävs för att öppna/låsa luckan?"
  // är en slaglängdsfråga, inte en fråga om lås. Modellen stavar ibland fel
  // ("slägelängd"), och en sifferfråga i mm om en rörelse är en slaglängd.
  if (/sl[aäe]+g\w*längd|slaglangd|\bstroke\b/.test(s)) return "slag";
  if (/^\s*mm\s*$/i.test(q.unit ?? "") && /rörelse|lyfthöjd|hur lång|sträcka/.test(l)) return "slag";
  if (/vridmoment|torque|\bnm\b/.test(s)) return "vridmoment";
  if (/hävarm|lever.?arm|vridcentrum/.test(s)) return "havarm";
  // Temperaturen före vinkeln: "°C" och "minusgrader" är inga vinklar.
  if (/temperatur|temperature|°\s*c\b|kyla|kallt/.test(l)) return "temperatur";
  // Inte "Vinkel" eller "45°" som svar på en riktningsfråga ("Vertikal |
  // Horisontell | Vinkelriktad (t.ex. 45°)"): gradtecknet i alternativen
  // räknas bara när etiketten handlar om att vrida.
  if (/\bgrader\b(?!\s*(c\b|celsius|varm|kall))|vridvinkel|rotationsvinkel|svängvinkel|rotation.?angle|degrees/.test(l) ||
    (/vrid|rotera|sväng|vinkel/.test(l) && /°(?!\s*c\b)/.test(s))) return "vinkel";
  if (/broms|kolvstångslås|stånglås|\blås\b|låsenhet|hålla kvar|hållas kvar|håll(a|er)? (lasten|positionen|position)|fail.?safe|strömavbrott|power.?loss|falla|sjunka|tryckluften försvinner/.test(s)) return "hallning";
  if (/orienter|riktning|vertikal|horisontell|monteringsläge|montera.*i|direction|rör sig/.test(s)) return "riktning";
  if (/givare|sensor|ändläge|end.?position/.test(s)) return "givare";
  if (/per minut|per timme|\/min\b|frekvens|hur ofta|takt|cycles? per/.test(l)) return "takt";
  if (/slag|travel|lyfthöjd|rörelsens längd|längd.*rörelse|hur lång/.test(s)) return "slag";
  if (/cykl|gånger|frekvens|takt|cycle|hur ofta|per timme|per minut/.test(s)) return "takt";
  if (/vikt|väger|\blast\b|massa|\bload\b|weight|\bkg\b|hur tung/.test(s)) return "last";
  if (/kraft|force|\(n\)/.test(s)) return "kraft";
  if (/hur många (lägen|positioner|stopp)|antal (lägen|positioner)|mellanläg|number of positions/.test(l)) return "lagen";
  if (/accelerat|förflyttningstid|rörelsetid|cykeltid|hur lång tid|move.?time|cycle.?time/.test(l)) return "tid";
  if (/överhäng|utskjutande|hävarm|tyngdpunkt|centrerad|overhang|cantilever/.test(l)) return "lastplacering";
  if (/sluten (loop|reglering)|positionsreglering|linjärgivare|mätsystem|absolut noggrann|closed.?loop|linear encoder/.test(l)) return "noggrannhetstyp";
  if (/hastighet|speed|m\/s|snabb/.test(s)) return "hastighet";
  if (/precision|noggrann|repeterbar|accuracy|exakt/.test(s)) return "precision";
  if (/fältbus|fieldbus|protokoll|protocol|profinet|ethercat/.test(s)) return "faltbuss";
  if (/plc|styrsystem|control system|styras|styrs\b|manövr|styrgränssnitt|styrsätt|kontrolltyp|control.?(type|interface)|digitala i\/o/.test(s)) return "styrning";
  if (/anti.?rotation|vridskydd|guid|styrd|linjärstyrning|sidokraft/.test(s)) return "vridskydd";
  if (/materia|rostfri|stainless|316/.test(s)) return "material";
  if (/borrning|diameter|bore/.test(s)) return "borrning";
  if (/tryck|pressure|\bbar\b/.test(s)) return "tryck";
  if (/flöde|flow|l\/min/.test(s)) return "flode";
  if (/spänning|voltage|\bv\b dc|24\s*v/.test(s)) return "spanning";
  if (/anslutning|gänga|port|connection|thread/.test(s)) return "anslutning";
  if (/miljö|environment|damm|utomhus/.test(s)) return "miljo";
  if (/grepp|grip|sugkopp|vakuum|vacuum/.test(s)) return "grepp";
  return null;
}

/** Något i förfrågan som gör temperaturen till en fråga. */
const TEMPERATURLEDTRAD = /utomhus|outdoor|\bute\b|vinter|frys|kyl(rum|lager|hus|container)|\bugn|värme|varm|\bhet[at]?\b|gjuteri|svets|bastu|torkugn|°\s*c|minusgrad|ånga|steam|bageri|bakery/i;

/** Ämnen som bara hör till en rörelse. */
const RORELSEAMNEN = new Set(["slag", "takt", "last", "kraft", "hastighet", "precision", "riktning", "vridskydd", "givare", "hallning", "grepp", "sakerhetsniva", "vinkel", "vridmoment", "havarm"]);

/** Ämnen som en ren vridning inte har: ingen slaglängd i mm, ingen kraft i N, ingen riktning. */
const INTE_VRIDNING = new Set(["slag", "kraft", "riktning", "borrning", "precision", "vridskydd", "hastighet"]);

/** Ämnen som orderkoden i ett utbyte redan har bestämt. */
const INTE_UTBYTE = new Set(["slag", "last", "kraft", "riktning", "borrning", "takt", "precision", "grepp", "hastighet", "hallning", "vridskydd"]);

const ENGELSKA = /\b(the|with|without|and|or|none|yes|no|standard|steel|plastic|coating|grease|lubricant|high|low|pressure|immersion|splash|horizontal|vertical|inclined|other|required|chemical|jets|food-grade)\b/i;

function serEngelsk(opt: string): boolean {
  return !/[åäö]/i.test(opt) && ENGELSKA.test(opt);
}

/** Termer som modellen översatt bokstavligt. Hittat i drift 2026-10-08. */
function rattaTermer(s: string): string {
  return s
    .replace(/fjärrapplicerad(e|t)? kolvblock/gi, "fjäderbelastat kolvstångslås")
    .replace(/fjärrapplicerad(e|t)?/gi, "fjäderbelastad")
    .replace(/kolvblock/gi, "kolvstångslås")
    .replace(/\(upp\/down\)/gi, "(upp/ned)")
    .replace(/\bfältbus\b/gi, "fältbuss");
}

/**
 * Rensar modellens frågor: inget som redan är sagt, inget som inte hör till
 * förfrågan, inga dubbletter av samma ämne, inga engelska svarsalternativ på
 * en svensk sida. Behåller ordningen.
 */
export function rensaFragor(fragor: Fraga[], text: string, locale: string, kod?: Kodvarden): Fraga[] {
  const typ = forfragningstyp(text);
  const k = kandaVarden(text, kod);
  const utbyte = arUtbyte(text, kod);
  const multi = needsMultiAxis(text);
  const press = arPress(text);
  const elektrisk = arElaxel(text);
  const horisontell = arHorisontellRorelse(text);
  const sedda = new Set<string>();
  const ut: Fraga[] = [];
  for (const q0 of fragor) {
    if (!q0?.id || !q0?.label) continue;
    const q: Fraga = {
      ...q0,
      label: rattaTermer(q0.label),
      hint: q0.hint ? rattaTermer(q0.hint) : q0.hint,
      options: q0.options?.map(rattaTermer),
    };
    const a = amne(q);
    if (a === "aktuatortyp") continue;
    if (a === "sakerhetsniva" && !arSakerhetskrav(text)) continue;
    if (a === "livsmedel" && !arLivsmedel(text)) continue;
    if (a === "ipklass" && !arSpolmiljo(text) && !arLivsmedel(text)) continue;
    if (a === "esd" && !arElektronikhantering(text)) continue;
    if (a === "renrum" && !/renrum|cleanroom|clean\s+room/i.test(text)) continue;
    if (a === "slag" && (k.slag || (typ !== "rorelse"))) continue;
    if (a === "takt" && k.takt) continue;
    if (a === "last" && (k.last || (typ !== "rorelse"))) continue;
    if (a === "kraft" && k.kraft) continue;
    // Vikten eller kraften, inte båda: en press anges i kraft, allt annat i vikt.
    if (a === "kraft" && typ === "rorelse" && !press) continue;
    if (a === "last" && press) continue;
    if (a === "hastighet" && k.hastighet) continue;
    if (a === "precision" && k.precision) continue;
    if (a === "borrning" && k.borrning) continue;
    if (a === "tryck" && k.tryck) continue;
    if (a === "flode" && k.flode) continue;
    if (a === "temperatur" && k.temperatur) continue;
    // Vanliga komponenter klarar en vanlig fabrik. Utan något i förfrågan som
    // tyder på kyla eller värme är temperaturfrågan bara en fråga till, och
    // modellens påhittade spann ("-10°C till 50°C") slår på kyldetektorn.
    if (a === "temperatur" && !TEMPERATURLEDTRAD.test(text)) continue;
    if (a === "riktning" && (k.riktning || multi || arStopp(text) || arSpann(text))) continue;
    if (a === "styrning" && k.styrning) continue;
    // Ventilens och givarens styrning täcks av bankens frågor om spänning,
    // inkoppling och signal ("Digital 24V | Analog 4-20mA" till en magnetventil).
    if (a === "styrning" && (typ === "ventil" || typ === "givare")) continue;
    if (a === "faltbuss" && k.faltbuss) continue;
    if (a === "spanning" && (k.spanning || k.faltbuss)) continue;
    if (a === "vinkel" && k.vinkel) continue;
    if (a === "vridmoment" && k.vridmoment) continue;
    if (a === "givaruppgift" && k.givaruppgift) continue;
    // Hur något hålls fast hör till plock och lyft, inte till en kamera på en
    // elaxel ("statiskt, dynamiskt eller magnetiskt grepp").
    if (a === "grepp" && !k.greppsatt && !arGrepp(text)) continue;
    if (a === "fabrikat" && k.fabrikat) continue;
    // En elaxel vet själv var den är (samma regel som banken), och har en
    // styrd vagn i stället för en kolvstång som kan vrida sig.
    if (a === "givare" && elektrisk) continue;
    if (a === "vridskydd" && elektrisk) continue;
    // I sidled faller ingenting när strömmen eller luften försvinner.
    if (a === "hallning" && horisontell) continue;
    // Fältbussen avgör bara valet av ventilterminal; till en enstaka cylinder
    // är den en fråga till elkonstruktören, inte till oss.
    if (a === "faltbuss" && (typ === "rorelse" || typ === "vridning") && !needsValveTerminal(text)) continue;
    if (typ === "vridning" && a && INTE_VRIDNING.has(a)) continue;
    if (utbyte && a && INTE_UTBYTE.has(a)) continue;
    if (typ === "luftberedning" && ((a && RORELSEAMNEN.has(a)) || /cylind|kolv|slag|positioner|stopp/i.test(q.label))) continue;
    if ((typ === "ventil" || typ === "givare" || typ === "slang") && a && RORELSEAMNEN.has(a) && a !== "takt") continue;
    if (locale === "sv" && q.options?.length && q.options.filter(serEngelsk).length * 2 >= q.options.length) continue;
    // Svenska decimaltecken: "0.1–0.5 m/s" blir "0,1–0,5 m/s" (detektorerna läser båda).
    if (locale === "sv" && q.options) q.options = q.options.map((o) => o.replace(/(\d)\.(\d)/g, "$1,$2"));
    if (a && sedda.has(a)) continue;
    if (a) sedda.add(a);
    ut.push(q);
  }
  return ut.slice(0, 6);
}

function andlagesfraga(locale: string, label?: string, hint?: string): Fraga {
  return {
    id: "andlagesavkanning", type: "choice",
    label: label ?? g(locale, "Behöver styrsystemet veta när rörelsen är klar?", "Does the control system need to know when the movement is done?"),
    hint: hint ?? g(locale, "Då sitter en givare på cylindern som känner av kolvens magnet i ändläget.", "Then a sensor on the cylinder detects the piston magnet at the end position."),
    options: [g(locale, "Ja, i båda ändlägena", "Yes, at both end positions"), g(locale, "Ja, i ett ändläge", "Yes, at one end position"), g(locale, "Nej", "No")],
  };
}

function manovreringsfraga(locale: string): Fraga {
  return {
    id: "manovrering", type: "choice",
    label: g(locale, "Hur ska rörelsen startas?", "How is the movement started?"),
    hint: g(locale, "Avgör om det behövs en magnetventil eller en handmanövrerad ventil.", "Determines whether a solenoid valve or a manually operated valve is needed."),
    options: [g(locale, "Från en PLC", "From a PLC"), g(locale, "Med tryckknapp eller handventil", "With a push button or hand valve")],
  };
}

function miljofraga(locale: string): Fraga {
  return {
    id: "miljo", type: "choice",
    label: g(locale, "I vilken miljö sitter den?", "What environment will it be in?"),
    hint: g(locale, "Damm, vatten och väder påverkar val av tätningar och material.", "Dust, water and weather affect the choice of seals and materials."),
    options: [g(locale, "Vanlig fabrik eller verkstad", "Ordinary factory or workshop"), g(locale, "Dammigt eller smutsigt", "Dusty or dirty"), g(locale, "Högtrycksspolas eller tvättas", "High-pressure washed"), g(locale, "Utomhus", "Outdoors")],
  };
}

/** Lägsta temperatur. Alternativen läses av extractRequiredMinTemp och needsLowTemp. */
function kylfraga(locale: string): Fraga {
  return {
    id: "temperatur_lagsta", type: "choice",
    label: g(locale, "Hur kallt kan det bli där den sitter?", "How cold can it get where it is installed?"),
    hint: g(locale, "Vanliga tätningar och plastslang blir hårda i kyla. Under -20 °C behövs lågtemperaturutförande.", "Standard seals and plastic tubing harden in the cold. Below -20 °C a low-temperature version is needed."),
    options: [g(locale, "Inte under 0 °C", "Not below 0 °C"), g(locale, "Ner till -20 °C", "Down to -20 °C"), g(locale, "Ner till -40 °C", "Down to -40 °C")],
  };
}

/** Brännbart damm. "Ja"-svaret läses av needsAtexDust; "Nej" får inte innehålla "brännbart". */
function dammfraga(locale: string): Fraga {
  return {
    id: "atex_damm", type: "choice",
    label: g(locale, "Kan det finnas brännbart damm i luften där den sitter?", "Can there be combustible dust in the air where it is installed?"),
    hint: g(locale, "Damm från mjöl, spannmål, socker och trä kan explodera. Då gäller ATEX, och alla komponenter måste vara godkända för zonen.", "Dust from flour, grain, sugar and wood can explode. ATEX then applies, and every component must be approved for the zone."),
    options: [g(locale, "Ja, brännbart damm (zon 21 eller 22)", "Yes, combustible dust (zone 21 or 22)"), g(locale, "Nej", "No")],
  };
}

/** Frågorna som ställs när modellen inte svarar, och som fyller på när den svarar för lite. */
export function reservfragor(text: string, locale: string, kod?: Kodvarden): Fraga[] {
  const typ = forfragningstyp(text);
  const k = kandaVarden(text, kod);
  const q: Fraga[] = [];

  if (typ === "luftberedning") {
    if (!k.anslutning) q.push({ id: "luft_anslutning", type: "choice",
      label: g(locale, "Vilken anslutningsstorlek har tryckluftsledningen?", "What connection size does the compressed-air line have?"),
      hint: g(locale, "Står ofta på den gamla enheten eller går att mäta på gängan. G1/4 är vanligast på mindre maskiner.", "Often shown on the old unit or measurable on the thread. G1/4 is most common on smaller machines."),
      options: ["G1/4", "G3/8", "G1/2", g(locale, "G3/4 eller större", "G3/4 or larger")] });
    if (!k.flode) q.push({ id: "luft_flode", type: "number", unit: "l/min",
      label: g(locale, "Hur stort luftflöde behövs?", "How much air flow is needed?"),
      hint: g(locale, "Summan av det maskinens förbrukare drar samtidigt. Står ofta på den gamla enhetens typskylt; vet du inte, välj Vet inte.", "The total drawn by the machine's consumers at the same time. Often on the old unit's nameplate; if unsure, choose Don't know.") });
    if (!k.tryck) q.push({ id: "luft_tryck", type: "number", unit: "bar",
      label: g(locale, "Vilket tryck ska regulatorn ställas på?", "What pressure should the regulator be set to?"),
      hint: g(locale, "De flesta maskiner går på 5–6 bar.", "Most machines run at 5–6 bar.") });
    q.push({ id: "luft_filtergrad", type: "choice",
      label: g(locale, "Hur ren behöver luften vara?", "How clean does the air need to be?"),
      hint: g(locale, "5 µm räcker för vanliga cylindrar och ventiler. Mycket ren, oljefri luft behövs till exempel vid lackering eller när luften blåser direkt på en produkt.", "5 µm is enough for ordinary cylinders and valves. Very clean, oil-free air is needed for example for painting or when the air blows directly on a product."),
      options: [g(locale, "Normal (filter 5 µm)", "Normal (5 µm filter)"), g(locale, "Grovfilter (40 µm)", "Coarse filter (40 µm)"), g(locale, "Mycket ren och oljefri (0,01 µm)", "Very clean and oil-free (0.01 µm)")] });
    q.push({ id: "luft_dimsmorjning", type: "choice",
      label: g(locale, "Ska luften smörjas med en dimsmörjare?", "Should the air be lubricated with a lubricator?"),
      hint: g(locale, "Moderna cylindrar och ventiler är försmorda och ska köras med osmord luft. Har maskinen alltid gått med smord luft ska den fortsätta med det.", "Modern cylinders and valves are pre-lubricated and should run on non-lubricated air. If the machine has always run on lubricated air, it should continue to."),
      options: [g(locale, "Nej, osmord luft", "No, non-lubricated air"), g(locale, "Ja, smord luft", "Yes, lubricated air")] });
    q.push({ id: "luft_kondensat", type: "choice",
      label: g(locale, "Ska kondensvattnet tappas ur automatiskt?", "Should condensate be drained automatically?"),
      hint: g(locale, "Automatisk avtappning slipper någon komma ihåg att tömma filterkoppen.", "An automatic drain means nobody has to remember to empty the filter bowl."),
      options: [g(locale, "Ja, automatiskt", "Yes, automatically"), g(locale, "Nej, manuellt räcker", "No, manual is enough")] });
    q.push({ id: "luft_avstangning", type: "choice",
      label: g(locale, "Behövs en låsbar avstängningsventil som avluftar maskinen?", "Is a lockable shut-off valve that exhausts the machine needed?"),
      hint: g(locale, "Används vid service: maskinen görs trycklös och ventilen låses med hänglås.", "Used during maintenance: the machine is depressurised and the valve is locked with a padlock."),
      options: [g(locale, "Ja", "Yes"), g(locale, "Nej", "No")] });
    return q;
  }

  if (typ === "ventil") {
    // En ventilterminal styr flera cylindrar, ofta av olika slag.
    const flera = /ventilterminal|ventilö|ventilblock|manifold|\b\d+\s*(st\s+)?(ventiler|cylindrar)\b/i.test(text);
    q.push({ id: "ventil_uppgift", type: "choice",
      label: flera ? g(locale, "Vad ska ventilerna styra?", "What will the valves control?") : g(locale, "Vad ska ventilen styra?", "What will the valve control?"),
      hint: flera
        ? g(locale, "Styr de olika sorters cylindrar, skriv fördelningen som eget svar, t.ex. 6 st 5/2 och 2 st 5/3.", "If they control different kinds of cylinders, give the split as your own answer, e.g. 6 × 5/2 and 2 × 5/3.")
        : g(locale, "En dubbelverkande cylinder drivs med luft åt båda hållen; en enkelverkande har en fjäder som för tillbaka den.", "A double-acting cylinder is driven by air both ways; a single-acting one has a spring that returns it."),
      options: [g(locale, "En dubbelverkande cylinder (5/2)", "A double-acting cylinder (5/2)"), g(locale, "En enkelverkande cylinder eller ett luftflöde (3/2)", "A single-acting cylinder or an air flow (3/2)"), g(locale, "En cylinder som ska kunna stanna mitt i slaget (5/3)", "A cylinder that must be able to stop mid-stroke (5/3)")] });
    q.push({ id: "ventil_vid_stromavbrott", type: "choice",
      label: g(locale, "Vad ska ventilen göra om strömmen bryts?", "What should the valve do if power is lost?"),
      hint: g(locale, "Monostabil går tillbaka till viloläget med en fjäder; bistabil stannar kvar där den var.", "Monostable returns to its rest position by a spring; bistable stays where it was."),
      options: [g(locale, "Gå tillbaka till viloläget (monostabil)", "Return to rest position (monostable)"), g(locale, "Stanna kvar i sitt läge (bistabil)", "Stay in its position (bistable)")] });
    // Med fältbuss är spänningen 24 V DC; 230 V AC finns inte på en PROFINET-terminal.
    if (!k.spanning && !k.faltbuss) q.push({ id: "ventil_spanning", type: "choice",
      label: g(locale, "Vilken spänning har styrsystemet?", "What voltage does the control system use?"),
      hint: g(locale, "24 V DC är standard i nyare maskiner.", "24 V DC is standard in newer machines."),
      options: ["24 V DC", "230 V AC", g(locale, "Annan", "Other")] });
    if (!k.anslutning) q.push({ id: "ventil_anslutning", type: "choice",
      label: g(locale, "Vilken slangdimension går till cylindrarna?", "What tube size goes to the cylinders?"),
      hint: g(locale, "Slangens ytterdiameter, ofta tryckt på slangen.", "The tube's outer diameter, often printed on the tube."),
      options: ["4 mm", "6 mm", "8 mm", g(locale, "10 mm eller större", "10 mm or larger")] });
    if (!/\b\d+\s*(st\s+)?(ventiler|cylindrar|ventilplatser)\b/i.test(text)) q.push({ id: "ventil_antal", type: "number", unit: g(locale, "st", "pcs"),
      label: g(locale, "Hur många ventiler behövs?", "How many valves are needed?") });
    if (!k.styrning) q.push({ id: "ventil_inkoppling", type: "choice",
      label: g(locale, "Hur kopplas ventilerna till styrsystemet?", "How are the valves connected to the control system?"),
      hint: g(locale, "Med fler än fyra–fem ventiler blir en ventilterminal med fältbuss ofta billigare att koppla in.", "With more than four or five valves, a valve terminal with fieldbus is often cheaper to wire."),
      options: [g(locale, "En kabel till varje ventil", "A cable to each valve"), g(locale, "Samlat via fältbuss, t.ex. PROFINET", "Combined via fieldbus, e.g. PROFINET"), "IO-Link"] });
    return q;
  }

  if (typ === "givare") {
    if (!k.givaruppgift) q.push({ id: "givare_uppgift", type: "choice",
      label: g(locale, "Vad ska givaren känna av?", "What should the sensor detect?"),
      options: [g(locale, "Cylinderns ändläge (kolvens magnet)", "The cylinder's end position (piston magnet)"), g(locale, "Ett föremål framför givaren", "An object in front of the sensor"), g(locale, "Trycket i en ledning", "The pressure in a line")] });
    q.push({ id: "givare_signal", type: "choice",
      label: g(locale, "Vilken signal tar styrsystemet emot?", "What signal does the control system accept?"),
      hint: g(locale, "PNP är vanligast i Europa. Står på styrsystemets ingångskort.", "PNP is most common in Europe. Shown on the control system's input card."),
      options: ["PNP", "NPN", "IO-Link"] });
    q.push({ id: "givare_inkoppling", type: "choice",
      label: g(locale, "Hur ska givaren kopplas in?", "How should the sensor be connected?"),
      options: [g(locale, "Med kontakt (M8 eller M12)", "With a connector (M8 or M12)"), g(locale, "Med fast kabel", "With a fixed cable")] });
    if (!k.fabrikat) q.push({ id: "givare_fabrikat", type: "choice",
      label: g(locale, "Vilket fabrikat har cylindern eller maskinen?", "What brand is the cylinder or machine?"),
      hint: g(locale, "Givarens fäste och spår skiljer sig mellan fabrikaten.", "The sensor's mounting and slot differ between brands."),
      options: ["Festo", "SMC", "Parker", "AVENTICS", g(locale, "Annat", "Other")] });
    return q;
  }

  if (typ === "slang") {
    q.push({ id: "slang_dimension", type: "choice",
      label: g(locale, "Vilken slangdimension (ytterdiameter)?", "What tube size (outer diameter)?"),
      options: ["4 mm", "6 mm", "8 mm", "10 mm", "12 mm"] });
    q.push({ id: "slang_material", type: "choice",
      label: g(locale, "Vilket slangmaterial?", "What tube material?"),
      hint: g(locale, "Polyuretan är mjukt och lätt att dra; polyamid tål högre tryck och värme.", "Polyurethane is soft and easy to route; polyamide handles higher pressure and heat."),
      options: [g(locale, "Polyuretan (PU)", "Polyurethane (PU)"), g(locale, "Polyamid (PA)", "Polyamide (PA)")] });
    if (!k.anslutning) q.push({ id: "koppling_ganga", type: "choice",
      label: g(locale, "Vilken gänga ska kopplingarna ha?", "What thread should the fittings have?"),
      options: ["M5", "G1/8", "G1/4", "G3/8", "G1/2"] });
    q.push({ id: "slang_langd_m", type: "number", unit: "m",
      label: g(locale, "Hur mycket slang behövs?", "How much tubing is needed?") });
    return q;
  }

  // ── Vridning ───────────────────────────────────────────────────────────────
  // Vridenheten väljs på vridmoment (index.ts, isPureRotary). Vet kunden inte
  // vridmomentet räknas det fram ur vikt och hävarm (uppskattatVridmomentNm).
  // Id:na får inte innehålla "slag", "avstånd" eller "längd": extractMinStroke
  // läser sådana svar som en slaglängd, och då väljs ingen vridenhet.
  if (typ === "vridning") {
    if (!k.vinkel) q.push({ id: "vridvinkel", type: "choice",
      label: g(locale, "Hur många grader ska den vrida?", "How many degrees should it rotate?"),
      hint: g(locale, "Vridenheter finns för bestämda vinklar. Ska den stanna i ett mellanläge, skriv det som eget svar.", "Rotary actuators come in fixed angles. If it must stop at an intermediate position, write that as your own answer."),
      options: ["90°", "180°", "270°"] });
    if (!k.vridmoment) {
      q.push({ id: "vridmoment_nm", type: "number", unit: "Nm",
        label: g(locale, "Vilket vridmoment behövs?", "What torque is needed?"),
        hint: g(locale, "Vet du inte det, välj Vet inte och svara på frågorna om vikt och avstånd, så räknar vi fram det.", "If you don't know, choose Don't know and answer the weight and distance questions, and we will estimate it.") });
      q.push({ id: "last_kg", type: "number", unit: "kg",
        label: g(locale, "Hur mycket väger det som ska vridas, med fixtur eller gripdon?", "How much does what is rotated weigh, including fixture or gripper?"),
        hint: g(locale, "En uppskattning räcker.", "An estimate is enough.") });
      q.push({ id: "havarm_mm", type: "number", unit: "mm",
        label: g(locale, "Hur långt från vridcentrum sitter tyngdpunkten?", "How far from the centre of rotation is the centre of gravity?"),
        hint: g(locale, "Ungefär hur långt ut från axeln vikten sitter. Ju längre ut, desto större vridmoment.", "Roughly how far out from the axis the weight sits. The further out, the more torque.") });
    }
    if (!k.givare) q.push(andlagesfraga(locale,
      g(locale, "Behöver styrsystemet veta när vridningen är klar?", "Does the control system need to know when the rotation is done?"),
      g(locale, "Då sitter givare på vridenheten som känner av ändlägena.", "Then sensors on the rotary actuator detect the end positions.")));
    if (!k.styrning) q.push(manovreringsfraga(locale));
    if (arKallt(text) && !k.temperatur) q.push(kylfraga(locale));
    if (!k.miljo) q.push(miljofraga(locale));
    return q;
  }

  // ── Utbyte av en identifierad artikel ────────────────────────────────────────
  // Koden bestämmer borrning och slaglängd, och storleken valdes när maskinen
  // byggdes. Fråga bara det som inte står i koden.
  if (arUtbyte(text, kod)) {
    if (!k.givare) q.push(andlagesfraga(locale,
      g(locale, "Ska den nya cylindern ha givare för ändlägena?", "Should the new cylinder have end-position sensors?"),
      g(locale, "Satt det givare på den gamla, behöver den nya också ha det.", "If the old one had sensors, the new one needs them too.")));
    if (!k.miljo) q.push(miljofraga(locale));
    return q;
  }

  // ── Rörelse ────────────────────────────────────────────────────────────────
  const multi = needsMultiAxis(text);
  const grepp = arGrepp(text);
  const press = arPress(text);
  const spann = arSpann(text);
  const stopp = arStopp(text);
  const vakuum = /vakuum|vacuum|sugkopp/i.test(text);
  const lucka = /\blucka|luckan|\bdörr|\bgrind|\block\b/i.test(text);
  const elektrisk = arElaxel(text);
  const flerLagen = /\d+\s*(positioner|lägen|stopp)\b|mellanläg|flera\s+(lägen|positioner)/i.test(text);
  const positionering = !stopp && (/positioner|mellanläg|flera\s+lägen|stopp\w*\s+(på|i)|exakt|precision|noggrann/i.test(text) || elektrisk);

  // ── Utsortering från ett band ────────────────────────────────────────────
  // Lådsorteringstestet 2026-10-13: bandets hastighet blev utskjutarens, och
  // ingen fråga ställdes om tiden utskjutaren har. Frågorna här är de som
  // ändrar komponentvalet (kraft, dämpning, tid); de som rör programmet --
  // produktdetektering, blockerad mottagning -- följer med till PLC-delen som
  // öppna frågor (kravbild.ts) i stället för att ställas här.
  if (arSortering(text)) {
    q.push({ id: "band_vid_utskjutning", type: "choice",
      label: g(locale, "Går bandet eller står det still när lådan skjuts av?", "Is the conveyor running or stopped while the box is pushed off?"),
      hint: g(locale, "Går bandet följer lådan med medan den skjuts, och tiden blir kort.", "If it runs, the box moves along while being pushed, and the time is short."),
      varfor: g(locale, "Avgör hur lång tid utskjutaren har och om lådan kan vridas under utskjutningen.", "Decides how much time the pusher has and whether the box can twist while pushed."),
      options: [g(locale, "Bandet går hela tiden", "The conveyor keeps running"), g(locale, "Bandet stannar vid utskjutning", "The conveyor stops for the push")] });
    q.push({ id: "utskjutningstid_s", type: "number", unit: "s",
      label: g(locale, "Hur lång tid får utskjutning och återgång ta tillsammans?", "How long may the push and return take together?"),
      hint: g(locale, "Från att utskjutaren börjar röra sig tills den är tillbaka. Vet du inte, lämna frågan öppen.", "From the pusher starting to move until it is back. If unsure, leave it open."),
      varfor: g(locale, "Tiden avgör kraften, dämpningen och om utskjutaren hinner tillbaka före nästa låda.", "The time decides force, cushioning and whether the pusher is back before the next box.") });
    q.push({ id: "minsta_avstand_mm", type: "number", unit: "mm",
      label: g(locale, "Hur kort kan avståndet mellan två lådor bli?", "How short can the gap between two boxes be?"),
      hint: g(locale, "Från bakkanten på en låda till framkanten på nästa.", "From the rear edge of one box to the front edge of the next."),
      varfor: g(locale, "Med varierande avstånd är det minsta avståndet som bestämmer hur fort utskjutaren måste vara tillbaka.", "With varying gaps, the smallest gap decides how quickly the pusher must be back.") });
    q.push({ id: "utsorteringar_i_foljd", type: "choice",
      label: g(locale, "Kan två eller fler lådor i rad behöva sorteras ut?", "Can two or more boxes in a row need to be rejected?"),
      varfor: g(locale, "Två utsorteringar i följd med minsta avstånd är det fall som cykeltiden dimensioneras för. 15 passerande lådor per minut är inte 15 utsorteringar per minut.", "Two consecutive rejects at the minimum gap is the case the cycle time is sized for. 15 passing boxes per minute is not 15 rejects per minute."),
      options: [g(locale, "Nej, bara enstaka lådor", "No, only single boxes"), g(locale, "Ja, två i följd", "Yes, two in a row"), g(locale, "Ja, fler än två i följd", "Yes, more than two in a row")] });
    q.push({ id: "rorlig_massa_kg", type: "number", unit: "kg",
      label: g(locale, "Ungefär hur mycket väger skjutplattan och det som rör sig med cylindern?", "Roughly how much do the push plate and the parts moving with the cylinder weigh?"),
      hint: g(locale, "En uppskattning räcker.", "An estimate is enough."),
      varfor: g(locale, "Kraften och dämpningen ska klara lådan plus de rörliga delarna.", "Force and cushioning must handle the box plus the moving parts.") });
  }

  if (multi && !k.slag) {
    q.push({ id: "slag_x_sidled_mm", type: "number", unit: "mm",
      label: g(locale, "Hur lång är rörelsen i sidled?", "How long is the horizontal movement?"),
      hint: g(locale, "Avståndet mellan plock- och lämningsplatsen, i millimeter.", "The distance between the pick and place positions, in millimetres.") });
    q.push({ id: "slag_z_hojd_mm", type: "number", unit: "mm",
      label: g(locale, "Hur lång är rörelsen i höjdled?", "How long is the vertical movement?"),
      hint: g(locale, "Hur långt ned och upp föremålet ska, i millimeter.", "How far down and up the object goes, in millimetres.") });
  } else if (!k.slag) {
    q.push({ id: "slaglangd_mm", type: "number", unit: "mm",
      label: g(locale, "Hur lång ska rörelsen vara (slaglängd)?", "How long should the movement be (stroke)?"),
      hint: stopp
        ? g(locale, "Från helt nedfällt under bandet till uppe där paketet tar emot, i millimeter.", "From fully below the conveyor to up where the package stops, in millimetres.")
        : g(locale, "Avståndet mellan start- och slutläget, i millimeter. Ta gärna lite marginal.", "The distance between the start and end positions, in millimetres. Allow a little margin.") });
  }
  if (press && !k.kraft) {
    q.push({ id: "kraft_n", type: "number", unit: "N",
      label: spann
        ? g(locale, "Vilken kraft ska varje spännpunkt hålla med?", "What force must each clamping point hold with?")
        : /tryck(a|er)\s+ut|dosera|mata\s+ut|matar\s+ut/i.test(text)
          ? g(locale, "Vilken kraft behövs för att trycka ut produkten?", "What force is needed to push the product out?")
          : g(locale, "Vilken kraft behövs?", "What force is needed?"),
      hint: g(locale, "10 N motsvarar ungefär 1 kg. Vet du inte kraften, välj Vet inte.", "10 N is roughly 1 kg. If you don't know the force, choose Don't know.") });
  } else if (!press && !k.last && !k.kraft) {
    q.push({ id: "last_kg", type: "number", unit: "kg",
      label: stopp ? g(locale, "Hur mycket väger det tyngsta paketet?", "How much does the heaviest package weigh?")
        : lucka ? g(locale, "Hur mycket väger luckan eller dörren?", "How much does the hatch or door weigh?")
        : g(locale, "Hur mycket väger det som ska flyttas eller hållas?", "How much does what is moved or held weigh?"),
      hint: stopp ? g(locale, "Tunga paket och hög bandhastighet kräver ett kraftigare stopp.", "Heavy packages and a fast conveyor need a stronger stop.")
        : grepp || vakuum ? g(locale, "Räkna med gripdon, sugkoppar och verktyg. En uppskattning räcker.", "Include grippers, suction cups and tooling. An estimate is enough.")
        : g(locale, "En uppskattning räcker.", "An estimate is enough.") });
  }
  if (grepp && !k.greppsatt) {
    q.push({ id: "greppsatt", type: "choice",
      label: g(locale, "Hur ska föremålet hållas?", "How should the object be held?"),
      hint: g(locale, "Sugkoppar passar släta, täta ytor; ett gripdon klämmer om föremålet.", "Suction cups suit smooth, sealed surfaces; a gripper clamps around the object."),
      options: [g(locale, "Med sugkopp (vakuum)", "With a suction cup (vacuum)"), g(locale, "Med gripdon som klämmer", "With a gripper that clamps")] });
  }
  if (arDammRisk(text)) q.push(dammfraga(locale));
  if (arKorrosiv(text) && !arLivsmedel(text) && !arSpolmiljo(text)) {
    q.push({ id: "korrosion", type: "choice",
      label: g(locale, "Hur utsatt blir den för vatten eller kemikalier?", "How exposed will it be to water or chemicals?"),
      hint: g(locale, "Avgör om vanligt rostfritt räcker eller om syrafast rostfritt (A4/316) och tåligare tätningar behövs.", "Determines whether ordinary stainless is enough or acid-proof stainless (A4/316) and tougher seals are needed."),
      options: [g(locale, "Fukt och stänk", "Moisture and splashes"), g(locale, "Saltvattenstänk", "Salt water spray"), g(locale, "Kemikalier eller syror", "Chemicals or acids"), g(locale, "Helt nedsänkt i vatten", "Fully submerged in water")] });
  }
  if (arLivsmedel(text)) {
    q.push({ id: "livsmedelskontakt", type: "choice",
      label: g(locale, "Kommer delen i kontakt med livsmedlet eller produkten?", "Will the part come into contact with the food or product?"),
      hint: g(locale, "I direkt kontakt krävs livsmedelsgodkänt smörjmedel (NSF-H1) och hygienisk utformning. Sitter den bara i närheten räcker oftast standardutförande.", "In direct contact, food-grade lubricant (NSF-H1) and hygienic design are required. If it is only nearby, a standard version is usually enough."),
      options: [g(locale, "Ja, i direkt kontakt", "Yes, in direct contact"), g(locale, "Nej, bara i närheten", "No, only nearby")] });
  }
  if (arKallt(text) && !k.temperatur) q.push(kylfraga(locale));
  // Pick-and-place rör sig både i sidled och höjdled; ett stopp går alltid upp
  // under bandet; ett spänndon håller fast oavsett riktning.
  if (!k.riktning && !multi && !stopp && !spann) {
    q.push({ id: "rorelseriktning", type: "choice",
      label: g(locale, "Hur rör sig lasten?", "How does the load move?"),
      hint: elektrisk
        ? g(locale, "En lodrät elaxel behöver en motorbroms som håller lasten när strömmen bryts.", "A vertical electric axis needs a motor brake that holds the load when power is lost.")
        : g(locale, "Lyfter cylindern lasten krävs mer kraft, och lasten kan behöva hållas kvar om luften försvinner.", "If the cylinder lifts the load, more force is needed, and the load may need to be held if air is lost."),
      options: [g(locale, "Horisontell rörelse", "Horizontal movement"), g(locale, "Vertikal, lyfter lasten", "Vertical, lifting the load"), g(locale, "Vertikal, trycker nedåt", "Vertical, pushing down"), g(locale, "Sned, i vinkel", "At an angle")] });
  }
  if (needsVerticalLoad(text) && !/får\s+inte\s+falla|hållas?\s+kvar|stångbroms|fallskydd|broms/i.test(text)) {
    q.push({ id: "lasthallning", type: "choice",
      label: vakuum
        ? g(locale, "Om tryckluften eller strömmen bryts, får lasten falla?", "If the compressed air or power is lost, may the load drop?")
        : elektrisk
          ? g(locale, "Om strömmen bryts, får lasten sjunka ned?", "If power is lost, may the load drop?")
          : g(locale, "Om tryckluften försvinner, får lasten sjunka ned?", "If the compressed air is lost, may the load drop?"),
      hint: vakuum
        ? g(locale, "Ska lasten sitta kvar behövs en backventil som håller vakuumet i sugkopparna en stund, och en stångbroms på lyftcylindern.", "If the load must stay put, a non-return valve that holds the vacuum in the cups for a while is needed, and a rod lock on the lifting cylinder.")
        : elektrisk
          ? g(locale, "Ska lasten stå kvar behövs en motor med broms som håller axeln när strömmen bryts.", "If the load must stay put, a motor with a brake that holds the axis when power is lost is needed.")
          : g(locale, "Ska lasten stå kvar läggs en stångbroms till som håller den mekaniskt.", "If the load must stay put, a rod lock is added that holds it mechanically."),
      options: [g(locale, "Nej, lasten får inte falla ned", "No — load holding required, it must not drop"), g(locale, "Ja, det gör inget", "Yes, that is fine")] });
  }
  // ── Elaxel ────────────────────────────────────────────────────────────────
  // Det en ingenjör frågar före ett servoval (Geminis testfall 2026-10-11):
  // hur många lägen, vad noggrannheten avser, hur fort förflyttningen ska gå
  // (accelerationen dimensionerar motorn), var lasten sitter och hur axeln
  // styrs. Inga cylinderfrågor -- ändlägesgivare, kolvstång, slag per minut.
  if (elektrisk) {
    const precision = extractPrecisionMm(text, {});
    const tal = (n: number) => (locale === "sv" ? String(n).replace(".", ",") : String(n));
    if (!flerLagen) q.push({ id: "antal_lagen", type: "choice",
      label: g(locale, "Hur många lägen ska axeln stanna i?", "How many positions should the axis stop at?"),
      hint: g(locale, "Fasta lägen kan styras med enkla signaler; fritt valda lägen kräver att styrsystemet skickar positioner till drivsteget.", "Fixed positions can be selected with simple signals; freely chosen positions need the control system to send positions to the drive."),
      options: [g(locale, "Bara två ändlägen", "Only two end positions"), g(locale, "3–10 fasta lägen", "3–10 fixed positions"), g(locale, "Fritt valda lägen", "Freely chosen positions")] });
    if (precision > 0 && precision <= 0.5) {
      q.push({ id: "noggrannhet_typ", type: "choice",
        label: g(locale, `Gäller ±${tal(precision)} mm att axeln hittar samma läge igen, eller att varje läge ligger exakt rätt över hela slaget?`,
          `Does ±${tal(precision)} mm mean the axis returns to the same position, or that every position is exactly right over the whole stroke?`),
        hint: g(locale, "Samma läge igen (repeterbarhet) klarar en kuggremsaxel. Exakt rätt över hela slaget (absolut noggrannhet) kräver kulskruv eller ett linjärt mätsystem på vagnen.",
          "Returning to the same position (repeatability) is within reach of a toothed belt axis. Exactly right over the whole stroke (absolute accuracy) needs a ball screw or a linear measuring system on the carriage."),
        options: [g(locale, "Samma läge igen (repeterbarhet)", "The same position again (repeatability)"), g(locale, "Exakt rätt över hela slaget (absolut noggrannhet)", "Exactly right over the whole stroke (absolute accuracy)")] });
    } else if (!k.precision) {
      q.push({ id: "precision", type: "choice",
        label: g(locale, "Hur exakt måste den stanna?", "How precisely must it stop?"),
        hint: g(locale, "Hur nära önskat läge den måste stanna varje gång.", "How close to the target position it must stop every time."),
        options: ["±1 mm", "±0,1 mm", g(locale, "±0,02 mm eller bättre", "±0.02 mm or better")] });
    }
    if (extractMoveTimeS(text, {}) === 0) q.push({ id: "forflyttningstid_s", type: "number", unit: "s",
      label: g(locale, "Hur lång tid får en förflyttning ta?", "How long may one move take?"),
      hint: g(locale, "Från start till stopp. Tiden avgör accelerationen, och den avgör motorn. Vet du bara farten, välj Vet inte.", "From start to stop. The time sets the acceleration, which sets the motor. If you only know the speed, choose Don't know.") });
    q.push({ id: "lastplacering", type: "choice",
      label: g(locale, "Sitter lasten mitt på vagnen, eller sticker den ut åt sidan eller uppåt?", "Is the load centred on the carriage, or does it overhang to the side or upwards?"),
      hint: g(locale, "En utskjutande last belastar axelns styrning med ett moment, och då behövs ofta en större axel.", "An overhanging load puts a moment on the axis guide, and then a larger axis is often needed."),
      options: [g(locale, "Centrerad på vagnen", "Centred on the carriage"), g(locale, "Utskjutande (hävarm)", "Overhanging (lever arm)")] });
    if (!k.styrning) q.push({ id: "styrning_axel", type: "choice",
      label: g(locale, "Hur ska axeln styras?", "How will the axis be controlled?"),
      hint: g(locale, "Avgör vilket drivsteg som passar: med fältbuss skickar PLC:n positioner direkt.", "Determines which drive fits: with a fieldbus the PLC sends positions directly."),
      options: [g(locale, "Från en PLC via fältbuss (t.ex. PROFINET, EtherCAT)", "From a PLC via fieldbus (e.g. PROFINET, EtherCAT)"), g(locale, "Från en PLC med digitala signaler", "From a PLC with digital signals"), g(locale, "Fristående, utan PLC", "Stand-alone, without a PLC")] });
    if (!k.miljo) q.push(miljofraga(locale));
    if (!k.takt) q.push({ id: "takt", type: "choice",
      label: g(locale, "Hur ofta görs rörelsen?", "How often is the movement made?"),
      hint: g(locale, "Täta rörelser avgör axelns och motorns livslängd.", "Frequent movements determine the life of the axis and motor."),
      options: [g(locale, "Några gånger i timmen eller mer sällan", "A few times an hour or less"), g(locale, "Upp till 10 slag/min", "Up to 10 strokes/min"), g(locale, "10–59 slag/min", "10–59 strokes/min"), g(locale, "60 slag/min eller mer", "60 strokes/min or more")] });
    return q;
  }
  // Precisionen före takten: den avgör om det blir en cylinder eller en elaxel.
  if (positionering && !k.precision) {
    // Med flera lägen eller en elaxel är "bara i ändlägena" inget svar.
    const exakta = ["±1 mm", "±0,1 mm", g(locale, "±0,02 mm eller bättre", "±0.02 mm or better")];
    q.push({ id: "precision", type: "choice",
      label: g(locale, "Hur exakt måste den stanna?", "How precisely must it stop?"),
      hint: flerLagen || elektrisk
        ? g(locale, "Hur nära önskat läge den måste stanna varje gång.", "How close to the target position it must stop every time.")
        : g(locale, "En vanlig cylinder stannar exakt i sina ändlägen. Ska den stanna exakt mitt i rörelsen behövs oftast en elektrisk axel.", "A standard cylinder stops precisely at its end positions. Stopping precisely mid-travel usually needs an electric axis."),
      options: flerLagen || elektrisk ? exakta : [g(locale, "Bara i ändlägena", "Only at the end positions"), ...exakta] });
  }
  if (!k.takt) {
    q.push({ id: "takt", type: "choice",
      label: g(locale, "Hur ofta görs rörelsen?", "How often is the movement made?"),
      hint: g(locale, "Täta rörelser kräver tåligare cylindrar och ofta dämpning i ändlägena.", "Frequent movements need more durable cylinders and often end-position cushioning."),
      options: [g(locale, "Några gånger i timmen eller mer sällan", "A few times an hour or less"), g(locale, "Upp till 10 slag/min", "Up to 10 strokes/min"), g(locale, "10–59 slag/min", "10–59 strokes/min"), g(locale, "60 slag/min eller mer", "60 strokes/min or more")] });
  }
  // En elaxel vet själv var den är; ändlägesgivare är en fråga för cylindrar.
  if (!k.givare && !elektrisk) {
    q.push(stopp
      ? andlagesfraga(locale, g(locale, "Behöver styrsystemet veta om stoppet är uppe eller nere?", "Does the control system need to know whether the stop is up or down?"))
      : spann
        ? andlagesfraga(locale, g(locale, "Behöver styrsystemet veta att detaljen är fastspänd?", "Does the control system need to know that the part is clamped?"))
        : andlagesfraga(locale));
  }
  if (!k.styrning) q.push(manovreringsfraga(locale));
  if (!k.miljo) q.push(miljofraga(locale));
  return q;
}

/**
 * Bankfrågor som inte ställs av sig själva men ersätter modellens fråga om
 * samma ämne, eftersom modellens alternativ var fel ("Ja, med fjädrande stöd"
 * som vridskydd, fältbussar utan alternativet vanliga I/O).
 */
function ersattningar(text: string, locale: string): Map<string, Fraga> {
  const m = new Map<string, Fraga>();
  // Svaret får inte innehålla "vrid" eller "rot": index.ts lägger då till
  // vridenheter i katalogvalet. "styrning" läses som vridskydd (needsGuidance).
  m.set("vridskydd", { id: "vridskydd", type: "choice",
    label: g(locale, "Måste det som sitter på kolvstången hållas rätt utan att vrida sig, eller tar kolvstången sidokrafter?", "Must whatever sits on the piston rod be kept from turning, or does the rod take side loads?"),
    hint: g(locale, "Då behövs en cylinder med styrning (styrstänger eller en styrd enhet). En vanlig kolvstång kan vrida sig och tål bara små sidokrafter.", "Then a cylinder with guiding is needed (guide rods or a guided unit). A plain piston rod can turn and only takes small side loads."),
    options: [g(locale, "Ja, den behöver styrning", "Yes, it needs guiding"), g(locale, "Nej, det behövs inte", "No, not needed")] });
  if (arLivsmedel(text) || arSpolmiljo(text)) {
    // DSBF-C-databladet: Clean Design i aluminium för torra zoner och
    // stänkzoner i livsmedels- och förpackningsindustrin.
    m.set("material", { id: "material", type: "choice",
      label: g(locale, "Måste cylindern vara i rostfritt stål, eller räcker en tvättålig cylinder i aluminium (Clean Design)?", "Must the cylinder be stainless steel, or is a washable aluminium cylinder (clean design) enough?"),
      hint: g(locale, "Rostfritt, helst syrafast A4/316, väljs där den spolas direkt eller sitter i livsmedelszonen. En Clean Design-cylinder i anodiserad aluminium räcker ofta i stänkzonen.", "Stainless, preferably acid-proof A4/316, is chosen where it is washed directly or sits in the food zone. A clean-design cylinder in anodised aluminium is often enough in the splash zone."),
      options: [g(locale, "Rostfritt stål", "Stainless steel"), g(locale, "Clean Design i aluminium räcker", "Clean design in aluminium is enough")] });
  } else if (arKorrosiv(text)) {
    // Korrosion utan livsmedel: materialet följer av vad den utsätts för.
    const korrosion = reservfragor(text, locale).find((q) => q.id === "korrosion");
    if (korrosion) m.set("material", korrosion);
  }
  if (needsValveTerminal(text)) {
    m.set("faltbuss", { id: "ventil_inkoppling", type: "choice",
      label: g(locale, "Hur kopplas ventilerna till styrsystemet?", "How are the valves connected to the control system?"),
      hint: g(locale, "Med fler än fyra–fem ventiler blir en ventilterminal med fältbuss ofta billigare att koppla in.", "With more than four or five valves, a valve terminal with fieldbus is often cheaper to wire."),
      options: [g(locale, "En kabel till varje ventil", "A cable to each valve"), g(locale, "Samlat via fältbuss, t.ex. PROFINET", "Combined via fieldbus, e.g. PROFINET"), "IO-Link"] });
  }
  return m;
}

/**
 * Frågor som avgör valet och därför alltid ställs när de är öppna, oavsett
 * vad modellen hittade på: utan slaglängd, last eller greppsätt går det inte
 * att välja, och en lyft last utan svar om lasthållning ger fel stycklista.
 */
const ALLTID = new Set([
  "slaglangd_mm", "slag_x_sidled_mm", "slag_z_hojd_mm", "last_kg", "kraft_n", "greppsatt", "lasthallning",
  "luft_anslutning", "luft_flode", "ventil_uppgift", "givare_uppgift", "slang_dimension", "korrosion",
  "vridvinkel", "vridmoment_nm", "havarm_mm", "atex_damm", "temperatur_lagsta", "livsmedelskontakt",
  "antal_lagen", "noggrannhet_typ", "forflyttningstid_s", "lastplacering", "styrning_axel",
  "band_vid_utskjutning", "utskjutningstid_s", "minsta_avstand_mm", "utsorteringar_i_foljd", "rorlig_massa_kg",
]);

/**
 * Slutliga frågor: de avgörande bankfrågorna som modellen inte täckte först,
 * sedan modellens rensade frågor, och banken igen tills det finns minst fyra.
 * Högst sex.
 */
export function slutligaFragor(fran_modellen: Fraga[], text: string, locale: string, kod?: Kodvarden): Fraga[] {
  const bank = reservfragor(text, locale, kod);
  // Där banken har en egen fråga om samma ämne ersätter den modellens: bankens
  // alternativ är prövade mot detektorerna i nästa steg, modellens inte
  // ("Elektrisk relä" som ändlägesgivare, anslutningar utan G1/4).
  const bankPerAmne = new Map<string, Fraga>(ersattningar(text, locale));
  for (const q of bank) bankPerAmne.set(amne(q) ?? q.id, q);
  const ersatta = rensaFragor(fran_modellen, text, locale, kod).map((q) => {
    const a = amne(q);
    return (a && bankPerAmne.get(a)) || q;
  });
  // Två av modellens frågor kan ha ersatts med samma bankfråga.
  const rensade = ersatta.filter((q, i) => ersatta.findIndex((x) => x.id === q.id) === i);
  const tackta = new Set(rensade.map((q) => amne(q)).filter(Boolean) as string[]);
  // En lodrät elaxel behöver en motorbroms: riktningen avgör stycklistan.
  const maste = (q: Fraga) => ALLTID.has(q.id) || (q.id === "rorelseriktning" && arElaxel(text));
  const forst = bank.filter((q) => maste(q) && !tackta.has(amne(q) ?? ""));
  for (const q of forst) tackta.add(amne(q) ?? q.id);
  const ut = [...forst, ...rensade];
  for (const q of bank) {
    if (ut.length >= 4) break;
    const a = amne(q) ?? q.id;
    if (ut.some((x) => x.id === q.id) || tackta.has(a)) continue;
    ut.push(q);
    tackta.add(a);
  }
  return ut.slice(0, 6);
}

/** Ingressen när modellen inte svarar. */
export function reservsammanfattning(text: string, locale: string, kod?: Kodvarden): string {
  if (forfragningstyp(text) === "rorelse" && arElaxel(text)) {
    return locale === "sv"
      ? "Några frågor till för att välja rätt axel, motor och drivsteg."
      : "A few more questions to choose the right axis, motor and drive.";
  }
  if (forfragningstyp(text) === "rorelse" && arUtbyte(text, kod)) {
    return locale === "sv"
      ? "Koden säger storleken. Ett par frågor till om det som hör till."
      : "The code gives the size. A couple more questions about what goes with it.";
  }
  const typ = forfragningstyp(text);
  const sv: Record<Forfragan, string> = {
    rorelse: "Några frågor till för att välja rätt cylinder eller axel och det som hör till.",
    vridning: "Några frågor till för att välja rätt vridenhet och det som hör till.",
    luftberedning: "Några frågor till för att välja rätt luftberedning.",
    ventil: "Några frågor till för att välja rätt ventil.",
    givare: "Några frågor till för att välja rätt givare.",
    slang: "Några frågor till för att välja rätt slang och kopplingar.",
  };
  const en: Record<Forfragan, string> = {
    rorelse: "A few more questions to choose the right cylinder or axis and what goes with it.",
    vridning: "A few more questions to choose the right rotary actuator and what goes with it.",
    luftberedning: "A few more questions to choose the right air preparation unit.",
    ventil: "A few more questions to choose the right valve.",
    givare: "A few more questions to choose the right sensor.",
    slang: "A few more questions to choose the right tubing and fittings.",
  };
  return locale === "sv" ? sv[typ] : en[typ];
}
