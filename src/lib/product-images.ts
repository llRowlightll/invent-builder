// Curated Unsplash photo IDs for each product category
// Format: https://images.unsplash.com/photo-{ID}?w=480&h=320&fit=crop&auto=format&q=80

const BASE = "https://images.unsplash.com/photo-";
const PARAMS = "?w=480&h=320&fit=crop&auto=format&q=80";
const PARAMS_SQ = "?w=300&h=300&fit=crop&auto=format&q=80";

const CATEGORY_IDS: Record<string, string> = {
  "cylinder":         "rvW0PU64oNY", // Real pneumatic cylinder with pressure gauges
  "electric-actuator":"1565088534245-05d6b5be184a", // Industrial linear machinery
  "valve":            "T7yBuok2ABg", // Industrial machine with valve/gauge
  "valve-terminal":   "FJfHlfT2ymk", // Silver & black electronic components/manifold
  "gripper":          "OO7fpg8bWgo", // Precision metal tooling
  "vacuum":           "g0cZjTfWquc", // Industrial vacuum/suction equipment
  "air-preparation":  "Gn099dzM3KA", // Industrial pipes and pressure equipment
  "hose":             "nab_idBlLtY", // Industrial tubes and hoses on shelf
  "fitting":          "9AxFJaNySB8", // Close-up metal tube connections
  "speed-controller": "qOl9_4WfInY", // Metal precision tool/controller
  "coupling":         "5bpOMmr_MdI", // White industrial cylinders/couplings
  "seal-kit":         "j0pHvwXPUMQ", // Gray metal precision components
  "linear-module":    "mMgC9U15XR0", // Industrial machinery floor
};

// Per-brand hero images (used on product detail pages)
const BRAND_IDS: Record<string, string> = {
  "festo":        "Bg3g5PqqD54", // Precision automation factory floor
  "smc":          "4nfPgBofTs4", // Automated conveyor/warehouse system
  "parker":       "NDv3QO5QQvI", // Automotive assembly plant
  "bosch-rexroth":"_vM02FsfKfU", // Industrial laser/precision machinery
  "norgren":      "mMgC9U15XR0", // Industrial machinery
};

const FALLBACK_ID = "mMgC9U15XR0"; // Industrial machinery default

export function getCategoryImage(categorySlug: string, square = false): string {
  const id = CATEGORY_IDS[categorySlug] ?? FALLBACK_ID;
  const params = square ? PARAMS_SQ : PARAMS;
  return `${BASE}${id}${params}`;
}

export function getBrandImage(brandSlug: string): string {
  const id = BRAND_IDS[brandSlug] ?? FALLBACK_ID;
  return `${BASE}${id}${PARAMS}`;
}

export function getProductImage(product: {
  category: { slug: string };
  brand: { slug: string };
}, square = false): string {
  return getCategoryImage(product.category.slug, square);
}
