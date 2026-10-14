import { useState } from "react";
import { foreslaTestfall, sammanfoga } from "@/lib/plc/harledning";
import { etikett } from "@/lib/plc/leverans";
import { nyttId, type Testfall, type Testmetod, type Underlag } from "@/lib/plc/modell";
import { Falt, Forslagsknapp, Postkort, uppdatera, Val, vaxlaBekraftelse, type Tx } from "./delad";
import { Statusmarke } from "@/components/design/Statusmarke";

/**
 * Steg 7: testplanen som FAT/SAT-protokoll (IEC 62381). Allt börjar som
 * "Ej utfört". Ett utfall registreras av en person, med namn och datum --
 * aldrig av systemet. Metoderna hålls isär: dokumentgranskning, statisk
 * kontroll, kompilering, simulering och verklig utrustning är olika bevis.
 */
export function Steg7Test({ tx, underlag, sattTest }: { tx: Tx; underlag: Underlag; sattTest: (t: Testfall[]) => void }) {
  const [meddelande, setMeddelande] = useState<string | undefined>();
  const METODER: Array<{ id: Testmetod; text: string }> = [
    { id: "dokumentgranskning", text: tx("Dokumentgranskning", "Document review") },
    { id: "statisk_kontroll", text: tx("Statisk kontroll", "Static check") },
    { id: "kompilering", text: tx("Kompilering", "Compilation") },
    { id: "simulering", text: tx("Simulering", "Simulation") },
    { id: "verklig_utrustning", text: tx("Verklig utrustning", "Real equipment") },
  ];
  function foresla() {
    if (underlag.signaler.length === 0 && underlag.steg.length === 0) {
      setMeddelande(tx("Testplanen bygger på signalerna, stegen och larmen. Föreslå dem först.", "The test plan builds on the signals, steps and alarms. Propose them first."));
      return;
    }
    const { lista, nya } = sammanfoga(underlag.testfall, foreslaTestfall(underlag.signaler, underlag.steg, underlag.larm));
    sattTest(lista);
    setMeddelande(tx(`${nya} nya testfall föreslagna. Alla står som ej utförda.`, `${nya} new test cases proposed. All are not performed.`));
  }
  const utforda = underlag.testfall.filter((t) => t.utfall !== "ej_utfort").length;

  return (
    <div className="mt-3 space-y-6">
      <details className="text-sm">
        <summary className="cursor-pointer text-info hover:underline w-fit">{tx("Varför behöver vi detta?", "Why do we need this?")}</summary>
        <p className="mt-2 text-muted-foreground max-w-prose">
          {tx(
            "FAT/SAT börjar med I/O-kontrollen, en rad per signal, och fortsätter med sekvens, larm och felfall. Ett protokoll är ett bevis först när det fyllts i på riktig utrustning, med ansvarig och datum.",
            "FAT/SAT starts with the I/O check, one line per signal, and continues with sequence, alarms and fault cases. A protocol is evidence only once filled in on real equipment, with responsible person and date.",
          )}
        </p>
      </details>
      <Forslagsknapp tx={tx} text={tx("Föreslå testplan", "Propose test plan")} onClick={foresla} meddelande={meddelande} />
      <p className="text-sm text-foreground">{tx(`${underlag.testfall.length} testfall, ${utforda} utförda.`, `${underlag.testfall.length} test cases, ${utforda} performed.`)}</p>
      <ul className="space-y-2">
        {underlag.testfall.map((t) => {
          const kanRegistreras = t.ansvarig.trim() !== "" && t.datum.trim() !== "";
          return (
            <Postkort key={t.id} tx={tx} rubrik={`${t.nummer} ${t.atgard}`} status={t.status} inaktuellOrsak={t.inaktuellOrsak}
              extra={
                // Utfallet är en persons besked, med namn och datum -- aldrig systemets.
                t.utfall === "godkant"
                  ? <Statusmarke tillstand="utfort" text={tx(`Godkänt ${t.datum}, ${t.ansvarig}`, `Passed ${t.datum}, ${t.ansvarig}`)} locale={tx("sv", "en")} />
                  : t.utfall === "ej_godkant"
                    ? <Statusmarke tillstand="uppfyllerInte" text={tx(`Ej godkänt ${t.datum}, ${t.ansvarig}`, `Failed ${t.datum}, ${t.ansvarig}`)} locale={tx("sv", "en")} />
                    : <Statusmarke tillstand="ejProvat" text={tx("Ej utfört", "Not performed")} locale={tx("sv", "en")} />
              }
              kalla={t.avser.length ? t.avser.map((id) => etikett(id, underlag)).join(", ") : t.kravRef}
              onBekrafta={() => sattTest(underlag.testfall.map((x) => (x.id === t.id ? vaxlaBekraftelse(x) : x)))}
              onTaBort={() => sattTest(underlag.testfall.filter((x) => x.id !== t.id))}>
              <Falt id={`${t.id}-forut`} etikett={tx("Förutsättningar", "Preconditions")} value={t.forutsattningar} flerrader onChange={(v) => sattTest(uppdatera(underlag.testfall, t.id, { forutsattningar: v }))} />
              <Falt id={`${t.id}-atgard`} etikett={tx("Teståtgärd", "Test action")} value={t.atgard} flerrader onChange={(v) => sattTest(uppdatera(underlag.testfall, t.id, { atgard: v }))} />
              <Falt id={`${t.id}-forv`} etikett={tx("Förväntat resultat", "Expected result")} value={t.forvantat} flerrader onChange={(v) => sattTest(uppdatera(underlag.testfall, t.id, { forvantat: v }))} />
              <Val id={`${t.id}-metod`} etikett={tx("Testmetod", "Test method")} value={t.metod} alternativ={METODER} onChange={(v) => sattTest(uppdatera(underlag.testfall, t.id, { metod: v }))} />
              <Falt id={`${t.id}-faktiskt`} etikett={tx("Faktiskt resultat", "Actual result")} value={t.faktiskt} flerrader onChange={(v) => sattTest(uppdatera(underlag.testfall, t.id, { faktiskt: v }))} />
              <Falt id={`${t.id}-ansvarig`} etikett={tx("Ansvarig", "Responsible")} value={t.ansvarig} onChange={(v) => sattTest(uppdatera(underlag.testfall, t.id, { ansvarig: v }))} />
              <div className="min-w-0">
                <label htmlFor={`${t.id}-datum`} className="block text-xs font-medium text-muted-foreground">{tx("Datum", "Date")}</label>
                <input id={`${t.id}-datum`} type="date" value={t.datum} onChange={(e) => sattTest(uppdatera(underlag.testfall, t.id, { datum: e.target.value }))}
                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50" />
              </div>
              <div className="min-w-0">
                <Val id={`${t.id}-utfall`} etikett={tx("Utfall", "Outcome")} value={t.utfall}
                  alternativ={[
                    { id: "ej_utfort", text: tx("Ej utfört", "Not performed") },
                    ...(kanRegistreras ? [{ id: "godkant" as const, text: tx("Godkänt", "Passed") }, { id: "ej_godkant" as const, text: tx("Ej godkänt", "Failed") }] : []),
                  ]}
                  onChange={(v) => sattTest(uppdatera(underlag.testfall, t.id, { utfall: v }))} />
                {!kanRegistreras && <p className="text-[11px] text-muted-foreground mt-0.5">{tx("Ett utfall kräver ansvarig och datum.", "An outcome requires a responsible person and a date.")}</p>}
              </div>
            </Postkort>
          );
        })}
      </ul>
      <button type="button" className="text-sm text-info hover:underline" onClick={() => sattTest([...underlag.testfall, {
        id: nyttId("test"), nummer: `T${underlag.testfall.length + 1}`, kravRef: "", forutsattningar: "", atgard: "", forvantat: "",
        metod: "verklig_utrustning", faktiskt: "", ansvarig: "", datum: "", utfall: "ej_utfort", avser: [],
        ursprung: "manuell", status: "foreslagen", kalla: "manuell", andrad: new Date().toISOString(),
      }])}>+ {tx("Lägg till testfall", "Add test case")}</button>
    </div>
  );
}
