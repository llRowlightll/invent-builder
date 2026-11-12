import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { rakna, standardKolvstang } from "@/lib/cylinderkalkyl";
import { STANDARD_BORES } from "@/lib/physics";
import { SITE, hreflangLinks } from "@/lib/site";

/**
 * Cylinderräknaren: kraft och luftförbrukning, med samma modell som
 * maskinbyggaren (se cylinderkalkyl.ts). Ingen språkmodell, inga anrop --
 * allt räknas i webbläsaren.
 */

type T = {
  titel: string; ingress: string; borr: string; tryck: string; slag: string; cykler: string; last: string; lastHjalp: string;
  stang: string; stangHjalp: string; kraft: string; ut: string; in: string; teoretisk: string; anvandbar: string;
  anvandbarHjalp: string; krav: string; racker: string; rackerInte: (d: number | null) => string; luft: string;
  perCykel: string; perMin: string; energi: string; energiHjalp: string; hitta: (d: number) => string; bygg: string;
  guideKraft: string; guideLuft: string; metaBeskrivning: string; formler: string;
};

const TEXT: Record<string, T> = {
  sv: {
    titel: "Cylinderräknare: kraft och luftförbrukning",
    ingress: "Räkna ut vad en pneumatisk cylinder ger i kraft och hur mycket luft den drar. Samma beräkning som maskinbyggaren använder.",
    borr: "Borrning", tryck: "Tryck (bar)", slag: "Slaglängd (mm)", cykler: "Dubbelslag per minut", last: "Last (kg)",
    lastHjalp: "Lämna 0 om du bara vill se kraften.", stang: "Kolvstång (mm)", stangHjalp: "Standard enligt ISO 6432 och ISO 15552. Ändra om din cylinder har en annan.",
    kraft: "Kraft", ut: "Ut", in: "In", teoretisk: "Teoretisk", anvandbar: "Användbar",
    anvandbarHjalp: "Användbar kraft räknar bort tätningsfriktionen (verkningsgrad 0,75). Jämför alltid ett krav mot den, inte mot katalogens teoretiska värde.",
    krav: "Kraftkrav för lasten (× 9,81 × säkerhetsfaktor 2)", racker: "Borrningen räcker för lasten vid det här trycket.",
    rackerInte: (d) => d ? `Borrningen räcker inte. Minsta standardborrning vid det här trycket: Ø${d}.` : "Ingen standardborrning upp till Ø200 räcker vid det här trycket.",
    luft: "Luftförbrukning", perCykel: "Nl per dubbelslag", perMin: "Nl/min", energi: "El för att producera luften",
    energiHjalp: "Ungefär 0,10–0,12 kWh per Nm³ vid 7 bar. Läckage och övertryck kommer utöver.",
    hitta: (d) => `Cylindrar i Ø${d} i alla fabrikat`, bygg: "Beskriv hela maskinen",
    guideKraft: "Guide: dimensionera en pneumatikcylinder", guideLuft: "Guide: beräkna luftförbrukning",
    metaBeskrivning: "Räkna ut kraft och luftförbrukning för en pneumatisk cylinder: teoretisk och användbar kraft ut och in, minsta borrning för en last och Nl/min.",
    formler: "Formler: kraft = π/4 · d² · p, användbar kraft = kraft · 0,75. Luft per slag = slagvolym · (p + 1,013) / 1,013; kolvstången räknas bort på returslaget.",
  },
  en: {
    titel: "Cylinder calculator: force and air consumption",
    ingress: "Work out the force a pneumatic cylinder delivers and how much air it uses. The same calculation the machine builder uses.",
    borr: "Bore", tryck: "Pressure (bar)", slag: "Stroke (mm)", cykler: "Double strokes per minute", last: "Load (kg)",
    lastHjalp: "Leave 0 to see the force only.", stang: "Piston rod (mm)", stangHjalp: "Standard per ISO 6432 and ISO 15552. Change it if your cylinder differs.",
    kraft: "Force", ut: "Extend", in: "Retract", teoretisk: "Theoretical", anvandbar: "Usable",
    anvandbarHjalp: "Usable force deducts seal friction (efficiency 0.75). Always compare a requirement against it, not the catalogue's theoretical value.",
    krav: "Force required for the load (× 9.81 × safety factor 2)", racker: "The bore is enough for the load at this pressure.",
    rackerInte: (d) => d ? `The bore is not enough. Smallest standard bore at this pressure: Ø${d}.` : "No standard bore up to Ø200 is enough at this pressure.",
    luft: "Air consumption", perCykel: "Nl per double stroke", perMin: "Nl/min", energi: "Electricity to produce the air",
    energiHjalp: "Roughly 0.10–0.12 kWh per Nm³ at 7 bar. Leakage and over-pressure come on top.",
    hitta: (d) => `Ø${d} cylinders from all brands`, bygg: "Describe the whole machine",
    guideKraft: "Guide: sizing a pneumatic cylinder", guideLuft: "Guide: calculating air consumption",
    metaBeskrivning: "Calculate force and air consumption for a pneumatic cylinder: theoretical and usable force on extend and retract, minimum bore for a load, and Nl/min.",
    formler: "Formulas: force = π/4 · d² · p, usable force = force · 0.75. Air per stroke = stroke volume · (p + 1.013) / 1.013; the rod is deducted on the return stroke.",
  },
};
TEXT.de = { ...TEXT.en,
  titel: "Zylinderrechner: Kraft und Luftverbrauch",
  ingress: "Berechnen Sie die Kraft eines Pneumatikzylinders und seinen Luftverbrauch. Dieselbe Berechnung wie im Maschinenbaukasten.",
  borr: "Kolben-Ø", tryck: "Druck (bar)", slag: "Hub (mm)", cykler: "Doppelhübe pro Minute", last: "Last (kg)",
  kraft: "Kraft", ut: "Ausfahren", in: "Einfahren", teoretisk: "Theoretisch", anvandbar: "Nutzbar", luft: "Luftverbrauch",
  metaBeskrivning: "Kraft und Luftverbrauch eines Pneumatikzylinders berechnen: theoretische und nutzbare Kraft, minimaler Kolbendurchmesser für eine Last und Nl/min.",
};
TEXT.es = { ...TEXT.en,
  titel: "Calculadora de cilindros: fuerza y consumo de aire",
  ingress: "Calcule la fuerza de un cilindro neumático y cuánto aire consume. El mismo cálculo que usa el constructor de máquinas.",
  borr: "Diámetro", tryck: "Presión (bar)", slag: "Carrera (mm)", cykler: "Ciclos dobles por minuto", last: "Carga (kg)",
  kraft: "Fuerza", ut: "Avance", in: "Retroceso", teoretisk: "Teórica", anvandbar: "Útil", luft: "Consumo de aire",
  metaBeskrivning: "Calcule la fuerza y el consumo de aire de un cilindro neumático: fuerza teórica y útil, diámetro mínimo para una carga y Nl/min.",
};

export const Route = createFileRoute("/$locale/verktyg/cylinderkraft")({
  head: ({ params }) => {
    const x = TEXT[params.locale] ?? TEXT.en;
    const canonical = `${SITE}/${params.locale}/verktyg/cylinderkraft`;
    return {
      meta: [
        { title: `${x.titel} | Maskinval` },
        { name: "description", content: x.metaBeskrivning },
        { property: "og:title", content: `${x.titel} | Maskinval` },
        { property: "og:description", content: x.metaBeskrivning },
        { property: "og:url", content: canonical },
      ],
      links: [{ rel: "canonical", href: canonical }, ...hreflangLinks("verktyg/cylinderkraft")],
    };
  },
  component: Cylinderraknare,
});

function tal(n: number, locale: string, dec = 0): string {
  return n.toLocaleString(locale === "sv" ? "sv-SE" : locale, { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

function Cylinderraknare() {
  const { locale } = Route.useParams();
  const x = TEXT[locale] ?? TEXT.en;
  const [borr, setBorr] = useState(50);
  const [tryck, setTryck] = useState(6);
  const [slag, setSlag] = useState(200);
  const [cykler, setCykler] = useState(10);
  const [last, setLast] = useState(0);
  const [stang, setStang] = useState<number | null>(null); // null = standard för borrningen
  const kolvstang = stang ?? standardKolvstang(borr) ?? 0;
  const r = useMemo(() => rakna({ borrMm: borr, tryckBar: tryck, slagMm: slag, cyklerPerMin: cykler, lastKg: last, kolvstangMm: kolvstang }),
    [borr, tryck, slag, cykler, last, kolvstang]);

  const falt = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-info/40";
  const nummer = (v: number, set: (n: number) => void, min = 0, steg = 1) => (
    <input type="number" inputMode="decimal" min={min} step={steg} value={Number.isFinite(v) ? v : ""} className={falt}
      onChange={(e) => set(Math.max(min, parseFloat(e.target.value.replace(",", ".")) || 0))} />
  );

  return (
    <div className="container-page py-10 max-w-4xl">
      <div className="flex items-center gap-2 text-info"><Calculator className="size-5" aria-hidden /></div>
      <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">{x.titel}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">{x.ingress}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-muted-foreground">{x.borr}</span>
          <select value={borr} onChange={(e) => { setBorr(Number(e.target.value)); setStang(null); }} className={`${falt} mt-1`}>
            {STANDARD_BORES.map((b) => <option key={b} value={b}>Ø{b}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="text-muted-foreground">{x.tryck}</span><div className="mt-1">{nummer(tryck, setTryck, 0, 0.5)}</div></label>
        <label className="text-sm"><span className="text-muted-foreground">{x.slag}</span><div className="mt-1">{nummer(slag, setSlag, 0, 10)}</div></label>
        <label className="text-sm"><span className="text-muted-foreground">{x.cykler}</span><div className="mt-1">{nummer(cykler, setCykler, 0, 1)}</div></label>
        <label className="text-sm">
          <span className="text-muted-foreground">{x.last}</span><div className="mt-1">{nummer(last, setLast, 0, 1)}</div>
          <span className="mt-1 block text-[11px] text-muted-foreground">{x.lastHjalp}</span>
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">{x.stang}</span><div className="mt-1">{nummer(kolvstang, (n) => setStang(n), 0, 1)}</div>
          <span className="mt-1 block text-[11px] text-muted-foreground">{x.stangHjalp}</span>
        </label>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2" aria-live="polite">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">{x.kraft}</h2>
          <table className="mt-2 w-full text-sm tabular-nums">
            <thead className="text-xs text-muted-foreground"><tr><th className="text-left font-normal" /><th className="text-right font-normal">{x.teoretisk}</th><th className="text-right font-normal">{x.anvandbar}</th></tr></thead>
            <tbody>
              <tr><td>{x.ut}</td><td className="text-right">{tal(r.teoretiskUtN, locale)} N</td><td className="text-right font-semibold">{tal(r.anvandbarUtN, locale)} N</td></tr>
              <tr><td>{x.in}</td><td className="text-right">{tal(r.teoretiskInN, locale)} N</td><td className="text-right font-semibold">{tal(r.anvandbarInN, locale)} N</td></tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground leading-snug">{x.anvandbarHjalp}</p>
          {r.kravN > 0 && (
            <div className={`mt-3 rounded-md px-3 py-2 text-sm ${r.racker ? "bg-success-surface text-success-deep" : "bg-warning-surface text-warning-deep"}`}>
              <div className="text-xs">{x.krav}: <span className="font-semibold tabular-nums">{tal(r.kravN, locale)} N</span></div>
              <div className="mt-1">{r.racker ? x.racker : x.rackerInte(r.minstaBorrMm)}</div>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">{x.luft}</h2>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">{x.perCykel}</dt><dd className="text-right font-semibold">{tal(r.nlPerCykel, locale, 2)}</dd>
            <dt className="text-muted-foreground">{x.perMin}</dt><dd className="text-right font-semibold">{tal(r.nlPerMin, locale, 0)}</dd>
            <dt className="text-muted-foreground">{x.energi}</dt><dd className="text-right">{tal(r.kwhPerTimme[0], locale, 2)}–{tal(r.kwhPerTimme[1], locale, 2)} kWh/h</dd>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground leading-snug">{x.energiHjalp}</p>
        </div>
      </section>

      <p className="mt-4 text-[11px] text-muted-foreground leading-snug max-w-3xl">{x.formler}</p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link to="/$locale/products" params={{ locale }} search={{ category: "cylinder", borr: String(r.minstaBorrMm && !r.racker ? r.minstaBorrMm : borr) } as never}
          className="rounded-md border border-border px-3 py-1.5 hover:border-info hover:text-info">
          {x.hitta(r.minstaBorrMm && !r.racker ? r.minstaBorrMm : borr)} →
        </Link>
        <Link to="/$locale/machine-builder" params={{ locale }} className="rounded-md border border-border px-3 py-1.5 hover:border-info hover:text-info">{x.bygg} →</Link>
        <Link to="/$locale/guider/$slug" params={{ locale, slug: "dimensionera-pneumatikcylinder" }} className="rounded-md border border-border px-3 py-1.5 hover:border-info hover:text-info">{x.guideKraft}</Link>
        <Link to="/$locale/guider/$slug" params={{ locale, slug: "berakna-luftforbrukning" }} className="rounded-md border border-border px-3 py-1.5 hover:border-info hover:text-info">{x.guideLuft}</Link>
      </div>
    </div>
  );
}
