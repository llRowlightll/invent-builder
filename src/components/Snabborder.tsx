import { useState } from "react";
import { ClipboardList } from "lucide-react";
import type { CartItem } from "@/lib/cart";
import { hamtaFamiljer } from "@/lib/familjer";
import { makeT, type Locale } from "@/lib/i18n";
import { lasLista, tillKorgrad, tolkaKod, type ListRad, type Tolkning } from "@/lib/snabborder";
import { produktnamn } from "@/lib/spec-format";
import type { ProductRow } from "@/lib/types";
import type { FamilyBrief } from "../../supabase/functions/groq-advisor/order-code.ts";

/**
 * Klistra in en lista med artikelnummer och antal (se snabborder.ts).
 * Visar vad varje rad blev innan något läggs i korgen.
 */
export function Snabborder({ locale, katalog, onLagg }: {
  locale: Locale;
  katalog: ProductRow[];
  onLagg: (rader: CartItem[]) => void;
}) {
  const t = makeT(locale);
  const [oppen, setOppen] = useState(false);
  const [text, setText] = useState("");
  const [familjer, setFamiljer] = useState<FamilyBrief[] | null>(null);
  const [tolkat, setTolkat] = useState<{ rad: ListRad; t: Tolkning }[] | null>(null);
  const [lagda, setLagda] = useState(0);

  async function oppna() {
    setOppen(true);
    if (!familjer) hamtaFamiljer().then(setFamiljer).catch(() => setFamiljer([]));
  }

  async function las() {
    const fam = familjer ?? (await hamtaFamiljer().catch(() => []));
    if (!familjer) setFamiljer(fam);
    setTolkat(lasLista(text).map((rad) => ({ rad, t: tolkaKod(rad.kod, katalog, fam) })));
    setLagda(0);
  }

  function lagg() {
    if (!tolkat?.length) return;
    onLagg(tolkat.map(({ rad, t: tk }) => tillKorgrad(rad, tk, (p) => produktnamn(p, locale), t("snabborder.okandNamn"))));
    setLagda(tolkat.length);
    setTolkat(null);
    setText("");
  }

  if (!oppen) {
    return (
      <div className="mt-2 flex items-center gap-3 text-xs">
        <button type="button" onClick={oppna} className="inline-flex items-center gap-1.5 font-medium text-info hover:underline">
          <ClipboardList className="size-3.5" aria-hidden />
          {t("snabborder.oppna")}
        </button>
        {lagda > 0 && <span className="text-success">{t("snabborder.lagda").replace("{n}", String(lagda))}</span>}
      </div>
    );
  }

  const antal = (s: Tolkning["status"]) => tolkat?.filter((x) => x.t.status === s).length ?? 0;

  return (
    <section className="mt-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="text-sm font-semibold">{t("snabborder.rubrik")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("snabborder.hjalp")}</p>
        </div>
        <button type="button" onClick={() => { setOppen(false); setTolkat(null); }} className="text-xs text-muted-foreground hover:text-foreground">
          {t("snabbsok.stang")}
        </button>
      </div>

      {!tolkat && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={"193986\t5\nDSBC-50-100-PPSA-N3 x2\n3 st MFH-5-1/8"}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-info/30"
            aria-label={t("snabborder.rubrik")}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={las}
              disabled={!text.trim()}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {t("snabborder.las")}
            </button>
          </div>
        </>
      )}

      {tolkat && (
        <>
          {tolkat.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">{t("snabborder.inget")}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                {t("snabborder.sammanfattning")
                  .replace("{a}", String(antal("artikel")))
                  .replace("{s}", String(antal("serie")))
                  .replace("{o}", String(antal("okand")))}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {tolkat.map(({ rad, t: tk }) => (
                  <li key={rad.kod} className="flex items-start gap-3 px-3 py-2">
                    <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{rad.antal}×</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs break-all">{rad.kod}</div>
                      <div className="text-xs mt-0.5">
                        {tk.status === "artikel" && (
                          <span className="text-success">✓ {medFabrikat(tk.produkt, locale)} · {tk.produkt.sku}</span>
                        )}
                        {tk.status === "serie" && (
                          <span className="text-info">
                            ◐ {t("snabborder.serie").replace("{f}", tk.familj)}
                            {tk.borrningMm ? ` · Ø${tk.borrningMm}` : ""}
                            {tk.slagMm ? ` · ${t("snabborder.slag")} ${tk.slagMm} mm` : ""}
                          </span>
                        )}
                        {tk.status === "okand" && (
                          <span className="text-warning-deep">? {t("snabborder.okand")}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setTolkat(null)} className="h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">
              {t("snabborder.andra")}
            </button>
            {tolkat.length > 0 && (
              <button type="button" onClick={lagg} className="h-9 px-4 rounded-lg bg-cta text-cta-foreground text-sm font-semibold hover:bg-cta-hover">
                {t("snabborder.lagg").replace("{n}", String(tolkat.length))}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** "Festo ISO cylinder", men inte "Festo Festo MFH-5 …" när namnet redan börjar med fabrikatet. */
function medFabrikat(p: ProductRow, locale: Locale): string {
  const namn = produktnamn(p, locale);
  return namn.toLowerCase().startsWith(p.brand.name.toLowerCase()) ? namn : `${p.brand.name} ${namn}`;
}
