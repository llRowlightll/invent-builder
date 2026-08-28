// ─────────────────────────────────────────────────────────────────────────────
// bom-builder.ts — mandatory BOM row / custom-solution assembly (pure, no I/O).
//
// Extracted from index.ts (alongside signals.ts) so this logic can be
// unit-tested with `deno test` without starting the Deno.serve HTTP entrypoint,
// mirroring scoring.ts's existing precedent. Nothing here performs network,
// Deno.env, or Supabase access — keep it that way. Every function here takes
// already-fetched data (a product pool, a fully-populated BomCtx) and returns
// plain data; the impure fetch happens in index.ts's handleBom() before these
// are called.
// ─────────────────────────────────────────────────────────────────────────────

import { type CatalogProduct, isElectricActuator, isPneumaticActuatorProduct, parseStrokeFromSpecs } from "./scoring.ts";
import { pick, isPneumaticByDrive } from "./signals.ts";

export interface CustomSolutionContext {
  isWashdown?: boolean;
  isVertical?: boolean;
  isFoodGrade?: boolean;
  isBatteryDryroom?: boolean;
  isHydraulic?: boolean;
  isAtex?: boolean;
  isSilSafety?: boolean;
  maxCatalogStroke?: number;
  catalogCanHandle?: boolean;
}

export function buildCustomSolutionOption(
  minStroke: number, locale: string, maxCatalogStroke: number, catalogCanHandle: boolean,
  ctx: CustomSolutionContext = {}
) {
  const { isWashdown, isVertical, isFoodGrade, isBatteryDryroom, isHydraulic, isAtex, isSilSafety } = ctx;

  // Build a context-specific "why" with product family recommendations
  let whyLines: string[] = [];

  if (!catalogCanHandle && maxCatalogStroke > 0 && minStroke > 0) {
    whyLines.push(pick(locale, {
      sv: `Längsta katalogprodukten når ${maxCatalogStroke} mm — kravet är ${minStroke} mm.`,
      en: `Longest catalog product reaches ${maxCatalogStroke} mm — requirement is ${minStroke} mm.`,
      de: `Das längste Katalogprodukt erreicht ${maxCatalogStroke} mm — die Anforderung beträgt ${minStroke} mm.`,
      es: `El producto de catálogo más largo alcanza ${maxCatalogStroke} mm — el requisito es ${minStroke} mm.`,
    }));
  }

  // Washdown + vertical + food = most demanding scenario — give two explicit architectural paths
  if (isWashdown && isVertical && isFoodGrade) {
    whyLines.push(pick(locale, {
      sv: `⚙️ Rekommenderade arkitekturval för slakteri/IP69K-miljö:\n` +
        `▸ ALT A – Pneumatisk rostfri cylinder (316L): SMC HY-serien (IP69K, NSF-H1-smörjning, EHEDG-hygienisk design) eller Parker P1S Stainless Washdown Cylinder. Komplettera med pneumatisk stångbroms (rod lock) för säker hållning vid strömavbrott.\n` +
        `▸ ALT B – Kapslad el-cylinder IP69K: Bosch Rexroth EMC-HD-XC (IP69K rostfritt, PROFINET-nativ) eller Parker ETH-serie Washdown. Kräver integrerad motorbroms + säkerhetsventil för SIL 2/PLd.`,
      en: `⚙️ Recommended architectural paths for slaughterhouse/IP69K:\n` +
        `▸ ALT A – Stainless pneumatic cylinder (316L): SMC HY-Series (IP69K, NSF-H1 lube, EHEDG hygienic design) or Parker P1S Stainless Washdown. Add pneumatic rod lock for safe holding on power loss.\n` +
        `▸ ALT B – Enclosed IP69K electric cylinder: Bosch Rexroth EMC-HD-XC (IP69K stainless, native PROFINET) or Parker ETH Washdown series. Requires integrated motor brake + safety valve for SIL 2/PLd.`,
      de: `⚙️ Empfohlene Architekturansätze für Schlachthof-/IP69K-Umgebung:\n` +
        `▸ VARIANTE A – Pneumatischer Edelstahlzylinder (316L): SMC HY-Serie (IP69K, NSF-H1-Schmierung, EHEDG-hygienisches Design) oder Parker P1S Stainless Washdown Cylinder. Ergänzen mit pneumatischer Kolbenstangenbremse (Rod Lock) für sicheres Halten bei Stromausfall.\n` +
        `▸ VARIANTE B – Gekapselter Elektrozylinder IP69K: Bosch Rexroth EMC-HD-XC (IP69K Edelstahl, natives PROFINET) oder Parker ETH-Serie Washdown. Erfordert integrierte Motorbremse + Sicherheitsventil für SIL 2/PLd.`,
      es: `⚙️ Rutas de arquitectura recomendadas para entorno de matadero/IP69K:\n` +
        `▸ OPCIÓN A – Cilindro neumático de acero inoxidable (316L): serie SMC HY (IP69K, lubricación NSF-H1, diseño higiénico EHEDG) o Parker P1S Stainless Washdown. Añadir bloqueo de vástago neumático (rod lock) para sujeción segura ante fallo de alimentación.\n` +
        `▸ OPCIÓN B – Cilindro eléctrico encapsulado IP69K: Bosch Rexroth EMC-HD-XC (IP69K inoxidable, PROFINET nativo) o serie Parker ETH Washdown. Requiere freno de motor integrado + válvula de seguridad para SIL 2/PLd.`,
    }));
  } else if (isWashdown && isFoodGrade) {
    whyLines.push(pick(locale, {
      sv: `Miljökrav IP69K + livsmedel kräver: SMC HY-serien (316L, NSF-H1) eller Parker P1S Washdown. Verifierat EHEDG-utförande rekommenderas.`,
      en: `IP69K + food-grade requires: SMC HY-Series (316L, NSF-H1) or Parker P1S Washdown. EHEDG-certified design recommended.`,
      de: `Umgebungsanforderung IP69K + Lebensmittelqualität erfordert: SMC HY-Serie (316L, NSF-H1) oder Parker P1S Washdown. EHEDG-zertifizierte Ausführung empfohlen.`,
      es: `El requisito de entorno IP69K + grado alimenticio exige: serie SMC HY (316L, NSF-H1) o Parker P1S Washdown. Se recomienda diseño certificado EHEDG.`,
    }));
  } else if (isWashdown) {
    whyLines.push(pick(locale, {
      sv: `IP69K-krav: Festo CRDSNU (rostfri), Camozzi Serie 90 (IP67+), SMC CDQ2-serien (IP67) eller Parker P1S. Inga standardaluminiumcylindrar.`,
      en: `IP69K requirement: Festo CRDSNU (stainless), Camozzi Serie 90 (IP67+), SMC CDQ2-series (IP67) or Parker P1S. No standard aluminum.`,
      de: `IP69K-Anforderung: Festo CRDSNU (Edelstahl), Camozzi Serie 90 (IP67+), SMC CDQ2-Serie (IP67) oder Parker P1S. Keine Standard-Aluminiumzylinder.`,
      es: `Requisito IP69K: Festo CRDSNU (inoxidable), Camozzi Serie 90 (IP67+), serie SMC CDQ2 (IP67) o Parker P1S. Sin cilindros de aluminio estándar.`,
    }));
  }

  if (isVertical && isSilSafety) {
    whyLines.push(pick(locale, {
      sv: `⚠️ Vertikal last + säkerhetsfunktion: Mekanisk stångbroms (t.ex. SMC MHF2 rod lock) eller integrerad motorbroms OBLIGATORISK. Säkerhetsventil SIL 2-certifierad krävs per ISO 13849 PLd.`,
      en: `⚠️ Vertical load + safety function: Mechanical rod lock (e.g. SMC MHF2) or integrated motor brake MANDATORY. SIL 2-certified safety valve required per ISO 13849 PLd.`,
      de: `⚠️ Vertikale Last + Sicherheitsfunktion: Mechanische Kolbenstangenbremse (z. B. SMC MHF2 Rod Lock) oder integrierte Motorbremse ZWINGEND ERFORDERLICH. SIL 2-zertifiziertes Sicherheitsventil gemäß ISO 13849 PLd erforderlich.`,
      es: `⚠️ Carga vertical + función de seguridad: Bloqueo de vástago mecánico (p. ej. SMC MHF2 rod lock) o freno de motor integrado OBLIGATORIO. Se requiere válvula de seguridad certificada SIL 2 según ISO 13849 PLd.`,
    }));
  } else if (isVertical) {
    whyLines.push(pick(locale, {
      sv: `⚠️ Vertikal rörelse: Pilotmanövrerad backslagsventil eller stångbroms OBLIGATORISK för att förhindra fall vid lufttrycksfall.`,
      en: `⚠️ Vertical movement: Pilot-operated check valve or rod lock MANDATORY to prevent drop on air loss.`,
      de: `⚠️ Vertikale Bewegung: Pilotgesteuertes Rückschlagventil oder Kolbenstangenbremse ZWINGEND ERFORDERLICH, um ein Absinken bei Luftdruckverlust zu verhindern.`,
      es: `⚠️ Movimiento vertical: Válvula antirretorno pilotada o bloqueo de vástago OBLIGATORIO para evitar la caída ante pérdida de presión de aire.`,
    }));
  }

  if (isBatteryDryroom) {
    whyLines.push(pick(locale, {
      sv: `⛔ Dryroom Cu/Zn/Ni-fritt: SMC 25-serien (Cu/Zn/Ni-fri, PFPE-smörjd). Begär materialdeklerationsintyg.`,
      en: `⛔ Dryroom Cu/Zn/Ni-free: SMC 25-Series (Cu/Zn/Ni-free, PFPE-lubricated). Request material declaration.`,
      de: `⛔ Trockenraum Cu/Zn/Ni-frei: SMC 25-Serie (Cu/Zn/Ni-frei, PFPE-geschmiert). Materialdeklaration anfordern.`,
      es: `⛔ Sala seca sin Cu/Zn/Ni: serie SMC 25 (sin Cu/Zn/Ni, lubricado con PFPE). Solicitar certificado de declaración de materiales.`,
    }));
  }

  if (isHydraulic) {
    whyLines.push(pick(locale, {
      sv: `Hydraulisk applikation (100-350 bar): Parker HMI/HYD-serien, Bosch Rexroth CDL1 eller SMC CH-serien. Utanför pneumatisk standardkatalog.`,
      en: `Hydraulic application (100-350 bar): Parker HMI/HYD-series, Bosch Rexroth CDL1 or SMC CH-series. Outside pneumatic standard catalog.`,
      de: `Hydraulische Anwendung (100–350 bar): Parker HMI/HYD-Serie, Bosch Rexroth CDL1 oder SMC CH-Serie. Außerhalb des pneumatischen Standardkatalogs.`,
      es: `Aplicación hidráulica (100-350 bar): serie Parker HMI/HYD, Bosch Rexroth CDL1 o serie SMC CH. Fuera del catálogo neumático estándar.`,
    }));
  }

  if (isAtex) {
    whyLines.push(pick(locale, {
      sv: `ATEX-zon: Alla komponenter måste vara NAMUR/IECEx-certifierade. Parker P1X ATEX, SMC CDQMB-ATEX eller Norgren Excelon ATEX-serien.`,
      en: `ATEX zone: All components must be NAMUR/IECEx-certified. Parker P1X ATEX, SMC CDQMB-ATEX or Norgren Excelon ATEX-series.`,
      de: `ATEX-Zone: Alle Komponenten müssen NAMUR/IECEx-zertifiziert sein. Parker P1X ATEX, SMC CDQMB-ATEX oder Norgren Excelon ATEX-Serie.`,
      es: `Zona ATEX: Todos los componentes deben estar certificados NAMUR/IECEx. Parker P1X ATEX, SMC CDQMB-ATEX o serie Norgren Excelon ATEX.`,
    }));
  }

  if (whyLines.length === 0) {
    whyLines.push(pick(locale, {
      sv: `Vill du ha en lösning helt anpassad efter era exakta krav? Vi sköter leverantörsdialogen och levererar en komplett offert med exakt pris och leveranstid.`,
      en: `Want a solution fully tailored to your exact requirements? We manage the supplier dialogue and deliver a complete quote with exact pricing and lead time.`,
      de: `Möchten Sie eine Lösung, die exakt auf Ihre Anforderungen zugeschnitten ist? Wir übernehmen den Dialog mit dem Lieferanten und liefern ein vollständiges Angebot mit genauem Preis und Lieferzeit.`,
      es: `¿Desea una solución totalmente adaptada a sus requisitos exactos? Nos encargamos del diálogo con el proveedor y entregamos una oferta completa con precio y plazo de entrega exactos.`,
    }));
  }

  return {
    sku: "CUSTOM-SOLUTION",
    name: pick(locale, { sv: "Kundspecifik lösning", en: "Custom engineered solution", de: "Kundenspezifische Lösung", es: "Solución personalizada" }),
    badge: pick(locale, { sv: "Kundlösning", en: "Custom solution", de: "Kundenlösung", es: "Solución a medida" }),
    bore_mm: null, stroke_mm: minStroke > 0 ? minStroke : null, force_n: null,
    why: whyLines.join(" "),
    pros: pick(locale, {
      sv: ["Exakt anpassad till era krav", "Vi kör dialogen med leverantören", "Offert med pris och leveranstid"],
      en: ["Exactly matched to your requirements", "We manage the supplier dialogue", "Quote with pricing and lead time"],
      de: ["Exakt auf Ihre Anforderungen abgestimmt", "Wir führen den Lieferantendialog", "Angebot mit Preis und Lieferzeit"],
      es: ["Exactamente adaptado a sus requisitos", "Gestionamos el diálogo con el proveedor", "Oferta con precio y plazo de entrega"],
    }),
    cons: pick(locale, {
      sv: ["Längre ledtid än lagerprodukt", "Kräver offertförfrågan"],
      en: ["Longer lead time than stock items", "Requires a quote request"],
      de: ["Längere Lieferzeit als Lagerware", "Erfordert eine Angebotsanfrage"],
      es: ["Plazo de entrega más largo que los artículos en stock", "Requiere solicitud de oferta"],
    }),
  };
}

/**
 * v40: Find the best catalog product of a given component type.
 * Returns null if no catalog match exists — caller should use SPECIFY.
 */
export function findCatalogProductByType(
  type: "valve" | "frl" | "check-valve" | "shock-absorber" | "sensor" | "valve-terminal" | "fitting" | "cable" | "mounting" | "servo-motor" | "servo-drive" | "silencer" | "flow-control" | "tubing",
  products: CatalogProduct[]
): CatalogProduct | null {
  // FRL: prefer Festo MS4/MS6 first — avoids Camozzi MC- sorting to front alphabetically
  if (type === "frl") {
    return (
      products.find(p => /\bMS4\b|\bMS6\b/i.test(p.name + " " + p.sku)) ??
      products.find(p => p.category === "frl" || /\bFRL\b|\bLFR\b|\bHFR\b/i.test(p.name + " " + p.sku)) ??
      null
    );
  }
  // Prefer catalog SKUs with a brand prefix (FESTO-/FE-/SMC-/MW-/…) over raw,
  // un-prefixed manufacturer part numbers so BOMs stay consistent and clean.
  const BRAND_PREFIX = /^(festo|fe|smc|mw|cam|camozzi|nor|norgren|parker|br)-/i;
  const ordered = [...products].sort(
    (a, b) => (BRAND_PREFIX.test(a.sku) ? 0 : 1) - (BRAND_PREFIX.test(b.sku) ? 0 : 1)
  );
  // Exact category match wins (branded-first) so a loose name regex for one type
  // can't grab a product from another category — e.g. a "silencer" (ljuddämpare)
  // must never satisfy a "shock-absorber" (stötdämpare) lookup via "dämpare".
  const exactCat = ordered.find(p => p.category === type);
  if (exactCat) return exactCat;
  for (const p of ordered) {
    const nameSkuLower = (p.name + " " + p.sku).toLowerCase();
    switch (type) {
      case "valve":
        if (p.category === "valve" || /\bsolenoid\b|\b5\/2\b|\b4\/2\b|\bmagnetventil\b|\bdirektional/i.test(p.name)) return p;
        break;
      case "check-valve":
        if (p.category === "check-valve" || /backslagsventil|check.valve|pilot.operated.check|sperrventil|non.return/i.test(nameSkuLower)) return p;
        break;
      case "shock-absorber":
        if (p.category === "shock-absorber" || /st.tdämpare|shock.?absorber|st.tdämp/i.test(nameSkuLower)) return p;
        break;
      case "sensor":
        if (p.category === "sensor" || /\bSME\b|\bSMT\b|\bgivare\b|\breed.switch\b|\bproximity\b|\bend.pos/i.test(p.name + " " + p.sku)) return p;
        break;
      case "valve-terminal":
        if (p.category === "valve-terminal" || /\bCPV\b|\bVTSA\b|\bMPA\b|\bventilramp\b|\bventilterminal\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "fitting":
        if (p.category === "fitting" || /\bQS\b|\bQST\b|\bKQ\b|\bHB-\b|\bsnabbkoppling\b|\bpush.in/i.test(p.name + " " + p.sku)) return p;
        break;
      case "cable":
        if (p.category === "cable" || /\bkabel\b|\bcable\b|\bNEBU\b|\bSBOO\b|\bmotor.*kabel\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "mounting":
        if (p.category === "mounting" || /fotfäste|foot.mount|flansfäste|flange.mount|monteringsfäste|bracket|trunnion/i.test(nameSkuLower)) return p;
        break;
      case "servo-motor":
        if (p.category === "servo-motor" || /\bservo.?motor\b|\bstegmotor\b|\bstepper.?motor\b|\bEMMS\b|\bEMME\b|\bEMCA\b|\bEMMT\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "servo-drive":
        if (p.category === "servo-drive" || /\bservodriv|\bdrivsteg\b|\bamplifier\b|\bCMMP\b|\bCMMT\b|\bLECP\b|\bLECA\b|\bSTM\b/i.test(p.name + " " + p.sku)) return p;
        break;
      case "silencer":
        if (p.category === "silencer" || /ljuddämp|silencer|muffler|schalldämp/i.test(nameSkuLower)) return p;
        break;
      case "flow-control":
        if (p.category === "flow-control" || /flödesregler|flow.?control|strypback|speed.?control|throttle|drossel/i.test(nameSkuLower)) return p;
        break;
      case "tubing":
        if (p.category === "tubing" || /\bslang\b|tubing|polyuret|\bpun\b|\bpan\b|\btu\b/i.test(nameSkuLower)) return p;
        break;
    }
  }
  return null;
}

/** Find a real catalog actuator for a secondary axis (electric axis or pneumatic
 *  cylinder) matching a target stroke — so multi-axis BOMs emit real SKUs, not
 *  "ej i katalog" placeholders. */
export function findAxisActuator(products: CatalogProduct[], strokeMm: number, isElectric: boolean): CatalogProduct | null {
  const cands = products.filter(p => isElectric
    ? isElectricActuator(p) && !isPneumaticByDrive(p)
    : isPneumaticActuatorProduct(p) && !isElectricActuator(p));
  if (cands.length === 0) return null;
  if (strokeMm > 0) {
    const fit = cands.find(p => { const s = parseStrokeFromSpecs(p.key_specs ?? {}); return s === 0 || s >= strokeMm; });
    if (fit) return fit;
  }
  return cands[0];
}

export interface BomCtx {
  primarySku: string;
  primaryIsFamilyProd: boolean;
  isElectric: boolean;
  isAtex: boolean;
  isAtexDust: boolean;
  isVerticalLoad: boolean;
  isHighSpeed: boolean;
  valveTerminal: boolean;
  isEndPosDetect: boolean;
  isVacuum: boolean;
  locale: string;
  products: CatalogProduct[];
  // Accessory flags — drive deterministic accessory rows
  isMounting: boolean;
  isArticulated: boolean;
  isRodLock: boolean;
  primaryBoreMm: number;   // fetched by SKU — `products` (30/category) may miss the primary
  primaryBrand: string;    // same as above — see fetchPrimaryInfo() call site
  // Safety & environment flags — drive mandatory warning rows
  isHighTemp: boolean;
  isWashdown: boolean;
  isSilSafety: boolean;
  isHydraulic: boolean;
  isVeryHighForce: boolean;
  // Multi-axis
  isMultiAxis: boolean;
  perAxisStrokes: Array<{ axis: string; stroke: number }>;
}

/**
 * v40: Build ALL mandatory BOM rows using deterministic engineering rules.
 * This replaces per-component injections scattered across handleBom().
 * The LLM cannot affect these rows — they are always present.
 */
export function buildMandatoryBomRows(ctx: BomCtx): Array<{ sku: string; quantity: number; role: string; reason: string }> {
  const { primarySku, primaryIsFamilyProd, isElectric, isAtex, isAtexDust,
          isVerticalLoad, isHighSpeed, valveTerminal, isEndPosDetect, locale, products,
          isMounting, isArticulated, isRodLock, primaryBoreMm, primaryBrand: primaryBrandFetched, isHighTemp, isWashdown, isSilSafety, isHydraulic, isVeryHighForce,
          isMultiAxis, perAxisStrokes } = ctx;
  const isPneumatic = !isElectric && !isAtex && !isAtexDust;
  const rows: Array<{ sku: string; quantity: number; role: string; reason: string }> = [];

  // ── 1. Primary actuator (ALWAYS first) ───────────────────────────
  // In a multi-axis job the primary covers the LONGEST-stroke axis — label rows by
  // axis so X/Z are never ambiguous (and "primary" isn't just "first parsed").
  const primaryAxisIdx = perAxisStrokes.length
    ? perAxisStrokes.reduce((best, a, i, arr) => (a.stroke > arr[best].stroke ? i : best), 0)
    : -1;
  const primaryAxisLabel = (isMultiAxis && primaryAxisIdx >= 0) ? perAxisStrokes[primaryAxisIdx].axis.toUpperCase() : "";
  const famNote = primaryIsFamilyProd ? pick(locale, {
    sv: " ⚠️ Produktfamilj — ange komplett beställningskod (bore + stroke + varianter) vid order.",
    en: " ⚠️ Product family — specify full ordering code (bore + stroke + variants) when ordering.",
    de: " ⚠️ Produktfamilie — vollständigen Bestellcode (Bohrung + Hub + Varianten) bei der Bestellung angeben.",
    es: " ⚠️ Familia de productos — indique el código de pedido completo (diámetro + carrera + variantes) al realizar el pedido.",
  }) : "";
  rows.push({
    sku: primarySku, quantity: 1,
    role: pick(locale, { sv: "Primär aktuator", en: "Primary actuator", de: "Primäraktuator", es: "Actuador primario" })
      + (primaryAxisLabel ? pick(locale, { sv: ` — ${primaryAxisLabel}-axel`, en: ` — ${primaryAxisLabel}-axis`, de: ` — ${primaryAxisLabel}-Achse`, es: ` — eje ${primaryAxisLabel}` }) : ""),
    reason: pick(locale, { sv: "Vald primär aktuator", en: "Selected primary actuator", de: "Ausgewählter Primäraktuator", es: "Actuador primario seleccionado" }) + famNote,
  });

  // Prefer the primary's brand when picking motor/drive/sensor/secondary axis, so
  // e.g. an SMC axis gets an SMC drive rather than a Festo one. Same-brand sorted
  // to front. Found 2026-08-21: this used to look up the primary's brand via
  // `products.find(p => p.sku === primarySku)`, but `products` here is capped at
  // 30 per category and ordered by brand slug then SKU — for a category with
  // >30 rows before a given brand alphabetically (e.g. "cylinder" has 45
  // bosch-rexroth rows alone, so nothing from smc/norgren/parker/metal-work ever
  // survives the cut), the primary SKU itself is silently absent from `products`,
  // so this returned "" and brandSorted silently fell back to unsorted `products`
  // every time — the exact same failure mode primaryBoreMm was already fetched
  // separately to avoid (see its comment above). Reusing that same fetch now that
  // it also returns brand, instead of re-deriving it from a pool that may not
  // contain the one product that actually matters here.
  const primaryBrand = primaryBrandFetched.toLowerCase();
  const brandSorted = primaryBrand
    ? [...products].sort((a, b) => (a.brand?.toLowerCase() === primaryBrand ? 0 : 1) - (b.brand?.toLowerCase() === primaryBrand ? 0 : 1))
    : products;

  // ── 2. Servo motor (all electric axes; brake emphasised when vertical) ───
  if (isElectric) {
    const motorMatch = findCatalogProductByType("servo-motor", brandSorted);
    const sameBrandMotor = !!motorMatch && !!primaryBrand && motorMatch.brand?.toLowerCase() === primaryBrand;
    if (sameBrandMotor) {
      // Separate-motor brands (e.g. Festo EGSK + EMME, Parker HMR + MPP) — the axis
      // needs its own servo motor whether horizontal or vertical.
      // Label by the ACTUAL motor type — a Camozzi MTS is a STEPPER, not a servo.
      // Hard-coding "Servomotor" produced the stepper/servo mix-up users flagged.
      const stepperMotor = /steg|stepper/i.test(`${motorMatch!.name} ${motorMatch!.sku}`);
      rows.push({
        sku: motorMatch!.sku, quantity: 1,
        role: isVerticalLoad
          ? pick(locale, { sv: "Bromsmotor (vertikal säkerhet)", en: "Brake motor (vertical safety)", de: "Bremsmotor (vertikale Sicherheit)", es: "Motor con freno (seguridad vertical)" })
          : pick(locale, stepperMotor
              ? { sv: "Stegmotor", en: "Stepper motor", de: "Schrittmotor", es: "Motor paso a paso" }
              : { sv: "Servomotor", en: "Servo motor", de: "Servomotor", es: "Servomotor" }),
        reason: `${motorMatch!.name} (${motorMatch!.brand}) — ` + (isVerticalLoad
          ? pick(locale, {
              sv: "OBLIGATORISK för vertikal elektrisk axel — beställ med integrerad hållbroms som håller lasten vid strömavbrott/nödstopp.",
              en: "MANDATORY for a vertical electric axis — order with integrated holding brake to keep the load on power loss/E-stop.",
              de: "ZWINGEND ERFORDERLICH für eine vertikale elektrische Achse — mit integrierter Haltebremse bestellen, die die Last bei Stromausfall/Not-Halt hält.",
              es: "OBLIGATORIO para un eje eléctrico vertical — pedir con freno de retención integrado que sujete la carga ante fallo de alimentación/parada de emergencia.",
            })
          : pick(locale, {
              sv: "Driver axeln — matcha moment/varvtal mot lasten; samma märke som axel och drivare.",
              en: "Drives the axis — match torque/speed to the load; same brand as the axis and drive.",
              de: "Treibt die Achse an — Drehmoment/Drehzahl auf die Last abstimmen; gleiche Marke wie Achse und Antrieb.",
              es: "Impulsa el eje — ajuste el par/velocidad a la carga; misma marca que el eje y el accionamiento.",
            })),
      });
    } else if (isVerticalLoad) {
      // Integrated-motor actuator (e.g. SMC LE-series) — the holding brake is an
      // ORDER OPTION on the actuator, not a separate (foreign-brand) motor.
      rows[0].reason += pick(locale, {
        sv: " Beställ med integrerad hållbroms (bromsoption) för vertikal säkerhet — håller lasten vid strömavbrott.",
        en: " Order with the integrated holding-brake option for vertical safety — holds the load on power loss.",
        de: " Mit der Option integrierte Haltebremse für vertikale Sicherheit bestellen — hält die Last bei Stromausfall.",
        es: " Pedir con la opción de freno de retención integrado para seguridad vertical — sujeta la carga ante fallo de alimentación.",
      });
    } else {
      // Found 2026-08-28 (adversarial test): an SMC-LEY BOM (SMC has zero
      // standalone servo-motor products -- its electric axes are integrated-
      // motor units) got a servo-drive row but NO motor row and NO explanation
      // -- the vertical-load branch above already correctly explains this for
      // integrated-motor actuators, but the (more common) non-vertical case
      // stayed completely silent. Indistinguishable from "the BOM forgot the
      // motor" to a customer, even though nothing is actually missing to buy.
      rows[0].reason += pick(locale, {
        sv: " Motorn är integrerad i axeln — ingen separat servomotor behöver beställas.",
        en: " The motor is integrated into the axis — no separate servo motor needs to be ordered.",
        de: " Der Motor ist in die Achse integriert — es muss kein separater Servomotor bestellt werden.",
        es: " El motor está integrado en el eje — no es necesario pedir un servomotor independiente.",
      });
    }
  }

  // Found 2026-08-21 (adversarial test): an electric axis explicitly asked for
  // end-position sensors got zero acknowledgment of that anywhere in the BOM -
  // isEndPosDetect only ever adds a row inside `isPneumatic` (or, since the
  // ATEX fix above, `isAtex`/`isAtexDust`) branches, and isElectric is none of
  // those. Less severe than the ATEX case (a servo axis's integrated encoder
  // genuinely already provides position feedback, so no separate sensor is
  // actually missing) but the same "stated requirement silently vanished"
  // problem applies - say so, appended to the primary actuator row rather
  // than inventing a purchasable-looking row for something that isn't one.
  if (isEndPosDetect && isElectric) {
    rows[0].reason += pick(locale, {
      sv: " OBS: separat ändlägesgivare behövs inte — servoaxelns inbyggda encoder ger redan exakt lägesåterkoppling till PLC:n.",
      en: " Note: a separate end-position sensor isn't needed — the servo axis's built-in encoder already provides precise position feedback to the PLC.",
      de: " Hinweis: ein separater Endlagensensor ist nicht erforderlich — der integrierte Encoder der Servoachse liefert bereits eine präzise Positionsrückmeldung an die SPS.",
      es: " Nota: no se necesita un sensor de fin de carrera independiente — el encoder integrado del eje servo ya proporciona una retroalimentación de posición precisa al PLC.",
    });
  }

  // ── 2b. Servo drive / amplifier (all electric axes) ──────────────
  if (isElectric) {
    const driveMatch = findCatalogProductByType("servo-drive", brandSorted);
    const sameBrandDrive = !!driveMatch && !!primaryBrand && driveMatch.brand?.toLowerCase() === primaryBrand;
    const bU = primaryBrand ? primaryBrand.toUpperCase() : "";
    const stepperDrive = !!driveMatch && /steg|stepper/i.test(`${driveMatch.name} ${driveMatch.sku}`);
    rows.push({
      sku: sameBrandDrive ? driveMatch!.sku : "SPECIFY", quantity: 1,
      role: pick(locale, stepperDrive
        ? { sv: "Stegmotordrivare (drivsteg)", en: "Stepper drive (driver)", de: "Schrittmotortreiber (Endstufe)", es: "Controlador de motor paso a paso" }
        : { sv: "Servodrivare (drivsteg)", en: "Servo drive (amplifier)", de: "Servoantrieb (Endstufe)", es: "Accionamiento servo (amplificador)" }),
      reason: sameBrandDrive
        ? `${driveMatch!.name} (${driveMatch!.brand}). ` + pick(locale, {
            sv: "Driver och styr motorn — matcha effekt/spänning mot axeln; ange styrgränssnitt (step/dir eller fältbuss).",
            en: "Drives and controls the motor — match power/voltage to the axis; specify control interface (step/dir or fieldbus).",
            de: "Treibt und steuert den Motor — Leistung/Spannung auf die Achse abstimmen; Steuerschnittstelle angeben (Step/Dir oder Feldbus).",
            es: "Impulsa y controla el motor — ajuste la potencia/tensión al eje; indique la interfaz de control (paso/dirección o bus de campo).",
          })
        : pick(locale, {
            sv: `Specificera kompatibel drivare för ${bU ? bU + "-" : ""}axeln — vi har ingen ${bU}-drivare i katalogen ännu, begär offert.`,
            en: `Specify a compatible drive for the ${bU ? bU + " " : ""}axis — no ${bU} drive in the catalogue yet, request a quote.`,
            de: `Kompatiblen Antrieb für die ${bU ? bU + "-" : ""}Achse angeben — wir haben noch keinen ${bU}-Antrieb im Katalog, bitte Angebot anfordern.`,
            es: `Especifique un accionamiento compatible para el eje ${bU ? bU + " " : ""}— todavía no tenemos un accionamiento ${bU} en el catálogo, solicite una oferta.`,
          }),
    });
  }

  // ── 3. Check valve (vertical pneumatic) ──────────────────────────
  if (isVerticalLoad && isPneumatic) {
    const cvMatch = findCatalogProductByType("check-valve", products);
    rows.push({
      sku: cvMatch?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "Pilotmanövrerad backslagsventil", en: "Pilot-operated check valve", de: "Pilotgesteuertes Rückschlagventil", es: "Válvula antirretorno pilotada" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK vid pneumatisk vertikal last — förhindrar att lasten faller vid lufttrycksförlust (IEC 60947-5-1)",
        en: "MANDATORY for pneumatic vertical load — prevents load drop on air pressure loss (IEC 60947-5-1)",
        de: "ZWINGEND ERFORDERLICH bei pneumatischer vertikaler Last — verhindert ein Absinken der Last bei Luftdruckverlust (IEC 60947-5-1)",
        es: "OBLIGATORIO para carga vertical neumática — evita la caída de la carga ante pérdida de presión de aire (IEC 60947-5-1)",
      }),
    });
  }

  // ── 3b. Mechanical rod lock (fail-safe holding) — bore-matched ────
  // Explicitly demanded ("stångbroms/mekaniskt lås/får inte falla") or vertical +
  // SIL/e-stop context. The check valve holds PRESSURE; only a spring-applied rod
  // lock holds the load through a broken hose or e-stop venting. Same matching
  // rule as mountings: a real SKU only when its bore equals the primary's,
  // otherwise SPECIFY with the required Ø called out — never a mismatched lock.
  if (isRodLock && isPneumatic) {
    const primary = products.find(p => p.sku === primarySku);
    const pBore = primaryBoreMm ||
                  firstNumAbs(primary?.key_specs?.bore_mm) ||
                  firstNumAbs((primary?.name ?? "").match(/Ø\s?(\d+)/)?.[1]);
    const boreTxt = pBore > 0 ? `Ø${pBore}` : pick(locale, { sv: "cylinderns borrning", en: "the cylinder's bore", de: "die Zylinderbohrung", es: "el diámetro del cilindro" });
    const lock = products.find(p =>
      p.category === "rod-lock" && pBore > 0 &&
      (firstNumAbs(p.key_specs?.bore_mm) === pBore || firstNumAbs(p.name.match(/Ø\s?(\d+)/)?.[1]) === pBore));
    rows.push({
      sku: lock?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "Stångbroms/mekaniskt lås (fail-safe)", en: "Rod lock / mechanical brake (fail-safe)", de: "Kolbenstangenbremse/mechanische Verriegelung (fail-safe)", es: "Bloqueo de vástago/freno mecánico (fail-safe)" }),
      reason: lock
        ? pick(locale, {
            sv: `${lock.name} — fjäderbelastat lås som låser kolvstången vid luftbortfall, ${boreTxt}-matchad mot cylindern. Backventilen håller trycket; låset håller lasten även vid slangbrott eller nödstoppsavluftning.`,
            en: `${lock.name} — spring-applied lock that clamps the rod on air loss, ${boreTxt}-matched to the cylinder. The check valve holds pressure; the lock holds the load even through hose rupture or e-stop venting.`,
            de: `${lock.name} — federbetätigte Verriegelung, die die Kolbenstange bei Luftverlust festklemmt, ${boreTxt}-passend zum Zylinder. Das Rückschlagventil hält den Druck; die Verriegelung hält die Last auch bei Schlauchbruch oder Not-Halt-Entlüftung.`,
            es: `${lock.name} — bloqueo accionado por resorte que sujeta el vástago ante pérdida de aire, ajustado a ${boreTxt} del cilindro. La válvula antirretorno mantiene la presión; el bloqueo sujeta la carga incluso ante rotura de manguera o purga por parada de emergencia.`,
          })
        : pick(locale, {
            sv: `Ange stångbroms/mekaniskt lås i ${boreTxt} — fjäderbelastat, låser vid luft-/strömbortfall. MÅSTE matcha cylinderns borrning; ${boreTxt}-variant saknas i lager (kundspecifik/offert).`,
            en: `Specify a rod lock / mechanical brake in ${boreTxt} — spring-applied, locks on air/power loss. MUST match the cylinder bore; no ${boreTxt} variant in stock (custom/quote).`,
            de: `Kolbenstangenbremse/mechanische Verriegelung in ${boreTxt} angeben — federbetätigt, verriegelt bei Luft-/Stromausfall. MUSS zur Zylinderbohrung passen; ${boreTxt}-Variante nicht auf Lager (kundenspezifisch/Angebot).`,
            es: `Indique un bloqueo de vástago/freno mecánico en ${boreTxt} — accionado por resorte, bloquea ante fallo de aire/alimentación. DEBE coincidir con el diámetro del cilindro; no hay variante ${boreTxt} en stock (a medida/oferta).`,
          }),
    });
  }

  // ── 4. Valve terminal (multi-actuator / fieldbus) OR single directional valve ─
  if (valveTerminal && isPneumatic) {
    const vtMatch = findCatalogProductByType("valve-terminal", products);
    rows.push({
      sku: vtMatch?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "Ventilramp (ventilterminal)", en: "Valve terminal (manifold)", de: "Ventilinsel (Ventilterminal)", es: "Terminal de válvulas (colector)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK för fältbussanslutning (PROFINET/EtherCAT) — ventilramp (CPV, VTSA, MPA) samlar alla ventiler i en enhet och reducerar kabelkostnad. Specificera bussmodul och ventilantal.",
        en: "MANDATORY for fieldbus (PROFINET/EtherCAT) — valve terminal (CPV, VTSA, MPA) consolidates all valves, reduces wiring. Specify bus module and valve count.",
        de: "ZWINGEND ERFORDERLICH für Feldbusanbindung (PROFINET/EtherCAT) — die Ventilinsel (CPV, VTSA, MPA) fasst alle Ventile in einer Einheit zusammen und reduziert den Verkabelungsaufwand. Busmodul und Ventilanzahl angeben.",
        es: "OBLIGATORIO para conexión de bus de campo (PROFINET/EtherCAT) — el terminal de válvulas (CPV, VTSA, MPA) agrupa todas las válvulas en una unidad y reduce el cableado. Especifique el módulo de bus y el número de válvulas.",
      }),
    });
  } else if (isPneumatic) {
    const valveMatch = findCatalogProductByType("valve", products);
    rows.push({
      sku: valveMatch?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "Magnetventil (5/2-vägs styrventil)", en: "Solenoid valve (5/2-way directional)", de: "Magnetventil (5/2-Wege-Steuerventil)", es: "Electroválvula (5/2 vías)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK för pneumatisk cylinder — 5/2-vägs magnetventil styr cylinderns riktning (fram/åter). Välj spänning 24 V DC och anslutning G1/4.",
        en: "MANDATORY for pneumatic cylinder — 5/2-way solenoid valve controls cylinder direction (extend/retract). Select 24 V DC coil and G1/4 port.",
        de: "ZWINGEND ERFORDERLICH für Pneumatikzylinder — das 5/2-Wege-Magnetventil steuert die Zylinderrichtung (Aus-/Einfahren). 24-V-DC-Spule und G1/4-Anschluss wählen.",
        es: "OBLIGATORIO para cilindro neumático — la electroválvula 5/2 controla la dirección del cilindro (avance/retroceso). Seleccione bobina de 24 V CC y conexión G1/4.",
      }),
    });
  }

  // ── 4b. Silencer + one-way flow control (all pneumatic) ──────────
  if (isPneumatic) {
    const silMatch = findCatalogProductByType("silencer", products);
    rows.push({
      sku: silMatch?.sku ?? "SPECIFY", quantity: valveTerminal ? 1 : 2,
      role: pick(locale, { sv: "Ljuddämpare (avluftning)", en: "Silencer (exhaust)", de: "Schalldämpfer (Entlüftung)", es: "Silenciador (escape)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK på ventilens avluftningsportar (3/5) — sänker ljudnivån och skyddar mot smuts. En per avluftningsport (2 st för en 5/2-ventil); vid ventilramp räcker en central enhet.",
        en: "MANDATORY on the valve exhaust ports (3/5) — cuts noise and keeps dirt out. One per exhaust port (2 for a 5/2 valve); one central unit suffices on a manifold.",
        de: "ZWINGEND ERFORDERLICH an den Entlüftungsanschlüssen des Ventils (3/5) — reduziert den Geräuschpegel und hält Schmutz fern. Einer je Entlüftungsanschluss (2 Stück bei einem 5/2-Ventil); bei einer Ventilinsel genügt eine zentrale Einheit.",
        es: "OBLIGATORIO en los puertos de escape de la válvula (3/5) — reduce el nivel de ruido y evita la entrada de suciedad. Uno por puerto de escape (2 para una válvula 5/2); en un terminal de válvulas basta una unidad central.",
      }),
    });
    const fcMatch = findCatalogProductByType("flow-control", products);
    rows.push({
      sku: fcMatch?.sku ?? "SPECIFY", quantity: 2,
      role: pick(locale, { sv: "Strypbackventil (hastighetsreglering)", en: "One-way flow control (speed)", de: "Drosselrückschlagventil (Geschwindigkeitsregelung)", es: "Regulador de caudal unidireccional (velocidad)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK för att ställa cylinderns hastighet — 2 st strypbackventiler (meter-out) på cylinderns portar ger jämn, kontrollerad rörelse fram och åter.",
        en: "MANDATORY to set cylinder speed — 2 one-way flow-control valves (meter-out) on the cylinder ports give smooth, controlled extend/retract.",
        de: "ZWINGEND ERFORDERLICH zur Einstellung der Zylindergeschwindigkeit — 2 Drosselrückschlagventile (Abluftdrosselung) an den Zylinderanschlüssen sorgen für eine gleichmäßige, kontrollierte Aus-/Einfahrbewegung.",
        es: "OBLIGATORIO para ajustar la velocidad del cilindro — 2 reguladores de caudal unidireccionales (regulación de escape) en los puertos del cilindro proporcionan un movimiento de avance/retroceso suave y controlado.",
      }),
    });
  }

  // ── 5. FRL (all pneumatic) ────────────────────────────────────────
  if (isPneumatic) {
    const frlMatch = findCatalogProductByType("frl", products);
    rows.push({
      sku: frlMatch?.sku ?? "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "FRL-enhet (Filter-Regulator-Smörjare)", en: "FRL unit (Filter-Regulator-Lubricator)", de: "FRL-Einheit (Filter-Regler-Öler)", es: "Unidad FRL (Filtro-Regulador-Lubricador)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK för pneumatiskt system — luftberedning säkerställer rätt arbetstryck, filtrerad luft (≥40 µm) och smörjning av cylindertätningar. Välj regulator med manometer 0–10 bar.",
        en: "MANDATORY for pneumatic system — air preparation ensures correct working pressure, filtered air (≥40 µm) and seal lubrication. Select regulator with pressure gauge 0–10 bar.",
        de: "ZWINGEND ERFORDERLICH für pneumatische Systeme — die Luftaufbereitung stellt den richtigen Arbeitsdruck, gefilterte Luft (≥40 µm) und die Schmierung der Zylinderdichtungen sicher. Regler mit Manometer 0–10 bar wählen.",
        es: "OBLIGATORIO para sistemas neumáticos — el tratamiento de aire garantiza la presión de trabajo correcta, aire filtrado (≥40 µm) y lubricación de las juntas del cilindro. Seleccione un regulador con manómetro de 0-10 bar.",
      }),
    });
  }

  // ── 6. Shock absorbers (high speed ≥1000 mm/s) ───────────────────
  if (isHighSpeed) {
    const saMatch = findCatalogProductByType("shock-absorber", products);
    rows.push({
      sku: saMatch?.sku ?? "SPECIFY", quantity: 2,
      role: pick(locale, { sv: "Hydraulisk stötdämpare", en: "Hydraulic shock absorber", de: "Hydraulischer Stoßdämpfer", es: "Amortiguador hidráulico" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK vid slaghastighet >1 m/s — förhindrar skador på cylinderände och maskinkonstruktion. Välj justerbar hydraulisk stötdämpare dimensionerad för cylinderkraft och massa.",
        en: "MANDATORY at stroke speed >1 m/s — prevents end-stop damage to cylinder and machine frame. Select adjustable hydraulic shock absorber sized for cylinder force and mass.",
        de: "ZWINGEND ERFORDERLICH bei einer Hubgeschwindigkeit >1 m/s — verhindert Endlagenschäden am Zylinder und am Maschinenrahmen. Einstellbaren hydraulischen Stoßdämpfer wählen, dimensioniert für Zylinderkraft und Masse.",
        es: "OBLIGATORIO a velocidad de carrera >1 m/s — evita daños en el tope final del cilindro y en la estructura de la máquina. Seleccione un amortiguador hidráulico ajustable dimensionado para la fuerza y la masa del cilindro.",
      }),
    });
  }

  // ── 7. End-position sensors (2 pcs, one per end) ─────────────────
  // Found 2026-08-21 (adversarial test): asking for an ATEX cylinder WITH
  // end-position sensors produced zero sensor row at all - isPneumatic is
  // false for isAtex/isAtexDust (by design, so the block below never fires),
  // and nothing else covers it, so a stated requirement just silently
  // vanished from the BOM. Standard 24V sensors are exactly what the ATEX
  // section's own final warning row already says is forbidden, and the
  // catalog has no ATEX-rated sensor to substitute (checked - none of the
  // "sensor" rows carry any Ex-relevant certification data), so SPECIFY is
  // the honest answer, same pattern as the other ATEX-only rows below.
  if (isEndPosDetect && (isAtex || isAtexDust)) {
    rows.push({
      sku: "SPECIFY", quantity: 2,
      role: pick(locale, { sv: "ATEX-ändlägesgivare (zon-certifierad)", en: "ATEX end-position sensor (zone-certified)", de: "ATEX-Endlagensensor (zonzertifiziert)", es: "Sensor de fin de carrera ATEX (certificado para la zona)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK — 2 st ATEX/IECEx-certifierade lägesgivare (en per ändläge) krävs för PLC-feedback. Standard 24V-givare är EJ tillåtna i zonen; vi har ingen zon-certifierad givare i lager, begär offert.",
        en: "MANDATORY — 2 ATEX/IECEx-certified position sensors (one per end position) required for PLC feedback. Standard 24 V sensors are NOT permitted in the zone; we don't stock a zone-certified sensor, request a quote.",
        de: "ZWINGEND ERFORDERLICH — 2 ATEX/IECEx-zertifizierte Positionssensoren (einer je Endlage) für die SPS-Rückmeldung erforderlich. Standard-24-V-Sensoren sind in der Zone NICHT zulässig; wir führen keinen zonenzertifizierten Sensor, bitte Angebot anfordern.",
        es: "OBLIGATORIO — se requieren 2 sensores de posición certificados ATEX/IECEx (uno por posición final) para la retroalimentación al PLC. Los sensores estándar de 24 V NO están permitidos en la zona; no tenemos en stock un sensor certificado para la zona, solicite una oferta.",
      }),
    });
  } else if (isEndPosDetect && isPneumatic) {
    // Found 2026-08-21 (adversarial test): this used plain `products` — the
    // catalog has both T-slot AND C-slot sensors (e.g. SMC-D-A72H is C-slot,
    // SMC-D-A73/D-A93 are T-slot; Festo's SIES/SIET/SMT lines are all T-slot)
    // and neither groove type is universal across brands. A real test with an
    // SMC-CQ2 primary actuator got FE-SIES-8M — a Festo sensor — recommended,
    // with zero brand or groove-type check at all. There's no groove-type spec
    // on the cylinder to match exactly, so brand is the strongest signal we
    // have: manufacturers design their sensor lines for their own cylinders'
    // grooves, so a same-brand pairing is far more likely to physically fit
    // than a cross-brand one. brandSorted already exists (same pattern used
    // for servo-motor/servo-drive above) — just wasn't being used here.
    const sensorMatch = findCatalogProductByType("sensor", brandSorted);
    rows.push({
      sku: sensorMatch?.sku ?? "SPECIFY", quantity: 2,
      role: pick(locale, { sv: "Ändlägesgivare (hemläge + utsträckt läge)", en: "End-position sensor (home + extended)", de: "Endlagensensor (Grundstellung + ausgefahren)", es: "Sensor de fin de carrera (posición inicial + extendida)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK — 2 st magnetgivare (en per ändläge) krävs för PLC-feedback. Välj givare som passar cylinderns givarspår (T-spår eller C-spår, beroende på fabrikat) samt styrsystem (24 V DC NPN/PNP).",
        en: "MANDATORY — 2 magnetic sensors (one per end position) required for PLC feedback. Select a sensor matching the cylinder's sensor groove (T-slot or C-slot, depending on brand) and control voltage (24 V DC NPN/PNP).",
        de: "ZWINGEND ERFORDERLICH — 2 Magnetsensoren (einer je Endlage) für die SPS-Rückmeldung erforderlich. Sensor passend zur Sensornut des Zylinders (T-Nut oder C-Nut, je nach Hersteller) und zur Steuerspannung wählen (24 V DC NPN/PNP).",
        es: "OBLIGATORIO — se requieren 2 sensores magnéticos (uno por posición final) para la retroalimentación al PLC. Seleccione un sensor compatible con la ranura del cilindro (ranura en T o en C, según el fabricante) y la tensión de control (24 V CC NPN/PNP).",
      }) + (isWashdown
        // Found 2026-08-21: the catalog does not currently stock an IP69K-rated
        // cylinder position sensor at all (checked every "sensor" row's
        // ip_rating - none reach it), so a washdown/food-grade job always gets
        // a standard-rated sensor here with no better option to substitute.
        // Rather than presenting that pick as an unqualified "MANDATORY" match
        // the way every other row does, say so plainly.
        ? pick(locale, {
            sv: " ⚠️ Vi har ingen IP69K-klassad ändlägesgivare i lager — vald givare kan behöva bytas mot en washdown-tålig variant, begär offert.",
            en: " ⚠️ We don't stock an IP69K-rated end-position sensor — the selected one may need swapping for a washdown-rated variant, request a quote.",
            de: " ⚠️ Wir führen keinen IP69K-klassifizierten Endlagensensor — der ausgewählte Sensor muss ggf. gegen eine waschdown-taugliche Variante ausgetauscht werden, bitte Angebot anfordern.",
            es: " ⚠️ No tenemos en stock un sensor de fin de carrera con clasificación IP69K — puede que el seleccionado deba sustituirse por una variante apta para washdown, solicite una oferta.",
          })
        : ""),
    });
  }

  // ── 8. Push-in fitting (all pneumatic) ───────────────────────────
  if (isPneumatic) {
    const fittingMatch = findCatalogProductByType("fitting", products);
    if (fittingMatch) {
      rows.push({
        sku: fittingMatch.sku, quantity: 4,
        role: pick(locale, { sv: "Snabbkoppling (push-in fitting)", en: "Push-in fitting", de: "Steckverschraubung (Push-in-Fitting)", es: "Racor instantáneo (push-in)" }),
        reason: pick(locale, {
          sv: "Ansluter cylinder och ventil till luftslang — välj diameter (6/8/10 mm) för rätt slanganslutning till cylinderns G-port.",
          en: "Connects cylinder and valve to air tubing — select diameter (6/8/10 mm) matching cylinder G-port.",
          de: "Verbindet Zylinder und Ventil mit dem Luftschlauch — Durchmesser (6/8/10 mm) passend zum G-Anschluss des Zylinders wählen.",
          es: "Conecta el cilindro y la válvula al tubo de aire — seleccione el diámetro (6/8/10 mm) adecuado para el puerto G del cilindro.",
        }),
      });
    }
  }

  // ── 8b. Tubing (all pneumatic) ───────────────────────────────────
  if (isPneumatic) {
    const tubeMatch = findCatalogProductByType("tubing", products);
    if (tubeMatch) {
      rows.push({
        sku: tubeMatch.sku, quantity: 1,
        role: pick(locale, { sv: "Tryckluftsslang (per meter)", en: "Pneumatic tubing (per metre)", de: "Druckluftschlauch (pro Meter)", es: "Tubo neumático (por metro)" }),
        reason: pick(locale, {
          sv: "Förbinder ventil, FRL och cylinder — välj ytterdiameter (6/8/10 mm) och längd efter installationen. Anges per meter.",
          en: "Connects valve, FRL and cylinder — select outer diameter (6/8/10 mm) and length per the installation. Sold per metre.",
          de: "Verbindet Ventil, FRL-Einheit und Zylinder — Außendurchmesser (6/8/10 mm) und Länge passend zur Installation wählen. Wird pro Meter angegeben.",
          es: "Conecta la válvula, la unidad FRL y el cilindro — seleccione el diámetro exterior (6/8/10 mm) y la longitud según la instalación. Se indica por metro.",
        }),
      });
    }
  }

  // ── 9. Motor cable (electric) ─────────────────────────────────────
  if (isElectric) {
    const cableMatch = findCatalogProductByType("cable", products);
    if (cableMatch) {
      rows.push({
        sku: cableMatch.sku, quantity: 1,
        role: pick(locale, { sv: "Motorkabel", en: "Motor cable", de: "Motorkabel", es: "Cable de motor" }),
        reason: pick(locale, {
          sv: "Anslutningskabel till drivenheten — välj längd och kontakttyp kompatibel med vald motor och drivare.",
          en: "Connection cable to the drive — select length and connector type compatible with the chosen motor and drive.",
          de: "Anschlusskabel zum Antrieb — Länge und Steckertyp passend zum gewählten Motor und Antrieb wählen.",
          es: "Cable de conexión al accionamiento — seleccione la longitud y el tipo de conector compatibles con el motor y el accionamiento elegidos.",
        }),
      });
    }
  }

  // ── 10. Mounting (when requested) — must MATCH the primary's bore ─────────
  // A mounting whose bore differs from the cylinder physically does not fit. We
  // only emit a real SKU when its bore equals the primary's; otherwise SPECIFY
  // with the required Ø called out (recommend, never force a mismatched part).
  if (isMounting || isArticulated) {
    const primary = products.find(p => p.sku === primarySku);
    const pBore = primaryBoreMm ||
                  firstNumAbs(primary?.key_specs?.bore_mm) ||
                  firstNumAbs((primary?.name ?? "").match(/Ø\s?(\d+)/)?.[1]);
    const boreTxt = pBore > 0 ? `Ø${pBore}` : pick(locale, { sv: "cylinderns borrning", en: "the cylinder's bore", de: "die Zylinderbohrung", es: "el diámetro del cilindro" });
    const mounts = products.filter(p =>
      p.category === "mounting" ||
      /fotfäste|foot.?mount|flansfäste|flänsfäste|flange|monteringsfäste|bracket|trunnion|svängfläns|gaffel|clevis|swivel|ledlager/i.test(`${p.name} ${p.sku}`));
    const mountBore = (p: CatalogProduct) =>
      firstNumAbs(p.key_specs?.bore_mm) || firstNumAbs(p.name.match(/Ø\s?(\d+)/)?.[1]);
    const boreOk = (p: CatalogProduct) => pBore > 0 && mountBore(p) === pBore;

    if (isArticulated) {
      // Angled push: rear pivot + rod clevis, both bore-matched.
      const swivel = mounts.find(p => boreOk(p) && /svängfläns|swivel|pivå|trunnion|ledlager/i.test(p.name));
      const clevis = mounts.find(p => boreOk(p) && /gaffel|clevis/i.test(p.name));
      rows.push({
        sku: swivel?.sku ?? "SPECIFY", quantity: 1,
        role: pick(locale, { sv: "Svängfläns/ledlager (bakgavel)", en: "Rear swivel/pivot flange", de: "Schwenkflansch/Gelenklager (Hinterseite)", es: "Brida giratoria/rótula (parte trasera)" }),
        reason: swivel
          ? pick(locale, {
              sv: `${swivel.name} — matchar cylinderns borrning (${boreTxt}). Tillåter cylindern att vinkla sig under slaget; ISO 15552-fäste.`,
              en: `${swivel.name} — matches the cylinder bore (${boreTxt}). Lets the cylinder pivot during the stroke; ISO 15552 mount.`,
              de: `${swivel.name} — passt zur Zylinderbohrung (${boreTxt}). Ermöglicht dem Zylinder, sich während des Hubs zu neigen; ISO-15552-Befestigung.`,
              es: `${swivel.name} — coincide con el diámetro del cilindro (${boreTxt}). Permite que el cilindro se incline durante la carrera; fijación ISO 15552.`,
            })
          : pick(locale, {
              sv: `Ange svängfläns/ledlager i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; fästet MÅSTE matcha cylinderns borrning.`,
              en: `Specify a rear swivel/pivot flange in ${boreTxt} — no ${boreTxt} variant in stock; the mount MUST match the cylinder bore.`,
              de: `Schwenkflansch/Gelenklager in ${boreTxt} angeben — die ${boreTxt}-Variante ist nicht auf Lager; die Befestigung MUSS zur Zylinderbohrung passen.`,
              es: `Indique una brida giratoria/rótula en ${boreTxt} — no hay variante ${boreTxt} en stock; la fijación DEBE coincidir con el diámetro del cilindro.`,
            }),
      });
      rows.push({
        sku: clevis?.sku ?? "SPECIFY", quantity: 1,
        role: pick(locale, { sv: "Gaffelfäste (kolvstångsände)", en: "Rod clevis (rod end)", de: "Gabelkopf (Kolbenstangenende)", es: "Horquilla (extremo del vástago)" }),
        reason: clevis
          ? pick(locale, {
              sv: `${clevis.name} — matchar kolvstångsgängan för ${boreTxt}-cylindern. Bildar ledad infästning tillsammans med svängflänsen.`,
              en: `${clevis.name} — matches the rod thread of the ${boreTxt} cylinder. Forms the articulated linkage together with the swivel flange.`,
              de: `${clevis.name} — passt zum Kolbenstangengewinde des ${boreTxt}-Zylinders. Bildet zusammen mit dem Schwenkflansch die gelenkige Verbindung.`,
              es: `${clevis.name} — coincide con la rosca del vástago del cilindro ${boreTxt}. Forma la unión articulada junto con la brida giratoria.`,
            })
          : pick(locale, {
              sv: `Ange gaffelfäste i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; gaffeln MÅSTE matcha kolvstångsgängan.`,
              en: `Specify a rod clevis in ${boreTxt} — no ${boreTxt} variant in stock; the clevis MUST match the rod thread.`,
              de: `Gabelkopf in ${boreTxt} angeben — die ${boreTxt}-Variante ist nicht auf Lager; der Gabelkopf MUSS zum Kolbenstangengewinde passen.`,
              es: `Indique una horquilla en ${boreTxt} — no hay variante ${boreTxt} en stock; la horquilla DEBE coincidir con la rosca del vástago.`,
            }),
      });
    } else {
      // A foot/flange request must never fall back to a different mounting TYPE —
      // a bore-matched rod clevis is still the wrong part (conveyor-stopper test
      // emitted HNC-40 gaffelkoppling as "fotfäste"). Only foot/flange-style mounts
      // qualify; if the bore variant is missing, SPECIFY (with the Ø called out).
      const footish = mounts.filter(p => !/gaffel|clevis|svängfläns|swivel|pivå|trunnion|ledlager/i.test(p.name));
      const mount = footish.find(p => boreOk(p) && /fotfäste|foot/i.test(p.name)) ?? footish.find(boreOk) ?? null;
      rows.push({
        sku: mount?.sku ?? "SPECIFY", quantity: 1,
        role: pick(locale, { sv: "Monteringsfäste (fotfäste/flänsfäste)", en: "Mounting bracket (foot/flange mount)", de: "Befestigungswinkel (Fuß-/Flanschbefestigung)", es: "Soporte de montaje (pie/brida)" }),
        reason: mount
          ? pick(locale, {
              sv: `${mount.name} — matchar cylinderns borrning (${boreTxt}). Kontrollera hålavstånd mot ritning.`,
              en: `${mount.name} — matches the cylinder bore (${boreTxt}). Verify hole pattern against drawing.`,
              de: `${mount.name} — passt zur Zylinderbohrung (${boreTxt}). Lochbild anhand der Zeichnung prüfen.`,
              es: `${mount.name} — coincide con el diámetro del cilindro (${boreTxt}). Verifique el patrón de orificios según el plano.`,
            })
          : pick(locale, {
              sv: `Ange fotfäste/flänsfäste i ${boreTxt} — vi saknar ${boreTxt}-varianten i lager; fästet MÅSTE matcha cylinderns borrning och serie.`,
              en: `Specify a foot/flange mount in ${boreTxt} — no ${boreTxt} variant in stock; the mount MUST match the cylinder bore and series.`,
              de: `Fuß-/Flanschbefestigung in ${boreTxt} angeben — die ${boreTxt}-Variante ist nicht auf Lager; die Befestigung MUSS zu Bohrung und Serie des Zylinders passen.`,
              es: `Indique un soporte de pie/brida en ${boreTxt} — no hay variante ${boreTxt} en stock; el soporte DEBE coincidir con el diámetro y la serie del cilindro.`,
            }),
      });
    }
  }

  // ── 11. Multi-axis secondary actuators ───────────────────────────
  if (isMultiAxis && perAxisStrokes.length >= 2) {
    // Secondary = every axis EXCEPT the primary (longest-stroke) one — so the
    // primary axis is never also emitted as a secondary, and labels stay correct.
    const secondaryAxes = perAxisStrokes.filter((_, i) => i !== primaryAxisIdx);
    for (const ax of secondaryAxes) {
      const axLabel = ax.axis.toUpperCase();
      // P0: match a REAL catalog actuator for this axis instead of a placeholder.
      const axMatch = findAxisActuator(brandSorted, ax.stroke, isElectric);
      rows.push({
        sku: axMatch?.sku ?? "SPECIFY", quantity: 1,
        role: pick(locale, { sv: `Aktuator — ${axLabel}-axel`, en: `Actuator — ${axLabel}-axis`, de: `Aktuator — ${axLabel}-Achse`, es: `Actuador — eje ${axLabel}` }),
        reason: axMatch
          ? pick(locale, {
              sv: `${ax.stroke > 0 ? ax.stroke + " mm slag — " : ""}${axMatch.name} (${axMatch.brand}). Samma drivtyp/spänning som primäraxeln; konfigurera slaglängd och fäste för ${axLabel}-axeln.`,
              en: `${ax.stroke > 0 ? ax.stroke + " mm stroke — " : ""}${axMatch.name} (${axMatch.brand}). Same drive type/voltage as the primary axis; configure stroke and mounting for the ${axLabel}-axis.`,
              de: `${ax.stroke > 0 ? ax.stroke + " mm Hub — " : ""}${axMatch.name} (${axMatch.brand}). Gleicher Antriebstyp/Spannung wie die Primärachse; Hub und Befestigung für die ${axLabel}-Achse konfigurieren.`,
              es: `${ax.stroke > 0 ? ax.stroke + " mm de carrera — " : ""}${axMatch.name} (${axMatch.brand}). Mismo tipo de accionamiento/tensión que el eje primario; configure la carrera y el montaje para el eje ${axLabel}.`,
            })
          : pick(locale, {
              sv: `Ingen exakt katalogmatch för ${axLabel}-axeln (${ax.stroke > 0 ? ax.stroke + " mm" : "okänt slag"}) — begär offert så specar vi rätt ${isElectric ? "elektrisk axel" : "cylinder"} (gissa inte ihop en lösning).`,
              en: `No exact catalog match for the ${axLabel}-axis (${ax.stroke > 0 ? ax.stroke + " mm" : "unknown stroke"}) — request a quote and we'll spec the right ${isElectric ? "electric axis" : "cylinder"} (do not guess a solution).`,
              de: `Keine exakte Katalogübereinstimmung für die ${axLabel}-Achse (${ax.stroke > 0 ? ax.stroke + " mm" : "unbekannter Hub"}) — bitte Angebot anfordern, damit wir ${isElectric ? "die richtige elektrische Achse" : "den richtigen Zylinder"} spezifizieren (keine Lösung erraten).`,
              es: `No hay coincidencia exacta en el catálogo para el eje ${axLabel} (${ax.stroke > 0 ? ax.stroke + " mm" : "carrera desconocida"}) — solicite una oferta y especificaremos ${isElectric ? "el eje eléctrico" : "el cilindro"} correcto (no adivinar una solución).`,
            }),
      });
    }
  }

  // ── 9. Washdown / food-grade IP69K warning ───────────────────────
  if (isWashdown) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ Washdown IP69K — korrosionsbeständigt material", en: "⚠️ Washdown IP69K — corrosion-resistant materials", de: "⚠️ Washdown IP69K — korrosionsbeständiges Material", es: "⚠️ Washdown IP69K — material resistente a la corrosión" }),
      reason: pick(locale, {
        sv: "KRAV IP69K: Cylinder, ventil och givare måste ha IP69K-klassning och korrosionsbeständigt material (316L rostfritt stål eller ytbehandlad aluminium). Specificera variant -H1 (food-grade smörjning) vid livsmedelsproduktion.",
        en: "REQUIRED IP69K: Cylinder, valve and sensor must be IP69K-rated with corrosion-resistant materials (316L stainless or coated aluminium). Specify -H1 variant (food-grade lubrication) for food production.",
        de: "ANFORDERUNG IP69K: Zylinder, Ventil und Sensor müssen IP69K-klassifiziert sein und aus korrosionsbeständigem Material bestehen (316L Edelstahl oder beschichtetes Aluminium). Bei Lebensmittelproduktion die Variante -H1 (lebensmittelechte Schmierung) angeben.",
        es: "REQUISITO IP69K: el cilindro, la válvula y el sensor deben tener clasificación IP69K y material resistente a la corrosión (acero inoxidable 316L o aluminio recubierto). Especifique la variante -H1 (lubricación de grado alimenticio) para producción alimentaria.",
      }),
    });
  }

  // ── 10. High-temperature warning (>80°C) ─────────────────────────
  if (isHighTemp) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ Tätningsmaterial — hög temperatur >80°C", en: "⚠️ Sealing material — high temperature >80°C", de: "⚠️ Dichtungsmaterial — hohe Temperatur >80 °C", es: "⚠️ Material de sellado — alta temperatura >80 °C" }),
      reason: pick(locale, {
        sv: "KRAV: PTFE- eller FKM-tätningar obligatoriska vid >80°C — standard-NBR-tätningar degraderar och läcker. Beställ cylinder med high-temp tätningssats eller PTFE-variant.",
        en: "MANDATORY: PTFE or FKM seals required above 80°C — standard NBR seals degrade and leak. Order cylinder with high-temp seal kit or PTFE variant.",
        de: "ANFORDERUNG: PTFE- oder FKM-Dichtungen oberhalb von 80 °C zwingend erforderlich — Standard-NBR-Dichtungen verschleißen und lecken. Zylinder mit Hochtemperatur-Dichtungssatz oder PTFE-Variante bestellen.",
        es: "REQUISITO: juntas de PTFE o FKM obligatorias por encima de 80 °C — las juntas NBR estándar se degradan y presentan fugas. Pida el cilindro con kit de juntas de alta temperatura o variante PTFE.",
      }),
    });
  }

  // ── 10. SIL/functional-safety certified valve ─────────────────────
  if (isSilSafety) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ Säkerhetscertifierad magnetventil SIL/PLd", en: "⚠️ Safety-certified solenoid valve SIL/PLd", de: "⚠️ Sicherheitszertifiziertes Magnetventil SIL/PLd", es: "⚠️ Electroválvula certificada de seguridad SIL/PLd" }),
      reason: pick(locale, {
        sv: "KRAV SIL 2 / PLd (ISO 13849): säkerhetscertifierad magnetventil med redundant styrsignal och diagnosfunktion krävs (t.ex. Festo VOFD-DT, SMC VFS). Standard-ventil är EJ tillräcklig.",
        en: "REQUIRED SIL 2 / PLd (ISO 13849): safety-certified solenoid valve with redundant control and diagnostic function (e.g. Festo VOFD-DT, SMC VFS). Standard valve is NOT sufficient.",
        de: "ERFORDERLICH SIL 2 / PLd (ISO 13849): sicherheitszertifiziertes Magnetventil mit redundantem Steuersignal und Diagnosefunktion erforderlich (z. B. Festo VOFD-DT, SMC VFS). Ein Standardventil ist NICHT ausreichend.",
        es: "REQUERIDO SIL 2 / PLd (ISO 13849): se requiere una electroválvula certificada de seguridad con señal de control redundante y función de diagnóstico (p. ej. Festo VOFD-DT, SMC VFS). Una válvula estándar NO es suficiente.",
      }),
    });
  }

  // ── 11. Hydraulic / very-high-force out-of-scope warning ──────────
  if (isHydraulic || isVeryHighForce) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ Varning: utanför pneumatisk katalog", en: "⚠️ Warning: outside pneumatic catalog", de: "⚠️ Warnung: außerhalb des pneumatischen Katalogs", es: "⚠️ Aviso: fuera del catálogo neumático" }),
      reason: pick(locale, {
        sv: "UTANFÖR KATALOG: Hydrauliska cylindrar och kraft >5 kN hanteras ej av pneumatisk katalog. Kontakta hydraulikspecialist (Parker, Bosch Rexroth, Enerpac). Pneumatisk katalog täcker max ~2 kN vid 6 bar.",
        en: "OUT OF SCOPE: Hydraulic cylinders and force >5 kN are outside the pneumatic catalog. Contact hydraulic specialist (Parker, Bosch Rexroth, Enerpac). Pneumatic catalog covers max ~2 kN at 6 bar.",
        de: "AUSSERHALB DES KATALOGS: Hydraulikzylinder und Kräfte >5 kN werden vom pneumatischen Katalog nicht abgedeckt. Hydraulikspezialisten kontaktieren (Parker, Bosch Rexroth, Enerpac). Der pneumatische Katalog deckt max. ~2 kN bei 6 bar ab.",
        es: "FUERA DE CATÁLOGO: los cilindros hidráulicos y fuerzas >5 kN quedan fuera del catálogo neumático. Contacte con un especialista en hidráulica (Parker, Bosch Rexroth, Enerpac). El catálogo neumático cubre un máximo de ~2 kN a 6 bar.",
      }),
    });
  }

  // ── 12. ATEX completeness: an ATEX pneumatic system still needs a control
  // valve and air prep — but they must be ATEX-certified, so they are emitted
  // as SPECIFY (catalog valves/FRL are NOT zone-rated). Without this an ATEX
  // query returned only the bare primary actuator. Skip if electric (electric
  // is forbidden in ATEX and handled elsewhere) or if no primary is pneumatic.
  if ((isAtex || isAtexDust) && !isElectric) {
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "ATEX-magnetventil (zon-certifierad)", en: "ATEX solenoid valve (zone-certified)", de: "ATEX-Magnetventil (zonzertifiziert)", es: "Electroválvula ATEX (certificada para la zona)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK styrventil för ATEX-zon — använd ATEX/IECEx-certifierad ventil (t.ex. Festo VOFC/tryckluftsstyrd) eller montera standardventil UTANFÖR zonen och dra slang in. Standardkatalogventiler är EJ zon-godkända.",
        en: "MANDATORY control valve for ATEX zone — use an ATEX/IECEx-certified valve (e.g. Festo VOFC / air-piloted) or mount a standard valve OUTSIDE the zone with tubing in. Standard catalog valves are NOT zone-rated.",
        de: "ZWINGEND ERFORDERLICHES Steuerventil für die ATEX-Zone — ein ATEX/IECEx-zertifiziertes Ventil verwenden (z. B. Festo VOFC/luftpilotiert) oder ein Standardventil AUSSERHALB der Zone montieren und die Leitung hineinführen. Standard-Katalogventile sind NICHT zonenzertifiziert.",
        es: "Válvula de control OBLIGATORIA para zona ATEX — utilice una válvula certificada ATEX/IECEx (p. ej. Festo VOFC/pilotada por aire) o monte una válvula estándar FUERA de la zona con el tubo hacia el interior. Las válvulas estándar del catálogo NO están certificadas para la zona.",
      }),
    });
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "ATEX-luftberedning (FRL utanför zon)", en: "ATEX air preparation (FRL outside zone)", de: "ATEX-Luftaufbereitung (FRL außerhalb der Zone)", es: "Tratamiento de aire ATEX (FRL fuera de la zona)" }),
      reason: pick(locale, {
        sv: "OBLIGATORISK luftberedning — placera FRL-enheten utanför den klassade zonen. Använd antistatisk slang och jordning av cylinder/rör per EN 80079-36.",
        en: "MANDATORY air preparation — locate the FRL outside the classified zone. Use antistatic tubing and ground the cylinder/piping per EN 80079-36.",
        de: "ZWINGEND ERFORDERLICHE Luftaufbereitung — die FRL-Einheit außerhalb der klassifizierten Zone platzieren. Antistatische Schläuche verwenden und Zylinder/Rohrleitung gemäß EN 80079-36 erden.",
        es: "Tratamiento de aire OBLIGATORIO — coloque la unidad FRL fuera de la zona clasificada. Utilice tubos antiestáticos y conecte a tierra el cilindro/tubería según EN 80079-36.",
      }),
    });
    // Vertical ATEX still needs an anti-drop device. It can't be electric (forbidden
    // in the zone) and the standard check-valve row is gated on isPneumatic (which
    // excludes ATEX), so add an explicit ATEX-rated load-holding row here.
    if (isVerticalLoad) {
      rows.push({
        sku: "SPECIFY", quantity: 1,
        role: pick(locale, { sv: "ATEX-fallspärr (pilotbackventil / mekanisk stångbroms)", en: "ATEX anti-drop (pilot check valve / mechanical rod lock)", de: "ATEX-Fallsicherung (pilotgesteuertes Rückschlagventil / mechanische Kolbenstangenbremse)", es: "Antirretorno ATEX (válvula antirretorno pilotada / bloqueo mecánico de vástago)" }),
        reason: pick(locale, {
          sv: "OBLIGATORISK vid vertikal last i ATEX-zon — förhindrar lastfall vid lufttrycksförlust. Använd ATEX/IECEx-klassad pilotmanövrerad backslagsventil eller mekanisk stångbroms. Elektrisk bromsmotor är EJ tillåten i zonen.",
          en: "MANDATORY for vertical load in an ATEX zone — prevents load drop on air loss. Use an ATEX/IECEx-rated pilot-operated check valve or mechanical rod lock. An electric brake motor is NOT permitted in the zone.",
          de: "ZWINGEND ERFORDERLICH bei vertikaler Last in der ATEX-Zone — verhindert ein Absinken der Last bei Luftverlust. ATEX/IECEx-zertifiziertes pilotgesteuertes Rückschlagventil oder mechanische Kolbenstangenbremse verwenden. Ein elektrischer Bremsmotor ist in der Zone NICHT zulässig.",
          es: "OBLIGATORIO para carga vertical en zona ATEX — evita la caída de la carga ante pérdida de aire. Utilice una válvula antirretorno pilotada certificada ATEX/IECEx o un bloqueo mecánico de vástago. Un motor con freno eléctrico NO está permitido en la zona.",
        }),
      });
    }
    rows.push({
      sku: "SPECIFY", quantity: 1,
      role: pick(locale, { sv: "⚠️ ATEX: alla komponenter zon-certifierade + jordade", en: "⚠️ ATEX: all components zone-certified + grounded", de: "⚠️ ATEX: alle Komponenten zonenzertifiziert + geerdet", es: "⚠️ ATEX: todos los componentes certificados para la zona + conectados a tierra" }),
      reason: pick(locale, {
        sv: "KRAV ATEX/IECEx: cylinder, givare, ventil och tillbehör måste vara märkta för aktuell zon/gasgrupp/temperaturklass. Inga standard-24V-givare utan ATEX-godkännande. Verifiera ekvipotential jordning och dokumentera enligt direktiv 2014/34/EU.",
        en: "ATEX/IECEx REQUIREMENT: cylinder, sensors, valve and accessories must be marked for the zone/gas group/temperature class. No standard 24 V sensors without ATEX approval. Verify equipotential grounding and document per Directive 2014/34/EU.",
        de: "ATEX/IECEx-ANFORDERUNG: Zylinder, Sensoren, Ventil und Zubehör müssen für die jeweilige Zone/Gasgruppe/Temperaturklasse gekennzeichnet sein. Keine Standard-24-V-Sensoren ohne ATEX-Zulassung. Potentialausgleichserdung prüfen und gemäß Richtlinie 2014/34/EU dokumentieren.",
        es: "REQUISITO ATEX/IECEx: el cilindro, los sensores, la válvula y los accesorios deben estar marcados para la zona/grupo de gas/clase de temperatura correspondiente. Ningún sensor estándar de 24 V sin homologación ATEX. Verifique la conexión equipotencial a tierra y documente conforme a la Directiva 2014/34/UE.",
      }),
    });
  }

  return rows;
}

export function firstNumAbs(v: unknown): number {
  const m = String(v ?? "").match(/-?\d+(?:[.,]\d+)?/);
  return m ? Math.abs(parseFloat(m[0].replace(",", "."))) : 0;
}

export function gripperForceN(s: Record<string, unknown>): number {
  if (s.clamping_force != null) return firstNumAbs(s.clamping_force);
  if (s.grip_force_kgf != null) return firstNumAbs(s.grip_force_kgf) * 9.81;
  if (s.gripping_force_N != null) return firstNumAbs(s.gripping_force_N);
  if (s.gripping_force_closing_N != null) return firstNumAbs(s.gripping_force_closing_N);
  if (s.max_jaw_force_Fz != null) return firstNumAbs(s.max_jaw_force_Fz);
  return 0;
}

export function gripperTypeOf(p: CatalogProduct): "parallel" | "angular" | "radial" {
  const blob = `${p.key_specs?.gripper_type ?? ""} ${p.key_specs?.type ?? ""} ${p.name}`.toLowerCase();
  if (/radial|3-?jaw|three-?jaw|self-?center|tre-?back|treback|centrer/.test(blob)) return "radial";
  if (/angle|angular|hinged|vinkel/.test(blob)) return "angular";
  return "parallel";
}

export const isGripperFamily = (p: CatalogProduct) => /,/.test(String(p.key_specs?.sizes ?? ""));
