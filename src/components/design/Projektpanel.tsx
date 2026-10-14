import { ChevronDown, CloudCheck, CloudOff, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { Tillstand } from "@/lib/design/status";
import { cn } from "@/lib/utils";
import { Statusmarke, Statusprick } from "./Statusmarke";

/**
 * Projektöversikten bredvid arbetsytan (brief punkt 5): bekräftade krav,
 * saknade uppgifter, antaganden, konflikter och sparstatus. Bara det som har
 * innehåll visas, och varje grupp går att fälla ihop. På smal skärm blir
 * panelen en utfällbar rad ovanför arbetsytan (se `mobil`).
 */
export interface PanelPost {
  id: string;
  text: ReactNode;
  /** Kort förklaring under raden, t.ex. var uppgiften kom ifrån. */
  detalj?: ReactNode;
  tillstand?: Tillstand;
  /** Ändrad sedan förra vyn: markeras kort (rorelse-markera). */
  andrad?: boolean;
}

export interface PanelSektion {
  id: string;
  rubrik: string;
  tillstand: Tillstand;
  poster: PanelPost[];
  /** Öppen från början. Konflikter och saknade uppgifter brukar vara det. */
  oppen?: boolean;
}

export type Sparstatus =
  | { lage: "sparat"; text: string }
  | { lage: "sparar"; text: string }
  | { lage: "osparat"; text: string; atgard?: ReactNode };

function SparRad({ status }: { status: Sparstatus }) {
  const Ikon = status.lage === "sparat" ? CloudCheck : status.lage === "sparar" ? LoaderCircle : CloudOff;
  return (
    <div className={cn("flex items-start gap-2 text-xs", status.lage === "sparat" ? "text-success-deep" : "text-muted-foreground")} role="status" aria-live="polite">
      <Ikon aria-hidden className={cn("mt-px size-3.5 shrink-0", status.lage === "sparar" && "animate-spin")} />
      <span>
        {status.text}
        {status.lage === "osparat" && status.atgard && <span className="block mt-0.5">{status.atgard}</span>}
      </span>
    </div>
  );
}

function Sektion({ s, locale }: { s: PanelSektion; locale: string }) {
  return (
    <details open={s.oppen} className="group border-t border-line first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2.5 text-[13px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <Statusprick tillstand={s.tillstand} />
        <span className="flex-1">{s.rubrik}</span>
        <span className="tabular-nums text-xs text-muted-foreground">{s.poster.length}</span>
        <ChevronDown aria-hidden className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="space-y-2 pb-3">
        {s.poster.map((p) => (
          <li key={p.id} className={cn("text-[13px] leading-snug text-foreground", p.andrad && "rorelse-markera")}>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 break-words">{p.text}</span>
              {p.tillstand && p.tillstand !== s.tillstand && <Statusmarke tillstand={p.tillstand} locale={locale} className="shrink-0" />}
            </div>
            {p.detalj && <div className="mt-0.5 text-xs text-muted-foreground">{p.detalj}</div>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Projektpanel({ variant, rubrik, beskrivning, sparstatus, sektioner, locale, sammanfattning, tomText, children }: {
  /** "sida": sidopanel på bred skärm. "mobil": utfällbar rad ovanför arbetsytan. */
  variant: "sida" | "mobil";
  rubrik: string;
  beskrivning?: string;
  sparstatus?: Sparstatus;
  sektioner: PanelSektion[];
  locale: string;
  /** Kort rad överst, t.ex. "3 bekräftade · 2 saknas". */
  sammanfattning?: string;
  /** Texten när ingen grupp har innehåll. */
  tomText?: string;
  children?: ReactNode;
}) {
  const sv = locale === "sv";
  const synliga = sektioner.filter((s) => s.poster.length > 0);
  const tom = tomText ?? (sv ? "Kraven visas här när beskrivningen är tolkad." : "The requirements appear here once the description is interpreted.");
  const innehall = (
    <>
      {beskrivning && <p className="line-clamp-3 text-[13px] leading-snug text-muted-foreground">{beskrivning}</p>}
      {sparstatus && <div className="mt-3"><SparRad status={sparstatus} /></div>}
      <div className="mt-3">
        {synliga.length === 0
          ? <p className="border-t border-line py-3 text-[13px] text-muted-foreground">{tom}</p>
          : synliga.map((s) => <Sektion key={s.id} s={s} locale={locale} />)}
      </div>
      {children}
    </>
  );
  if (variant === "mobil") {
    return (
      <details className="kort mb-4 px-4 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex-1">{rubrik}</span>
          {sammanfattning && <span className="text-xs font-normal text-muted-foreground">{sammanfattning}</span>}
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        </summary>
        <div className="pb-3">{innehall}</div>
      </details>
    );
  }
  return (
    <aside aria-label={rubrik} className="hidden lg:block">
      <div className="kort sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">{rubrik}</h2>
        {sammanfattning && <p className="mt-0.5 text-xs text-muted-foreground">{sammanfattning}</p>}
        <div className="mt-3">{innehall}</div>
      </div>
    </aside>
  );
}
