/**
 * Translates a category slug to the user's language.
 * Falls back to the DB name if slug is unknown.
 */

const CATEGORY_NAMES: Record<string, Record<string, string>> = {
  "cylinder": {
    sv: "Cylinder",
    en: "Cylinder",
    de: "Zylinder",
    es: "Cilindro",
  },
  "electric-actuator": {
    sv: "Elektrisk aktuator",
    en: "Electric Actuator",
    de: "Elektrischer Aktuator",
    es: "Actuador eléctrico",
  },
  "rotary-actuator": {
    sv: "Roterande aktuator",
    en: "Rotary Actuator",
    de: "Schwenkantrieb",
    es: "Actuador rotativo",
  },
  "rod-lock": {
    sv: "Stångbroms/Låsenhet",
    en: "Rod Lock",
    de: "Kolbenstangenklemmung",
    es: "Bloqueo de vástago",
  },
  "valve": {
    sv: "Ventil",
    en: "Valve",
    de: "Ventil",
    es: "Válvula",
  },
  "valve-terminal": {
    sv: "Ventilö",
    en: "Valve Terminal",
    de: "Ventilinsel",
    es: "Terminal de válvulas",
  },
  "gripper": {
    sv: "Gripdon",
    en: "Gripper",
    de: "Greifer",
    es: "Pinza",
  },
  "vacuum": {
    sv: "Vakuum",
    en: "Vacuum",
    de: "Vakuum",
    es: "Vacío",
  },
  "air-preparation": {
    sv: "Luftbehandling",
    en: "Air Preparation",
    de: "Druckluftaufbereitung",
    es: "Tratamiento de aire",
  },
  "fitting": {
    sv: "Koppling/Anslutning",
    en: "Fitting / Connector",
    de: "Anschluss",
    es: "Racor / Conector",
  },
  "coupling": {
    sv: "Snabbkoppling",
    en: "Quick Coupling",
    de: "Schnellkupplung",
    es: "Acoplamiento rápido",
  },
  "hose": {
    sv: "Slang",
    en: "Hose",
    de: "Schlauch",
    es: "Manguera",
  },
  "linear-module": {
    sv: "Linjärmodul",
    en: "Linear Module",
    de: "Linearmodul",
    es: "Módulo lineal",
  },
  "sensor": {
    sv: "Sensor",
    en: "Sensor",
    de: "Sensor",
    es: "Sensor",
  },
  "speed-controller": {
    sv: "Hastighetsbegränsare",
    en: "Speed Controller",
    de: "Drosselrückschlagventil",
    es: "Regulador de caudal",
  },
  "seal-kit": {
    sv: "Tätningssats",
    en: "Seal Kit",
    de: "Dichtsatz",
    es: "Kit de juntas",
  },
};

export function categoryName(slug: string, locale: string, fallback?: string): string {
  return CATEGORY_NAMES[slug]?.[locale]
    ?? CATEGORY_NAMES[slug]?.["en"]
    ?? fallback
    ?? slug;
}
