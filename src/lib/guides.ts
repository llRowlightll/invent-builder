/**
 * Buying guides — long-tail SEO + lead magnet. Each guide is real engineering
 * guidance that ends in a call to the AI advisor / configurator. Bilingual
 * (sv primary market, en covers en/de/es). Rendered SSR by guider.$slug.tsx.
 */

export type Bi = { sv: string; en: string };
export type GuideSection = { h: Bi; p: Bi[] };
export type Guide = {
  slug: string;
  title: Bi;
  metaDescription: Bi;
  intro: Bi;
  sections: GuideSection[];
  cta: Bi;
  ctaTo: "advisor" | "configure";
};

export const GUIDES: Guide[] = [
  {
    slug: "dimensionera-pneumatikcylinder",
    title: {
      sv: "Så dimensionerar du en pneumatikcylinder",
      en: "How to size a pneumatic cylinder",
    },
    metaDescription: {
      sv: "Steg-för-steg: välj borrning från kraft och tryck, rätt slaglängd, dämpning och montering. Med kraftvärden per cylinderdiameter vid 6 bar.",
      en: "Step by step: pick the bore from force and pressure, the right stroke, cushioning and mounting. Includes force values per bore at 6 bar.",
    },
    intro: {
      sv: "Rätt dimensionerad cylinder ger säker funktion, lång livslängd och låg luftförbrukning. För liten cylinder orkar inte lasten; för stor slösar luft och pengar. Här är de fyra storheterna du behöver bestämma.",
      en: "A correctly sized cylinder gives reliable operation, long life and low air use. Too small won't move the load; too large wastes air and money. Here are the four things you need to decide.",
    },
    sections: [
      {
        h: { sv: "1. Borrning från kraft och tryck", en: "1. Bore from force and pressure" },
        p: [
          {
            sv: "Kraften en cylinder ger är trycket gånger kolvarean: F = P × A, där A = π/4 × D². Vid 6 bar ger vanliga borrningar ungefär: Ø32 ≈ 480 N, Ø40 ≈ 750 N, Ø50 ≈ 1 180 N, Ø63 ≈ 1 870 N, Ø80 ≈ 3 000 N, Ø100 ≈ 4 700 N.",
            en: "The force a cylinder delivers is pressure times piston area: F = P × A, where A = π/4 × D². At 6 bar, common bores give roughly: Ø32 ≈ 480 N, Ø40 ≈ 750 N, Ø50 ≈ 1,180 N, Ø63 ≈ 1,870 N, Ø80 ≈ 3,000 N, Ø100 ≈ 4,700 N.",
          },
          {
            sv: "Lägg på marginal för friktion och dynamik — räkna med 25–50 % över den statiska lasten. Vid drag (instången kolvstång) blir kraften lägre eftersom stångens area dras bort.",
            en: "Add margin for friction and dynamics — plan for 25–50 % above the static load. On the pull stroke the force is lower because the rod area is subtracted.",
          },
        ],
      },
      {
        h: { sv: "2. Slaglängd", en: "2. Stroke length" },
        p: [
          {
            sv: "Slaglängden ska motsvara den rörelse du behöver, med lite marginal i ändlägena. Långa slag på smala cylindrar riskerar knäckning på kolvstången — välj då en grövre stång eller en guidad cylinder.",
            en: "The stroke should match the travel you need, with a little margin at the ends. Long strokes on slim cylinders risk rod buckling — choose a thicker rod or a guided cylinder in that case.",
          },
        ],
      },
      {
        h: { sv: "3. Dämpning och hastighet", en: "3. Cushioning and speed" },
        p: [
          {
            sv: "Höga hastigheter och tunga laster behöver ändlägesdämpning så att cylindern inte slår i. Justerbar pneumatisk dämpning räcker oftast; vid mycket energi kan en separat stötdämpare behövas.",
            en: "High speeds and heavy loads need end cushioning so the cylinder doesn't slam. Adjustable pneumatic cushioning is usually enough; for very high energy a separate shock absorber may be needed.",
          },
        ],
      },
      {
        h: { sv: "4. Montering och sidolaster", en: "4. Mounting and side loads" },
        p: [
          {
            sv: "Välj infästning efter rörelsen: fast fläns/fot för raka laster, svängtapp eller gaffel om cylindern måste vinkla. Finns sidolaster ska de tas upp av en guidad cylinder eller extern styrning — inte av kolvstången.",
            en: "Pick the mounting to suit the motion: fixed flange/foot for straight loads, clevis or trunnion if the cylinder must pivot. Any side loads should be carried by a guided cylinder or external guide — not by the piston rod.",
          },
        ],
      },
    ],
    cta: {
      sv: "Beskriv din rörelse så dimensionerar AI-rådgivaren cylindern åt dig — med komplett stycklista.",
      en: "Describe your motion and the AI advisor will size the cylinder for you — with a complete bill of materials.",
    },
    ctaTo: "advisor",
  },

  {
    slug: "valja-ratt-ventil",
    title: {
      sv: "Välja rätt ventil till din cylinder",
      en: "Choosing the right valve for your cylinder",
    },
    metaDescription: {
      sv: "5/2 eller 3/2? Så väljer du ventilfunktion, flöde (Cv/Kv), manövrering och om du ska ha enskild ventil eller ventilterminal.",
      en: "5/2 or 3/2? How to choose valve function, flow (Cv/Kv), actuation, and whether to use a single valve or a valve terminal.",
    },
    intro: {
      sv: "Ventilen styr cylindern — och en underdimensionerad ventil gör cylindern långsam oavsett hur stor den är. Fyra saker avgör valet.",
      en: "The valve controls the cylinder — and an undersized valve makes the cylinder slow no matter how big it is. Four things decide the choice.",
    },
    sections: [
      {
        h: { sv: "1. Funktion: 5/2 eller 3/2", en: "1. Function: 5/2 or 3/2" },
        p: [
          {
            sv: "Dubbelverkande cylindrar styrs av en 5/2-ventil (tryck på båda sidor). Enkelverkande cylindrar och vakuum klarar sig med en 3/2-ventil. Behöver du ett definierat säkert läge vid strömbortfall, välj enkelmagnet med fjäderretur eller en 5/3-ventil med spärrat mittläge.",
            en: "Double-acting cylinders are driven by a 5/2 valve (pressure on both sides). Single-acting cylinders and vacuum get by with a 3/2 valve. If you need a defined safe state on power loss, choose a single-solenoid spring-return valve or a 5/3 valve with a closed centre.",
          },
        ],
      },
      {
        h: { sv: "2. Flöde och storlek (Cv/Kv)", en: "2. Flow and size (Cv/Kv)" },
        p: [
          {
            sv: "Ventilens flödeskapacitet måste matcha cylinderns volym och önskad hastighet. En stor cylinder bakom en liten ventil blir trög. Räkna på luftflödet vid din cykeltid och välj ventil med tillräckligt Cv/Kv-värde och rätt portstorlek (t.ex. G1/8 till G1/2).",
            en: "The valve's flow capacity must match the cylinder volume and the speed you want. A large cylinder behind a small valve becomes sluggish. Work out the airflow at your cycle time and pick a valve with enough Cv/Kv and the right port size (e.g. G1/8 to G1/2).",
          },
        ],
      },
      {
        h: { sv: "3. Manövrering och spänning", en: "3. Actuation and voltage" },
        p: [
          {
            sv: "De flesta industriventiler är magnetstyrda 24 V DC. Se till att det finns manuell override för driftsättning och felsökning. Vid explosiv miljö behövs ATEX-klassade ventiler.",
            en: "Most industrial valves are solenoid-operated 24 V DC. Make sure there's a manual override for commissioning and troubleshooting. Explosive environments require ATEX-rated valves.",
          },
        ],
      },
      {
        h: { sv: "4. Enskild ventil eller ventilterminal", en: "4. Single valve or valve terminal" },
        p: [
          {
            sv: "Har du några få ventiler räcker enskilt montage. Vid många ventiler lönar sig en ventilterminal: en samlad enhet med fältbuss (PROFINET, EtherCAT) som drastiskt minskar kablage och installationstid.",
            en: "For a handful of valves, individual mounting is fine. With many valves a valve terminal pays off: one assembled unit with fieldbus (PROFINET, EtherCAT) that drastically cuts wiring and install time.",
          },
        ],
      },
    ],
    cta: {
      sv: "Osäker på storleken? Kör din applikation genom AI-rådgivaren så föreslår den ventil och tillbehör.",
      en: "Unsure about the size? Run your application through the AI advisor and it will suggest the valve and accessories.",
    },
    ctaTo: "advisor",
  },

  {
    slug: "berakna-luftforbrukning",
    title: {
      sv: "Beräkna luftförbrukning för pneumatik",
      en: "Calculating air consumption for pneumatics",
    },
    metaDescription: {
      sv: "Formel och räkneexempel för luftförbrukning i Nl/min, vad tryckluften kostar och hur du dimensionerar kompressor och FRL-enhet.",
      en: "Formula and worked example for air consumption in Nl/min, what compressed air costs, and how to size the compressor and FRL unit.",
    },
    intro: {
      sv: "Tryckluft är ofta fabrikens dyraste energiform. Att räkna på förbrukningen hjälper dig välja rätt kompressor, dimensionera luftberedningen och se var pengarna tar vägen.",
      en: "Compressed air is often a factory's most expensive energy. Estimating consumption helps you choose the right compressor, size the air preparation and see where the money goes.",
    },
    sections: [
      {
        h: { sv: "1. Formeln", en: "1. The formula" },
        p: [
          {
            sv: "Luft per slag = slagvolym × kompressionsförhållande. Kompressionsförhållandet vid arbetstrycket P (bar övertryck) är (P + 1,013) / 1,013. Räkna med båda slagriktningarna per cykel.",
            en: "Air per stroke = stroke volume × compression ratio. The compression ratio at working pressure P (bar gauge) is (P + 1.013) / 1.013. Count both stroke directions per cycle.",
          },
        ],
      },
      {
        h: { sv: "2. Räkneexempel", en: "2. Worked example" },
        p: [
          {
            sv: "En Ø50-cylinder med 200 mm slag vid 6 bar: kolvarean är ~19,6 cm², slagvolymen ~0,39 liter. Kompressionsförhållande ≈ 6,9 ger ~2,7 Nl per utslag, alltså ~5,4 Nl per dubbelslag. Vid 60 cykler/min blir det ~320 Nl/min (~0,3 Nm³/min).",
            en: "A Ø50 cylinder with 200 mm stroke at 6 bar: piston area ≈ 19.6 cm², stroke volume ≈ 0.39 litre. A compression ratio ≈ 6.9 gives ≈ 2.7 Nl per extend, so ≈ 5.4 Nl per full cycle. At 60 cycles/min that's ≈ 320 Nl/min (≈ 0.3 Nm³/min).",
          },
        ],
      },
      {
        h: { sv: "3. Vad det kostar", en: "3. What it costs" },
        p: [
          {
            sv: "Att producera tryckluft kostar ungefär 0,10–0,12 kWh per Nm³ vid 7 bar. 0,3 Nm³/min blir ~18 Nm³/h, alltså ~2 kWh/h. Över ett driftår på flera tusen timmar handlar det snabbt om tusenlappar — läckage och övertryck är där pengarna rinner iväg.",
            en: "Producing compressed air costs roughly 0.10–0.12 kWh per Nm³ at 7 bar. 0.3 Nm³/min is ≈ 18 Nm³/h, i.e. ≈ 2 kWh/h. Over several thousand operating hours a year that adds up fast — leaks and over-pressure are where the money leaks away.",
          },
        ],
      },
      {
        h: { sv: "4. Dimensionera kompressor och FRL", en: "4. Size the compressor and FRL" },
        p: [
          {
            sv: "Summera förbrukningen för alla cylindrar vid samtidig drift och lägg på marginal för läckage och framtida utbyggnad. FRL-enhet och slangdimension ska klara toppflödet utan tryckfall — annars tappar cylindrarna kraft vid snabba cykler.",
            en: "Sum the consumption of all cylinders running at once and add margin for leakage and future expansion. The FRL unit and tubing size must handle the peak flow without pressure drop — otherwise the cylinders lose force on fast cycles.",
          },
        ],
      },
    ],
    cta: {
      sv: "Bygg din applikation i maskinbyggaren så får du luftberedning och slang föreslagna i stycklistan.",
      en: "Build your application in the machine builder and get air preparation and tubing suggested in the bill of materials.",
    },
    ctaTo: "advisor",
  },

  {
    slug: "elektrisk-eller-pneumatisk-aktuator",
    title: {
      sv: "Elektrisk eller pneumatisk aktuator?",
      en: "Electric or pneumatic actuator?",
    },
    metaDescription: {
      sv: "När vinner pneumatik och när vinner el? Beslutsguide för precision, energi, kostnad och data — så väljer du rätt aktuator för din applikation.",
      en: "When does pneumatic win and when does electric? A decision guide on precision, energy, cost and data — how to pick the right actuator.",
    },
    intro: {
      sv: "Båda teknikerna har sin plats. Valet handlar om precision, hur många lägen du behöver, energi och hur mycket återkoppling och data applikationen kräver.",
      en: "Both technologies have their place. The choice comes down to precision, how many positions you need, energy, and how much feedback and data the application requires.",
    },
    sections: [
      {
        h: { sv: "När pneumatik vinner", en: "When pneumatic wins" },
        p: [
          {
            sv: "Enkla rörelser mellan två ändlägen — mata, klämma, lyfta, stansa. Pneumatik är billig i inköp, robust, tål stötar och smuts, och ger hög kraft i ett litet format. Perfekt när du bara behöver \"ut och in\".",
            en: "Simple moves between two end positions — feeding, clamping, lifting, stamping. Pneumatics are cheap to buy, robust, tolerate shock and dirt, and deliver high force in a small package. Perfect when you just need \"out and in\".",
          },
        ],
      },
      {
        h: { sv: "När el vinner", en: "When electric wins" },
        p: [
          {
            sv: "Behöver du flera eller fritt valbara lägen, exakt positionering (±0,01 mm), styrd hastighet/kraft eller mätdata för övervakning — då är en elektrisk axel rätt. Den är också energieffektiv vid låg cykeltakt eftersom den bara drar ström när den rör sig.",
            en: "If you need several or freely selectable positions, exact positioning (±0.01 mm), controlled speed/force, or measurement data for monitoring — an electric axis is the right choice. It's also energy-efficient at low cycle rates since it only draws power while moving.",
          },
        ],
      },
      {
        h: { sv: "Total kostnad (TCO)", en: "Total cost of ownership" },
        p: [
          {
            sv: "Pneumatik har låg investeringskostnad men löpande kostnad för tryckluft. El har högre investering (motor, drivare, kablar) men lägre driftkostnad och bättre verkningsgrad. Vid många cykler och lång drifttid hämtas elinvesteringen ofta hem.",
            en: "Pneumatics have low capital cost but an ongoing cost for compressed air. Electric has higher up-front cost (motor, drive, cables) but lower running cost and better efficiency. With many cycles and long run time the electric investment often pays back.",
          },
        ],
      },
      {
        h: { sv: "Hybridlösningar", en: "Hybrid solutions" },
        p: [
          {
            sv: "Du behöver inte välja en teknik för hela maskinen. Vanligt är pneumatik för enkla grepp och klämmor, och elektriska axlar där precisionen behövs. Välj per rörelse, inte per maskin.",
            en: "You don't have to pick one technology for the whole machine. It's common to use pneumatics for simple grips and clamps, and electric axes where precision is needed. Choose per motion, not per machine.",
          },
        ],
      },
    ],
    cta: {
      sv: "Beskriv din applikation så föreslår AI-rådgivaren rätt teknik — pneumatisk, elektrisk eller en kombination.",
      en: "Describe your application and the AI advisor will suggest the right technology — pneumatic, electric or a combination.",
    },
    ctaTo: "advisor",
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
