/**
 * Fångar maskinval.se i dubbel upplösning, för sajttrailern.
 *
 * Bilderna är den riktiga, driftsatta sajten -- inga efterbildningar. Ett
 * enda undantag: maskinbyggarens frågesteg ersätts med två färdiga frågor,
 * eftersom språkmodellens dygnskvot styr just det steget. Förslagen,
 * stycklistan och verifieringen kommer från den riktiga tjänsten.
 *
 * Kör: node scripts/fanga-sajten.mjs  ->  public/fangst/*.png
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = new URL(
  "../node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  import.meta.url,
).pathname;
// Adressen kan pekas om: MASKINVAL_BAS=http://localhost:5173 fångar den
// lokala versionen (med produktionsdata) innan en ändring är driftsatt.
const BAS = process.env.MASKINVAL_BAS ?? "https://maskinval.se";
const KAKDOMAN = new URL(BAS).hostname;
const UT = new URL("../public/fangst/", import.meta.url).pathname;
mkdirSync(UT, { recursive: true });
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

const webblasare = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--hide-scrollbars", "--font-render-hinting=none"],
});
const sida = await webblasare.newPage();
await sida.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

// Endast nödvändiga kakor -- samma val som en besökare gör i bannern, och
// bannern syns då inte i filmen.
await sida.setCookie({ name: "mv_cookie_consent", value: "necessary", domain: KAKDOMAN, path: "/" });

// Maskinbyggarens frågesteg ersätts, och BARA det. Allt annat går till den
// riktiga tjänsten.
await sida.evaluateOnNewDocument(() => {
  const original = window.fetch;
  window.fetch = async (url, opts) => {
    if (String(url).includes("groq-advisor") && opts?.body) {
      try {
        const kropp = JSON.parse(opts.body);
        if (kropp.action === "questions") {
          return new Response(JSON.stringify({
            summary: "Vertikalt lyft med lasthållning i en varm miljö.",
            questions: [
              { id: "lasthallning", type: "choice", label: "Ska lasten hållas kvar om trycket försvinner?",
                options: ["Ja, extern lasthållning", "Nej"] },
              { id: "temperatur", type: "number", label: "Högsta omgivningstemperatur?", unit: "°C" },
            ],
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
      } catch {}
    }
    return original(url, opts);
  };
});

async function till(vag, extraVanta = 1500) {
  await sida.goto(BAS + vag, { waitUntil: "networkidle2", timeout: 60000 });
  await sida.evaluate(() => document.fonts?.ready);
  await vanta(extraVanta);
}
async function bild(namn) {
  await sida.screenshot({ path: `${UT}${namn}.png` });
  console.log(`  ${namn}.png`);
}

console.log("fångar maskinval.se:");

// 1. Startsidan.
await till("/sv");
await bild("hem");

// 2. Katalogen, först hel och sedan filtrerad.
await till("/sv/products", 2500);
await bild("katalog");
await till("/sv/products?q=DSBC", 2500);
await bild("sok");

// 3. Jämförelse över tillverkargränsen: samma ISO 15552-cylinder, Ø40 × 100 mm.
await till("/sv/compare?skus=" + encodeURIComponent("63M2A040A100,RA/8040/M/100"), 2500);
await bild("jamfor");

// 4. Maskinbyggaren, hela vägen till stycklistan.
await till("/sv/machine-builder");
await bild("bygg-tom");
await sida.click("textarea");
await sida.type("textarea",
  "Lyfta ett verktyg på 45 kg rakt upp 400 mm i en härdningslinje. 90 °C. En operatör arbetar under lasten.",
  { delay: 4 });
await vanta(400);
await bild("bygg-beskrivning");

const klicka = async (text) => {
  const ok = await sida.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes(t) && !x.disabled);
    if (b) { b.click(); return true; } return false;
  }, text);
  if (!ok) throw new Error(`hittade ingen knapp med texten "${text}"`);
};

await klicka("Analysera");
await sida.waitForFunction(() => document.body.innerText.includes("Högsta omgivningstemperatur"), { timeout: 30000 });
await vanta(600);
await klicka("Ja, extern lasthållning");
await sida.type('input[type="number"]', "90", { delay: 30 });
await vanta(500);
await bild("bygg-fragor");

await klicka("Hitta komponenter");
await sida.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent.includes("Välj")), { timeout: 60000 });
await vanta(1200);
await bild("bygg-alternativ");

await klicka("Välj");
await sida.waitForFunction(() => document.querySelectorAll("tbody tr").length > 3, { timeout: 60000 });
await vanta(2000);
// Stycklistan ligger under vecket; rulla så att bannern och tabellen syns.
await sida.evaluate(() => {
  const mal = document.querySelector("tbody")?.closest("div.rounded-xl, section, div");
  (document.querySelector("table") ?? mal)?.scrollIntoView({ block: "start" });
  window.scrollBy(0, -260);
});
await vanta(900);
await bild("bygg-stycklista");

await webblasare.close();
console.log("klart.");
