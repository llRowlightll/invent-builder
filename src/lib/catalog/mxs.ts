/**
 * SMC MXS — luftdrivet slidbord (Air Slide Table), ø6–ø25, med den
 * symmetriska varianten MXS□L.
 *
 * KÄLLA (enda sanningen — ändra aldrig ett värde här utan att peka på källan):
 *   SMC, "Air Slide Table MXS Series" (katalogutdrag, 42 sidor). Ligger i
 *   knowledge_chunks som source_file = 'smc-kat-mxs.pdf'. PDF-sidor:
 *     - How to Order, standard          sida 6 (katalogsida 64)
 *     - specifikationer, special, kraft  sida 7 (65)
 *     - buffertens data                  sida 25 (83)
 *     - How to Order, symmetrisk MXS□L   sida 27 (85)
 *
 * KODENS FORM (sida 6 och 27):
 *
 *   MXS 12 □   - 50 AS FR - M9BW □ - □       standard
 *   MXS 12 □ L - 50 AS    - M9BW □ - □       symmetrisk (inga funktionsoptioner)
 *
 *   MXS{ø}{gänga}{L}-{slag}{justering}{funktion}-{givare}{kabel}{antal}-{special}
 *
 * Magneten är inbyggd i alla MXS ("Built-in magnet"), så en givare kräver
 * inget val av magnet. SMC:s "Nil" är ingenting i koden: gänga, justering,
 * funktion, givare, kabel, antal och special är valfria parametrar.
 *
 * BSAT PÅ SIDA 6 ÄR ETT TRYCKFEL. Där står "Rubber stopper on extension end +
 * Rubber stopper on retraction end", vilket är samma sak som A. Sidan 27
 * skriver "Absorber on extension end + Rubber stopper on retraction end",
 * vilket är vad koden säger (B = absorber, A = gummi, S = utskjut, T = retur).
 * Modellen följer sidan 27.
 */

export const MXS_SOURCE = {
  file: "smc-kat-mxs.pdf",
  edition: "SMC MXS catalogue (catalogue pages 64–98)",
  title: "SMC Air Slide Table MXS Series",
  brand: "SMC",
} as const;

export interface MxsValue {
  code: string;
  label_sv: string;
}

export interface MxsBore extends MxsValue {
  bore_mm: number;
  /** Standardslagen (sida 6). Det finns inga mellanslag i nyckeln. */
  strokes: number[];
  /** Teoretisk kraft plus-sidan vid 0,5 MPa, N (sida 7, dubbel kolvstång). */
  force_out_n_05mpa: number;
  /** Stötdämpare och ändlägeslås finns inte för MXS6 (sida 7). */
  absorber: boolean;
  end_lock: boolean;
  port_label: string;
}

export const MXS_BORES: MxsBore[] = [
  { code: "6", bore_mm: 6, strokes: [10, 20, 30, 40, 50], force_out_n_05mpa: 29, absorber: false, end_lock: false, port_label: "M3", label_sv: "ø6 mm, slag 10–50" },
  { code: "8", bore_mm: 8, strokes: [10, 20, 30, 40, 50, 75], force_out_n_05mpa: 51, absorber: true, end_lock: true, port_label: "M5", label_sv: "ø8 mm, slag 10–75" },
  { code: "12", bore_mm: 12, strokes: [10, 20, 30, 40, 50, 75, 100], force_out_n_05mpa: 113, absorber: true, end_lock: true, port_label: "M5", label_sv: "ø12 mm, slag 10–100" },
  { code: "16", bore_mm: 16, strokes: [10, 20, 30, 40, 50, 75, 100, 125], force_out_n_05mpa: 201, absorber: true, end_lock: true, port_label: "M5", label_sv: "ø16 mm, slag 10–125" },
  { code: "20", bore_mm: 20, strokes: [10, 20, 30, 40, 50, 75, 100, 125, 150], force_out_n_05mpa: 314, absorber: true, end_lock: true, port_label: "Rc 1/8", label_sv: "ø20 mm, slag 10–150" },
  { code: "25", bore_mm: 25, strokes: [10, 20, 30, 40, 50, 75, 100, 125, 150], force_out_n_05mpa: 491, absorber: true, end_lock: true, port_label: "Rc 1/8", label_sv: "ø25 mm, slag 10–150" },
];

/** Gängtyp (sida 6). Tom = M-gänga ø6–16 / Rc ø20–25. TN och TF finns ø20, ø25. */
export const MXS_PORTS: Array<MxsValue & { bores: string[] }> = [
  { code: "TN", bores: ["20", "25"], label_sv: "NPT-gänga (ø20, ø25)" },
  { code: "TF", bores: ["20", "25"], label_sv: "G-gänga (ø20, ø25)" },
];

export const MXS_SYMMETRIC: MxsValue = { code: "L", label_sv: "Symmetriskt utförande MXS□L (utan funktionsoptioner)" };

export interface MxsAdjuster extends MxsValue {
  /** Innehåller stötdämpare (finns inte för MXS6). */
  absorber: boolean;
  /** Vilka funktionsoptioner som går att kombinera (sida 6, "Option Combinations"). */
  functional_ok: string[];
}
export const MXS_ADJUSTERS: MxsAdjuster[] = [
  { code: "AS", absorber: false, functional_ok: ["", "F", "R", "P", "FR", "FP"], label_sv: "Gummistopp i utskjutet ändläge" },
  { code: "AT", absorber: false, functional_ok: ["", "F"], label_sv: "Gummistopp i indraget ändläge" },
  { code: "A", absorber: false, functional_ok: ["", "F"], label_sv: "Gummistopp i båda ändlägen" },
  { code: "BS", absorber: true, functional_ok: ["", "R", "P"], label_sv: "Stötdämpare i utskjutet ändläge (ej ø6)" },
  { code: "BT", absorber: true, functional_ok: ["", "F"], label_sv: "Stötdämpare i indraget ändläge (ej ø6)" },
  { code: "B", absorber: true, functional_ok: [""], label_sv: "Stötdämpare i båda ändlägen (ej ø6)" },
  { code: "ASBT", absorber: true, functional_ok: ["", "F"], label_sv: "Gummistopp utskjutet + stötdämpare indraget (ej ø6)" },
  { code: "BSAT", absorber: true, functional_ok: [""], label_sv: "Stötdämpare utskjutet + gummistopp indraget (ej ø6)" },
];

export interface MxsFunctional extends MxsValue {
  end_lock: boolean;
}
export const MXS_FUNCTIONALS: MxsFunctional[] = [
  { code: "F", end_lock: false, label_sv: "Med buffert" },
  { code: "R", end_lock: true, label_sv: "Med ändlägeslås (ej ø6)" },
  { code: "P", end_lock: false, label_sv: "Axiell anslutning" },
  { code: "FR", end_lock: true, label_sv: "Buffert + ändlägeslås (ej ø6)" },
  { code: "FP", end_lock: false, label_sv: "Buffert + axiell anslutning" },
];

export interface MxsSwitch extends MxsValue {
  kind: "reed" | "solid";
}
const solid = (code: string, label: string): MxsSwitch => ({ code, kind: "solid", label_sv: label });
const reed = (code: string, label: string): MxsSwitch => ({ code, kind: "reed", label_sv: label });
/** Tillämpliga givare (sida 6 och 27). */
export const MXS_SWITCHES: MxsSwitch[] = [
  solid("M9N", "D-M9N, 3-tråd NPN, rak"), solid("M9P", "D-M9P, 3-tråd PNP, rak"), solid("M9B", "D-M9B, 2-tråd, rak"),
  solid("M9NV", "D-M9NV, 3-tråd NPN, vinklad"), solid("M9PV", "D-M9PV, 3-tråd PNP, vinklad"), solid("M9BV", "D-M9BV, 2-tråd, vinklad"),
  solid("M9NW", "D-M9NW, NPN, tvåfärgsindikering, rak"), solid("M9PW", "D-M9PW, PNP, tvåfärgsindikering, rak"), solid("M9BW", "D-M9BW, 2-tråd, tvåfärgsindikering, rak"),
  solid("M9NWV", "D-M9NWV, NPN, tvåfärgsindikering, vinklad"), solid("M9PWV", "D-M9PWV, PNP, tvåfärgsindikering, vinklad"), solid("M9BWV", "D-M9BWV, 2-tråd, tvåfärgsindikering, vinklad"),
  solid("M9NA", "D-M9NA, NPN, vattentät, rak"), solid("M9PA", "D-M9PA, PNP, vattentät, rak"), solid("M9BA", "D-M9BA, 2-tråd, vattentät, rak"),
  solid("M9NAV", "D-M9NAV, NPN, vattentät, vinklad"), solid("M9PAV", "D-M9PAV, PNP, vattentät, vinklad"), solid("M9BAV", "D-M9BAV, 2-tråd, vattentät, vinklad"),
  reed("A96", "D-A96, reed 3-tråd, rak"), reed("A93", "D-A93, reed 2-tråd, rak"), reed("A90", "D-A90, reed 2-tråd utan indikering, rak"),
  reed("A96V", "D-A96V, reed 3-tråd, vinklad"), reed("A93V", "D-A93V, reed 2-tråd, vinklad"), reed("A90V", "D-A90V, reed 2-tråd utan indikering, vinklad"),
];

export const MXS_LEADS: MxsValue[] = [
  { code: "M", label_sv: "1 m kabel" },
  { code: "L", label_sv: "3 m kabel" },
  { code: "Z", label_sv: "5 m kabel (tillverkas på beställning)" },
];
export const MXS_COUNTS: MxsValue[] = [{ code: "S", label_sv: "1 givare (standard är 2)" }];

/** Specialutföranden (sida 7 och 27). */
export const MXS_MTO: MxsValue[] = [
  { code: "X7", label_sv: "-X7 PTFE-fett" },
  { code: "X9", label_sv: "-X9 Fett för livsmedelsutrustning" },
  { code: "X11", label_sv: "-X11 Lång justerbult, 15 mm justermån" },
  { code: "X12", label_sv: "-X12 Lång justerbult, 25 mm justermån" },
  { code: "X33", label_sv: "-X33 Utan inbyggd magnet" },
  { code: "X39", label_sv: "-X39 Fluorgummitätning" },
  { code: "X42", label_sv: "-X42 Korrosionsskyddad styrning" },
  { code: "X2578", label_sv: "-X2578 Justerare monterad på sidan" },
];

export const MXS_LIMITS = {
  pressure_mpa: [0.15, 0.7],
  temp_c: [-10, 60],
  speed_mm_s: [50, 500],
  adjust_range_mm: 5,
} as const;

export interface MxsConfig {
  bore: string;
  stroke_mm: number;
  port?: string;
  symmetric?: boolean;
  adjuster?: string;
  functional?: string;
  switch?: string;
  lead?: string;
  count?: string;
  mto?: string;
}

const har = (lista: ReadonlyArray<{ code: string }>, kod: string | undefined) =>
  kod !== undefined && lista.some((v) => v.code === kod);

export function mxsBuildCode(c: MxsConfig): string | null {
  const bore = MXS_BORES.find((b) => b.code === c.bore);
  if (!bore) return null;
  if (!bore.strokes.includes(c.stroke_mm)) return null;
  const port = c.port ?? "";
  if (port) {
    const p = MXS_PORTS.find((x) => x.code === port);
    if (!p || !p.bores.includes(bore.code)) return null;
  }
  const adjuster = c.adjuster ?? "";
  const functional = c.functional ?? "";
  if (adjuster) {
    const a = MXS_ADJUSTERS.find((x) => x.code === adjuster);
    if (!a) return null;
    if (a.absorber && !bore.absorber) return null;
    if (!a.functional_ok.includes(functional)) return null;
  }
  if (functional) {
    const f = MXS_FUNCTIONALS.find((x) => x.code === functional);
    if (!f) return null;
    if (f.end_lock && !bore.end_lock) return null;
    if (c.symmetric) return null;
  }
  const sw = c.switch ?? "";
  const lead = c.lead ?? "";
  const count = c.count ?? "";
  if (sw) {
    if (!har(MXS_SWITCHES, sw)) return null;
    if (lead && !har(MXS_LEADS, lead)) return null;
    if (count && !har(MXS_COUNTS, count)) return null;
    // -X33 är "utan inbyggd magnet": då finns inget för givaren att känna.
    if (c.mto === "X33") return null;
  } else if (lead || count) return null;
  const mto = c.mto ?? "";
  if (mto && !har(MXS_MTO, mto)) return null;

  const g1 = `MXS${bore.code}${port}${c.symmetric ? "L" : ""}`;
  const g2 = `${c.stroke_mm}${adjuster}${functional}`;
  const g3 = `${sw}${lead}${count}`;
  return [g1, g2, g3, mto].filter((g, i) => i < 2 || g).join("-");
}

export function mxsParseCode(raw: string): { config: MxsConfig } | null {
  const k = raw.trim().toUpperCase();
  const givare = [...MXS_SWITCHES].map((s) => s.code).sort((a, b) => b.length - a.length).join("|");
  const just = [...MXS_ADJUSTERS].map((a) => a.code).sort((a, b) => b.length - a.length).join("|");
  const funk = [...MXS_FUNCTIONALS].map((f) => f.code).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`^MXS(6|8|12|16|20|25)(TN|TF)?(L?)-(\\d{2,3})(${just})?(${funk})?(?:-(${givare})([MLZ])?(S)?)?(?:-(X[0-9]+))?$`);
  const m = re.exec(k);
  if (!m) return null;
  const [, bore, port, sym, stroke, adjuster, functional, sw, lead, count, mto] = m;
  const c: MxsConfig = {
    bore, stroke_mm: Number(stroke), port: port || undefined, symmetric: sym === "L", adjuster: adjuster || undefined,
    functional: functional || undefined, switch: sw || undefined, lead: lead || undefined, count: count || undefined, mto: mto || undefined,
  };
  if (mxsBuildCode(c) !== k) return null;
  return { config: c };
}

export const MXS_ORDER_CODE_TEMPLATE =
  "MXS{bore}{port}{symmetric}-{stroke_mm}{adjuster}{functional}-{switch}{lead}{count}-{mto}";
