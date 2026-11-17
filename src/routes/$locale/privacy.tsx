import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { fetchCompanySettings, visningsnamn, type CompanySettings } from "@/lib/company-settings";

/**
 * Integritetspolicyn, på svenska och engelska (/en, /de och /es visar den
 * engelska). Omskriven 2026-11-13 efter kundgranskningen: /en, /de och /es
 * visade den svenska texten, HubSpot och leverantörerna (direktleverans)
 * saknades bland mottagarna, flera amerikanska leverantörer saknade
 * överföringsgrund, lagringstiderna var vaga och kreditprövningen i villkoren
 * fanns inte med. Uppgifterna är kontrollerade mot koden: bilder som tolkas
 * sparas inte, chattmeddelanden sparas inte, PO-filer sparas med ordern.
 * Läses av jurist före lansering.
 */
export const Route = createFileRoute("/$locale/privacy")({
  head: ({ params }) => {
    const sv = params.locale === "sv";
    return {
      meta: [
        { title: sv ? "Integritetspolicy — Maskinval" : "Privacy policy — Maskinval" },
        { name: "description", content: sv
          ? "Hur Maskinval behandlar personuppgifter enligt GDPR: vilka uppgifter, varför, hur länge och till vilka mottagare."
          : "How Maskinval processes personal data under the GDPR: which data, why, for how long and which recipients." },
      ],
    };
  },
  component: PrivacyPage,
});

const UPPDATERAD = { sv: "13 november 2026", en: "13 November 2026" };

type Rad = [string, string];
type Mottagare = [namn: string, roll: string, land: string, grund: string];

const TEXT = {
  sv: {
    titel: "Integritetspolicy",
    uppdaterad: "Senast uppdaterad",
    ansvarigTitel: "1. Personuppgiftsansvarig",
    ansvarig: (vem: string) => `${vem} ("vi", "oss") är personuppgiftsansvarig för behandlingen av dina personuppgifter. Vi behandlar personuppgifter enligt EU:s dataskyddsförordning (GDPR, 2016/679) och kompletterande svensk lagstiftning.`,
    kontakt: "Kontakt",
    vadTitel: "2. Vilka uppgifter vi behandlar",
    vad: [
      ["Konto", "e-postadress och namn om du anger det."],
      ["Offertförfrågan och order", "företag, organisations- och momsnummer, kontaktperson, e-post, telefon, leverans- och fakturaadress, produkter och ditt inköpsordernummer."],
      ["Inköpsorder du bifogar", "filen sparas tillsammans med ordern."],
      ["Maskinbyggaren", "det du skriver och dina svar. Är du inloggad sparas beskrivning, svar och stycklista som ett projekt i ditt konto."],
      ["Bilder och dokument för tolkning", "skickas till AI-tjänsten för tolkning och sparas inte hos oss."],
      ["AI-ingenjören", "dina frågor skickas till AI-tjänsten för svar och sparas inte hos oss, utom i den anonyma statistiken nedan."],
      ["Teknisk data", "inloggningsloggar, IP-adress och webbläsartyp hos våra driftleverantörer."],
    ] as Rad[],
    varforTitel: "3. Ändamål och rättslig grund",
    varforHuvud: ["Ändamål", "Rättslig grund"],
    varfor: [
      ["Tillhandahålla tjänsten och hantera konton", "Avtal (art. 6.1 b)"],
      ["Hantera offertförfrågningar och order", "Avtal (art. 6.1 b)"],
      ["Direktleverans: ge leverantören leveransadress, mottagare och kontaktperson", "Avtal (art. 6.1 b)"],
      ["Skicka bekräftelser och leveransbesked", "Avtal (art. 6.1 b)"],
      ["Kundregister för offerter och uppföljning (CRM)", "Berättigat intresse (art. 6.1 f)"],
      ["Kreditprövning av nya företagskunder", "Berättigat intresse (art. 6.1 f)"],
      ["Förbättra tjänsten med anonym statistik", "Berättigat intresse (art. 6.1 f)"],
      ["Bokföring och skatt", "Rättslig förpliktelse (art. 6.1 c)"],
      ["Nyhetsbrev, om du anmält dig", "Samtycke (art. 6.1 a)"],
    ] as Rad[],
    hurLangeTitel: "4. Hur länge vi sparar uppgifterna",
    hurLangeHuvud: ["Uppgifter", "Lagringstid"],
    hurLange: [
      ["Konto och sparade projekt", "Tills du raderar kontot; raderas inom 30 dagar efter begäran."],
      ["Offertförfrågningar som inte blev order", "Högst 24 månader efter senaste kontakt."],
      ["Order, orderbekräftelser, fakturor och bifogade inköpsordrar", "7 år enligt bokföringslagen (1999:1078)."],
      ["Bilder och dokument för tolkning", "Sparas inte hos oss."],
      ["Frågor till AI-ingenjören", "Sparas inte hos oss (se anonym statistik)."],
      ["Anonym användningsstatistik", "13 månader."],
      ["E-post till info@maskinval.se", "Så länge ärendet kräver, högst 24 månader efter avslut."],
    ] as Rad[],
    mottagareTitel: "5. Mottagare och överföring utanför EU",
    mottagareIngress: "Vi delar bara de uppgifter som behövs för varje uppgift. Leverantörer i USA behandlar uppgifterna med stöd av personuppgiftsbiträdesavtal och EU-kommissionens standardavtalsklausuler (art. 46.2 c).",
    mottagareHuvud: ["Mottagare", "Roll", "Land", "Grund"],
    mottagare: [
      ["Supabase Inc.", "Databas och inloggning", "USA-bolag", "Standardavtalsklausuler"],
      ["Cloudflare Inc.", "Drift av webbplatsen", "USA-bolag", "Standardavtalsklausuler"],
      ["Resend Inc.", "Utskick av e-post (bekräftelser, leveransbesked)", "USA", "Standardavtalsklausuler"],
      ["Zoho", "E-postlådan info@maskinval.se", "EU", "Inom EU"],
      ["Groq Inc.", "AI-bearbetning av text i AI-ingenjören, maskinbyggaren och sökningen", "USA", "Standardavtalsklausuler"],
      ["Anthropic PBC", "AI-tolkning av bilder och dokument", "USA", "Standardavtalsklausuler"],
      ["HubSpot Inc.", "Kundregister (CRM) för offertförfrågningar", "USA/EU", "Standardavtalsklausuler"],
      ["Fortnox AB", "Bokföring och fakturering", "Sverige", "Inom EU"],
      ["Leverantörer och tillverkare", "Direktleverans: leveransadress, mottagare och kontaktperson", "Främst EU", "Avtal med dig"],
      ["Fraktbolag (t.ex. PostNord)", "Transport av din order", "Främst EU", "Avtal med dig"],
      ["Kreditupplysningsföretag", "Kreditprövning av nya företagskunder", "Sverige", "Inom EU"],
      ["Google Ireland Ltd", "Analys, bara om du valt \"Acceptera alla\"", "EU/USA", "Standardavtalsklausuler"],
    ] as Mottagare[],
    aiNot: "AI-tjänsterna får bara det du själv skriver eller laddar upp. Skriv inte personuppgifter eller sekretessbelagd information i frågor eller beskrivningar.",
    saljer: "Vi säljer aldrig personuppgifter.",
    rattTitel: "6. Dina rättigheter",
    ratt: [
      ["Tillgång", "få ett utdrag av dina uppgifter"],
      ["Rättelse", "rätta felaktiga uppgifter"],
      ["Radering", "få uppgifter raderade när de inte längre behövs"],
      ["Begränsning", "begränsa behandlingen"],
      ["Dataportabilitet", "få ut dina uppgifter i maskinläsbart format"],
      ["Invändning", "invända mot behandling som grundar sig på berättigat intresse"],
      ["Återkalla samtycke", "när som helst, utan att tidigare behandling påverkas"],
    ] as Rad[],
    rattKontakt: "Kontakta oss för att utöva dina rättigheter. Du kan också klaga hos Integritetsskyddsmyndigheten (IMY) eller hos tillsynsmyndigheten i landet där du bor eller arbetar.",
    kakTitel: "7. Kakor (cookies) och statistik",
    kakHuvud: ["Kaka", "Typ", "Syfte", "Livslängd"],
    kakor: [
      ["sb-auth-token", "Nödvändig", "Inloggningssession", "Session"],
      ["mv_cookie_consent", "Nödvändig", "Sparar ditt val om kakor", "1 år"],
      ["_ga, _ga_*", "Analys (samtycke krävs)", "Google Analytics, bara om vi aktiverat det och du valt \"Acceptera alla\"", "2 år"],
    ] as [string, string, string, string][],
    kakNot: "Analyskakor laddas bara om du väljer \"Acceptera alla\". Du kan ändra ditt val när som helst under \"Cookie-inställningar\" i sidfoten. Typsnitt och skript laddas från vår egen server.",
    statistik: "Anonym statistik utan kakor: vi registrerar varifrån ett besök kommer (till exempel linkedin.com eller en kampanjtagg), sökord, de första 120 tecknen i frågor till AI-ingenjören, koder i ersättningssökningen och att en stycklista eller offertförfrågan har skickats. Ingen IP-adress, inget användar-id och inget som kopplar händelsen till en person sparas. Rättslig grund: berättigat intresse (art. 6.1 f). Raderas efter 13 månader.",
    sakerhetTitel: "8. Säkerhet",
    sakerhet: "Uppgifterna överförs krypterat (TLS). Lösenord lagras aldrig i klartext. Åtkomsten till databasen styrs per rad (Row Level Security), och bara behöriga personer kommer åt kunduppgifterna.",
    andringTitel: "9. Ändringar",
    andring: "Vi kan uppdatera policyn. Vid väsentliga ändringar meddelar vi det via e-post eller tydligt på webbplatsen minst 30 dagar i förväg.",
  },
  en: {
    titel: "Privacy policy",
    uppdaterad: "Last updated",
    ansvarigTitel: "1. Controller",
    ansvarig: (vem: string) => `${vem} ("we", "us") is the controller for the processing of your personal data. We process personal data under the EU General Data Protection Regulation (GDPR, 2016/679) and supplementary Swedish law.`,
    kontakt: "Contact",
    vadTitel: "2. What data we process",
    vad: [
      ["Account", "email address and name if you provide it."],
      ["Quote request and order", "company, company registration and VAT number, contact person, email, phone, delivery and invoice address, products and your purchase order number."],
      ["Purchase order you attach", "the file is stored with the order."],
      ["Machine builder", "what you write and your answers. If you are signed in, the description, answers and bill of materials are saved as a project in your account."],
      ["Images and documents for interpretation", "sent to the AI service for interpretation and not stored by us."],
      ["AI engineer", "your questions are sent to the AI service for an answer and not stored by us, except in the anonymous statistics below."],
      ["Technical data", "sign-in logs, IP address and browser type at our hosting providers."],
    ] as Rad[],
    varforTitel: "3. Purposes and legal basis",
    varforHuvud: ["Purpose", "Legal basis"],
    varfor: [
      ["Provide the service and manage accounts", "Contract (Art. 6(1)(b))"],
      ["Handle quote requests and orders", "Contract (Art. 6(1)(b))"],
      ["Direct shipment: give the supplier the delivery address, recipient and contact person", "Contract (Art. 6(1)(b))"],
      ["Send confirmations and delivery notices", "Contract (Art. 6(1)(b))"],
      ["Customer register for quotes and follow-up (CRM)", "Legitimate interest (Art. 6(1)(f))"],
      ["Credit check of new business customers", "Legitimate interest (Art. 6(1)(f))"],
      ["Improve the service with anonymous statistics", "Legitimate interest (Art. 6(1)(f))"],
      ["Bookkeeping and tax", "Legal obligation (Art. 6(1)(c))"],
      ["Newsletter, if you signed up", "Consent (Art. 6(1)(a))"],
    ] as Rad[],
    hurLangeTitel: "4. How long we keep the data",
    hurLangeHuvud: ["Data", "Retention"],
    hurLange: [
      ["Account and saved projects", "Until you delete the account; deleted within 30 days of a request."],
      ["Quote requests that did not become an order", "At most 24 months after the last contact."],
      ["Orders, order confirmations, invoices and attached purchase orders", "7 years under the Swedish Bookkeeping Act (1999:1078)."],
      ["Images and documents for interpretation", "Not stored by us."],
      ["Questions to the AI engineer", "Not stored by us (see anonymous statistics)."],
      ["Anonymous usage statistics", "13 months."],
      ["Email to info@maskinval.se", "As long as the matter requires, at most 24 months after it is closed."],
    ] as Rad[],
    mottagareTitel: "5. Recipients and transfers outside the EU",
    mottagareIngress: "We only share the data each task needs. Providers in the USA process the data under data processing agreements and the European Commission's standard contractual clauses (Art. 46(2)(c)).",
    mottagareHuvud: ["Recipient", "Role", "Country", "Basis"],
    mottagare: [
      ["Supabase Inc.", "Database and sign-in", "US company", "Standard contractual clauses"],
      ["Cloudflare Inc.", "Website hosting", "US company", "Standard contractual clauses"],
      ["Resend Inc.", "Sending email (confirmations, delivery notices)", "USA", "Standard contractual clauses"],
      ["Zoho", "The info@maskinval.se mailbox", "EU", "Within the EU"],
      ["Groq Inc.", "AI processing of text in the AI engineer, machine builder and search", "USA", "Standard contractual clauses"],
      ["Anthropic PBC", "AI interpretation of images and documents", "USA", "Standard contractual clauses"],
      ["HubSpot Inc.", "Customer register (CRM) for quote requests", "USA/EU", "Standard contractual clauses"],
      ["Fortnox AB", "Bookkeeping and invoicing", "Sweden", "Within the EU"],
      ["Suppliers and manufacturers", "Direct shipment: delivery address, recipient and contact person", "Mainly EU", "Contract with you"],
      ["Carriers (e.g. PostNord)", "Transport of your order", "Mainly EU", "Contract with you"],
      ["Credit reference agencies", "Credit check of new business customers", "Sweden", "Within the EU"],
      ["Google Ireland Ltd", "Analytics, only if you chose \"Accept all\"", "EU/USA", "Standard contractual clauses"],
    ] as Mottagare[],
    aiNot: "The AI services only receive what you write or upload yourself. Do not enter personal data or confidential information in questions or descriptions.",
    saljer: "We never sell personal data.",
    rattTitel: "6. Your rights",
    ratt: [
      ["Access", "get a copy of your data"],
      ["Rectification", "correct inaccurate data"],
      ["Erasure", "have data deleted when it is no longer needed"],
      ["Restriction", "restrict the processing"],
      ["Data portability", "receive your data in a machine-readable format"],
      ["Objection", "object to processing based on legitimate interest"],
      ["Withdraw consent", "at any time, without affecting earlier processing"],
    ] as Rad[],
    rattKontakt: "Contact us to exercise your rights. You can also complain to the Swedish Authority for Privacy Protection (IMY) or to the supervisory authority in the country where you live or work (for example the ICO in the UK, your state authority in Germany or the AEPD in Spain).",
    kakTitel: "7. Cookies and statistics",
    kakHuvud: ["Cookie", "Type", "Purpose", "Lifetime"],
    kakor: [
      ["sb-auth-token", "Necessary", "Sign-in session", "Session"],
      ["mv_cookie_consent", "Necessary", "Stores your cookie choice", "1 year"],
      ["_ga, _ga_*", "Analytics (consent required)", "Google Analytics, only if we have enabled it and you chose \"Accept all\"", "2 years"],
    ] as [string, string, string, string][],
    kakNot: "Analytics cookies are only loaded if you choose \"Accept all\". You can change your choice at any time under \"Cookie settings\" in the footer. Fonts and scripts are served from our own server.",
    statistik: "Anonymous statistics without cookies: we record where a visit came from (for example linkedin.com or a campaign tag), search terms, the first 120 characters of questions to the AI engineer, codes in the replacement search, and that a bill of materials or quote request was sent. No IP address, no user id and nothing that links the event to a person is stored. Legal basis: legitimate interest (Art. 6(1)(f)). Deleted after 13 months.",
    sakerhetTitel: "8. Security",
    sakerhet: "Data is transferred encrypted (TLS). Passwords are never stored in plain text. Database access is controlled per row (Row Level Security), and only authorised people can access customer data.",
    andringTitel: "9. Changes",
    andring: "We may update this policy. For material changes we will notify you by email or clearly on the website at least 30 days in advance.",
  },
};

function PrivacyPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const x = locale === "sv" ? TEXT.sv : TEXT.en;
  const [bolag, setBolag] = useState<CompanySettings | null>(null);
  useEffect(() => { fetchCompanySettings().then(setBolag).catch(() => setBolag(null)); }, []);
  // Den personuppgiftsansvarige med organisationsnummer när det är ifyllt.
  const ansvarig = bolag?.org?.trim() ? `${visningsnamn(bolag)} (org.nr ${bolag.org})` : "Maskinval";
  const adress = [bolag?.address, bolag?.postal].filter(Boolean).join(", ");
  const epost = bolag?.email || "info@maskinval.se";

  return (
    <div className="container-page py-12 max-w-3xl">
      <Link to="/$locale" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
        ← {t("common.appName")}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">{x.titel}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{x.uppdaterad}: {locale === "sv" ? UPPDATERAD.sv : UPPDATERAD.en}</p>

      <div className="mt-8 max-w-none space-y-8 text-sm text-foreground/80 leading-relaxed">
        <Section title={x.ansvarigTitel}>
          <p>{x.ansvarig(ansvarig)}</p>
          <p className="mt-2">
            {x.kontakt}: <a href={`mailto:${epost}`} className="text-info hover:underline">{epost}</a>
            {bolag?.phone && <> · <a href={`tel:${bolag.phone.replace(/[^\d+]/g, "")}`} className="text-info hover:underline">{bolag.phone}</a></>}
            {adress && <> · {adress}</>}
          </p>
        </Section>

        <Section title={x.vadTitel}>
          <ul className="space-y-1 list-disc list-inside text-foreground/70">
            {x.vad.map(([k, v]) => <li key={k}><strong className="text-foreground">{k}:</strong> {v}</li>)}
          </ul>
        </Section>

        <Section title={x.varforTitel}>
          <Tabell huvud={x.varforHuvud} rader={x.varfor} />
        </Section>

        <Section title={x.hurLangeTitel}>
          <Tabell huvud={x.hurLangeHuvud} rader={x.hurLange} />
        </Section>

        <Section title={x.mottagareTitel}>
          <p>{x.mottagareIngress}</p>
          <Tabell huvud={x.mottagareHuvud} rader={x.mottagare} />
          <p className="mt-2">{x.aiNot}</p>
          <p className="mt-2">{x.saljer}</p>
        </Section>

        <Section title={x.rattTitel}>
          <ul className="space-y-1 list-disc list-inside text-foreground/70">
            {x.ratt.map(([k, v]) => <li key={k}><strong className="text-foreground">{k}</strong> — {v}</li>)}
          </ul>
          <p className="mt-2">
            {x.rattKontakt}{" "}
            <a href={`mailto:${epost}`} className="text-info hover:underline">{epost}</a> ·{" "}
            <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="text-info hover:underline">imy.se</a>
          </p>
        </Section>

        <Section title={x.kakTitel}>
          <Tabell huvud={x.kakHuvud} rader={x.kakor} mono />
          <p className="mt-2 text-xs text-muted-foreground">{x.kakNot}</p>
          <p className="mt-3">{x.statistik}</p>
        </Section>

        <Section title={x.sakerhetTitel}>
          <p>{x.sakerhet}</p>
        </Section>

        <Section title={x.andringTitel}>
          <p>{x.andring}</p>
        </Section>
      </div>
    </div>
  );
}

function Tabell({ huvud, rader, mono }: { huvud: string[]; rader: string[][]; mono?: boolean }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-xs border border-border rounded-md overflow-hidden">
        <thead>
          <tr className="bg-surface-alt border-b border-border">
            {huvud.map((h) => <th key={h} className="p-2 text-left text-muted-foreground font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rader.map((r) => (
            <tr key={r[0]} className="odd:bg-surface-alt/30">
              {r.map((c, i) => <td key={i} className={`p-2 ${i === 0 ? (mono ? "font-mono text-foreground/70" : "text-foreground/80") : "text-muted-foreground"}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
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
