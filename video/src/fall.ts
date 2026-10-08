/**
 * De sex fallen i trailern. Varje rad är hämtad ur Maskinvals motor
 * 2026-10-02 -- artikelnummer, benämning och utfall är vad den driftsatta
 * tjänsten faktiskt svarade. Ingenting här är påhittat för filmens skull,
 * och ett ändrat värde ska hämtas om, inte skrivas om.
 */
export type Ton = "ja" | "nej" | "mer";

export interface Rad {
  antal: number;
  benamning: string;
  artikel: string;
  ton?: Ton;
  fokus?: boolean;
}

export interface Fall {
  bransch: string;
  benamning: string;          // titelrutans BENÄMNING
  beskrivning: string;
  rader: Rad[];
  utfall: { text: string; ton: Ton };
}

export const FALL: Fall[] = [
  {
    bransch: "Förpackning",
    benamning: "STOPPDON, TRANSPORTBAND",
    beskrivning: "Stoppdon på ett transportband. Kartonger på 5 kg, bandet går 0,5 m/s.",
    rader: [
      { antal: 1, benamning: "Kompaktcylinder Ø20", artikel: "0822391000" },
      { antal: 1, benamning: "Magnetventil 5/2", artikel: "FE-MFH-5-1-8" },
      { antal: 2, benamning: "Strypbackventil", artikel: "FE-GRLA-14-QS-8-D" },
    ],
    utfall: { text: "Slaglängd ej angiven. Den frågas efter före order.", ton: "mer" },
  },
  {
    bransch: "Montering",
    benamning: "VAKUUMGREPP, GLASSKIVOR",
    beskrivning: "Plocka och placera glasskivor på 4 kg med vakuumgrepp.",
    rader: [
      { antal: 2, benamning: "Sugkopp Ø30, NBR", artikel: "PFTM-30-NBR-G1" },
      { antal: 2, benamning: "Bälgsugkopp Ø40", artikel: "VTCL-40" },
    ],
    utfall: { text: "Griporgan valt efter angivet krav: vakuum.", ton: "ja" },
  },
  {
    bransch: "Kylrum",
    benamning: "LUCKA, FRYSLAGER",
    beskrivning: "Cylinder som öppnar en lucka i ett fryslager. −30 °C, 200 mm slag.",
    rader: [
      { antal: 1, benamning: "Kolvstångslös cylinder Ø25", artikel: "R480149659", ton: "nej" },
      { antal: 1, benamning: "Tryckluftsslang PAN", artikel: "FE-PAN-V0-10X1.5-BL-50", ton: "ja" },
    ],
    utfall: { text: "Slangen klarar −60 °C. Cylindern bara −10 °C.", ton: "nej" },
  },
  {
    bransch: "Bearbetning",
    benamning: "VRIDBORD, 180°",
    beskrivning: "Vridbord som roterar 180° per cykel. Last 12 kg.",
    rader: [
      { antal: 1, benamning: "Vridenhet 63 mm, 180°", artikel: "ARP-063-180" },
      { antal: 1, benamning: "Magnetventil 5/2", artikel: "FE-MFH-5-1-8" },
    ],
    utfall: { text: "Rörelseomfång 180°. Kravet uppfyllt.", ton: "ja" },
  },
  {
    bransch: "Inspektion",
    benamning: "ELAXEL, KAMERA",
    beskrivning: "Elaxel som positionerar en kamera. 300 mm slag, 0,05 mm noggrannhet.",
    rader: [
      { antal: 1, benamning: "Elaxel Serie 6E, 300 mm", artikel: "6E080BS0300P05AP" },
      { antal: 1, benamning: "Stegmotor", artikel: "CAM-MTS" },
      { antal: 1, benamning: "Drivsteg", artikel: "CAM-DRCS" },
    ],
    utfall: { text: "Slaglängd 300 mm. Kravet uppfyllt.", ton: "ja" },
  },
  {
    bransch: "Härdning",
    benamning: "LYFT, HÄRDNINGSLINJE",
    beskrivning: "Lyfta ett verktyg på 45 kg rakt upp 400 mm. 90 °C. En operatör arbetar under lasten.",
    rader: [
      { antal: 1, benamning: "ISO-cylinder, familj DSNU", artikel: "FESTO-193986" },
      { antal: 1, benamning: "Backslagsventil, håller lasten", artikel: "FE-HGL-1-4-B", fokus: true },
      { antal: 1, benamning: "Tryckluftsslang PAN", artikel: "FE-PAN-V0-10X1.5-BL-50", ton: "ja" },
    ],
    utfall: { text: "", ton: "nej" },
  },
];

export const BREDD = {
  komponenter: 887,
  tillverkare: 8,
  kategorier: 23,
  fabrikat: ["Festo", "SMC", "Parker", "Camozzi", "Bosch Rexroth", "Aventics", "Metal Work", "Norgren"],
  teknik: ["Pneumatik", "El", "Vakuum", "Vridning"],
};
