/**
 * Fångar maskinval.se för LinkedIn-filmen, i dubbel upplösning.
 *
 * Samma princip som fanga-sajten.mjs: den riktiga, driftsatta sajten, inga
 * efterbildningar. Här skrivs en sökfråga i startsidans sökruta, och fyra
 * fabrikat ställs bredvid varandra i jämförelsen -- alla ISO 15552 Ø40, alla
 * träffar på samma sökning.
 *
 * Kör: node scripts/fanga-linkedin.mjs  ->  public/fangst/*.png
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = new URL(
  "../node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  import.meta.url,
).pathname;
const BAS = "https://maskinval.se";
const UT = new URL("../public/fangst/", import.meta.url).pathname;
mkdirSync(UT, { recursive: true });
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

export const SOKFRAGA = "cylinder Ø40";
// Fyra fabrikat bland träffarna på SOKFRAGA, alla ISO 15552 Ø40.
export const JAMFOR = ["MW-C15552-40", "63M2A040A100", "0822121008", "P1D-S040MS-0250"];

const webblasare = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--hide-scrollbars", "--font-render-hinting=none"],
});
const sida = await webblasare.newPage();
await sida.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await sida.setCookie({ name: "mv_cookie_consent", value: "necessary", domain: "maskinval.se", path: "/" });

async function till(vag, extra = 1500) {
  await sida.goto(BAS + vag, { waitUntil: "networkidle2", timeout: 60000 });
  await sida.evaluate(() => document.fonts?.ready);
  await vanta(extra);
}
async function bild(namn) {
  await sida.screenshot({ path: `${UT}${namn}.png` });
  console.log(`  ${namn}.png`);
}

console.log("fångar för LinkedIn-filmen:");

// 1. Sökfrågan skriven i startsidans sökruta, inte skickad.
await till("/sv");
const ruta = await sida.$('main input[type="text"], main input:not([type]), main input[type="search"]');
if (!ruta) throw new Error("hittade ingen sökruta på startsidan");
await ruta.click();
await ruta.type(SOKFRAGA, { delay: 30 });
await vanta(500);
const rutansMatt = await ruta.boundingBox();
console.log("  sökrutan:", JSON.stringify(rutansMatt));
await bild("hem-skrivet");

// 2. Träffarna.
await till("/sv/products?q=" + encodeURIComponent(SOKFRAGA), 2500);
await bild("sok-cyl40");
// Hela träfflistan i en bild, så att kameran kan glida förbi alla fabrikat.
await sida.screenshot({ path: `${UT}sok-cyl40-hel.png`, fullPage: true });
console.log("  sok-cyl40-hel.png");

// 3. Fyra fabrikat sida vid sida.
await till("/sv/compare?skus=" + encodeURIComponent(JAMFOR.join(",")), 2500);
await bild("jamfor-4");
await sida.evaluate(() => window.scrollBy(0, 420));
await vanta(700);
await bild("jamfor-4-data");

await webblasare.close();
console.log("klart.");
