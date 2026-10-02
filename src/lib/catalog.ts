import { supabase } from "@/integrations/supabase/client";
import type { ProductRow } from "./types";

let cache: ProductRow[] | null = null;
let inflight: Promise<ProductRow[]> | null = null;

/**
 * Hämtar ALLA rader, i sidor. API:t lämnar ut högst 1 000 rader per anrop.
 *
 * Hittat 2026-10-02: specarna hämtades med .limit(5000) utan sortering, men
 * tabellen har drygt 7 000 rader. Tusentals specrader föll bort på måfå, och
 * de produkter det drabbade såg ut att sakna data: jämförelsen visade "—" för
 * tre av fyra ISO 15552-cylindrar som har 6–12 specrader var i databasen, och
 * chattens slagfilter släppte igenom en cylinder med 10 mm slag mot ett krav
 * på 50 mm, eftersom slaget var "okänt". Sorteringen på id gör sidorna
 * stabila: ingen rad hoppas över och ingen kommer två gånger.
 */
const SIDA = 1000;
async function hamtaAlla<T>(
  fraga: (fran: number, till: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const alla: T[] = [];
  for (let fran = 0; ; fran += SIDA) {
    const { data, error } = await fraga(fran, fran + SIDA - 1);
    if (error) throw error;
    alla.push(...(data ?? []));
    if (!data || data.length < SIDA) return alla;
  }
}

export async function loadCatalog(): Promise<ProductRow[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const [products, specs] = await Promise.all([
      hamtaAlla((fran, till) => supabase
        .from("products")
        // SECURITY: purchase_price + margin are internal commercial data and are
        // deliberately NOT selected here — this query runs with the anon key in
        // the browser. Admin pricing reads them separately as an authenticated
        // admin. The DB also REVOKEs these columns from the anon role.
        .select(
          "id,sku,name,description,family,lead_time_days,availability,ip_rating,fieldbus,voltage,image_url,weight_kg,length_mm,width_mm,height_mm,brand:brands(slug,name),category:categories(slug,name)",
        )
        .eq("status", "active")
        .order("id")
        .range(fran, till)),
      hamtaAlla((fran, till) => supabase
        .from("product_specs")
        .select("product_id,key,value,unit")
        .order("id")
        .range(fran, till)),
    ]);
    if (!products.length) throw new Error("No products");
    const specMap = new Map<string, ProductRow["specs"]>();
    for (const s of specs ?? []) {
      const m = specMap.get(s.product_id) ?? {};
      m[s.key] = { value: s.value, unit: s.unit };
      specMap.set(s.product_id, m);
    }
    cache = (products as unknown as ProductRow[]).map((p) => ({
      ...p,
      specs: specMap.get(p.id) ?? {},
    }));
    return cache;
  })();
  return inflight;
}

export function clearCatalogCache() {
  cache = null;
  inflight = null;
}

export function bySku(catalog: ProductRow[], sku: string) {
  return catalog.find((p) => p.sku === sku);
}
export function byCategory(catalog: ProductRow[], slug: string) {
  return catalog.filter((p) => p.category.slug === slug);
}
export function specNum(p: ProductRow, key: string): number | null {
  const v = p.specs?.[key]?.value;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
