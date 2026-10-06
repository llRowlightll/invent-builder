import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Egen, anonym mätning (tabellen handelser): varifrån besöken kommer och vad
 * besökarna gör. Byggd inför LinkedIn-lanseringen -- Google Analytics laddas
 * inte i drift, och skulle bara se dem som godkänner alla cookies.
 */
export const Route = createFileRoute("/$locale/admin/statistik")({
  component: Statistik,
});

type Rad = { typ: string; sida: string | null; sprak: string | null; data: Record<string, unknown>; skapad: string };

const TYPER: { typ: string; namn: string; ikon: string }[] = [
  { typ: "besok", namn: "Besök utifrån", ikon: "👋" },
  { typ: "sok", namn: "Sökningar", ikon: "🔍" },
  { typ: "ai_fraga", namn: "AI-frågor", ikon: "✦" },
  { typ: "ersatt", namn: "Ersättningar", ikon: "🔁" },
  { typ: "stycklista", namn: "Stycklistor", ikon: "📋" },
  { typ: "offert", namn: "Offerter/beställningar", ikon: "📨" },
];

function topp(rader: Rad[], typ: string, nyckel: string, n = 12): [string, number][] {
  const antal = new Map<string, number>();
  for (const r of rader) {
    if (r.typ !== typ) continue;
    const v = String(r.data?.[nyckel] ?? "–").trim().toLowerCase() || "–";
    antal.set(v, (antal.get(v) ?? 0) + 1);
  }
  return [...antal.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function Statistik() {
  const { locale } = Route.useParams();
  const [dagar, setDagar] = useState(7);
  const [rader, setRader] = useState<Rad[] | null>(null);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    setRader(null);
    const sedan = new Date(Date.now() - dagar * 86_400_000).toISOString();
    supabase.from("handelser" as never).select("typ, sida, sprak, data, skapad")
      .gte("skapad", sedan).order("skapad", { ascending: false }).limit(10_000)
      .then(({ data, error }) => {
        if (error) { setFel(error.message); setRader([]); return; }
        setRader((data ?? []) as unknown as Rad[]);
      });
  }, [dagar]);

  const antal = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rader ?? []) m.set(r.typ, (m.get(r.typ) ?? 0) + 1);
    return m;
  }, [rader]);

  const senaste = (typ: string, n = 15) => (rader ?? []).filter((r) => r.typ === typ).slice(0, n);

  return (
    <div className="container-page py-8 max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/$locale/admin/dashboard" params={{ locale }} className="text-sm text-muted-foreground hover:text-info">← Översikt</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">📈 Statistik</h1>
          <p className="text-sm text-muted-foreground">Anonym mätning: inga cookies, inga IP-adresser, inga användar-id.</p>
        </div>
        <div className="flex gap-1">
          {[1, 7, 30].map((d) => (
            <button key={d} type="button" onClick={() => setDagar(d)}
              className={`rounded-md px-3 py-1.5 text-sm ${dagar === d ? "bg-info text-primary-foreground" : "border border-border hover:border-info"}`}>
              {d === 1 ? "1 dag" : `${d} dagar`}
            </button>
          ))}
        </div>
      </div>

      {fel && <p className="text-sm text-destructive">{fel}</p>}
      {!rader ? <p className="text-sm text-muted-foreground">Laddar…</p> : (
        <>
          {/* Tratten: från besök till offert */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {TYPER.map((t) => (
              <div key={t.typ} className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">{t.ikon} {t.namn}</div>
                <div className="mt-1 text-2xl font-semibold">{antal.get(t.typ) ?? 0}</div>
              </div>
            ))}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Lista titel="Besök per källa" rader={topp(rader, "besok", "fran")} />
            <Lista titel="LinkedIn-kampanjer (utm_campaign)" rader={topp(rader, "besok", "utm_campaign").filter(([k]) => k !== "–")} />
            <Lista titel="Vanligaste sökningarna" rader={topp(rader, "sok", "q", 15)} />
            <Lista titel="Ersättningskoder" rader={topp(rader, "ersatt", "kod", 15)} />
          </div>

          <section>
            <h2 className="text-lg font-semibold">Senaste AI-frågorna</h2>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-sm">
              {senaste("ai_fraga").map((r, i) => (
                <li key={i} className="flex gap-3 px-3 py-2">
                  <span className="shrink-0 text-xs text-muted-foreground w-28">{new Date(r.skapad).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span>
                  <span className="shrink-0 text-xs rounded bg-surface-alt px-1.5 py-0.5">{String(r.data?.vag ?? "")}</span>
                  <span>{String(r.data?.fraga ?? "")}</span>
                </li>
              ))}
              {senaste("ai_fraga").length === 0 && <li className="px-3 py-2 text-muted-foreground">Inga ännu.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Lista({ titel, rader }: { titel: string; rader: [string, number][] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{titel}</h2>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {rader.map(([k, n]) => (
            <tr key={k} className="border-t border-border">
              <td className="py-1.5 pr-3">{k}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{n}</td>
            </tr>
          ))}
          {rader.length === 0 && <tr><td className="py-1.5 text-muted-foreground">Inga ännu.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
