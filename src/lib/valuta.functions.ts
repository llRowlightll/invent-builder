/**
 * Riksbankens senaste kurs för en valuta, hämtad på servern (ingen CORS,
 * ingen nyckel i webbläsaren). SWEA-serien SEK<valuta>PMI ger kronor per
 * enhet, fastställd varje bankdag.
 */
import { createServerFn } from "@tanstack/react-start";
import { arValuta } from "./valuta";

export const hamtaValutakurs = createServerFn({ method: "POST" })
  .inputValidator((d: { valuta: string }) => d)
  .handler(async ({ data }): Promise<{ kurs: number; datum: string } | { fel: string }> => {
    if (!arValuta(data.valuta)) return { fel: `Okänd valuta: ${data.valuta}` };
    try {
      const svar = await fetch(`https://api.riksbank.se/swea/v1/Observations/Latest/SEK${data.valuta}PMI`, {
        headers: { Accept: "application/json" },
      });
      if (!svar.ok) return { fel: `Riksbanken svarade ${svar.status}` };
      const k = (await svar.json()) as { date?: string; value?: number };
      if (!(Number(k.value) > 0) || !k.date) return { fel: "Riksbanken gav ingen kurs" };
      return { kurs: Number(k.value), datum: k.date };
    } catch {
      return { fel: "Kunde inte nå Riksbanken" };
    }
  });
