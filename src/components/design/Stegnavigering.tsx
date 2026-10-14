import { Check, Lock, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Stegen i ett flöde (maskinbyggaren, PLC-underlaget). Fem lägen som skiljs
 * åt med ikon och text, inte bara färg (brief punkt 5 och 9):
 *   aktivt   -- steget som visas
 *   klart    -- genomfört
 *   saknas   -- genomfört, men uppgifter saknas
 *   konflikt -- något uppfyller inte kravet eller motsäger ett annat
 *   last     -- inte tillgängligt än
 * Ett genomfört steg går att gå tillbaka till; ett låst gör det inte.
 */
export type StegTillstand = "aktivt" | "klart" | "saknas" | "konflikt" | "last";

export interface StegPost {
  id: string;
  namn: string;
  tillstand: StegTillstand;
}

const CIRKEL: Record<StegTillstand, string> = {
  aktivt: "bg-primary text-primary-foreground ring-4 ring-primary/10",
  klart: "bg-success-surface text-success-deep",
  saknas: "bg-warning-surface text-warning-deep",
  konflikt: "bg-danger-surface text-danger-deep",
  last: "bg-muted text-muted-foreground/70",
};

const STAPEL: Record<StegTillstand, string> = {
  aktivt: "bg-primary", klart: "bg-success", saknas: "bg-warning-deep", konflikt: "bg-danger-deep", last: "bg-border",
};

function lageText(t: StegTillstand, sv: boolean): string {
  switch (t) {
    case "aktivt": return sv ? "pågår" : "current";
    case "klart": return sv ? "klart" : "done";
    case "saknas": return sv ? "uppgifter saknas" : "information missing";
    case "konflikt": return sv ? "konflikt" : "conflict";
    case "last": return sv ? "inte tillgängligt än" : "not available yet";
  }
}

function Symbol({ t, nr }: { t: StegTillstand; nr: number }): ReactNode {
  if (t === "klart") return <Check aria-hidden className="size-3.5" strokeWidth={2.5} />;
  if (t === "saknas") return <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2.25} />;
  if (t === "konflikt") return <X aria-hidden className="size-3.5" strokeWidth={2.5} />;
  if (t === "last") return <Lock aria-hidden className="size-3" strokeWidth={2.25} />;
  return <span>{nr}</span>;
}

export function Stegnavigering({ steg, onValj, locale, etikett, className }: {
  steg: StegPost[];
  /** Anropas för ett genomfört steg som användaren vill gå tillbaka till. */
  onValj?: (id: string) => void;
  locale: string;
  etikett: string;
  className?: string;
}) {
  const sv = locale === "sv";
  const aktiv = Math.max(0, steg.findIndex((s) => s.tillstand === "aktivt"));
  const kanValjas = (s: StegPost) => !!onValj && s.tillstand !== "aktivt" && s.tillstand !== "last";

  return (
    <nav aria-label={etikett} className={className}>
      {/* Smal skärm: det aktiva steget i klartext och en stapel per steg. */}
      <div className="sm:hidden">
        <p className="text-xs text-muted-foreground">
          {sv ? "Steg" : "Step"} {aktiv + 1} {sv ? "av" : "of"} {steg.length}
        </p>
        <p className="text-sm font-semibold text-foreground">{steg[aktiv]?.namn}</p>
        <ol className="mt-2 flex gap-1" aria-label={etikett}>
          {steg.map((s, i) => (
            <li key={s.id} className="flex-1">
              <span className={cn("block h-1 rounded-full", STAPEL[s.tillstand])} />
              <span className="sr-only">{sv ? "Steg" : "Step"} {i + 1}, {s.namn}, {lageText(s.tillstand, sv)}</span>
            </li>
          ))}
        </ol>
      </div>

      <ol className="hidden sm:flex flex-wrap items-center gap-y-2">
        {steg.map((s, i) => {
          const inner = (
            <>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors", CIRKEL[s.tillstand])}>
                <Symbol t={s.tillstand} nr={i + 1} />
              </span>
              <span className={cn("text-[13px] font-medium whitespace-nowrap",
                s.tillstand === "aktivt" ? "text-foreground" : s.tillstand === "last" ? "text-muted-foreground/70" : "text-muted-foreground")}>
                {s.namn}
              </span>
              <span className="sr-only">, {lageText(s.tillstand, sv)}</span>
            </>
          );
          return (
            <li key={s.id} className="flex items-center" aria-current={s.tillstand === "aktivt" ? "step" : undefined}>
              {kanValjas(s) ? (
                <button type="button" onClick={() => onValj!(s.id)}
                  title={sv ? `Gå till ${s.namn.toLowerCase()}` : `Go to ${s.namn.toLowerCase()}`}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-muted">
                  {inner}
                </button>
              ) : (
                <div className="flex items-center gap-2 py-1 pl-1 pr-2.5">{inner}</div>
              )}
              {i < steg.length - 1 && (
                <span aria-hidden className={cn("mx-1 h-px w-5 lg:w-8", s.tillstand === "last" ? "bg-border" : "bg-muted-foreground/30")} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
