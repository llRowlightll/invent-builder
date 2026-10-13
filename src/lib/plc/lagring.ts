/**
 * Läsning och sparning av programmeringsunderlaget.
 *
 * Läsning går direkt mot tabellerna (radbehörigheten visar bara egna projekt).
 * Allt som skriver går genom databasfunktionerna skapa_plc_underlag,
 * skapa_befintlig_maskin och spara_plc_underlag, som kontrollerar ägare,
 * revision, storlek och struktur -- se migration 20261012180000_plc_underlag.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ProjektKalla } from "./krav";
import { lasUnderlag, type Underlag, type UnderlagRad } from "./modell";

export interface ProjektRad extends ProjektKalla {
  id: string;
  typ: "maskinbyggare" | "befintlig_maskin";
  locale: string;
  updated_at: string;
}

/** Någon annan har sparat sedan underlaget lästes. Bär revisionen som gäller nu. */
export class Revisionskonflikt extends Error {
  constructor(public nuvarandeRevision: number) {
    super(`Underlaget har sparats av någon annan (revision ${nuvarandeRevision}).`);
    this.name = "Revisionskonflikt";
  }
}

function somJson(u: Underlag): Json {
  return u as unknown as Json;
}

export async function hamtaProjekt(projektId: string): Promise<ProjektRad | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, answers, bom_lines, revision, typ, locale, updated_at")
    .eq("id", projektId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    answers: (data.answers ?? {}) as Record<string, string>,
    bom_lines: (data.bom_lines ?? []) as ProjektKalla["bom_lines"],
    revision: data.revision,
    typ: data.typ === "befintlig_maskin" ? "befintlig_maskin" : "maskinbyggare",
    locale: data.locale,
    updated_at: data.updated_at,
  };
}

/** Användarens maskinprojekt, nyast först, för projektväljaren. */
export async function listaProjekt(): Promise<Array<Pick<ProjektRad, "id" | "name" | "typ" | "updated_at">>> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, typ, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, typ: p.typ === "befintlig_maskin" ? "befintlig_maskin" : "maskinbyggare" }));
}

export async function hamtaUnderlag(projektId: string): Promise<UnderlagRad | null> {
  const { data, error } = await supabase
    .from("plc_underlag")
    .select("id, project_id, revision, kallrevision, data, updated_at")
    .eq("project_id", projektId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, data: lasUnderlag(data.data) };
}

export async function skapaUnderlag(projektId: string, underlag: Underlag): Promise<UnderlagRad> {
  const { data, error } = await supabase.rpc("skapa_plc_underlag", { p_project: projektId, p_data: somJson(underlag) });
  if (error) throw error;
  const rad = data as unknown as { id: string; project_id: string; revision: number; kallrevision: number; data: unknown; updated_at: string };
  return { ...rad, data: lasUnderlag(rad.data) };
}

export async function skapaBefintligMaskin(namn: string, beskrivning: string, locale: string, underlag: Underlag): Promise<string> {
  const { data, error } = await supabase.rpc("skapa_befintlig_maskin", {
    p_namn: namn, p_beskrivning: beskrivning, p_locale: locale, p_data: somJson(underlag),
  });
  if (error) throw error;
  return data as string;
}

/** Sparar och returnerar den nya revisionen. Kastar Revisionskonflikt vid krock. */
export async function sparaUnderlag(id: string, forvantadRevision: number, underlag: Underlag): Promise<number> {
  const { data, error } = await supabase.rpc("spara_plc_underlag", {
    p_id: id, p_forvantad_revision: forvantadRevision, p_data: somJson(underlag),
  });
  if (error) {
    const m = /plc_revisionskonflikt:(\d+)/.exec(error.message ?? "");
    if (m) throw new Revisionskonflikt(Number(m[1]));
    throw error;
  }
  return data as number;
}
