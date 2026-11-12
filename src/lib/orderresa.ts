/**
 * Kundens spårning: tolkning av orderns_resa (migration 20261112190000).
 * Ren logik utan IO, så att den kan provas (tests/orderresa.test.ts).
 */
type Sprak = "sv" | "en";

export interface ResaSteg { kod: string; klar: boolean; delvis?: boolean; tid: string | null }
export interface ResaRad {
  line_no: number; sku: string; name: string; qty: number; status: string; skickat: number;
  bekraftad_leverans: string | null;
}
export interface ResaForsandelse {
  id: string; nr: number | null; fraktbolag: string | null; sparningsnummer: string | null; url: string | null;
  skickad: string | null; beraknad: string | null; levererad: string | null; status: string;
  rader: { sku: string; name: string; qty: number }[] | null;
}
export interface Resa {
  order_number: string | null; skapad: string; status: string; avbruten: boolean; kund: string;
  ort: string | null; po_number: string | null; eta: string | null;
  eta_kalla: "levererad" | "fraktbolag" | "leverantor" | "uppskattning";
  steg: ResaSteg[]; rader: ResaRad[]; forsandelser: ResaForsandelse[];
}

export type AktuelltSteg = "mottagen" | "bestalld" | "bekraftad" | "delvis" | "skickad" | "levererad" | "avbruten";

/** Rubriken: det senaste steget som är klart (eller delvis skickat). */
export function aktuelltSteg(r: Resa): AktuelltSteg {
  if (r.avbruten) return "avbruten";
  const s = (kod: string) => r.steg.find((x) => x.kod === kod);
  if (s("levererad")?.klar) return "levererad";
  if (s("skickad")?.klar) return "skickad";
  if (s("skickad")?.delvis) return "delvis";
  if (s("bekraftad")?.klar) return "bekraftad";
  if (s("bestalld")?.klar) return "bestalld";
  return "mottagen";
}

/** Arbetsdagar från idag till datumet (lördag och söndag räknas inte). */
export function arbetsdagarTill(datum: string, idag: Date = new Date()): number {
  const mal = new Date(`${datum.slice(0, 10)}T12:00:00`);
  const d = new Date(idag.getFullYear(), idag.getMonth(), idag.getDate(), 12);
  let n = 0;
  while (d < mal) {
    d.setDate(d.getDate() + 1);
    const v = d.getDay();
    if (v !== 0 && v !== 6) n++;
  }
  return n;
}

/** "torsdag 20 november" och "om ca 3 arbetsdagar". null utan datum. */
export function etaText(r: Pick<Resa, "eta" | "eta_kalla">, sprak: Sprak, idag: Date = new Date()): { datum: string; om: string | null } | null {
  if (!r.eta) return null;
  const dt = new Date(`${r.eta.slice(0, 10)}T12:00:00`);
  const datum = dt.toLocaleDateString(sprak === "sv" ? "sv-SE" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
  const ca = r.eta_kalla === "uppskattning";
  if (r.eta_kalla === "levererad") return { datum, om: null };
  const n = arbetsdagarTill(r.eta, idag);
  let om: string;
  if (sprak === "sv") {
    om = n <= 0 ? (ca ? "Uppskattat till idag" : "Idag") : `Om ${ca ? "ca " : ""}${n} arbetsdag${n === 1 ? "" : "ar"}`;
  } else {
    om = n <= 0 ? (ca ? "Estimated today" : "Today") : `In ${ca ? "about " : ""}${n} working day${n === 1 ? "" : "s"}`;
  }
  return { datum: ca ? `${sprak === "sv" ? "ca " : "approx. "}${datum}` : datum, om };
}

/** Chippen per artikel. */
export function radstatus(r: ResaRad, sprak: Sprak): { text: string; klass: string } {
  const sv = sprak === "sv";
  const datum = r.bekraftad_leverans
    ? new Date(`${r.bekraftad_leverans}T12:00:00`).toLocaleDateString(sv ? "sv-SE" : "en-GB", { day: "numeric", month: "short" })
    : null;
  switch (r.status) {
    case "delivered": return { text: sv ? "Levererad" : "Delivered", klass: "bg-success-surface text-success-deep" };
    case "shipped": return { text: sv ? "På väg" : "On its way", klass: "bg-info-surface text-info" };
    case "acknowledged":
      if (r.skickat > 0) return { text: sv ? `${r.skickat} av ${r.qty} på väg` : `${r.skickat} of ${r.qty} on its way`, klass: "bg-info-surface text-info" };
      return { text: datum ? (sv ? `Bekräftad · ${datum}` : `Confirmed · ${datum}`) : (sv ? "Bekräftad" : "Confirmed"), klass: "bg-success-surface text-success-deep" };
    case "backordered": return { text: sv ? "Restnoterad" : "Backordered", klass: "bg-warning-surface text-warning-deep" };
    case "cancelled": return { text: sv ? "Struken" : "Cancelled", klass: "bg-muted text-muted-foreground" };
    case "returned": return { text: sv ? "Returnerad" : "Returned", klass: "bg-muted text-muted-foreground" };
    case "ordered": return { text: sv ? "Beställd" : "Ordered", klass: "bg-muted text-foreground" };
    default: return { text: sv ? "Mottagen" : "Received", klass: "bg-muted text-foreground" };
  }
}
