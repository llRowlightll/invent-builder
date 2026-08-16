/**
 * Buying guides — long-tail SEO + lead magnet. Each guide is real engineering
 * guidance that ends in a call to the AI advisor / configurator. Bilingual
 * (sv primary market, en covers en/de/es). Rendered SSR by guider.$slug.tsx.
 */

export type Bi = { sv: string; en: string };
export type GuideSection = { h: Bi; p: Bi[] };
export type FaqItem = { q: Bi; a: Bi };
export type Guide = {
  slug: string;
  title: Bi;
  metaDescription: Bi;
  intro: Bi;
  sections: GuideSection[];
  faq?: FaqItem[];
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
    faq: [
      {
        q: { sv: "Hur beräknar jag vilken cylinderdiameter jag behöver?", en: "How do I calculate what cylinder bore I need?" },
        a: {
          sv: "Använd F = P × A (kraft = tryck × kolvarea), lägg på 25–50 % marginal för friktion och dynamik, och avrunda upp till närmaste standardborrning. Vid 6 bar ger vanliga borrningar ungefär: Ø32 ≈ 480 N, Ø40 ≈ 750 N, Ø50 ≈ 1 180 N, Ø63 ≈ 1 870 N, Ø80 ≈ 3 000 N, Ø100 ≈ 4 700 N.",
          en: "Use F = P × A (force = pressure × piston area), add 25–50 % margin for friction and dynamics, and round up to the nearest standard bore. At 6 bar, common bores give roughly: Ø32 ≈ 480 N, Ø40 ≈ 750 N, Ø50 ≈ 1,180 N, Ø63 ≈ 1,870 N, Ø80 ≈ 3,000 N, Ø100 ≈ 4,700 N.",
        },
      },
      {
        q: { sv: "Vilken kraft ger en Ø63 mm cylinder vid 6 bar?", en: "How much force does a Ø63 mm cylinder give at 6 bar?" },
        a: {
          sv: "Ungefär 1 870 N på tryckslaget (utan avdrag för kolvstångens area). Vid dragslaget (indragen kolvstång) blir kraften något lägre eftersom stångens tvärsnittsarea dras bort från kolvarean.",
          en: "Roughly 1,870 N on the push stroke (before subtracting the rod area). On the pull stroke the force is a little lower because the rod's cross-section is subtracted from the piston area.",
        },
      },
      {
        q: { sv: "Varför räcker det inte att räkna bara på den statiska lasten?", en: "Why isn't it enough to size for the static load alone?" },
        a: {
          sv: "Friktion i tätningar och styrningar, samt acceleration/inbromsning vid start och stopp, kräver extra kraft utöver den rena statiska lasten. En marginal på 25–50 % täcker normalt detta utan att cylindern blir överdimensionerad och slösar luft.",
          en: "Seal and guide friction, plus acceleration/deceleration at start and stop, need extra force beyond the pure static load. A 25–50 % margin normally covers this without oversizing the cylinder and wasting air.",
        },
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
    faq: [
      {
        q: { sv: "Ska jag välja en 5/2- eller 3/2-ventil?", en: "Should I choose a 5/2 or a 3/2 valve?" },
        a: {
          sv: "Dubbelverkande cylindrar (tryck styr rörelsen åt båda hållen) behöver en 5/2-ventil. Enkelverkande cylindrar och vakuumapplikationer klarar sig med en enklare 3/2-ventil. Behövs ett definierat säkert läge vid strömbortfall, välj enkelmagnet med fjäderretur eller en 5/3-ventil med spärrat mittläge.",
          en: "Double-acting cylinders (pressure drives both directions) need a 5/2 valve. Single-acting cylinders and vacuum applications get by with a simpler 3/2 valve. If you need a defined safe state on power loss, choose a single-solenoid spring-return valve or a 5/3 valve with a closed centre.",
        },
      },
      {
        q: { sv: "Vad händer om ventilen är för liten för cylindern?", en: "What happens if the valve is undersized for the cylinder?" },
        a: {
          sv: "Cylindern blir långsam oavsett hur stor den själv är — ventilens flödeskapacitet (Cv/Kv) måste matcha cylinderns volym och önskade hastighet. En stor cylinder bakom en liten ventil är den vanligaste orsaken till en trög maskin.",
          en: "The cylinder becomes slow no matter how big it is — the valve's flow capacity (Cv/Kv) has to match the cylinder volume and the speed you want. A large cylinder behind a small valve is the most common cause of a sluggish machine.",
        },
      },
      {
        q: { sv: "När lönar sig en ventilterminal jämfört med enskilda ventiler?", en: "When does a valve terminal pay off compared to individual valves?" },
        a: {
          sv: "Vid en handfull ventiler räcker enskilt montage. Med många ventiler lönar sig en ventilterminal — en samlad enhet med fältbuss (t.ex. PROFINET eller EtherCAT) som drastiskt minskar kablage och installationstid jämfört med att koppla varje ventil separat.",
          en: "For a handful of valves, individual mounting is fine. With many valves a valve terminal pays off — one assembled unit with fieldbus (e.g. PROFINET or EtherCAT) that drastically cuts wiring and install time compared to wiring each valve separately.",
        },
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
    faq: [
      {
        q: { sv: "Hur räknar jag ut luftförbrukningen för en cylinder?", en: "How do I calculate a cylinder's air consumption?" },
        a: {
          sv: "Luft per slag = slagvolym × kompressionsförhållande, där kompressionsförhållandet vid arbetstryck P (bar övertryck) är (P + 1,013) / 1,013. Räkna med båda slagriktningarna per cykel och multiplicera med antal cykler per minut för Nl/min.",
          en: "Air per stroke = stroke volume × compression ratio, where the compression ratio at working pressure P (bar gauge) is (P + 1.013) / 1.013. Count both stroke directions per cycle and multiply by cycles per minute for Nl/min.",
        },
      },
      {
        q: { sv: "Vad kostar tryckluft per Nm³?", en: "What does compressed air cost per Nm³?" },
        a: {
          sv: "Ungefär 0,10–0,12 kWh per Nm³ vid 7 bar, beroende på kompressoranläggningens verkningsgrad. Över ett driftår på flera tusen timmar blir även en till synes liten förbrukning en betydande kostnadspost.",
          en: "Roughly 0.10–0.12 kWh per Nm³ at 7 bar, depending on the compressor plant's efficiency. Over several thousand operating hours a year, even a seemingly small consumption becomes a significant cost.",
        },
      },
      {
        q: { sv: "Varför är läckage i tryckluftssystemet så dyrt?", en: "Why are compressed-air leaks so costly?" },
        a: {
          sv: "Ett läckage förbrukar tryckluft dygnet runt, även när maskinen står still, och tryckluft är ofta fabrikens dyraste energiform per producerad enhet. Läckage och onödigt högt arbetstryck är där pengarna oftast rinner iväg — inte i själva cylinderns cykeldrift.",
          en: "A leak consumes compressed air around the clock, even when the machine is idle, and compressed air is often a factory's most expensive energy form per unit delivered. Leaks and unnecessarily high working pressure are usually where the money goes — not the cylinder's actual cycling.",
        },
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
    faq: [
      {
        q: { sv: "När ska jag välja pneumatik istället för en elektrisk axel?", en: "When should I choose pneumatics instead of an electric axis?" },
        a: {
          sv: "Vid enkla rörelser mellan två fasta ändlägen — mata, klämma, lyfta, stansa. Pneumatik är billig i inköp, robust mot stötar och smuts, och ger hög kraft i ett litet format. Perfekt när applikationen bara behöver \"ut och in\", inte flera lägen.",
          en: "For simple moves between two fixed end positions — feeding, clamping, lifting, stamping. Pneumatics are cheap to buy, robust against shock and dirt, and deliver high force in a small package. Perfect when the application just needs \"out and in\", not multiple positions.",
        },
      },
      {
        q: { sv: "När behöver jag en elektrisk aktuator istället för pneumatisk?", en: "When do I need an electric actuator instead of pneumatic?" },
        a: {
          sv: "När du behöver flera eller fritt valbara lägen, exakt positionering (ner till ±0,01 mm), styrd hastighet/kraft, eller mätdata för övervakning. En elektrisk axel är också energieffektiv vid låg cykeltakt eftersom den bara drar ström när den faktiskt rör sig.",
          en: "When you need several or freely selectable positions, exact positioning (down to ±0.01 mm), controlled speed/force, or measurement data for monitoring. An electric axis is also energy-efficient at low cycle rates since it only draws power while actually moving.",
        },
      },
      {
        q: { sv: "Kan jag blanda pneumatik och elektriska aktuatorer i samma maskin?", en: "Can I mix pneumatic and electric actuators in the same machine?" },
        a: {
          sv: "Ja — och det är vanligt. En typisk lösning använder pneumatik för enkla grepp och klämmor, och elektriska axlar där precisionen faktiskt behövs. Välj teknik per rörelse, inte per maskin.",
          en: "Yes — and it's common. A typical setup uses pneumatics for simple grips and clamps, and electric axes where precision is actually needed. Choose the technology per motion, not per machine.",
        },
      },
    ],
    cta: {
      sv: "Beskriv din applikation så föreslår AI-rådgivaren rätt teknik — pneumatisk, elektrisk eller en kombination.",
      en: "Describe your application and the AI advisor will suggest the right technology — pneumatic, electric or a combination.",
    },
    ctaTo: "advisor",
  },

  {
    slug: "cylinder-for-vertikal-last",
    title: {
      sv: "Vilken cylinder klarar en vertikal last?",
      en: "What cylinder handles a vertical load?",
    },
    metaDescription: {
      sv: "Så dimensionerar du en cylinder för vertikal lyft eller sänkning — med räkneexempel för 40 kg, säkerhetsfaktor och varför en backslagsventil nästan alltid krävs.",
      en: "How to size a cylinder for a vertical lift or lowering motion — with a worked 40 kg example, safety factor, and why a check valve is almost always required.",
    },
    intro: {
      sv: "Vertikala laster skiljer sig från horisontella på ett avgörande sätt: tyngdkraften verkar hela tiden, även när cylindern står still. Det påverkar både hur du väljer borrning och vilken säkerhetsutrustning som krävs.",
      en: "Vertical loads differ from horizontal ones in one critical way: gravity acts continuously, even when the cylinder is standing still. That affects both how you pick the bore and what safety equipment is required.",
    },
    sections: [
      {
        h: { sv: "1. Räkna kraften med marginal", en: "1. Calculate the force with margin" },
        p: [
          {
            sv: "Kraften som krävs är F = m × g × säkerhetsfaktor, där g ≈ 9,81 m/s². Använd säkerhetsfaktor 2 som utgångspunkt — högre för säkerhetskritiska laster eller last ovanför personal. En 40 kg last kräver då minst 40 × 9,81 × 2 ≈ 785 N.",
            en: "The required force is F = m × g × safety factor, where g ≈ 9.81 m/s². Use a safety factor of 2 as a baseline — higher for safety-critical loads or loads positioned above personnel. A 40 kg load then needs at least 40 × 9.81 × 2 ≈ 785 N.",
          },
        ],
      },
      {
        h: { sv: "2. Välj borrning", en: "2. Pick the bore" },
        p: [
          {
            sv: "Vid 6 bar ger en Ø40-cylinder ungefär 750 N — nätt och jämnt under kravet för exemplet ovan. En Ø50-cylinder (~1 180 N) ger tydligare marginal och är det vanligare valet i praktiken när lasten ligger nära en gränsdiameter.",
            en: "At 6 bar, a Ø40 cylinder gives roughly 750 N — just under the requirement in the example above. A Ø50 cylinder (~1,180 N) gives a clearer margin and is the more common choice in practice when the load sits close to a boundary diameter.",
          },
        ],
      },
      {
        h: { sv: "3. Säkra mot tryckfall — backslagsventil eller broms", en: "3. Guard against pressure loss — check valve or brake" },
        p: [
          {
            sv: "En olåst vertikal cylinder faller under sin egen last om trycket försvinner — vid strömavbrott, luftläckage eller service på systemet. En pilotstyrd backslagsventil (load-holding valve) monterad direkt på cylinderporten håller lasten kvar i sitt läge tills trycket medvetet släpps. Detta är i praktiken obligatoriskt för alla vertikala lyft, inte bara tunga.",
            en: "An unlocked vertical cylinder falls under its own load if pressure is lost — on a power cut, an air leak, or system maintenance. A pilot-operated check valve (load-holding valve) mounted directly on the cylinder port holds the load in place until pressure is deliberately released. This is in practice mandatory for any vertical lift, not just heavy ones.",
          },
        ],
      },
      {
        h: { sv: "4. Elektrisk axel som alternativ", en: "4. Electric axis as an alternative" },
        p: [
          {
            sv: "En elektrisk axel med självlåsande kulskruv kan hålla en vertikal last i valfritt läge utan ström och utan separat backslagsventil. Det är ett naturligt alternativ när lasten även kräver exakt positionering, inte bara ett fast övre och undre läge.",
            en: "An electric axis with a self-locking ball screw can hold a vertical load at any position without power and without a separate check valve. It's a natural alternative when the load also needs precise positioning, not just a fixed top and bottom position.",
          },
        ],
      },
    ],
    faq: [
      {
        q: { sv: "Vilken cylinder klarar 40 kg vertikalt?", en: "What cylinder handles 40 kg vertically?" },
        a: {
          sv: "Med säkerhetsfaktor 2 krävs ≈ 785 N (40 kg × 9,81 × 2). Vid 6 bar motsvarar det minst en Ø40-cylinder (~750 N), men Ø50 (~1 180 N) är det vanligare valet för tydligare marginal. Lägg alltid till en backslagsventil så att lasten inte faller vid tryckfall.",
          en: "With a safety factor of 2, you need ≈ 785 N (40 kg × 9.81 × 2). At 6 bar that's at least a Ø40 cylinder (~750 N), but Ø50 (~1,180 N) is the more common choice for a clearer margin. Always add a check valve so the load can't fall on pressure loss.",
        },
      },
      {
        q: { sv: "Behöver jag alltid en backslagsventil för vertikala laster?", en: "Do I always need a check valve for vertical loads?" },
        a: {
          sv: "I praktiken ja. Utan den faller lasten okontrollerat vid tryckfall, strömavbrott eller service — oavsett hur väl tilltagen cylinderns kraft är. Detta gäller även lätta laster om de sitter ovanför personal eller känslig utrustning.",
          en: "In practice, yes. Without one, the load falls uncontrolled on pressure loss, a power cut, or maintenance — regardless of how generously the cylinder force is sized. This applies even to light loads if they're positioned above personnel or sensitive equipment.",
        },
      },
      {
        q: { sv: "Skiljer sig säkerhetsfaktorn för vertikala jämfört med horisontella laster?", en: "Does the safety factor differ for vertical vs. horizontal loads?" },
        a: {
          sv: "Grundregeln (25–50 % marginal, eller faktor 2) gäller båda, men vertikala laster har ett extra krav: håll-funktionen vid tryckfall. Det är inte en högre siffra i själva kraftberäkningen, utan ett extra säkerhetslager (backslagsventil eller mekanisk broms) som horisontella laster oftast klarar sig utan.",
          en: "The base rule (25–50 % margin, or a factor of 2) applies to both, but vertical loads have one extra requirement: holding on pressure loss. It's not a higher number in the force calculation itself, but an extra layer of safety (check valve or mechanical brake) that horizontal loads usually don't need.",
        },
      },
    ],
    cta: {
      sv: "Beskriv lasten och rörelsen så räknar AI-rådgivaren fram rätt cylinder — med backslagsventil inkluderad i stycklistan där det behövs.",
      en: "Describe the load and motion and the AI advisor will work out the right cylinder — with a check valve included in the bill of materials where needed.",
    },
    ctaTo: "advisor",
  },

  {
    slug: "valja-ratt-gripdon",
    title: {
      sv: "Välja rätt gripdon: mekanisk gripper eller vakuum?",
      en: "Choosing the right end effector: mechanical gripper or vacuum?",
    },
    metaDescription: {
      sv: "Mekanisk gripklo eller vakuumgrip? Så väljer du teknik, dimensionerar gripkraft eller vakuumkraft med säkerhetsmarginal, och när du behöver högre luftflöde.",
      en: "Mechanical gripper or vacuum? How to choose the technology, size the grip or vacuum force with a safety margin, and when you need higher airflow.",
    },
    intro: {
      sv: "Gripdonet är det som faktiskt håller i detaljen — och fel val eller fel dimensionering är den vanligaste orsaken till tappade delar. Valet står oftast mellan mekanisk gripklo och vakuum.",
      en: "The end effector is what actually holds the part — and the wrong choice or wrong sizing is the most common cause of dropped parts. The choice is usually between a mechanical gripper and vacuum.",
    },
    sections: [
      {
        h: { sv: "1. Mekanisk gripper eller vakuum?", en: "1. Mechanical gripper or vacuum?" },
        p: [
          {
            sv: "Mekanisk gripklo passar detaljer med parallella eller definierade gripytor — block, cylindriska delar, komponenter med flänsar att greppa runt. Vakuum passar plana, täta och icke-porösa ytor — kartonger, glasskivor, plåt, folierade eller släta plastdetaljer.",
            en: "A mechanical gripper suits parts with parallel or well-defined grip surfaces — blocks, cylindrical parts, components with a flange to grip around. Vacuum suits flat, sealed and non-porous surfaces — cartons, glass panels, sheet metal, foil-wrapped or smooth plastic parts.",
          },
        ],
      },
      {
        h: { sv: "2. Dimensionera vakuumgrip", en: "2. Sizing a vacuum grip" },
        p: [
          {
            sv: "Hållkraften är ungefär F = vakuumnivå × sugkoppens area, med säkerhetsfaktor 2–4 beroende på orientering och acceleration — högre faktor vid snabba rörelser eller om lasten hänger horisontellt ut från sugkoppen. Porösa eller ojämna ytor läcker och kräver en ejektor med högre flöde för att hålla vakuumnivån.",
            en: "The holding force is roughly F = vacuum level × suction-cup area, with a safety factor of 2–4 depending on orientation and acceleration — higher for fast moves or if the load hangs out horizontally from the cup. Porous or uneven surfaces leak and need a higher-flow ejector to maintain the vacuum level.",
          },
        ],
      },
      {
        h: { sv: "3. Dimensionera mekanisk gripper", en: "3. Sizing a mechanical gripper" },
        p: [
          {
            sv: "Klämkraften måste övervinna detaljens vikt via friktionen mellan gripbackar och yta — inte bara motsvara vikten direkt. Släta eller feta ytor har lägre friktionskoefficient och kräver högre klämkraft eller formanpassade gripbackar för att inte glida.",
            en: "The clamping force has to overcome the part's weight via the friction between the jaws and the surface — not simply match the weight directly. Smooth or greasy surfaces have a lower friction coefficient and need higher clamping force or shaped jaws to avoid slipping.",
          },
        ],
      },
      {
        h: { sv: "4. Cykeltid och säkerhet", en: "4. Cycle time and safety" },
        p: [
          {
            sv: "Snabba cykler kräver snabbutlopp (quick-exhaust) för snabb frisläppning. Vid laster ovanför personal eller i säkerhetskritiska processer bör grepp-kretsen ha dubbla backslagsventiler så att ett enskilt fel inte kan släppa lasten okontrollerat.",
            en: "Fast cycles need quick-exhaust valves for rapid release. For loads above personnel or in safety-critical processes, the grip circuit should use dual check valves so a single fault can't drop the load uncontrolled.",
          },
        ],
      },
    ],
    faq: [
      {
        q: { sv: "Hur beräknar jag vakuumkraften för en sugkopp?", en: "How do I calculate the vacuum force for a suction cup?" },
        a: {
          sv: "Ungefär F = vakuumnivå × sugkoppens area, sedan delat med säkerhetsfaktor 2–4. En större sugkopp eller flera koppar i grupp ger mer hållkraft och bättre marginal mot läckage vid ojämna ytor.",
          en: "Roughly F = vacuum level × suction-cup area, then divided by a safety factor of 2–4. A larger cup, or several cups grouped together, gives more holding force and better margin against leakage on uneven surfaces.",
        },
      },
      {
        q: { sv: "Vilken säkerhetsmarginal behöver ett vakuumgrepp?", en: "What safety margin does a vacuum grip need?" },
        a: {
          sv: "2–4 gånger den beräknade lasten är standard. Använd den högre delen av intervallet vid snabba rörelser, om lasten hänger horisontellt ut från sugkoppen, eller om ytan är något porös eller ojämn.",
          en: "2–4 times the calculated load is standard. Use the higher end of that range for fast moves, if the load hangs out horizontally from the cup, or if the surface is somewhat porous or uneven.",
        },
      },
      {
        q: { sv: "När ska jag välja mekanisk gripper istället för vakuum?", en: "When should I choose a mechanical gripper instead of vacuum?" },
        a: {
          sv: "När detaljen har en definierad gripyta att klämma runt, är porös eller ojämn (vakuum läcker), eller väger mer än vad en rimligt dimensionerad vakuumlösning klarar med marginal. Mekanisk gripper ger också ett fastare grepp vid snabba eller ryckiga rörelser.",
          en: "When the part has a well-defined surface to clamp around, is porous or uneven (vacuum leaks), or is heavier than a reasonably sized vacuum solution can handle with margin. A mechanical gripper also gives a firmer hold during fast or jerky motions.",
        },
      },
    ],
    cta: {
      sv: "Beskriv detaljen och rörelsen så föreslår AI-rådgivaren rätt gripdon — mekaniskt eller vakuum — med rätt dimensionering.",
      en: "Describe the part and the motion and the AI advisor will suggest the right end effector — mechanical or vacuum — correctly sized.",
    },
    ctaTo: "advisor",
  },

  {
    slug: "valja-kapslingsklass-ip",
    title: {
      sv: "Vilken kapslingsklass (IP) behöver jag?",
      en: "What IP rating do I need?",
    },
    metaDescription: {
      sv: "IP54, IP65, IP67 eller IP69K? Så tolkar du IP-koden, väljer rätt klass för din miljö, och varför IP-klassning ensamt inte räcker i livsmedelsindustrin.",
      en: "IP54, IP65, IP67 or IP69K? How to read the IP code, choose the right class for your environment, and why IP rating alone isn't enough in food production.",
    },
    intro: {
      sv: "IP-koden beskriver skydd mot damm och vätska — inget annat. Fel klass ger antingen en komponent som havererar i drift, eller en onödigt dyr överdimensionering.",
      en: "The IP code describes protection against dust and liquid — nothing else. The wrong class gives you either a component that fails in service, or an unnecessarily expensive over-specification.",
    },
    sections: [
      {
        h: { sv: "1. Så läser du koden", en: "1. How to read the code" },
        p: [
          {
            sv: "IP följs av två siffror: den första anger skydd mot fasta partiklar (0–6, där 6 är dammtätt), den andra skydd mot vätska (0–9K, där högre nummer är starkare skydd). IP65 och IP67 är alltså inte en gradering på samma skala — sista siffran mäter olika saker beroende på nivå.",
            en: "IP is followed by two digits: the first is protection against solid particles (0–6, where 6 is dust-tight), the second is protection against liquid (0–9K, where a higher number is stronger protection). IP65 and IP67 aren't a simple ranking on one scale — the second digit measures different test conditions at different levels.",
          },
        ],
      },
      {
        h: { sv: "2. IP54/65 — normal industrimiljö", en: "2. IP54/65 — standard industrial environment" },
        p: [
          {
            sv: "IP54 (dammskyddad, skyddad mot vattenstänk) räcker för de flesta torra fabriksmiljöer. IP65 (dammtät, skyddad mot vattenstrålar från alla håll) är standardvalet så fort utrustningen kan spolas av eller utsättas för regn — men innebär inte skydd mot nedsänkning.",
            en: "IP54 (dust-protected, splash-resistant) is enough for most dry factory environments. IP65 (dust-tight, protected against water jets from any direction) is the standard choice as soon as the equipment might be hosed down or exposed to rain — but it does not mean protection against immersion.",
          },
        ],
      },
      {
        h: { sv: "3. IP67 — tillfällig nedsänkning", en: "3. IP67 — temporary immersion" },
        p: [
          {
            sv: "IP67 tål tillfällig nedsänkning i vatten (vanligen upp till 1 meter, 30 minuter). Relevant utomhus, i källare med risk för vatten på golvet, eller där utrustningen tillfälligt kan hamna under vatten — men inte konstant nedsänkt.",
            en: "IP67 tolerates temporary immersion in water (typically up to 1 metre, 30 minutes). Relevant outdoors, in basements with a risk of standing water, or anywhere the equipment might briefly end up under water — but not permanently submerged.",
          },
        ],
      },
      {
        h: { sv: "4. IP69K — högtryckstvätt och livsmedel", en: "4. IP69K — high-pressure wash and food production" },
        p: [
          {
            sv: "IP69K tål högtrycks- och högtemperaturspolning (typiskt ~80–100 bar, ~80 °C) och är standard i livsmedels- och läkemedelsindustrin där utrustningen rengörs dagligen med högtryckstvätt. IP-klassning ensamt räcker dock inte i livsmedelsmiljö — materialet måste också vara godkänt för kontakt med livsmedel och smörjmedlet livsmedelsklassat (H1). Kombineras oftast med rostfri konstruktion.",
            en: "IP69K tolerates high-pressure, high-temperature washdown (typically ~80–100 bar, ~80 °C) and is standard in food and pharmaceutical production where equipment is cleaned daily with a pressure washer. IP rating alone isn't enough in a food environment, though — the material also needs to be food-contact approved and the lubricant food-grade (H1). Usually paired with stainless-steel construction.",
          },
        ],
      },
    ],
    faq: [
      {
        q: { sv: "Vad är skillnaden mellan IP65 och IP67?", en: "What's the difference between IP65 and IP67?" },
        a: {
          sv: "IP65 skyddar mot vattenstrålar från alla riktningar men inte nedsänkning. IP67 skyddar mot tillfällig nedsänkning (vanligen upp till 1 meter, 30 minuter) men är inte testad för högtrycksspolning. Välj efter vilket scenario som faktiskt kan inträffa, inte bara efter siffran.",
          en: "IP65 protects against water jets from any direction but not immersion. IP67 protects against temporary immersion (typically up to 1 metre, 30 minutes) but isn't tested for high-pressure washdown. Choose based on the scenario that can actually occur, not just the number.",
        },
      },
      {
        q: { sv: "När behöver jag IP69K?", en: "When do I need IP69K?" },
        a: {
          sv: "När utrustningen rengörs regelbundet med högtrycks- och högtemperaturtvätt — typiskt i livsmedels-, läkemedels- eller mejeriproduktion. För utomhusbruk eller enstaka regnexponering räcker oftast IP65 eller IP67.",
          en: "When the equipment is regularly cleaned with high-pressure, high-temperature washdown — typically in food, pharmaceutical or dairy production. For outdoor use or occasional rain exposure, IP65 or IP67 is usually enough.",
        },
      },
      {
        q: { sv: "Räcker IP69K-klassning för livsmedelsindustrin, eller behövs mer?", en: "Is an IP69K rating enough for food production, or is more needed?" },
        a: {
          sv: "IP-klassning beskriver bara skydd mot damm och vätska — inte materialens livsmedelsgodkännande. I livsmedelsmiljö krävs dessutom material godkända för livsmedelskontakt, livsmedelsklassat smörjmedel (H1) och oftast rostfri konstruktion för att stå emot rengöringskemikalier.",
          en: "The IP rating only describes protection against dust and liquid — not the materials' food-contact approval. A food environment additionally needs food-contact-approved materials, food-grade lubricant (H1), and usually stainless-steel construction to withstand cleaning chemicals.",
        },
      },
    ],
    cta: {
      sv: "Beskriv miljön så filtrerar AI-rådgivaren fram komponenter med rätt kapslingsklass automatiskt.",
      en: "Describe the environment and the AI advisor will automatically filter for components with the right IP rating.",
    },
    ctaTo: "advisor",
  },

  {
    slug: "atex-klassad-pneumatik",
    title: {
      sv: "ATEX-klassad pneumatik — vad du behöver veta",
      en: "ATEX-rated pneumatics — what you need to know",
    },
    metaDescription: {
      sv: "Vad ATEX-direktivet kräver av pneumatiska komponenter, skillnaden mellan zonerna, och varför hela systemet — inte bara cylindern — måste vara rätt klassat.",
      en: "What the ATEX directive requires of pneumatic components, the difference between the zones, and why the whole system — not just the cylinder — has to be correctly rated.",
    },
    intro: {
      sv: "I en explosiv atmosfär räcker det inte att välja en \"ATEX-cylinder\" och tro att jobbet är klart. Klassningen gäller hela systemet, och kraven skiljer sig mellan gas- och dammiljöer.",
      en: "In an explosive atmosphere, it isn't enough to pick an \"ATEX cylinder\" and consider the job done. The rating applies to the whole system, and the requirements differ between gas and dust environments.",
    },
    sections: [
      {
        h: { sv: "1. Vad ATEX-direktivet reglerar", en: "1. What the ATEX directive covers" },
        p: [
          {
            sv: "ATEX (EU-direktiv 2014/34/EU) reglerar utrustning avsedd för explosiv atmosfär — orsakad av brandfarliga gaser, ångor eller damm. Utrustningen delas in i kategorier baserat på hur ofta den explosiva atmosfären förekommer.",
            en: "ATEX (EU directive 2014/34/EU) regulates equipment intended for explosive atmospheres — caused by flammable gases, vapours or dust. Equipment is categorised based on how often the explosive atmosphere is present.",
          },
        ],
      },
      {
        h: { sv: "2. Zonindelning: gas och damm är olika skalor", en: "2. Zone classification: gas and dust are different scales" },
        p: [
          {
            sv: "Gasmiljöer klassas som Zon 0 (kontinuerligt), Zon 1 (troligt vid normal drift) eller Zon 2 (endast vid fel). Dammiljöer använder en egen skala: Zon 20, 21 och 22, med samma logik. En komponent godkänd för gaszon är inte automatiskt godkänd för dammzon.",
            en: "Gas environments are classified as Zone 0 (continuous), Zone 1 (likely during normal operation) or Zone 2 (only under fault conditions). Dust environments use a separate scale: Zone 20, 21 and 22, with the same logic. A component approved for a gas zone isn't automatically approved for a dust zone.",
          },
        ],
      },
      {
        h: { sv: "3. Vad som gör en cylinder ATEX-godkänd", en: "3. What makes a cylinder ATEX-approved" },
        p: [
          {
            sv: "Fokus ligger på att eliminera antändningskällor: inga gnistbildande materialkombinationer i rörliga delar, begränsad yttemperatur (T-klass) så heta ytor inte antänder atmosfären, och korrekt jordning/potentialutjämning för att undvika statisk urladdning.",
            en: "The focus is eliminating ignition sources: no spark-generating material combinations in moving parts, a limited surface temperature (T-class) so hot surfaces can't ignite the atmosphere, and correct grounding/bonding to avoid static discharge.",
          },
        ],
      },
      {
        h: { sv: "4. Elektrisk eller pneumatisk aktuator i ATEX-miljö", en: "4. Electric or pneumatic actuator in an ATEX environment" },
        p: [
          {
            sv: "Pneumatiska aktuatorer föredras ofta i ATEX-zoner eftersom själva rörelsen inte kräver el vid aktuatorn. Det befriar dock inte styrkretsen — magnetventiler, sensorer och kablage i zonen måste ändå vara ATEX-klassade. Elektriska aktuatorer i ATEX-zon kräver Ex-klassade motorer och kapslingar, vilket ofta gör dem dyrare och mer komplexa i explosiv miljö.",
            en: "Pneumatic actuators are often preferred in ATEX zones because the motion itself doesn't need electricity at the actuator. That doesn't exempt the control circuit, though — solenoid valves, sensors and cabling in the zone still need ATEX ratings. Electric actuators in an ATEX zone need Ex-rated motors and enclosures, which often makes them more expensive and complex in an explosive environment.",
          },
        ],
      },
    ],
    faq: [
      {
        q: { sv: "Vad är skillnaden mellan ATEX zon 1 och zon 2?", en: "What's the difference between ATEX Zone 1 and Zone 2?" },
        a: {
          sv: "Zon 1 gäller där en explosiv atmosfär sannolikt förekommer vid normal drift. Zon 2 gäller där det bara kan inträffa under onormala förhållanden och mer sällan. Zon 2 har därför mindre stränga krav på utrustningen än zon 1.",
          en: "Zone 1 applies where an explosive atmosphere is likely to occur during normal operation. Zone 2 applies where it can only occur under abnormal conditions and less often. Zone 2 therefore has less stringent equipment requirements than Zone 1.",
        },
      },
      {
        q: { sv: "Behöver jag ATEX-klassade komponenter i hela systemet?", en: "Do I need ATEX-rated components throughout the whole system?" },
        a: {
          sv: "Ja. Varje komponent som befinner sig inuti den klassade zonen — cylinder, ventil, sensor, kablage — måste vara godkänd för den zonen. Det räcker inte att bara cylindern är ATEX-märkt om ventilen som styr den sitter i samma zon utan klassning.",
          en: "Yes. Every component located inside the classified zone — cylinder, valve, sensor, cabling — must be approved for that zone. It isn't enough for only the cylinder to carry an ATEX mark if the valve driving it sits in the same zone without a rating.",
        },
      },
      {
        q: { sv: "Är pneumatik säkrare än el i explosiv miljö?", en: "Is pneumatics safer than electric in an explosive environment?" },
        a: {
          sv: "Pneumatiska aktuatorer genererar inte elektriska gnistor i själva rörelsen, vilket ofta gör dem det enklare valet i ATEX-zon. Men styrkretsen — magnetventiler och sensorer — behöver ändå vara ATEX-klassad oavsett vilken teknik som driver rörelsen.",
          en: "Pneumatic actuators don't generate electrical sparks in the motion itself, which often makes them the simpler choice in an ATEX zone. But the control circuit — solenoid valves and sensors — still needs ATEX rating regardless of which technology drives the motion.",
        },
      },
    ],
    cta: {
      sv: "Beskriv zonen och applikationen så filtrerar AI-rådgivaren fram ATEX-klassade komponenter i hela kedjan.",
      en: "Describe the zone and the application and the AI advisor will filter for ATEX-rated components across the whole chain.",
    },
    ctaTo: "advisor",
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
