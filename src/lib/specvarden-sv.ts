/**
 * Svenska för katalogens engelska specvärden -- vid visning, inte i databasen.
 *
 * Svenska sidor visade "Elastic rings; Self-adjusting pneumatic" och
 * "Magnetic piston, proximity sensor" (granskning 2026-11-11). Ahlsell visar
 * samma Festo-data på svenska. Datan rörs inte: värdena kommer från
 * tillverkarnas engelska kataloger och är källan.
 *
 * Regeln: översätt bara när HELA värdet går att översätta. Varje del (avgränsad
 * med ; , / "and" "or") måste finnas i lexikonet eller vara ett tal eller en
 * kod. Annars visas originalet. Ett halvsvenskt "Kulskruv (precision class 7)"
 * är sämre än engelska rakt igenom.
 */

const LEXIKON: Record<string, string> = {
  // Funktion
  "double-acting": "dubbelverkande",
  "single-acting": "enkelverkande",
  "double-acting (tandem)": "dubbelverkande (tandem)",
  "double-acting with end-position lock": "dubbelverkande med ändlägeslås",
  "single-acting, spring return": "enkelverkande, fjäderretur",
  "spring return": "fjäderretur",
  // Medium
  "compressed air": "tryckluft",
  "filtered": "filtrerad",
  "lubricated": "smord",
  "unlubricated": "osmord",
  "non-lubricated": "osmord",
  "water": "vatten",
  "steam": "ånga",
  "vacuum": "vakuum",
  "inert gases": "inerta gaser",
  "neutral gases": "neutrala gaser",
  // Cylindertyp
  "compact cylinder": "kompaktcylinder",
  "flat cylinder": "plattcylinder",
  "guide cylinder": "styrd cylinder",
  "guided cylinder": "styrd cylinder",
  "cartridge cylinder": "patroncylinder",
  "pneumatic cylinder": "pneumatisk cylinder",
  "large bore pneumatic cylinder": "pneumatisk cylinder med stor borrning",
  "round body cylinder": "rundcylinder",
  "round cylinder": "rundcylinder",
  "single-acting roundline cylinder": "enkelverkande rundcylinder",
  "non-rotating roundline cylinder": "vridsäker rundcylinder",
  "rodless cylinder": "kolvstångslös cylinder",
  "rodless band cylinder": "kolvstångslös bandcylinder",
  "rodless": "kolvstångslös",
  "ball rail guide": "kulskenstyrning",
  "magnetic coupling rodless": "kolvstångslös med magnetkoppling",
  "twin cylinder": "dubbelcylinder",
  // Dämpning
  "adjustable": "justerbar",
  "elastic": "elastisk",
  "pneumatic": "pneumatisk",
  "self-adjusting": "självjusterande",
  "non-cushioned": "utan dämpning",
  "none": "ingen",
  "cushioned": "dämpad",
  "elastic rings": "elastiska ringar",
  "elastic cushioning": "elastisk dämpning",
  "self-adjusting pneumatic": "självjusterande pneumatisk",
  "pneumatic adjustable": "pneumatisk, justerbar",
  "adjustable pneumatic": "pneumatisk, justerbar",
  "shock absorber": "stötdämpare",
  "hydraulic shock absorber": "hydraulisk stötdämpare",
  "adjustable cushioning": "justerbar dämpning",
  "adjustable cushioning (both ends)": "justerbar dämpning (båda ändar)",
  "air cushioning": "luftdämpning",
  // Lägesavkänning
  "magnetic piston": "magnetkolv",
  "magnetic piston available": "magnetkolv finns",
  "proximity sensor": "närhetsgivare",
  "hall sensor": "hallgivare",
  "inductive proximity sensor": "induktiv närhetsgivare",
  "integrated incremental encoder": "inbyggd inkrementell pulsgivare",
  "reed": "reed",
  "optional reed sensor": "reedgivare som tillval",
  // Material
  "aluminium": "aluminium",
  "aluminum": "aluminium",
  "anodized aluminium": "anodiserad aluminium",
  "brass": "mässing",
  "nickel-plated brass": "förnicklad mässing",
  "steel": "stål",
  "stainless steel": "rostfritt stål",
  "plastic": "plast",
  "polyurethane": "polyuretan",
  "zinc die-cast": "pressgjuten zink",
  "aluminium body": "hus i aluminium",
  "stainless steel rod": "kolvstång i rostfritt stål",
  // Gripdon och ventiler
  "external and internal": "yttre och inre",
  "external": "yttre",
  "internal": "inre",
  "solenoid": "magnetstyrd",
  "mechanical": "mekanisk",
  "manual": "manuell",
  "axial": "axiell",
  "side": "sida",
  "bidirectional": "dubbelriktad",
  "normally open": "normalt öppen",
  "normally closed": "normalt stängd",
};

/** Delar som får stå som de är: tal, mått, koder, standarder. */
function arNeutral(del: string): boolean {
  return !/[a-zåäö]{2,}/i.test(del) // inga ord alls
    || /^(ISO|DIN|EN|IP|NBR|FKM|FPM|EPDM|PTFE|POM|PA|PU|NPT|G|M)\b[\s\d\-/:.[\]]*$/i.test(del)
    || /^[A-Z0-9][A-Z0-9\-/.]*$/.test(del); // ren kod: "PPS", "KF", "DSNU"
}

// Ventilfunktioner: "5/2 monostable", "5/3 pressurized".
const VENTIL: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(\d\/\d)\s+monostable$/i, (m) => `${m[1]} monostabil`],
  [/^(\d\/\d)\s+bistable$/i, (m) => `${m[1]} bistabil`],
  [/^(\d\/\d)\s+bistable\s+\(memory\)$/i, (m) => `${m[1]} bistabil (minne)`],
  [/^(\d\/\d)\s+(?:mid-position\s+)?pressuri[sz]ed$/i, (m) => `${m[1]} trycksatt mittläge`],
  [/^(\d\/\d)\s+(?:mid-position\s+)?exhausted$/i, (m) => `${m[1]} avluftat mittläge`],
  [/^(\d\/\d)\s+(?:mid-position\s+)?closed$/i, (m) => `${m[1]} stängt mittläge`],
];

function oversattDel(del: string): string | null {
  const ren = del.trim();
  if (!ren) return ren;
  // Kod i parentes sist följer med oförändrad: "Elastic cushioning (P)".
  const kod = ren.match(/^(.*?)\s*(\([A-Z0-9][A-Z0-9\-/]{0,7}\))$/);
  if (kod && kod[1]) {
    const fore = oversattDel(kod[1]);
    return fore === null ? null : `${fore} ${kod[2]}`;
  }
  // Standardhänvisning sist följer med: "Compressed air ISO 8573-1 [7:4:4]".
  const std = ren.match(/^(.*?[a-z].*?)\s+((?:ISO|DIN|EN)\s[\d\-:.[\]\s]+)$/i);
  if (std) {
    const fore = oversattDel(std[1]);
    return fore === null ? null : `${fore} ${std[2]}`;
  }
  const hit = LEXIKON[ren.toLowerCase()];
  if (hit !== undefined) return hit;
  for (const [re, f] of VENTIL) {
    const m = ren.match(re);
    if (m) return f(m);
  }
  if (arNeutral(ren)) return ren;
  return null;
}

/**
 * Hela värdet på svenska, eller null när någon del saknas i lexikonet.
 */
export function svensktVarde(varde: string): string | null {
  const v = varde.trim();
  if (!v || !/[a-z]{3,}/i.test(v)) return null;
  // Avgränsare behålls; "and"/"or" blir "och"/"eller".
  const delar = v.split(/(\s*;\s*|\s*,\s*|\s+\/\s+|\s+and\s+|\s+or\s+)/i);
  const ut: string[] = [];
  for (let i = 0; i < delar.length; i++) {
    const d = delar[i];
    if (i % 2 === 1) {
      const a = d.trim().toLowerCase();
      ut.push(a === "and" ? " och " : a === "or" ? " eller " : a === "/" ? " / " : a === ";" ? "; " : ", ");
      continue;
    }
    const s = oversattDel(d);
    if (s === null) return null;
    // Varje del behåller sin versal: "Elastic rings; Self-adjusting pneumatic".
    ut.push(/^\s*[A-ZÅÄÖ]/.test(d) && /^[a-zåäö]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  }
  const text = ut.join("");
  return text === v ? null : text;
}
