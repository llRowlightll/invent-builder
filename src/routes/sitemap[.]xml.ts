import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://maskinval.lovable.app";
const LOCALES = ["sv", "en"];

const STATIC_PATHS = [
  "",
  "/products",
  "/chat",
  "/advisor",
  "/compare",
  "/machine-builder",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env.SUPABASE_URL ?? "";
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

        let skus: string[] = [];
        let cats: string[] = [];

        if (supabaseUrl && supabaseKey) {
          const sb = createClient(supabaseUrl, supabaseKey);
          const [{ data: products }, { data: categories }] = await Promise.all([
            sb.from("products").select("sku, updated_at"),
            sb.from("categories").select("slug"),
          ]);
          skus = (products ?? []).map((p) => p.sku);
          cats = (categories ?? []).map((c) => c.slug);
        }

        const today = new Date().toISOString().split("T")[0];

        const urls: string[] = [];

        // Root redirect
        urls.push(url("/", today, "weekly", "1.0"));

        // Static pages per locale
        for (const locale of LOCALES) {
          for (const path of STATIC_PATHS) {
            urls.push(url(`/${locale}${path}`, today, "weekly", path === "" ? "1.0" : "0.8"));
          }
          // Category filter pages
          for (const cat of cats) {
            urls.push(url(`/${locale}/products?category=${cat}`, today, "weekly", "0.7"));
          }
          // Product detail pages
          for (const sku of skus) {
            urls.push(url(`/${locale}/product/${encodeURIComponent(sku)}`, today, "monthly", "0.9"));
          }
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

function url(path: string, lastmod: string, changefreq: string, priority: string) {
  const loc = `${BASE}${path}`;
  // Add hreflang alternates for locale paths
  const match = path.match(/^\/(sv|en)(\/.*)?$/);
  const hreflang = match
    ? `  <xhtml:link rel="alternate" hreflang="sv" href="${BASE}/sv${match[2] ?? ""}"/>
  <xhtml:link rel="alternate" hreflang="en" href="${BASE}/en${match[2] ?? ""}"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/sv${match[2] ?? ""}"/>`
    : "";

  return `<url>
  <loc>${loc}</loc>
  <lastmod>${lastmod}</lastmod>
  <changefreq>${changefreq}</changefreq>
  <priority>${priority}</priority>
${hreflang}
</url>`;
}
