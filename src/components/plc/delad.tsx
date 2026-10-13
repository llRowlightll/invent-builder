/**
 * Delade byggstenar för PLC-stegen 3–8: fält, status och postknappar.
 * Raderna visas som kort, så att de går att redigera på en telefon
 * (manualen 8: redigerbara radkort i stället för breda tabeller).
 */
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { Bekraftelse } from "@/lib/plc/modell";
import { Statusmarke } from "@/components/design/Statusmarke";

export type Tx = (sv: string, en: string) => string;

const FALTKLASS = "mt-1 w-full px-2.5 py-1.5 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40";

export function Falt({ id, etikett, value, onChange, flerrader, placeholder, hjalp, monospace }: {
  id: string; etikett: string; value: string; onChange: (v: string) => void;
  flerrader?: boolean; placeholder?: string; hjalp?: string; monospace?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{etikett}</label>
      {flerrader ? (
        <textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          maxLength={4000} aria-describedby={hjalp ? `${id}-hjalp` : undefined} className={FALTKLASS} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          maxLength={400} aria-describedby={hjalp ? `${id}-hjalp` : undefined} className={`${FALTKLASS} ${monospace ? "font-mono" : ""}`} />
      )}
      {hjalp && <p id={`${id}-hjalp`} className="text-[11px] text-muted-foreground mt-0.5">{hjalp}</p>}
    </div>
  );
}

export function Val<T extends string>({ id, etikett, value, onChange, alternativ }: {
  id: string; etikett: string; value: T; onChange: (v: T) => void; alternativ: Array<{ id: T; text: string }>;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{etikett}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={FALTKLASS}>
        {alternativ.map((a) => <option key={a.id} value={a.id}>{a.text}</option>)}
      </select>
    </div>
  );
}

/**
 * Postens status med ikon och text (manualen 8, designen 2026-10-14):
 * förslag har streckad kant -- systemets utkast, inte ett besked --
 * bekräftad har bock, inaktuell kräver komplettering.
 */
export function Statusbricka({ tx, status, orsak }: { tx: Tx; status: Bekraftelse; orsak?: string }) {
  return status === "bekraftad"
    ? <Statusmarke tillstand="bekraftat" text={tx("Bekräftad", "Confirmed")} locale={tx("sv", "en")} title={orsak} />
    : status === "inaktuell"
      ? <Statusmarke tillstand="komplettering" text={tx("Inaktuell", "Outdated")} locale={tx("sv", "en")} title={orsak} />
      : <Statusmarke tillstand="forslag" text={tx("Förslag", "Proposal")} locale={tx("sv", "en")} title={orsak} />;
}

/**
 * Ett kort per post: rubrik, status, knappar och fälten. Ett förslag har
 * streckad ram tills en människa bekräftat det; `extra` bär ett andra besked,
 * t.ex. ett testfalls utfall.
 */
export function Postkort({ tx, rubrik, status, inaktuellOrsak, kalla, onBekrafta, onTaBort, extra, children }: {
  tx: Tx; rubrik: ReactNode; status: Bekraftelse; inaktuellOrsak?: string; kalla?: string;
  onBekrafta: () => void; onTaBort: () => void; extra?: ReactNode; children: ReactNode;
}) {
  const ram = status === "inaktuell" ? "border-warning-deep/30" : status === "bekraftad" ? "border-line" : "border-dashed border-muted-foreground/30";
  return (
    <li className={`rounded-lg border bg-surface p-3 shadow-xs sm:p-4 ${ram}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm text-foreground min-w-0 break-words">{rubrik}</span>
        <Statusbricka tx={tx} status={status} orsak={inaktuellOrsak} />
        {extra}
        <span className="flex-1" />
        <button type="button" onClick={onBekrafta}
          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${status === "bekraftad" ? "border-border text-muted-foreground hover:text-foreground" : "border-success/40 text-success-deep hover:bg-success-surface"}`}>
          {status === "bekraftad" ? tx("Ångra bekräftelse", "Undo confirmation") : tx("Bekräfta", "Confirm")}
        </button>
        <button type="button" onClick={onTaBort}
          className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-danger-deep/40 hover:text-danger-deep">
          {tx("Ta bort", "Remove")}
        </button>
      </div>
      {status === "inaktuell" && inaktuellOrsak && (
        <p className="mt-1 text-xs text-warning-deep">{tx("Inaktuell", "Outdated")}: {inaktuellOrsak}</p>
      )}
      {kalla && <p className="mt-0.5 text-[11px] text-muted-foreground">{tx("Källa", "Source")}: {kalla}</p>}
      <div className="mt-3 grid sm:grid-cols-2 gap-x-3 gap-y-2">{children}</div>
    </li>
  );
}

/** Knappen som hämtar förslag ur stycklistan, och vad den gör med det som finns. */
export function Forslagsknapp({ tx, text, onClick, disabled, meddelande }: {
  tx: Tx; text: string; onClick: () => void; disabled?: boolean; meddelande?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Förslagen är systemets: streckad form och gnistan, samma tecken som på
          förslagsmärket, så att knappen inte läses som ett beslut. */}
      <button type="button" onClick={onClick} disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-surface px-3.5 py-1.5 text-sm font-medium text-primary shadow-xs transition-colors hover:border-primary hover:bg-primary/[0.04] disabled:opacity-50">
        <Sparkles aria-hidden className="size-3.5" />
        {text}
      </button>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {meddelande ?? tx("Förslagen kommer ur stycklistan och kravbilden. Det du redan ändrat skrivs aldrig över.", "Proposals come from the bill of materials and the requirements. What you have already changed is never overwritten.")}
      </span>
    </div>
  );
}

/** Byter status mellan föreslagen och bekräftad. En inaktuell post bekräftas på nytt. */
export function vaxlaBekraftelse<T extends { status: Bekraftelse; inaktuellOrsak?: string; andrad: string }>(p: T): T {
  const ny: Bekraftelse = p.status === "bekraftad" ? "foreslagen" : "bekraftad";
  return { ...p, status: ny, inaktuellOrsak: ny === "bekraftad" ? undefined : p.inaktuellOrsak, andrad: new Date().toISOString() };
}

export function uppdatera<T extends { id: string; andrad: string }>(lista: T[], id: string, del: Partial<T>): T[] {
  return lista.map((x) => (x.id === id ? { ...x, ...del, andrad: new Date().toISOString() } : x));
}
