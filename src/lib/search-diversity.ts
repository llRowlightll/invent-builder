/**
 * Brand diversity algorithm for search results.
 *
 * Problem: Festo has the most products → without diversity, top-N results
 * are often all Festo. Users can't compare brands.
 *
 * Solution: Score each product for relevance, then interleave brands
 * round-robin so the first visible results always show multiple brands.
 */

import type { ProductRow } from "./types";
import type { AiSearchResult } from "./ai.functions";

/** Score a single product against the query context (higher = better match). */
function scoreProduct(
  p: ProductRow,
  aiResult: AiSearchResult,
  boreMin?: number,
  boreMax?: number,
  strokeMin?: number
): number {
  let score = 0;
  const nameUpper = (p.name + " " + p.sku).toLowerCase();
  const descLower = (p.description ?? "").toLowerCase();

  // Keyword hits in name (strong signal)
  for (const kw of aiResult.keywords ?? []) {
    const kwl = kw.toLowerCase();
    if (nameUpper.includes(kwl)) score += 4;
    else if (descLower.includes(kwl)) score += 1;
  }

  // Spec matches
  for (const sf of aiResult.spec_filters ?? []) {
    const specVal = p.specs[sf.key]?.value;
    if (specVal === undefined) continue;
    const num = parseFloat(specVal);
    if (!Number.isFinite(num)) continue;
    if (sf.min !== undefined && num >= sf.min) score += 3;
    if (sf.max !== undefined && num <= sf.max) score += 2;
    if (sf.exact !== undefined && specVal === sf.exact) score += 5;
  }

  // Bore match from physics layer
  if (boreMin !== undefined || boreMax !== undefined) {
    const bore = parseFloat(p.specs["bore_mm"]?.value ?? "0");
    if (bore > 0) {
      if (boreMin !== undefined && bore >= boreMin) score += 3;
      if (boreMax !== undefined && bore <= boreMax) score += 2;
    }
  }

  // Stroke match
  if (strokeMin !== undefined) {
    const stroke = parseFloat(p.specs["stroke_max"]?.value ?? p.specs["stroke_mm"]?.value ?? "0");
    if (stroke >= strokeMin) score += 2;
  }

  // Faster lead time is a small tie-breaker
  score += Math.max(0, 10 - (p.lead_time_days ?? 14));

  return score;
}

/**
 * Apply brand diversity to a list of products.
 *
 * 1. Score every product for relevance
 * 2. Sort each brand's products by score descending
 * 3. Round-robin interleave: take the top product from each brand in turn
 * 4. Cap at maxPerBrand per brand in the final output
 *
 * Result: first N results always show different brands if stock allows.
 */
export function diversifyResults(
  products: ProductRow[],
  aiResult: AiSearchResult,
  opts: {
    total?: number;        // max results to return (default 8)
    maxPerBrand?: number;  // max per brand in final list (default 2)
    boreMin?: number;
    boreMax?: number;
    strokeMin?: number;
  } = {}
): ProductRow[] {
  const { total = 8, maxPerBrand = 2 } = opts;

  if (products.length === 0) return [];

  // 1. Score + group by brand
  const byBrand = new Map<string, { product: ProductRow; score: number }[]>();
  for (const p of products) {
    const score = scoreProduct(p, aiResult, opts.boreMin, opts.boreMax, opts.strokeMin);
    const arr = byBrand.get(p.brand.slug) ?? [];
    arr.push({ product: p, score });
    byBrand.set(p.brand.slug, arr);
  }

  // 2. Sort each brand's products by score desc
  for (const arr of byBrand.values()) {
    arr.sort((a, b) => b.score - a.score);
  }

  // 3. Sort brands by their top product score (best-matching brand first)
  const brandOrder = Array.from(byBrand.entries()).sort(
    (a, b) => (b[1][0]?.score ?? 0) - (a[1][0]?.score ?? 0)
  );

  // 4. Round-robin interleave
  const result: ProductRow[] = [];
  const brandCounts = new Map<string, number>();
  let round = 0;

  while (result.length < total) {
    let addedThisRound = false;
    for (const [brandSlug, items] of brandOrder) {
      const alreadyAdded = brandCounts.get(brandSlug) ?? 0;
      if (alreadyAdded >= maxPerBrand) continue;
      if (round >= items.length) continue;

      result.push(items[round].product);
      brandCounts.set(brandSlug, alreadyAdded + 1);
      addedThisRound = true;
      if (result.length >= total) break;
    }
    if (!addedThisRound) break;
    round++;
  }

  return result;
}
