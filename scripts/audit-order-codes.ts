/**
 * Kan varje familjs orderkodsmall återskapa familjens EGNA artikelnummer?
 *
 * Kör:  deno run --allow-net --allow-read --no-lock --node-modules-dir=none \
 *         scripts/audit-order-codes.ts
 *
 * VARFÖR. P1D:s mall var "P1D-S{bore_mm}M{thread}-{stroke_mm}", som ger
 * "P1D-S50MS-200". Ingen av de 25 P1D-artiklar vi säljer ser ut så -- alla har
 * nollutfyllnad. Mallen kunde alltså inte bygga en enda beställbar artikel, och
 * ingenting märkte det förrän någon testade den mot verkligheten.
 *
 * 66 familjer har mer än en aktiv artikel i products. För dem FINNS ett facit.
 * Det här skriptet kör varje familjs mall genom samma mallmotor som
 * konfiguratorsidan använder, provar alla kombinationer av dess parametrar, och
 * rapporterar hur många av familjens riktiga artikelnummer den kan träffa.
 *
 * Resultatet är arbetsordningen: en familj vars mall träffar noll artiklar är
 * trasig på samma sätt som P1D var, och ska tas först.
 */
import { fillOrderCodeTemplate } from "../src/lib/catalog/order-code-template.ts";

const URL_BAS = "https://buqfbcztspswezwyafxo.supabase.co/rest/v1";
const NYCKEL = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
if (!NYCKEL) {
  console.error("Sätt SUPABASE_ANON_KEY.");
  Deno.exit(1);
}

/**
 * Hämtar ALLA rader, sidvis.
 *
 * PostgREST har ett hårt tak på 1000 rader per svar som varken ?limit= eller
 * Range-huvudet går förbi. configurator_param_values har nästan 2000, så den
 * första versionen av det här skriptet såg bara hälften -- och rapporterade
 * P1D som 0/25 fast dess mall återskapar alla 25. Tyst avkortning är värre än
 * ett fel, för den ser ut som ett svar.
 */
async function h(sokvag: string): Promise<unknown[]> {
  const alla: unknown[] = [];
  const SIDA = 1000;
  for (let offset = 0; ; offset += SIDA) {
    const skiljare = sokvag.includes("?") ? "&" : "?";
    const url = `${URL_BAS}/${sokvag}${skiljare}limit=${SIDA}&offset=${offset}`;
    const r = await fetch(url, { headers: { apikey: NYCKEL, Authorization: `Bearer ${NYCKEL}` } });
    if (!r.ok) throw new Error(`${sokvag}: ${r.status} ${await r.text()}`);
    const sida = await r.json() as unknown[];
    alla.push(...sida);
    if (sida.length < SIDA) return alla;
  }
}

interface Familj { id: string; slug: string; name: string; order_code_template: string | null }
interface Param { family_id: string; param_key: string; param_type: string; required: boolean }
interface Varde { param_id: string; code: string }

const familjer = await h("configurator_families?select=id,slug,name,order_code_template") as Familj[];
const params = await h("configurator_params?select=id,family_id,param_key,param_type,required") as (Param & { id: string })[];
const varden = await h("configurator_param_values?select=param_id,code") as Varde[];
const produkter = await h("products?select=sku,family&status=eq.active") as { sku: string; family: string | null }[];

const vardenPerParam = new Map<string, string[]>();
for (const v of varden) {
  if (!vardenPerParam.has(v.param_id)) vardenPerParam.set(v.param_id, []);
  vardenPerParam.get(v.param_id)!.push(v.code);
}

const skuPerFamilj = new Map<string, string[]>();
for (const p of produkter) {
  if (!p.family) continue;
  const k = p.family.toLowerCase();
  if (!skuPerFamilj.has(k)) skuPerFamilj.set(k, []);
  skuPerFamilj.get(k)!.push(p.sku);
}

/** Tal som förekommer i artikelnumret -- kandidater för numeriska positioner. */
function talIKod(sku: string): string[] {
  return [...new Set(sku.match(/\d+/g) ?? [])];
}

interface Rad {
  slug: string; name: string; artiklar: number; traffar: number;
  mall: string; exempel: string; byggd: string; facit: boolean;
}
const rader: Rad[] = [];

for (const f of familjer) {
  const skus = (skuPerFamilj.get(f.slug.toLowerCase()) ?? []).filter((s) => s && s.length > 2);
  if (skus.length < 2) continue;               // utan facit går inget att pröva
  if (!f.order_code_template) continue;

  const egna = params.filter((p) => p.family_id === f.id);
  const nycklar = egna.map((p) => p.param_key);
  const kravs = new Set(egna.filter((p) => p.required).map((p) => p.param_key));

  let traffar = 0;
  let sistaByggd = "";

  for (const sku of skus) {
    const tal = talIKod(sku);
    const SKU = sku.toUpperCase();
    // Alternativ per parameter. För SELECT gallras kandidaterna till koder som
    // faktiskt förekommer i artikelnumret -- mallen sätter in koden ordagrant,
    // så en kod som inte står där kan omöjligt ingå. Utan den gallringen blir
    // P1D 262 080 kombinationer och med den 192.
    //
    // (Första versionen hade ett tak på 200 000 kombinationer och ETT BREAK som
    // hoppade ur hela sku-slingan. P1D föll över taket och rapporterades som
    // 0/25 fast dess mall återskapar alla 25. Kontrollen ljög alltså om precis
    // den familj jag visste var rätt -- vilket är varför den kördes mot P1D
    // först.)
    const alternativ = egna.map((p) => {
      if (p.param_type === "number") return ["", ...tal];
      const koder = (vardenPerParam.get(p.id) ?? []).filter((c) => c && SKU.includes(c.toUpperCase()));
      return ["", ...koder];
    });

    const kombinationer = alternativ.reduce((n, a) => n * a.length, 1);
    if (kombinationer > 2_000_000) continue;   // hoppa över DEN HÄR koden, inte familjen

    let hittad = false;
    const rekursion = (i: number, val: Record<string, string>) => {
      if (hittad) return;
      if (i === egna.length) {
        const byggd = fillOrderCodeTemplate(f.order_code_template!, val, kravs);
        // Spara ett exempel där något faktiskt fyllts i, inte den tomma raden.
        if (byggd.length > sistaByggd.length) sistaByggd = byggd;
        if (byggd.toUpperCase() === SKU) hittad = true;
        return;
      }
      for (const v of alternativ[i]) {
        rekursion(i + 1, { ...val, [nycklar[i]]: v });
        if (hittad) return;
      }
    };
    rekursion(0, {});
    if (hittad) traffar++;
  }

  // Är artikelnumren ORDERKODER eller leverantörens artikelnummer?
  // "P1D-S080MS-0250" är en orderkod; "FESTO-1463254" är ett artikelnummer,
  // och en orderkodsmall kan per definition inte återskapa det. Familjer av
  // det senare slaget har inget facit -- de behöver katalogen, inte ett test.
  const prefix = f.slug.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const arOrderkoder = skus.filter((s) =>
    prefix.length > 1 && s.toUpperCase().replace(/[^A-Z0-9]/g, "").startsWith(prefix)
  ).length >= Math.ceil(skus.length / 2);

  rader.push({
    slug: f.slug, name: f.name, artiklar: skus.length, traffar,
    mall: f.order_code_template, exempel: skus[0], byggd: sistaByggd,
    facit: arOrderkoder,
  });
}

const medFacit = rader.filter((r) => r.facit);
const utanFacit = rader.filter((r) => !r.facit);

medFacit.sort((a, b) =>
  (a.traffar / a.artiklar) - (b.traffar / b.artiklar) || b.artiklar - a.artiklar
);

const noll = medFacit.filter((r) => r.traffar === 0);
const delvis = medFacit.filter((r) => r.traffar > 0 && r.traffar < r.artiklar);
const hela = medFacit.filter((r) => r.traffar === r.artiklar);

console.log(`${rader.length} familjer med minst 2 aktiva artiklar\n`);
console.log(`  ${medFacit.length} har ORDERKODER som artikelnummer -- de har facit:`);
console.log(`      ${noll.length} träffar ingen, ${delvis.length} träffar några, ${hela.length} träffar alla`);
console.log(`  ${utanFacit.length} har leverantörsartikelnummer -- inget facit att pröva mot\n`);

console.log("── MED FACIT: arbetsordning, värst först ───────────────────");
for (const r of medFacit) {
  const m = `${r.traffar}/${r.artiklar}`.padStart(6);
  console.log(`${m}  ${r.slug.padEnd(14)} ${r.exempel.padEnd(24)} ${r.mall}`);
  if (r.traffar < r.artiklar) console.log(`        ${" ".repeat(14)} mallen ger: ${r.byggd}`);
}

console.log("\n── UTAN FACIT: artikelnumren är inte orderkoder ─────────────");
for (const r of utanFacit.sort((a, b) => b.artiklar - a.artiklar)) {
  console.log(`  ${String(r.artiklar).padStart(3)} st  ${r.slug.padEnd(14)} ${r.exempel}`);
}
