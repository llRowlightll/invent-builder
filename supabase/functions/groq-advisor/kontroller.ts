/**
 * Kompatibilitetskontroller per stycklisterad: matningstryck och spänning.
 *
 * Före 2026-10-13 prövade stycklistan bara temperatur, givare över
 * fabrikatsgräns och slaglängd. Lådsorteringstestet angav 6 bar och 24 V DC,
 * och ingenting prövades mot dem -- varje rad blev "Inga krav att pröva".
 * Här prövas tryck mot katalogens operating_pressure/max_pressure och spänning
 * mot voltage. Saknas uppgiften är svaret "underlag saknas", aldrig ett
 * antagande om att det fungerar.
 *
 * Katalogens format (2026-10-13): max_pressure "10", "10 bar", "10.3 bar",
 * "3–7 bar"; operating_pressure "-0.9–10", "0.1–0.7" med enheten MPa i en
 * egen kolumn (RPC:n lägger ihop dem: "0.1–0.7 MPa"); voltage "24 V DC",
 * "24 VDC / 100 VAC", "24 VDC ±10 %", "200 VAC".
 */

export interface Tryckspann {
  min: number | null;
  max: number;
}

/** Tryckspannet i bar, eller null om uppgiften inte går att läsa. */
export function tolkaTryckBar(v: unknown): Tryckspann | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const faktor = /mpa/i.test(s) ? 10 : /kpa/i.test(s) ? 0.01 : /psi/i.test(s) ? 0.0689476 : 1;
  const tal = [...s.matchAll(/[−-]?\d+(?:[.,]\d+)?/g)]
    .map((m) => parseFloat(m[0].replace("−", "-").replace(",", ".")) * faktor)
    .filter((n) => Number.isFinite(n));
  if (tal.length === 0) return null;
  // "3–7 bar": bindestrecket mellan talen är ett spann, inte ett minustecken.
  const spann = s.match(/([−-]?\d+(?:[.,]\d+)?)\s*[–—]\s*([−-]?\d+(?:[.,]\d+)?)/) ??
    s.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)/);
  if (spann) {
    const a = parseFloat(spann[1].replace("−", "-").replace(",", ".")) * faktor;
    const b = parseFloat(spann[2].replace("−", "-").replace(",", ".")) * faktor;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return { min: null, max: Math.max(...tal) };
}

export interface Spanning {
  volt: number;
  typ: "DC" | "AC" | null;
}

/** Alla spänningar en artikel anges för ("24 VDC / 100 VAC" ger två). */
export function tolkaSpanningar(v: unknown): Spanning[] {
  const s = String(v ?? "");
  const ut: Spanning[] = [];
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*V\s*(DC|AC|likström|växelström)?/gi)) {
    const typ = m[2] ? (/^(?:dc|likström)$/i.test(m[2]) ? "DC" : "AC") : null;
    ut.push({ volt: parseFloat(m[1].replace(",", ".")), typ });
  }
  return ut;
}

/** Kravets spänning ur kravbildens text ("24 V DC"). */
export function tolkaKravSpanning(text: string | undefined): Spanning | null {
  return tolkaSpanningar(text)[0] ?? null;
}

export type Utfall = "uppfyllt" | "ej_uppfyllt" | "underlag_saknas" | "stods_inte";

export interface Kontroll {
  /** Kravet som prövades, i klartext ("tryck 6 bar"). */
  krav: string;
  utfall: Utfall;
  /** Vad katalogen säger, eller varför ingen kontroll gjordes. */
  text: string;
}

/** Komponenttyper som står under matningstrycket i en pneumatisk lösning. */
export const TRYCKSATTA = new Set(["valve", "valve_terminal", "check_valve", "flow_control", "frl", "tubing", "fitting", "rod_lock"]);
/** Komponenttyper som matas med styrspänning. */
export const SPANNINGSSATTA = new Set(["valve", "valve_terminal", "sensor"]);

export function provaTryck(kravBar: number, specar: Record<string, unknown> | undefined, sv: boolean): Kontroll {
  const krav = sv ? `tryck ${String(kravBar).replace(".", ",")} bar` : `pressure ${kravBar} bar`;
  const spann = tolkaTryckBar(specar?.operating_pressure) ?? tolkaTryckBar(specar?.max_pressure);
  if (!spann) {
    return { krav, utfall: "underlag_saknas", text: sv ? "katalogen anger inget tryck för artikeln" : "the catalogue gives no pressure for the item" };
  }
  const fmt = (n: number) => (sv ? String(Math.round(n * 100) / 100).replace(".", ",") : String(Math.round(n * 100) / 100));
  const anges = spann.min != null ? `${fmt(spann.min)}–${fmt(spann.max)} bar` : `max ${fmt(spann.max)} bar`;
  if (kravBar > spann.max) {
    return { krav, utfall: "ej_uppfyllt", text: sv ? `artikeln klarar ${anges}` : `the item is rated ${anges}` };
  }
  if (spann.min != null && spann.min > 0 && kravBar < spann.min) {
    return { krav, utfall: "ej_uppfyllt", text: sv ? `artikeln kräver ${anges}` : `the item requires ${anges}` };
  }
  return { krav, utfall: "uppfyllt", text: sv ? `artikeln klarar ${anges}` : `the item is rated ${anges}` };
}

export function provaSpanning(krav: Spanning, specar: Record<string, unknown> | undefined, sv: boolean): Kontroll {
  const kravText = `${String(krav.volt).replace(".", sv ? "," : ".")} V${krav.typ ? " " + krav.typ : ""}`;
  const anges = tolkaSpanningar(specar?.voltage);
  if (anges.length === 0) {
    return { krav: kravText, utfall: "underlag_saknas", text: sv ? "katalogen anger ingen spänning för artikeln" : "the catalogue gives no voltage for the item" };
  }
  const passar = anges.some((a) => a.volt === krav.volt && (a.typ === null || krav.typ === null || a.typ === krav.typ));
  const lista = anges.map((a) => `${a.volt} V${a.typ ? " " + a.typ : ""}`).join(" / ");
  return passar
    ? { krav: kravText, utfall: "uppfyllt", text: sv ? `artikeln anges för ${lista}` : `the item is specified for ${lista}` }
    : { krav: kravText, utfall: "ej_uppfyllt", text: sv ? `artikeln anges för ${lista}` : `the item is specified for ${lista}` };
}
