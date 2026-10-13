import { useState } from "react";
import { foreslaParametrar, foreslaSignaler, kontrolleraSignaler, sammanfoga } from "@/lib/plc/harledning";
import { nyttId, type Datatyp, type Parameter, type Signal, type Signaltyp, type Underlag } from "@/lib/plc/modell";
import { Falt, Forslagsknapp, Postkort, uppdatera, Val, vaxlaBekraftelse, type Tx } from "./delad";

const TYPER: Array<{ id: Signaltyp; text: string }> = [
  { id: "DI", text: "DI" }, { id: "DO", text: "DO" }, { id: "AI", text: "AI" }, { id: "AO", text: "AO" },
  { id: "kommunikation", text: "Kommunikation" }, { id: "intern", text: "Intern" },
];
const DATATYPER: Array<{ id: Datatyp; text: string }> = [
  { id: "", text: "–" }, { id: "BOOL", text: "BOOL" }, { id: "INT", text: "INT" }, { id: "DINT", text: "DINT" },
  { id: "REAL", text: "REAL" }, { id: "WORD", text: "WORD" }, { id: "TIME", text: "TIME" },
];

const GRUPPER: Array<{ namn: [string, string]; typer: Signaltyp[] }> = [
  { namn: ["Fysisk I/O", "Physical I/O"], typer: ["DI", "DO", "AI", "AO"] },
  { namn: ["Kommunikationssignaler", "Communication signals"], typer: ["kommunikation"] },
  { namn: ["Interna variabler", "Internal variables"], typer: ["intern"] },
];

/**
 * Steg 4: I/O-listan och parametrarna. Förslagen härleds ur stycklistan
 * (harledning.ts); adresser, gränser och standardvärden fylls bara i när de
 * är kända -- de hittas aldrig på.
 */
export function Steg4Signaler({ tx, underlag, sattSignaler, sattParametrar }: {
  tx: Tx; underlag: Underlag; sattSignaler: (s: Signal[]) => void; sattParametrar: (p: Parameter[]) => void;
}) {
  const [meddelande, setMeddelande] = useState<string | undefined>();
  const [pMeddelande, setPMeddelande] = useState<string | undefined>();
  const fel = kontrolleraSignaler(underlag.signaler);
  const felFor = (id: string) => fel.filter((f) => f.signalId === id);

  function foresla() {
    const { lista, nya } = sammanfoga(underlag.signaler, foreslaSignaler(underlag.importerat));
    sattSignaler(lista);
    setMeddelande(nya > 0
      ? tx(`${nya} nya signaler föreslagna ur stycklistan.`, `${nya} new signals proposed from the bill of materials.`)
      : tx("Inga nya förslag: allt i stycklistan finns redan i listan.", "No new proposals: everything in the bill of materials is already listed."));
  }
  function laggTill() {
    sattSignaler([...underlag.signaler, {
      id: nyttId("sig"), tagg: "", namn: "", beskrivning: "", typ: "DI", datatyp: "BOOL", adress: "", kallaText: tx("Manuell", "Manual"),
      mottagare: "", felsakert: "", ursprung: "manuell", status: "foreslagen", kalla: "manuell", andrad: new Date().toISOString(),
    }]);
  }
  function foreslaPar() {
    if (underlag.steg.length === 0) {
      setPMeddelande(tx("Parametrarna härleds ur sekvensens tidsgränser. Föreslå sekvensen i steg 5 först.", "Parameters are derived from the sequence's time limits. Propose the sequence in step 5 first."));
      return;
    }
    const { lista, nya } = sammanfoga(underlag.parametrar, foreslaParametrar(underlag.steg));
    sattParametrar(lista);
    setPMeddelande(tx(`${nya} nya parametrar föreslagna.`, `${nya} new parameters proposed.`));
  }

  return (
    <div className="mt-3 space-y-6">
      <details className="text-sm">
        <summary className="cursor-pointer text-info hover:underline w-fit">{tx("Varför behöver vi detta?", "Why do we need this?")}</summary>
        <p className="mt-2 text-muted-foreground max-w-prose">
          {tx(
            "I/O-listan binder ihop elritning, PLC och test. Beteckningarna följer IEC 81346 (-QM ventil, -BG givare, -TA drivsteg) så att samma namn går igen i elritningen. En cylinder med två givare och en monostabil 5/2-ventil ger en utgång och två ingångar.",
            "The I/O list ties together wiring diagram, PLC and test. Designations follow IEC 81346 (-QM valve, -BG sensor, -TA drive) so the same names recur in the wiring diagram. A cylinder with two sensors and a monostable 5/2 valve gives one output and two inputs.",
          )}
        </p>
      </details>

      <section className="space-y-3" aria-labelledby="sig-rubrik">
        <h3 id="sig-rubrik" className="text-sm font-semibold text-foreground">{tx("Signaler", "Signals")} ({underlag.signaler.length})</h3>
        <Forslagsknapp tx={tx} text={tx("Föreslå signaler ur stycklistan", "Propose signals from the bill of materials")} onClick={foresla} meddelande={meddelande} />
        {fel.length > 0 && (
          <ul role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive space-y-0.5">
            {fel.map((f, i) => <li key={i}>{f.text}</li>)}
          </ul>
        )}
        {GRUPPER.map((g) => {
          const rader = underlag.signaler.filter((s) => g.typer.includes(s.typ));
          if (rader.length === 0) return null;
          return (
            <div key={g.namn[0]}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{tx(g.namn[0], g.namn[1])}</h4>
              <ul className="space-y-2">
                {rader.map((s) => (
                  <Postkort key={s.id} tx={tx} rubrik={<><span className="font-mono">{s.tagg || "–"}</span> {s.namn}</>}
                    status={s.status} inaktuellOrsak={s.inaktuellOrsak} kalla={s.kallaText}
                    onBekrafta={() => sattSignaler(underlag.signaler.map((x) => (x.id === s.id ? vaxlaBekraftelse(x) : x)))}
                    onTaBort={() => sattSignaler(underlag.signaler.filter((x) => x.id !== s.id))}>
                    <Falt id={`${s.id}-tagg`} etikett={tx("Beteckning (IEC 81346)", "Designation (IEC 81346)")} value={s.tagg} monospace
                      onChange={(v) => sattSignaler(uppdatera(underlag.signaler, s.id, { tagg: v }))} />
                    <Falt id={`${s.id}-namn`} etikett={tx("Namn", "Name")} value={s.namn} onChange={(v) => sattSignaler(uppdatera(underlag.signaler, s.id, { namn: v }))} />
                    <Val id={`${s.id}-typ`} etikett={tx("Typ", "Type")} value={s.typ} alternativ={TYPER} onChange={(v) => sattSignaler(uppdatera(underlag.signaler, s.id, { typ: v }))} />
                    <Val id={`${s.id}-datatyp`} etikett={tx("Datatyp", "Data type")} value={s.datatyp} alternativ={DATATYPER} onChange={(v) => sattSignaler(uppdatera(underlag.signaler, s.id, { datatyp: v }))} />
                    <Falt id={`${s.id}-adress`} etikett={tx("Adress, om känd", "Address, if known")} value={s.adress} monospace
                      placeholder={tx("Okänd tills hårdvaran är konfigurerad", "Unknown until the hardware is configured")}
                      onChange={(v) => sattSignaler(uppdatera(underlag.signaler, s.id, { adress: v }))} />
                    {s.typ === "DO" || s.typ === "AO" ? (
                      <Falt id={`${s.id}-felsakert`} etikett={tx("Läge vid spänningsbortfall", "State on power loss")} value={s.felsakert}
                        placeholder={tx("Fylls i av en människa", "Filled in by a person")}
                        onChange={(v) => sattSignaler(uppdatera(underlag.signaler, s.id, { felsakert: v }))} />
                    ) : (
                      <Falt id={`${s.id}-mottagare`} etikett={tx("Mottagare", "Receiver")} value={s.mottagare} onChange={(v) => sattSignaler(uppdatera(underlag.signaler, s.id, { mottagare: v }))} />
                    )}
                    <div className="sm:col-span-2">
                      <Falt id={`${s.id}-beskr`} etikett={tx("Beskrivning", "Description")} value={s.beskrivning} flerrader
                        onChange={(v) => sattSignaler(uppdatera(underlag.signaler, s.id, { beskrivning: v }))} />
                    </div>
                    {felFor(s.id).length > 0 && <p className="sm:col-span-2 text-xs text-destructive">{felFor(s.id).map((f) => f.text).join(" · ")}</p>}
                  </Postkort>
                ))}
              </ul>
            </div>
          );
        })}
        <button type="button" onClick={laggTill} className="text-sm text-info hover:underline">+ {tx("Lägg till signal", "Add signal")}</button>
      </section>

      <section className="space-y-3" aria-labelledby="par-rubrik">
        <h3 id="par-rubrik" className="text-sm font-semibold text-foreground">{tx("Parametrar", "Parameters")} ({underlag.parametrar.length})</h3>
        <Forslagsknapp tx={tx} text={tx("Föreslå parametrar ur sekvensen", "Propose parameters from the sequence")} onClick={foreslaPar} meddelande={pMeddelande} />
        <ul className="space-y-2">
          {underlag.parametrar.map((p) => (
            <Postkort key={p.id} tx={tx} rubrik={p.namn || tx("Ny parameter", "New parameter")} status={p.status} inaktuellOrsak={p.inaktuellOrsak}
              onBekrafta={() => sattParametrar(underlag.parametrar.map((x) => (x.id === p.id ? vaxlaBekraftelse(x) : x)))}
              onTaBort={() => sattParametrar(underlag.parametrar.filter((x) => x.id !== p.id))}>
              <Falt id={`${p.id}-namn`} etikett={tx("Namn", "Name")} value={p.namn} onChange={(v) => sattParametrar(uppdatera(underlag.parametrar, p.id, { namn: v }))} />
              <Falt id={`${p.id}-betydelse`} etikett={tx("Betydelse", "Meaning")} value={p.betydelse} onChange={(v) => sattParametrar(uppdatera(underlag.parametrar, p.id, { betydelse: v }))} />
              <Val id={`${p.id}-datatyp`} etikett={tx("Datatyp", "Data type")} value={p.datatyp} alternativ={DATATYPER} onChange={(v) => sattParametrar(uppdatera(underlag.parametrar, p.id, { datatyp: v }))} />
              <Falt id={`${p.id}-enhet`} etikett={tx("Enhet", "Unit")} value={p.enhet} onChange={(v) => sattParametrar(uppdatera(underlag.parametrar, p.id, { enhet: v }))} />
              <Falt id={`${p.id}-min`} etikett={tx("Min, om dokumenterat", "Min, if documented")} value={p.min} onChange={(v) => sattParametrar(uppdatera(underlag.parametrar, p.id, { min: v }))} />
              <Falt id={`${p.id}-max`} etikett={tx("Max, om dokumenterat", "Max, if documented")} value={p.max} onChange={(v) => sattParametrar(uppdatera(underlag.parametrar, p.id, { max: v }))} />
              <Falt id={`${p.id}-standard`} etikett={tx("Standardvärde, om bekräftat", "Default, if confirmed")} value={p.standard} onChange={(v) => sattParametrar(uppdatera(underlag.parametrar, p.id, { standard: v }))} />
              <Val id={`${p.id}-behorighet`} etikett={tx("Får ändras av", "May be changed by")} value={p.behorighet}
                alternativ={[{ id: "", text: "–" }, { id: "operator", text: tx("Operatör", "Operator") }, { id: "underhall", text: tx("Underhåll", "Maintenance") }, { id: "ingenjor", text: tx("Ingenjör", "Engineer") }]}
                onChange={(v) => sattParametrar(uppdatera(underlag.parametrar, p.id, { behorighet: v }))} />
            </Postkort>
          ))}
        </ul>
        <button type="button" className="text-sm text-info hover:underline" onClick={() => sattParametrar([...underlag.parametrar, {
          id: nyttId("par"), namn: "", betydelse: "", datatyp: "", enhet: "", min: "", max: "", standard: "", behorighet: "",
          ursprung: "manuell", status: "foreslagen", kalla: "manuell", andrad: new Date().toISOString(),
        }])}>+ {tx("Lägg till parameter", "Add parameter")}</button>
      </section>
    </div>
  );
}
