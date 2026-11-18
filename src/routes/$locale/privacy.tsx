import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { fetchCompanySettings, visningsnamn, type CompanySettings } from "@/lib/company-settings";

/**
 * Integritetspolicyn på svenska, engelska, tyska och spanska. Tyska och
 * spanska kom 2026-11-18 (förut visade /de och /es den engelska); de är
 * översättningar av den engelska och ska läsas av jurist som den svenska. Omskriven 2026-11-13 efter kundgranskningen: /en, /de och /es
 * visade den svenska texten, HubSpot och leverantörerna (direktleverans)
 * saknades bland mottagarna, flera amerikanska leverantörer saknade
 * överföringsgrund, lagringstiderna var vaga och kreditprövningen i villkoren
 * fanns inte med. Uppgifterna är kontrollerade mot koden: bilder som tolkas
 * sparas inte, chattmeddelanden sparas inte, PO-filer sparas med ordern.
 * Läses av jurist före lansering.
 */
export const Route = createFileRoute("/$locale/privacy")({
  head: ({ params }) => {
    const m = HEAD[params.locale as keyof typeof HEAD] ?? HEAD.en;
    return {
      meta: [
        { title: m.titel },
        { name: "description", content: m.beskrivning },
      ],
    };
  },
  component: PrivacyPage,
});

const HEAD = {
  sv: { titel: "Integritetspolicy — Maskinval", beskrivning: "Hur Maskinval behandlar personuppgifter enligt GDPR: vilka uppgifter, varför, hur länge och till vilka mottagare." },
  en: { titel: "Privacy policy — Maskinval", beskrivning: "How Maskinval processes personal data under the GDPR: which data, why, for how long and which recipients." },
  de: { titel: "Datenschutzerklärung — Maskinval", beskrivning: "Wie Maskinval personenbezogene Daten nach der DSGVO verarbeitet: welche Daten, warum, wie lange und an welche Empfänger." },
  es: { titel: "Política de privacidad — Maskinval", beskrivning: "Cómo trata Maskinval los datos personales según el RGPD: qué datos, por qué, durante cuánto tiempo y a qué destinatarios." },
};

// Datum när texten senast ändrades i sak (de/es är översättningar av 13 november).
const UPPDATERAD = { sv: "13 november 2026", en: "13 November 2026", de: "13. November 2026", es: "13 de noviembre de 2026" };

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
  de: {
    titel: "Datenschutzerklärung",
    uppdaterad: "Zuletzt aktualisiert",
    ansvarigTitel: "1. Verantwortlicher",
    ansvarig: (vem: string) => `${vem} („wir“, „uns“) ist Verantwortlicher für die Verarbeitung Ihrer personenbezogenen Daten. Wir verarbeiten personenbezogene Daten nach der Datenschutz-Grundverordnung der EU (DSGVO, 2016/679) und ergänzendem schwedischem Recht.`,
    kontakt: "Kontakt",
    vadTitel: "2. Welche Daten wir verarbeiten",
    vad: [
      ["Konto", "E-Mail-Adresse und Name, sofern Sie ihn angeben."],
      ["Angebotsanfrage und Bestellung", "Unternehmen, Handelsregister- und USt-IdNr., Ansprechpartner, E-Mail, Telefon, Liefer- und Rechnungsadresse, Produkte und Ihre Bestellnummer."],
      ["Bestellung, die Sie anhängen", "die Datei wird mit dem Auftrag gespeichert."],
      ["Maschinen-Assistent", "was Sie schreiben, und Ihre Antworten. Wenn Sie angemeldet sind, werden Beschreibung, Antworten und Stückliste als Projekt in Ihrem Konto gespeichert."],
      ["Bilder und Dokumente zur Auswertung", "werden zur Auswertung an den KI-Dienst gesendet und von uns nicht gespeichert."],
      ["KI-Ingenieur", "Ihre Fragen werden zur Beantwortung an den KI-Dienst gesendet und von uns nicht gespeichert, außer in der anonymen Statistik unten."],
      ["Technische Daten", "Anmeldeprotokolle, IP-Adresse und Browsertyp bei unseren Hosting-Anbietern."],
    ] as Rad[],
    varforTitel: "3. Zwecke und Rechtsgrundlagen",
    varforHuvud: ["Zweck", "Rechtsgrundlage"],
    varfor: [
      ["Den Dienst bereitstellen und Konten verwalten", "Vertrag (Art. 6 Abs. 1 lit. b DSGVO)"],
      ["Angebotsanfragen und Bestellungen bearbeiten", "Vertrag (Art. 6 Abs. 1 lit. b DSGVO)"],
      ["Direktlieferung: dem Lieferanten Lieferadresse, Empfänger und Ansprechpartner mitteilen", "Vertrag (Art. 6 Abs. 1 lit. b DSGVO)"],
      ["Bestätigungen und Versandmitteilungen senden", "Vertrag (Art. 6 Abs. 1 lit. b DSGVO)"],
      ["Kundenregister für Angebote und Nachverfolgung (CRM)", "Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)"],
      ["Bonitätsprüfung neuer Geschäftskunden", "Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)"],
      ["Den Dienst mit anonymer Statistik verbessern", "Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)"],
      ["Buchführung und Steuern", "Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO)"],
      ["Newsletter, sofern Sie ihn abonniert haben", "Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)"],
    ] as Rad[],
    hurLangeTitel: "4. Wie lange wir die Daten speichern",
    hurLangeHuvud: ["Daten", "Speicherdauer"],
    hurLange: [
      ["Konto und gespeicherte Projekte", "Bis Sie das Konto löschen; Löschung innerhalb von 30 Tagen nach einer Anfrage."],
      ["Angebotsanfragen, aus denen keine Bestellung wurde", "Höchstens 24 Monate nach dem letzten Kontakt."],
      ["Bestellungen, Auftragsbestätigungen, Rechnungen und angehängte Bestellungen", "7 Jahre nach dem schwedischen Buchführungsgesetz (Bokföringslagen 1999:1078)."],
      ["Bilder und Dokumente zur Auswertung", "Werden von uns nicht gespeichert."],
      ["Fragen an den KI-Ingenieur", "Werden von uns nicht gespeichert (siehe anonyme Statistik)."],
      ["Anonyme Nutzungsstatistik", "13 Monate."],
      ["E-Mails an info@maskinval.se", "So lange die Angelegenheit es erfordert, höchstens 24 Monate nach ihrem Abschluss."],
    ] as Rad[],
    mottagareTitel: "5. Empfänger und Übermittlungen außerhalb der EU",
    mottagareIngress: "Wir geben nur die Daten weiter, die die jeweilige Aufgabe erfordert. Anbieter in den USA verarbeiten die Daten auf Grundlage von Auftragsverarbeitungsverträgen und der Standardvertragsklauseln der Europäischen Kommission (Art. 46 Abs. 2 lit. c DSGVO).",
    mottagareHuvud: ["Empfänger", "Aufgabe", "Land", "Grundlage"],
    mottagare: [
      ["Supabase Inc.", "Datenbank und Anmeldung", "US-Unternehmen", "Standardvertragsklauseln"],
      ["Cloudflare Inc.", "Hosting der Website", "US-Unternehmen", "Standardvertragsklauseln"],
      ["Resend Inc.", "E-Mail-Versand (Bestätigungen, Versandmitteilungen)", "USA", "Standardvertragsklauseln"],
      ["Zoho", "Das Postfach info@maskinval.se", "EU", "Innerhalb der EU"],
      ["Groq Inc.", "KI-Verarbeitung von Text im KI-Ingenieur, im Maschinen-Assistenten und in der Suche", "USA", "Standardvertragsklauseln"],
      ["Anthropic PBC", "KI-Auswertung von Bildern und Dokumenten", "USA", "Standardvertragsklauseln"],
      ["HubSpot Inc.", "Kundenregister (CRM) für Angebotsanfragen", "USA/EU", "Standardvertragsklauseln"],
      ["Fortnox AB", "Buchführung und Rechnungsstellung", "Schweden", "Innerhalb der EU"],
      ["Lieferanten und Hersteller", "Direktlieferung: Lieferadresse, Empfänger und Ansprechpartner", "Überwiegend EU", "Vertrag mit Ihnen"],
      ["Transportunternehmen (z. B. PostNord)", "Transport Ihrer Bestellung", "Überwiegend EU", "Vertrag mit Ihnen"],
      ["Auskunfteien", "Bonitätsprüfung neuer Geschäftskunden", "Schweden", "Innerhalb der EU"],
      ["Google Ireland Ltd", "Analyse, nur wenn Sie „Alle akzeptieren“ gewählt haben", "EU/USA", "Standardvertragsklauseln"],
    ] as Mottagare[],
    aiNot: "Die KI-Dienste erhalten nur, was Sie selbst schreiben oder hochladen. Geben Sie in Fragen oder Beschreibungen keine personenbezogenen Daten oder vertraulichen Informationen ein.",
    saljer: "Wir verkaufen niemals personenbezogene Daten.",
    rattTitel: "6. Ihre Rechte",
    ratt: [
      ["Auskunft", "eine Kopie Ihrer Daten erhalten"],
      ["Berichtigung", "unrichtige Daten korrigieren lassen"],
      ["Löschung", "Daten löschen lassen, wenn sie nicht mehr benötigt werden"],
      ["Einschränkung", "die Verarbeitung einschränken lassen"],
      ["Datenübertragbarkeit", "Ihre Daten in einem maschinenlesbaren Format erhalten"],
      ["Widerspruch", "einer Verarbeitung auf Grundlage berechtigten Interesses widersprechen"],
      ["Widerruf der Einwilligung", "jederzeit, ohne dass die frühere Verarbeitung berührt wird"],
    ] as Rad[],
    rattKontakt: "Kontaktieren Sie uns, um Ihre Rechte auszuüben. Sie können sich auch bei der schwedischen Datenschutzbehörde (Integritetsskyddsmyndigheten, IMY) oder bei der Aufsichtsbehörde des Landes beschweren, in dem Sie wohnen oder arbeiten (in Deutschland die Datenschutzaufsichtsbehörde Ihres Bundeslandes).",
    kakTitel: "7. Cookies und Statistik",
    kakHuvud: ["Cookie", "Art", "Zweck", "Laufzeit"],
    kakor: [
      ["sb-auth-token", "Notwendig", "Anmeldesitzung", "Sitzung"],
      ["mv_cookie_consent", "Notwendig", "Speichert Ihre Cookie-Auswahl", "1 Jahr"],
      ["_ga, _ga_*", "Analyse (Einwilligung erforderlich)", "Google Analytics, nur wenn wir es aktiviert haben und Sie „Alle akzeptieren“ gewählt haben", "2 Jahre"],
    ] as [string, string, string, string][],
    kakNot: "Analyse-Cookies werden nur geladen, wenn Sie „Alle akzeptieren“ wählen. Sie können Ihre Auswahl jederzeit unter „Cookie-Einstellungen“ in der Fußzeile ändern. Schriften und Skripte werden von unserem eigenen Server geladen.",
    statistik: "Anonyme Statistik ohne Cookies: Wir erfassen, woher ein Besuch kam (zum Beispiel linkedin.com oder ein Kampagnenkennzeichen), Suchbegriffe, die ersten 120 Zeichen von Fragen an den KI-Ingenieur, Codes in der Ersatzsuche sowie dass eine Stückliste oder Angebotsanfrage gesendet wurde. Es werden keine IP-Adresse, keine Benutzerkennung und nichts gespeichert, was das Ereignis mit einer Person verknüpft. Rechtsgrundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO). Löschung nach 13 Monaten.",
    sakerhetTitel: "8. Sicherheit",
    sakerhet: "Daten werden verschlüsselt übertragen (TLS). Passwörter werden nie im Klartext gespeichert. Der Datenbankzugriff wird pro Zeile gesteuert (Row Level Security), und nur befugte Personen haben Zugriff auf Kundendaten.",
    andringTitel: "9. Änderungen",
    andring: "Wir können diese Erklärung aktualisieren. Bei wesentlichen Änderungen informieren wir Sie mindestens 30 Tage im Voraus per E-Mail oder deutlich sichtbar auf der Website.",
  },
  es: {
    titel: "Política de privacidad",
    uppdaterad: "Última actualización",
    ansvarigTitel: "1. Responsable del tratamiento",
    ansvarig: (vem: string) => `${vem} («nosotros») es el responsable del tratamiento de sus datos personales. Tratamos los datos personales conforme al Reglamento General de Protección de Datos de la UE (RGPD, 2016/679) y a la legislación sueca complementaria.`,
    kontakt: "Contacto",
    vadTitel: "2. Qué datos tratamos",
    vad: [
      ["Cuenta", "dirección de correo electrónico y nombre, si lo indica."],
      ["Solicitud de presupuesto y pedido", "empresa, número de registro mercantil y NIF-IVA, persona de contacto, correo electrónico, teléfono, direcciones de entrega y de facturación, productos y su número de pedido."],
      ["Orden de compra que adjunte", "el archivo se guarda con el pedido."],
      ["Constructor de máquinas", "lo que escribe y sus respuestas. Si ha iniciado sesión, la descripción, las respuestas y la lista de materiales se guardan como proyecto en su cuenta."],
      ["Imágenes y documentos para interpretar", "se envían al servicio de IA para su interpretación y no los guardamos."],
      ["Ingeniero IA", "sus preguntas se envían al servicio de IA para obtener una respuesta y no las guardamos, salvo en la estadística anónima indicada más abajo."],
      ["Datos técnicos", "registros de inicio de sesión, dirección IP y tipo de navegador en nuestros proveedores de alojamiento."],
    ] as Rad[],
    varforTitel: "3. Finalidades y base jurídica",
    varforHuvud: ["Finalidad", "Base jurídica"],
    varfor: [
      ["Prestar el servicio y gestionar las cuentas", "Contrato (art. 6.1.b RGPD)"],
      ["Gestionar solicitudes de presupuesto y pedidos", "Contrato (art. 6.1.b RGPD)"],
      ["Envío directo: facilitar al proveedor la dirección de entrega, el destinatario y la persona de contacto", "Contrato (art. 6.1.b RGPD)"],
      ["Enviar confirmaciones y avisos de envío", "Contrato (art. 6.1.b RGPD)"],
      ["Registro de clientes para presupuestos y seguimiento (CRM)", "Interés legítimo (art. 6.1.f RGPD)"],
      ["Comprobación de solvencia de nuevos clientes empresariales", "Interés legítimo (art. 6.1.f RGPD)"],
      ["Mejorar el servicio con estadísticas anónimas", "Interés legítimo (art. 6.1.f RGPD)"],
      ["Contabilidad e impuestos", "Obligación legal (art. 6.1.c RGPD)"],
      ["Boletín, si se ha suscrito", "Consentimiento (art. 6.1.a RGPD)"],
    ] as Rad[],
    hurLangeTitel: "4. Cuánto tiempo conservamos los datos",
    hurLangeHuvud: ["Datos", "Plazo de conservación"],
    hurLange: [
      ["Cuenta y proyectos guardados", "Hasta que elimine la cuenta; se eliminan en un plazo de 30 días desde la solicitud."],
      ["Solicitudes de presupuesto que no se convirtieron en pedido", "Como máximo 24 meses desde el último contacto."],
      ["Pedidos, confirmaciones de pedido, facturas y órdenes de compra adjuntas", "7 años según la Ley sueca de contabilidad (Bokföringslagen 1999:1078)."],
      ["Imágenes y documentos para interpretar", "No los guardamos."],
      ["Preguntas al ingeniero IA", "No las guardamos (véase la estadística anónima)."],
      ["Estadística de uso anónima", "13 meses."],
      ["Correos a info@maskinval.se", "El tiempo que requiera el asunto, como máximo 24 meses desde su cierre."],
    ] as Rad[],
    mottagareTitel: "5. Destinatarios y transferencias fuera de la UE",
    mottagareIngress: "Solo compartimos los datos que requiere cada tarea. Los proveedores en EE. UU. tratan los datos en virtud de contratos de encargo del tratamiento y de las cláusulas contractuales tipo de la Comisión Europea (art. 46.2.c RGPD).",
    mottagareHuvud: ["Destinatario", "Función", "País", "Base"],
    mottagare: [
      ["Supabase Inc.", "Base de datos e inicio de sesión", "Empresa estadounidense", "Cláusulas contractuales tipo"],
      ["Cloudflare Inc.", "Alojamiento del sitio web", "Empresa estadounidense", "Cláusulas contractuales tipo"],
      ["Resend Inc.", "Envío de correo electrónico (confirmaciones, avisos de envío)", "EE. UU.", "Cláusulas contractuales tipo"],
      ["Zoho", "El buzón info@maskinval.se", "UE", "Dentro de la UE"],
      ["Groq Inc.", "Procesamiento por IA del texto en el ingeniero IA, el constructor de máquinas y la búsqueda", "EE. UU.", "Cláusulas contractuales tipo"],
      ["Anthropic PBC", "Interpretación por IA de imágenes y documentos", "EE. UU.", "Cláusulas contractuales tipo"],
      ["HubSpot Inc.", "Registro de clientes (CRM) para solicitudes de presupuesto", "EE. UU./UE", "Cláusulas contractuales tipo"],
      ["Fortnox AB", "Contabilidad y facturación", "Suecia", "Dentro de la UE"],
      ["Proveedores y fabricantes", "Envío directo: dirección de entrega, destinatario y persona de contacto", "Principalmente UE", "Contrato con usted"],
      ["Transportistas (p. ej., PostNord)", "Transporte de su pedido", "Principalmente UE", "Contrato con usted"],
      ["Agencias de información crediticia", "Comprobación de solvencia de nuevos clientes empresariales", "Suecia", "Dentro de la UE"],
      ["Google Ireland Ltd", "Analítica, solo si eligió «Aceptar todas»", "UE/EE. UU.", "Cláusulas contractuales tipo"],
    ] as Mottagare[],
    aiNot: "Los servicios de IA solo reciben lo que usted mismo escribe o sube. No introduzca datos personales ni información confidencial en preguntas o descripciones.",
    saljer: "Nunca vendemos datos personales.",
    rattTitel: "6. Sus derechos",
    ratt: [
      ["Acceso", "obtener una copia de sus datos"],
      ["Rectificación", "corregir datos inexactos"],
      ["Supresión", "que se eliminen los datos cuando ya no sean necesarios"],
      ["Limitación", "limitar el tratamiento"],
      ["Portabilidad", "recibir sus datos en un formato legible por máquina"],
      ["Oposición", "oponerse al tratamiento basado en el interés legítimo"],
      ["Retirada del consentimiento", "en cualquier momento, sin que ello afecte al tratamiento anterior"],
    ] as Rad[],
    rattKontakt: "Póngase en contacto con nosotros para ejercer sus derechos. También puede presentar una reclamación ante la autoridad sueca de protección de datos (Integritetsskyddsmyndigheten, IMY) o ante la autoridad de control del país donde vive o trabaja (en España, la Agencia Española de Protección de Datos, AEPD).",
    kakTitel: "7. Cookies y estadística",
    kakHuvud: ["Cookie", "Tipo", "Finalidad", "Duración"],
    kakor: [
      ["sb-auth-token", "Necesaria", "Sesión de inicio de sesión", "Sesión"],
      ["mv_cookie_consent", "Necesaria", "Guarda su elección de cookies", "1 año"],
      ["_ga, _ga_*", "Analítica (requiere consentimiento)", "Google Analytics, solo si lo hemos activado y usted eligió «Aceptar todas»", "2 años"],
    ] as [string, string, string, string][],
    kakNot: "Las cookies analíticas solo se cargan si elige «Aceptar todas». Puede cambiar su elección en cualquier momento en «Configuración de cookies», en el pie de página. Las fuentes y los scripts se sirven desde nuestro propio servidor.",
    statistik: "Estadística anónima sin cookies: registramos de dónde procede una visita (por ejemplo, linkedin.com o una etiqueta de campaña), los términos de búsqueda, los primeros 120 caracteres de las preguntas al ingeniero IA, los códigos en la búsqueda de sustitutos y que se envió una lista de materiales o una solicitud de presupuesto. No se guarda ninguna dirección IP, ningún identificador de usuario ni nada que vincule el evento con una persona. Base jurídica: interés legítimo (art. 6.1.f RGPD). Se elimina a los 13 meses.",
    sakerhetTitel: "8. Seguridad",
    sakerhet: "Los datos se transmiten cifrados (TLS). Las contraseñas nunca se guardan en texto plano. El acceso a la base de datos se controla por fila (Row Level Security) y solo las personas autorizadas pueden acceder a los datos de los clientes.",
    andringTitel: "9. Cambios",
    andring: "Podemos actualizar esta política. En caso de cambios importantes, se lo comunicaremos por correo electrónico o de forma visible en el sitio web con al menos 30 días de antelación.",
  },
};

function PrivacyPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const x = TEXT[locale as keyof typeof TEXT] ?? TEXT.en;
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
      <p className="mt-2 text-sm text-muted-foreground">{x.uppdaterad}: {UPPDATERAD[locale as keyof typeof UPPDATERAD] ?? UPPDATERAD.en}</p>

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
