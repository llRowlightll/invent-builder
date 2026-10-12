/**
 * Kontroller på programmeringsunderlaget som gränssnittet visar: vad som
 * saknas i de steg som finns, vilka öppna frågor svaren själva ger, och vad
 * som skiljer två versioner åt när en sparning krockar.
 *
 * Ren logik utan databas och utan text: funktionerna returnerar koder och
 * gränssnittet visar dem på kundens språk. Provas med deno test (tests/plc.test.ts).
 */
import type { Omfattning, Plattform, Underlag } from "./modell.ts";

export type SaknasKod =
  | "leverans" | "omfattar" | "arbete" | "andring" | "innehall"
  | "plattformsval" | "tillverkare" | "plcModell" | "miljo";

export interface Saknas {
  steg: 1 | 2;
  kod: SaknasKod;
}

/**
 * Uppgifter som saknas i steg 1 och 2, i stegens ordning. "Vet inte" och
 * "bestäms senare" är svar, inte luckor -- de blir öppna frågor i stället.
 */
export function saknas(u: Underlag): Saknas[] {
  const ut: Saknas[] = [];
  const o = u.omfattning;
  if (!o.leverans) ut.push({ steg: 1, kod: "leverans" });
  if (!o.omfattar.trim()) ut.push({ steg: 1, kod: "omfattar" });
  if (!o.arbete) ut.push({ steg: 1, kod: "arbete" });
  if (o.arbete === "andring" && !o.andring.trim()) ut.push({ steg: 1, kod: "andring" });
  if (o.innehall.length === 0) ut.push({ steg: 1, kod: "innehall" });
  const p = u.plattform;
  if (!p.val) ut.push({ steg: 2, kod: "plattformsval" });
  if (p.val === "befintlig") {
    if (!p.tillverkare) ut.push({ steg: 2, kod: "tillverkare" });
    if (!p.plcModell.trim()) ut.push({ steg: 2, kod: "plcModell" });
    if (!p.miljo.trim()) ut.push({ steg: 2, kod: "miljo" });
  }
  return ut;
}

export type HarleddFraga = "arbete_okant" | "plattform_senare" | "plattform_hjalp" | "plattform_utanfor_registret";

/** Öppna frågor som följer av svaren. De sparas inte; de försvinner när svaret ändras. */
export function harleddaFragor(u: Underlag): HarleddFraga[] {
  const ut: HarleddFraga[] = [];
  if (u.omfattning.arbete === "vet_inte") ut.push("arbete_okant");
  if (u.plattform.val === "senare") ut.push("plattform_senare");
  if (u.plattform.val === "hjalp") ut.push("plattform_hjalp");
  if (u.plattform.val === "befintlig" && u.plattform.tillverkare === "annan") ut.push("plattform_utanfor_registret");
  return ut;
}

export interface Skillnad {
  /** Fältets sökväg, t.ex. "plattform.plcModell". */
  falt: string;
  sparad: string;
  din: string;
}

function somText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(somText).join(", ");
  return String(v);
}

/**
 * Vad som skiljer den sparade versionen från den man själv har ändrat, fält
 * för fält. Visas vid en sparkonflikt, så att ingen av versionerna vinner tyst.
 */
export function skillnader(sparad: Underlag, din: Underlag): Skillnad[] {
  const ut: Skillnad[] = [];
  const jfr = (falt: string, a: unknown, b: unknown) => {
    const sa = somText(a);
    const sb = somText(b);
    if (sa !== sb) ut.push({ falt, sparad: sa, din: sb });
  };
  const omf = new Set([...Object.keys(sparad.omfattning), ...Object.keys(din.omfattning)]) as Set<keyof Omfattning>;
  for (const k of omf) jfr(`omfattning.${k}`, sparad.omfattning[k], din.omfattning[k]);
  const plt = new Set([...Object.keys(sparad.plattform), ...Object.keys(din.plattform)]) as Set<keyof Plattform>;
  for (const k of plt) jfr(`plattform.${k}`, sparad.plattform[k], din.plattform[k]);
  jfr("importerat.kallrevision", sparad.importerat.kallrevision, din.importerat.kallrevision);
  jfr("antaganden", sparad.antaganden.map((t) => t.text), din.antaganden.map((t) => t.text));
  jfr("oppnaFragor", sparad.oppnaFragor.map((t) => t.text), din.oppnaFragor.map((t) => t.text));
  return ut;
}
