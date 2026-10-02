// Håller de statiska kategoriritningarna i synk med källan i
// src/lib/product-images.ts.
//
// Ritningarna bäddades till 2026-10-02 in som data:image/svg+xml-URI:er, en
// per produktkort. På /sv/products blev det 846 inbäddade kopior av 23 unika
// ritningar: 2,4 MB, 57 % av sidans 4,4 MB. Nu ligger de som filer under
// public/ritningar/ och skrivs av scripts/skriv-ritningar.ts.
//
// Testet bor här, bland edge-funktionernas tester, av ett enda skäl: det är
// den svit CI faktiskt kör. Filen det granskar är fristående utan imports, så
// gränsöverskridandet kostar ingenting. Glöms skriptet bort efter en ändrad
// ritning visar varje produktkort en trasig bild -- och det är tyst.
import { assert, assertEquals } from "jsr:@std/assert@^1";
import { RITNINGAR, FALLBACK_SVG, FALLBACK_NYCKEL } from "../../../src/lib/product-images.ts";

const KATALOG = new URL("../../../public/ritningar/", import.meta.url);

async function filtext(nyckel: string): Promise<string | null> {
  try { return await Deno.readTextFile(new URL(`${nyckel}.svg`, KATALOG)); }
  catch { return null; }
}

Deno.test("varje ritning finns som fil och matchar källan", async () => {
  for (const [nyckel, svg] of Object.entries(RITNINGAR)) {
    const pa_disk = await filtext(nyckel);
    assert(pa_disk !== null, `public/ritningar/${nyckel}.svg saknas — kör scripts/skriv-ritningar.ts`);
    assertEquals(pa_disk!.trim(), svg.trim(), `${nyckel}.svg har glidit isär från källan`);
  }
});

Deno.test("fallback-ritningen finns som fil", async () => {
  const pa_disk = await filtext(FALLBACK_NYCKEL);
  assert(pa_disk !== null, `public/ritningar/${FALLBACK_NYCKEL}.svg saknas`);
  assertEquals(pa_disk!.trim(), FALLBACK_SVG.trim());
});

Deno.test("inga överblivna ritningsfiler", async () => {
  const kanda = new Set([...Object.keys(RITNINGAR), FALLBACK_NYCKEL]);
  for await (const post of Deno.readDir(KATALOG)) {
    if (!post.isFile || !post.name.endsWith(".svg")) continue;
    const nyckel = post.name.replace(/\.svg$/, "");
    assert(kanda.has(nyckel), `public/ritningar/${post.name} hör inte till någon ritning i källan`);
  }
});
