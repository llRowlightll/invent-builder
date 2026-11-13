/**
 * ATEX och Ex-skydd besvaras inte av språkmodellen.
 *
 * Kundgranskningen 2026-11-13 (processingenjör, zon 1/21) fick två fria
 * svar som sa emot varandra och grunderna: "gasgrupp (A‑E)", "grupp C
 * (metan, propan …)", "T4 (max 300 °C)" och att Ex h dög till en lägesgivare.
 * Rätt är IIA/IIB/IIC, T4 = 135 °C, och Ex h gäller bara icke-elektrisk
 * utrustning. Ett fel här kan orsaka en explosion, så chatten svarar med en
 * fast, granskad sammanfattning och lämnar själva valet till en människa
 * mot tillverkarens EU-försäkran.
 *
 * Källor för tabellen: direktiv 2014/34/EU (utrustningskategorier),
 * 1999/92/EG (zoner), EN IEC 60079-0 (grupper, T-klasser, EPL),
 * EN ISO 80079-36/-37 (icke-elektrisk utrustning, Ex h).
 */

const ATEX_FRAGA =
  // Inte "3D" (3D-modell) eller "t ex i …": bara märkningens egna former.
  /\batex\b|\bex[\s-]?(skydd|klass|märk|zon|proof|schutz|protección)|explosi|\bzon(e)?\s*(0|1|2|20|21|22)\b|\bex\s?(h|ia|ib|ic|ma|mb|db|eb|tb|pxb)\b|\bii\s?[123]\s?[gd]\b|gasgrupp|gas group|\biii?[abc]\b|\bepl\b|\bt[1-6]\b.*(gas|ex|zon)|temperaturklass|temperature class/i;

/** Gäller frågan ATEX eller Ex-skydd? Tittar på frågan och de senaste meddelandena. */
export function arAtexFraga(fraga: string, historik: { content: string }[] = []): boolean {
  if (ATEX_FRAGA.test(fraga)) return true;
  // En följdfråga ("och i zon 21 då?") fångas av zonen; "vilken givare passar
  // där?" efter ett ATEX-svar ska inte få ett fritt svar heller.
  const senaste = historik.slice(-2).map((m) => m.content).join(" ");
  return /\batex\b|explosi|\bzon(e)?\s*(0|1|2|20|21|22)\b/i.test(senaste) && /givare|ventil|cylinder|spole|sensor|valve|kabel|cable|passar|fits|välj|choose/i.test(fraga);
}

const SV = `**ATEX besvarar vi inte med AI**: ett fel här kan orsaka en explosion. Det här är grunderna, och en människa bekräftar varje artikel mot tillverkarens EU-försäkran.

**Zon → utrustningskategori**
• Gas: zon 0 → 1G (EPL Ga) · zon 1 → 2G eller 1G (Gb) · zon 2 → 3G eller bättre (Gc)
• Damm: zon 20 → 1D (Da) · zon 21 → 2D eller 1D (Db) · zon 22 → 3D eller bättre (Dc)
• Godkänt för gas betyder inte godkänt för damm. Zon 1 + zon 21 kräver märkning för båda (2G och 2D).

**Grupper**
• Gas: IIA, IIB, IIC (IIC är strängast, t.ex. vätgas och acetylen)
• Damm: IIIA brännbara fibrer · IIIB icke-ledande damm · IIIC ledande damm

**Temperaturklass (högsta yttemperatur, gas)**
• T1 450 °C · T2 300 °C · T3 200 °C · T4 135 °C · T5 100 °C · T6 85 °C
• För damm anges temperaturen direkt, t.ex. T120 °C.

**Skyddssätt**
• Ex h gäller bara icke-elektrisk utrustning: cylindrar, ventilhus (EN ISO 80079-36/-37).
• Elektriska delar som spolar och givare behöver ett eget skyddssätt, t.ex. Ex ia/ib (egensäker), Ex mb (ingjuten) eller Ex db (trycktät kapsling).
• Hela kedjan ska vara klassad för zonen: cylinder, ventil, spole, givare och kablage.

**Så går vi vidare:** skicka zon, gas- eller dammgrupp och temperaturklass i en offertförfrågan. Då återkommer en av oss med artiklar och tillverkarens försäkran.`;

const EN = `**We do not answer ATEX with AI**: a mistake here can cause an explosion. These are the basics, and a person confirms every part against the manufacturer's EU declaration.

**Zone → equipment category**
• Gas: zone 0 → 1G (EPL Ga) · zone 1 → 2G or 1G (Gb) · zone 2 → 3G or better (Gc)
• Dust: zone 20 → 1D (Da) · zone 21 → 2D or 1D (Db) · zone 22 → 3D or better (Dc)
• Approved for gas does not mean approved for dust. Zone 1 + zone 21 needs marking for both (2G and 2D).

**Groups**
• Gas: IIA, IIB, IIC (IIC is the strictest, e.g. hydrogen and acetylene)
• Dust: IIIA combustible flyings · IIIB non-conductive dust · IIIC conductive dust

**Temperature class (maximum surface temperature, gas)**
• T1 450 °C · T2 300 °C · T3 200 °C · T4 135 °C · T5 100 °C · T6 85 °C
• For dust the temperature is stated directly, e.g. T120 °C.

**Type of protection**
• Ex h covers non-electrical equipment only: cylinders, valve bodies (EN ISO 80079-36/-37).
• Electrical parts such as coils and sensors need their own type of protection, e.g. Ex ia/ib (intrinsically safe), Ex mb (encapsulated) or Ex db (flameproof enclosure).
• The whole chain must be rated for the zone: cylinder, valve, coil, sensor and cabling.

**Next step:** send the zone, gas or dust group and temperature class in a quote request. One of us will come back with parts and the manufacturer's declaration.`;

/** Det fasta svaret. Svenska på /sv, engelska annars. */
export function atexSvar(locale?: string): string {
  return locale === "sv" ? SV : EN;
}
