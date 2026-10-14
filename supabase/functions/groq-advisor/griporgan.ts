/**
 * Griporganets alternativ -- gripdon och sugkoppar -- deterministiskt ur
 * katalogen, med kravstatus per artikel.
 *
 * Flyttat ur index.ts 2026-10-14. Där gick logiken inte att importera i ett
 * prov (index.ts startar Deno.serve), och en granskning hittade fel som inget
 * prov nådde: en serie på 6300 N räknades inte med, så texten sa att inget
 * parallellgripdon i katalogen nådde 5000 N; trycket prövades bara när
 * operating_pressure fanns, fast stycklistan också läser max_pressure; och
 * ett gripdon fick "Rätt storlek" i en ATEX-förfrågan utan ATEX-märkning.
 *
 * Kravet delas med stycklistan (griporgansKrav, provaGripkraft), så att ett
 * alternativ och dess rad i stycklistan aldrig säger emot varandra.
 */
import { buildCustomSolutionOption, firstNumAbs, gripperForceMaxN, gripperForceN, gripperTypeOf, isGripperFamily } from "./bom-builder.ts";
import { provaGripkraft, provaTryck, type Kontroll } from "./kontroller.ts";
import { type CatalogProduct, isAtexCapableProduct } from "./scoring.ts";
import { griporgansKrav, onskadGripdonstyp, pick, type HazardFlags } from "./signals.ts";

export interface Griporgansunderlag {
  /** Beskrivning och svar i en text. */
  text: string;
  hazards: HazardFlags;
  loadKg: number;
  locale: string;
  /** Matningstrycket ur kravbilden, bar. 0 när det inte är angivet. */
  tryckKrav: number;
}

export interface Griporgansforslag {
  summary: string;
  options: Array<Record<string, unknown>>;
}

type Utfall = "uppfyllt" | "ej_uppfyllt" | "avvikelse" | "konfigureras" | "kan_inte_bedomas";
export interface Kravstatus { krav: string; utfall: Utfall; text: string }

const somKravstatus = (k: Kontroll): Kravstatus => ({
  krav: k.krav,
  utfall: k.utfall === "underlag_saknas" || k.utfall === "stods_inte" ? "kan_inte_bedomas" : k.utfall,
  text: k.text,
});

/** Flera koppar delar på lasten, men inte hur många som helst. */
export const MAX_KOPPAR = 10;

/**
 * ATEX prövas per artikel. Ett griporgan väljs inte ur en ATEX-filtrerad
 * lista, som en cylinder gör, så utan märkning i katalogen får det inte
 * användas i zonen.
 */
function atexStatus(p: CatalogProduct, h: HazardFlags, sv: boolean): Kravstatus | null {
  if (!(h.isAtex || h.isAtexDust)) return null;
  return isAtexCapableProduct(p)
    ? { krav: "ATEX", utfall: "uppfyllt", text: sv ? "ATEX-märkt enligt katalogen" : "ATEX-marked according to the catalogue" }
    : { krav: "ATEX", utfall: "ej_uppfyllt", text: sv ? "ingen ATEX-märkning i katalogen; får inte användas i zonen utan intyg" : "no ATEX marking in the catalogue; must not be used in the zone without a certificate" };
}

// No end-effector product in the catalog has any ESD/antistatic/conductive
// spec field at all (checked product_specs directly) -- there's no way to
// filter or verify an ESD-safety requirement, so say so explicitly rather
// than silently staying quiet about a stated requirement we can't confirm.
function esdNot(h: HazardFlags, locale: string): string {
  return h.isEsdSafe
    ? pick(locale, {
        sv: " ⚠️ ESD-säkerhet: vi har inga ESD-/antistatiska specifikationer i katalogen för att verifiera detta — begär offert med ESD-krav specificerat.",
        en: " ⚠️ ESD safety: we have no ESD/antistatic specs in the catalog to verify this — request a quote with the ESD requirement specified.",
        de: " ⚠️ ESD-Sicherheit: wir haben keine ESD-/antistatischen Spezifikationen im Katalog, um dies zu verifizieren — Angebot mit angegebener ESD-Anforderung anfordern.",
        es: " ⚠️ Seguridad ESD: no tenemos especificaciones ESD/antiestáticas en el catálogo para verificarlo — solicite una oferta especificando el requisito ESD.",
      })
    : "";
}

function atexNot(h: HazardFlags, locale: string, vad: "gripdon" | "vakuum"): string {
  if (!(h.isAtex || h.isAtexDust)) return "";
  return vad === "gripdon"
    ? pick(locale, {
        sv: " ⚠️ ATEX: gripdonen i katalogen har ingen ATEX-märkning i specifikationerna. Begär offert med zonen angiven.",
        en: " ⚠️ ATEX: the grippers in the catalogue have no ATEX marking in their specifications. Request a quote stating the zone.",
        de: " ⚠️ ATEX: die Greifer im Katalog haben keine ATEX-Kennzeichnung in den Spezifikationen. Angebot mit Angabe der Zone anfordern.",
        es: " ⚠️ ATEX: las pinzas del catálogo no tienen marcado ATEX en sus especificaciones. Solicite una oferta indicando la zona.",
      })
    : pick(locale, {
        sv: " ⚠️ ATEX: sugkopparna och ejektorerna i katalogen har ingen ATEX-märkning i specifikationerna. Begär offert med zonen angiven.",
        en: " ⚠️ ATEX: the suction cups and ejectors in the catalogue have no ATEX marking in their specifications. Request a quote stating the zone.",
        de: " ⚠️ ATEX: die Sauger und Ejektoren im Katalog haben keine ATEX-Kennzeichnung in den Spezifikationen. Angebot mit Angabe der Zone anfordern.",
        es: " ⚠️ ATEX: las ventosas y eyectores del catálogo no tienen marcado ATEX en sus especificaciones. Solicite una oferta indicando la zona.",
      });
}

// Ett lyft i beskrivningen ingår inte i ett griporgans förslag; det sägs ut i
// stället för att försvinna (sajtkritiken 2026-10-14). Sedan granskningen
// samma dag också för sugkoppar, vars stycklista redan stoppade på lyftet.
function lyftetIngarInte(h: HazardFlags, locale: string): string {
  if (!h.isVerticalLoad) return "";
  return h.befintligtLyft
    ? pick(locale, {
        sv: " Lyftet ingår inte i förslaget: kontrollera att det befintliga lyftet och dess fallskydd bär lasten inklusive griporganet.",
        en: " The lift is not part of this proposal: check that the existing lift and its fall protection carry the load including the end effector.",
        de: " Der Hub ist nicht Teil dieses Vorschlags: prüfen, dass der vorhandene Hub samt Absturzsicherung die Last einschließlich Greiforgan trägt.",
        es: " La elevación no forma parte de esta propuesta: compruebe que la elevación existente y su protección contra caídas soportan la carga incluido el efector.",
      })
    : pick(locale, {
        sv: " Lyftet ingår inte i förslaget: den lyftande aktuatorn och dess fallskydd väljs separat, för lasten inklusive griporganet.",
        en: " The lift is not part of this proposal: the lifting actuator and its fall protection are chosen separately, for the load including the end effector.",
        de: " Der Hub ist nicht Teil dieses Vorschlags: der Hubaktuator und seine Absturzsicherung werden separat gewählt, für die Last einschließlich Greiforgan.",
        es: " La elevación no forma parte de esta propuesta: el actuador de elevación y su protección contra caídas se eligen por separado, para la carga incluido el efector.",
      });
}

/** Antalet koppar kunden angett ("4 sugkoppar"), 0 när inget anges. */
export function angivetKoppantal(text: string): number {
  const m = text.match(/(\d+)\s*(?:st\.?\s*)?(?:sugkopp(?:ar)?|koppar|suction\s*cups|cups|saugn[äa]pfe|sauger|ventosas)\b/i);
  const n = m ? parseInt(m[1], 10) : 0;
  return n >= 1 && n <= 100 ? n : 0;
}

// ── Sugkoppar ────────────────────────────────────────────────────────────────

export function byggVakuumalternativ(prods: CatalogProduct[], u: Griporgansunderlag): Griporgansforslag {
  const { hazards, loadKg, locale } = u;
  const sv = locale === "sv";
  const dia = (p: CatalogProduct) => firstNumAbs(p.key_specs?.cup_diameter_mm ?? p.key_specs?.pad_diameter_mm);
  const cups = prods.filter(p => dia(p) > 0).sort((a, b) => dia(a) - dia(b));
  const ejector = prods.find(p => /eject|venturi/i.test(`${p.key_specs?.type ?? ""} ${p.name}`));
  const picks = cups.length <= 3 ? cups : [cups[0], cups[Math.floor(cups.length / 2)], cups[cups.length - 1]];
  // En angiven håll-kraft används som den är, men med känd massa aldrig under
  // vad massan kräver (griporgansKrav).
  const krav = griporgansKrav("vacuum", { gripForceN: hazards.gripForceN, holdingForceN: hazards.holdingForceN, loadKg });
  const reqN = krav.n;
  const antal = angivetKoppantal(u.text);
  // Små koppar ger under 1 N: visas med en decimal i stället för som 0.
  const visa = (n: number) => (n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(".", sv ? "," : "."));
  const kravText = krav.angiven
    ? (sv ? `håll-kraft ${reqN} N` : `holding force ${reqN} N`)
    : (sv ? `håll-kraft ≈ ${reqN} N (vikt × 9,81 × 2)` : `holding force ≈ ${reqN} N (weight × 9.81 × 2)`);

  const options: Array<Record<string, unknown>> = picks.map((p, i) => {
    const d = dia(p);
    const holdN = Math.PI * (d / 2) ** 2 * 0.04; // ≈ -0.6 bar usable
    const mat = p.key_specs?.material ? `Material: ${p.key_specs.material}. ` : "";
    let status: Kravstatus;
    if (!(reqN > 0)) {
      status = { krav: sv ? "håll-kraft" : "holding force", utfall: "kan_inte_bedomas", text: sv ? "varken lastens massa eller håll-kraften är angiven" : "neither the load's mass nor the holding force is stated" };
    } else if (!(holdN > 0)) {
      status = { krav: kravText, utfall: "kan_inte_bedomas", text: sv ? "koppens håll-kraft är inte känd" : "the cup's holding force is unknown" };
    } else if (antal > 0) {
      // Kunden har bestämt antalet: varje kopp ska bära sin del.
      const perKopp = reqN / antal;
      status = {
        krav: kravText, utfall: holdN >= perKopp ? "uppfyllt" : "ej_uppfyllt",
        text: sv
          ? `${antal} koppar à ≈ ${visa(holdN)} N ger ≈ ${visa(holdN * antal)} N${holdN >= perKopp ? "" : `; varje kopp behöver ≈ ${visa(perKopp)} N`} (uppskattning)`
          : `${antal} cups at ≈ ${visa(holdN)} N give ≈ ${visa(holdN * antal)} N${holdN >= perKopp ? "" : `; each cup needs ≈ ${visa(perKopp)} N`} (estimate)`,
      };
    } else if (holdN >= reqN) {
      status = { krav: kravText, utfall: "uppfyllt", text: sv ? `en kopp ger ≈ ${visa(holdN)} N (uppskattning)` : `one cup gives ≈ ${visa(holdN)} N (estimate)` };
    } else {
      // Flera koppar delar på lasten, så en liten kopp är inget underkännande --
      // men 85 koppar är ingen konstruktion (granskningen 2026-10-14).
      const behovs = Math.ceil(reqN / holdN);
      status = behovs <= MAX_KOPPAR
        ? { krav: kravText, utfall: "konfigureras", text: sv ? `en kopp ger ≈ ${visa(holdN)} N; ≈ ${behovs} koppar behövs (uppskattning)` : `one cup gives ≈ ${visa(holdN)} N; ≈ ${behovs} cups are needed (estimate)` }
        : { krav: kravText, utfall: "ej_uppfyllt", text: sv ? `en kopp ger ≈ ${visa(holdN)} N; ≈ ${behovs} koppar skulle behövas, så välj en större kopp (uppskattning)` : `one cup gives ≈ ${visa(holdN)} N; ≈ ${behovs} cups would be needed, so choose a larger cup (estimate)` };
    }
    const kravstatus: Kravstatus[] = [status];
    const atex = atexStatus(p, hazards, sv);
    if (atex) kravstatus.push(atex);
    return {
      sku: p.sku, name: p.name, kravstatus,
      badge: pick(locale, {
        sv: ["Liten kopp", "Mellan", "Stor kopp"], en: ["Small cup", "Medium", "Large cup"],
        de: ["Kleiner Sauger", "Mittel", "Großer Sauger"], es: ["Ventosa pequeña", "Media", "Ventosa grande"],
      })[i] ?? "",
      bore_mm: null, stroke_mm: null, force_n: holdN > 0 ? Math.round(holdN * 10) / 10 : null,
      why: pick(locale, {
        sv: `Sugkopp Ø${d} mm, uppskattad håll-kraft ≈ ${visa(holdN)} N/kopp vid ~-0,6 bar. ${mat}Verifiera mot ytans täthet och säkerhetsfaktor.`,
        en: `Suction cup Ø${d} mm, est. holding force ≈ ${visa(holdN)} N/cup at ~-0.6 bar. ${mat}Verify against surface tightness and safety factor.`,
        de: `Saugnapf Ø${d} mm, geschätzte Haltekraft ≈ ${visa(holdN)} N/Napf bei ~-0,6 bar. ${mat}Gegen Oberflächendichtheit und Sicherheitsfaktor prüfen.`,
        es: `Ventosa Ø${d} mm, fuerza de sujeción estimada ≈ ${visa(holdN)} N/ventosa a ~-0,6 bar. ${mat}Verifique la estanqueidad de la superficie y el factor de seguridad.`,
      }),
      pros: pick(locale, {
        sv: ["Skonsam mot känsliga/plana ytor", "Snabb on/off via ejektor"], en: ["Gentle on delicate/flat surfaces", "Fast on/off via ejector"],
        de: ["Schonend zu empfindlichen/ebenen Oberflächen", "Schnelles Ein-/Ausschalten über Ejektor"], es: ["Suave con superficies delicadas/planas", "Encendido/apagado rápido mediante eyector"],
      }),
      cons: pick(locale, {
        sv: ["Kräver tät, plan yta", "Lägg till ejektor + vakuumvakt"], en: ["Needs a tight, flat surface", "Add an ejector + vacuum switch"],
        de: ["Erfordert eine dichte, ebene Oberfläche", "Ejektor + Vakuumschalter ergänzen"], es: ["Requiere una superficie plana y estanca", "Añadir eyector + presostato de vacío"],
      }),
    };
  });

  const need = krav.angiven
    ? pick(locale, {
        sv: ` Angiven håll-kraft ${reqN} N — fördela på en eller flera koppar.`,
        en: ` Stated holding force ${reqN} N — across one or more cups.`,
        de: ` Angegebene Haltekraft ${reqN} N — verteilt auf einen oder mehrere Saugnäpfe.`,
        es: ` Fuerza de sujeción indicada ${reqN} N — repartidos entre una o más ventosas.`,
      })
    : reqN > 0
    ? pick(locale, {
        sv: ` För ~${loadKg} kg krävs ≈ ${reqN} N håll-kraft (2× säkerhet) — fördela på en eller flera koppar.${krav.angivetN > 0 ? ` Den angivna håll-kraften ${krav.angivetN} N är lägre än så och används inte.` : ""}`,
        en: ` For ~${loadKg} kg you need ≈ ${reqN} N holding force (2× safety) — across one or more cups.${krav.angivetN > 0 ? ` The stated holding force ${krav.angivetN} N is lower and is not used.` : ""}`,
        de: ` Für ~${loadKg} kg werden ≈ ${reqN} N Haltekraft benötigt (2-fache Sicherheit) — verteilt auf einen oder mehrere Saugnäpfe.${krav.angivetN > 0 ? ` Die angegebene Haltekraft ${krav.angivetN} N ist niedriger und wird nicht verwendet.` : ""}`,
        es: ` Para ~${loadKg} kg se necesitan ≈ ${reqN} N de fuerza de sujeción (seguridad 2×) — repartidos entre una o más ventosas.${krav.angivetN > 0 ? ` La fuerza de sujeción indicada de ${krav.angivetN} N es menor y no se usa.` : ""}`,
      })
    : "";
  const ejNote = ejector
    ? pick(locale, {
        sv: ` Lägg till en Venturi-ejektor (t.ex. ${ejector.name}) för att skapa vakuumet.`,
        en: ` Add a Venturi ejector (e.g. ${ejector.name}) to generate the vacuum.`,
        de: ` Einen Venturi-Ejektor (z. B. ${ejector.name}) hinzufügen, um das Vakuum zu erzeugen.`,
        es: ` Añada un eyector Venturi (p. ej. ${ejector.name}) para generar el vacío.`,
      })
    : "";
  const tillagg = `${need}${ejNote}${lyftetIngarInte(hazards, locale)}${esdNot(hazards, locale)}${atexNot(hazards, locale, "vakuum")}`;
  const summary = pick(locale, {
    sv: `Det här är ett vakuumgrepp — välj sugkopp efter håll-kraft (kopparea × vakuum), inte cylinderslag.${tillagg}`,
    en: `This is a vacuum-gripping application — choose the suction cup by holding force (cup area × vacuum), not cylinder stroke.${tillagg}`,
    de: `Dies ist eine Vakuumgreif-Anwendung — den Saugnapf nach Haltekraft (Napffläche × Vakuum) wählen, nicht nach Zylinderhub.${tillagg}`,
    es: `Esta es una aplicación de agarre por vacío — elija la ventosa según la fuerza de sujeción (área de la ventosa × vacío), no según la carrera del cilindro.${tillagg}`,
  });
  if (!options.length) options.push(buildCustomSolutionOption(0, locale, 0, false, hazards) as Record<string, unknown>);
  return { summary, options };
}

// ── Gripdon ──────────────────────────────────────────────────────────────────

interface Bedomt {
  p: CatalogProduct;
  /** Gripkraften artikeln prövas med, N: en serie i sin största storlek. */
  fN: number;
  serie: boolean;
  kravstatus: Kravstatus[];
  /** Gripkraften räcker. */
  kraftRacker: boolean;
  /** Gripkraften räcker och inget annat prövat krav underkänns. */
  helt: boolean;
}

export function byggGripdonsalternativ(prods: CatalogProduct[], u: Griporgansunderlag): Griporgansforslag {
  const { hazards, loadKg, locale, tryckKrav } = u;
  const sv = locale === "sv";
  const wantType = onskadGripdonstyp(u.text);
  const typed = prods.filter(p => gripperTypeOf(p) === wantType);
  const pool = typed.length ? typed : prods;
  // Kravet delas med stycklistan, och en angiven gripkraft används som den är
  // -- se extractGripForceN för felet då "100N" tolkades som en vikt och
  // multiplicerades med 100 igen.
  const krav = griporgansKrav("gripper", { gripForceN: hazards.gripForceN, holdingForceN: hazards.holdingForceN, loadKg });
  const reqN = krav.n;

  // Hittat 2026-10-14 (sajtkritiken): när inget gripdon räckte valdes de tre
  // starkaste, och de fick ändå märkena "Rätt storlek", "Marginal" och
  // "Reserv". Nu prövas varje alternativ mot kravet -- gripkraft, tryck och
  // ATEX -- och räcker inget står kundlösningen först. En serie prövas i sin
  // största storlek: HGPT-B når ≈ 6300 N, och utan den sa texten att inget
  // parallellgripdon nådde 5000 N (granskningen samma dag).
  const bedom = (p: CatalogProduct): Bedomt => {
    const serie = isGripperFamily(p);
    // Avrundat på ett ställe: märket och kravstatusen prövar samma tal (ett
    // gripdon på 99,6 N fick "Räcker inte: 100 av 100 N" bredvid "uppfylls").
    const fN = Math.round(serie ? gripperForceMaxN(p.key_specs ?? {}) : gripperForceN(p.key_specs ?? {}));
    const k = provaGripkraft(krav, fN, sv, serie);
    const kravstatus: Kravstatus[] = [
      serie && k.utfall === "uppfyllt"
        ? { krav: k.krav, utfall: "konfigureras", text: `${k.text}; ${sv ? `välj den storlek som ger minst ${reqN} N` : `choose the size that gives at least ${reqN} N`}` }
        : somKravstatus(k),
    ];
    // Trycket prövas som i stycklistan: operating_pressure, annars max_pressure,
    // annars "kan inte bedömas". Till 2026-10-14 bara när operating_pressure
    // fanns, och ett gripdon "Mer marginal" här blev "uppfylls inte" i
    // stycklistan (granskningen).
    if (tryckKrav > 0) kravstatus.push(somKravstatus(provaTryck(tryckKrav, p.key_specs, sv)));
    const atex = atexStatus(p, hazards, sv);
    if (atex) kravstatus.push(atex);
    const kraftRacker = reqN > 0 && fN >= reqN;
    return { p, fN, serie, kravstatus, kraftRacker, helt: kraftRacker && !kravstatus.some(x => x.utfall === "ej_uppfyllt") };
  };
  const bedomda = pool.map(bedom);
  const medKraft = bedomda.filter(b => b.fN > 0);
  const utanKraft = bedomda.length - medKraft.length;
  const fulla = bedomda.filter(b => b.helt).sort((a, b) => a.fN - b.fN);
  const racker = fulla.length > 0;
  const picks: Bedomt[] = reqN > 0
    ? (racker ? fulla.slice(0, 3) : (medKraft.length ? [...medKraft].sort((a, b) => b.fN - a.fN) : bedomda).slice(0, 3))
    : (medKraft.length ? [...medKraft].sort((a, b) => a.fN - b.fN) : bedomda).slice(0, 3);

  // Storleksmärkena går till enskilda artiklar som håller, i storleksordning.
  // En serie som håller har ingen storlek än: den väljs vid order.
  let enskildIndex = 0;
  const ungefar = krav.angiven ? "" : "≈ ";
  const options: Array<Record<string, unknown>> = picks.map((b) => {
    const p = b.p;
    const jaw = p.key_specs?.jaw_stroke_per_side ?? p.key_specs?.stroke_per_jaw;
    const gt = p.key_specs?.gripper_type ?? pick(locale, { sv: "Gripdon", en: "Gripper", de: "Greifer", es: "Pinza" });
    const badge = b.fN <= 0
      ? pick(locale, { sv: "Gripkraft ej angiven", en: "Grip force not stated", de: "Greifkraft nicht angegeben", es: "Fuerza de agarre no indicada" })
      : reqN <= 0
      ? (b.serie
        ? pick(locale, { sv: `Serie upp till ≈ ${b.fN} N`, en: `Series up to ≈ ${b.fN} N`, de: `Baureihe bis ≈ ${b.fN} N`, es: `Serie hasta ≈ ${b.fN} N` })
        : pick(locale, { sv: `Gripkraft ≈ ${b.fN} N`, en: `Grip force ≈ ${b.fN} N`, de: `Greifkraft ≈ ${b.fN} N`, es: `Fuerza de agarre ≈ ${b.fN} N` }))
      : b.helt && b.serie
      ? pick(locale, { sv: "Välj storlek vid order", en: "Choose size when ordering", de: "Größe bei Bestellung wählen", es: "Elegir tamaño al pedir" })
      : b.helt
      ? (pick(locale, {
          sv: ["Rätt storlek", "Mer marginal", "Mest marginal"], en: ["Right size", "More margin", "Most margin"],
          de: ["Passende Größe", "Mehr Reserve", "Größte Reserve"], es: ["Tamaño adecuado", "Más margen", "Máximo margen"],
        })[enskildIndex++] ?? "")
      : b.kraftRacker
      ? pick(locale, { sv: "Uppfyller inte alla krav", en: "Does not meet every requirement", de: "Erfüllt nicht alle Anforderungen", es: "No cumple todos los requisitos" })
      : pick(locale, {
          sv: `Räcker inte: ${b.fN} av ${ungefar}${reqN} N`, en: `Too weak: ${b.fN} of ${ungefar}${reqN} N`,
          de: `Zu schwach: ${b.fN} von ${ungefar}${reqN} N`, es: `Insuficiente: ${b.fN} de ${ungefar}${reqN} N`,
        });
    const kraftOrd = b.serie
      ? pick(locale, { sv: `, gripkraft upp till ≈ ${b.fN} N i största storleken`, en: `, grip force up to ≈ ${b.fN} N in the largest size`, de: `, Greifkraft bis ≈ ${b.fN} N in der größten Baugröße`, es: `, fuerza de agarre hasta ≈ ${b.fN} N en el tamaño mayor` })
      : pick(locale, { sv: `, gripkraft ≈ ${b.fN} N`, en: `, grip force ≈ ${b.fN} N`, de: `, Greifkraft ≈ ${b.fN} N`, es: `, fuerza de agarre ≈ ${b.fN} N` });
    return {
      sku: p.sku, name: p.name, badge,
      bore_mm: firstNumAbs(p.key_specs?.bore_mm) || null,
      stroke_mm: null,
      force_n: b.fN || null,
      kravstatus: b.kravstatus,
      why: pick(locale, {
        sv: `${gt}${b.fN ? kraftOrd : ""}${jaw ? `, backslag ${jaw} mm/sida` : ""}. Dimensioneras på gripkraft mot detaljens vikt och friktion.`,
        en: `${gt}${b.fN ? kraftOrd : ""}${jaw ? `, jaw stroke ${jaw} mm/side` : ""}. Sized by grip force vs. part weight and friction.`,
        de: `${gt}${b.fN ? kraftOrd : ""}${jaw ? `, Backenhub ${jaw} mm/Seite` : ""}. Dimensionierung nach Greifkraft im Verhältnis zu Gewicht und Reibung des Teils.`,
        es: `${gt}${b.fN ? kraftOrd : ""}${jaw ? `, carrera de mordaza ${jaw} mm/lado` : ""}. Dimensionado según la fuerza de agarre frente al peso y la fricción de la pieza.`,
      }),
      pros: pick(locale, {
        sv: ["Pneumatiskt, enkel styrning", "Lägesgivare för grepp-kontroll"], en: ["Pneumatic, simple control", "Position sensing for grip confirmation"],
        de: ["Pneumatisch, einfache Steuerung", "Positionssensor zur Griffbestätigung"], es: ["Neumático, control sencillo", "Sensor de posición para confirmación de agarre"],
      }),
      cons: pick(locale, {
        sv: ["Verifiera gripkraft mot friktionskoefficient", "Backar/fingrar specas separat"], en: ["Verify grip force vs. friction", "Jaws/fingers specified separately"],
        de: ["Greifkraft gegen Reibungskoeffizient prüfen", "Backen/Finger werden separat spezifiziert"], es: ["Verifique la fuerza de agarre frente al coeficiente de fricción", "Mordazas/dedos se especifican por separado"],
      }),
    };
  });

  // Påståendena gäller den typ som söktes och de artiklar som faktiskt
  // prövades: en radialbegäran med ett starkt parallellgripdon i lager får
  // inte heta "inget i katalogen", och en serie utan kraftuppgift är inte
  // prövad.
  const typNamn = typed.length
    ? (pick(locale, {
        sv: { parallel: "parallellgripdon", angular: "vinkelgripdon", radial: "radialgripdon" },
        en: { parallel: "parallel gripper", angular: "angle gripper", radial: "radial gripper" },
        de: { parallel: "Parallelgreifer", angular: "Winkelgreifer", radial: "Radialgreifer" },
        es: { parallel: "pinza paralela", angular: "pinza angular", radial: "pinza radial" },
      }) as Record<string, string>)[wantType]
    : pick(locale, { sv: "gripdon", en: "gripper", de: "Greifer", es: "pinza" });
  const starkastN = medKraft.length ? Math.max(...medKraft.map(b => b.fN)) : 0;
  const kraftRackerNagon = bedomda.some(b => b.kraftRacker);
  // Når en annan typ kravet? Då är det ett alternativ, inte "ingen artikel".
  const annan = typed.length && reqN > 0
    ? prods.filter(p => gripperTypeOf(p) !== wantType).map(bedom).filter(b => b.helt).sort((a, b) => a.fN - b.fN)[0]
    : undefined;
  let raknarInte = "";
  if (reqN > 0 && !racker) {
    const bas = buildCustomSolutionOption(0, locale, 0, false, hazards);
    const ejProvade = utanKraft > 0
      ? pick(locale, {
          sv: ` ${utanKraft} saknar gripkraft i katalogen och kunde inte prövas.`,
          en: ` ${utanKraft} have no grip force in the catalogue and could not be checked.`,
          de: ` ${utanKraft} haben keine Greifkraft im Katalog und konnten nicht geprüft werden.`,
          es: ` ${utanKraft} no tienen fuerza de agarre en el catálogo y no se pudieron comprobar.`,
        })
      : "";
    const annanText = annan
      ? pick(locale, {
          sv: ` Ett gripdon av en annan typ når kraften: ${annan.p.name} (${annan.p.sku}).`,
          en: ` A gripper of another type reaches the force: ${annan.p.name} (${annan.p.sku}).`,
          de: ` Ein Greifer eines anderen Typs erreicht die Kraft: ${annan.p.name} (${annan.p.sku}).`,
          es: ` Una pinza de otro tipo alcanza la fuerza: ${annan.p.name} (${annan.p.sku}).`,
        })
      : "";
    const greppText = kraftRackerNagon
      ? pick(locale, {
          sv: `Inget ${typNamn} i katalogen uppfyller alla angivna krav; se kravstatus på alternativen.${annanText}`,
          en: `No ${typNamn} in the catalogue meets every stated requirement; see the requirement status of the options.${annanText}`,
          de: `Kein ${typNamn} im Katalog erfüllt alle angegebenen Anforderungen; siehe den Anforderungsstatus der Vorschläge.${annanText}`,
          es: `Ninguna ${typNamn} del catálogo cumple todos los requisitos indicados; vea el estado de requisitos de las opciones.${annanText}`,
        })
      : starkastN > 0
      ? pick(locale, {
          sv: `Inget ${typNamn} i katalogen når ${ungefar}${reqN} N; det starkaste ger ≈ ${starkastN} N.${ejProvade}${annanText} Ett formgrepp, där backarna bär lasten underifrån i stället för att klämma, kräver betydligt mindre kraft.`,
          en: `No ${typNamn} in the catalogue reaches ${ungefar}${reqN} N; the strongest gives ≈ ${starkastN} N.${ejProvade}${annanText} A form-fit grip, where the jaws carry the load from below instead of clamping, needs far less force.`,
          de: `Kein ${typNamn} im Katalog erreicht ${ungefar}${reqN} N; der stärkste liefert ≈ ${starkastN} N.${ejProvade}${annanText} Ein Formschlussgriff, bei dem die Backen die Last von unten tragen statt zu klemmen, braucht deutlich weniger Kraft.`,
          es: `Ninguna ${typNamn} del catálogo alcanza ${ungefar}${reqN} N; la más fuerte da ≈ ${starkastN} N.${ejProvade}${annanText} Un agarre por forma, en el que las mordazas soportan la carga desde abajo en lugar de apretar, necesita mucha menos fuerza.`,
        })
      : pick(locale, {
          sv: `Inget ${typNamn} i katalogen har en angiven gripkraft, så inget kunde prövas mot ${ungefar}${reqN} N.${annanText}`,
          en: `No ${typNamn} in the catalogue has a stated grip force, so none could be checked against ${ungefar}${reqN} N.${annanText}`,
          de: `Kein ${typNamn} im Katalog hat eine angegebene Greifkraft, daher konnte keiner gegen ${ungefar}${reqN} N geprüft werden.${annanText}`,
          es: `Ninguna ${typNamn} del catálogo tiene una fuerza de agarre indicada, así que ninguna se pudo comprobar frente a ${ungefar}${reqN} N.${annanText}`,
        });
    // "ingen_katalogmatchning" visas som "Ingen artikel i katalogen matchar
    // kraven" -- bara sant när inte heller en annan typ når kravet.
    options.unshift({ ...bas, why: [greppText, bas.why].filter(Boolean).join(" "), orsak: annan ? "alternativ" : "ingen_katalogmatchning" });
    raknarInte = pick(locale, {
      sv: ` Inget av förslagen uppfyller kraven, så kundlösningen står först.`,
      en: ` None of the options meets the requirements, so the custom solution comes first.`,
      de: ` Keiner der Vorschläge erfüllt die Anforderungen, daher steht die Kundenlösung an erster Stelle.`,
      es: ` Ninguna de las opciones cumple los requisitos, por eso la solución a medida va primero.`,
    });
  }

  const typeLabels: Record<string, Record<string, string>> = {
    sv: { parallel: "parallellgripdon", angular: "vinkelgripdon", radial: "radial-/3-backsgripdon" },
    en: { parallel: "parallel grippers", angular: "angle grippers", radial: "radial / 3-jaw grippers" },
    de: { parallel: "Parallelgreifer", angular: "Winkelgreifer", radial: "Radial-/3-Backen-Greifer" },
    es: { parallel: "pinzas paralelas", angular: "pinzas angulares", radial: "pinzas radiales/de 3 mordazas" },
  };
  const typeLabel = (typeLabels[locale] ?? typeLabels.en)[wantType];
  const need = krav.angiven
    ? pick(locale, {
        sv: ` Angiven gripkraft ${reqN} N.${krav.tumregelN > reqN ? ` Den är lägre än tumregeln för friktionsgrepp (≈ ${krav.tumregelN} N för ${loadKg} kg) och räcker bara med formgrepp.` : ""}`,
        en: ` Stated grip force ${reqN} N.${krav.tumregelN > reqN ? ` It is below the friction-grip rule of thumb (≈ ${krav.tumregelN} N for ${loadKg} kg) and only suffices with a form-fit grip.` : ""}`,
        de: ` Angegebene Greifkraft ${reqN} N.${krav.tumregelN > reqN ? ` Sie liegt unter der Faustregel für Reibschluss (≈ ${krav.tumregelN} N für ${loadKg} kg) und reicht nur bei Formschluss.` : ""}`,
        es: ` Fuerza de agarre indicada ${reqN} N.${krav.tumregelN > reqN ? ` Está por debajo de la regla práctica para agarre por fricción (≈ ${krav.tumregelN} N para ${loadKg} kg) y solo basta con un agarre por forma.` : ""}`,
      })
    : reqN > 0
    ? pick(locale, {
        sv: ` För ~${loadKg} kg är en rimlig tumregel ≈ ${reqN} N gripkraft (≈ vikt × 100; justera för friktion och acceleration).${krav.angivetN > 0 ? ` Den angivna hållkraften ${krav.angivetN} N är lägre än så och används inte.` : ""}`,
        en: ` For ~${loadKg} kg a reasonable rule of thumb is ≈ ${reqN} N grip force (≈ weight × 100; adjust for friction and acceleration).${krav.angivetN > 0 ? ` The stated holding force ${krav.angivetN} N is lower and is not used.` : ""}`,
        de: ` Für ~${loadKg} kg ist eine brauchbare Faustregel ≈ ${reqN} N Greifkraft (≈ Gewicht × 100; anpassen für Reibung und Beschleunigung).${krav.angivetN > 0 ? ` Die angegebene Haltekraft ${krav.angivetN} N ist niedriger und wird nicht verwendet.` : ""}`,
        es: ` Para ~${loadKg} kg, una regla práctica razonable es ≈ ${reqN} N de fuerza de agarre (≈ peso × 100; ajustar según fricción y aceleración).${krav.angivetN > 0 ? ` La fuerza de sujeción indicada de ${krav.angivetN} N es menor y no se usa.` : ""}`,
      })
    : pick(locale, {
        sv: " Varken lastens massa eller gripkraften är angiven, så gripdonen kan inte prövas mot något krav.",
        en: " Neither the load's mass nor the grip force is stated, so the grippers cannot be checked against any requirement.",
        de: " Weder die Masse der Last noch die Greifkraft ist angegeben, daher können die Greifer gegen keine Anforderung geprüft werden.",
        es: " No se indica ni la masa de la carga ni la fuerza de agarre, así que las pinzas no se pueden comprobar frente a ningún requisito.",
      });
  const tillagg = `${need}`;
  const summary = pick(locale, {
    sv: `Det här är en gripapplikation — gripdon dimensioneras på gripkraft, inte cylinderslag.${tillagg} Förslagen är ${typeLabel}.`,
    en: `This is a gripping application — grippers are sized by grip force, not cylinder stroke.${tillagg} The options are ${typeLabel}.`,
    de: `Dies ist eine Greifanwendung — Greifer werden nach Greifkraft dimensioniert, nicht nach Zylinderhub.${tillagg} Die Vorschläge sind ${typeLabel}.`,
    es: `Esta es una aplicación de agarre — las pinzas se dimensionan según la fuerza de agarre, no la carrera del cilindro.${tillagg} Las opciones son ${typeLabel}.`,
  }) + `${raknarInte}${lyftetIngarInte(hazards, locale)}${esdNot(hazards, locale)}${atexNot(hazards, locale, "gripdon")}`;
  if (!options.length) options.push(buildCustomSolutionOption(0, locale, 0, false, hazards) as Record<string, unknown>);
  return { summary, options };
}
