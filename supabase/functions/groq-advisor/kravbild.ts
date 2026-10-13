/**
 * Kravbilden: kraven i en beskrivning som FÖREMÅL + EGENSKAP + VÄRDE, med
 * enhet, ursprung och bekräftelse.
 *
 * Varför: motorns detektorer (signals.ts) svarar på "vilken komponent ska
 * väljas" och läser därför ut ett tal per storhet -- den första hastigheten,
 * den första vikten. Det räcker inte för en maskin med flera föremål.
 * Lådsorteringstestet (2026-10-13) visade felet: "Bandet går med 0,25 m/s"
 * blev utskjutarens hastighet, "0,5–3 kg" blev 3 kg, och "skjutas av i sidled
 * 350 mm" blev en slaglängd som ingen sagt.
 *
 * Här knyts varje värde till föremålet det står närmast i meningen
 * (transportbandet, utskjutaren, produkten, matningen ...). Står det inte vid
 * något föremål blir det en OSÄKER TOLKNING som användaren avgör -- inget
 * värde fördelas tyst på alla aktuatorer. Intervall bevaras som intervall;
 * ett dimensionerande värde (intervallets max) är ett eget, härlett krav med
 * sitt lastfall, och ersätter aldrig originalet.
 *
 * Ren logik utan nätverk och utan språkmodell, så att webbläsaren, motorn och
 * PLC-delen läser samma beskrivning på samma sätt. Provas i kravbild.test.ts.
 */

export type ObjektTyp =
  | "maskin" | "produkt" | "transportband" | "aktuator" | "kontrollstation"
  | "mottagning" | "styrsystem" | "matning";

export interface KravObjekt {
  id: string;
  typ: ObjektTyp;
}

/** Varifrån uppgiften kommer. Bekräftelsen är en egen sak (se Bekraftelse). */
export type Ursprung = "anvandare" | "dokument" | "katalog" | "berakning" | "ai" | "antagande";

/**
 * Om en människa har godtagit uppgiften. En tolkning av en fritext är
 * systemets, inte användarens, så den börjar som ej bekräftad även när
 * ursprunget är användarens egen text.
 */
export type Bekraftelse = "ej_bekraftat" | "bekraftat" | "avvisat" | "inaktuellt";

export interface Krav {
  /** Stabilt id: "krav-<objekt>-<egenskap>". Ändras inte när värdet ändras. */
  id: string;
  objektId: string;
  egenskap: Egenskap;
  /** Ett tal ... */
  varde?: number;
  /** ... eller ett intervall (bevaras alltid som intervall) ... */
  intervall?: { min: number; max: number };
  /** ... eller en text, när kravet inte är ett tal. */
  text?: string;
  enhet?: string;
  /** "max", "minst", "upp till": hur talet ska läsas. */
  grans?: "max" | "minst" | "exakt";
  kravtyp: "obligatoriskt" | "onskemal";
  ursprung: Ursprung;
  kalla: { typ: "beskrivning" | "svar" | "harlett"; utdrag: string; svarId?: string };
  bekraftelse: Bekraftelse;
  /** För härledda krav: hur värdet togs fram (lastfallet). */
  metod?: string;
}

export type Egenskap =
  | "hastighet" | "massa" | "dimensionerande_massa" | "matt" | "flode" | "slaglangd"
  | "sidoforflyttning" | "kraft" | "tryck" | "spanning" | "befintlig" | "io" | "modell"
  | "drifttid" | "miljo" | "hantering" | "avstand" | "signal" | "takt" | "cykeltid"
  | "noggrannhet" | "temperatur" | "minsta_avstand" | "vid_utskjutning" | "utsorteringar_i_foljd"
  | "rorlig_massa" | "riktning" | "sakerhet" | "svar";

/** En tolkning systemet inte kan avgöra själv. Avgörs av användaren. */
export interface OsakerTolkning {
  id: string;
  /** Kravet tolkningen gäller. */
  kravId: string;
  fraga: { sv: string; en: string };
  alternativ: Array<{ id: string; sv: string; en: string }>;
  /** Alternativet som gäller tills användaren valt. */
  forval: string;
}

export interface SaknadUppgift {
  id: string;
  objektId: string;
  egenskap: string;
  sv: string;
  en: string;
  varfor: { sv: string; en: string };
}

export type Tillampning = "sortering_utskjutning" | "allman";

export interface Kravbild {
  tillampning: Tillampning;
  objekt: KravObjekt[];
  krav: Krav[];
  osakra: OsakerTolkning[];
  saknas: SaknadUppgift[];
}

/**
 * Användarens beslut, nycklade på tolkningens eller kravets id:
 *   "tolkning-<krav-id>": valt alternativ i en osäker tolkning
 *   "<krav-id>": "bekraftat" | "avvisat"
 *   "alla": "bekraftat" när hela tolkningen godtagits
 * Bärs i maskinbyggarens svar med prefixet "tolkning:" (se delaSvar).
 */
export type Tolkningsbeslut = Record<string, string>;

export const TOLKNINGSPREFIX = "tolkning:";

/**
 * Skiljer tolkningsbesluten från de vanliga svaren. Motorns detektorer läser
 * svaren som text; ett beslut som "transportband" får aldrig nå dem som om
 * kunden skrivit ordet.
 */
export function delaSvar(alla: Record<string, string>): { svar: Record<string, string>; tolkning: Tolkningsbeslut } {
  const svar: Record<string, string> = {};
  const tolkning: Tolkningsbeslut = {};
  for (const [k, v] of Object.entries(alla ?? {})) {
    if (k.startsWith(TOLKNINGSPREFIX)) tolkning[k.slice(TOLKNINGSPREFIX.length)] = String(v);
    else svar[k] = v;
  }
  return { svar, tolkning };
}

// ── Ordförråd ────────────────────────────────────────────────────────────────
// Ett värde knyts till föremålet vars ord står NÄRMAST före det i meningen.
// "knuffar kartonger på transportband, stroke 200 mm, 400 mm/s": närmast före
// 400 mm/s står "stroke", alltså aktuatorn -- inte transportbandet, trots att
// ordet finns i samma mening (regressionstest T1 i test-advisor.sh).
const FORMAL: Array<{ typ: ObjektTyp; re: RegExp }> = [
  { typ: "transportband", re: /\b(?:transportband\w*|transportör\w*|band(?:et|en|ets)?|conveyor\w*|förderband\w*|cinta\w*)\b/gi },
  { typ: "mottagning", re: /\b(?:rullbord\w*|rullban\w*|mottag\w*|ränna\w*|roller\s+table\w*)\b/gi },
  { typ: "kontrollstation", re: /\b(?:kontrollstation\w*|kamera\w*|vision\w*|inspektion\w*|inspection\w*)\b/gi },
  { typ: "aktuator", re: /\b(?:utskjut\w*|cylinder\w*|aktuator\w*|actuator\w*|axel\w*|axis|slid\w*|kolv\w*|stroke\w*|slag(?:et|längd\w*|hastighet\w*)?|rörelse\w*|förflyttning\w*|skjut\w*|knuff\w*|lyft\w*|pusher\w*|gripdon\w*|griparm\w*)\b/gi },
  { typ: "produkt", re: /\b(?:låd\w*|kartong\w*|produkt\w*|detalj\w*|paket\w*|kolli\w*|box(?:ar|arna|es)?|artikl\w*|products?|parts?|crates?)\b/gi },
];

const SAKKAR_ORD = /\bsortera\s+ut\b|\butsorter\w*|\bskjut\w*\s+av\b|\butskjut\w*|\bpush(?:er|es|ing)?\s+off\b|\breject\w*/i;

function tal(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", "."));
}

function formatTal(n: number): string {
  return String(Math.round(n * 1000) / 1000).replace(".", ",");
}

interface Mening { text: string; start: number }

function meningar(text: string): Mening[] {
  const ut: Mening[] = [];
  const re = /[^.!?;\n]+(?:[.!?;\n]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    // Ett decimaltal ("0.25") delar inte meningen.
    ut.push({ text: m[0], start: m.index });
  }
  // Slå ihop delar som bara skildes av en decimalpunkt.
  const ihop: Mening[] = [];
  for (const del of ut) {
    const forra = ihop[ihop.length - 1];
    if (forra && /\d\.$/.test(forra.text) && /^\d/.test(del.text)) {
      forra.text += del.text;
    } else ihop.push({ ...del });
  }
  return ihop;
}

/** Föremålet vars ord står närmast före position `pos` i meningen, annars närmast efter. */
function narmasteFormal(mening: string, pos: number): ObjektTyp | null {
  let basta: { typ: ObjektTyp; slut: number } | null = null;
  for (const f of FORMAL) {
    f.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = f.re.exec(mening))) {
      const slut = m.index + m[0].length;
      if (slut <= pos && (!basta || slut > basta.slut)) basta = { typ: f.typ, slut };
    }
  }
  if (basta) return basta.typ;
  // Inget föremål före talet: "0,25 m/s på bandet".
  let efter: { typ: ObjektTyp; start: number } | null = null;
  for (const f of FORMAL) {
    f.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = f.re.exec(mening))) {
      if (m.index >= pos && m.index - pos <= 25 && (!efter || m.index < efter.start)) efter = { typ: f.typ, start: m.index };
    }
  }
  return efter?.typ ?? null;
}

/**
 * Föremålet en hastighet i texten gäller, eller null om texten inte säger det.
 * Används av motorns extractSpeedMs: en hastighet som hör till
 * transportbandet, produkten eller mottagningen är inte aktuatorns.
 */
export function hastighetensFormal(text: string, index: number): ObjektTyp | null {
  for (const m of meningar(text)) {
    if (index >= m.start && index < m.start + m.text.length) return narmasteFormal(m.text, index - m.start);
  }
  return null;
}

/** Kravets id för en hastighet. Samma i kravbilden och i motorns extractSpeedMs,
 *  så att ett tolkningsbeslut om "0,8 m/s" gäller båda. */
export function hastighetsKravId(varde: number): string {
  return `krav-hastighet-${formatTal(Math.round(varde * 1000) / 1000).replace(",", "_")}`;
}

// ── Tolkningen ──────────────────────────────────────────────────────────────

const OBJEKT_ORDNING: ObjektTyp[] = ["maskin", "produkt", "transportband", "aktuator", "kontrollstation", "mottagning", "styrsystem", "matning"];

export function tolkaKravbild(beskrivning: string, svarIn: Record<string, string> = {}, beslut: Tolkningsbeslut = {}): Kravbild {
  const text = (beskrivning ?? "").trim();
  const svar = svarIn ?? {};
  const krav: Krav[] = [];
  const osakra: OsakerTolkning[] = [];
  const objektSomFinns = new Set<ObjektTyp>(["maskin"]);
  const bekraftatAllt = beslut["alla"] === "bekraftat";

  const lagg = (k: Omit<Krav, "id" | "bekraftelse" | "kravtyp"> & { kravtyp?: Krav["kravtyp"]; id?: string }) => {
    const objektTyp = k.objektId as ObjektTyp;
    objektSomFinns.add(objektTyp);
    let id = k.id ?? `krav-${k.objektId}-${k.egenskap}`;
    let n = 2;
    while (krav.some((x) => x.id === id)) id = `${k.id ?? `krav-${k.objektId}-${k.egenskap}`}-${n++}`;
    const egetBeslut = beslut[id];
    const bekraftelse: Bekraftelse = egetBeslut === "avvisat" ? "avvisat"
      : egetBeslut === "bekraftat" || bekraftatAllt ? "bekraftat"
      : k.ursprung === "berakning" ? "ej_bekraftat"
      : "ej_bekraftat";
    krav.push({ kravtyp: "obligatoriskt", ...k, id, bekraftelse });
    return id;
  };

  const tillampning: Tillampning = SAKKAR_ORD.test(text) && FORMAL[0].re.test(text) ? "sortering_utskjutning" : "allman";
  FORMAL[0].re.lastIndex = 0;

  for (const men of meningar(text)) {
    const s = men.text;
    const utdrag = s.trim().replace(/\s+/g, " ");

    // Hastigheter: m/s, mm/s, m/min.
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(mm\/s|m\/s|m\/min)\b/gi)) {
      const enhet = m[2].toLowerCase();
      const varde = enhet === "mm/s" ? tal(m[1]) / 1000 : enhet === "m/min" ? tal(m[1]) / 60 : tal(m[1]);
      const formal = narmasteFormal(s, m.index ?? 0);
      const forvalt: ObjektTyp = formal === "transportband" || formal === "produkt" || formal === "mottagning" ? (formal === "produkt" ? "transportband" : formal) : "aktuator";
      const kravId = hastighetsKravId(varde);
      const beslutat = beslut[`tolkning-${kravId}`] as ObjektTyp | undefined;
      const objekt: ObjektTyp = beslutat && OBJEKT_ORDNING.includes(beslutat) ? beslutat : forvalt;
      const minst = /\bminst\b|\bat least\b|\bmindestens\b/i.test(s.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0));
      lagg({
        id: kravId, objektId: objekt, egenskap: "hastighet", varde: Math.round(varde * 1000) / 1000, enhet: "m/s",
        grans: minst ? "minst" : undefined,
        ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag },
      });
      // Står hastigheten inte uttryckligen vid ett föremål är tolkningen
      // systemets gissning, och den ska synas som en fråga.
      if ((!formal || formal === "produkt") && !beslutat) {
        osakra.push({
          id: `tolkning-${kravId}`, kravId,
          fraga: {
            sv: `Vilken del avser ${formatTal(varde)} m/s?`,
            en: `Which part does ${String(varde)} m/s refer to?`,
          },
          alternativ: [
            { id: "aktuator", sv: "Aktuatorns rörelse", en: "The actuator's motion" },
            { id: "transportband", sv: "Transportbandet", en: "The conveyor" },
          ],
          forval: forvalt,
        });
      }
    }

    // Massa: intervall bevaras ("0,5–3 kg"), annars ett tal.
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:kg\s*)?(?:[–—-]|till|to)\s*(\d+(?:[.,]\d+)?)\s*kg\b/gi)) {
      const min = tal(m[1]);
      const max = tal(m[2]);
      if (!(max > min)) continue;
      const objekt: ObjektTyp = /\b(?:låd|kartong|produkt|detalj|paket|kolli|box|artikl|product|part|crate)/i.test(s) ? "produkt" : "produkt";
      const id = lagg({ objektId: objekt, egenskap: "massa", intervall: { min, max }, enhet: "kg", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
      lagg({
        objektId: objekt, egenskap: "dimensionerande_massa", varde: max, enhet: "kg",
        ursprung: "berakning", kalla: { typ: "harlett", utdrag: id },
        metod: "Största värdet i det angivna intervallet; intervallet står kvar som krav.",
      });
    }
    if (!krav.some((k) => k.egenskap === "massa" && k.kalla.utdrag === utdrag)) {
      for (const m of s.matchAll(/(?<![\d.,–—-])(\d+(?:[.,]\d+)?)\s*kg\b(?!\s*\/)/gi)) {
        const forre = s.slice(0, m.index ?? 0);
        if (/[–—-]\s*$|\btill\s*$/.test(forre)) continue; // del av ett intervall
        const max = /\b(?:max|högst|upp till|up to)\s*$/i.test(forre.slice(-12));
        lagg({ objektId: "produkt", egenskap: "massa", varde: tal(m[1]), enhet: "kg", grans: max ? "max" : undefined, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
      }
    }

    // Mått: "300 × 200 × 150 mm".
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)(?:\s*[×xX*]\s*(\d+(?:[.,]\d+)?))?\s*mm\b/g)) {
      const delar = [m[1], m[2], m[3]].filter(Boolean).map((d) => formatTal(tal(d!)));
      const max = /\b(?:max|högst|upp till|up to)\b/i.test(s.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0));
      lagg({ objektId: "produkt", egenskap: "matt", text: delar.join(" × "), enhet: "mm", grans: max ? "max" : undefined, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Flöde: "15 lådor per minut". Passerande produkter -- inte utsorteringar.
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(låd\w*|kartong\w*|produkt\w*|detalj\w*|st|stycken|paket|cykler|slag|items?|parts?|boxes|crates)?\s*(?:per|\/|i|a)\s*(minut|min|timme|tim|h|sekund|s)\b/gi)) {
      const per = /^(?:minut|min)$/i.test(m[3]) ? "/min" : /^(?:timme|tim|h)$/i.test(m[3]) ? "/h" : "/s";
      const vad = (m[2] ?? "").toLowerCase();
      const arCykler = /^(?:cykler|slag)$/.test(vad);
      // Passerande produkter räknas i styck, en aktuators takt i cykler.
      const enhet = (arCykler ? "cykler" : "st") + per;
      const uppTill = /\b(?:upp till|max|högst|up to)\s*$/i.test(s.slice(0, m.index ?? 0).slice(-12));
      lagg({
        objektId: arCykler ? "aktuator" : "produkt", egenskap: arCykler ? "takt" : "flode",
        varde: tal(m[1]), enhet, grans: uppTill ? "max" : undefined,
        ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag },
      });
    }

    // Slaglängd uttryckligen, eller en önskad förflyttning av produkten.
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*mm\b(?!\s*\/)/gi)) {
      const fore = s.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      const efter = s.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 20);
      if (/[×xX*]\s*$/.test(fore) || /^\s*[×xX*]/.test(efter)) continue; // del av mått
      if (/[±]\s*$/.test(fore) || /(?:noggrannhet|repeterbarhet|tolerans|precision|accuracy)\W*$/i.test(fore)) {
        lagg({ objektId: "aktuator", egenskap: "noggrannhet", varde: tal(m[1]), enhet: "mm", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
        continue;
      }
      const arSlag = /\b(?:slaglängd|slag|stroke|hub)\w*\W*$/i.test(fore) || /^\s*(?:slag|stroke)/i.test(efter);
      const arForflyttning = /\b(?:sidled|i sidled|sidoförflytt\w*|förflytt\w*|flytta\w*|skjut\w*|sideways|sidewards|laterally)\b/i.test(fore + " " + efter);
      if (arSlag) {
        lagg({ objektId: "aktuator", egenskap: "slaglangd", varde: tal(m[1]), enhet: "mm", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
      } else if (arForflyttning) {
        const kravId = lagg({ objektId: "produkt", egenskap: "sidoforflyttning", varde: tal(m[1]), enhet: "mm", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
        if (beslut[`tolkning-${kravId}`] !== "sidoforflyttning" && beslut[`tolkning-${kravId}`] !== "slaglangd") {
          osakra.push({
            id: `tolkning-${kravId}`, kravId,
            fraga: {
              sv: `Är ${formatTal(tal(m[1]))} mm produktens önskade sidoförflyttning eller aktuatorns slaglängd?`,
              en: `Is ${String(tal(m[1]))} mm the product's required sideways travel or the actuator's stroke?`,
            },
            alternativ: [
              { id: "sidoforflyttning", sv: "Produktens förflyttning (aktuatorns slag kan avvika)", en: "The product's travel (the stroke may differ)" },
              { id: "slaglangd", sv: "Aktuatorns slaglängd", en: "The actuator's stroke" },
            ],
            forval: "sidoforflyttning",
          });
        } else if (beslut[`tolkning-${kravId}`] === "slaglangd") {
          // Användaren har sagt att talet är slaglängden.
          const k = krav.find((x) => x.id === kravId)!;
          k.objektId = "aktuator";
          k.egenskap = "slaglangd";
          k.bekraftelse = "bekraftat";
          objektSomFinns.add("aktuator");
        }
      }
    }

    // Kraft som kunden anger.
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(kN|N)\b(?!\s*m)/g)) {
      const n = m[2] === "kN" ? tal(m[1]) * 1000 : tal(m[1]);
      lagg({ objektId: "aktuator", egenskap: "kraft", varde: n, enhet: "N", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Matning: tryckluft och spänning.
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*bar\b/gi)) {
      lagg({ objektId: "matning", egenskap: "tryck", varde: tal(m[1]), enhet: "bar", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*V\s*(DC|AC|likström|växelström)?\b/g)) {
      const typ = m[2] ? (/^(?:DC|likström)$/i.test(m[2]) ? " DC" : " AC") : "";
      lagg({ objektId: "matning", egenskap: "spanning", text: `${formatTal(tal(m[1]))} V${typ}`, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Styrsystem.
    const plc = s.match(/\b(befintlig|existerande|nuvarande|existing|vorhandene?)\s+(plc|styrsystem\w*|controller|steuerung|sps)\b/i);
    if (plc) lagg({ objektId: "styrsystem", egenskap: "befintlig", text: "Befintligt styrsystem", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    if (/\bdigital\w*\s+(?:i\/o|io|in-?\s*och\s*utgångar|ingångar|inputs?)/i.test(s)) {
      lagg({ objektId: "styrsystem", egenskap: "io", text: "Digitala I/O", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }
    const modell = s.match(/\b(S7-\d{3,4}\w*|CompactLogix|ControlLogix|CX\d{4}|NX1P\w*|NJ\d{3}\w*|iQ-[RF]|Logo!?\s*\d*|FX\d\w*)\b/i);
    if (modell) lagg({ objektId: "styrsystem", egenskap: "modell", text: modell[1], ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });

    // Drifttid.
    const drift = s.match(/(\d+(?:[.,]\d+)?)\s*(?:timmar|tim|h)\s*(?:per|\/|om|a)\s*(?:dag|dygn|day)\b/i);
    if (drift) lagg({ objektId: "maskin", egenskap: "drifttid", varde: tal(drift[1]), enhet: "h/dag", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    if (/\b24\s*\/\s*7\b|dygnet runt|around the clock/i.test(s)) {
      lagg({ objektId: "maskin", egenskap: "drifttid", text: "Dygnet runt (24/7)", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }
    const skift = s.match(/(\d)\s*-?\s*skift/i);
    if (skift) lagg({ objektId: "maskin", egenskap: "drifttid", text: `${skift[1]}-skift`, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });

    // Miljö: orden som står, inte en klassning.
    // "aluminiumdamm" ska med (ordgränsen ligger mitt i ordet), "dammfri" inte.
    const miljo = [...s.matchAll(/\b(torr\w*|fukt\w*|våt\w*|(?:lätt|mycket|mkt)\s+damm\w*|\w*damm(?!fri|sug)\w*|smuts\w*|utomhus|tvätt\w*|spol\w*|livsmedel\w*|kyl\w*|frys\w*|explosi\w*|atex)\b/gi)].map((x) => x[1].toLowerCase());
    if (miljo.length && /miljö|environment|damm|torr|fukt|utomhus|tvätt|spol|livsmedel|kyl|frys|atex/i.test(s)) {
      const unika = [...new Set(miljo)];
      lagg({ objektId: "maskin", egenskap: "miljo", text: unika.join(", "), ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Rörelseriktning: avgör broms, lasthållning och säkerhetsgranskning.
    if (/\b(?:lodrät\w*|vertikal\w*|lyft\w*|hissa\w*|sänk\w*|upp och ned|vertical\w*|lift\w*)\b/i.test(s)) {
      lagg({ objektId: "aktuator", egenskap: "riktning", text: "Lodrät (lyft)", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    } else if (/\b(?:horisontell\w*|vågrät\w*|i sidled|sidled\w*|horizontal\w*|sideways)\b/i.test(s)) {
      lagg({ objektId: "aktuator", egenskap: "riktning", text: "Vågrät", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Säkerhetskrav som kunden angett. Blir granskningsposter, aldrig logik.
    // Samma mönster som motorns angivenSakerhetsniva: "PLC" får aldrig läsas
    // som PL c (felet fanns i motorn till 2026-10-08 och i en första version här).
    const pl = /\bPL\s?([de])\b|\bPL\s([a-c])\b/i.exec(s);
    const sil = /\bSIL\s?([1-4])\b/i.exec(s);
    const kat = /\bkategori\s?([1-4B])\b/i.exec(s);
    const sak = pl ? `PL ${(pl[1] ?? pl[2]).toLowerCase()}` : sil ? `SIL ${sil[1]}` : kat ? `Kategori ${kat[1].toUpperCase()}` : null;
    if (sak) lagg({ objektId: "maskin", egenskap: "sakerhet", text: sak, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    else if (/\b(?:nödstopp\w*|säkerhetsfunktion\w*|skyddsgrind\w*|ljusridå\w*|emergency stop|safety function\w*)\b/i.test(s)) {
      lagg({ objektId: "maskin", egenskap: "sakerhet", text: "Säkerhetsfunktion nämnd", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Temperatur.
    for (const m of s.matchAll(/([−-]?\d+(?:[.,]\d+)?)\s*°\s*C\b/g)) {
      lagg({ objektId: "maskin", egenskap: "temperatur", varde: tal(m[1].replace("−", "-")), enhet: "°C", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Cykeltid i texten.
    const cykel = s.match(/\b(?:cykeltid|takttid|cycle time)\D{0,12}(\d+(?:[.,]\d+)?)\s*(?:s|sek\w*|sec\w*)\b/i);
    if (cykel) lagg({ objektId: "aktuator", egenskap: "cykeltid", varde: tal(cykel[1]), enhet: "s", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });

    // Hantering av produkten.
    const hantering = s.match(/\butan att\s+([^,.;]*?(?:välta|skad|repa|tappa|kantra|falla)[^,.;]*)/i);
    if (hantering) lagg({ objektId: "produkt", egenskap: "hantering", text: `Utan att ${hantering[1].trim()}`, ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });

    // Produktavstånd.
    if (/\bvarierande\s+(?:avstånd|mellanrum|lucka|luckor)|\bvarying\s+(?:gaps?|spacing|distance)/i.test(s)) {
      lagg({ objektId: "produkt", egenskap: "avstand", text: "Varierande", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Signal från en kontrollstation.
    if (/\b(?:kontrollstation\w*|kamera\w*|vision\w*|inspektion\w*)\b/i.test(s) && /\bsignal\w*/i.test(s)) {
      lagg({ objektId: "kontrollstation", egenskap: "signal", text: "Signal för utsortering", ursprung: "anvandare", kalla: { typ: "beskrivning", utdrag } });
    }

    // Mottagningen finns som föremål även utan tal.
    if (/\b(?:rullbord\w*|rullban\w*|mottagande\s+\w+|ränna\w*)\b/i.test(s)) objektSomFinns.add("mottagning");
    if (FORMAL[0].re.test(s)) objektSomFinns.add("transportband");
    FORMAL[0].re.lastIndex = 0;
  }

  // Svaren på följdfrågorna, med frågans id som källa.
  for (const [id, v] of Object.entries(svar)) {
    const varde = String(v ?? "").trim();
    if (!varde) continue;
    const vetInte = /^(?:vet inte|don't know|weiß nicht|no lo sé|lämnas öppen|öppen)$/i.test(varde);
    const k = svarTillKrav(id, varde);
    if (vetInte) continue; // en obesvarad fråga är en saknad uppgift, inget krav
    if (k) {
      lagg({ ...k, ursprung: "anvandare", kalla: { typ: "svar", utdrag: varde, svarId: id } });
    } else {
      lagg({ objektId: "maskin", egenskap: "svar", text: varde, ursprung: "anvandare", kalla: { typ: "svar", utdrag: varde, svarId: id }, id: `krav-svar-${id}` });
    }
  }

  const objekt: KravObjekt[] = OBJEKT_ORDNING.filter((t) => objektSomFinns.has(t)).map((typ) => ({ id: typ, typ }));
  const saknas = saknadeUppgifter(tillampning, krav, objekt, svar);
  return { tillampning, objekt, krav, osakra, saknas };
}

/** Kända följdfrågor -> föremål och egenskap. Okända blir "svar" på maskinen. */
function svarTillKrav(id: string, v: string): Omit<Krav, "id" | "bekraftelse" | "kravtyp" | "ursprung" | "kalla"> | null {
  const n = (() => {
    const t = [...v.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => tal(m[0]));
    return t.length ? t[t.length - 1] : NaN;
  })();
  const intervall = v.match(/(\d+(?:[.,]\d+)?)\s*(?:[–—-]|till)\s*(\d+(?:[.,]\d+)?)/);
  if (/(^|_)(last|vikt|weight|load|massa?|mass)(_|$)|_kg$/i.test(id) && !/rorlig|rörlig/i.test(id)) {
    return intervall
      ? { objektId: "produkt", egenskap: "massa", intervall: { min: tal(intervall[1]), max: tal(intervall[2]) }, enhet: "kg" }
      : Number.isFinite(n) ? { objektId: "produkt", egenskap: "massa", varde: n, enhet: "kg" } : null;
  }
  if (/slag|stroke/i.test(id) && Number.isFinite(n)) return { objektId: "aktuator", egenskap: "slaglangd", varde: n, enhet: "mm" };
  if (/hastighet|speed/i.test(id) && Number.isFinite(n)) {
    const mm = /mm\s*\/\s*s/i.test(v) || /_mm_?s$/i.test(id);
    return { objektId: "aktuator", egenskap: "hastighet", varde: mm ? n / 1000 : n, enhet: "m/s" };
  }
  if (/(^|_)takt|cykler|slag_per/i.test(id)) return { objektId: "aktuator", egenskap: "takt", text: v };
  if (/tryck|pressure/i.test(id) && Number.isFinite(n)) return { objektId: "matning", egenskap: "tryck", varde: n, enhet: "bar" };
  if (/minsta_?avstand/i.test(id) && Number.isFinite(n)) return { objektId: "produkt", egenskap: "minsta_avstand", varde: n, enhet: "mm" };
  if (/produktavstand/i.test(id)) return { objektId: "produkt", egenskap: "avstand", text: v };
  if (/utskjutningstid|forflyttningstid/i.test(id) && Number.isFinite(n)) return { objektId: "aktuator", egenskap: "cykeltid", varde: n, enhet: "s" };
  if (/band_vid_utskjutning/i.test(id)) return { objektId: "transportband", egenskap: "vid_utskjutning", text: v };
  if (/utsorteringar_i_foljd/i.test(id)) return { objektId: "produkt", egenskap: "utsorteringar_i_foljd", text: v };
  if (/rorlig_massa/i.test(id) && Number.isFinite(n)) return { objektId: "aktuator", egenskap: "rorlig_massa", varde: n, enhet: "kg" };
  return null;
}

/**
 * Det som behövs för nästa beslut och som beskrivningen inte säger. Fylls
 * ALDRIG med ett påhittat värde; listan är vad användaren eller ingenjören
 * ska ta ställning till.
 */
function saknadeUppgifter(tillampning: Tillampning, krav: Krav[], objekt: KravObjekt[], svar: Record<string, string>): SaknadUppgift[] {
  const finns = (obj: string, eg: string) => krav.some((k) => k.objektId === obj && k.egenskap === eg && k.bekraftelse !== "avvisat");
  const besvarad = (re: RegExp) => Object.entries(svar).some(([id, v]) => re.test(id) && !/^(?:vet inte|don't know|lämnas öppen|öppen)$/i.test(String(v).trim()));
  const ut: SaknadUppgift[] = [];
  const s = (u: SaknadUppgift) => { if (!ut.some((x) => x.id === u.id)) ut.push(u); };
  const harObjekt = (t: ObjektTyp) => objekt.some((o) => o.typ === t);

  if (tillampning === "sortering_utskjutning") {
    if (!finns("aktuator", "hastighet") && !besvarad(/utskjutningstid|hastighet/i)) s({
      id: "saknas-utskjutarhastighet", objektId: "aktuator", egenskap: "hastighet",
      sv: "Utskjutarens hastighet eller utskjutningstid", en: "Pusher speed or push time",
      varfor: { sv: "Bandets hastighet säger hur fort lådan kommer, inte hur fort utskjutaren måste röra sig. Tiden avgör kraften, dämpningen och om lådan hinner ut innan nästa kommer.", en: "The conveyor speed says how fast the box arrives, not how fast the pusher must move. The time decides force, cushioning and whether the box clears before the next one." },
    });
    if (!besvarad(/aterg|återg|cykeltid|utskjutningstid/i)) s({
      id: "saknas-cykeltid", objektId: "aktuator", egenskap: "cykeltid",
      sv: "Tillgänglig tid för utskjutning och återgång", en: "Time available for push and return",
      varfor: { sv: "Utskjutaren måste vara tillbaka innan nästa låda når den. 15 passerande lådor per minut är inte samma sak som 15 utsorteringar per minut.", en: "The pusher must be back before the next box arrives. 15 passing boxes per minute is not 15 rejects per minute." },
    });
    if (!besvarad(/rorelseprofil|profil/i)) s({
      id: "saknas-rorelseprofil", objektId: "aktuator", egenskap: "rorelseprofil",
      sv: "Rörelseprofil (mjukstart, dämpning i ändläge)", en: "Motion profile (soft start, end cushioning)",
      varfor: { sv: "Lådan får inte välta. Hur hårt utskjutaren accelererar och bromsar avgör det mer än kraften.", en: "The box must not tip over. How hard the pusher accelerates and brakes decides that more than the force." },
    });
    if (!besvarad(/minsta_?avstand|produktavstand/i)) s({
      id: "saknas-minsta-avstand", objektId: "produkt", egenskap: "minsta_avstand",
      sv: "Minsta avstånd mellan lådorna", en: "Minimum gap between boxes",
      varfor: { sv: "Med varierande avstånd är det minsta avståndet som bestämmer hur snabbt utskjutaren måste vara tillbaka.", en: "With varying gaps, the smallest gap decides how fast the pusher must return." },
    });
    if (!besvarad(/i_?foljd|följd/i)) s({
      id: "saknas-utsorteringar-i-foljd", objektId: "produkt", egenskap: "utsorteringar_i_foljd",
      sv: "Antal utsorteringar i följd", en: "Number of consecutive rejects",
      varfor: { sv: "Två utsorteringar efter varandra med minsta avstånd är det dimensionerande fallet för cykeltiden.", en: "Two consecutive rejects at the minimum gap is the sizing case for the cycle time." },
    });
    if (!besvarad(/produktidentifiering|detektering|givare_vid/i)) s({
      id: "saknas-produktdetektering", objektId: "aktuator", egenskap: "produktdetektering",
      sv: "Hur lådan detekteras vid utskjutaren", en: "How the box is detected at the pusher",
      varfor: { sv: "Signalen kommer från kontrollstationen, men utskjutaren måste veta när just den lådan står framför den.", en: "The signal comes from the inspection station, but the pusher must know when that particular box is in front of it." },
    });
    if (harObjekt("mottagning") && !besvarad(/blockerad/i)) s({
      id: "saknas-blockerad-mottagning", objektId: "mottagning", egenskap: "blockerad",
      sv: "Vad som händer när mottagningen är full eller blockerad", en: "What happens when the receiving side is full or blocked",
      varfor: { sv: "Blir rullbordet fullt kan utskjutaren inte göra sitt jobb. Det avgör både en givare och ett larm.", en: "If the roller table fills up, the pusher cannot do its job. That decides both a sensor and an alarm." },
    });
  }
  if (harObjekt("styrsystem") && !finns("styrsystem", "modell")) s({
    id: "saknas-plc-modell", objektId: "styrsystem", egenskap: "modell",
    sv: "PLC-modell och programmeringsmiljö", en: "PLC model and programming environment",
    varfor: { sv: "Avgör adressformat och vilka exportformat som är möjliga i programmeringsunderlaget.", en: "Decides the address format and the export formats possible in the programming documentation." },
  });
  if (harObjekt("styrsystem")) s({
    id: "saknas-signaladresser", objektId: "styrsystem", egenskap: "adresser",
    sv: "Signaladresser", en: "Signal addresses",
    varfor: { sv: "Adresserna är kända först när hårdvaran är konfigurerad; de hittas aldrig på.", en: "Addresses are known only once the hardware is configured; they are never invented." },
  });
  if (!finns("produkt", "massa") && !finns("aktuator", "kraft")) s({
    id: "saknas-massa", objektId: "produkt", egenskap: "massa",
    sv: "Lastens massa", en: "Load mass",
    varfor: { sv: "Massan avgör kraften och därmed storleken på aktuatorn.", en: "The mass decides the force and therefore the actuator size." },
  });
  return ut;
}

// ── Text för gränssnitt och sammanfattning ──────────────────────────────────

export const EGENSKAPSNAMN: Record<string, [string, string]> = {
  hastighet: ["Hastighet", "Speed"],
  massa: ["Massa", "Mass"],
  dimensionerande_massa: ["Dimensionerande massa", "Design mass"],
  matt: ["Mått", "Dimensions"],
  flode: ["Flöde", "Throughput"],
  slaglangd: ["Slaglängd", "Stroke"],
  sidoforflyttning: ["Önskad sidoförflyttning", "Required sideways travel"],
  kraft: ["Kraft", "Force"],
  tryck: ["Tryckluft", "Air pressure"],
  spanning: ["Spänning", "Voltage"],
  befintlig: ["Styrsystem", "Control system"],
  io: ["I/O", "I/O"],
  modell: ["PLC-modell", "PLC model"],
  drifttid: ["Drifttid", "Operating time"],
  miljo: ["Miljö", "Environment"],
  hantering: ["Hantering", "Handling"],
  avstand: ["Produktavstånd", "Product spacing"],
  signal: ["Signal", "Signal"],
  takt: ["Takt", "Rate"],
  cykeltid: ["Tid", "Time"],
  noggrannhet: ["Noggrannhet", "Accuracy"],
  temperatur: ["Temperatur", "Temperature"],
  minsta_avstand: ["Minsta avstånd", "Minimum gap"],
  vid_utskjutning: ["Vid utskjutning", "During the push"],
  utsorteringar_i_foljd: ["Utsorteringar i följd", "Consecutive rejects"],
  rorlig_massa: ["Rörlig massa", "Moving mass"],
  riktning: ["Rörelseriktning", "Direction"],
  sakerhet: ["Säkerhet", "Safety"],
  svar: ["Svar", "Answer"],
};

export const OBJEKTNAMN: Record<ObjektTyp, [string, string]> = {
  maskin: ["Maskinen", "The machine"],
  produkt: ["Produkten", "The product"],
  transportband: ["Transportbandet", "The conveyor"],
  aktuator: ["Aktuatorn", "The actuator"],
  kontrollstation: ["Kontrollstationen", "The inspection station"],
  mottagning: ["Mottagningen", "The receiving side"],
  styrsystem: ["Styrsystemet", "The control system"],
  matning: ["Matningen", "The supply"],
};

/** Värdet som det ska läsas, med enhet, gräns och intervall bevarade. */
export function kravetsVarde(k: Krav, locale = "sv"): string {
  const sv = locale === "sv";
  const n = (x: number) => (sv ? formatTal(x) : String(Math.round(x * 1000) / 1000));
  const grans = k.egenskap === "noggrannhet" ? "±"
    : k.grans === "max" ? (sv ? "upp till " : "up to ") : k.grans === "minst" ? (sv ? "minst " : "at least ") : "";
  const enhet = k.enhet ? ` ${k.enhet}` : "";
  if (k.intervall) return `${n(k.intervall.min)}–${n(k.intervall.max)}${enhet}`;
  if (k.varde != null) return `${grans}${n(k.varde)}${enhet}`;
  return `${grans}${k.text ?? ""}${k.text && k.enhet && !k.text.endsWith(k.enhet) ? enhet : ""}`.trim();
}

/** Aktuatorns hastighet enligt kravbilden, eller 0 om den inte är angiven. */
export function aktuatorensHastighet(kb: Kravbild): number {
  const k = kb.krav.find((x) => x.objektId === "aktuator" && x.egenskap === "hastighet" && x.bekraftelse !== "avvisat");
  return k?.varde ?? 0;
}
