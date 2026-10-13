/**
 * Steg 8: leveransens statusar och exporter, ur samma datamodell som stegen.
 *
 * Separata statusar i stället för ett "verifierat" (manualen 9 och 10):
 * kravunderlag, signaler, sekvens, larm, testplan, programförslag, utförda
 * kontroller och teknisk granskning. Ett ofullständigt underlag går att
 * exportera -- märkt som ofullständigt, med revision, antaganden och öppna
 * frågor. Varje export bär varningstexten.
 */
import { kontrolleraSignaler } from "./harledning.ts";
import type { Larm, Signal, Steg, Testfall, Underlag } from "./modell.ts";
import { mojligheter } from "./plattformar.ts";

export const VARNINGSTEXT = "Underlag. Inte godkänt för maskindrift. Riskbedömning, säkerhetsfunktioner och validering hanteras separat av ansvariga personer.";

export type Leveransstatus = "komplett" | "ofullstandigt" | "saknas" | "ej_tillgangligt" | "ej_utfort";

export interface Statusrad {
  id: string;
  namn: string;
  status: Leveransstatus;
  text: string;
}

const aktiva = <T extends { status: string }>(lista: T[]) => lista.filter((x) => x.status !== "inaktuell");

export function leveransstatus(u: Underlag): Statusrad[] {
  const krav = u.importerat.krav.filter((k) => k.bekraftelse !== "avvisat");
  const ejBekraftade = krav.filter((k) => k.bekraftelse !== "bekraftat").length;
  const luckor = (u.importerat.saknas ?? []).length + (u.importerat.osakra ?? []).length;
  const sig = aktiva(u.signaler);
  const sigFel = kontrolleraSignaler(u.signaler).length;
  const utanAdress = sig.filter((s) => (s.typ === "DI" || s.typ === "DO" || s.typ === "AI" || s.typ === "AO") && !s.adress.trim()).length;
  const sigForeslagna = sig.filter((s) => s.status === "foreslagen").length;
  const steg = aktiva(u.steg);
  const ob = u.funktion.obligatoriska;
  const obSaknas = [ob.spanningsbortfall, ob.kommunikationsbortfall, ob.forloradProdukt, ob.aterstart].filter((x) => !x.trim()).length;
  const larm = aktiva(u.larm);
  const test = aktiva(u.testfall);
  const utforda = test.filter((t) => t.utfall !== "ej_utfort").length;
  const inaktuella = [u.signaler, u.steg, u.larm, u.testfall].flat().filter((x) => x.status === "inaktuell").length;
  const kod = mojligheter(u.plattform.tillverkare);

  const rader: Statusrad[] = [
    {
      id: "krav", namn: "Kravunderlag",
      status: krav.length === 0 ? "saknas" : ejBekraftade === 0 && luckor === 0 ? "komplett" : "ofullstandigt",
      text: krav.length === 0 ? "Inga krav hämtade." : `${krav.length} krav, ${ejBekraftade} ej bekräftade, ${luckor} saknade uppgifter eller öppna tolkningar.`,
    },
    {
      id: "signaler", namn: "Signaler",
      status: sig.length === 0 ? "saknas" : sigForeslagna === 0 && sigFel === 0 && utanAdress === 0 ? "komplett" : "ofullstandigt",
      text: sig.length === 0 ? "Ingen I/O-lista." : `${sig.length} signaler, ${sigForeslagna} föreslagna, ${utanAdress} utan adress, ${sigFel} fel i kontrollen.`,
    },
    {
      id: "sekvens", namn: "Sekvens",
      status: steg.length === 0 ? "saknas" : steg.every((s) => s.status === "bekraftad") && obSaknas === 0 ? "komplett" : "ofullstandigt",
      text: steg.length === 0 ? "Ingen sekvens." : `${steg.length} steg, ${steg.filter((s) => s.status !== "bekraftad").length} ej bekräftade; ${obSaknas} av 4 obligatoriska poster saknas.`,
    },
    {
      id: "larm", namn: "Larm",
      status: larm.length === 0 ? "saknas" : larm.every((l) => l.status === "bekraftad") ? "komplett" : "ofullstandigt",
      text: larm.length === 0 ? "Inga larm." : `${larm.filter((l) => l.typ === "process").length} processlarm, ${larm.filter((l) => l.typ === "sakerhetsgranskning").length} säkerhetsrelaterade granskningspunkter.`,
    },
    {
      id: "testplan", namn: "Testplan",
      status: test.length === 0 ? "saknas" : utforda === test.length ? "komplett" : "ofullstandigt",
      text: test.length === 0 ? "Ingen testplan." : `${test.length} testfall, ${utforda} utförda, ${test.length - utforda} ej utförda.`,
    },
    {
      id: "programforslag", namn: "Programförslag",
      status: "ej_tillgangligt",
      text: kod.orsak === "okand_plattform" ? "Kräver en känd plattform." : "Ingen provad kodgenerator finns för plattformen.",
    },
    {
      id: "kontroller", namn: "Utförda kontroller",
      status: "ej_utfort",
      text: "Statisk kontroll, kompilering och simulering är inte utförda. De kan bara markeras av ett verktyg med spårbart resultat, och inget verktyg är anslutet.",
    },
    {
      id: "granskning", namn: "Teknisk granskning",
      status: "ej_utfort",
      text: "Ingen granskning registrerad. En granskning gäller en bestämd revision.",
    },
  ];
  if (inaktuella > 0) {
    rader.splice(1, 0, { id: "inaktuella", namn: "Inaktuella poster", status: "ofullstandigt", text: `${inaktuella} poster bygger på något som ändrats och behöver ses över.` });
  }
  return rader;
}

/** Är underlaget komplett i den mening steg 8 kan säga? Aldrig "godkänt". */
export function arKomplett(u: Underlag): boolean {
  return leveransstatus(u).filter((r) => ["krav", "signaler", "sekvens", "larm", "testplan", "inaktuella"].includes(r.id)).every((r) => r.status === "komplett");
}

export interface Exportmeta {
  projektnamn: string;
  underlagsrevision: number;
  datum: string;
}

const md = (s: string) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const statustext = (s: string) => (s === "bekraftad" ? "Bekräftad" : s === "inaktuell" ? "Inaktuell" : "Föreslagen");

/** Hela underlaget som Markdown: funktionsbeskrivning, krav, signaler, sekvens, larm, testplan. */
export function exportMarkdown(u: Underlag, meta: Exportmeta): string {
  const ofullst = !arKomplett(u);
  const rader: string[] = [];
  rader.push(`# Programmeringsunderlag — ${meta.projektnamn}`);
  rader.push("");
  rader.push(`> ⚠️ ${VARNINGSTEXT}`);
  if (ofullst) rader.push(">", "> **OFULLSTÄNDIGT UNDERLAG.** Se statusarna och de öppna frågorna nedan.");
  rader.push("");
  rader.push(`Underlagets revision: ${meta.underlagsrevision} · Krav ur maskinprojektets revision: ${u.importerat.kallrevision} · Exporterat: ${meta.datum}`);
  rader.push("");
  rader.push("## Status");
  rader.push("| Del | Status | Kommentar |", "|---|---|---|");
  for (const r of leveransstatus(u)) rader.push(`| ${r.namn} | ${r.status.replace(/_/g, " ")} | ${md(r.text)} |`);
  rader.push("");
  rader.push("## Omfattning och plattform");
  rader.push(`- Leverans: ${u.omfattning.leverans ?? "ej vald"}`);
  rader.push(`- Omfattar: ${u.omfattning.omfattar || "ej angivet"}`);
  rader.push(`- Arbete: ${u.omfattning.arbete ?? "ej valt"}${u.omfattning.andring ? ` — ${u.omfattning.andring}` : ""}`);
  rader.push(`- Styrsystem: ${[u.plattform.tillverkare, u.plattform.plcModell, u.plattform.miljo, u.plattform.miljoVersion].filter(Boolean).join(", ") || "ej bestämt"}`);
  if (u.plattform.sprak.length) rader.push(`- Språk: ${u.plattform.sprak.join(", ")}`);
  if (u.plattform.kommunikation.length) rader.push(`- Kommunikation: ${u.plattform.kommunikation.join(", ")}`);
  rader.push("");
  rader.push("## Krav från maskinprojektet");
  rader.push("| Krav | Värde | Ursprung | Status |", "|---|---|---|---|");
  for (const k of u.importerat.krav) rader.push(`| ${md(`${k.objekt ? k.objekt + ": " : ""}${k.egenskap ?? k.id}`)} | ${md(k.varde)} | ${k.kalla} | ${k.bekraftelse ?? "äldre import"} |`);
  rader.push("");
  rader.push("## Funktionsbeskrivning");
  const f = u.funktion;
  rader.push(f.beskrivning || "_Inte beskriven._");
  for (const [rubrik, text] of [["Startvillkor", f.startvillkor], ["Slutvillkor", f.slutvillkor], ["Samverkan med andra stationer", f.samverkan], ["Operatörens uppgifter", f.operator], ["Produktvarianter", f.varianter], ["Villkor för lägesbyte", f.lagesbyte]] as const) {
    if (text) rader.push("", `**${rubrik}:** ${text}`);
  }
  rader.push("", `**Driftlägen (PackML):** ${f.lagen.length ? f.lagen.join(", ") : "ej valda"}`);
  rader.push("", "### Obligatoriska poster (skrivs av en människa)");
  for (const [namn, text] of [["Spänningsbortfall", f.obligatoriska.spanningsbortfall], ["Kommunikationsbortfall", f.obligatoriska.kommunikationsbortfall], ["Förlorad produkt", f.obligatoriska.forloradProdukt], ["Återstart efter fel", f.obligatoriska.aterstart]] as const) {
    rader.push(`- **${namn}:** ${text || "_saknas_"}`);
  }
  rader.push("");
  rader.push("## Signaler (I/O-lista)");
  rader.push("| Tagg | Namn | Typ | Datatyp | Adress | Källa | Felsäkert läge | Status |", "|---|---|---|---|---|---|---|---|");
  for (const s of u.signaler) rader.push(`| ${md(s.tagg)} | ${md(s.namn)} | ${s.typ} | ${s.datatyp} | ${md(s.adress) || "—"} | ${md(s.kallaText)} | ${md(s.felsakert) || "—"} | ${statustext(s.status)} |`);
  rader.push("");
  rader.push("## Parametrar");
  rader.push("| Namn | Betydelse | Datatyp | Enhet | Min | Max | Standard | Behörighet |", "|---|---|---|---|---|---|---|---|");
  for (const p of u.parametrar) rader.push(`| ${md(p.namn)} | ${md(p.betydelse)} | ${p.datatyp} | ${p.enhet} | ${p.min || "—"} | ${p.max || "—"} | ${p.standard || "—"} | ${p.behorighet || "—"} |`);
  rader.push("");
  rader.push("## Sekvens");
  rader.push("| Steg | Namn | Startvillkor | Åtgärd | Slutvillkor | Nästa | Tidsgräns | Felhantering | Status |", "|---|---|---|---|---|---|---|---|---|");
  for (const s of u.steg) rader.push(`| ${s.nummer} | ${md(s.namn)} | ${md(s.startvillkor)} | ${md(s.atgard)} | ${md(s.slutvillkor)} | ${s.nasta} | ${s.tidsgrans || "—"} | ${md(s.felhantering)} | ${statustext(s.status)} |`);
  rader.push("");
  rader.push("## Larm");
  rader.push("| Nr | Typ | Villkor | Operatörstext | Reaktion | Återställning | Fortsatt drift | Status |", "|---|---|---|---|---|---|---|---|");
  for (const l of u.larm) rader.push(`| ${l.nummer} | ${l.typ === "process" ? "Processlarm" : "Säkerhetsgranskning"} | ${md(l.villkor)} | ${md(l.operatorstext)} | ${md(l.reaktion)} | ${md(l.aterstallning)} | ${md(l.fortsattDrift)} | ${statustext(l.status)} |`);
  rader.push("");
  rader.push("## Testplan (FAT/SAT)");
  rader.push("| Nr | Avser | Förutsättningar | Åtgärd | Förväntat | Metod | Faktiskt | Ansvarig | Datum | Utfall |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const t of u.testfall) rader.push(`| ${t.nummer} | ${md(t.kravRef)} | ${md(t.forutsattningar)} | ${md(t.atgard)} | ${md(t.forvantat)} | ${t.metod.replace(/_/g, " ")} | ${md(t.faktiskt) || "—"} | ${md(t.ansvarig) || "—"} | ${t.datum || "—"} | ${t.utfall === "ej_utfort" ? "Ej utfört" : t.utfall === "godkant" ? "Godkänt" : "Ej godkänt"} |`);
  rader.push("");
  rader.push("## Antaganden");
  rader.push(...(u.antaganden.length ? u.antaganden.map((a) => `- ${a.text}`) : ["_Inga._"]));
  rader.push("");
  rader.push("## Öppna frågor");
  const fragor = [
    ...(u.importerat.osakra ?? []).map((o) => o.sv),
    ...(u.importerat.saknas ?? []).map((o) => o.sv),
    ...u.oppnaFragor.map((o) => o.text),
  ];
  rader.push(...(fragor.length ? fragor.map((x) => `- ${x}`) : ["_Inga._"]));
  rader.push("", "---", `_${VARNINGSTEXT}_`, "");
  return rader.join("\n");
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** I/O-listan som CSV (semikolon, för svensk Excel). Tom adress skrivs tom, aldrig som noll. */
export function exportSignalerCsv(signaler: Signal[]): string {
  const huvud = ["Tagg", "Namn", "Typ", "Datatyp", "Adress", "Beskrivning", "Källa", "Mottagare", "Felsäkert läge", "Status"];
  const rader = signaler.map((s) => [s.tagg, s.namn, s.typ, s.datatyp, s.adress, s.beskrivning, s.kallaText, s.mottagare, s.felsakert, statustext(s.status)].map(csvCell).join(";"));
  return [huvud.join(";"), ...rader].join("\r\n") + "\r\n";
}

/** Hela underlaget som JSON, med revision och varningstext. */
export function exportJson(u: Underlag, meta: Exportmeta): string {
  return JSON.stringify({
    varning: VARNINGSTEXT,
    ofullstandigt: !arKomplett(u),
    projekt: meta.projektnamn,
    underlagsrevision: meta.underlagsrevision,
    kallrevision: u.importerat.kallrevision,
    exporterat: meta.datum,
    status: leveransstatus(u),
    underlag: u,
  }, null, 2);
}

/** Används av steg 5–7 för att visa vad en post refererar till. */
export function etikett(id: string, u: Pick<Underlag, "signaler" | "steg" | "larm">): string {
  const s = u.signaler.find((x: Signal) => x.id === id);
  if (s) return `${s.tagg} ${s.namn}`;
  const st = u.steg.find((x: Steg) => x.id === id);
  if (st) return `${st.nummer} ${st.namn}`;
  const l = u.larm.find((x: Larm) => x.id === id);
  if (l) return `${l.nummer} ${l.operatorstext || l.villkor}`;
  return id;
}

export type { Testfall };
