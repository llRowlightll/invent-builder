import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { importeraKrav } from "@/lib/plc/krav";
import { listaProjekt, skapaBefintligMaskin } from "@/lib/plc/lagring";
import { tomtUnderlag } from "@/lib/plc/modell";
import { STEG } from "@/lib/plc/steg";
import { Statusmarke } from "@/components/design/Statusmarke";

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

  // Gästvyn: vad underlaget är, vad som finns och vad som inte gör, och en väg
  // in. Fram till 2026-10-14 stod här en mening och en inloggningsknapp --
  // en återvändsgränd från ett av menyns huvudval.
  if (!user) {
    const finns = STEG.filter((s) => s.finns).length;
    return (
      <div className="container-page py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-primary">{tx("Styrning & programmering", "Control & programming")}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {tx(
              "Ett programmeringsunderlag för maskinens styrning, byggt på kraven och komponenterna från maskinbyggaren eller på en befintlig maskin. Underlaget är ett utkast att granska, inte godkänt för maskindrift.",
              "Programming documentation for the machine's control, built on the requirements and components from the machine builder or on an existing machine. It is a draft to review, not approved for machine operation.",
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/$locale/login" params={{ locale }} search={{ redirect: `/${locale}/plc` }}
              className="inline-flex h-11 items-center rounded-lg bg-cta px-5 text-[15px] font-semibold text-cta-foreground shadow-xs transition-[background-color,transform] hover:bg-cta-hover active:translate-y-px">
              {tx("Logga in och börja", "Sign in and start")}
            </Link>
            <Link to="/$locale/machine-builder" params={{ locale }} className="text-sm font-medium text-info hover:underline">
              {tx("Eller bygg maskinen först", "Or build the machine first")} →
            </Link>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tx("Underlaget sparas i ditt projekt, därför krävs inloggning.", "The documentation is saved in your project, which is why you need to sign in.")}</p>
        </div>

        <section className="mt-10 max-w-3xl" aria-labelledby="plc-steg">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="plc-steg" className="text-lg font-semibold text-foreground">{tx("Underlagets steg", "The documentation's steps")}</h2>
            <span className="text-xs text-muted-foreground">{tx(`${finns} av ${STEG.length} finns i dag`, `${finns} of ${STEG.length} available today`)}</span>
          </div>
          <ol className="kort mt-4 divide-y divide-line">
            {STEG.map((s) => (
              <li key={s.nr} className="flex gap-4 px-5 py-4">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ${s.finns ? "bg-primary/[0.07] text-primary" : "bg-muted text-muted-foreground"}`}>{s.nr}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-semibold ${s.finns ? "text-foreground" : "text-muted-foreground"}`}>{tx(s.sv, s.en)}</span>
                    <Statusmarke tillstand={s.finns ? "bekraftat" : "ejProvat"} text={s.finns ? tx("Finns", "Available") : tx("Kommer", "Coming")} locale={locale} />
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{tx(s.innehallSv, s.innehallEn)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 max-w-3xl rounded-lg bg-surface-alt px-5 py-4 text-sm" aria-labelledby="plc-gor-inte">
          <h2 id="plc-gor-inte" className="font-semibold text-foreground">{tx("Det här gör modulen inte", "What the module does not do")}</h2>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>{tx("Ingen kod genereras, kompileras eller laddas ner till en PLC.", "No code is generated, compiled or downloaded to a PLC.")}</li>
            <li>{tx("Säkerhetsfunktioner bestäms i riskbedömningen och hanteras i säkerhetskretsen, inte här.", "Safety functions are decided in the risk assessment and handled in the safety circuit, not here.")}</li>
            <li>{tx("Ett test räknas som utfört först när en person registrerat det, med namn och datum.", "A test counts as performed only once a person has recorded it, with name and date.")}</li>
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="container-page py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">{tx("Styrning & programmering", "Control & programming")}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
        {tx(
          `Programmeringsunderlag för en maskin, steg för steg. I dag finns ${STEG.filter((s) => s.finns).map((s) => s.sv.toLowerCase()).join(" och ")}; resten av stegen kommer. Underlaget är ett utkast att granska och inte godkänt för maskindrift.`,
          `Programming documentation for a machine, step by step. Available today: ${STEG.filter((s) => s.finns).map((s) => s.en.toLowerCase()).join(" and ")}; the remaining steps are coming. It is a draft to review and is not approved for machine operation.`,
        )}
      </p>

      <h2 className="text-base font-semibold text-foreground mt-8 mb-3">{tx("Vad vill du göra?", "What do you want to do?")}</h2>
      <div className="grid sm:grid-cols-2 gap-3" role="group" aria-label={tx("Vad vill du göra?", "What do you want to do?")}>
        <button
          type="button"
          onClick={() => setVal("projekt")}
          aria-pressed={val === "projekt"}
          className={`text-left rounded-xl border p-4 transition-[border-color,box-shadow] ${val === "projekt" ? "border-primary bg-surface shadow-sm ring-1 ring-primary/20" : "border-line bg-surface shadow-xs hover:border-primary/30"}`}
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
          className={`text-left rounded-xl border p-4 transition-[border-color,box-shadow] ${val === "maskin" ? "border-primary bg-surface shadow-sm ring-1 ring-primary/20" : "border-line bg-surface shadow-xs hover:border-primary/30"}`}
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
            <ul className="kort divide-y divide-line">
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
              className="w-full px-3 py-2 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40"
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
              className="w-full px-3 py-2 rounded-lg border border-input bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-cta/40"
            />
            <p id="maskin-beskrivning-hjalp" className="text-xs text-muted-foreground mt-1">
              {tx("Mått, laster och miljö som står här hämtas in som krav, med ursprung.", "Dimensions, loads and environment written here are imported as requirements, with their origin.")}
            </p>
          </div>
          {skapfel && <p role="alert" className="text-sm text-destructive">{skapfel}</p>}
          <button type="submit" disabled={!namn.trim() || skapar} className="inline-flex h-10 items-center px-5 rounded-lg bg-cta text-cta-foreground text-sm font-semibold shadow-xs hover:bg-cta-hover active:translate-y-px transition-[background-color,transform] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
            {skapar ? tx("Skapar …", "Creating …") : tx("Skapa projekt", "Create project")}
          </button>
        </form>
      )}
    </div>
  );
}
