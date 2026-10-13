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

const BERAKNINGSSTATUS: Record<string, [string, string]> = {
  ej_utford: ["Ej utförd", "Not performed"],
  preliminar: ["Preliminär", "Preliminary"],
  underlag_otillrackligt: ["Underlag otillräckligt", "Insufficient data"],
  utford: ["Utförd inom angiven omfattning", "Performed within stated scope"],
  inaktuell: ["Inaktuell", "Outdated"],
};

export function Resultatstatus({ locale, resultat }: { locale: string; resultat: ResultatData }) {
  const sv = locale === "sv";
  const tx = (s: string, e: string) => (sv ? s : e);
  const statusar: Array<{ ja: boolean; namn: string; nej: string }> = [
    { ja: resultat.status.underlagKomplett, namn: tx("Underlag komplett", "Data complete"), nej: tx("Uppgifter saknas eller väntar på ditt besked", "Data missing or awaiting your decision") },
    { ja: resultat.status.dimensioneringUtford, namn: tx("Dimensionering utförd", "Sizing performed"), nej: tx("Bygger på en preliminär uppskattning", "Based on a preliminary estimate") },
    { ja: resultat.status.kompatibilitetKontrollerad, namn: tx("Kompatibilitet kontrollerad", "Compatibility checked"), nej: tx("Alla krav kunde inte prövas", "Not every requirement could be checked") },
    { ja: resultat.status.bestallningskoderKompletta, namn: tx("Beställningskoder kompletta", "Order codes complete"), nej: tx("Platshållare eller konfiguration återstår", "Placeholders or configuration remain") },
  ];

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-2">{tx("Status", "Status")}</div>
        <ul className="grid sm:grid-cols-2 gap-2">
          {statusar.map((s) => (
            <li key={s.namn} className={`rounded-lg border px-3 py-2 text-sm ${s.ja ? "border-success/40 bg-success-surface" : "border-warning/40 bg-warning-surface"}`}>
              <span className="font-medium text-foreground">{s.ja ? "✓" : "–"} {s.namn}: </span>
              <span className={s.ja ? "text-success-deep" : "text-warning-deep"}>{s.ja ? tx("ja", "yes") : `${tx("nej", "no")} — ${s.nej}`}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          {tx(
            "En beställningsbar stycklista är inte en godkänd maskin. Riskbedömning, säkerhetsfunktioner och validering hanteras separat av ansvariga personer.",
            "An orderable bill of materials is not an approved machine. Risk assessment, safety functions and validation are handled separately by the responsible persons.",
          )}
        </p>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-2">{tx("Beräkningar", "Calculations")}</div>
        <ul className="space-y-2">
          {resultat.berakningar.map((b) => (
            <li key={b.id} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{b.namn}</span>
                {b.resultat && <span className="tabular">{b.resultat}</span>}
                <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${b.status === "utford" ? "bg-success-surface text-success-deep" : "bg-warning-surface text-warning-deep"}`}>
                  {BERAKNINGSSTATUS[b.status]?.[sv ? 0 : 1] ?? b.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{b.metod}</p>
            </li>
          ))}
        </ul>
      </div>

      {resultat.konfiguration.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-2">{tx("Återstående konfiguration", "Remaining configuration")}</div>
          <ul className="space-y-1.5">
            {resultat.konfiguration.map((k, i) => (
              <li key={`${k.sku}-${i}`} className="text-sm">
                <span className="tabular font-medium">{k.sku}</span>
                <span className="text-muted-foreground"> — {k.roll}: </span>
                {k.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultat.oppnaPunkter.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-2">{tx("Öppna frågor", "Open questions")}</div>
          <ul className="list-disc ml-5 space-y-0.5 text-sm text-foreground">
            {resultat.oppnaPunkter.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("Följer med till Styrning & programmering.", "Carried over to Control & programming.")}
          </p>
        </div>
      )}
    </div>
  );
}
