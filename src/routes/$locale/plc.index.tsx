import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { importeraKrav } from "@/lib/plc/krav";
import { listaProjekt, skapaBefintligMaskin } from "@/lib/plc/lagring";
import { tomtUnderlag } from "@/lib/plc/modell";

/**
 * Ingång B: "Styrning & programmering" i menyn. Två vägar till samma
 * projektmodell: ett befintligt maskinprojekt, eller en befintlig maskin
 * utan maskinbyggarens komponenter.
 */
export const Route = createFileRoute("/$locale/plc/")({
  head: () => ({
    meta: [
      { title: "Styrning & programmering — Maskinval" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlcIngang,
});

function PlcIngang() {
  const { locale } = Route.useParams();
  const tx = (sv: string, en: string) => (locale === "sv" ? sv : en);
  const { user, loading: authLaddar } = useAuth();
  const navigate = useNavigate();
  const [val, setVal] = useState<"projekt" | "maskin" | null>(null);
  const [projekt, setProjekt] = useState<Array<{ id: string; name: string; typ: string; updated_at: string }> | null>(null);
  const [laddfel, setLaddfel] = useState("");
  const [namn, setNamn] = useState("");
  const [beskrivning, setBeskrivning] = useState("");
  const [skapar, setSkapar] = useState(false);
  const [skapfel, setSkapfel] = useState("");

  useEffect(() => {
    if (val !== "projekt" || !user || projekt) return;
    listaProjekt()
      .then(setProjekt)
      .catch(() => setLaddfel(tx("Projekten kunde inte hämtas.", "The projects could not be loaded.")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val, user]);

  async function skapaMaskin(e: React.FormEvent) {
    e.preventDefault();
    if (!namn.trim() || skapar) return;
    setSkapar(true);
    setSkapfel("");
    try {
      // En befintlig maskin har ingen stycklista; kraven hämtas ur beskrivningen.
      const importerat = importeraKrav({ name: namn, description: beskrivning, answers: {}, bom_lines: [], revision: 1 });
      const id = await skapaBefintligMaskin(namn.trim(), beskrivning.trim(), locale, tomtUnderlag(importerat));
      navigate({ to: "/$locale/plc/$projektId", params: { locale, projektId: id } });
    } catch {
      setSkapfel(tx("Projektet kunde inte skapas. Försök igen.", "The project could not be created. Please try again."));
      setSkapar(false);
    }
  }

  if (authLaddar) {
    return (
      <div className="container-page py-10 max-w-3xl" aria-busy="true">
        <div className="h-8 w-72 bg-muted rounded animate-pulse mb-4" />
        <div className="h-24 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-page py-20 text-center max-w-xl">
        <h1 className="text-2xl font-semibold text-foreground mb-3">{tx("Styrning & programmering", "Control & programming")}</h1>
        <p className="text-muted-foreground mb-6">
          {tx("Underlaget sparas i ditt projekt, så du behöver vara inloggad.", "The documentation is saved in your project, so you need to be signed in.")}
        </p>
        <Link to="/$locale/login" params={{ locale }} search={{ redirect: `/${locale}/plc` }} className="inline-block px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition">
          {tx("Logga in", "Sign in")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold text-foreground">{tx("Styrning & programmering", "Control & programming")}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
        {tx(
          "Programmeringsunderlag för en maskin: funktionsbeskrivning, I/O-lista, sekvens, larm, parametrar och testplan. Underlaget är ett utkast att granska och inte godkänt för maskindrift.",
          "Programming documentation for a machine: functional description, I/O list, sequence, alarms, parameters and test plan. It is a draft to review and is not approved for machine operation.",
        )}
      </p>

      <h2 className="text-base font-semibold text-foreground mt-8 mb-3">{tx("Vad vill du göra?", "What do you want to do?")}</h2>
      <div className="grid sm:grid-cols-2 gap-3" role="group" aria-label={tx("Vad vill du göra?", "What do you want to do?")}>
        <button
          type="button"
          onClick={() => setVal("projekt")}
          aria-pressed={val === "projekt"}
          className={`text-left rounded-lg border p-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${val === "projekt" ? "border-info bg-info/5" : "border-border bg-card hover:border-info/60"}`}
        >
          <div className="font-medium text-foreground">{tx("Komplettera ett befintligt projekt", "Complete an existing project")}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {tx("Ett projekt från maskinbyggaren. Kraven och komponenterna följer med.", "A project from the machine builder. Its requirements and components come along.")}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setVal("maskin")}
          aria-pressed={val === "maskin"}
          className={`text-left rounded-lg border p-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${val === "maskin" ? "border-info bg-info/5" : "border-border bg-card hover:border-info/60"}`}
        >
          <div className="font-medium text-foreground">{tx("Få hjälp med en befintlig maskin", "Get help with an existing machine")}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {tx("Utan att först välja nya komponenter.", "Without first choosing new components.")}
          </div>
        </button>
      </div>

      {val === "projekt" && (
        <section className="mt-6" aria-labelledby="valj-projekt">
          <h2 id="valj-projekt" className="text-base font-semibold text-foreground mb-3">{tx("Välj projekt", "Choose a project")}</h2>
          {laddfel && <p role="alert" className="text-sm text-destructive">{laddfel}</p>}
          {!projekt && !laddfel && <p className="text-sm text-muted-foreground">{tx("Hämtar projekt …", "Loading projects …")}</p>}
          {projekt && projekt.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {tx("Du har inga sparade projekt ännu. ", "You have no saved projects yet. ")}
              <Link to="/$locale/machine-builder" params={{ locale }} className="underline text-info">
                {tx("Bygg en maskin först", "Build a machine first")}
              </Link>
              {tx(", eller välj en befintlig maskin ovan.", ", or choose an existing machine above.")}
            </p>
          )}
          {projekt && projekt.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {projekt.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/$locale/plc/$projektId"
                    params={{ locale, projektId: p.id }}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                  >
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {p.typ === "befintlig_maskin" ? tx("Befintlig maskin", "Existing machine") : tx("Maskinbyggaren", "Machine builder")}
                      {" · "}
                      {new Date(p.updated_at).toLocaleDateString(locale === "sv" ? "sv-SE" : "en-GB")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {val === "maskin" && (
        <form className="mt-6 space-y-4 max-w-xl" onSubmit={skapaMaskin}>
          <div>
            <label htmlFor="maskin-namn" className="block text-sm font-medium text-foreground mb-1">
              {tx("Namn på maskinen eller stationen", "Name of the machine or station")}
            </label>
            <input
              id="maskin-namn"
              required
              maxLength={200}
              value={namn}
              onChange={(e) => setNamn(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
            />
          </div>
          <div>
            <label htmlFor="maskin-beskrivning" className="block text-sm font-medium text-foreground mb-1">
              {tx("Vad gör maskinen? (valfritt)", "What does the machine do? (optional)")}
            </label>
            <textarea
              id="maskin-beskrivning"
              rows={4}
              value={beskrivning}
              onChange={(e) => setBeskrivning(e.target.value)}
              aria-describedby="maskin-beskrivning-hjalp"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-info/50"
            />
            <p id="maskin-beskrivning-hjalp" className="text-xs text-muted-foreground mt-1">
              {tx("Mått, laster och miljö som står här hämtas in som krav, med ursprung.", "Dimensions, loads and environment written here are imported as requirements, with their origin.")}
            </p>
          </div>
          {skapfel && <p role="alert" className="text-sm text-destructive">{skapfel}</p>}
          <button type="submit" disabled={!namn.trim() || skapar} className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50">
            {skapar ? tx("Skapar …", "Creating …") : tx("Skapa projekt", "Create project")}
          </button>
        </form>
      )}
    </div>
  );
}
