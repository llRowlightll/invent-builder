import { Check, CircleHelp, Clock3, Minus, Sparkles, TriangleAlert, UserCheck, X, type LucideIcon } from "lucide-react";
import { tillstandetsText, type Tillstand } from "@/lib/design/status";
import { cn } from "@/lib/utils";

/**
 * Statusmärket. Tillståndet bärs av ikon OCH text, aldrig av färgen ensam
 * (brief punkt 9). Förslag har streckad kant: det är ett utkast, inte ett
 * besked.
 */
const STIL: Record<Tillstand, { Ikon: LucideIcon; klass: string }> = {
  bekraftat: { Ikon: Check, klass: "bg-success-surface text-success-deep border-success/30" },
  preliminart: { Ikon: Clock3, klass: "bg-prelim-surface text-prelim-deep border-prelim/30" },
  komplettering: { Ikon: TriangleAlert, klass: "bg-warning-surface text-warning-deep border-warning-deep/25" },
  uppfyllerInte: { Ikon: X, klass: "bg-danger-surface text-danger-deep border-danger-deep/25" },
  ejProvat: { Ikon: Minus, klass: "bg-muted text-muted-foreground border-border" },
  forslag: { Ikon: Sparkles, klass: "bg-surface text-muted-foreground border-dashed border-muted-foreground/40" },
  oppen: { Ikon: CircleHelp, klass: "bg-warning-surface text-warning-deep border-warning-deep/25" },
  utfort: { Ikon: UserCheck, klass: "bg-success-surface text-success-deep border-success/30" },
};

export function Statusmarke({ tillstand, text, locale, className, title }: {
  tillstand: Tillstand;
  /** Egen text; annars tillståndets standardtext. */
  text?: string;
  locale: string;
  className?: string;
  title?: string;
}) {
  const { Ikon, klass } = STIL[tillstand];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        klass, className,
      )}
    >
      <Ikon aria-hidden className="size-3 shrink-0" strokeWidth={2.25} />
      {text ?? tillstandetsText(tillstand, locale)}
    </span>
  );
}

/** En prick med samma färg, för täta listor där texten står bredvid. */
export function Statusprick({ tillstand, className }: { tillstand: Tillstand; className?: string }) {
  const farg: Record<Tillstand, string> = {
    bekraftat: "bg-success", preliminart: "bg-prelim", komplettering: "bg-warning-deep", uppfyllerInte: "bg-danger-deep",
    ejProvat: "bg-muted-foreground/40", forslag: "border border-dashed border-muted-foreground bg-transparent",
    oppen: "bg-warning-deep", utfort: "bg-success",
  };
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", farg[tillstand], className)} />;
}

