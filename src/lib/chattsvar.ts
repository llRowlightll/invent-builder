/**
 * Chattbubblan visar ren text, **fetstil** och rader. Modellen skriver ändå
 * ibland tabeller, rubriker och <br> -- i drift 2026-10-05 visades en hel
 * tabell som lodstreck. Gör om dem till rader som bubblan kan visa.
 */
const SKILJERAD = /^\s*\|?\s*:?-{3,}/;
const TABELLRAD = /^\s*\|.*\|\s*$/;

export function tillBubbeltext(text: string): string {
  // <br> inne i en tabellrad håller ihop raden; annars blir det en radbrytning.
  const rader = text
    .split("\n")
    .map((r) => (/^\s*\|/.test(r) ? r.replace(/\s*<br\s*\/?>\s*/gi, " / ") : r.replace(/\s*<br\s*\/?>\s*/gi, "\n")))
    .join("\n")
    .split("\n");
  const ut: string[] = [];
  for (let i = 0; i < rader.length; i++) {
    const rad = rader[i];
    if (SKILJERAD.test(rad)) continue;
    if (TABELLRAD.test(rad)) {
      // Rubrikraden ("Parameter | Värde | Kommentar") står ovanför skiljeraden.
      if (SKILJERAD.test(rader[i + 1] ?? "")) continue;
      const celler = rad.split("|").map((c) => c.trim()).filter(Boolean);
      if (celler.length) ut.push(`• **${celler[0]}**${celler.length > 1 ? `: ${celler.slice(1).join(" – ")}` : ""}`);
      continue;
    }
    const rubrik = /^\s*#{1,6}\s+(.*)$/.exec(rad);
    if (rubrik) { ut.push(`**${rubrik[1].replace(/\*\*/g, "")}**`); continue; }
    ut.push(rad.replace(/^(\s*)[-*]\s+/, "$1• "));
  }
  return ut.join("\n");
}

/**
 * Ett svar som klipptes vid max_tokens slutar mitt i ett ord. Kapa till sista
 * hela raden -- eller meningen -- och säg att svaret kortades.
 */
export function avslutaKlipptSvar(text: string, sv: boolean): string {
  let svar = text.trim();
  const rad = svar.lastIndexOf("\n");
  if (rad > 0) svar = svar.slice(0, rad).trim();
  else {
    const mening = Math.max(svar.lastIndexOf(". "), svar.lastIndexOf("! "), svar.lastIndexOf("? "));
    if (mening > 0) svar = svar.slice(0, mening + 1);
  }
  return svar + (sv
    ? "\n\n(Svaret kortades. Ställ en smalare fråga för mer detaljer.)"
    : "\n\n(The answer was cut short. Ask a narrower question for more detail.)");
}

/**
 * Modellen avslutar med "SOURCES: fil1, fil2" eller "SOURCES: none" (på
 * svenska ibland "KÄLLOR:"). Raden
 * tas bort ur svaret, och bara de källor modellen säger att den använde
 * visas.
 *
 * Hittat i drift 2026-10-06: "Vilken tätning klarar högtryckstvätt?" fick
 * ett svar om SMC:s inre dämpningstätning ur ett reservdelskit -- och sex
 * SMC-manualer listade som källor, fast ingen av dem handlar om tvätt.
 * Saknas raden (klippt svar, äldre modell) visas källorna som förut.
 */
export function skiljKallrad(svar: string, kandidater: string[]): { svar: string; kallor: string[] } {
  const m = /\n?[ \t]*(?:\*\*)?(?:SOURCES|K[ÄA]LLOR):(?:\*\*)?[ \t]*([^\n]*)[ \t]*$/i.exec(svar.trimEnd());
  if (!m) return { svar, kallor: kandidater };
  const text = svar.trimEnd().slice(0, m.index).trimEnd();
  const angivna = m[1].trim();
  if (!angivna || /^(none|inga|-|–)$/i.test(angivna)) return { svar: text, kallor: [] };
  // Kandidaterna ser ut som "SMC — fil.pdf"; modellen anger oftast bara filnamnet.
  const kallor = kandidater.filter((k) => {
    const fil = k.split(" — ").pop() ?? k;
    return angivna.includes(fil) || angivna.includes(k);
  });
  return { svar: text, kallor };
}
