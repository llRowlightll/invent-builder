import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { GUIDES } from "@/lib/guides";

const BASE = "https://maskinval.se";
const LOCALES = ["sv", "en", "de", "es"];

const STATIC_PATHS = [
  "",
  "/products",
  "/chat",
  "/advisor",
  "/compare",
  "/machine-builder",
  "/configure",
  "/guider",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env.SUPABASE_URL ?? "";
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

        let products: { sku: string; updated_at: string | null }[] = [];
        let cats: string[] = [];
        let families: string[] = [];

        if (supabaseUrl && supabaseKey) {
          const sb = createClient(supabaseUrl, supabaseKey);
          const [{ data: prods }, { data: categories }, { data: fams }] = await Promise.all([
            sb.from("products").select("sku, updated_at").eq("status", "active"),
            sb.from("categories").select("slug"),
            sb.from("configurator_families").select("slug"),
          ]);
          products = (prods ?? []) as { sku: string; updated_at: string | null }[];
          cats = (categories ?? []).map((c) => c.slug);
          families = (fams ?? []).map((f) => f.slug);
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
          for (const p of products) {
            const lm = p.updated_at ? p.updated_at.slice(0, 10) : today;
            urls.push(url(`/${locale}/product/${encodeURIComponent(p.sku)}`, lm, "monthly", "0.9"));
          }
          // Configurator pages — custom-build landing pages, strong long-tail SEO
          for (const fam of families) {
            urls.push(url(`/${locale}/configurator/${encodeURIComponent(fam)}`, today, "monthly", "0.7"));
          }
          // Buying guides — long-tail SEO content
          for (const g of GUIDES) {
            urls.push(url(`/${locale}/guider/${g.slug}`, today, "monthly", "0.6"));
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
  const match = path.match(/^\/(sv|en|de|es)(\/.*)?$/);
  const hreflang = match
    ? `  <xhtml:link rel="alternate" hreflang="sv" href="${BASE}/sv${match[2] ?? ""}"/>
  <xhtml:link rel="alternate" hreflang="en" href="${BASE}/en${match[2] ?? ""}"/>
  <xhtml:link rel="alternate" hreflang="de" href="${BASE}/de${match[2] ?? ""}"/>
  <xhtml:link rel="alternate" hreflang="es" href="${BASE}/es${match[2] ?? ""}"/>
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
