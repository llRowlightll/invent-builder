/**
 * Skriver kategoriritningarna i src/lib/product-images.ts till statiska filer
 * under public/ritningar/.
 *
 * Varför: ritningarna bakades tidigare in som data:image/svg+xml-URI:er, en
 * per produktkort. På /sv/products blev det 846 inbäddade kopior av 23 unika
 * ritningar -- 2,4 MB, 57 % av sidans 4,4 MB. Som filer laddas de 23 en gång
 * och cachas; HTML:en bär bara korta sökvägar.
 *
 * Körs: deno run --allow-read --allow-write scripts/skriv-ritningar.ts
 * Testet product-images.test.ts kontrollerar att filerna är i synk med källan.
 */
import { RITNINGAR, FALLBACK_SVG, FALLBACK_NYCKEL } from "../src/lib/product-images.ts";

const UT = new URL("../public/ritningar/", import.meta.url);
await Deno.mkdir(UT, { recursive: true });

let n = 0;
for (const [nyckel, svg] of Object.entries(RITNINGAR)) {
  await Deno.writeTextFile(new URL(`${nyckel}.svg`, UT), svg.trim() + "\n");
  n++;
}
await Deno.writeTextFile(new URL(`${FALLBACK_NYCKEL}.svg`, UT), FALLBACK_SVG.trim() + "\n");
n++;
console.log(`${n} ritningar skrivna till public/ritningar/ (fallback: ${FALLBACK_NYCKEL}.svg)`);
