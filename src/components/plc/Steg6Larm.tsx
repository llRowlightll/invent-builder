import { useState } from "react";
import { foreslaLarm, sammanfoga } from "@/lib/plc/harledning";
import { nyttId, type Larm, type Underlag } from "@/lib/plc/modell";
import { Falt, Forslagsknapp, Postkort, uppdatera, Val, vaxlaBekraftelse, type Tx } from "./delad";

/**
 * Steg 6: larmen (ISA-18.2: orsak, konsekvens, åtgärd, tid att agera) och,
 * för sig, de säkerhetsrelaterade granskningspunkterna. En granskningspunkt
 * är ingen logik: säkerhetskretsen styr, standard-PLC:n läser bara status.
 */
export function Steg6Larm({ tx, underlag, sattLarm }: { tx: Tx; underlag: Underlag; sattLarm: (l: Larm[]) => void }) {
  const [meddelande, setMeddelande] = useState<string | undefined>();
  function foresla() {
    const { lista, nya } = sammanfoga(underlag.larm, foreslaLarm(underlag.importerat, underlag.signaler, underlag.steg));
    sattLarm(lista);
    setMeddelande(tx(`${nya} nya larm och granskningspunkter föreslagna.`, `${nya} new alarms and review points proposed.`));
  }
  const grupper: Array<{ typ: Larm["typ"]; namn: [string, string]; text: [string, string] }> = [
    { typ: "process", namn: ["Processlarm", "Process alarms"], text: ["Störningar i processen som operatören åtgärdar.", "Process disturbances the operator deals with."] },
    { typ: "sakerhetsgranskning", namn: ["Säkerhetsrelaterade granskningspunkter", "Safety-related review points"], text: ["Hanteras i säkerhetskretsen enligt riskbedömningen. Fälten för PL och kategori fylls av den som gör riskbedömningen; här föreslås inga nivåer.", "Handled in the safety circuit according to the risk assessment. PL and category are filled in by whoever does the risk assessment; no levels are proposed here."] },
  ];

  return (
    <div className="mt-3 space-y-6">
      <details className="text-sm">
        <summary className="cursor-pointer text-info hover:underline w-fit">{tx("Varför behöver vi detta?", "Why do we need this?")}</summary>
        <p className="mt-2 text-muted-foreground max-w-prose">
          {tx(
            "Ett larm ska tala om vad som hänt, vad operatören ska göra och när maskinen får gå igen (ISA-18.2). Ingen automatisk återstart efter ett larm som kan vara farligt.",
            "An alarm must say what happened, what the operator should do and when the machine may run again (ISA-18.2). No automatic restart after an alarm that may be dangerous.",
          )}
        </p>
      </details>
      <Forslagsknapp tx={tx} text={tx("Föreslå larm", "Propose alarms")} onClick={foresla} meddelande={meddelande} />
      {grupper.map((g) => {
        const rader = underlag.larm.filter((l) => l.typ === g.typ);
        return (
          <section key={g.typ} className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{tx(g.namn[0], g.namn[1])} ({rader.length})</h3>
            <p className="text-xs text-muted-foreground max-w-prose">{tx(g.text[0], g.text[1])}</p>
            <ul className="space-y-2">
              {rader.map((l) => (
                <Postkort key={l.id} tx={tx} rubrik={`${l.nummer} ${l.operatorstext || l.villkor}`} status={l.status} inaktuellOrsak={l.inaktuellOrsak}
                  onBekrafta={() => sattLarm(underlag.larm.map((x) => (x.id === l.id ? vaxlaBekraftelse(x) : x)))}
                  onTaBort={() => sattLarm(underlag.larm.filter((x) => x.id !== l.id))}>
                  <div className="sm:col-span-2"><Falt id={`${l.id}-villkor`} etikett={tx("Utlösande villkor", "Triggering condition")} value={l.villkor} flerrader onChange={(v) => sattLarm(uppdatera(underlag.larm, l.id, { villkor: v }))} /></div>
                  <Falt id={`${l.id}-funktion`} etikett={tx("Berörd funktion", "Affected function")} value={l.funktion} onChange={(v) => sattLarm(uppdatera(underlag.larm, l.id, { funktion: v }))} />
                  <Falt id={`${l.id}-text`} etikett={tx("Operatörstext", "Operator text")} value={l.operatorstext} onChange={(v) => sattLarm(uppdatera(underlag.larm, l.id, { operatorstext: v }))} />
                  <Falt id={`${l.id}-reaktion`} etikett={tx("Förväntad reaktion", "Expected reaction")} value={l.reaktion} flerrader onChange={(v) => sattLarm(uppdatera(underlag.larm, l.id, { reaktion: v }))} />
                  <Falt id={`${l.id}-aterst`} etikett={tx("Återställningsvillkor", "Reset condition")} value={l.aterstallning} flerrader onChange={(v) => sattLarm(uppdatera(underlag.larm, l.id, { aterstallning: v }))} />
                  <Falt id={`${l.id}-fortsatt`} etikett={tx("Villkor för fortsatt drift", "Condition to continue")} value={l.fortsattDrift} onChange={(v) => sattLarm(uppdatera(underlag.larm, l.id, { fortsattDrift: v }))} />
                  <Val id={`${l.id}-typ`} etikett={tx("Typ", "Type")} value={l.typ}
                    alternativ={[{ id: "process", text: tx("Processlarm", "Process alarm") }, { id: "sakerhetsgranskning", text: tx("Säkerhetsrelaterad granskningspunkt", "Safety-related review point") }]}
                    onChange={(v) => sattLarm(uppdatera(underlag.larm, l.id, { typ: v }))} />
                </Postkort>
              ))}
            </ul>
          </section>
        );
      })}
      <button type="button" className="text-sm text-info hover:underline" onClick={() => sattLarm([...underlag.larm, {
        id: nyttId("larm"), nummer: `L${underlag.larm.filter((l) => l.typ === "process").length + 1}`, villkor: "", funktion: "", operatorstext: "",
        reaktion: "", aterstallning: "", fortsattDrift: "", typ: "process", signaler: [], steg: "", ursprung: "manuell", status: "foreslagen",
        kalla: "manuell", andrad: new Date().toISOString(),
      }])}>+ {tx("Lägg till larm", "Add alarm")}</button>
    </div>
  );
}
