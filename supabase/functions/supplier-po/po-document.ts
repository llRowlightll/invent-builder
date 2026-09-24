/**
 * Inköpsorderns innehåll, skilt från både PDF:en och e-posten.
 *
 * Här finns INGEN IO. Det är med flit: reglerna för när en inköpsorder får
 * skickas är de enda som kan orsaka riktig skada -- ett mejl till en
 * leverantör går inte att ta tillbaka -- och de ska gå att prova utan
 * databas, utan nätverk och utan att något faktiskt skickas.
 *
 * SKILLNADEN MELLAN HINDER OCH VARNING:
 *
 *   HINDER    gör det omöjligt att skicka. Ingen adress, ingen leverantör,
 *             inga rader. Att "skicka ändå" betyder ingenting.
 *   VARNING   gör det olämpligt. Avtalet är inte klart, kundnumret saknas,
 *             inköpspriset är okänt. En människa får avgöra, men måste
 *             bekräfta -- den får inte klickas förbi av misstag.
 */

export interface PoLeverantor {
  name: string;
  order_email: string | null;
  customer_number: string | null;
  currency: string | null;
  payment_terms: string | null;
  incoterms: string | null;
  agreement_status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  min_order_value: number | null;
}

export interface PoRad {
  line_no: number;
  sku: string;
  supplier_sku: string | null;
  name: string;
  qty: number;
  unit_purchase_price: number | null;
  line_total_ex_vat: number | null;
}

export interface PoHuvud {
  po_number: string | null;
  created_at: string;
  expected_delivery: string | null;
  currency: string;
  status: string;
  sent_at: string | null;
  needs_review: boolean;
  review_reason: string | null;
}

export interface PoKundorder {
  /** Vår referens mot leverantören. Kundens EGET PO-nummer står inte här:
   *  leverantören har inget med det att göra så länge vi inte dropshippar. */
  order_number: string | null;
}

export interface PoForetag {
  name: string; org: string; address: string; postal: string;
  email: string; phone: string; web: string; vat: string;
}

export interface PoDokument {
  poNumber: string;
  datum: string;
  leverantor: PoLeverantor | null;
  foretag: PoForetag;
  kundorder: PoKundorder;
  rader: PoRad[];
  valuta: string;
  onskadLeverans: string | null;
  summa: number | null;
  /** Rader utan inköpspris: summan är då inte hela sanningen. */
  raderUtanPris: number;
  hinder: string[];
  varningar: string[];
}

function kr(n: number | null): number | null {
  return n == null ? null : Math.round(n * 100) / 100;
}

export function byggPoDokument(input: {
  huvud: PoHuvud;
  leverantor: PoLeverantor | null;
  rader: PoRad[];
  kundorder: PoKundorder;
  foretag: PoForetag;
}): PoDokument {
  const { huvud, leverantor, rader, kundorder, foretag } = input;

  const raderUtanPris = rader.filter((r) => r.unit_purchase_price == null).length;
  const medPris = rader.filter((r) => r.line_total_ex_vat != null);
  const summa = medPris.length > 0 ? kr(medPris.reduce((s, r) => s + (r.line_total_ex_vat ?? 0), 0)) : null;

  const hinder: string[] = [];
  const varningar: string[] = [];

  if (!leverantor) {
    hinder.push("Inköpsordern har ingen leverantör. Sätt leverantör på orderraderna först.");
  } else if (!(leverantor.order_email ?? "").trim()) {
    hinder.push(`${leverantor.name} har ingen beställningsadress. Fyll i den på /admin/leverantorer.`);
  }
  if (rader.length === 0) {
    hinder.push("Inköpsordern har inga rader.");
  }

  if (huvud.needs_review && huvud.review_reason) {
    varningar.push(`Markerad för granskning: ${huvud.review_reason}.`);
  }
  if (leverantor && (leverantor.agreement_status ?? "unknown") !== "signed") {
    varningar.push(`Återförsäljaravtalet med ${leverantor.name} är inte registrerat som klart.`);
  }
  if (leverantor && !(leverantor.customer_number ?? "").trim()) {
    varningar.push(`Vi har inget kundnummer hos ${leverantor.name}; ordern kan avvisas.`);
  }
  if (raderUtanPris > 0) {
    varningar.push(
      raderUtanPris === rader.length
        ? "Inget inköpspris på någon rad -- ordern anger inget pris alls."
        : `${raderUtanPris} av ${rader.length} rader saknar inköpspris.`,
    );
  }
  if (leverantor?.min_order_value != null && summa != null && summa < leverantor.min_order_value) {
    varningar.push(`Under ${leverantor.name}s minsta ordervärde (${leverantor.min_order_value} ${huvud.currency}).`);
  }

  return {
    poNumber: huvud.po_number ?? "(inget nummer)",
    datum: huvud.created_at.slice(0, 10),
    leverantor,
    foretag,
    kundorder,
    rader: [...rader].sort((a, b) => a.line_no - b.line_no),
    valuta: huvud.currency,
    onskadLeverans: huvud.expected_delivery,
    summa,
    raderUtanPris,
    hinder,
    varningar,
  };
}

export interface SkickaBeslut {
  ok: boolean;
  /** Varför inte, i klartext till administratören. */
  skal: string | null;
  /** true när bara varningarna står i vägen: ett bekräftat klick släpper igenom. */
  kanBekraftas: boolean;
}

/**
 * Får den här inköpsordern skickas nu?
 *
 * `redanSkickad` är idempotensen: samma knapp, en omkörd bakgrundsjobb eller
 * ett nytt försök efter ett avbrott får inte lägga samma order två gånger hos
 * leverantören. Bara ett uttryckligt "skicka om" passerar.
 */
export function faarSkickas(
  dok: PoDokument,
  huvud: Pick<PoHuvud, "sent_at">,
  val: { bekraftaVarningar?: boolean; skickaOm?: boolean } = {},
): SkickaBeslut {
  if (dok.hinder.length > 0) {
    return { ok: false, skal: dok.hinder.join(" "), kanBekraftas: false };
  }
  if (huvud.sent_at && !val.skickaOm) {
    return {
      ok: false,
      skal: `Inköpsordern skickades redan ${huvud.sent_at.slice(0, 16).replace("T", " ")}. Välj "skicka om" om den verkligen ska gå iväg igen.`,
      kanBekraftas: false,
    };
  }
  if (dok.varningar.length > 0 && !val.bekraftaVarningar) {
    return { ok: false, skal: dok.varningar.join(" "), kanBekraftas: true };
  }
  return { ok: true, skal: null, kanBekraftas: false };
}

/**
 * Ämnesraden. Leverantören ombeds svara med den intakt, för det är så svaret
 * hittar tillbaka till rätt inköpsorder när det inte finns något API.
 */
export function amnesrad(dok: PoDokument): string {
  return `Inköpsorder ${dok.poNumber} - ${dok.foretag.name}`;
}
