/**
 * Momsraden på offert och orderbekräftelse. Själva regeln finns i databasen
 * (momstyp/momssats i 20261113060000_momsregel.sql) så att ordern, sidorna
 * och Fortnox räknar likadant; här bara texten för varje typ.
 */
export type Momstyp = "sverige" | "omvand" | "export" | "eu_utan_nummer";
export type Momsbesked = { sats: number; typ: Momstyp };

export const SVENSK_MOMS: Momsbesked = { sats: 0.25, typ: "sverige" };

/** Raden i summeringen, t.ex. "Moms 25 %" eller "Omvänd betalningsskyldighet". */
export function momsrad(b: Momsbesked, locale: string): string {
  const sv = locale === "sv";
  const procent = `${Math.round(b.sats * 100)} %`;
  switch (b.typ) {
    case "omvand":
      return sv ? "Moms 0 % – omvänd betalningsskyldighet" : "VAT 0 % – reverse charge";
    case "export":
      return sv ? "Moms 0 % – export utanför EU" : "VAT 0 % – export outside the EU";
    default:
      return sv ? `Moms ${procent}` : `VAT ${procent}`;
  }
}

/** En förklarande mening under summan, eller null när svensk moms gäller. */
export function momsnot(b: Momsbesked, locale: string): string | null {
  const sv = locale === "sv";
  if (b.typ === "omvand") {
    return sv
      ? "Omvänd betalningsskyldighet enligt artikel 196 i mervärdesskattedirektivet (2006/112/EG): köparen redovisar momsen. Gäller med giltigt momsregistreringsnummer."
      : "Reverse charge under Article 196 of the VAT Directive (2006/112/EC): the buyer accounts for the VAT. Applies with a valid VAT registration number.";
  }
  if (b.typ === "export") {
    return sv
      ? "Export utanför EU: ingen svensk moms. Tull och importmoms betalas av mottagaren."
      : "Export outside the EU: no Swedish VAT. Customs duty and import VAT are paid by the recipient.";
  }
  return null;
}

/** Tolkar svaret från rpc("momsbesked"); allt oväntat blir svensk moms. */
export function lasMomsbesked(data: unknown): Momsbesked {
  const d = data as { sats?: unknown; typ?: unknown } | null;
  const typ = d?.typ;
  const sats = Number(d?.sats);
  if ((typ === "sverige" || typ === "omvand" || typ === "export" || typ === "eu_utan_nummer") && Number.isFinite(sats)) {
    return { sats, typ };
  }
  return SVENSK_MOMS;
}
