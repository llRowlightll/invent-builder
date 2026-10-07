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
  // Kategorier som bara fanns i databasen, med svenskt namn på alla språk.
  "tubing": {
    sv: "Slang/Rör",
    en: "Tubing",
    de: "Schläuche",
    es: "Tubos",
  },
  "flow-control": {
    sv: "Flödesreglering",
    en: "Flow Control",
    de: "Durchflussregelung",
    es: "Control de caudal",
  },
  "frl": {
    sv: "FRL-enhet",
    en: "Air Preparation (FRL)",
    de: "Druckluftaufbereitung",
    es: "Tratamiento de aire (FRL)",
  },
  "mounting": {
    sv: "Fäste/Montering",
    en: "Mounting",
    de: "Befestigung",
    es: "Fijación",
  },
  "silencer": {
    sv: "Ljuddämpare",
    en: "Silencer",
    de: "Schalldämpfer",
    es: "Silenciador",
  },
  "servo-drive": {
    sv: "Servodrivare",
    en: "Servo Drive",
    de: "Servoregler",
    es: "Servoaccionamiento",
  },
  "servo-motor": {
    sv: "Servomotor",
    en: "Servo Motor",
    de: "Servomotor",
    es: "Servomotor",
  },
  "shock-absorber": {
    sv: "Stötdämpare",
    en: "Shock Absorber",
    de: "Stoßdämpfer",
    es: "Amortiguador",
  },
  "check-valve": {
    sv: "Backslagsventil",
    en: "Check Valve",
    de: "Rückschlagventil",
    es: "Válvula antirretorno",
  },
  "cable": {
    sv: "Kabel/Kontakt",
    en: "Cable/Connector",
    de: "Kabel/Steckverbinder",
    es: "Cable/Conector",
  },
  "controller": {
    sv: "Styrsystem",
    en: "Controller",
    de: "Steuerung",
    es: "Controlador",
  },
};

export function categoryName(slug: string, locale: string, fallback?: string): string {
  return CATEGORY_NAMES[slug]?.[locale]
    ?? CATEGORY_NAMES[slug]?.["en"]
    ?? fallback
    ?? slug;
}
