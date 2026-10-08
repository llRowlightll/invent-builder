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
// Därför: förfrågans typ styr vad som får frågas, det kunden redan sagt
// räknas upp och frågas aldrig igen, modellens frågor rensas efter samma
// regler, och när modellen inte svarar ställs egna frågor ur en fast bank.
// Svarsalternativen är formulerade så att detektorerna i signals.ts läser dem
// rätt (t.ex. "får inte falla" → stångbroms, "Högtrycksspolas" → spolmiljö),
// och undviker ord som felaktigt slår på något ("styrning" = vridskydd,
// "montering" = fästen, "livsmedel" = livsmedelsklass).
// ─────────────────────────────────────────────────────────────────────────────

import {
  extractExplicitBoreMm, extractLoadKg, extractPrecisionMm, extractSpeedMs,
  needsEndPositionDetection, needsFoodGrade, needsMultiAxis, needsPharmaGmp,
  needsSilSafety, needsSpolmiljo, needsVerticalLoad,
} from "./signals.ts";

export type Fraga = {
  id: string;
  label: string;
  hint?: string;
  type: "choice" | "number";
  options?: string[];
  unit?: string;
};

export type Forfragan = "rorelse" | "luftberedning" | "ventil" | "givare" | "slang";

const RORELSE = /\blyft|hissa|sänk[ae]|flytt|förflytt|skjut[ae]|knuff|\btrycka\b|trycker\b|press[ae]|\bpress\b|klämm|spänn[ae]|vrid[ae]|rotera|sväng[ae]|tippa|vippa|positioner|\baxel\b|axlar|elaxel|slaglängd|\bslag\b|pick|plock|placera|grip|greppa|sorter|matning|portal|släde|linjär|\bservo|stegmotor|luckan?\b|dörr|grind/i;
const LUFTBEREDNING = /luftberedning|\bfrl\b|filterregulator|filter.?regulator|tryckregulator|\bregulator|dimsmörj|smörjare|luftfilter|kondensat|avfukt|lufttork|tryckluftsfilter|mjukstart|avstängningsventil|huvudventil|tryckluftsnät/i;
const VENTIL = /magnetventil|ventil(?!ation)|ventilterminal|ventilö|ventilblock|manifold|\b[235]\/[23]\b/i;
const GIVARE = /givare|sensor|tryckvakt|reed|närhets/i;
const SLANG = /\bslang|koppling|instick|fitting|snabbkoppl|skarv/i;

const CYLINDER = /cylind|aktuator|ställdon/i;

/**
 * Vad förfrågan gäller. En rörelse (lyfta, flytta, pressa …) vinner alltid:
 * en cylinder med ventil och givare är en rörelse, och då är ventil- och
 * givarfrågorna en del av den. Men "givare till en cylinder" är en givare --
 * ordet cylinder ensamt gör inte förfrågan till en rörelse.
 */
export function forfragningstyp(text: string): Forfragan {
  if (RORELSE.test(text)) return "rorelse";
  if (LUFTBEREDNING.test(text)) return "luftberedning";
  if (VENTIL.test(text)) return "ventil";
  if (GIVARE.test(text)) return "givare";
  if (SLANG.test(text)) return "slang";
  if (CYLINDER.test(text)) return "rorelse";
  return "rorelse";
}

export type Kanda = {
  slag: boolean; last: boolean; kraft: boolean; takt: boolean; hastighet: boolean;
  precision: boolean; borrning: boolean; tryck: boolean; flode: boolean; temperatur: boolean;
  riktning: boolean; styrning: boolean; faltbuss: boolean; spanning: boolean; anslutning: boolean; miljo: boolean;
  greppsatt: boolean; givare: boolean;
};

/** Det kunden redan har angett. Frågas aldrig igen (av modellen eller av oss). */
export function kandaVarden(text: string): Kanda {
  return {
    slag: /(slag(längd)?|lyfthöjd|lyft\w*|höj[ae]\w*|sänk\w*|flytt\w*|skjut\w*|förflytt\w*|rörelse\w*|vandring|travel|stroke|sträcka|sidled|längs)[^.\d]{0,25}\d{2,5}\s*mm|\d{2,5}\s*mm[^.\d]{0,20}(slag|upp\b|uppåt|ner\b|ned\b|nedåt|i sidled|lyft|stroke|travel|rörelse|förflyttning|framåt|bakåt)/i.test(text),
    last: /\d+(?:[.,]\d+)?\s*kg\b/i.test(text),
    kraft: /\d+(?:[.,]\d+)?\s*k?N\b/.test(text),
    takt: /(\d+|en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|tjugo|trettio|hundra)\s*(gånger|ggr|cykler|slag|takter?|st|lyft|rörelser)\s*(per|i|om|\/)\s*(sekund\w*|sek|s\b|minut\w*|min\b|timme\w*|tim\b|h\b|dag\w*|dygn\w*|vecka\w*|skift\w*)|\d+\s*\/\s*(min|h|s)\b|cykeltid|takttid|per\s+minut|i\s+minuten/i.test(text),
    hastighet: extractSpeedMs(text, {}) > 0,
    precision: extractPrecisionMm(text, {}) > 0,
    borrning: extractExplicitBoreMm(text, {}) > 0,
    tryck: /\d+(?:[.,]\d+)?\s*(bar|mpa|kpa)\b/i.test(text),
    flode: /\d+(?:[.,]\d+)?\s*(n?l\/min|l\/s|m3\/h|m³\/h|nl\/min)/i.test(text),
    temperatur: /-?\d+\s*°\s*c|\bminusgrader|\bfrysrum|\bkylrum|\bugn\b|\bvärmebehandl/i.test(text),
    riktning: /vertikal|horisontell|lodrät|vågrät|\blyft|hissa|sänk|uppåt|nedåt|sidled|liggande|stående|\bupp\b|\bner\b/i.test(text),
    styrning: /\bplc\b|profinet|ethercat|ethernet.?ip|io-?link|modbus|profibus|devicenet|cc-?link|fältbuss|styrsystem|siemens|beckhoff|omron|allen.?bradley|rockwell|schneider|\brelä|tryckknapp|handventil|fotventil|manuellt/i.test(text),
    faltbuss: /profinet|ethercat|ethernet.?ip|io-?link|modbus|profibus|devicenet|cc-?link/i.test(text),
    spanning: /\d+\s*v\s*(dc|ac)\b|\b(12|24|110|115|230)\s*v\b/i.test(text),
    anslutning: /\bg\s?\d\/\d\b|\bg\s?1\b|\bm5\b|\bnpt\b|\br\s?\d\/\d\b|\d+\s*mm\s*slang|slang\s*\d+\s*mm/i.test(text),
    miljo: /livsmedel|spol|tvätt|damm|smuts|utomhus|salt|rostfri|korros|kemikal|atex|explosion|renrum|cleanroom|fukt|vått|vatten/i.test(text),
    greppsatt: /sugkopp|vakuum|vacuum|gripdon|gripper|klo|fingrar|backar\b/i.test(text),
    givare: needsEndPositionDetection(text),
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

export function arElektrisk(text: string): boolean {
  return /elcylinder|elektrisk\w*\s+(cylinder|axel|linjär\w*|ställdon|aktuator|drivning)|eldriven|elaxel|\bservo|stegmotor|stepper|kuggrem|kulskruv|ball.?screw|linjärmodul|linear.?axis|electric\s+(actuator|cylinder|axis)/i.test(text);
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
};

/** Ämnet en fråga handlar om. Används för att rensa och fylla på. */
export function amne(q: Pick<Fraga, "id" | "label"> & { options?: string[] }): string | null {
  if (BANKENS_AMNEN[q.id]) return BANKENS_AMNEN[q.id];
  // Alternativen räknas med: "Vilka certifieringar behövs?" är en
  // livsmedelsfråga först när alternativen är FDA och EHEDG.
  const s = `${q.id} ${q.label} ${(q.options ?? []).join(" ")}`.toLowerCase();
  // "PLC" är ingen prestandanivå: PL c skrivs med mellanslag, PLd/PLe utan.
  if (/\bsil\s?[1-4]?\b|\bpl\s?[de]\b|\bpl\s[a-c]\b|performance.level|säkerhetsnivå|iec\s*62061|iso\s*13849|safety.level|säkerhetsintegritet/.test(s)) return "sakerhetsniva";
  if (/nsf|\bh1\b|ehedg|\bfda\b|1935\/2004|livsmedelsgodk|food.?grade|ra\s*≤|ytfinish|surface.finish/.test(s)) return "livsmedel";
  if (/ip69|ip-?klass|ip.?class|ip.?rating|kapsling|högtryck|washdown/.test(s)) return "ipklass";
  if (/\besd\b|antistat/.test(s)) return "esd";
  if (/renrum|cleanroom|iso.?klass/.test(s)) return "renrum";
  // Luftberedningens ämnen först: "smörjning" och "filtrering" fanns inte, så
  // modellens "Fett | Ingen" och "10/20/50 µm" byttes aldrig mot bankens.
  if (/filtrer|filtergrad|filterfinhet|filtration/.test(s)) return "filtergrad";
  if (/smörj|dimsmörj|lubric|oljedimma/.test(s)) return "dimsmorjning";
  if (/kondens|avtapp|\bdrain/.test(s)) return "kondensat";
  if (/avstängningsventil|avluftningsventil|mjukstart|shut.?off|soft.?start/.test(s)) return "avstangning";
  if (/broms|kolvstångslås|\blås|hålla kvar|hållas kvar|håll(a|er)? (lasten|positionen|position)|fail.?safe|strömavbrott|power.?loss|falla|sjunka|tryckluften försvinner/.test(s)) return "hallning";
  if (/orienter|riktning|vertikal|horisontell|monteringsläge|montera.*i|direction|rör sig/.test(s)) return "riktning";
  if (/givare|sensor|ändläge|end.?position/.test(s)) return "givare";
  if (/slag|stroke|travel|lyfthöjd|rörelsens längd|längd.*rörelse|hur lång/.test(s)) return "slag";
  if (/cykl|gånger|frekvens|takt|cycle|hur ofta|per timme|per minut/.test(s)) return "takt";
  if (/vikt|väger|\blast\b|massa|\bload\b|weight|\bkg\b|hur tung/.test(s)) return "last";
  if (/kraft|force|\(n\)/.test(s)) return "kraft";
  if (/hastighet|speed|m\/s|snabb/.test(s)) return "hastighet";
  if (/precision|noggrann|repeterbar|accuracy|exakt/.test(s)) return "precision";
  if (/fältbus|fieldbus|protokoll|protocol|profinet|ethercat/.test(s)) return "faltbuss";
  if (/plc|styrsystem|control system|styras|styrs|manövr/.test(s)) return "styrning";
  if (/temperatur|temperature|°c/.test(s)) return "temperatur";
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

/** Ämnen som bara hör till en rörelse. */
const RORELSEAMNEN = new Set(["slag", "takt", "last", "kraft", "hastighet", "precision", "riktning", "vridskydd", "givare", "hallning", "grepp", "sakerhetsniva"]);

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
    .replace(/\(upp\/down\)/gi, "(upp/ned)");
}

/**
 * Rensar modellens frågor: inget som redan är sagt, inget som inte hör till
 * förfrågan, inga dubbletter av samma ämne, inga engelska svarsalternativ på
 * en svensk sida. Behåller ordningen.
 */
export function rensaFragor(fragor: Fraga[], text: string, locale: string): Fraga[] {
  const typ = forfragningstyp(text);
  const k = kandaVarden(text);
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
    if (a === "sakerhetsniva" && !arSakerhetskrav(text)) continue;
    if (a === "livsmedel" && !arLivsmedel(text)) continue;
    if (a === "ipklass" && !arSpolmiljo(text) && !arLivsmedel(text)) continue;
    if (a === "esd" && !arElektronikhantering(text)) continue;
    if (a === "renrum" && !/renrum|cleanroom|clean\s+room/i.test(text)) continue;
    if (a === "slag" && (k.slag || typ !== "rorelse")) continue;
    if (a === "takt" && k.takt) continue;
    if (a === "last" && (k.last || (typ !== "rorelse"))) continue;
    if (a === "kraft" && k.kraft) continue;
    if (a === "hastighet" && k.hastighet) continue;
    if (a === "precision" && k.precision) continue;
    if (a === "borrning" && k.borrning) continue;
    if (a === "tryck" && k.tryck) continue;
    if (a === "flode" && k.flode) continue;
    if (a === "temperatur" && k.temperatur) continue;
    if (a === "riktning" && k.riktning) continue;
    if (a === "styrning" && k.styrning) continue;
    if (a === "faltbuss" && k.faltbuss) continue;
    if (a === "spanning" && k.spanning) continue;
    if (typ === "luftberedning" && ((a && RORELSEAMNEN.has(a)) || /cylind|kolv|slag|positioner|stopp/i.test(q.label))) continue;
    if ((typ === "ventil" || typ === "givare" || typ === "slang") && a && RORELSEAMNEN.has(a) && a !== "takt") continue;
    if (locale === "sv" && q.options?.length && q.options.filter(serEngelsk).length * 2 >= q.options.length) continue;
    if (a && sedda.has(a)) continue;
    if (a) sedda.add(a);
    ut.push(q);
  }
  return ut.slice(0, 6);
}

/** Frågorna som ställs när modellen inte svarar, och som fyller på när den svarar för lite. */
export function reservfragor(text: string, locale: string): Fraga[] {
  const typ = forfragningstyp(text);
  const k = kandaVarden(text);
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
    q.push({ id: "ventil_uppgift", type: "choice",
      label: g(locale, "Vad ska ventilen styra?", "What will the valve control?"),
      hint: g(locale, "En dubbelverkande cylinder drivs med luft åt båda hållen; en enkelverkande har en fjäder som för tillbaka den.", "A double-acting cylinder is driven by air both ways; a single-acting one has a spring that returns it."),
      options: [g(locale, "En dubbelverkande cylinder (5/2)", "A double-acting cylinder (5/2)"), g(locale, "En enkelverkande cylinder eller ett luftflöde (3/2)", "A single-acting cylinder or an air flow (3/2)"), g(locale, "En cylinder som ska kunna stanna mitt i slaget (5/3)", "A cylinder that must be able to stop mid-stroke (5/3)")] });
    q.push({ id: "ventil_vid_stromavbrott", type: "choice",
      label: g(locale, "Vad ska ventilen göra om strömmen bryts?", "What should the valve do if power is lost?"),
      hint: g(locale, "Monostabil går tillbaka till viloläget med en fjäder; bistabil stannar kvar där den var.", "Monostable returns to its rest position by a spring; bistable stays where it was."),
      options: [g(locale, "Gå tillbaka till viloläget (monostabil)", "Return to rest position (monostable)"), g(locale, "Stanna kvar i sitt läge (bistabil)", "Stay in its position (bistable)")] });
    if (!k.spanning) q.push({ id: "ventil_spanning", type: "choice",
      label: g(locale, "Vilken spänning har styrsystemet?", "What voltage does the control system use?"),
      hint: g(locale, "24 V DC är standard i nyare maskiner.", "24 V DC is standard in newer machines."),
      options: ["24 V DC", "230 V AC", g(locale, "Annan", "Other")] });
    if (!k.anslutning) q.push({ id: "ventil_anslutning", type: "choice",
      label: g(locale, "Vilken slangdimension går till cylindern?", "What tube size goes to the cylinder?"),
      hint: g(locale, "Slangens ytterdiameter, ofta tryckt på slangen.", "The tube's outer diameter, often printed on the tube."),
      options: ["4 mm", "6 mm", "8 mm", g(locale, "10 mm eller större", "10 mm or larger")] });
    q.push({ id: "ventil_antal", type: "number", unit: g(locale, "st", "pcs"),
      label: g(locale, "Hur många ventiler behövs?", "How many valves are needed?") });
    if (!k.styrning) q.push({ id: "ventil_inkoppling", type: "choice",
      label: g(locale, "Hur kopplas ventilerna till styrsystemet?", "How are the valves connected to the control system?"),
      hint: g(locale, "Med fler än fyra–fem ventiler blir en ventilterminal med fältbuss ofta billigare att koppla in.", "With more than four or five valves, a valve terminal with fieldbus is often cheaper to wire."),
      options: [g(locale, "En kabel till varje ventil", "A cable to each valve"), g(locale, "Samlat via fältbuss, t.ex. PROFINET", "Combined via fieldbus, e.g. PROFINET"), "IO-Link"] });
    return q;
  }

  if (typ === "givare") {
    q.push({ id: "givare_uppgift", type: "choice",
      label: g(locale, "Vad ska givaren känna av?", "What should the sensor detect?"),
      options: [g(locale, "Cylinderns ändläge (kolvens magnet)", "The cylinder's end position (piston magnet)"), g(locale, "Ett föremål framför givaren", "An object in front of the sensor"), g(locale, "Trycket i en ledning", "The pressure in a line")] });
    q.push({ id: "givare_signal", type: "choice",
      label: g(locale, "Vilken signal tar styrsystemet emot?", "What signal does the control system accept?"),
      hint: g(locale, "PNP är vanligast i Europa. Står på styrsystemets ingångskort.", "PNP is most common in Europe. Shown on the control system's input card."),
      options: ["PNP", "NPN", "IO-Link"] });
    q.push({ id: "givare_inkoppling", type: "choice",
      label: g(locale, "Hur ska givaren kopplas in?", "How should the sensor be connected?"),
      options: [g(locale, "Med kontakt (M8 eller M12)", "With a connector (M8 or M12)"), g(locale, "Med fast kabel", "With a fixed cable")] });
    q.push({ id: "givare_fabrikat", type: "choice",
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

  // ── Rörelse ────────────────────────────────────────────────────────────────
  const multi = needsMultiAxis(text);
  const grepp = /grip|greppa|plock|pick|lyft(a|er)?\s+(upp\s+)?(kartong|låd|flask|burk|säck|plåt|skiv|detalj|paket|förpackning)|sug/i.test(text);
  const press = /press[ae]|\bpress\b|klämm|spänn[ae]|stansa|nita|trycka\s+ihop|pressa\s+ihop/i.test(text);
  const positionering = /positioner|mellanläg|flera\s+lägen|stopp\w*\s+(på|i)|exakt|precision|noggrann/i.test(text) || arElektrisk(text);

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
      hint: g(locale, "Avståndet mellan start- och slutläget, i millimeter. Ta gärna lite marginal.", "The distance between the start and end positions, in millimetres. Allow a little margin.") });
  }
  if (press && !k.kraft) {
    q.push({ id: "kraft_n", type: "number", unit: "N",
      label: g(locale, "Vilken kraft behövs?", "What force is needed?"),
      hint: g(locale, "10 N motsvarar ungefär 1 kg. Vet du bara vikten på det som pressas, välj Vet inte.", "10 N is roughly 1 kg. If you only know the weight being pressed, choose Don't know.") });
  } else if (!k.last && !k.kraft) {
    q.push({ id: "last_kg", type: "number", unit: "kg",
      label: g(locale, "Hur mycket väger det som ska flyttas eller hållas?", "How much does what is moved or held weigh?"),
      hint: g(locale, "Räkna med gripdon och verktyg. En uppskattning räcker.", "Include grippers and tooling. An estimate is enough.") });
  }
  if (grepp && !k.greppsatt) {
    q.push({ id: "greppsatt", type: "choice",
      label: g(locale, "Hur ska föremålet hållas?", "How should the object be held?"),
      hint: g(locale, "Sugkoppar passar släta, täta ytor; ett gripdon klämmer om föremålet.", "Suction cups suit smooth, sealed surfaces; a gripper clamps around the object."),
      options: [g(locale, "Med sugkopp (vakuum)", "With a suction cup (vacuum)"), g(locale, "Med gripdon som klämmer", "With a gripper that clamps")] });
  }
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
  if (!k.riktning) {
    q.push({ id: "rorelseriktning", type: "choice",
      label: g(locale, "Hur rör sig lasten?", "How does the load move?"),
      hint: g(locale, "Lyfter cylindern lasten krävs mer kraft, och lasten kan behöva hållas kvar om luften försvinner.", "If the cylinder lifts the load, more force is needed, and the load may need to be held if air is lost."),
      options: [g(locale, "Horisontell rörelse", "Horizontal movement"), g(locale, "Vertikal, lyfter lasten", "Vertical, lifting the load"), g(locale, "Vertikal, trycker nedåt", "Vertical, pushing down"), g(locale, "Sned, i vinkel", "At an angle")] });
  }
  if (needsVerticalLoad(text) && !/får\s+inte\s+falla|hållas?\s+kvar|stångbroms|fallskydd|broms/i.test(text)) {
    q.push({ id: "lasthallning", type: "choice",
      label: g(locale, "Om tryckluften försvinner, får lasten sjunka ned?", "If the compressed air is lost, may the load drop?"),
      hint: g(locale, "Ska lasten stå kvar läggs en stångbroms till som håller den mekaniskt.", "If the load must stay put, a rod lock is added that holds it mechanically."),
      options: [g(locale, "Nej, lasten får inte falla ned", "No — load holding required, it must not drop"), g(locale, "Ja, det gör inget", "Yes, that is fine")] });
  }
  if (!k.takt) {
    q.push({ id: "takt", type: "choice",
      label: g(locale, "Hur ofta görs rörelsen?", "How often is the movement made?"),
      hint: g(locale, "Täta rörelser kräver tåligare cylindrar och ofta dämpning i ändlägena.", "Frequent movements need more durable cylinders and often end-position cushioning."),
      options: [g(locale, "Några gånger i timmen eller mer sällan", "A few times an hour or less"), g(locale, "Upp till 10 slag/min", "Up to 10 strokes/min"), g(locale, "10–59 slag/min", "10–59 strokes/min"), g(locale, "60 slag/min eller mer", "60 strokes/min or more")] });
  }
  if (positionering && !k.precision) {
    q.push({ id: "precision", type: "choice",
      label: g(locale, "Hur exakt måste den stanna?", "How precisely must it stop?"),
      hint: g(locale, "En vanlig cylinder stannar exakt i sina ändlägen. Ska den stanna exakt mitt i rörelsen behövs oftast en elektrisk axel.", "A standard cylinder stops precisely at its end positions. Stopping precisely mid-travel usually needs an electric axis."),
      options: [g(locale, "Bara i ändlägena", "Only at the end positions"), "±1 mm", "±0,1 mm", g(locale, "±0,02 mm eller bättre", "±0.02 mm or better")] });
  }
  // En elaxel vet själv var den är; ändlägesgivare är en fråga för cylindrar.
  if (!k.givare && !arElektrisk(text)) {
    q.push({ id: "andlagesavkanning", type: "choice",
      label: g(locale, "Behöver styrsystemet veta när rörelsen är klar?", "Does the control system need to know when the movement is done?"),
      hint: g(locale, "Då sitter en givare på cylindern som känner av kolvens magnet i ändläget.", "Then a sensor on the cylinder detects the piston magnet at the end position."),
      options: [g(locale, "Ja, i båda ändlägena", "Yes, at both end positions"), g(locale, "Ja, i ett ändläge", "Yes, at one end position"), g(locale, "Nej", "No")] });
  }
  if (!k.styrning) {
    q.push({ id: "manovrering", type: "choice",
      label: g(locale, "Hur ska rörelsen startas?", "How is the movement started?"),
      hint: g(locale, "Avgör om det behövs en magnetventil eller en handmanövrerad ventil.", "Determines whether a solenoid valve or a manually operated valve is needed."),
      options: [g(locale, "Från en PLC", "From a PLC"), g(locale, "Med tryckknapp eller handventil", "With a push button or hand valve")] });
  }
  if (!k.miljo) {
    q.push({ id: "miljo", type: "choice",
      label: g(locale, "I vilken miljö sitter den?", "What environment will it be in?"),
      hint: g(locale, "Damm, vatten och väder påverkar val av tätningar och material.", "Dust, water and weather affect the choice of seals and materials."),
      options: [g(locale, "Vanlig fabrik eller verkstad", "Ordinary factory or workshop"), g(locale, "Dammigt eller smutsigt", "Dusty or dirty"), g(locale, "Högtrycksspolas eller tvättas", "High-pressure washed"), g(locale, "Utomhus", "Outdoors")] });
  }
  return q;
}

/**
 * Frågor som avgör valet och därför alltid ställs när de är öppna, oavsett
 * vad modellen hittade på: utan slaglängd, last eller greppsätt går det inte
 * att välja, och en lyft last utan svar om lasthållning ger fel stycklista.
 */
const ALLTID = new Set([
  "slaglangd_mm", "slag_x_sidled_mm", "slag_z_hojd_mm", "last_kg", "kraft_n", "greppsatt", "lasthallning",
  "luft_anslutning", "luft_flode", "ventil_uppgift", "givare_uppgift", "slang_dimension", "korrosion",
]);

/**
 * Slutliga frågor: de avgörande bankfrågorna som modellen inte täckte först,
 * sedan modellens rensade frågor, och banken igen tills det finns minst fyra.
 * Högst sex.
 */
export function slutligaFragor(fran_modellen: Fraga[], text: string, locale: string): Fraga[] {
  const bank = reservfragor(text, locale);
  // Där banken har en egen fråga om samma ämne ersätter den modellens: bankens
  // alternativ är prövade mot detektorerna i nästa steg, modellens inte
  // ("Elektrisk relä" som ändlägesgivare, anslutningar utan G1/4).
  const bankPerAmne = new Map(bank.map((q) => [amne(q) ?? q.id, q]));
  const rensade = rensaFragor(fran_modellen, text, locale).map((q) => {
    const a = amne(q);
    return (a && bankPerAmne.get(a)) || q;
  });
  const tackta = new Set(rensade.map((q) => amne(q)).filter(Boolean) as string[]);
  const forst = bank.filter((q) => ALLTID.has(q.id) && !tackta.has(amne(q) ?? ""));
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
export function reservsammanfattning(text: string, locale: string): string {
  const typ = forfragningstyp(text);
  const sv: Record<Forfragan, string> = {
    rorelse: "Några frågor till för att välja rätt cylinder eller axel och det som hör till.",
    luftberedning: "Några frågor till för att välja rätt luftberedning.",
    ventil: "Några frågor till för att välja rätt ventil.",
    givare: "Några frågor till för att välja rätt givare.",
    slang: "Några frågor till för att välja rätt slang och kopplingar.",
  };
  const en: Record<Forfragan, string> = {
    rorelse: "A few more questions to choose the right cylinder or axis and what goes with it.",
    luftberedning: "A few more questions to choose the right air preparation unit.",
    ventil: "A few more questions to choose the right valve.",
    givare: "A few more questions to choose the right sensor.",
    slang: "A few more questions to choose the right tubing and fittings.",
  };
  return locale === "sv" ? sv[typ] : en[typ];
}
