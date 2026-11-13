import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { loadCatalog } from "@/lib/catalog";
import { categoryName } from "@/lib/categories";
import { borrningar, cylindergrupp, gruppnamn, likvardigaCylindrar, motsvarighetsrepresentant } from "@/lib/likvardiga";
import { hittaArtikel } from "@/lib/ersattning";
import { SITE, hreflangLinks } from "@/lib/site";
import { produktnamn, specVarde } from "@/lib/spec-format";
import type { ProductRow } from "@/lib/types";

/**
 * Motsvarighet till en cylinder: samma typ i andra fabrikat, i en tabell.
 *
 * Varför en egen sida: en konstruktör som har en artikel med lång
 * leveranstid, eller en som utgått, söker "motsvarighet till <artikel>".
 * Tillverkarna visar bara sitt eget sortiment. Urvalet är detsamma som
 * produktsidans (likvardiga.ts): samma cylindertyp och en borrning som
 * verkligen finns hos kandidaten. Sidan påstår inget mer än det -- montage-
 * mått, gänga och givarspår står som något att kontrollera.
 */

type Rad = { p: ProductRow; etikett: string | null };
type Data = { produkt: ProductRow | null; rader: Rad[]; grupp: string | null; representant: string | null };

const TEXT: Record<string, {
  titel: (namn: string) => string; ingress: (n: number, typ: string, borr: string) => string; ingen: string;
  fabrikat: string; artikel: string; varfor: string; borrning: string; slag: string; tryck: string; temp: string;
  dampning: string; magnet: string; original: string; kontrollera: string; jamfor: string; ersatt: string;
  produkten: string; metaBeskrivning: (namn: string, n: number, marken: string) => string; titelSuffix: string;
}> = {
  sv: {
    titel: (n) => `Motsvarighet till ${n}`,
    ingress: (n, typ, borr) => `${n} ${n === 1 ? "cylinder" : "cylindrar"} i andra fabrikat av samma typ (${typ})${borr ? ` som finns i ${borr}` : ""}. Urvalet bygger på cylindertyp och borrning i tillverkarnas katalogdata.`,
    ingen: "Vi har ingen motsvarighet av samma typ och storlek i katalogen ännu. Prova verktyget Ersätt en komponent, eller fråga oss.",
    fabrikat: "Fabrikat", artikel: "Artikel", varfor: "Varför den motsvarar", borrning: "Borrning", slag: "Slaglängd",
    tryck: "Max tryck", temp: "Temperatur", dampning: "Dämpning", magnet: "Magnetkolv", original: "Din artikel",
    kontrollera: "Kontrollera monteringsmått, kolvstångsgänga, anslutning och givarspår mot tillverkarens datablad före byte. Samma typ och borrning betyder inte att allt passar utan ändring.",
    jamfor: "Jämför i detalj", ersatt: "Ersätt en annan artikel", produkten: "Till produktsidan",
    metaBeskrivning: (namn, n, m) => `${n} motsvarigheter till ${namn}${m ? ` från ${m}` : ""}: samma cylindertyp och borrning. Jämför slag, tryck, temperatur och dämpning sida vid sida.`,
    titelSuffix: "motsvarigheter | Maskinval",
  },
  en: {
    titel: (n) => `Equivalent to ${n}`,
    ingress: (n, typ, borr) => `${n} ${n === 1 ? "cylinder" : "cylinders"} from other brands of the same type (${typ})${borr ? ` available in ${borr}` : ""}. The selection is based on cylinder type and bore in the manufacturers' catalogue data.`,
    ingen: "We have no equivalent of the same type and size in the catalogue yet. Try the Replace a component tool, or ask us.",
    fabrikat: "Brand", artikel: "Article", varfor: "Why it matches", borrning: "Bore", slag: "Stroke",
    tryck: "Max pressure", temp: "Temperature", dampning: "Cushioning", magnet: "Magnetic piston", original: "Your article",
    kontrollera: "Check mounting dimensions, rod thread, ports and sensor slots against the manufacturer's data sheet before replacing. Same type and bore does not mean everything fits without changes.",
    jamfor: "Compare in detail", ersatt: "Replace another article", produkten: "To the product page",
    metaBeskrivning: (namn, n, m) => `${n} equivalents to ${namn}${m ? ` from ${m}` : ""}: same cylinder type and bore. Compare stroke, pressure, temperature and cushioning side by side.`,
    titelSuffix: "equivalents | Maskinval",
  },
  de: {
    titel: (n) => `Alternative zu ${n}`,
    ingress: (n, typ, borr) => `${n} ${n === 1 ? "Zylinder" : "Zylinder"} anderer Hersteller vom selben Typ (${typ})${borr ? `, erhältlich in ${borr}` : ""}. Die Auswahl beruht auf Zylindertyp und Kolbendurchmesser in den Katalogdaten der Hersteller.`,
    ingen: "Für diesen Typ und diese Größe haben wir noch keine Alternative im Katalog. Nutzen Sie „Komponente ersetzen“ oder fragen Sie uns.",
    fabrikat: "Hersteller", artikel: "Artikel", varfor: "Warum gleichwertig", borrning: "Kolben-Ø", slag: "Hub",
    tryck: "Max. Druck", temp: "Temperatur", dampning: "Dämpfung", magnet: "Magnetkolben", original: "Ihr Artikel",
    kontrollera: "Prüfen Sie Anbaumaße, Kolbenstangengewinde, Anschlüsse und Sensornuten vor dem Tausch am Datenblatt des Herstellers.",
    jamfor: "Im Detail vergleichen", ersatt: "Anderen Artikel ersetzen", produkten: "Zur Produktseite",
    metaBeskrivning: (namn, n, m) => `${n} Alternativen zu ${namn}${m ? ` von ${m}` : ""}: gleicher Zylindertyp und Kolbendurchmesser. Hub, Druck, Temperatur und Dämpfung im Vergleich.`,
    titelSuffix: "Alternativen | Maskinval",
  },
  es: {
    titel: (n) => `Equivalente a ${n}`,
    ingress: (n, typ, borr) => `${n} ${n === 1 ? "cilindro" : "cilindros"} de otras marcas del mismo tipo (${typ})${borr ? ` disponibles en ${borr}` : ""}. La selección se basa en el tipo de cilindro y el diámetro en los datos de catálogo de los fabricantes.`,
    ingen: "Aún no tenemos un equivalente del mismo tipo y tamaño en el catálogo. Pruebe la herramienta Sustituir un componente o pregúntenos.",
    fabrikat: "Marca", artikel: "Artículo", varfor: "Por qué equivale", borrning: "Diámetro", slag: "Carrera",
    tryck: "Presión máx.", temp: "Temperatura", dampning: "Amortiguación", magnet: "Pistón magnético", original: "Su artículo",
    kontrollera: "Compruebe medidas de montaje, rosca del vástago, conexiones y ranuras de sensor en la hoja de datos del fabricante antes de sustituir.",
    jamfor: "Comparar en detalle", ersatt: "Sustituir otro artículo", produkten: "A la página del producto",
    metaBeskrivning: (namn, n, m) => `${n} equivalentes a ${namn}${m ? ` de ${m}` : ""}: mismo tipo de cilindro y diámetro. Compare carrera, presión, temperatura y amortiguación.`,
    titelSuffix: "equivalentes | Maskinval",
  },
};

function visningsnamn(p: ProductRow, locale: string): string {
  const namn = produktnamn(p, locale);
  return namn.toLowerCase().startsWith(p.brand.name.toLowerCase()) ? namn : `${p.brand.name} ${namn}`;
}

/** Fabrikaten bland motsvarigheterna, i ordning, utan dubbletter. */
function fabrikatLista(rader: Rad[]): string {
  return [...new Set(rader.map((r) => r.p.brand.name))].slice(0, 4).join(", ");
}

export const Route = createFileRoute("/$locale/motsvarighet/$sku")({
  loader: async ({ params }): Promise<Data> => {
    let katalog: ProductRow[] = [];
    try {
      katalog = await loadCatalog();
    } catch {
      return { produkt: null, rader: [], grupp: null, representant: null };
    }
    // Typskyltens kod är sällan vårt artikelnummer. Kundgranskningen
    // 2026-11-13: /motsvarighet/DSBC-50-200-PPVA-N3 sa "ingen motsvarighet"
    // fast tre exakta Ø50×200 ISO 15552 finns. Typbeteckningar (QSM-1/8-4)
    // hittas via hittaArtikel; orderkoder går till Ersätt, som läser
    // borrning och slag ur koden.
    const produkt = katalog.find((p) => p.sku === params.sku) ?? hittaArtikel(params.sku, katalog);
    if (!produkt) throw redirect({ to: "/$locale/replace", params: { locale: params.locale }, search: { kod: params.sku } as never });
    const sv = params.locale === "sv";
    const lika = likvardigaCylindrar(produkt, katalog, 8) ?? [];
    const g = cylindergrupp(produkt);
    return {
      produkt,
      rader: lika.map((x) => ({ p: x.p, etikett: sv ? x.etikett.sv : x.etikett.en })),
      grupp: g ? gruppnamn(g.grupp, sv) : null,
      representant: motsvarighetsrepresentant(produkt, katalog).sku,
    };
  },
  head: ({ params, loaderData }) => {
    const x = TEXT[params.locale] ?? TEXT.en;
    const d = loaderData as Data | undefined;
    // Syskon i samma familj och storlek har samma motsvarigheter: de pekar på
    // representantens sida i stället för att bli likadana sidor.
    const kanon = d?.representant ?? params.sku;
    const canonical = `${SITE}/${params.locale}/motsvarighet/${encodeURIComponent(kanon)}`;
    const namn = d?.produkt ? visningsnamn(d.produkt, params.locale) : params.sku;
    const n = d?.rader.length ?? 0;
    const title = `${x.titel(namn)} (${params.sku}) — ${x.titelSuffix}`;
    const desc = x.metaBeskrivning(namn, n, d ? fabrikatLista(d.rader) : "");
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        // Utan motsvarigheter är sidan tunn: den ska inte indexeras.
        ...(n === 0 ? [{ name: "robots", content: "noindex,follow" }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: canonical },
      ],
      links: [{ rel: "canonical", href: canonical }, ...hreflangLinks(`motsvarighet/${encodeURIComponent(kanon)}`)],
      scripts: d?.produkt && n > 0 ? [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: x.titel(namn),
          itemListElement: d.rader.map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE}/${params.locale}/product/${encodeURIComponent(r.p.sku)}`,
            name: visningsnamn(r.p, params.locale),
          })),
        }),
      }] : [],
    };
  },
  component: Motsvarighet,
});

function Motsvarighet() {
  const { locale, sku } = Route.useParams();
  const { produkt, rader, grupp } = Route.useLoaderData() as unknown as Data;
  const x = TEXT[locale] ?? TEXT.en;

  if (!produkt) {
    return (
      <div className="container-page py-16 text-sm">
        <p>{x.ingen}</p>
        <Link to="/$locale/replace" params={{ locale }} className="mt-4 inline-block text-info hover:underline">{x.ersatt} →</Link>
      </div>
    );
  }

  const b = borrningar(produkt.specs?.bore_mm?.value);
  const borr = b.enstaka.length === 1 && b.intervall.length === 0 ? `Ø${b.enstaka[0]}` : "";
  const namn = visningsnamn(produkt, locale);
  const v = (p: ProductRow, k: string) => (p.specs?.[k]?.value ? specVarde(k, p.specs[k], locale) : "—");

  return (
    <div className="container-page py-10 max-w-6xl">
      <div className="flex items-center gap-2 text-info"><ArrowLeftRight className="size-5" aria-hidden /></div>
      <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">{x.titel(namn)}</h1>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{produkt.sku} · {categoryName(produkt.category.slug, locale, produkt.category.name)}</p>

      {rader.length === 0 ? (
        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">{x.ingen}</p>
      ) : (
        <>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground leading-relaxed">{x.ingress(rader.length, grupp ?? "", borr)}</p>
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-surface-alt text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{x.fabrikat}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{x.artikel}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{x.varfor}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{x.borrning}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{x.slag}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{x.tryck}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{x.temp}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{x.dampning}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{x.magnet}</th>
                </tr>
              </thead>
              <tbody>
                {[{ p: produkt, etikett: x.original }, ...rader].map((r, i) => (
                  <tr key={r.p.sku} className={`border-t border-border align-top ${i === 0 ? "bg-info-surface/40" : ""}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{r.p.brand.name}</td>
                    <td className="px-3 py-2">
                      <Link to="/$locale/product/$sku" params={{ locale, sku: r.p.sku }} className="text-info hover:underline">
                        {produktnamn(r.p, locale)}
                      </Link>
                      <div className="font-mono text-[11px] text-muted-foreground">{r.p.sku}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.etikett}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{v(r.p, "bore_mm")}</td>
                    <td className="px-3 py-2">{v(r.p, "stroke_mm")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{v(r.p, "max_pressure")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{v(r.p, "temp_range")}</td>
                    <td className="px-3 py-2 text-xs">{v(r.p, "cushioning")}</td>
                    <td className="px-3 py-2 text-xs">{v(r.p, "magnetic_piston")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-xs text-muted-foreground leading-relaxed">{x.kontrollera}</p>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link to="/$locale/product/$sku" params={{ locale, sku }} className="rounded-md border border-border px-3 py-1.5 hover:border-info hover:text-info">{x.produkten}</Link>
        {rader.length > 0 && (
          <Link
            to="/$locale/compare"
            params={{ locale }}
            search={{ skus: [produkt.sku, ...rader.slice(0, 3).map((r) => r.p.sku)].join(",") }}
            className="rounded-md border border-border px-3 py-1.5 hover:border-info hover:text-info"
          >
            {x.jamfor}
          </Link>
        )}
        <Link to="/$locale/replace" params={{ locale }} className="rounded-md border border-border px-3 py-1.5 hover:border-info hover:text-info">{x.ersatt}</Link>
      </div>
    </div>
  );
}

