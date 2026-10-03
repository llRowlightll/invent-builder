/**
 * Fritextsökningen i katalogen: varje ord i frågan ska finnas, och svenska
 * fackord matchar även katalogens engelska benämningar.
 *
 * Hittat 2026-10-02: sökningen krävde att HELA frågan fanns som en
 * sammanhängande sträng. "cylinder Ø40" fungerade av en slump -- namnen
 * innehåller just den följden -- medan "vakuum sugkopp" gav 0 av 846 och
 * "magnetventil 5/2" gav 2. Alla åtta sugkoppar heter "Suction Pad" eller
 * "Vacuum Cup", och sajten ber kunden skriva på svenska.
 */

/** Svenskt fackord -> ord som räknas som träff. Allt i gemener. */
const SYNONYMER: Record<string, string[]> = {
  sugkopp: ["sugkopp", "suction", "vacuum cup", "vacuum pad", "suction cup", "suction pad"],
  sugkoppar: ["sugkopp", "suction", "vacuum cup", "vacuum pad"],
  vakuum: ["vakuum", "vacuum", "ejector", "ejektor"],
  ejektor: ["ejektor", "ejector"],
  ventil: ["ventil", "valve"],
  ventiler: ["ventil", "valve"],
  magnetventil: ["magnetventil", "solenoid", "valve", "ventil"],
  ventilterminal: ["ventilterminal", "ventilö", "valve terminal", "manifold"],
  ventilö: ["ventilö", "ventilterminal", "valve terminal", "manifold"],
  backventil: ["backventil", "backslagsventil", "check valve", "non-return"],
  backslagsventil: ["backslagsventil", "backventil", "check valve", "non-return", "load-holding"],
  strypbackventil: ["strypbackventil", "flow control", "one-way flow", "grla", "flödesreglering"],
  cylinder: ["cylinder", "cylindrar", "zylinder"],
  cylindrar: ["cylinder", "zylinder"],
  kompaktcylinder: ["kompaktcylinder", "compact cylinder", "compact"],
  rundcylinder: ["rundcylinder", "round cylinder", "round body", "iso 6432"],
  kolvstångslös: ["kolvstångslös", "rodless"],
  elcylinder: ["elcylinder", "electric cylinder", "electric actuator"],
  linjärmodul: ["linjärmodul", "linear module", "linear axis"],
  vridenhet: ["vridenhet", "rotary", "swivel"],
  gripdon: ["gripdon", "gripper", "gripklo"],
  gripklo: ["gripklo", "gripper", "gripdon"],
  slang: ["slang", "tube", "tubing", "hose"],
  koppling: ["koppling", "fitting", "push-in", "connector"],
  kopplingar: ["koppling", "fitting", "push-in"],
  snabbkoppling: ["snabbkoppling", "quick coupling", "push-in", "fitting"],
  ljuddämpare: ["ljuddämpare", "silencer", "muffler"],
  stötdämpare: ["stötdämpare", "shock absorber"],
  givare: ["givare", "sensor", "switch", "proximity"],
  cylindergivare: ["cylindergivare", "proximity", "sensor", "switch"],
  fäste: ["fäste", "mount", "bracket", "foot", "flange", "clevis"],
  tätningssats: ["tätningssats", "seal kit", "tätning"],
  regulator: ["regulator", "tryckregulator", "reducering", "pressure regulator"],
  tryckregulator: ["tryckregulator", "regulator", "pressure regulator"],
  filter: ["filter"],
  luftberedning: ["luftberedning", "frl", "air preparation", "filter", "regulator"],
  servomotor: ["servomotor", "servo motor"],
  servodrivare: ["servodrivare", "servo drive", "drive"],
  stångbroms: ["stångbroms", "rod lock", "clamping unit", "klämenhet"],
};

export function matcharFraga(hostack: string, fraga: string): boolean {
  const text = hostack.toLowerCase();
  const ord = fraga.toLowerCase().split(/\s+/).filter(Boolean);
  if (ord.length === 0) return true;
  return ord.every((o) => (SYNONYMER[o] ?? [o]).some((alt) => text.includes(alt)));
}
