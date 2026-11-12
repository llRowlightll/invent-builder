/**
 * Hämtar publika priser (se priser.ts). Ett fel eller en avslagen strömbrytare
 * ger en tom karta -- sidan visar då "Lämnas i offerten" som förut.
 */
import { supabase } from "@/integrations/supabase/client";
import { tolkaPrisrad, type PubliktPris } from "./priser";

export async function hamtaPublikaPriser(skus: string[]): Promise<Record<string, PubliktPris>> {
  const unika = [...new Set(skus.filter(Boolean))].slice(0, 500);
  if (unika.length === 0) return {};
  try {
    // publika_priser finns inte i de genererade typerna (samma mönster som
    // admin_list_product_pricing i admin.pricing.tsx).
    const { data, error } = await (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    }).rpc("publika_priser", { p_skus: unika });
    if (error || !Array.isArray(data)) return {};
    const ut: Record<string, PubliktPris> = {};
    for (const r of data) {
      const p = tolkaPrisrad(r);
      if (p) ut[p.sku] = p;
    }
    return ut;
  } catch {
    return {};
  }
}
