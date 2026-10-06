/**
 * ArticleNumber — den enda tillåtna presentationen av ett artikelnummer.
 *
 * Regeln är absolut: ett artikelnummer sätts aldrig i sans. `0822121007` och
 * `0822l2l007` ser nästan lika ut i en proportionell grotesk, och en tekniker
 * som beställer fel axel förlorar en dag. IBM Plex Mono skiljer noll från O
 * och ett från l, och `tabular-nums` gör att två nummer under varandra går att
 * jämföra kolumnvis i stället för tecken för tecken.
 *
 * Ur designsystemet Maskinval Datablad, komponenten ArticleNumber.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "compact" | "discontinued";

interface Props {
  /** Artikelnumret eller orderkoden. */
  value: string;
  variant?: Variant;
  /** Numret som ersätter ett utgått. Visas bara för variant "discontinued". */
  replacedBy?: string | null;
  /**
   * Låter läsaren kopiera numret. Av som standard: i en tabell med trettio
   * rader är trettio kopieringsknappar brus, och där är numret ändå
   * markerbart som vanlig text.
   */
  copyable?: boolean;
  /** Sidans språk. Knapptexten är svensk på /sv och engelsk annars. */
  locale?: string;
  className?: string;
}

export function ArticleNumber({
  value,
  variant = "default",
  replacedBy,
  copyable = false,
  locale = "sv",
  className,
}: Props) {
  const [kopierad, setKopierad] = useState(false);
  const sv = locale === "sv";

  async function kopiera() {
    try {
      await navigator.clipboard.writeText(value);
      setKopierad(true);
      window.setTimeout(() => setKopierad(false), 1500);
    } catch {
      // Äldre webbläsare och vissa inbäddade vyer avvisar clipboard-löftet.
      // Då markeras texten i stället, så numret fortfarande går att kopiera
      // för hand -- en knapp som inte gör något är värre än ingen knapp.
      const el = document.getElementById(`art-${value}`);
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  const utgatt = variant === "discontinued";

  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <span className="inline-flex items-center gap-2">
        <span
          id={`art-${value}`}
          className={cn(
            "tabular",
            variant === "compact" ? "text-[13px]" : "text-sm font-medium",
            utgatt && "line-through decoration-1 text-destructive",
          )}
        >
          {value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={kopiera}
            /* Statusen skrivs ut i TEXT och inte bara som en ikonändring, så
               den läses av en skärmläsare och inte bara av ett öga. */
            aria-label={kopierad ? (sv ? "Kopierat" : "Copied") : `${sv ? "Kopiera" : "Copy"} ${value}`}
            className="rounded-sm border border-input px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-info transition hover:bg-info/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
          >
            {kopierad ? (sv ? "Kopierat" : "Copied") : (sv ? "Kopiera" : "Copy")}
          </button>
        )}
      </span>
      {utgatt && replacedBy && (
        <span className="tabular text-[13px] text-muted-foreground">
          {sv ? "ersätts av" : "replaced by"} {replacedBy}
        </span>
      )}
    </span>
  );
}
