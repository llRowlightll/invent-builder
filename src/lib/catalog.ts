import { supabase } from "@/integrations/supabase/client";
import type { ProductRow } from "./types";

let cache: ProductRow[] | null = null;
let inflight: Promise<ProductRow[]> | null = null;

export async function loadCatalog(): Promise<ProductRow[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const [{ data: products, error }, { data: specs }] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id,sku,name,description,family,lead_time_days,availability,ip_rating,fieldbus,voltage,image_url,brand:brands(slug,name),category:categories(slug,name)",
        )
        .eq("status", "active")
        .limit(1000),
      supabase.from("product_specs").select("product_id,key,value,unit").limit(5000),
    ]);
    if (error || !products) throw error ?? new Error("No products");
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
  const v = p.specs[key]?.value;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
