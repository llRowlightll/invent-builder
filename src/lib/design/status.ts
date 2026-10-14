/**
 * Statusens visuella nivåer, i en tabell för hela sajten (designen 2026-10-14).
 *
 * Briefen kräver fyra nivåer som skiljs åt synligt: bekräftat, preliminärt,
 * kräver komplettering och uppfyller inte -- och att grönt aldrig betyder
 * "verifierat" när underlag saknas. PLC-flödet lägger till förslag, öppen
 * fråga och utfört test. Motorns statusord (verifiering, utfall) översätts
 * hit på ett ställe, i stället för att varje vy färgar på sitt eget sätt.
 *
 * Ren modul utan React, så att översättningen kan provas (tests/design-status.test.ts).
 */

export type Tillstand =
  | "bekraftat"      // prövat eller bekräftat, och höll
  | "preliminart"    // uppskattning eller antagande
  | "komplettering"  // uppgift saknas, kräver verifiering eller ett val
  | "uppfyllerInte"  // prövat, och höll inte
  | "ejProvat"       // inget krav att pröva, ingen utsaga
  | "forslag"        // systemets förslag, inte bekräftat av en människa
  | "oppen"          // öppen fråga
  | "utfort";        // faktiskt utfört test, med ansvarig och datum

/** Radens status i stycklistan, som den ska läsas (se radStatus). */
export type Radstatus =
  | "verifierad" | "delvis" | "inga_krav" | "ej_tillampligt" | "underlag_saknas" | "stods_inte"
  | "kraver_verifiering" | "kraver_konfiguration" | "avvikelse" | "ej_uppfyllt" | "ej_godkand";

const RAD: Record<Radstatus, { tillstand: Tillstand; sv: string; en: string }> = {
  verifierad: { tillstand: "bekraftat", sv: "Prövat mot kraven", en: "Checked against requirements" },
  delvis: { tillstand: "komplettering", sv: "Delvis prövat", en: "Partly checked" },
  inga_krav: { tillstand: "ejProvat", sv: "Ej prövat", en: "Not checked" },
  // "Ej tillämpligt" lästes som "behövs inte" bredvid en obligatorisk ljuddämpare.
  ej_tillampligt: { tillstand: "ejProvat", sv: "Inget krav att pröva", en: "No requirement to check" },
  underlag_saknas: { tillstand: "komplettering", sv: "Underlag saknas", en: "Data missing" },
  stods_inte: { tillstand: "komplettering", sv: "Prövas manuellt", en: "Check manually" },
  kraver_verifiering: { tillstand: "komplettering", sv: "Kräver verifiering", en: "Needs verification" },
  kraver_konfiguration: { tillstand: "komplettering", sv: "Konfigureras vid order", en: "Configured at order" },
  avvikelse: { tillstand: "komplettering", sv: "Avviker från kravet", en: "Deviates from requirement" },
  ej_uppfyllt: { tillstand: "uppfyllerInte", sv: "Uppfyller inte kravet", en: "Does not meet requirement" },
  ej_godkand: { tillstand: "uppfyllerInte", sv: "Ej godkänd", en: "Not approved" },
};

/**
 * En rad där något prövades men ett annat krav saknade underlag är "delvis
 * prövad", inte prövad -- annars säger etiketten mer än kontrollerna.
 */
export function radStatus(l: { verifiering?: string; kontroller?: Array<{ utfall: string }> }): Radstatus | undefined {
  if (l.verifiering === "verifierad" && (l.kontroller ?? []).some((k) => k.utfall === "underlag_saknas" || k.utfall === "stods_inte")) return "delvis";
  return l.verifiering && l.verifiering in RAD ? (l.verifiering as Radstatus) : undefined;
}

export function radensTillstand(status: string | undefined): Tillstand {
  return status && status in RAD ? RAD[status as Radstatus].tillstand : "ejProvat";
}

export function radensText(status: string | undefined, locale: string): string {
  if (!status || !(status in RAD)) return locale === "sv" ? "Ej prövat" : "Not checked";
  const r = RAD[status as Radstatus];
  return locale === "sv" ? r.sv : r.en;
}

/** Ett alternativs kravutfall (kravstatus i alternativsteget). */
export function utfalletsTillstand(utfall: string): Tillstand {
  if (utfall === "uppfyllt") return "bekraftat";
  if (utfall === "ej_uppfyllt") return "uppfyllerInte";
  return "komplettering";
}

const UTFALL_TEXT: Record<string, [string, string]> = {
  uppfyllt: ["uppfylls", "met"],
  ej_uppfyllt: ["uppfylls inte", "not met"],
  avvikelse: ["avviker", "deviates"],
  konfigureras: ["väljs vid order", "chosen at order"],
  kan_inte_bedomas: ["kan inte bedömas", "cannot be assessed"],
  underlag_saknas: ["underlag saknas", "data missing"],
  stods_inte: ["prövas manuellt", "check manually"],
};

export function utfalletsText(utfall: string, locale: string): string {
  const t = UTFALL_TEXT[utfall];
  return t ? (locale === "sv" ? t[0] : t[1]) : utfall;
}

/** Standardtexten för ett tillstånd, när vyn inte har en egen. */
export function tillstandetsText(t: Tillstand, locale: string): string {
  const sv = locale === "sv";
  switch (t) {
    case "bekraftat": return sv ? "Bekräftat" : "Confirmed";
    case "preliminart": return sv ? "Preliminärt" : "Preliminary";
    case "komplettering": return sv ? "Kräver komplettering" : "Needs completion";
    case "uppfyllerInte": return sv ? "Uppfyller inte kravet" : "Does not meet requirement";
    case "ejProvat": return sv ? "Ej prövat" : "Not checked";
    case "forslag": return sv ? "Förslag" : "Proposal";
    case "oppen": return sv ? "Öppen fråga" : "Open question";
    case "utfort": return sv ? "Utfört" : "Performed";
  }
}

/** Ordningen när flera tillstånd sammanfattas: det allvarligaste först. */
export const ALLVAR: Tillstand[] = ["uppfyllerInte", "komplettering", "oppen", "preliminart", "forslag", "ejProvat", "utfort", "bekraftat"];

export function allvarligast(tillstand: Tillstand[]): Tillstand | null {
  for (const t of ALLVAR) if (tillstand.includes(t)) return t;
  return null;
}
