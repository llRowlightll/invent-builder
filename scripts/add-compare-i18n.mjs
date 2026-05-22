/**
 * Auto-adds all compare.tsx spec labels to all locale files.
 * Run with: node scripts/add-compare-i18n.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, "..");

// ─── All spec labels → translations ───────────────────────────────────────────
// Format: key → { sv, en, de, es }
const COMPARE_KEYS = {
  // Groups
  "group_logistics":    { sv: "Logistik & tillgänglighet", en: "Logistics & Availability",      de: "Logistik & Verfügbarkeit",       es: "Logística y disponibilidad" },
  "group_dimensions":   { sv: "Dimensioner",               en: "Dimensions",                    de: "Abmessungen",                    es: "Dimensiones" },
  "group_performance":  { sv: "Prestanda & krafter",       en: "Performance & Forces",          de: "Leistung & Kräfte",              es: "Rendimiento y fuerzas" },
  "group_valve":        { sv: "Ventil & pneumatik",        en: "Valve & Pneumatics",            de: "Ventil & Pneumatik",             es: "Válvula y neumática" },
  "group_environment":  { sv: "Miljö & tätning",           en: "Environment & Sealing",         de: "Umgebung & Abdichtung",          es: "Entorno y sellado" },
  "group_construction": { sv: "Konstruktion & material",   en: "Construction & Material",       de: "Konstruktion & Material",        es: "Construcción y material" },
  "group_electrical":   { sv: "El & kommunikation",        en: "Electrical & Communication",    de: "Elektrik & Kommunikation",       es: "Eléctrica y comunicación" },
  // Row labels
  "label_brand":        { sv: "Varumärke",                 en: "Brand",                         de: "Marke",                          es: "Marca" },
  "label_category":     { sv: "Kategori",                  en: "Category",                      de: "Kategorie",                      es: "Categoría" },
  "label_type":         { sv: "Produkttyp",                en: "Product type",                  de: "Produkttyp",                     es: "Tipo de producto" },
  "label_cylinder_type":{ sv: "Cylindertyp",               en: "Cylinder type",                 de: "Zylindertyp",                    es: "Tipo de cilindro" },
  "label_actuator_type":{ sv: "Aktuatortyp",               en: "Actuator type",                 de: "Aktuatortyp",                    es: "Tipo de actuador" },
  "label_gripper_type": { sv: "Grippertyp",                en: "Gripper type",                  de: "Greifertyp",                     es: "Tipo de pinza" },
  "label_series":       { sv: "Serie",                     en: "Series",                        de: "Serie",                          es: "Serie" },
  "label_application":  { sv: "Tillämpning",               en: "Application",                   de: "Anwendung",                      es: "Aplicación" },
  "label_availability": { sv: "Tillgänglighet",            en: "Availability",                  de: "Verfügbarkeit",                  es: "Disponibilidad" },
  "label_in_stock":     { sv: "✓ På lager",                en: "✓ In stock",                    de: "✓ Auf Lager",                    es: "✓ En stock" },
  "label_order":        { sv: "Beställningsvara",          en: "Order item",                    de: "Bestellartikel",                 es: "Bajo pedido" },
  "label_lead_time":    { sv: "Ledtid",                    en: "Lead time",                     de: "Lieferzeit",                     es: "Plazo de entrega" },
  "label_days":         { sv: "dagar",                     en: "days",                          de: "Tage",                           es: "días" },
  "label_weight":       { sv: "Vikt",                      en: "Weight",                        de: "Gewicht",                        es: "Peso" },
  "label_bore":         { sv: "Borrdiameter",              en: "Bore diameter",                 de: "Bohrungsdurchmesser",            es: "Diámetro de émbolo" },
  "label_inner_dia":    { sv: "Innerdiameter",             en: "Inner diameter",                de: "Innendurchmesser",               es: "Diámetro interior" },
  "label_outer_dia":    { sv: "Ytterdiameter",             en: "Outer diameter",                de: "Außendurchmesser",               es: "Diámetro exterior" },
  "label_tube_dia":     { sv: "Rördiameter",               en: "Tube diameter",                 de: "Rohrdurchmesser",                es: "Diámetro del tubo" },
  "label_max_stroke":   { sv: "Max slag",                  en: "Max stroke",                    de: "Max. Hub",                       es: "Carrera máxima" },
  "label_stroke_range": { sv: "Slagområde",                en: "Stroke range",                  de: "Hubbereich",                     es: "Rango de carrera" },
  "label_length":       { sv: "Längd",                     en: "Length",                        de: "Länge",                          es: "Longitud" },
  "label_width":        { sv: "Bredd",                     en: "Width",                         de: "Breite",                         es: "Ancho" },
  "label_height":       { sv: "Höjd",                      en: "Height",                        de: "Höhe",                           es: "Alto" },
  "label_length_m":     { sv: "Längd (m)",                 en: "Length (m)",                    de: "Länge (m)",                      es: "Longitud (m)" },
  "label_body_red":     { sv: "Längdreduktion",            en: "Body length reduction",         de: "Körperlängenreduzierung",        es: "Reducción de longitud" },
  "label_jaw_width":    { sv: "Käftbredd",                 en: "Jaw width",                     de: "Klauenbreite",                   es: "Ancho de mordaza" },
  "label_jaw_stroke":   { sv: "Käftslag/sida",             en: "Jaw stroke/side",               de: "Klauenhub/Seite",                es: "Carrera de mordaza/lado" },
  "label_jaw_angle":    { sv: "Käftöppningsvinkel",        en: "Jaw opening angle",             de: "Klauenöffnungswinkel",           es: "Ángulo de apertura" },
  "label_rot_angle":    { sv: "Rotationsvinkel",           en: "Rotation angle",                de: "Rotationswinkel",                es: "Ángulo de rotación" },
  "label_repeat":       { sv: "Repeterbarhet",             en: "Repeatability",                 de: "Wiederholgenauigkeit",           es: "Repetibilidad" },
  "label_max_pressure": { sv: "Max arbetstryck",           en: "Max operating pressure",        de: "Max. Betriebsdruck",             es: "Presión máxima de trabajo" },
  "label_op_pressure":  { sv: "Drifttryck",                en: "Operating pressure",            de: "Betriebsdruck",                  es: "Presión de funcionamiento" },
  "label_supply_pres":  { sv: "Matartryck",                en: "Supply pressure",               de: "Versorgungsdruck",               es: "Presión de suministro" },
  "label_piston_force": { sv: "Kolvkraft vid 6 bar",       en: "Piston force at 6 bar",         de: "Kolbenkraft bei 6 bar",           es: "Fuerza de émbolo a 6 bar" },
  "label_grip_force":   { sv: "Greppkraft",                en: "Gripping force",                de: "Greifkraft",                     es: "Fuerza de agarre" },
  "label_clamp_force":  { sv: "Klämkraft",                 en: "Clamping force",                de: "Klemmkraft",                     es: "Fuerza de sujeción" },
  "label_thrust":       { sv: "Tryckkraft",                en: "Thrust force",                  de: "Druckkraft",                     es: "Fuerza de empuje" },
  "label_torque":       { sv: "Vridmoment",                en: "Torque",                        de: "Drehmoment",                     es: "Par de apriete" },
  "label_max_speed":    { sv: "Max hastighet",             en: "Max speed",                     de: "Max. Geschwindigkeit",           es: "Velocidad máxima" },
  "label_flow_rate":    { sv: "Flöde",                     en: "Flow rate",                     de: "Durchfluss",                     es: "Caudal" },
  "label_vacuum":       { sv: "Vakuumnivå",                en: "Vacuum level",                  de: "Vakuumniveau",                   es: "Nivel de vacío" },
  "label_num_jaws":     { sv: "Antal käftar",              en: "Number of jaws",                de: "Anzahl der Klauen",              es: "Número de mordazas" },
  "label_valve_fn":     { sv: "Ventilfunktion",            en: "Valve function",                de: "Ventilfunktion",                 es: "Función de válvula" },
  "label_valve_std":    { sv: "Ventilstandard",            en: "Valve standard",                de: "Ventilnorm",                     es: "Norma de válvula" },
  "label_stations":     { sv: "Antal stationer",           en: "Number of stations",            de: "Anzahl Stationen",               es: "Número de estaciones" },
  "label_valve_slices": { sv: "Ventilskivor",              en: "Valve slices",                  de: "Ventilscheiben",                 es: "Láminas de válvula" },
  "label_port_size":    { sv: "Portdimension",             en: "Port size",                     de: "Anschlussgröße",                 es: "Tamaño de puerto" },
  "label_connection":   { sv: "Anslutning",                en: "Connection",                    de: "Anschluss",                      es: "Conexión" },
  "label_thread":       { sv: "Gänga",                     en: "Thread",                        de: "Gewinde",                        es: "Rosca" },
  "label_flow_dir":     { sv: "Flödesriktning",            en: "Flow direction",                de: "Durchflussrichtung",             es: "Dirección del flujo" },
  "label_filter_grade": { sv: "Filterklass",               en: "Filter grade",                  de: "Filterklasse",                   es: "Grado de filtración" },
  "label_sealed_bore":  { sv: "Tätad borrning",            en: "Sealed bore",                   de: "Abgedichtete Bohrung",           es: "Orificio sellado" },
  "label_solenoid_v":   { sv: "Magnetspänning",            en: "Solenoid voltage",              de: "Magnetspannung",                 es: "Tensión del solenoide" },
  "label_actuation":    { sv: "Aktivering",                en: "Actuation",                     de: "Betätigung",                     es: "Accionamiento" },
  "label_drive":        { sv: "Drivsätt",                  en: "Drive type",                    de: "Antriebsart",                    es: "Tipo de accionamiento" },
  "label_slide_type":   { sv: "Glidsätt",                  en: "Slide type",                    de: "Gleitertyp",                     es: "Tipo de guía" },
  "label_ip_rating":    { sv: "IP-klass",                  en: "IP rating",                     de: "IP-Schutzart",                   es: "Grado IP" },
  "label_prot_class":   { sv: "Skyddsklassning",           en: "Protection class",              de: "Schutzklasse",                   es: "Clase de protección" },
  "label_temp_range":   { sv: "Temperaturområde",          en: "Temperature range",             de: "Temperaturbereich",              es: "Rango de temperatura" },
  "label_medium":       { sv: "Medium",                    en: "Medium",                        de: "Medium",                         es: "Medio" },
  "label_clean_room":   { sv: "Renrumsanpassad",           en: "Clean room compatible",         de: "Reinraumgeeignet",               es: "Apto para sala limpia" },
  "label_standard":     { sv: "Standard",                  en: "Standard",                      de: "Norm",                           es: "Norma" },
  "label_material":     { sv: "Material",                  en: "Material",                      de: "Werkstoff",                      es: "Material" },
  "label_guide_type":   { sv: "Guidetyp",                  en: "Guide type",                    de: "Führungstyp",                    es: "Tipo de guía" },
  "label_cushioning":   { sv: "Styrning/dämpning",         en: "Cushioning",                    de: "Dämpfung",                       es: "Amortiguación" },
  "label_pos_output":   { sv: "Positionsutgång",           en: "Position output",               de: "Positionsausgang",               es: "Salida de posición" },
  "label_note":         { sv: "Anmärkning",                en: "Note",                          de: "Anmerkung",                      es: "Nota" },
  "label_voltage":      { sv: "Spänning",                  en: "Voltage",                       de: "Spannung",                       es: "Tensión" },
  "label_fieldbus":     { sv: "Fieldbus",                  en: "Fieldbus",                      de: "Feldbus",                        es: "Bus de campo" },
  // Compare page UI
  "title":              { sv: "Jämför produkter",          en: "Compare products",              de: "Produkte vergleichen",           es: "Comparar productos" },
  "addProduct":         { sv: "Lägg till produkt",         en: "Add product",                   de: "Produkt hinzufügen",             es: "Añadir producto" },
  "remove":             { sv: "Ta bort",                   en: "Remove",                        de: "Entfernen",                      es: "Eliminar" },
  "emptyTitle":         { sv: "Inga produkter att jämföra", en: "No products to compare",       de: "Keine Produkte zum Vergleichen", es: "No hay productos para comparar" },
  "emptyHint":          { sv: "Gå till produktkatalogen och lägg till produkter för att jämföra dem här.", en: "Go to the product catalogue and add products to compare them here.", de: "Gehen Sie zum Produktkatalog und fügen Sie Produkte hinzu, um sie hier zu vergleichen.", es: "Ve al catálogo de productos y añade productos para compararlos aquí." },
  "browseProducts":     { sv: "Bläddra produkter",         en: "Browse products",               de: "Produkte durchsuchen",           es: "Ver productos" },
  "onlyDiffs":          { sv: "Visa bara skillnader",      en: "Show differences only",         de: "Nur Unterschiede anzeigen",      es: "Mostrar solo diferencias" },
  "showAll":            { sv: "Visa alla rader",           en: "Show all rows",                 de: "Alle Zeilen anzeigen",           es: "Mostrar todas las filas" },
  "addToList":          { sv: "Lägg i inköpslista",        en: "Add to shopping list",          de: "In Einkaufsliste legen",         es: "Añadir a la lista" },
  "viewProduct":        { sv: "Visa produkt",              en: "View product",                  de: "Produkt anzeigen",               es: "Ver producto" },
  "mixedWarning":       { sv: "Blandade kategorier",       en: "Mixed categories",              de: "Gemischte Kategorien",           es: "Categorías mezcladas" },
  "specsNotComp":       { sv: "Specifikationerna kanske inte är jämförbara", en: "Specifications may not be comparable", de: "Spezifikationen sind möglicherweise nicht vergleichbar", es: "Las especificaciones pueden no ser comparables" },
  "noSpecs":            { sv: "Inga specifikationer tillgängliga", en: "No specifications available", de: "Keine Spezifikationen verfügbar", es: "No hay especificaciones disponibles" },
  "otherSpecs":         { sv: "Övriga specifikationer",    en: "Other specifications",          de: "Weitere Spezifikationen",        es: "Otras especificaciones" },
};

// ─── Load and update locale files ─────────────────────────────────────────────
const LOCALES = ["sv", "en", "de", "es"];

for (const locale of LOCALES) {
  const path = resolve(root, `src/locales/${locale}.json`);
  const json = JSON.parse(readFileSync(path, "utf8"));

  // Add/overwrite the comparePage section
  json.comparePage = {};
  for (const [key, vals] of Object.entries(COMPARE_KEYS)) {
    json.comparePage[key] = vals[locale];
  }

  writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`✓ Updated ${locale}.json — added ${Object.keys(COMPARE_KEYS).length} comparePage keys`);
}

console.log("\nDone! Now update compare.tsx to use t('comparePage.*') for each label.");
