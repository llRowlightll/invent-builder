/**
 * PLC-stegens lägen i stegnavigeringen (designen 2026-10-14), ur underlaget:
 * klart, uppgifter saknas eller konflikt. Konflikt är ett fel i
 * signalkontrollen eller en post som blivit inaktuell; saknas är det
 * leveransstatusen räknar som ofullständigt. Alla steg går att öppna, så
 * inget steg är låst.
 */
import type { StegTillstand } from "../design/steg.ts";
import { kontrolleraSignaler } from "./harledning.ts";
import { leveransstatus } from "./leverans.ts";
import type { Underlag } from "./modell.ts";

export function plcStegLagen(u: Underlag, aktivt: number): StegTillstand[] {
  const rader = Object.fromEntries(leveransstatus(u).map((r) => [r.id, r.status]));
  const inaktuell = (lista: Array<{ status: string }>) => lista.some((x) => x.status === "inaktuell");
  const klar = (s: string | undefined) => s === "komplett";
  const f = u.funktion;
  const lagen: Array<{ konflikt: boolean; klart: boolean; paborjat: boolean }> = [
    { konflikt: false, klart: klar(rader.krav), paborjat: u.importerat.krav.length > 0 },
    { konflikt: false, klart: !!u.plattform.tillverkare.trim(), paborjat: !!u.plattform.tillverkare.trim() },
    { konflikt: false, klart: !!f.beskrivning.trim() && !!f.startvillkor.trim() && !!f.slutvillkor.trim(),
      paborjat: [f.beskrivning, f.startvillkor, f.slutvillkor, f.operator].some((x) => !!x.trim()) },
    { konflikt: kontrolleraSignaler(u.signaler).length > 0 || inaktuell(u.signaler), klart: klar(rader.signaler), paborjat: u.signaler.length > 0 },
    { konflikt: inaktuell(u.steg), klart: klar(rader.sekvens), paborjat: u.steg.length > 0 },
    { konflikt: inaktuell(u.larm), klart: klar(rader.larm), paborjat: u.larm.length > 0 },
    { konflikt: inaktuell(u.testfall), klart: klar(rader.testplan), paborjat: u.testfall.length > 0 },
    { konflikt: false, klart: ["krav", "signaler", "sekvens", "larm", "testplan"].every((id) => klar(rader[id])),
      paborjat: u.signaler.length + u.steg.length + u.larm.length + u.testfall.length > 0 },
  ];
  // Ett steg som inte påbörjats är inget fel: neutralt, inte en varning.
  return lagen.map((l, i) => (i + 1 === aktivt ? "aktivt" : l.konflikt ? "konflikt" : l.klart ? "klart" : l.paborjat ? "saknas" : "ny"));
}
