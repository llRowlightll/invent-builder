/**
 * Startsidans hero med sprängskissen (ägaren godkände testet 2026-11-16).
 *
 * Heron ser ut som förut -- marinblå, fotot på 18 %, guldglöden, rubriken och
 * sökrutan -- men är nu hög och fäst: när man scrollar plockas en
 * fotografiskt renderad ISO 15552-cylinder isär i 29 delar
 * (src/lib/sprangskiss/cylinder3d.ts). Texten tonar ut, och heron vilar på
 * hela sprängskissen med en kort rad och två knappar.
 *
 * three.js (≈ 550 kB) laddas först efter hydreringen, så den första
 * renderingen påverkas inte. Utan WebGL står heron kvar som förut.
 * Telefoner, stående surfplattor och "minska rörelse" får sprängskissen som
 * stillbild under texten (samma fem villkor i styles.css och här).
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import type { CylinderScen } from "@/lib/sprangskiss/cylinder3d";

const GATES = [
  "(max-width: 720px)",
  "(orientation: portrait) and (max-width: 1024px)",
  "(orientation: portrait) and (pointer: coarse)",
  "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
  "(prefers-reduced-motion: reduce)",
];

const TEXT: Record<string, { rad1: string; rad2: string; bygg: string; katalog: string; scrolla: string; etikett: string; not: string }> = {
  sv: { rad1: "29 delar.", rad2: "Vi vet var varenda en sitter.", bygg: "Bygg din maskin", katalog: "Se katalogen", scrolla: "Scrolla", etikett: "En pneumatisk cylinder som plockas isär i 29 delar när du scrollar", not: "Schematisk ISO 15552-cylinder Ø50" },
  en: { rad1: "29 parts.", rad2: "We know where every one goes.", bygg: "Build your machine", katalog: "Browse the catalogue", scrolla: "Scroll", etikett: "A pneumatic cylinder that comes apart into 29 parts as you scroll", not: "Schematic ISO 15552 cylinder Ø50" },
  de: { rad1: "29 Teile.", rad2: "Wir wissen, wo jedes sitzt.", bygg: "Maschine bauen", katalog: "Zum Katalog", scrolla: "Scrollen", etikett: "Ein Pneumatikzylinder, der beim Scrollen in 29 Teile zerlegt wird", not: "Schematischer ISO-15552-Zylinder Ø50" },
  es: { rad1: "29 piezas.", rad2: "Sabemos dónde va cada una.", bygg: "Configura tu máquina", katalog: "Ver el catálogo", scrolla: "Desliza", etikett: "Un cilindro neumático que se desmonta en 29 piezas al desplazarte", not: "Cilindro ISO 15552 Ø50 esquemático" },
};

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function harWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function SprangskissHero({ locale, bakgrund, children }: { locale: Locale; bakgrund: string; children: ReactNode }) {
  const tx = TEXT[locale] ?? TEXT.en;
  const sektion = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const slut = useRef<HTMLDivElement>(null);
  const raknare = useRef<HTMLDivElement>(null);
  const scrolla = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sektion.current, cv = canvas.current;
    if (!el || !cv || !harWebGL()) return;
    const mqls = GATES.map((q) => matchMedia(q));
    const statiskt = () => mqls.some((m) => m.matches);
    let scen: CylinderScen | null = null;
    let avbruten = false;
    let ram = 0;
    const sista = { t: -1, s: -1, c: -1, r: "", u: -1 };

    const progress = () => {
      const r = el.getBoundingClientRect();
      const langd = r.height - innerHeight;
      return langd > 0 ? Math.min(1, Math.max(0, -r.top / langd)) : 0;
    };
    // Skriv bara till DOM när värdet ändrats.
    const uppdatera = () => {
      ram = 0;
      if (statiskt()) {
        scen?.setProgress(1);
        if (text.current) { text.current.style.opacity = ""; text.current.style.transform = ""; }
        return;
      }
      const p = progress();
      scen?.setProgress(p);
      const t = 1 - ss(0.03, 0.15, p);
      if (text.current && Math.abs(t - sista.t) > 0.004) {
        sista.t = t;
        text.current.style.opacity = t.toFixed(3);
        text.current.style.transform = `translateY(${((1 - t) * -24).toFixed(1)}px)`;
        text.current.style.pointerEvents = t < 0.4 ? "none" : "";
      }
      const s = ss(0.84, 0.95, p);
      if (slut.current && Math.abs(s - sista.s) > 0.004) {
        sista.s = s;
        slut.current.style.opacity = s.toFixed(3);
        slut.current.style.transform = `translateY(${((1 - s) * 16).toFixed(1)}px)`;
        slut.current.style.pointerEvents = s > 0.5 ? "auto" : "none";
      }
      const c = ss(0.12, 0.3, p) * (1 - ss(0.84, 0.92, p));
      if (raknare.current && Math.abs(c - sista.c) > 0.004) { sista.c = c; raknare.current.style.opacity = c.toFixed(3); }
      const antal = `${String(Math.round(ss(0.06, 0.76, p) * 29)).padStart(2, "0")} / 29`;
      if (raknare.current && antal !== sista.r) { sista.r = antal; raknare.current.textContent = antal; }
      const u = p > 0.06 ? 0 : 1;
      if (scrolla.current && u !== sista.u) { sista.u = u; scrolla.current.style.opacity = String(u); }
    };
    const vidScroll = () => { if (!ram) ram = requestAnimationFrame(uppdatera); };
    const vidResize = () => { scen?.resize(); vidScroll(); };

    const starta = async () => {
      try {
        const { skapaCylinderScen } = await import("@/lib/sprangskiss/cylinder3d");
        if (avbruten) return;
        scen?.dispose();
        scen = skapaCylinderScen(cv, { statisk: statiskt(), bakgrund });
        cv.dataset.klar = "1";
        uppdatera();
      } catch (e) {
        console.warn("Sprängskissen kunde inte starta", e);
      }
    };
    const omstart = () => { void starta(); };

    addEventListener("scroll", vidScroll, { passive: true });
    addEventListener("resize", vidResize);
    mqls.forEach((m) => m.addEventListener("change", omstart));
    const io = new IntersectionObserver(([e]) => scen?.setActive(e.isIntersecting));
    io.observe(el);
    const synlighet = () => scen?.setActive(!document.hidden);
    document.addEventListener("visibilitychange", synlighet);
    void starta();

    return () => {
      avbruten = true;
      removeEventListener("scroll", vidScroll);
      removeEventListener("resize", vidResize);
      mqls.forEach((m) => m.removeEventListener("change", omstart));
      io.disconnect();
      document.removeEventListener("visibilitychange", synlighet);
      if (ram) cancelAnimationFrame(ram);
      scen?.dispose();
    };
  }, [bakgrund]);

  return (
    <section ref={sektion} className="sprang-hero relative bg-primary text-primary-foreground">
      <div className="sprang-scen relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden style={{ backgroundImage: `url(${bakgrund})`, backgroundSize: "cover", backgroundPosition: "center 40%", opacity: 0.18 }} />
        <div className="absolute inset-0 opacity-30" aria-hidden style={{ background: "radial-gradient(60% 50% at 80% 20%, color-mix(in oklab, var(--gold) 60%, transparent), transparent 70%)" }} />
        <canvas ref={canvas} className="sprang-canvas" role="img" aria-label={tx.etikett} />
        <div className="sprang-innehall">
          <div ref={text} className="container-page relative">{children}</div>
        </div>
        <div ref={slut} className="sprang-slut" style={{ opacity: 0, pointerEvents: "none" }}>
          <h2 className="text-[1.6rem] md:text-[2.5rem] font-bold tracking-[-0.025em] leading-tight" style={{ textShadow: "0 2px 18px rgba(8,12,28,.6)" }}>
            {tx.rad1} <span className="font-normal italic" style={{ color: "var(--gold)" }}>{tx.rad2}</span>
          </h2>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            <Link to="/$locale/machine-builder" params={{ locale }} className="rounded-md bg-gold text-gold-foreground px-5 py-3 text-sm font-semibold transition hover:brightness-105">{tx.bygg}</Link>
            <Link to="/$locale/products" params={{ locale }} className="rounded-md border border-primary-foreground/35 px-5 py-3 text-sm font-semibold transition hover:border-primary-foreground/60">{tx.katalog}</Link>
          </div>
          <p className="mt-3 text-[11px] tracking-[0.12em] uppercase text-primary-foreground/45">{tx.not}</p>
        </div>
        <div ref={raknare} className="sprang-raknare" aria-hidden style={{ opacity: 0 }}>00 / 29</div>
        <div ref={scrolla} className="sprang-scrolla" aria-hidden><i />{tx.scrolla}</div>
      </div>
    </section>
  );
}
