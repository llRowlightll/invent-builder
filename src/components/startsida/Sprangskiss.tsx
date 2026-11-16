/**
 * Sprängskiss — startsidans scrollberättelse.
 *
 * Ägaren 2026-11-16 ville ha en framåtlutad sajt "som scrollar med en", med
 * en cylinder i sprängskiss. Cylindern byggs i 3D (CylinderScen.tsx) i stället
 * för en AI-genererad video: delarna stämmer, den är skarp i alla storlekar,
 * och den laddar ingen video. Scenen hämtas först när sektionen närmar sig,
 * så startsidans första laddning påverkas inte.
 *
 * Varje steg kopplar en del av cylindern till något sajten faktiskt gör:
 * ISO-måtten -> Ersätt, magnetringen -> givarna maskinbyggaren lägger till,
 * tätningar och dämpning -> takt och last, stången -> kraftberäkningen.
 * Inga påhittade siffror: 1 178 N är π/4 · 50² · 0,6 MPa.
 *
 * Utan WebGL, eller med "minska rörelse" påslaget, visas stegen som en
 * vanlig lista bredvid en stillbild i stället för att sidan låses vid scroll.
 */
import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Etikett } from "./CylinderScen";
import type { Locale } from "@/lib/i18n";

const CylinderScen = lazy(() => import("./CylinderScen").then((m) => ({ default: m.CylinderScen })));

type Sprak = "sv" | "en" | "de" | "es";

interface Steg { rubrik: string; text: string; lank?: { text: string } }

const TEXT: Record<Sprak, {
  etikett: string; rubrik: string; ingress: string; scrolla: string;
  steg: Steg[]; cta: string; delar: Record<Etikett["id"], string>;
}> = {
  sv: {
    etikett: "Inuti en ISO 15552-cylinder",
    rubrik: "Vi vet vad som sitter i den.",
    ingress: "Scrolla, så plockar vi isär en Ø50-cylinder del för del, och visar vad varje del betyder för ditt val.",
    scrolla: "Scrolla",
    steg: [
      { rubrik: "Gavlar och profilrör", text: "ISO 15552 låser måtten: fästen, portar och stånggänga sitter likadant hos alla åtta fabrikat. Därför kan vi ge dig en motsvarighet från ett annat märke när din gamla cylinder inte går att få tag på.", lank: { text: "Ersätt en komponent" } },
      { rubrik: "Kolv med magnetring", text: "Magnetringen i kolven är det givaren i profilens spår läser av. När styrsystemet måste veta att rörelsen är klar lägger maskinbyggaren till givarna åt dig." },
      { rubrik: "Tätningar och dämpning", text: "Tätningarna avgör livslängden, dämpningen bromsar kolven innan den slår i gaveln. Vid hög takt eller tung last är det här en cylinder ger upp först, så det är här vi frågar mest." },
      { rubrik: "Kolvstången", text: "Kraften är tryck gånger kolvarea: Ø50 vid 6 bar ger 1 178 N ut. Maskinbyggaren räknar baklänges från din last och väljer den minsta borrning som klarar den, med säkerhetsfaktor." },
    ],
    cta: "Beskriv vad din maskin ska göra",
    delar: {
      bakgavel: "Bakre gavel", profilror: "Profilrör med givarspår", framgavel: "Främre gavel",
      magnetring: "Magnetring", kolv: "Kolv", tatning_bak: "Läpptätning", tatning_fram: "Läpptätning",
      damphylsa: "Dämphylsa", avstrykare: "Avstrykare", kolvstang: "Kolvstång Ø20", mutter: "Kolvstångsmutter",
    },
  },
  en: {
    etikett: "Inside an ISO 15552 cylinder",
    rubrik: "We know what's inside.",
    ingress: "Scroll, and we take a Ø50 cylinder apart piece by piece, showing what each part means for your choice.",
    scrolla: "Scroll",
    steg: [
      { rubrik: "End caps and profile tube", text: "ISO 15552 fixes the dimensions: mountings, ports and rod thread are the same across all eight brands. That's why we can offer an equivalent from another brand when your old cylinder is no longer available.", lank: { text: "Replace a component" } },
      { rubrik: "Piston with magnet ring", text: "The magnet ring in the piston is what the sensor in the profile slot reads. When the control system needs to know a move is finished, the machine builder adds the sensors for you." },
      { rubrik: "Seals and cushioning", text: "Seals decide the service life; cushioning slows the piston before it hits the end cap. At high rates or heavy loads this is where a cylinder gives up first, so this is where we ask the most." },
      { rubrik: "The piston rod", text: "Force is pressure times piston area: Ø50 at 6 bar gives 1,178 N outward. The machine builder works back from your load and picks the smallest bore that handles it, with a safety factor." },
    ],
    cta: "Describe what your machine should do",
    delar: {
      bakgavel: "Rear end cap", profilror: "Profile tube with sensor slots", framgavel: "Front end cap",
      magnetring: "Magnet ring", kolv: "Piston", tatning_bak: "Lip seal", tatning_fram: "Lip seal",
      damphylsa: "Cushion sleeve", avstrykare: "Wiper", kolvstang: "Piston rod Ø20", mutter: "Rod nut",
    },
  },
  de: {
    etikett: "Im Inneren eines ISO-15552-Zylinders",
    rubrik: "Wir wissen, was drinsteckt.",
    ingress: "Scrollen Sie, und wir zerlegen einen Ø50-Zylinder Teil für Teil und zeigen, was jedes Teil für Ihre Wahl bedeutet.",
    scrolla: "Scrollen",
    steg: [
      { rubrik: "Deckel und Profilrohr", text: "ISO 15552 legt die Maße fest: Befestigungen, Anschlüsse und Kolbenstangengewinde sind bei allen acht Herstellern gleich. Deshalb finden wir ein Gegenstück einer anderen Marke, wenn Ihr alter Zylinder nicht mehr lieferbar ist.", lank: { text: "Komponente ersetzen" } },
      { rubrik: "Kolben mit Magnetring", text: "Den Magnetring im Kolben liest der Sensor in der Profilnut. Muss die Steuerung wissen, dass die Bewegung fertig ist, fügt der Maschinenbauer die Sensoren hinzu." },
      { rubrik: "Dichtungen und Dämpfung", text: "Die Dichtungen bestimmen die Lebensdauer, die Dämpfung bremst den Kolben vor dem Deckel. Bei hohem Takt oder schwerer Last gibt ein Zylinder hier zuerst nach, deshalb fragen wir hier am meisten." },
      { rubrik: "Die Kolbenstange", text: "Kraft ist Druck mal Kolbenfläche: Ø50 bei 6 bar ergibt 1.178 N nach außen. Der Maschinenbauer rechnet von Ihrer Last zurück und wählt die kleinste Bohrung, die sie trägt, mit Sicherheitsfaktor." },
    ],
    cta: "Beschreiben Sie, was Ihre Maschine tun soll",
    delar: {
      bakgavel: "Hinterer Deckel", profilror: "Profilrohr mit Sensornuten", framgavel: "Vorderer Deckel",
      magnetring: "Magnetring", kolv: "Kolben", tatning_bak: "Lippendichtung", tatning_fram: "Lippendichtung",
      damphylsa: "Dämpfungshülse", avstrykare: "Abstreifer", kolvstang: "Kolbenstange Ø20", mutter: "Kolbenstangenmutter",
    },
  },
  es: {
    etikett: "Dentro de un cilindro ISO 15552",
    rubrik: "Sabemos lo que lleva dentro.",
    ingress: "Desplácese y desmontamos un cilindro Ø50 pieza a pieza, mostrando qué significa cada una para su elección.",
    scrolla: "Desplazar",
    steg: [
      { rubrik: "Tapas y tubo perfilado", text: "La ISO 15552 fija las medidas: fijaciones, conexiones y rosca del vástago son iguales en las ocho marcas. Por eso podemos ofrecer un equivalente de otra marca cuando su cilindro antiguo ya no se fabrica.", lank: { text: "Sustituir un componente" } },
      { rubrik: "Émbolo con anillo magnético", text: "El anillo magnético del émbolo es lo que lee el sensor en la ranura del perfil. Cuando el control necesita saber que el movimiento terminó, el configurador añade los sensores." },
      { rubrik: "Juntas y amortiguación", text: "Las juntas deciden la vida útil; la amortiguación frena el émbolo antes de llegar a la tapa. Con ritmo alto o carga pesada, aquí es donde un cilindro falla primero, así que aquí es donde más preguntamos." },
      { rubrik: "El vástago", text: "La fuerza es presión por área del émbolo: Ø50 a 6 bar da 1.178 N hacia fuera. El configurador calcula desde su carga y elige el diámetro más pequeño que la soporta, con factor de seguridad." },
    ],
    cta: "Describa lo que debe hacer su máquina",
    delar: {
      bakgavel: "Tapa trasera", profilror: "Tubo perfilado con ranuras", framgavel: "Tapa delantera",
      magnetring: "Anillo magnético", kolv: "Émbolo", tatning_bak: "Junta de labio", tatning_fram: "Junta de labio",
      damphylsa: "Casquillo amortiguador", avstrykare: "Rascador", kolvstang: "Vástago Ø20", mutter: "Tuerca del vástago",
    },
  },
};

// Vilket steg en del hör till (samma som CylinderScen.DELAR).
const DELENS_STEG: Record<Etikett["id"], number> = {
  bakgavel: 1, profilror: 1, framgavel: 1, magnetring: 2, kolv: 2,
  tatning_bak: 3, tatning_fram: 3, damphylsa: 3, avstrykare: 3, kolvstang: 4, mutter: 4,
};
// Två läpptätningar men en etikett räcker.
const MED_ETIKETT: Etikett["id"][] = ["bakgavel", "profilror", "framgavel", "magnetring", "kolv", "tatning_fram", "damphylsa", "avstrykare", "kolvstang"];

function harWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Sprangskiss({ locale }: { locale: Locale }) {
  const sprak: Sprak = (["sv", "en", "de", "es"] as const).includes(locale as Sprak) ? (locale as Sprak) : "en";
  const tx = TEXT[sprak];
  const sektion = useRef<HTMLElement>(null);
  const framsteg = useRef(0);
  const [steg, setSteg] = useState(0);
  const [lage, setLage] = useState<"vanta" | "scroll" | "stilla">("vanta");
  const [nara, setNara] = useState(false);
  const [synlig, setSynlig] = useState(false);
  const [kompakt, setKompakt] = useState(false);

  // Avgör läge på klienten: scroll med 3D, eller stilla lista.
  useEffect(() => {
    const minska = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setLage(!minska && harWebGL() ? "scroll" : "stilla");
    const mq = window.matchMedia?.("(max-width: 767px)");
    const satt = () => setKompakt(!!mq?.matches);
    satt();
    mq?.addEventListener?.("change", satt);
    return () => mq?.removeEventListener?.("change", satt);
  }, []);

  // Ladda scenen strax innan sektionen syns; rita bara när den är i vyn.
  useEffect(() => {
    const el = sektion.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNara(true); setSynlig(true); return; }
    const forladda = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNara(true); }, { rootMargin: "600px 0px" });
    const vy = new IntersectionObserver(([e]) => setSynlig(e.isIntersecting), { rootMargin: "50px 0px" });
    forladda.observe(el);
    vy.observe(el);
    return () => { forladda.disconnect(); vy.disconnect(); };
  }, []);

  // Scrollframsteget 0–1 genom den höga sektionen.
  useEffect(() => {
    if (lage !== "scroll") { framsteg.current = 1; setSteg(4); return; }
    let ram = 0;
    const las = () => {
      ram = 0;
      const el = sektion.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const langd = r.height - window.innerHeight;
      const p = langd > 0 ? Math.min(1, Math.max(0, -r.top / langd)) : 0;
      framsteg.current = p;
      const nytt = p < 0.08 ? 0 : p < 0.3 ? 1 : p < 0.52 ? 2 : p < 0.74 ? 3 : 4;
      setSteg((g) => (g === nytt ? g : nytt));
    };
    const vidScroll = () => { if (!ram) ram = requestAnimationFrame(las); };
    las();
    window.addEventListener("scroll", vidScroll, { passive: true });
    window.addEventListener("resize", vidScroll);
    return () => {
      window.removeEventListener("scroll", vidScroll);
      window.removeEventListener("resize", vidScroll);
      if (ram) cancelAnimationFrame(ram);
    };
  }, [lage]);

  const etiketter: Etikett[] = MED_ETIKETT.map((id) => ({ id, text: tx.delar[id], steg: DELENS_STEG[id] }));
  const scen = nara && lage !== "vanta" && (
    <Suspense fallback={null}>
      <CylinderScen framsteg={framsteg} etiketter={etiketter} kompakt={kompakt} aktiv={synlig && lage === "scroll"} />
    </Suspense>
  );

  const Cta = (
    <Link
      to="/$locale/machine-builder"
      params={{ locale }}
      className="inline-flex items-center gap-2 rounded-md bg-gold text-gold-foreground px-5 py-3 text-sm font-semibold transition hover:brightness-105 active:translate-y-px"
    >
      {tx.cta} →
    </Link>
  );

  // ── Stilla: lista bredvid isärplockad bild ────────────────────────────
  if (lage === "stilla") {
    return (
      <section ref={sektion} className="sprangskiss relative text-white" aria-labelledby="sprang-rubrik">
        <div className="container-page py-16 md:py-24 grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">{tx.etikett}</p>
            <h2 id="sprang-rubrik" className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{tx.rubrik}</h2>
            <ol className="mt-8 space-y-6">
              {tx.steg.map((s, i) => (
                <li key={i}>
                  <h3 className="font-semibold"><span className="sprang-nr">0{i + 1}</span>{s.rubrik}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/70">{s.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8">{Cta}</div>
          </div>
          <div className="h-[340px] md:h-[460px]">{scen}</div>
        </div>
      </section>
    );
  }

  // ── Scroll: låst scen, stegen byts medan delarna glider isär ───────────
  return (
    <section ref={sektion} className="sprangskiss relative text-white" style={{ height: "420vh" }} aria-labelledby="sprang-rubrik">
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        <div className="sprang-rutnat" aria-hidden />
        <div className="absolute inset-0 md:left-[34%]">{scen}</div>
        <div className="container-page relative h-full pointer-events-none">
          <div className="h-full flex flex-col justify-end md:justify-center pb-8 md:pb-0 md:max-w-[34%]">
            <div className="pointer-events-auto">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">{tx.etikett}</p>
              <h2 id="sprang-rubrik" className="mt-2 text-[1.9rem] md:text-[2.6rem] leading-[1.05] font-bold tracking-[-0.02em] text-balance">{tx.rubrik}</h2>
              <div className="relative mt-5 min-h-[168px] md:min-h-[200px]">
                <p className={`absolute inset-0 text-[15px] leading-relaxed text-white/70 transition-all duration-500 ${steg === 0 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
                  {tx.ingress}
                  <span className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/45">
                    <span className="sprang-pil" aria-hidden />{tx.scrolla}
                  </span>
                </p>
                {tx.steg.map((s, i) => (
                  <div key={i} aria-hidden={steg !== i + 1}
                    className={`absolute inset-0 transition-all duration-500 ${steg === i + 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
                    <h3 className="text-lg font-semibold"><span className="sprang-nr">0{i + 1}</span>{s.rubrik}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/70">{s.text}</p>
                    {s.lank && (
                      <Link to="/$locale/replace" params={{ locale }} className="mt-3 inline-block text-sm font-medium text-[var(--gold)] hover:underline">
                        {s.lank.text} →
                      </Link>
                    )}
                    {i === 3 && <div className="mt-5">{Cta}</div>}
                  </div>
                ))}
              </div>
              {/* Stegmätare */}
              <div className="mt-6 flex gap-1.5" aria-hidden>
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={`h-[3px] rounded-full transition-all duration-500 ${steg >= n ? "w-8 bg-[var(--gold)]" : "w-4 bg-white/20"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
