/**
 * Hur en specifikation visas för kunden: etikett, värde och källa.
 *
 * Granskningen 2026-10-02 hittade råa databasnycklar överallt i gränssnittet:
 * "temp range", "piston force retract 6bar N: 1837" (utan enhet), "Tube Od
 * (mm)", "2000 mm mm" (enheten två gånger) -- och "Temp Range Kalla: Festo
 * artikel 186101 …", en intern källanteckning som såg ut som en egenskap.
 * Det här är den enda platsen som bestämmer hur en spec ser ut, så att
 * produktsida, jämförelse och katalogkort säger samma sak.
 */

type Sprak = "sv" | "en";
const ETIKETT: Record<string, [sv: string, en: string]> = {
  bore_mm: ["Borrning", "Bore"],
  bore_range: ["Borrningar", "Bores"],
  stroke_mm: ["Slaglängd", "Stroke"],
  stroke_max: ["Max slaglängd", "Max stroke"],
  stroke_range: ["Slagområde", "Stroke range"],
  standard_strokes_mm: ["Standardslag", "Standard strokes"],
  max_pressure: ["Max tryck", "Max pressure"],
  max_pressure_bar: ["Max tryck", "Max pressure"],
  min_pressure: ["Min tryck", "Min pressure"],
  min_pressure_mpa: ["Min tryck", "Min pressure"],
  min_pressure_kpa: ["Min tryck", "Min pressure"],
  operating_pressure: ["Arbetstryck", "Operating pressure"],
  temp_range: ["Temperaturområde", "Temperature range"],
  mode_of_operation: ["Verkningssätt", "Mode of operation"],
  medium: ["Medium", "Medium"],
  series: ["Serie", "Series"],
  cylinder_type: ["Cylindertyp", "Cylinder type"],
  actuator_type: ["Ställdonstyp", "Actuator type"],
  type: ["Typ", "Type"],
  standard: ["Standard", "Standard"],
  material: ["Material", "Material"],
  body_material: ["Husmaterial", "Body material"],
  port: ["Anslutning", "Port"],
  port_size: ["Anslutningsstorlek", "Port size"],
  connection: ["Anslutning", "Connection"],
  thread: ["Gänga", "Thread"],
  rod_thread: ["Kolvstångsgänga", "Rod thread"],
  cushioning: ["Dämpning", "Cushioning"],
  cushioning_types: ["Dämpningsvarianter", "Cushioning types"],
  magnetic_piston: ["Magnetkolv", "Magnetic piston"],
  position_sensing: ["Lägesavkänning", "Position sensing"],
  position_output: ["Lägesutgång", "Position output"],
  feedback: ["Givare", "Feedback"],
  piston_force_6bar_N: ["Kolvkraft vid 6 bar, ut", "Piston force at 6 bar, extend"],
  piston_force_retract_6bar_N: ["Kolvkraft vid 6 bar, in", "Piston force at 6 bar, retract"],
  piston_force_6_3bar_N: ["Kolvkraft vid 6,3 bar", "Piston force at 6.3 bar"],
  force_out_n_05mpa: ["Kraft ut vid 0,5 MPa", "Force out at 0.5 MPa"],
  force_n: ["Kraft", "Force"],
  thrust_force: ["Tryckkraft", "Thrust force"],
  clamping_force: ["Klämkraft", "Clamping force"],
  torque: ["Vridmoment", "Torque"],
  rotation_angle: ["Vridvinkel", "Rotation angle"],
  max_speed: ["Max hastighet", "Max speed"],
  repeatability_mm: ["Repeterbarhet", "Repeatability"],
  tube_od_mm: ["Slangens ytterdiameter", "Tube outer diameter"],
  inner_diameter_mm: ["Innerdiameter", "Inner diameter"],
  outer_diameter_mm: ["Ytterdiameter", "Outer diameter"],
  length_m: ["Längd", "Length"],
  ip_rating: ["IP-klass", "IP rating"],
  function: ["Funktion", "Function"],
  valve_function: ["Ventilfunktion", "Valve function"],
  valve_type: ["Ventiltyp", "Valve type"],
  actuation: ["Manövrering", "Actuation"],
  solenoid_voltage: ["Spolspänning", "Solenoid voltage"],
  voltage: ["Spänning", "Voltage"],
  fieldbus: ["Fältbuss", "Fieldbus"],
  stations: ["Ventilplatser", "Stations"],
  flow_direction: ["Flödesriktning", "Flow direction"],
  filter_grade: ["Filtergrad", "Filter grade"],
  gripper_type: ["Gripdonstyp", "Gripper type"],
  jaw_stroke_per_side: ["Käftslag per sida", "Jaw stroke per side"],
  jaw_opening_angle: ["Öppningsvinkel", "Jaw opening angle"],
  max_opening_angle: ["Största öppningsvinkel", "Max. opening angle"],
  number_of_jaws: ["Antal backar", "Number of jaws"],
  stroke_per_jaw: ["Slag per back", "Stroke per jaw"],
  gripping_directions: ["Gripriktning", "Gripping direction"],
  gripping_force_closing_N: ["Gripkraft vid stängning", "Gripping force, closing"],
  max_jaw_force_Fz: ["Max backkraft Fz", "Max jaw force Fz"],
  swivel_angle_max: ["Max vridvinkel", "Max swivel angle"],
  stroke_max_mm: ["Max slaglängd", "Max stroke"],
  max_thrust_n: ["Max dragkraft", "Max thrust"],
  piston_rod: ["Kolvstång", "Piston rod"],
  corrosion_resistance: ["Korrosionsskydd", "Corrosion resistance"],
  mounting_standard: ["Infästningsmått", "Mounting standard"],
  valve_standard: ["Ventilstandard", "Valve standard"],
  flow_rate_l_min: ["Flöde", "Flow rate"],
  port_connection: ["Anslutning", "Port connection"],
  fitting_position: ["Anslutningsläge", "Fitting position"],
  pressure_range_mpa: ["Tryckområde", "Pressure range"],
  pressure_range: ["Tryckområde", "Pressure range"],
  pressure_regulation_range: ["Reglerområde", "Pressure regulation range"],
  max_vacuum: ["Max vakuum", "Max vacuum"],
  vacuum_level: ["Vakuumnivå", "Vacuum level"],
  cup_diameter_mm: ["Sugkoppens diameter", "Cup diameter"],
  cup_area_mm2: ["Sugkoppens area", "Cup area"],
  component_type: ["Komponenttyp", "Component type"],
  size: ["Storlek", "Size"],
  catalogue_part_no: ["Katalognummer", "Catalogue part no."],
  order_code_length: ["Orderkodens längd", "Order code length"],
  guide_type: ["Styrning", "Guide type"],
  guide: ["Styrning", "Guide"],
  slide_type: ["Slidtyp", "Slide type"],
  drive: ["Drivning", "Drive"],
  sizes: ["Storlekar", "Sizes"],
  special_features: ["Särskilda egenskaper", "Special features"],
  weight: ["Vikt", "Weight"],
  weight_g: ["Vikt", "Weight"],
  weight_kg: ["Vikt", "Weight"],
  order_code_example: ["Exempel på orderkod", "Example order code"],
  catalogue: ["Katalog", "Catalogue"],
};

/** Det som syns först på ett katalogkort: det en konstruktör sorterar på. */
const PRIORITET = [
  "bore_mm", "stroke_mm", "max_pressure", "temp_range", "piston_force_6bar_N", "force_n",
  "torque", "rotation_angle", "port", "thread", "tube_od_mm", "valve_function", "ip_rating",
];

const ENHET_UR_NYCKEL: [RegExp, string][] = [
  [/_n$/i, "N"], [/_mm$/i, "mm"], [/_m$/i, "m"], [/_g$/i, "g"], [/_kg$/i, "kg"],
  [/_mpa$/i, "MPa"], [/_kpa$/i, "kPa"], [/_bar$/i, "bar"],
];

/** Källanteckningar (t.ex. temp_range_kalla) är inga egenskaper. */
export function arKalla(key: string): boolean {
  return /_kalla$/i.test(key);
}

export function specEtikett(key: string, locale: string): string {
  const par = ETIKETT[key];
  if (par) return locale === "sv" ? par[0] : par[1];
  // Okänd nyckel: läsbar text i stället för snake_case, utan enhetssuffix.
  const ord = key.replace(/_+/g, " ").replace(/\b(n|mm|m|g|kg|mpa|kpa|bar)$/i, "").trim();
  return ord.charAt(0).toUpperCase() + ord.slice(1);
}

/** Värde med enhet -- en gång. Saknas enheten tas den ur nyckelnamnet. */
export function specVarde(key: string, v: { value: unknown; unit: string | null }): string {
  let txt = String(v.value ?? "").trim();
  const enhet = v.unit ?? ENHET_UR_NYCKEL.find(([m]) => m.test(key))?.[1] ?? null;
  if (enhet && /\d$/.test(txt) && !txt.toLowerCase().endsWith(enhet.toLowerCase())) txt += " " + enhet;
  return txt;
}

type Spec = { value: string; unit: string | null };

/** Synliga specar, de viktigaste först. Källanteckningar tas bort. */
export function synligaSpecar(specs: Record<string, Spec>): [string, Spec][] {
  const poster = Object.entries(specs).filter(([k]) => !arKalla(k));
  const rang = (k: string) => { const i = PRIORITET.indexOf(k); return i < 0 ? PRIORITET.length : i; };
  return poster.sort((a, b) => rang(a[0]) - rang(b[0]));
}

/** Källorna, med etiketten för den egenskap de gäller. */
export function kallor(specs: Record<string, Spec>, locale: string): { egenskap: string; text: string }[] {
  return Object.entries(specs)
    .filter(([k]) => arKalla(k))
    .map(([k, v]) => ({ egenskap: specEtikett(k.replace(/_kalla$/i, ""), locale), text: String(v.value) }));
}

export type { Sprak };

/**
 * Beskrivningen på sidans språk. description är svensk; där en engelsk
 * originaltext fanns sparas den i description_en (2026-10-06) och visas på
 * de andra språken.
 */
export function beskrivning(p: { description: string | null; description_en?: string | null }, locale: string): string | null {
  return locale !== "sv" && p.description_en ? p.description_en : p.description;
}
