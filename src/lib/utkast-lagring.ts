/**
 * Utkastens lagring (utan React, så att den kan provas med deno test).
 * Se utkast.ts för hooken.
 *
 * Utkast: det besökaren skrivit i ett formulär finns kvar efter en omladdning,
 * ett misslyckat skick eller ett klick bort och tillbaka (ägaren 2026-11-17:
 * "så att man inte behöver copy pasta allt igen").
 *
 * Sparas i sessionStorage, alltså bara i den här fliken och bara tills den
 * stängs -- inget finns kvar på en delad dator dagen efter, och det är
 * användarens egen inmatning under besöket (inget samtycke behövs för det).
 * Minne mellan besök sköter webbläsarens autofyll (autoComplete på fälten)
 * och, för inloggade, profilen.
 *
 * Lösenord och betalkortsuppgifter får aldrig gå hit.
 */
const PREFIX = "mv_utkast:";

function lager(): Storage | null {
  try {
    // globalThis: finns i webbläsaren (och i deno test), saknas på servern.
    return (globalThis as { sessionStorage?: Storage }).sessionStorage ?? null;
  } catch {
    return null; // blockerat i vissa privata lägen
  }
}

/** Läser ett sparat utkast, eller null. */
export function lasUtkast<T>(nyckel: string): T | null {
  try {
    const r = lager()?.getItem(PREFIX + nyckel);
    return r == null ? null : (JSON.parse(r) as T);
  } catch {
    return null;
  }
}

/** Sparar ett utkast; ett tomt värde tar bort det. */
export function sparaUtkast(nyckel: string, varde: unknown): void {
  try {
    const s = lager();
    if (!s) return;
    const tomt = varde == null || varde === "" || (typeof varde === "object" && Object.keys(varde as object).length === 0);
    if (tomt) s.removeItem(PREFIX + nyckel);
    else s.setItem(PREFIX + nyckel, JSON.stringify(varde));
  } catch {
    /* fullt eller blockerat: formuläret fungerar ändå */
  }
}

/**
 * Tar bort utkast efter ett lyckat skick. En nyckel som slutar på "." tar
 * bort alla under den, t.ex. rensaUtkast("radgivare.").
 */
export function rensaUtkast(...nycklar: string[]): void {
  try {
    const s = lager();
    if (!s) return;
    for (const n of nycklar) {
      if (!n.endsWith(".")) {
        s.removeItem(PREFIX + n);
        continue;
      }
      const bort: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(PREFIX + n)) bort.push(k);
      }
      bort.forEach((k) => s.removeItem(k));
    }
  } catch {
    /* ignoreras */
  }
}
