import { ClipboardCheck, Cpu, ListChecks, Workflow } from "lucide-react";
import { Statusmarke } from "@/components/design/Statusmarke";
import { STEG as PLC_STEG } from "@/lib/plc/steg";

// Styrningssteget säger bara det PLC-modulen faktiskt har (lib/plc/steg.ts).
const IO_FINNS = PLC_STEG.find((s) => s.nr === 4)?.finns ?? false;

/**
 * Sambandet på startsidan: behov -> komponenter -> styrning ->
 * granskningsunderlag (brief punkt 4). Ett diagram över vad sajten gör, inte
 * en låtsasskärmbild: varje rad säger vad steget lämnar efter sig. Exemplet
 * är regressionsfallet med plastlådorna (fixtur-sortering.ts), så siffrorna
 * är de motorn faktiskt prövas mot.
 *
 * Rörelsen är en kort trappa in (rorelse-in), av vid reducerad rörelse.
 */
const STEG = {
  sv: [
    { Ikon: ListChecks, rubrik: "Behov", text: "Lådor 0,5–3 kg, upp till 15 per minut, 350 mm i sidled." },
    { Ikon: Workflow, rubrik: "Komponenter", text: "Cylinder, 5/2-ventil och givare, prövade mot kraven." },
    { Ikon: Cpu, rubrik: "Styrning", text: IO_FINNS ? "I/O-lista, sekvens och larm för er PLC." : "Programmeringsunderlag för er PLC, steg för steg." },
    { Ikon: ClipboardCheck, rubrik: "Granskningsunderlag", text: "Krav, antaganden och öppna frågor, med revision." },
  ],
  en: [
    { Ikon: ListChecks, rubrik: "Need", text: "Boxes 0.5–3 kg, up to 15 a minute, 350 mm sideways." },
    { Ikon: Workflow, rubrik: "Components", text: "Cylinder, 5/2 valve and sensors, checked against the requirements." },
    { Ikon: Cpu, rubrik: "Control", text: IO_FINNS ? "I/O list, sequence and alarms for your PLC." : "Programming documentation for your PLC, step by step." },
    { Ikon: ClipboardCheck, rubrik: "Review documentation", text: "Requirements, assumptions and open questions, with revision." },
  ],
};

export function Flodesbild({ locale }: { locale: string }) {
  const sv = locale === "sv";
  const steg = sv ? STEG.sv : STEG.en;
  const trappa = ["", "rorelse-steg-1", "rorelse-steg-2", "rorelse-steg-3"];
  return (
    <figure className="kort relative p-5 sm:p-6" aria-label={sv ? "Från behov till granskningsunderlag" : "From need to review documentation"}>
      <figcaption className="text-xs font-medium text-muted-foreground">
        {sv ? "Exempel: utsortering av plastlådor från ett transportband" : "Example: rejecting plastic boxes from a conveyor"}
      </figcaption>
      <ol className="relative mt-4 space-y-4">
        {/* Linjen som binder ihop stegen; ligger bakom ikonerna. */}
        <span aria-hidden className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-cta/50 via-border to-border" />
        {steg.map(({ Ikon, rubrik, text }, i) => (
          <li key={rubrik} className={`relative flex gap-3 rorelse-in ${trappa[i]}`}>
            <span className={`relative grid size-8 shrink-0 place-items-center rounded-lg border ${i === 0 ? "border-cta/30 bg-gold-surface text-gold-deep" : "border-line bg-surface text-primary"}`}>
              <Ikon aria-hidden className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-foreground">{rubrik}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-xs text-muted-foreground">{sv ? "Varje uppgift visar sin status:" : "Every item shows its status:"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Statusmarke tillstand="bekraftat" locale={locale} />
          <Statusmarke tillstand="preliminart" locale={locale} />
          <Statusmarke tillstand="oppen" locale={locale} />
        </div>
      </div>
    </figure>
  );
}
