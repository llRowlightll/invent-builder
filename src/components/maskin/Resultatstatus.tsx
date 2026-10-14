import { Statusmarke, Statusprick } from "@/components/design/Statusmarke";
import type { Tillstand } from "@/lib/design/status";

/**
 * Resultatets statusar och sektioner (manualen 4.4 och 10), ur motorns
 * strukturerade resultat (resultat.ts). Fyra separata statusar i stället för
 * ett "verifierat": en beställningsbar stycklista är inte samma sak som en
 * granskad maskin.
 */
export interface ResultatData {
  titel: string;
  princip: string;
  text: string;
  berakningar: Array<{ id: string; namn: string; status: string; resultat: string | null; metod: string; saknas: string[] }>;
  oppnaPunkter: string[];
  konfiguration: Array<{ sku: string; roll: string; text: string }>;
  status: {
    underlagKomplett: boolean;
    dimensioneringUtford: boolean;
    kompatibilitetKontrollerad: boolean;
    bestallningskoderKompletta: boolean;
  };
}

const BERAKNINGSSTATUS: Record<string, { text: [string, string]; tillstand: Tillstand }> = {
  ej_utford: { text: ["Ej utförd", "Not performed"], tillstand: "ejProvat" },
  preliminar: { text: ["Preliminär", "Preliminary"], tillstand: "preliminart" },
  underlag_otillrackligt: { text: ["Underlag otillräckligt", "Insufficient data"], tillstand: "komplettering" },
  utford: { text: ["Utförd inom angiven omfattning", "Performed within stated scope"], tillstand: "bekraftat" },
  inaktuell: { text: ["Inaktuell", "Outdated"], tillstand: "komplettering" },
};

export function Resultatstatus({ locale, resultat }: { locale: string; resultat: ResultatData }) {
  const sv = locale === "sv";
  const tx = (s: string, e: string) => (sv ? s : e);
  const statusar: Array<{ ja: boolean; namn: string; nej: string }> = [
    { ja: resultat.status.underlagKomplett, namn: tx("Underlag komplett", "Data complete"), nej: tx("Uppgifter saknas eller väntar på ditt besked.", "Data missing or awaiting your decision.") },
    { ja: resultat.status.dimensioneringUtford, namn: tx("Dimensionering utförd", "Sizing performed"), nej: tx("Bygger på en preliminär uppskattning.", "Based on a preliminary estimate.") },
    { ja: resultat.status.kompatibilitetKontrollerad, namn: tx("Kompatibilitet kontrollerad", "Compatibility checked"), nej: tx("Alla krav kunde inte prövas.", "Not every requirement could be checked.") },
    { ja: resultat.status.bestallningskoderKompletta, namn: tx("Beställningskoder kompletta", "Order codes complete"), nej: tx("Platshållare eller konfiguration återstår.", "Placeholders or configuration remain.") },
  ];

  return (
    <div className="kort space-y-6 px-5 py-5 sm:px-6">
      <section aria-labelledby="resultat-status">
        <h3 id="resultat-status" className="text-sm font-semibold text-foreground">{tx("Status", "Status")}</h3>
        <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {statusar.map((s) => (
            <li key={s.namn} className="flex items-start justify-between gap-3 border-t border-line pt-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-foreground">{s.namn}</span>
                {!s.ja && <span className="block text-xs text-muted-foreground">{s.nej}</span>}
              </span>
              <Statusmarke tillstand={s.ja ? "bekraftat" : "komplettering"} text={s.ja ? tx("Ja", "Yes") : tx("Nej", "No")} locale={locale} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          {tx(
            "En beställningsbar stycklista är inte en godkänd maskin. Riskbedömning, säkerhetsfunktioner och validering hanteras separat av ansvariga personer.",
            "An orderable bill of materials is not an approved machine. Risk assessment, safety functions and validation are handled separately by the responsible persons.",
          )}
        </p>
      </section>

      {resultat.berakningar.length > 0 && (
        <section aria-labelledby="resultat-berakningar">
          <h3 id="resultat-berakningar" className="text-sm font-semibold text-foreground">{tx("Beräkningar", "Calculations")}</h3>
          <ul className="mt-3 space-y-3">
            {resultat.berakningar.map((b) => {
              const st = BERAKNINGSSTATUS[b.status];
              return (
                <li key={b.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{b.namn}</span>
                    {b.resultat && <span className="tabular text-foreground">{b.resultat}</span>}
                    <Statusmarke tillstand={st?.tillstand ?? "komplettering"} text={st ? st.text[sv ? 0 : 1] : b.status} locale={locale} />
                  </div>
                  <p className="mt-1 max-w-prose text-xs text-muted-foreground">{b.metod}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {resultat.konfiguration.length > 0 && (
        <section aria-labelledby="resultat-konfig">
          <h3 id="resultat-konfig" className="text-sm font-semibold text-foreground">{tx("Återstående konfiguration", "Remaining configuration")}</h3>
          <ul className="mt-2 space-y-1.5">
            {resultat.konfiguration.map((k, i) => (
              <li key={`${k.sku}-${i}`} className="text-sm">
                <span className="tabular font-medium">{k.sku}</span>
                <span className="text-muted-foreground"> {k.roll}: </span>
                {k.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {resultat.oppnaPunkter.length > 0 && (
        <section aria-labelledby="resultat-oppna">
          <h3 id="resultat-oppna" className="text-sm font-semibold text-foreground">{tx("Öppna frågor", "Open questions")}</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {resultat.oppnaPunkter.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Statusprick tillstand="oppen" className="mt-[7px]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {tx("Följer med till Styrning & programmering.", "Carried over to Control & programming.")}
          </p>
        </section>
      )}
    </div>
  );
}
