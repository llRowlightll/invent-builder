import { supabase } from "@/integrations/supabase/client";
import type { FamilyBrief } from "../../supabase/functions/groq-advisor/order-code.ts";

/**
 * Familjerna som orderkodsläsaren behöver (namn, tillåtna borrningar,
 * slagintervall). Delas av Ersätt och snabbordern.
 */
export async function hamtaFamiljer(): Promise<FamilyBrief[]> {
  const { data } = await supabase.rpc("get_family_briefs" as never);
  if (!Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>)
    .map((r) => ({
      slug: String(r.slug ?? ""), name: String(r.name ?? ""),
      bores: Array.isArray(r.bores) ? (r.bores as number[]) : [],
      strokeMin: typeof r.stroke_min === "number" ? r.stroke_min : null,
      strokeMax: typeof r.stroke_max === "number" ? r.stroke_max : null,
    }))
    .filter((f) => f.name.length >= 2 && f.bores.length > 0);
}
