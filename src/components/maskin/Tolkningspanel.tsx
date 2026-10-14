import {
  delaSvar, EGENSKAPSNAMN, kravetsVarde, OBJEKTNAMN, TOLKNINGSPREFIX, tolkaKravbild,
  type Krav, type ObjektTyp,
} from "../../../supabase/functions/groq-advisor/kravbild.ts";
import { Statusmarke } from "@/components/design/Statusmarke";

/**
 * "Så här tolkade vi beskrivningen" (manualen 4.1): uppgifterna systemet läst
 * ut, de tolkningar det inte kan avgöra själv och det som saknas -- innan
 * komponenterna väljs. Användarens beslut sparas i svaren med prefixet
 * "tolkning:", så att de följer med till motorn och projektet utan att nå
 * detektorerna som text (kravbild.ts, delaSvar).
 */
export function Tolkningspanel({ locale, description, answers, setAnswers }: {
  locale: string;
  description: string;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
}) {
  const sv = locale === "sv";
  const tx = (s: string, e: string) => (sv ? s : e);
  const { svar, tolkning } = delaSvar(answers);
  const kb = tolkaKravbild(description, svar, tolkning);
  const franBeskrivningen = kb.krav.filter((k) => k.kalla.typ !== "svar");
  const allaBekraftade = tolkning["alla"] === "bekraftat";

  function satt(nyckel: string, varde: string | null) {
    const ny = { ...answers };
    if (varde === null) delete ny[TOLKNINGSPREFIX + nyckel];
    else ny[TOLKNINGSPREFIX + nyckel] = varde;
    setAnswers(ny);
  }

  const grupper = new Map<string, Krav[]>();
  for (const k of franBeskrivningen) {
    const lista = grupper.get(k.objektId) ?? [];
    lista.push(k);
    grupper.set(k.objektId, lista);
  }

  if (franBeskrivningen.length === 0 && kb.osakra.length === 0 && kb.saknas.length === 0) return null;

  return (
    <section className="arbetsyta space-y-5 p-5 sm:p-6" aria-labelledby="tolkning-rubrik">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="tolkning-rubrik" className="text-sm font-semibold text-foreground">{tx("Så här tolkade vi beskrivningen", "How we read the description")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            {tx(
              "Kontrollera innan komponenterna väljs. Markera det som inte stämmer, eller gå tillbaka och skriv om beskrivningen.",
              "Check before the components are chosen. Mark what is wrong, or go back and rewrite the description.",
            )}
          </p>
        </div>
        {franBeskrivningen.length > 0 && (
          <button
            type="button"
            onClick={() => satt("alla", allaBekraftade ? null : "bekraftat")}
            aria-pressed={allaBekraftade}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${allaBekraftade ? "border-success/40 bg-success-surface font-medium text-success-deep" : "border-border bg-surface text-foreground shadow-xs hover:border-primary/40"}`}
          >
            {allaBekraftade ? `✓ ${tx("Tolkningen är bekräftad", "Reading confirmed")}` : tx("Allt stämmer, bekräfta", "All correct, confirm")}
          </button>
        )}
      </div>

      {franBeskrivningen.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground">{tx("Identifierade uppgifter", "Identified data")}</h4>
          {[...grupper.entries()].map(([objekt, lista]) => (
            <div key={objekt}>
              <div className="text-xs font-medium text-foreground mb-1">{OBJEKTNAMN[objekt as ObjektTyp]?.[sv ? 0 : 1] ?? objekt}</div>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {lista.map((k) => {
                  const beslut = tolkning[k.id];
                  const avvisad = k.bekraftelse === "avvisat";
                  return (
                    <li key={k.id} className={`grid grid-cols-1 items-center gap-x-3 gap-y-1.5 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] ${avvisad ? "opacity-60" : ""}`}>
                      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-muted-foreground min-w-[9rem]">{EGENSKAPSNAMN[k.egenskap]?.[sv ? 0 : 1] ?? k.egenskap}</span>
                      <span className={`font-medium text-foreground ${avvisad ? "line-through" : ""}`}>{kravetsVarde(k, locale)}</span>
                      {k.ursprung === "berakning" && (
                        <span title={k.metod}><Statusmarke tillstand="preliminart" text={tx("Härlett", "Derived")} locale={locale} /></span>
                      )}
                      </span>
                      <span className="flex flex-wrap items-center justify-start gap-1.5 sm:justify-end">
                      <Statusmarke
                        tillstand={k.bekraftelse === "bekraftat" ? "bekraftat" : avvisad ? "uppfyllerInte" : "forslag"}
                        text={k.bekraftelse === "bekraftat" ? tx("Bekräftad", "Confirmed") : avvisad ? tx("Stämmer inte", "Rejected") : tx("Ej bekräftad", "Not confirmed")}
                        locale={locale}
                      />
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => satt(k.id, beslut === "bekraftat" ? null : "bekraftat")}
                          aria-pressed={beslut === "bekraftat"}
                          aria-label={`${tx("Stämmer", "Correct")}: ${EGENSKAPSNAMN[k.egenskap]?.[sv ? 0 : 1] ?? k.egenskap} ${kravetsVarde(k, locale)}`}
                          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${beslut === "bekraftat" ? "border-success/40 bg-success-surface text-success-deep" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                        >
                          {tx("Stämmer", "Correct")}
                        </button>
                        <button
                          type="button"
                          onClick={() => satt(k.id, beslut === "avvisat" ? null : "avvisat")}
                          aria-pressed={beslut === "avvisat"}
                          aria-label={`${tx("Stämmer inte", "Wrong")}: ${EGENSKAPSNAMN[k.egenskap]?.[sv ? 0 : 1] ?? k.egenskap} ${kravetsVarde(k, locale)}`}
                          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${beslut === "avvisat" ? "border-danger-deep/30 bg-danger-surface text-danger-deep" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                        >
                          {tx("Stämmer inte", "Wrong")}
                        </button>
                      </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {kb.osakra.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground">{tx("Osäkra tolkningar: ditt besked behövs", "Uncertain readings: your call is needed")}</h4>
          {kb.osakra.map((o) => (
            <fieldset key={o.id} className="rounded-lg border border-warning-deep/20 bg-warning-surface px-4 py-3">
              <legend className="sr-only">{sv ? o.fraga.sv : o.fraga.en}</legend>
              <p className="text-sm text-foreground">{sv ? o.fraga.sv : o.fraga.en}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {o.alternativ.map((a) => {
                  const vald = tolkning[o.id] === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => satt(o.id, a.id)}
                      aria-pressed={vald}
                      className={`rounded-full border px-3.5 py-1 text-sm transition-colors ${vald ? "border-primary bg-primary font-medium text-primary-foreground" : "border-border bg-surface text-foreground hover:border-primary/40"}`}
                    >
                      {vald && "✓ "}{sv ? a.sv : a.en}
                      {!tolkning[o.id] && o.forval === a.id && <span className="ml-1 text-[11px] text-muted-foreground">({tx("antas tills du väljer", "assumed until you choose")})</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {kb.saknas.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">{tx("Saknas för nästa beslut", "Missing for the next decision")}</h4>
          <ul className="space-y-1">
            {kb.saknas.map((s) => (
              <li key={s.id} className="text-sm">
                <details>
                  <summary className="cursor-pointer text-foreground marker:text-muted-foreground">{sv ? s.sv : s.en}</summary>
                  <p className="mt-1 ml-4 text-xs text-muted-foreground max-w-prose">{sv ? s.varfor.sv : s.varfor.en}</p>
                </details>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {tx(
              "Frågorna nedan täcker det som påverkar komponentvalet. Resten följer med till Styrning & programmering som öppna frågor. Inget fylls i med påhittade värden.",
              "The questions below cover what affects the component choice. The rest goes on to Control & programming as open questions. Nothing is filled in with invented values.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
