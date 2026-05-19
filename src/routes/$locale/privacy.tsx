import { createFileRoute, Link } from "@tanstack/react-router";
import { makeT, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/$locale/privacy")({
  head: () => ({
    meta: [
      { title: "Integritetspolicy — Maskinval" },
      { name: "description", content: "Maskinvals integritetspolicy och behandling av personuppgifter enligt GDPR." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);

  return (
    <div className="container-page py-12 max-w-3xl">
      <Link to="/$locale" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
        ← {t("common.appName")}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">Integritetspolicy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Senast uppdaterad: 19 maj 2026</p>

      <div className="mt-8 prose prose-sm prose-invert max-w-none space-y-8 text-sm text-foreground/80 leading-relaxed">

        <Section title="1. Personuppgiftsansvarig">
          <p>
            Maskinval AB ("Maskinval", "vi", "oss") är personuppgiftsansvarig för behandlingen av dina personuppgifter.
            Vi behandlar personuppgifter i enlighet med EU:s dataskyddsförordning (GDPR, 2016/679) samt tillämplig
            svensk lagstiftning.
          </p>
          <p className="mt-2">
            Kontakt: <a href="mailto:privacy@maskinval.se" className="text-info hover:underline">privacy@maskinval.se</a>
          </p>
        </Section>

        <Section title="2. Vilka uppgifter vi samlar in">
          <p>Vi samlar in följande kategorier av personuppgifter:</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-foreground/70">
            <li><strong className="text-foreground">Kontouppgifter:</strong> e-postadress, namn (om angivet)</li>
            <li><strong className="text-foreground">Offertförfrågningar (RFQ):</strong> företagsnamn, kontaktuppgifter, produktval</li>
            <li><strong className="text-foreground">Användningsdata:</strong> inloggningsloggar, IP-adress, webbläsartyp</li>
            <li><strong className="text-foreground">Kommunikation:</strong> meddelanden du skickar via AI-chatten eller kontaktformulär</li>
          </ul>
        </Section>

        <Section title="3. Ändamål och rättslig grund">
          <table className="w-full text-xs border border-border rounded-md overflow-hidden mt-2">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                <th className="p-2 text-left text-muted-foreground font-medium">Ändamål</th>
                <th className="p-2 text-left text-muted-foreground font-medium">Rättslig grund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Tillhandahålla tjänsten och hantera konton", "Avtal (Art. 6.1b)"],
                ["Hantera offertförfrågningar och order", "Avtal (Art. 6.1b)"],
                ["Skicka transaktionsmail (bekräftelser)", "Avtal (Art. 6.1b)"],
                ["Förbättra plattformen och analysera användning", "Berättigat intresse (Art. 6.1f)"],
                ["Uppfylla bokförings- och skattekrav", "Rättslig förpliktelse (Art. 6.1c)"],
                ["Skicka nyhetsbrev och erbjudanden", "Samtycke (Art. 6.1a)"],
              ].map(([purpose, basis]) => (
                <tr key={purpose} className="odd:bg-surface-alt/30">
                  <td className="p-2 text-foreground/80">{purpose}</td>
                  <td className="p-2 text-muted-foreground">{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="4. Lagring och radering">
          <p>
            Vi lagrar dina uppgifter så länge som ditt konto är aktivt eller som krävs för att uppfylla de ändamål
            som beskrivs ovan. Kontouppgifter raderas inom 30 dagar efter att du begärt radering. Bokföringsdata
            sparas i 7 år enligt Bokföringslagen (1999:1078).
          </p>
        </Section>

        <Section title="5. Delning med tredje part">
          <p>Vi delar personuppgifter med följande kategorier av mottagare:</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-foreground/70">
            <li><strong className="text-foreground">Supabase Inc.</strong> — databasinfrastruktur (USA, Standard Contractual Clauses)</li>
            <li><strong className="text-foreground">Cloudflare Inc.</strong> — hosting och CDN (USA, Standard Contractual Clauses)</li>
            <li><strong className="text-foreground">Groq Inc.</strong> — AI-bearbetning av chat-frågor (USA, Standard Contractual Clauses)</li>
            <li><strong className="text-foreground">PostNord AB</strong> — fraktbokning (Sverige)</li>
          </ul>
          <p className="mt-2">
            Vi säljer aldrig personuppgifter till tredje part.
          </p>
        </Section>

        <Section title="6. Dina rättigheter">
          <p>Enligt GDPR har du rätt att:</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-foreground/70">
            <li><strong className="text-foreground">Tillgång</strong> — begära ett utdrag av dina uppgifter</li>
            <li><strong className="text-foreground">Rättelse</strong> — korrigera felaktiga uppgifter</li>
            <li><strong className="text-foreground">Radering</strong> — "rätten att bli glömd"</li>
            <li><strong className="text-foreground">Begränsning</strong> — begränsa behandlingen</li>
            <li><strong className="text-foreground">Dataportabilitet</strong> — få ut dina uppgifter i maskinläsbart format</li>
            <li><strong className="text-foreground">Invändning</strong> — invända mot behandling baserad på berättigat intresse</li>
          </ul>
          <p className="mt-2">
            Kontakta oss på <a href="mailto:privacy@maskinval.se" className="text-info hover:underline">privacy@maskinval.se</a> för
            att utöva dina rättigheter. Du har även rätt att klaga hos <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="text-info hover:underline">Integritetsskyddsmyndigheten (IMY)</a>.
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>
            Vi använder nödvändiga cookies för inloggningssessioner (Supabase auth token). Vi använder
            <strong className="text-foreground"> inga</strong> spårnings- eller marknadsföringscookies.
            Inga tredjepartscookies laddas utan ditt samtycke.
          </p>
        </Section>

        <Section title="8. Säkerhet">
          <p>
            Alla uppgifter överförs krypterat via TLS 1.3. Lösenord lagras aldrig i klartext — autentisering
            sker via Supabase Auth med bcrypt-hashning. Åtkomst till produktionsdatabasen begränsas via
            Row Level Security (RLS).
          </p>
        </Section>

        <Section title="9. Ändringar">
          <p>
            Vi kan uppdatera denna policy. Vid väsentliga ändringar informerar vi dig via e-post eller ett
            tydligt meddelande på webbplatsen minst 30 dagar i förväg.
          </p>
        </Section>

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
