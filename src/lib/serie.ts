/**
 * Är katalograden en serie (familj) snarare än en beställningsbar artikel?
 *
 * Kundgranskningen 2026-11-13: FESTO-DSBC ("Borrning 32,40,50,63,80,100,125
 * mm", "Slaglängd 2800 mm") och ett sjuttiotal liknande rader gick att lägga
 * i korgen som om de vore en artikel, och max-slaget visades som slaget.
 * Inköparen vet då inte vad hen beställer. Bara starka tecken räknas, så att
 * en riktig artikel aldrig blir en serie:
 *   - artikelnumret har inga siffror efter fabrikatsprefixet (FESTO-DSBC,
 *     BR-EMC, SMC-ZP, MW-RACCORDI)
 *   - flera borrningar eller ett borrningsspann
 *   - ett slagspann
 *   - texten säger att slaget/utförandet väljs vid beställning
 *
 * Ingen import av spec-format här, så att filen kan provas med deno test.
 */
type Rad = {
  sku: string;
  description?: string | null;
  description_en?: string | null;
  specs?: Record<string, { value: unknown; unit?: string | null }>;
};

const PREFIX = /^(FESTO|FE|SMC|PARKER|NORGREN|NOR|CAMOZZI|CAM|MW|METAL[-_]WORK|BOSCH|BR|AVENTICS)-/i;
const FLERA = /\d\s*[,;/]\s*\d/;
const SPANN = /\d\s*[–—-]\s*\d/;
const VALJS = /väljs vid beställning|selected when ordering|chosen when ordering/i;
const SLAGSPANN = /(?:slaglängd|stroke)\s+(\d+)\s*[–—-]\s*(\d+)/i;

export function arFamiljepost(p: Rad): boolean {
  const efter = p.sku.replace(PREFIX, "");
  if (efter !== p.sku && !/\d/.test(efter)) return true;
  const borr = String(p.specs?.bore_mm?.value ?? "");
  if (FLERA.test(borr) || SPANN.test(borr)) return true;
  const slag = String(p.specs?.stroke_mm?.value ?? "");
  if (FLERA.test(slag) || SPANN.test(slag)) return true;
  const text = `${p.description ?? ""} ${p.description_en ?? ""}`;
  if (VALJS.test(text)) return true;
  // "Slaglängd 80–1370 mm" i texten: en serie om raden saknar eget slag eller
  // om dess slag är spannets max (MW-ROD-STD-40: 5700 = max). 50N-025-300 har
  // slaget 300 och texten "Slaglängd 100–4000 mm finns" -- en artikel.
  const spann = text.match(SLAGSPANN);
  if (spann) {
    const max = Math.max(Number(spann[1]), Number(spann[2]));
    const eget = Number((slag.match(/\d+/) ?? [""])[0]);
    return !eget || eget === max;
  }
  return false;
}

/** Visas framför ett enskilt slag på en serie: "upp till 2800 mm". */
export function uppTill(locale: string): string {
  return ({ sv: "upp till", de: "bis", es: "hasta" } as Record<string, string>)[locale] ?? "up to";
}

/** Är värdet ett enskilt tal (inte redan ett spann eller en lista)? */
export function arEnskiltVarde(v: unknown): boolean {
  const s = String(v ?? "");
  return /\d/.test(s) && !FLERA.test(s) && !SPANN.test(s);
}

export const SERIE_TEXT: Record<string, { rad: string; knapp: string; valj: string; badge: string }> = {
  sv: { rad: "Serie: storlek och slaglängd väljs. Ange dem i förfrågan, så bekräftar vi artikelnumret i offerten.", knapp: "Lägg i förfrågan", valj: "Välj utförande →", badge: "Serie" },
  en: { rad: "Series: size and stroke are chosen. State them in your request and we confirm the part number in the quote.", knapp: "Add to request", valj: "Choose version →", badge: "Series" },
  de: { rad: "Baureihe: Größe und Hub werden gewählt. Geben Sie sie in der Anfrage an, wir bestätigen die Artikelnummer im Angebot.", knapp: "Zur Anfrage hinzufügen", valj: "Ausführung wählen →", badge: "Baureihe" },
  es: { rad: "Serie: el tamaño y la carrera se eligen. Indíquelos en su solicitud y confirmamos la referencia en la oferta.", knapp: "Añadir a la solicitud", valj: "Elegir versión →", badge: "Serie" },
};
