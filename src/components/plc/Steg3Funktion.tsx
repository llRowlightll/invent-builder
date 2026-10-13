import type { Driftlage, Funktion, Underlag } from "@/lib/plc/modell";
import { Falt, type Tx } from "./delad";

const LAGEN: Array<{ id: Driftlage; sv: string; en: string; textSv: string; textEn: string }> = [
  { id: "produktion", sv: "Produktion (automatiskt)", en: "Production (automatic)", textSv: "Maskinen går sin sekvens; operatören startar och stoppar.", textEn: "The machine runs its sequence; the operator starts and stops." },
  { id: "underhall", sv: "Underhåll", en: "Maintenance", textSv: "Reducerad funktion för service och felsökning.", textEn: "Reduced function for service and troubleshooting." },
  { id: "manuell", sv: "Manuell", en: "Manual", textSv: "Enstaka rörelser körs för hand, med förreglingar.", textEn: "Single motions run by hand, with interlocks." },
];

/**
 * Steg 3: funktionen med användarens egna ord och driftlägena (PackML,
 * ISA-TR88.00.02). Processbeskrivningen från maskinprojektet kan tas som
 * utgångspunkt, men texten är användarens -- inget fylls i av sig självt.
 */
export function Steg3Funktion({ tx, underlag, andra }: { tx: Tx; underlag: Underlag; andra: (d: Partial<Funktion>) => void }) {
  const f = underlag.funktion;
  const process = underlag.importerat.processbeskrivning ?? "";
  return (
    <div className="mt-3 space-y-6">
      <details className="text-sm">
        <summary className="cursor-pointer text-info hover:underline w-fit">{tx("Varför behöver vi detta?", "Why do we need this?")}</summary>
        <p className="mt-2 text-muted-foreground max-w-prose">
          {tx(
            "Funktionsbeskrivningen är det programmeraren arbetar efter och det FAT/SAT prövar mot. Driftlägena och villkoren för att byta läge krävs enligt IEC 60204-1 och maskindirektivet (bilaga I, 1.2.5).",
            "The functional description is what the programmer works from and what FAT/SAT tests against. Operating modes and the conditions for changing mode are required by IEC 60204-1 and the Machinery Directive (Annex I, 1.2.5).",
          )}
        </p>
      </details>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{tx("Funktion", "Function")}</h3>
          {process && !f.beskrivning.trim() && (
            <button type="button" onClick={() => andra({ beskrivning: process })} className="text-xs text-info hover:underline">
              {tx("Utgå från processbeskrivningen", "Start from the process description")}
            </button>
          )}
        </div>
        <Falt id="f-beskrivning" etikett={tx("Vad maskinen eller stationen gör, med egna ord", "What the machine or station does, in your own words")}
          value={f.beskrivning} onChange={(v) => andra({ beskrivning: v })} flerrader />
        <div className="grid sm:grid-cols-2 gap-3">
          <Falt id="f-start" etikett={tx("Startvillkor", "Start conditions")} value={f.startvillkor} onChange={(v) => andra({ startvillkor: v })} flerrader
            placeholder={tx("t.ex. Tryckluft på, grundläge, ingen aktiv störning", "e.g. Air on, home position, no active fault")} />
          <Falt id="f-slut" etikett={tx("Slutvillkor", "End conditions")} value={f.slutvillkor} onChange={(v) => andra({ slutvillkor: v })} flerrader />
          <Falt id="f-samverkan" etikett={tx("Samverkan med andra stationer", "Interaction with other stations")} value={f.samverkan} onChange={(v) => andra({ samverkan: v })} flerrader
            placeholder={tx("t.ex. Signal från kontrollstationen, bandets styrning", "e.g. Signal from the inspection station, the conveyor's control")} />
          <Falt id="f-operator" etikett={tx("Operatörens uppgifter", "Operator tasks")} value={f.operator} onChange={(v) => andra({ operator: v })} flerrader />
          <Falt id="f-varianter" etikett={tx("Produktvarianter och recept", "Product variants and recipes")} value={f.varianter} onChange={(v) => andra({ varianter: v })} flerrader />
        </div>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">{tx("Driftlägen (PackML)", "Operating modes (PackML)")}</legend>
        <div className="grid sm:grid-cols-3 gap-2">
          {LAGEN.map((l) => {
            const vald = f.lagen.includes(l.id);
            return (
              <label key={l.id} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${vald ? "border-info bg-info/5" : "border-border hover:border-info/60"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info`}>
                <input type="checkbox" checked={vald} className="mt-0.5 accent-info"
                  onChange={() => andra({ lagen: vald ? f.lagen.filter((x) => x !== l.id) : LAGEN.map((x) => x.id).filter((x) => x === l.id || f.lagen.includes(x)) })} />
                <span>
                  <span className="block text-foreground">{tx(l.sv, l.en)}</span>
                  <span className="block text-xs text-muted-foreground">{tx(l.textSv, l.textEn)}</span>
                </span>
              </label>
            );
          })}
        </div>
        <Falt id="f-lagesbyte" etikett={tx("Villkor för lägesbyte", "Conditions for changing mode")} value={f.lagesbyte} onChange={(v) => andra({ lagesbyte: v })} flerrader
          hjalp={tx("Vem får byta läge, hur väljs det, och vad händer med pågående rörelse.", "Who may change mode, how it is selected, and what happens to an ongoing motion.")} />
      </fieldset>
    </div>
  );
}
