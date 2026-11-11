import { useState } from "react";
import { foreslaSekvens, sammanfoga } from "@/lib/plc/harledning";
import { etikett } from "@/lib/plc/leverans";
import { nyttId, type Funktion, type ObligatoriskaPoster, type Steg, type Underlag } from "@/lib/plc/modell";
import { Falt, Forslagsknapp, Statusbricka, uppdatera, Val, vaxlaBekraftelse, type Tx } from "./delad";

const OBLIGATORISKA: Array<{ id: keyof ObligatoriskaPoster; sv: string; en: string; hjalpSv: string; hjalpEn: string }> = [
  { id: "spanningsbortfall", sv: "Spänningsbortfall", en: "Power loss", hjalpSv: "Vad händer med rörelsen, ventilerna och produkten när spänningen försvinner -- och när den kommer tillbaka?", hjalpEn: "What happens to the motion, the valves and the product when power is lost -- and when it returns?" },
  { id: "kommunikationsbortfall", sv: "Kommunikationsbortfall", en: "Communication loss", hjalpSv: "Vad gör maskinen om bussen eller signalen från kontrollstationen försvinner?", hjalpEn: "What does the machine do if the bus or the signal from the inspection station is lost?" },
  { id: "forloradProdukt", sv: "Förlorad produkt", en: "Lost product", hjalpSv: "Vad händer om en produkt försvinner eller hamnar fel mitt i sekvensen?", hjalpEn: "What happens if a product disappears or ends up wrong mid-sequence?" },
  { id: "aterstart", sv: "Återstart efter fel", en: "Restart after a fault", hjalpSv: "Hur återställs maskinen, och vilket separat kommando startar den igen? Återställning är inte start (ISO 13850, IEC 60204-1).", hjalpEn: "How is the machine reset, and which separate command starts it again? Reset is not start (ISO 13850, IEC 60204-1)." },
];

/**
 * Steg 5: sekvensen som stegkort och GRAFCET-vy (IEC 60848) av samma data.
 * De fyra obligatoriska posterna -- spänningsbortfall, kommunikationsbortfall,
 * förlorad produkt och återstart -- skrivs alltid av en människa.
 */
export function Steg5Sekvens({ tx, underlag, sattSteg, andraFunktion }: {
  tx: Tx; underlag: Underlag; sattSteg: (s: Steg[]) => void; andraFunktion: (d: Partial<Funktion>) => void;
}) {
  const [meddelande, setMeddelande] = useState<string | undefined>();
  // Stegkorten är förvalda; tabellen är för den som vill se allt på en gång,
  // GRAFCET för den som granskar enligt IEC 60848.
  const [vy, setVy] = useState<"kort" | "tabell" | "grafcet">("kort");
  const parametrar = [{ id: "", text: tx("Ingen", "None") }, ...underlag.parametrar.map((p) => ({ id: p.id, text: p.namn }))];
  // Ett steg kan peka på en tidsgräns som ännu inte finns som parameter.
  for (const s of underlag.steg) if (s.tidsgrans && !parametrar.some((p) => p.id === s.tidsgrans)) parametrar.push({ id: s.tidsgrans, text: `${s.tidsgrans} (${tx("parameter saknas", "parameter missing")})` });

  function foresla() {
    if (underlag.signaler.length === 0) {
      setMeddelande(tx("Sekvensen bygger på signalerna. Föreslå signalerna i steg 4 först.", "The sequence builds on the signals. Propose the signals in step 4 first."));
      return;
    }
    const forslag = foreslaSekvens(underlag.importerat, underlag.signaler);
    if (forslag.length === 0) {
      setMeddelande(tx("Ingen rörelse i stycklistan att bygga en sekvens på. Lägg till stegen själv.", "No motion in the bill of materials to build a sequence on. Add the steps yourself."));
      return;
    }
    const { lista, nya } = sammanfoga(underlag.steg, forslag);
    sattSteg(lista);
    setMeddelande(tx(`${nya} nya steg föreslagna.`, `${nya} new steps proposed.`));
  }
  const ob = underlag.funktion.obligatoriska;

  return (
    <div className="mt-3 space-y-6">
      <details className="text-sm">
        <summary className="cursor-pointer text-info hover:underline w-fit">{tx("Varför behöver vi detta?", "Why do we need this?")}</summary>
        <p className="mt-2 text-muted-foreground max-w-prose">
          {tx(
            "Sekvensen beskriver steg och övergångar som GRAFCET (IEC 60848). Beteendet vid avbrott och återstart ska vara uttryckligen bestämt -- aldrig ett dolt antagande.",
            "The sequence describes steps and transitions as GRAFCET (IEC 60848). Behaviour on interruption and restart must be explicitly decided -- never a hidden assumption.",
          )}
        </p>
      </details>

      <section className="space-y-3" aria-labelledby="sek-rubrik">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="sek-rubrik" className="text-sm font-semibold text-foreground">{tx("Steg", "Steps")} ({underlag.steg.length})</h3>
          <div className="flex gap-1 rounded-full bg-muted p-1 text-xs" role="group" aria-label={tx("Visning", "View")}>
            {(["kort", "tabell", "grafcet"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setVy(v)} aria-pressed={vy === v}
                className={`rounded-full px-3 py-1 transition-colors ${vy === v ? "bg-surface font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>
                {v === "kort" ? tx("Stegkort", "Step cards") : v === "tabell" ? tx("Tabell", "Table") : "GRAFCET"}
              </button>
            ))}
          </div>
        </div>
        <Forslagsknapp tx={tx} text={tx("Föreslå sekvens", "Propose sequence")} onClick={foresla} meddelande={meddelande} />

        {vy === "grafcet" ? (
          <ol className="flex flex-col items-start" aria-label={tx("Stegkedja", "Step chain")}>
            {underlag.steg.map((s, i) => (
              <li key={s.id} className="flex flex-col items-start">
                <div className={`border-2 ${i === 0 ? "border-double border-4" : ""} border-foreground/70 rounded-sm px-3 py-1.5 bg-card min-w-[12rem]`}>
                  <div className="text-sm font-semibold">{s.nummer} · {s.namn}</div>
                  {s.atgard && s.atgard !== "–" && <div className="text-xs text-muted-foreground mt-0.5">{tx("Åtgärd", "Action")}: {s.atgard}</div>}
                </div>
                <div className="flex items-center gap-2 ml-[5.5rem] py-1">
                  <span className="block w-px h-6 bg-foreground/70" aria-hidden />
                  <span className="block w-4 h-px bg-foreground/70 -ml-2" aria-hidden />
                  <span className="text-xs text-foreground">{s.slutvillkor || tx("(övergång ej definierad)", "(transition not defined)")}{s.nasta ? ` → ${s.nasta}` : ""}</span>
                </div>
              </li>
            ))}
            {underlag.steg.length === 0 && <li className="text-sm text-muted-foreground">{tx("Inga steg ännu.", "No steps yet.")}</li>}
          </ol>
        ) : vy === "tabell" ? (
          <div className="kort overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-alt/60 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{tx("Nr", "No.")}</th>
                  <th className="px-3 py-2 font-medium">{tx("Namn", "Name")}</th>
                  <th className="px-3 py-2 font-medium">{tx("Startvillkor", "Start condition")}</th>
                  <th className="px-3 py-2 font-medium">{tx("Begärd funktion", "Requested function")}</th>
                  <th className="px-3 py-2 font-medium">{tx("Övergång", "Transition")}</th>
                  <th className="px-3 py-2 font-medium">{tx("Nästa", "Next")}</th>
                  <th className="px-3 py-2 font-medium">{tx("Tidsgräns", "Time limit")}</th>
                  <th className="px-3 py-2 font-medium">{tx("Status", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {underlag.steg.map((s) => (
                  <tr key={s.id} className="border-b border-line align-top last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{s.nummer}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{s.namn || "–"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.startvillkor || "–"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.atgard || "–"}</td>
                    <td className="px-3 py-2 text-foreground">{s.slutvillkor || <span className="text-warning-deep">{tx("ej definierad", "not defined")}</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.nasta || "–"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.tidsgrans ? (underlag.parametrar.find((p) => p.id === s.tidsgrans)?.namn ?? <span className="font-sans text-warning-deep">{tx("saknas", "missing")}</span>) : "–"}</td>
                    <td className="px-3 py-2"><Statusbricka tx={tx} status={s.status} orsak={s.inaktuellOrsak} /></td>
                  </tr>
                ))}
                {underlag.steg.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-4 text-muted-foreground">{tx("Inga steg ännu.", "No steps yet.")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <ol className="space-y-0" aria-label={tx("Sekvensen", "The sequence")}>
            {underlag.steg.map((s, i) => {
              const rubrik = `${s.nummer} ${s.namn || tx("(namnlöst steg)", "(unnamed step)")}`;
              // Parameterns namn, eller att den saknas -- aldrig det interna id:t.
              const tidParam = s.tidsgrans ? underlag.parametrar.find((p) => p.id === s.tidsgrans) : undefined;
              return (
                <li key={s.id}>
                  <div className={`rounded-xl border bg-surface p-4 shadow-xs ${s.status === "inaktuell" ? "border-warning-deep/30" : s.status === "bekraftad" ? "border-line" : "border-dashed border-muted-foreground/30"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/[0.07] font-mono text-[11px] font-semibold text-primary">{s.nummer}</span>
                      <span className="min-w-0 break-words text-sm font-semibold text-foreground">{s.namn || tx("(namnlöst steg)", "(unnamed step)")}</span>
                      <Statusbricka tx={tx} status={s.status} orsak={s.inaktuellOrsak} />
                      <span className="flex-1" />
                      <button type="button" onClick={() => sattSteg(underlag.steg.map((x) => (x.id === s.id ? vaxlaBekraftelse(x) : x)))}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${s.status === "bekraftad" ? "border-border text-muted-foreground hover:text-foreground" : "border-success/40 text-success-deep hover:bg-success-surface"}`}>
                        {s.status === "bekraftad" ? tx("Ångra bekräftelse", "Undo confirmation") : tx("Bekräfta", "Confirm")}
                      </button>
                      <button type="button" onClick={() => sattSteg(underlag.steg.filter((x) => x.id !== s.id))}
                        className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-danger-deep/40 hover:text-danger-deep">
                        {tx("Ta bort", "Remove")}
                      </button>
                    </div>
                    {s.status === "inaktuell" && s.inaktuellOrsak && <p className="mt-1 text-xs text-warning-deep">{tx("Inaktuell", "Outdated")}: {s.inaktuellOrsak}</p>}

                    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
                      <div><dt className="text-xs text-muted-foreground">{tx("Begärd funktion", "Requested function")}</dt><dd className="text-foreground">{s.atgard || "–"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{tx("Startvillkor", "Start condition")}</dt><dd className="text-foreground">{s.startvillkor || "–"}</dd></div>
                      {s.tidsgrans && (
                        <div>
                          <dt className="text-xs text-muted-foreground">{tx("Tidsgräns", "Time limit")}</dt>
                          <dd className={tidParam ? "font-mono text-xs text-foreground" : "text-xs text-warning-deep"}>
                            {tidParam ? tidParam.namn : tx("parametern finns inte än (steg 4)", "the parameter does not exist yet (step 4)")}
                          </dd>
                        </div>
                      )}
                      {s.felhantering && <div><dt className="text-xs text-muted-foreground">{tx("Felhantering", "Fault handling")}</dt><dd className="text-foreground">{s.felhantering}</dd></div>}
                    </dl>

                    {/* Signalerna steget läser och skriver, som märken. */}
                    {s.signaler.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={tx("Signaler i steget", "Signals in the step")}>
                        {s.signaler.map((id) => (
                          <span key={id} className="rounded-md border border-line bg-surface-alt/60 px-2 py-0.5 font-mono text-[11px] text-foreground/80">{etikett(id, underlag)}</span>
                        ))}
                      </div>
                    )}

                    <details className="group mt-3 border-t border-line pt-3" open={!s.namn}>
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-info hover:underline [&::-webkit-details-marker]:hidden">
                        {tx("Redigera steget", "Edit the step")}
                        <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
                      </summary>
                      <div className="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2">
                        <Falt id={`${s.id}-nr`} etikett={tx("Nummer", "Number")} value={s.nummer} onChange={(v) => sattSteg(uppdatera(underlag.steg, s.id, { nummer: v }))} />
                        <Falt id={`${s.id}-namn`} etikett={tx("Namn", "Name")} value={s.namn} onChange={(v) => sattSteg(uppdatera(underlag.steg, s.id, { namn: v }))} />
                        <Falt id={`${s.id}-start`} etikett={tx("Startvillkor", "Start condition")} value={s.startvillkor} onChange={(v) => sattSteg(uppdatera(underlag.steg, s.id, { startvillkor: v }))} />
                        <Falt id={`${s.id}-atgard`} etikett={tx("Begärd funktion", "Requested function")} value={s.atgard} onChange={(v) => sattSteg(uppdatera(underlag.steg, s.id, { atgard: v }))} />
                        <Falt id={`${s.id}-slut`} etikett={tx("Slutvillkor (övergång)", "End condition (transition)")} value={s.slutvillkor} onChange={(v) => sattSteg(uppdatera(underlag.steg, s.id, { slutvillkor: v }))} />
                        <Falt id={`${s.id}-nasta`} etikett={tx("Nästa steg", "Next step")} value={s.nasta} onChange={(v) => sattSteg(uppdatera(underlag.steg, s.id, { nasta: v }))} />
                        <Val id={`${s.id}-tid`} etikett={tx("Tidsgräns", "Time limit")} value={s.tidsgrans} alternativ={parametrar} onChange={(v) => sattSteg(uppdatera(underlag.steg, s.id, { tidsgrans: v }))} />
                        <Falt id={`${s.id}-fel`} etikett={tx("Felhantering", "Fault handling")} value={s.felhantering} onChange={(v) => sattSteg(uppdatera(underlag.steg, s.id, { felhantering: v }))} />
                      </div>
                    </details>
                  </div>

                  {/* Övergången till nästa steg: villkoret står mellan korten,
                      där det gäller -- inte som ett fält bland andra. */}
                  <div className="flex items-stretch gap-3 py-1.5 pl-[1.35rem]" aria-label={tx(`Övergång från ${rubrik}`, `Transition from ${rubrik}`)}>
                    <span aria-hidden className={`w-px ${s.slutvillkor ? "bg-primary/40" : "bg-warning-deep/40"}`} />
                    <p className="py-1 text-[13px]">
                      <span className="text-muted-foreground">↓ {tx("när", "when")} </span>
                      {s.slutvillkor
                        ? <span className="font-medium text-foreground">{s.slutvillkor}</span>
                        : <span className="font-medium text-warning-deep">{tx("övergången är inte definierad", "the transition is not defined")}</span>}
                      {s.nasta && <span className="text-muted-foreground"> {tx("till", "to")} <span className="font-mono text-xs text-foreground">{s.nasta}</span></span>}
                      {!s.nasta && i < underlag.steg.length - 1 && <span className="text-muted-foreground"> {tx("(nästa steg ej angivet)", "(next step not stated)")}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
            {underlag.steg.length === 0 && <li className="text-sm text-muted-foreground">{tx("Inga steg ännu.", "No steps yet.")}</li>}
          </ol>
        )}
        <button type="button" className="text-sm font-medium text-info hover:underline" onClick={() => sattSteg([...underlag.steg, {
          id: nyttId("steg"), nummer: `S${underlag.steg.length}`, namn: "", startvillkor: "", atgard: "", slutvillkor: "", nasta: "", tidsgrans: "",
          felhantering: "", signaler: [], ursprung: "manuell", status: "foreslagen", kalla: "manuell", andrad: new Date().toISOString(),
        }])}>+ {tx("Lägg till steg", "Add step")}</button>
      </section>

      <section className="space-y-2" aria-labelledby="ob-rubrik">
        <h3 id="ob-rubrik" className="text-sm font-semibold text-foreground">{tx("Obligatoriska poster", "Mandatory entries")}</h3>
        <p className="text-xs text-muted-foreground max-w-prose">
          {tx(
            "Skrivs av en människa. Systemet föreslår inget här; ett tomt fält räknas som saknat underlag.",
            "Written by a person. The system proposes nothing here; an empty field counts as missing data.",
          )}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {OBLIGATORISKA.map((o) => (
            <Falt key={o.id} id={`ob-${o.id}`} etikett={tx(o.sv, o.en)} hjalp={tx(o.hjalpSv, o.hjalpEn)} value={ob[o.id]} flerrader
              onChange={(v) => andraFunktion({ obligatoriska: { ...ob, [o.id]: v } })} />
          ))}
        </div>
      </section>
    </div>
  );
}
