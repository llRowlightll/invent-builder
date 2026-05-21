import { createFileRoute, Link } from "@tanstack/react-router";
import { makeT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/$locale/terms")({
  head: () => ({
    meta: [
      { title: "Allmänna villkor — Maskinval" },
      { name: "description", content: "Maskinvals allmänna villkor för användning av plattformen och köp av industrikomponenter." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);

  return (
    <div className="container-page py-12 max-w-3xl">
      <Link to="/$locale" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
        ← {t("common.appName")}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">Allmänna villkor</h1>
      <p className="mt-2 text-sm text-muted-foreground">Senast uppdaterad: 19 maj 2026 · Version 1.0</p>

      <div className="mt-8 space-y-8 text-sm text-foreground/80 leading-relaxed">

        <Section title="1. Om tjänsten">
          <p>
            Maskinval är en B2B-plattform för industriella automationskomponenter. Tjänsten tillhandahålls
            av Maskinval AB, org.nr 559XXX-XXXX, och riktar sig uteslutande till företag och yrkesverksamma
            (ej konsumenter). Genom att använda tjänsten accepterar du dessa villkor.
          </p>
        </Section>

        <Section title="2. Konto och behörighet">
          <ul className="space-y-1 list-disc list-inside text-foreground/70">
            <li>Du måste vara minst 18 år och ha behörighet att ingå avtal för ditt företag</li>
            <li>Du ansvarar för att hålla dina inloggningsuppgifter konfidentiella</li>
            <li>Maskinval förbehåller sig rätten att stänga konton som missbrukar tjänsten</li>
            <li>Ett konto per person — delning av konton är inte tillåtet</li>
          </ul>
        </Section>

        <Section title="3. Offerter och priser">
          <p>
            Priser på plattformen är <strong className="text-foreground">indikativa</strong> och exklusive moms
            om inget annat anges. En offertförfrågan (RFQ) utgör inte ett bindande anbud. Bindande avtal
            uppstår först när Maskinval skriftligen bekräftat en order.
          </p>
          <p className="mt-2">
            Priser kan ändras utan föregående avisering till följd av valutakurser, leverantörspriser
            eller marknadssituation. Vi förbehåller oss rätten att avvisa eller korrigera beställningar
            vid uppenbara prisfel.
          </p>
        </Section>

        <Section title="4. Leverans och ledtider">
          <p>
            Angivna ledtider är uppskattningar baserade på leverantörsinformation och är inte garanterade.
            Maskinval ansvarar inte för förseningar orsakade av leverantörer, tullformaliteter,
            transportstörningar eller force majeure-händelser.
          </p>
          <p className="mt-2">
            Leverans sker till angiven adress via PostNord eller annan speditör. Risk för gods övergår
            till köparen vid avlämnande till transportör.
          </p>
        </Section>

        <Section title="5. Betalningsvillkor">
          <ul className="space-y-1 list-disc list-inside text-foreground/70">
            <li>Standardbetalningsvillkor: 30 dagar netto från fakturadatum</li>
            <li>Vid försenad betalning debiteras dröjsmålsränta enligt räntelagen (8% + referensränta)</li>
            <li>Äganderättsförbehåll gäller tills full betalning erlagts</li>
            <li>Kreditbedömning kan ske för nya kunder</li>
          </ul>
        </Section>

        <Section title="6. Reklamationer och returer">
          <p>
            Reklamation ska ske inom <strong className="text-foreground">8 dagar</strong> från mottagandet
            av gods. Felaktiga eller skadade varor byts ut eller krediteras efter godkännande.
            Returer accepteras endast efter skriftligt godkännande från Maskinval. Returkostnad
            bärs av köparen om inte felet är på Maskinvals sida.
          </p>
        </Section>

        <Section title="7. AI-verktyg och produktrekommendationer">
          <p>
            Maskinvals AI-chat och konfigurationsverktyg är <strong className="text-foreground">beslutsstöd</strong> —
            inte ersättning för professionell ingenjörsbedömning. Maskinval ansvarar inte för skador
            som uppstår till följd av felaktiga specifikationer, dimensioneringsfel eller felaktig
            användning av produkter som valts med hjälp av AI-verktyg.
          </p>
          <p className="mt-2">
            Kontrollera alltid att valda produkter uppfyller din applikations krav med en kvalificerad
            ingenjör innan installation.
          </p>
        </Section>

        <Section title="8. Ansvarsbegränsning">
          <p>
            Maskinvals ansvar är begränsat till ordervärdet för den aktuella affären. Vi ansvarar inte
            för indirekta skador, utebliven vinst, produktionsbortfall eller följdskador.
            Maskinval lämnar inga garantier utöver vad som följer av tvingande lag.
          </p>
        </Section>

        <Section title="9. Immateriella rättigheter">
          <p>
            Allt innehåll på plattformen — inklusive produktbeskrivningar, bilder, konfigurationsverktyg
            och AI-modeller — är Maskinvals eller dess licensgivares egendom. Kopiering, scraping eller
            vidareutnyttjande utan skriftligt tillstånd är förbjudet.
          </p>
        </Section>

        <Section title="10. Tillämplig lag och tvistlösning">
          <p>
            Svensk rätt tillämpas. Tvister ska i första hand lösas genom förhandling. Om parterna inte
            kan enas hänskjuts tvisten till <strong className="text-foreground">Stockholms tingsrätt</strong> som
            första instans, om inte parterna skriftligen avtalar om skiljeförfarande enligt Stockholms
            Handelskammares Skiljedomsinstituts regler.
          </p>
        </Section>

        <Section title="11. Ändringar av villkoren">
          <p>
            Maskinval kan uppdatera dessa villkor. Väsentliga ändringar meddelas via e-post minst
            30 dagar i förväg. Fortsatt användning av tjänsten efter ikraftträdandedatum innebär
            accept av de nya villkoren.
          </p>
        </Section>

        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          Frågor? Kontakta oss på{" "}
          <a href="mailto:info@maskinval.se" className="text-info hover:underline">info@maskinval.se</a>
          {" "}·{" "}
          <Link to="/$locale/privacy" params={{ locale }} className="text-info hover:underline">
            Integritetspolicy
          </Link>
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground mb-2">{title}</h2>
      {children}
    </section>
  );
}
