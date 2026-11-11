import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { loadCatalog } from "@/lib/catalog";
import { makeT, type Locale } from "@/lib/i18n";
import { logga } from "@/lib/matning";
import { snabbforslag } from "@/lib/snabbsok";
import { produktnamn } from "@/lib/spec-format";
import type { ProductRow } from "@/lib/types";

type Val =
  | { typ: "produkt"; sku: string }
  | { typ: "kategori"; slug: string }
  | { typ: "fabrikat"; slug: string }
  | { typ: "alla" };

/**
 * Sökrutan i sidhuvudet: förslag medan man skriver (se snabbsok.ts).
 * Öppnas med knappen, med "/" eller Ctrl/Cmd+K, från varje sida.
 */
export function Snabbsok({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const navigate = useNavigate();
  const [oppen, setOppen] = useState(false);
  const [fraga, setFraga] = useState("");
  const [katalog, setKatalog] = useState<ProductRow[] | null>(null);
  const [aktiv, setAktiv] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" och Ctrl/Cmd+K öppnar -- men inte när man skriver i ett fält.
  useEffect(() => {
    function tangent(e: KeyboardEvent) {
      const mal = e.target as HTMLElement | null;
      const skriver = !!mal && (mal.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(mal.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !skriver && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setOppen(true);
      }
    }
    window.addEventListener("keydown", tangent);
    return () => window.removeEventListener("keydown", tangent);
  }, []);

  useEffect(() => {
    if (oppen && !katalog) loadCatalog().then(setKatalog).catch(() => setKatalog([]));
  }, [oppen, katalog]);

  const forslag = useMemo(
    () => (katalog ? snabbforslag(katalog, fraga, locale) : null),
    [katalog, fraga, locale],
  );

  const val: Val[] = useMemo(() => {
    if (!forslag || forslag.totalt === 0) return [];
    return [
      ...forslag.produkter.map((p) => ({ typ: "produkt" as const, sku: p.sku })),
      ...forslag.kategorier.map((k) => ({ typ: "kategori" as const, slug: k.slug })),
      ...forslag.fabrikat.map((f) => ({ typ: "fabrikat" as const, slug: f.slug })),
      { typ: "alla" as const },
    ];
  }, [forslag]);

  useEffect(() => setAktiv(0), [fraga]);

  function stang() {
    setOppen(false);
    setFraga("");
  }

  function ga(v: Val | undefined) {
    const q = fraga.trim();
    if (!q) return;
    logga("sok", { q: q.slice(0, 80), kalla: "snabbsok", val: v?.typ ?? "alla" });
    stang();
    if (v?.typ === "produkt") {
      navigate({ to: "/$locale/product/$sku", params: { locale, sku: v.sku } });
    } else if (v?.typ === "kategori") {
      navigate({ to: "/$locale/products", params: { locale }, search: { q, category: v.slug } as never });
    } else if (v?.typ === "fabrikat") {
      navigate({ to: "/$locale/products", params: { locale }, search: { q, brand: v.slug } as never });
    } else {
      navigate({ to: "/$locale/products", params: { locale }, search: { q } as never });
    }
  }

  function tangentIRutan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAktiv((i) => Math.min(i + 1, Math.max(val.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAktiv((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); ga(val[aktiv]); }
  }

  const index = (v: Val) => val.findIndex((x) => JSON.stringify(x) === JSON.stringify(v));
  const rad = (v: Val) => {
    const i = index(v);
    return {
      id: `snabbsok-${i}`,
      role: "option" as const,
      "aria-selected": i === aktiv,
      onMouseEnter: () => setAktiv(i),
      onClick: () => ga(v),
      className: `w-full text-left flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer ${
        i === aktiv ? "bg-info/10 text-foreground" : "text-foreground/90 hover:bg-surface-alt"
      }`,
    };
  };

  return (
    <DialogPrimitive.Root open={oppen} onOpenChange={(o) => (o ? setOppen(true) : stang())}>
      <DialogPrimitive.Trigger
        className="flex items-center gap-2 h-8 px-2 lg:px-3 rounded-md border border-primary-foreground/25 text-xs text-primary-foreground/85 hover:text-primary-foreground hover:bg-primary-foreground/10 transition"
        title={t("snabbsok.tangent")}
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden lg:inline">{t("snabbsok.knapp")}</span>
        <kbd className="hidden lg:inline text-[10px] px-1 rounded border border-primary-foreground/30 text-primary-foreground/70">/</kbd>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-3 sm:top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-border bg-surface shadow-xl overflow-hidden"
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
        >
          <DialogPrimitive.Title className="sr-only">{t("snabbsok.knapp")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t("snabbsok.placeholder")}</DialogPrimitive.Description>
          <div className="flex items-center gap-2 px-3 border-b border-border">
            <Search className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              ref={inputRef}
              value={fraga}
              onChange={(e) => setFraga(e.target.value)}
              onKeyDown={tangentIRutan}
              placeholder={t("snabbsok.placeholder")}
              className="flex-1 min-w-0 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              role="combobox"
              aria-expanded={val.length > 0}
              aria-controls="snabbsok-lista"
              aria-activedescendant={val.length ? `snabbsok-${aktiv}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <DialogPrimitive.Close className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-alt" aria-label={t("snabbsok.stang")}>
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div id="snabbsok-lista" role="listbox" className="max-h-[60vh] overflow-y-auto p-2 text-sm">
            {!katalog && fraga.trim().length >= 2 && (
              <p className="px-3 py-6 text-center text-muted-foreground">{t("snabbsok.laddar")}</p>
            )}
            {forslag && fraga.trim().length >= 2 && forslag.totalt === 0 && (
              <div className="px-3 py-5 text-center space-y-3">
                <p className="text-muted-foreground">{t("snabbsok.ingaTraffar").replace("{q}", fraga.trim())}</p>
                <button
                  type="button"
                  onClick={() => { stang(); navigate({ to: "/$locale/machine-builder", params: { locale } }); }}
                  className="text-xs font-medium text-info hover:underline"
                >
                  ✦ {t("snabbsok.beskriv")}
                </button>
              </div>
            )}
            {forslag && forslag.totalt > 0 && (
              <>
                {forslag.familjefall && (
                  <p className="px-3 pt-1 pb-2 text-xs text-muted-foreground">
                    {t("snabbsok.familjefall").replace("{q}", fraga.trim()).replace("{fam}", forslag.familjefall.toUpperCase())}
                  </p>
                )}
                <Rubrik>{t("snabbsok.artiklar")}</Rubrik>
                {forslag.produkter.map((p) => (
                  <div key={p.sku} {...rad({ typ: "produkt", sku: p.sku })}>
                    <span className="text-[11px] font-semibold text-muted-foreground w-20 shrink-0 truncate">{p.brand.name}</span>
                    <span className="flex-1 min-w-0 truncate">{produktnamn(p, locale)}</span>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">{p.sku}</span>
                  </div>
                ))}
                {forslag.kategorier.length > 0 && <Rubrik>{t("snabbsok.kategorier")}</Rubrik>}
                {forslag.kategorier.map((k) => (
                  <div key={k.slug} {...rad({ typ: "kategori", slug: k.slug })}>
                    <span className="flex-1">{k.namn}</span>
                    <span className="text-xs text-muted-foreground">{k.antal}</span>
                  </div>
                ))}
                {forslag.fabrikat.length > 0 && <Rubrik>{t("snabbsok.fabrikat")}</Rubrik>}
                {forslag.fabrikat.map((f) => (
                  <div key={f.slug} {...rad({ typ: "fabrikat", slug: f.slug })}>
                    <span className="flex-1">{f.namn}</span>
                    <span className="text-xs text-muted-foreground">{f.antal}</span>
                  </div>
                ))}
                <div className="mt-1 border-t border-border pt-1">
                  <div {...rad({ typ: "alla" })}>
                    <span className="flex-1 font-medium text-info">
                      {t("snabbsok.visaAlla").replace("{n}", String(forslag.totalt))} →
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Rubrik({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>;
}
