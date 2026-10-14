/**
 * Innehållet i maskinbyggarens projektöversikt (sidopanelen), ur det som
 * redan finns i webbläsaren: beskrivningen, svaren och motorns svar. Ingen
 * egen tolkning -- kravbilden är samma modul som motorn använder.
 *
 * Briefen (punkt 5): bekräftade krav, saknade uppgifter, antaganden,
 * konflikter och sparstatus, och bara det som är relevant. Sparstatus bärs av
 * sidan; resten byggs här. Ren modul, provad i tests/projektoversikt.test.ts.
 */
import {
  delaSvar, EGENSKAPSNAMN, kravetsVarde, OBJEKTNAMN, tolkaKravbild,
  type Krav, type ObjektTyp,
} from "../../../supabase/functions/groq-advisor/kravbild.ts";
import type { Tillstand } from "./status.ts";

export interface OversiktPost {
  id: string;
  text: string;
  detalj?: string;
  tillstand?: Tillstand;
}

export type SektionsId = "konflikter" | "saknas" | "oppna" | "antaganden" | "bekraftade" | "tolkade";

export interface OversiktSektion {
  id: SektionsId;
  rubrik: string;
  tillstand: Tillstand;
  poster: OversiktPost[];
  oppen: boolean;
}

export interface Projektoversikt {
  sektioner: OversiktSektion[];
  antal: Record<SektionsId, number>;
  sammanfattning: string;
}

export interface OversiktIndata {
  locale: string;
  description: string;
  answers: Record<string, string>;
  /** Frågornas etiketter, för svar som lämnats öppna. */
  fragor?: Array<{ id: string; label: string }>;
  /** Svaret som betyder "lämnas öppen" på sidans språk. */
  lamnasOppen?: string;
  vetInte?: string;
  requirements?: {
    pressure_assumed?: boolean;
    pressure_bar?: number | null;
    force_preliminary?: boolean;
    required_force_n?: number | null;
  } | null;
  /** Det valda alternativet och dess kravutfall. */
  valt?: { name: string; kravstatus?: Array<{ krav: string; utfall: string; text: string }> } | null;
  /** Stycklistans rader som blockerar beställning (serverns dom). */
  blockerande?: Array<{ role: string; verifiering: string; skal: string }>;
}

const namn = (k: Krav, sv: boolean) => {
  const egenskap = EGENSKAPSNAMN[k.egenskap]?.[sv ? 0 : 1] ?? k.egenskap;
  const objekt = OBJEKTNAMN[k.objektId as ObjektTyp]?.[sv ? 0 : 1];
  return { egenskap, objekt };
};

export function byggProjektoversikt(o: OversiktIndata): Projektoversikt {
  const sv = o.locale === "sv";
  // Ingen beskrivning, inga svar: inget att visa än (inte "1 saknas").
  if (!(o.description ?? "").trim() && Object.keys(o.answers ?? {}).length === 0) {
    const tomma: SektionsId[] = ["konflikter", "saknas", "oppna", "antaganden", "bekraftade", "tolkade"];
    return { sektioner: [], antal: Object.fromEntries(tomma.map((id) => [id, 0])) as Record<SektionsId, number>, sammanfattning: "" };
  }
  const { svar, tolkning } = delaSvar(o.answers ?? {});
  const kb = tolkaKravbild(o.description ?? "", svar, tolkning);
  const synligaKrav = kb.krav.filter((k) => k.bekraftelse !== "avvisat" && k.egenskap !== "svar");

  // ── Konflikter: det som prövats och inte höll ──────────────────────────────
  const konflikter: OversiktPost[] = [];
  for (const k of o.valt?.kravstatus ?? []) {
    if (k.utfall === "ej_uppfyllt") {
      konflikter.push({ id: `val-${k.krav}`, text: `${k.krav}: ${sv ? "uppfylls inte" : "not met"}`, detalj: k.text, tillstand: "uppfyllerInte" });
    }
  }
  for (const b of o.blockerande ?? []) {
    if (b.verifiering === "ej_uppfyllt" || b.verifiering === "ej_godkand") {
      konflikter.push({ id: `rad-${b.role}`, text: b.role, detalj: b.skal, tillstand: "uppfyllerInte" });
    }
  }

  // ── Saknade uppgifter: kravbildens luckor och öppet lämnade svar ───────────
  // Översikten visar rubrikerna; förklaringen (varför) står i arbetsytan.
  const saknas: OversiktPost[] = kb.saknas.map((s) => ({
    id: s.id, text: sv ? s.sv : s.en, tillstand: "komplettering" as const,
  }));
  for (const f of o.fragor ?? []) {
    const v = o.answers?.[f.id];
    if (v && (v === o.lamnasOppen || v === o.vetInte)) {
      saknas.push({ id: `svar-${f.id}`, text: f.label, detalj: v, tillstand: "komplettering" });
    }
  }
  for (const b of o.blockerande ?? []) {
    if (b.verifiering === "kraver_verifiering") {
      saknas.push({ id: `rad-${b.role}`, text: b.role, detalj: b.skal, tillstand: "komplettering" });
    }
  }

  // ── Öppna frågor: tolkningar systemet inte kan avgöra ──────────────────────
  const oppna: OversiktPost[] = kb.osakra.map((t) => {
    const forval = t.alternativ.find((a) => a.id === t.forval);
    return {
      id: t.id, text: sv ? t.fraga.sv : t.fraga.en,
      detalj: forval ? (sv ? `Gäller tills vidare: ${forval.sv.toLowerCase()}` : `Applies for now: ${forval.en.toLowerCase()}`) : undefined,
      tillstand: "oppen" as const,
    };
  });

  // ── Antaganden: det som gäller utan att någon sagt det ─────────────────────
  const antaganden: OversiktPost[] = [];
  if (o.requirements?.pressure_assumed && o.requirements.pressure_bar) {
    antaganden.push({
      id: "antaget-tryck",
      text: sv ? `Tryckluft ${String(o.requirements.pressure_bar).replace(".", ",")} bar` : `Air pressure ${o.requirements.pressure_bar} bar`,
      detalj: sv ? "Antaget, inte angivet" : "Assumed, not stated", tillstand: "preliminart",
    });
  }
  if (o.requirements?.force_preliminary && o.requirements.required_force_n) {
    antaganden.push({
      id: "preliminar-kraft",
      text: sv ? `Kraft ${o.requirements.required_force_n} N` : `Force ${o.requirements.required_force_n} N`,
      detalj: sv ? "Preliminär uppskattning, inte ett dimensioneringsresultat" : "Preliminary estimate, not a sizing result",
      tillstand: "preliminart",
    });
  }
  for (const k of synligaKrav.filter((x) => x.ursprung === "antagande" || x.ursprung === "berakning")) {
    const { egenskap, objekt } = namn(k, sv);
    antaganden.push({ id: k.id, text: `${egenskap}: ${kravetsVarde(k, o.locale)}`, detalj: objekt, tillstand: "preliminart" });
  }

  // ── Krav ur beskrivningen: bekräftade för sig, tolkade för sig ─────────────
  const franText = synligaKrav.filter((k) => k.ursprung !== "antagande" && k.ursprung !== "berakning");
  const post = (k: Krav): OversiktPost => {
    const { egenskap, objekt } = namn(k, sv);
    return { id: k.id, text: `${egenskap}: ${kravetsVarde(k, o.locale)}`, detalj: objekt };
  };
  const bekraftade = franText.filter((k) => k.bekraftelse === "bekraftat").map(post);
  const tolkade = franText.filter((k) => k.bekraftelse === "ej_bekraftat").map(post);

  const sektioner: OversiktSektion[] = [
    { id: "konflikter", rubrik: sv ? "Konflikter" : "Conflicts", tillstand: "uppfyllerInte", poster: konflikter, oppen: true },
    { id: "saknas", rubrik: sv ? "Saknade uppgifter" : "Missing information", tillstand: "komplettering", poster: saknas, oppen: konflikter.length === 0 },
    { id: "oppna", rubrik: sv ? "Öppna tolkningar" : "Open interpretations", tillstand: "oppen", poster: oppna, oppen: false },
    { id: "antaganden", rubrik: sv ? "Antaganden" : "Assumptions", tillstand: "preliminart", poster: antaganden, oppen: false },
    { id: "bekraftade", rubrik: sv ? "Bekräftade krav" : "Confirmed requirements", tillstand: "bekraftat", poster: bekraftade, oppen: false },
    { id: "tolkade", rubrik: sv ? "Tolkade, ej bekräftade" : "Interpreted, not confirmed", tillstand: "forslag", poster: tolkade, oppen: bekraftade.length === 0 && konflikter.length === 0 && saknas.length === 0 },
  ];
  const antal = Object.fromEntries(sektioner.map((s) => [s.id, s.poster.length])) as Record<SektionsId, number>;

  const delar: string[] = [];
  if (antal.konflikter) delar.push(sv ? `${antal.konflikter} konflikt${antal.konflikter > 1 ? "er" : ""}` : `${antal.konflikter} conflict${antal.konflikter > 1 ? "s" : ""}`);
  if (antal.saknas) delar.push(sv ? `${antal.saknas} saknas` : `${antal.saknas} missing`);
  if (antal.bekraftade) delar.push(sv ? `${antal.bekraftade} bekräftade` : `${antal.bekraftade} confirmed`);
  if (antal.tolkade) delar.push(sv ? `${antal.tolkade} att bekräfta` : `${antal.tolkade} to confirm`);

  return { sektioner, antal, sammanfattning: delar.join(" · ") };
}
