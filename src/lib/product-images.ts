// Reliable photo CDN via picsum.photos — seed ensures same image per category/brand every time
// Format: https://picsum.photos/seed/{seed}/{w}/{h}

const W = 480, H = 320, SQ = 300;

// Seeds chosen to consistently return industrial/technical-looking photos
const CATEGORY_SEEDS: Record<string, string> = {
  "cylinder":          "pneumatic-cylinder",
  "electric-actuator": "electric-actuator",
  "valve":             "industrial-valve",
  "valve-terminal":    "valve-terminal",
  "gripper":           "robotic-gripper",
  "vacuum":            "vacuum-system",
  "air-preparation":   "compressed-air",
  "hose":              "industrial-hose",
  "fitting":           "pipe-fitting",
  "speed-controller":  "flow-controller",
  "coupling":          "shaft-coupling",
  "seal-kit":          "mechanical-seal",
  "linear-module":     "linear-module",
};

const BRAND_SEEDS: Record<string, string> = {
  "festo":         "festo-automation",
  "smc":           "smc-pneumatics",
  "parker":        "parker-hannifin",
  "bosch-rexroth": "bosch-rexroth",
  "norgren":       "norgren-industrial",
};

const FALLBACK_SEED = "industrial-automation";

export function getCategoryImage(categorySlug: string, square = false): string {
  const seed = CATEGORY_SEEDS[categorySlug] ?? FALLBACK_SEED;
  return square
    ? `https://picsum.photos/seed/${seed}/${SQ}/${SQ}`
    : `https://picsum.photos/seed/${seed}/${W}/${H}`;
}

export function getBrandImage(brandSlug: string): string {
  const seed = BRAND_SEEDS[brandSlug] ?? FALLBACK_SEED;
  return `https://picsum.photos/seed/${seed}/${W}/${H}`;
}

export function getProductImage(
  product: { category: { slug: string }; brand: { slug: string } },
  square = false
): string {
  return getCategoryImage(product.category.slug, square);
}
