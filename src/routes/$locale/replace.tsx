import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Camera, RefreshCw, Search } from "lucide-react";
import { loadCatalog } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { aiLasTypskylt } from "@/lib/ai.functions";
import type { ProductRow } from "@/lib/types";
import { addToShoppingList } from "@/lib/cart";
import { SITE, hreflangLinks } from "@/lib/site";
import { produktnamn, specEtikett, specVarde } from "@/lib/spec-format";
import { ArticleNumber } from "@/components/ArticleNumber";
import { identifiera, motsvarigheter, sammaVarde, type Identifiering, type Kandidat } from "@/lib/ersattning";
import { logga } from "@/lib/matning";
import type { FamilyBrief } from "../../../supabase/functions/groq-advisor/order-code.ts";

type Text = {
  titel: string; ingress: string; falt: string; sok: string; fota: string; laserFoto: string;
  fotoFel: string; laddar: string; kanns: string; okand: string; okandText: string;
  finns: string; motsvarigheter: string; ingaStandard: string; ingaTraffar: string;
  fragaAi: string; katalog: string; isoNot: string; serie: (max: number | null) => string;
  din: string; visa: string; lagg: string; lagd: string; metaBeskrivning: string;
  kolumner: { fabrikat: string; artikel: string };
};

const TEXT: Record<string, Text> = {
  sv: {
    titel: "Ersätt en komponent",
    ingress: "Skriv artikelnumret eller typkoden från den gamla komponenten, eller fota typskylten. Du får samma artikel om vi har den, och motsvarigheter från andra fabrikat med skillnaderna utskrivna.",
    falt: "t.ex. DSBC-32-100-PPVA-N3 eller 0822120004", sok: "Sök", fota: "Fota typskylten",
    laserFoto: "Läser typskylten…", fotoFel: "Typskylten gick inte att läsa. Skriv koden i stället.",
    laddar: "Laddar katalogen…", kanns: "Det här är",
    okand: "Vi känner inte igen koden",
    okandText: "Den finns inte i katalogen och går inte att läsa som en orderkod. Beskriv i stället vad komponenten gör, så hittar AI-ingenjören en ersättare.",
    finns: "Samma artikel finns hos oss", motsvarigheter: "Motsvarigheter från andra fabrikat",
    ingaStandard: "Komponenten följer ingen ISO-standard, så det finns ingen motsvarighet med samma infästningsmått. Beskriv applikationen för AI-ingenjören, så väljer den en ersättare efter kraven.",
    ingaTraffar: "Vi har ingen motsvarighet med samma standard och borrning i katalogen ännu.",
    fragaAi: "Fråga AI-ingenjören", katalog: "Sök i katalogen",
    isoNot: "Samma ISO-standard betyder samma infästningsmått mellan fabrikat. Kontrollera ändå kolvstångsgänga, dämpning och givarspår innan du beställer.",
    serie: (max) => `Väljs vid beställning${max ? ` (upp till ${max} mm)` : ""}`,
    din: "Din komponent", visa: "Visa", lagg: "+ Lägg i korg", lagd: "✓ I korgen",
    metaBeskrivning: "Ersätt en trasig eller utgången pneumatisk komponent: skriv artikelnumret eller fota typskylten och få samma artikel eller motsvarigheter från Festo, SMC, Parker, AVENTICS, Norgren, Metal Work och Camozzi.",
    kolumner: { fabrikat: "Fabrikat", artikel: "Artikel" },
  },
  en: {
    titel: "Replace a component",
    ingress: "Type the part number or type code from the old component, or photograph the nameplate. You get the same part if we stock it, and equivalents from other brands with the differences spelled out.",
    falt: "e.g. DSBC-32-100-PPVA-N3 or 0822120004", sok: "Search", fota: "Photograph the nameplate",
    laserFoto: "Reading the nameplate…", fotoFel: "The nameplate could not be read. Type the code instead.",
    laddar: "Loading the catalogue…", kanns: "This is",
    okand: "We don't recognise the code",
    okandText: "It is not in the catalogue and cannot be read as an order code. Describe what the component does instead, and the AI engineer will find a replacement.",
    finns: "We stock the same part", motsvarigheter: "Equivalents from other brands",
    ingaStandard: "The component does not follow an ISO standard, so there is no equivalent with the same mounting dimensions. Describe the application to the AI engineer and it will choose a replacement from the requirements.",
    ingaTraffar: "We do not yet have an equivalent with the same standard and bore in the catalogue.",
    fragaAi: "Ask the AI engineer", katalog: "Search the catalogue",
    isoNot: "The same ISO standard means the same mounting dimensions across brands. Still check the piston rod thread, cushioning and sensor slots before ordering.",
    serie: (max) => `Chosen at order${max ? ` (up to ${max} mm)` : ""}`,
    din: "Your component", visa: "View", lagg: "+ Add to list", lagd: "✓ Added",
    metaBeskrivning: "Replace a broken or discontinued pneumatic component: type the part number or photograph the nameplate and get the same part or equivalents from Festo, SMC, Parker, AVENTICS, Norgren, Metal Work and Camozzi.",
    kolumner: { fabrikat: "Brand", artikel: "Part" },
  },
  de: {
    titel: "Komponente ersetzen",
    ingress: "Geben Sie die Artikelnummer oder den Typcode der alten Komponente ein oder fotografieren Sie das Typenschild. Sie erhalten denselben Artikel, falls vorhanden, und Entsprechungen anderer Hersteller mit den Unterschieden.",
    falt: "z. B. DSBC-32-100-PPVA-N3 oder 0822120004", sok: "Suchen", fota: "Typenschild fotografieren",
    laserFoto: "Typenschild wird gelesen…", fotoFel: "Das Typenschild konnte nicht gelesen werden. Geben Sie den Code ein.",
    laddar: "Katalog wird geladen…", kanns: "Das ist",
    okand: "Code nicht erkannt",
    okandText: "Er ist nicht im Katalog und lässt sich nicht als Bestellcode lesen. Beschreiben Sie stattdessen, was die Komponente tut, dann findet der KI-Ingenieur einen Ersatz.",
    finns: "Derselbe Artikel ist verfügbar", motsvarigheter: "Entsprechungen anderer Hersteller",
    ingaStandard: "Die Komponente folgt keiner ISO-Norm, daher gibt es keine Entsprechung mit denselben Befestigungsmaßen. Beschreiben Sie die Anwendung dem KI-Ingenieur.",
    ingaTraffar: "Im Katalog gibt es noch keine Entsprechung mit derselben Norm und Bohrung.",
    fragaAi: "KI-Ingenieur fragen", katalog: "Im Katalog suchen",
    isoNot: "Dieselbe ISO-Norm bedeutet dieselben Befestigungsmaße über Hersteller hinweg. Prüfen Sie dennoch Kolbenstangengewinde, Dämpfung und Sensornuten.",
    serie: (max) => `Bei Bestellung wählbar${max ? ` (bis ${max} mm)` : ""}`,
    din: "Ihre Komponente", visa: "Ansehen", lagg: "+ Zur Liste", lagd: "✓ Hinzugefügt",
    metaBeskrivning: "Defekte oder abgekündigte Pneumatikkomponente ersetzen: Artikelnummer eingeben oder Typenschild fotografieren.",
    kolumner: { fabrikat: "Hersteller", artikel: "Artikel" },
  },
  es: {
    titel: "Sustituir un componente",
    ingress: "Escriba la referencia o el código del componente antiguo, o fotografíe la placa. Obtendrá la misma pieza si la tenemos y equivalentes de otros fabricantes con las diferencias indicadas.",
    falt: "p. ej. DSBC-32-100-PPVA-N3 o 0822120004", sok: "Buscar", fota: "Fotografiar la placa",
    laserFoto: "Leyendo la placa…", fotoFel: "No se pudo leer la placa. Escriba el código.",
    laddar: "Cargando el catálogo…", kanns: "Esto es",
    okand: "No reconocemos el código",
    okandText: "No está en el catálogo y no se puede leer como código de pedido. Describa qué hace el componente y el ingeniero de IA encontrará un sustituto.",
    finns: "Tenemos la misma pieza", motsvarigheter: "Equivalentes de otros fabricantes",
    ingaStandard: "El componente no sigue ninguna norma ISO, por lo que no hay equivalente con las mismas dimensiones de montaje. Describa la aplicación al ingeniero de IA.",
    ingaTraffar: "Todavía no tenemos un equivalente con la misma norma y diámetro en el catálogo.",
    fragaAi: "Preguntar al ingeniero de IA", katalog: "Buscar en el catálogo",
    isoNot: "La misma norma ISO significa las mismas dimensiones de montaje entre fabricantes. Compruebe aun así la rosca del vástago, la amortiguación y las ranuras de sensor.",
    serie: (max) => `Se elige al pedir${max ? ` (hasta ${max} mm)` : ""}`,
    din: "Su componente", visa: "Ver", lagg: "+ Añadir", lagd: "✓ Añadido",
    metaBeskrivning: "Sustituya un componente neumático averiado o descatalogado: escriba la referencia o fotografíe la placa.",
    kolumner: { fabrikat: "Fabricante", artikel: "Pieza" },
  },
};

// Det en ersättare måste stämma i, i den ordning en ingenjör läser.
const JAMFOR = ["bore_mm", "stroke_mm", "standard", "cushioning_types", "position_sensing", "max_pressure", "temp_range"] as const;

export const Route = createFileRoute("/$locale/replace")({
  validateSearch: z.object({ kod: z.string().optional() }),
  head: ({ params }) => {
    const x = TEXT[params.locale] ?? TEXT.en;
    return {
      meta: [
        { title: `${x.titel} — Maskinval` },
        { name: "description", content: x.metaBeskrivning },
        { property: "og:title", content: `${x.titel} — Maskinval` },
        { property: "og:description", content: x.metaBeskrivning },
        { property: "og:url", content: `${SITE}/${params.locale}/replace` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/${params.locale}/replace` }, ...hreflangLinks("replace")],
    };
  },
  component: ErsattSida,
});

async function hamtaFamiljer(): Promise<FamilyBrief[]> {
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

/** Mobilfoton är ofta över Anthropics gräns på 5 MB. 1600 px räcker för en typskylt. */
async function forminskaBild(fil: File, maxSida = 1600): Promise<{ data: string; mimeType: string }> {
  const bild = await createImageBitmap(fil);
  const skala = Math.min(1, maxSida / Math.max(bild.width, bild.height));
  const duk = document.createElement("canvas");
  duk.width = Math.round(bild.width * skala);
  duk.height = Math.round(bild.height * skala);
  duk.getContext("2d")!.drawImage(bild, 0, 0, duk.width, duk.height);
  const url = duk.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], mimeType: "image/jpeg" };
}

function ErsattSida() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { kod: kodISok } = Route.useSearch();
  const navigate = useNavigate({ from: "/$locale/replace" });
  const x = TEXT[locale] ?? TEXT.en;
  const lasTypskylt = useServerFn(aiLasTypskylt);

  const [katalog, setKatalog] = useState<ProductRow[] | null>(null);
  const [familjer, setFamiljer] = useState<FamilyBrief[]>([]);
  const [falt, setFalt] = useState(kodISok ?? "");
  const [fotoStatus, setFotoStatus] = useState<"" | "laser" | "fel">("");
  const [lagd, setLagd] = useState<string | null>(null);
  const filRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCatalog().then(setKatalog).catch(() => setKatalog([]));
    hamtaFamiljer().then(setFamiljer).catch(() => setFamiljer([]));
  }, []);

  // Sökningen bor i adressen, så att en länk till en ersättning går att dela.
  const id: Identifiering | null = useMemo(
    () => (kodISok && katalog ? identifiera(kodISok, katalog, familjer) : null),
    [kodISok, katalog, familjer],
  );
  const kandidater: Kandidat[] = useMemo(() => (id && katalog ? motsvarigheter(id, katalog) : []), [id, katalog]);

  // En gång per sökning, när katalogen har hunnit laddas.
  useEffect(() => {
    if (!id) return;
    logga("ersatt", { kod: id.kod.slice(0, 60), igenkand: !!(id.produkt || id.familj), motsvarigheter: kandidater.length });
  }, [id, kandidater.length]);

  function sok(kod: string) {
    const ren = kod.trim();
    if (ren) navigate({ search: { kod: ren }, replace: false });
  }

  async function fota(fil: File) {
    setFotoStatus("laser");
    try {
      const { data, mimeType } = await forminskaBild(fil);
      const svar = await lasTypskylt({ data: { imageBase64: data, mimeType } });
      const forsta = svar.koder[0];
      if (!forsta) { setFotoStatus("fel"); return; }
      setFalt(forsta);
      setFotoStatus("");
      sok(forsta);
    } catch {
      setFotoStatus("fel");
    }
  }

  function lagg(p: ProductRow) {
    addToShoppingList({ id: p.id, sku: p.sku, name: produktnamn(p, locale) });
    setLagd(p.sku);
    setTimeout(() => setLagd(null), 1800);
  }

  const fragaAi = `${locale === "sv" ? "Jag behöver ersätta" : "I need to replace"} ${id?.kod ?? falt}`;

  return (
    <div className="container-page py-10 max-w-5xl">
      <div className="flex items-center gap-2 text-info"><RefreshCw className="size-5" aria-hidden /></div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{x.titel}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">{x.ingress}</p>

      <form
        className="mt-6 flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => { e.preventDefault(); sok(falt); }}
      >
        <input
          value={falt}
          onChange={(e) => setFalt(e.target.value)}
          placeholder={x.falt}
          aria-label={x.falt}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-info/40"
        />
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-info px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Search className="size-4" aria-hidden /> {x.sok}
        </button>
        <button
          type="button"
          onClick={() => filRef.current?.click()}
          disabled={fotoStatus === "laser"}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm hover:border-info hover:text-info disabled:opacity-60"
        >
          <Camera className="size-4" aria-hidden /> {fotoStatus === "laser" ? x.laserFoto : x.fota}
        </button>
        <input
          ref={filRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) fota(f); e.target.value = ""; }}
        />
      </form>
      {fotoStatus === "fel" && <p className="mt-2 text-sm text-warning-deep">{x.fotoFel}</p>}

      {kodISok && !katalog && <p className="mt-8 text-sm text-muted-foreground">{x.laddar}</p>}

      {id && (
        <div className="mt-8 space-y-6">
          {/* Vad koden är */}
          {(id.produkt || id.familj) ? (
            <section className="rounded-lg border border-border bg-surface-alt p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{x.kanns}</div>
              <div className="mt-1 text-lg font-semibold">
                {[id.tillverkare, id.familj, id.borrningMm ? `Ø${id.borrningMm}` : null, id.slagMm ? `${id.slagMm} mm` : null]
                  .filter(Boolean).join(" · ")}
              </div>
              {id.standard && <div className="mt-0.5 text-sm text-muted-foreground">{id.standard}</div>}
              {id.produkt && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-success-deep">{x.finns}:</span>
                  <Link to="/$locale/product/$sku" params={{ locale, sku: id.produkt.sku }} className="text-sm text-info hover:underline">
                    {produktnamn(id.produkt, locale)}
                  </Link>
                  <ArticleNumber value={id.produkt.sku} variant="compact" />
                  <button type="button" onClick={() => lagg(id.produkt!)} className="text-xs font-medium text-muted-foreground hover:text-info">
                    {lagd === id.produkt.sku ? x.lagd : x.lagg}
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-lg border border-border p-4">
              <div className="font-semibold">{x.okand}</div>
              <p className="mt-1 text-sm text-muted-foreground">{x.okandText}</p>
            </section>
          )}

          {/* Motsvarigheter */}
          {(id.produkt || id.familj) && (
            <section>
              <h2 className="text-lg font-semibold">{x.motsvarigheter}</h2>
              {!id.standard ? (
                <p className="mt-2 text-sm text-muted-foreground">{x.ingaStandard}</p>
              ) : kandidater.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{x.ingaTraffar}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">{x.isoNot}</p>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-surface-alt text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">{x.kolumner.fabrikat}</th>
                          <th className="px-3 py-2 font-medium">{x.kolumner.artikel}</th>
                          {JAMFOR.map((k) => <th key={k} className="px-3 py-2 font-medium">{specEtikett(k, locale)}</th>)}
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {id.produkt && <Rad p={id.produkt} etikett={x.din} locale={locale} original={null} x={x} />}
                        {kandidater.map((k) => (
                          <Rad key={k.produkt.id} p={k.produkt} kandidat={k} locale={locale} original={id.produkt} x={x}
                            lagd={lagd === k.produkt.sku} onLagg={() => lagg(k.produkt)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/$locale/chat" params={{ locale }} search={{ q: fragaAi } as never} className="rounded-md border border-border px-3 py-2 hover:border-info hover:text-info">
              ✦ {x.fragaAi}
            </Link>
            <Link to="/$locale/products" params={{ locale }} search={{ q: id.kod } as never} className="rounded-md border border-border px-3 py-2 hover:border-info hover:text-info">
              {x.katalog}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Rad({ p, kandidat, etikett, locale, original, x, lagd, onLagg }: {
  p: ProductRow; kandidat?: Kandidat; etikett?: string; locale: Locale; original: ProductRow | null; x: Text;
  lagd?: boolean; onLagg?: () => void;
}) {
  const varde = (rad: ProductRow, k: string) => {
    if (k === "stroke_mm" && kandidat?.typ === "serie" && rad === p) return x.serie(kandidat.maxSlagMm);
    const s = rad.specs?.[k];
    return s ? specVarde(k, s) : "–";
  };
  return (
    <tr className={`border-t border-border ${etikett ? "bg-info-surface/40" : ""}`}>
      <td className="px-3 py-2 align-top">
        <div className="font-medium">{p.brand.name}</div>
        {etikett && <div className="text-[11px] text-muted-foreground">{etikett}</div>}
      </td>
      <td className="px-3 py-2 align-top">
        <Link to="/$locale/product/$sku" params={{ locale, sku: p.sku }} className="text-info hover:underline">{produktnamn(p, locale)}</Link>
        <div className="mt-0.5"><ArticleNumber value={p.sku} variant="compact" /></div>
      </td>
      {JAMFOR.map((k) => {
        const v = varde(p, k);
        // Markera det som skiljer sig från originalet, när vi vet vad originalet har.
        // Slaget väljs vid beställning och standarden är densamma för alla rader.
        const vo = original ? varde(original, k) : "–";
        const skiljer = original && k !== "stroke_mm" && k !== "standard" && v !== "–" && vo !== "–" && !sammaVarde(v, vo);
        return <td key={k} className={`px-3 py-2 align-top ${skiljer ? "text-warning-deep font-medium" : ""}`}>{v}</td>;
      })}
      <td className="px-3 py-2 align-top text-right">
        {onLagg && (
          <button type="button" onClick={onLagg} className="whitespace-nowrap text-xs font-medium text-muted-foreground hover:text-info">
            {lagd ? x.lagd : x.lagg}
          </button>
        )}
      </td>
    </tr>
  );
}
