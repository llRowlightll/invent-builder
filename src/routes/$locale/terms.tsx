import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { fetchCompanySettings, visningsnamn, type CompanySettings } from "@/lib/company-settings";
import { OFFERT_GILTIG_DAGAR, VILLKOR_DATUM, VILLKOR_VERSION } from "@/lib/villkor";

/**
 * Allmänna villkor, på svenska och engelska (övriga språk visar engelska).
 * Den svenska texten gäller vid skillnader (avsnitt 13).
 *
 * Version 1.2 (2026-10-08): offertens giltighet och när avtal uppstår,
 * fast pris efter accept, frakt i offerten, undantag från ansvarsbegränsningen
 * vid uppsåt och grov vårdslöshet, force majeure, varumärken, att ändringar
 * inte rör bekräftade order, och språkklausul. Villkoren hänvisas nu till där
 * avtalet ingås: beställningssteget, offerten och orderbekräftelsen.
 *
 * Version 1.3 (2026-10-08, samma dag): frakt tillkommer (beslut att ta betalt
 * för frakt). Den sätts i offertverktyget och på orderbekräftelsen.
 */
export const Route = createFileRoute("/$locale/terms")({
  head: ({ params }) => {
    const sv = params.locale === "sv";
    return {
      meta: [
        { title: sv ? "Allmänna villkor — Maskinval" : "Terms and conditions — Maskinval" },
        {
          name: "description",
          content: sv
            ? "Maskinvals allmänna villkor för användning av plattformen och köp av industrikomponenter."
            : "Maskinval's terms and conditions for using the platform and buying industrial components.",
        },
      ],
    };
  },
  component: TermsPage,
});

type Avsnitt = { titel: string; stycken?: string[]; lista?: string[] };

/** **fetstil** i texten blir <strong>. */
function Text({ s }: { s: string }) {
  const delar = s.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {delar.map((d, i) => (i % 2 === 1
        ? <strong key={i} className="text-foreground">{d}</strong>
        : <Fragment key={i}>{d}</Fragment>))}
    </>
  );
}

function avsnitt(sv: boolean, leverantor: string): Avsnitt[] {
  const dagar = OFFERT_GILTIG_DAGAR;
  if (sv) return [
    { titel: "1. Om tjänsten", stycken: [
      `Maskinval är en B2B-plattform för industriella automationskomponenter. Tjänsten tillhandahålls av ${leverantor} och riktar sig uteslutande till företag och yrkesverksamma (ej konsumenter).`,
      "Villkoren gäller för användningen av plattformen och för alla offerter, beställningar och leveranser från Maskinval. Genom att använda tjänsten, skicka en beställning eller acceptera en offert godkänner du dessa villkor.",
    ] },
    { titel: "2. Konto och behörighet", lista: [
      "Du måste vara minst 18 år och ha behörighet att ingå avtal för ditt företag",
      "Du ansvarar för att hålla dina inloggningsuppgifter konfidentiella",
      "Maskinval förbehåller sig rätten att stänga konton som missbrukar tjänsten",
      "Ett konto per person — delning av konton är inte tillåtet",
    ] },
    { titel: "3. Offerter, priser och avtal", stycken: [
      "Priser på plattformen är **indikativa** och exklusive moms om inget annat anges. En offertförfrågan (RFQ) utgör inte ett bindande anbud.",
      `En offert från Maskinval gäller i **${dagar} dagar** från offertdatum om inget annat anges i offerten. Avtal uppstår när kunden accepterar en giltig offert, eller när Maskinval skriftligen har bekräftat en beställning (orderbekräftelse).`,
      "Priset i en accepterad offert eller i en orderbekräftelse gäller för den ordern. Dessförinnan kan priser ändras utan föregående avisering till följd av valutakurser, leverantörspriser eller marknadssituation. Vi förbehåller oss rätten att korrigera uppenbara fel i pris eller artikel.",
      "Frakt tillkommer och anges i offerten eller orderbekräftelsen.",
    ] },
    { titel: "4. Leverans och ledtider", stycken: [
      "Angivna ledtider är uppskattningar baserade på leverantörsinformation och är inte garanterade. Maskinval ansvarar inte för förseningar orsakade av leverantörer, tullformaliteter, transportstörningar eller force majeure-händelser (avsnitt 9).",
      "Leverans sker till angiven adress via PostNord eller annan speditör. Risken för godset övergår till köparen när det lämnas till transportören.",
    ] },
    { titel: "5. Betalningsvillkor", lista: [
      "Standardbetalningsvillkor: 30 dagar netto från fakturadatum",
      "Vid försenad betalning debiteras dröjsmålsränta enligt räntelagen (referensräntan + 8 procentenheter)",
      "Äganderättsförbehåll gäller tills full betalning erlagts",
      "Kreditbedömning kan ske för nya kunder",
    ] },
    { titel: "6. Reklamationer, garanti och returer", stycken: [
      "Synliga fel och transportskador ska reklameras inom **8 dagar** från mottagandet av godset. Dolda fel ska reklameras inom skälig tid efter att felet upptäckts eller borde ha upptäckts, dock senast **12 månader** efter leverans, eller inom tillverkarens garantitid om den är längre.",
      "Produkterna omfattas av tillverkarens garanti enligt tillverkarens villkor. Maskinval tar emot reklamationer och garantianspråk och driver dem mot tillverkaren eller leverantören.",
      "Fel som omfattas avhjälps genom utbyte eller kreditering efter godkännande. Returer accepteras endast efter skriftligt godkännande från Maskinval. Returkostnaden bärs av köparen om inte felet ligger hos Maskinval, tillverkaren eller leverantören.",
    ] },
    { titel: "7. AI-verktyg och produktrekommendationer", stycken: [
      "Maskinvals AI-chatt och konfigurationsverktyg är **beslutsstöd** — inte ersättning för professionell ingenjörsbedömning. Maskinval ansvarar inte för skador som uppstår till följd av felaktiga specifikationer, dimensioneringsfel eller felaktig användning av produkter som valts med hjälp av AI-verktyg.",
      "Kontrollera alltid att valda produkter uppfyller din applikations krav med en kvalificerad ingenjör innan installation.",
    ] },
    { titel: "8. Ansvarsbegränsning", stycken: [
      "Maskinvals ansvar är begränsat till ordervärdet för den aktuella affären. Vi ansvarar inte för indirekta skador, utebliven vinst, produktionsbortfall eller följdskador. Begränsningarna gäller inte om skadan har orsakats uppsåtligen eller genom grov vårdslöshet.",
      "Utöver tillverkarens garanti (avsnitt 6) lämnar Maskinval inga garantier, utom där tvingande lag säger annat.",
    ] },
    { titel: "9. Force majeure", stycken: [
      "En part är befriad från påföljder för underlåtenhet att fullgöra en förpliktelse om underlåtenheten beror på omständigheter utanför partens kontroll som parten inte skäligen kunde ha förutsett, till exempel krig, naturkatastrof, epidemi, myndighetsbeslut, arbetskonflikt, transportstörning eller fel eller förseningar hos tillverkare eller leverantör som beror på sådana omständigheter. Den part som drabbas ska utan dröjsmål underrätta den andra parten.",
    ] },
    { titel: "10. Immateriella rättigheter", stycken: [
      "Allt innehåll på plattformen — inklusive produktbeskrivningar, bilder, konfigurationsverktyg och AI-funktioner — är Maskinvals eller dess licensgivares egendom. Varumärken och produktnamn tillhör respektive tillverkare. Kopiering, scraping eller vidareutnyttjande utan skriftligt tillstånd är förbjudet.",
    ] },
    { titel: "11. Tillämplig lag och tvistlösning", stycken: [
      "Svensk rätt tillämpas. Tvister ska i första hand lösas genom förhandling. Om parterna inte kan enas hänskjuts tvisten till **Stockholms tingsrätt** som första instans, om inte parterna skriftligen avtalar om skiljeförfarande enligt Stockholms Handelskammares Skiljedomsinstituts regler.",
    ] },
    { titel: "12. Ändringar av villkoren", stycken: [
      "Maskinval kan uppdatera dessa villkor. Väsentliga ändringar meddelas via e-post minst 30 dagar i förväg. Ändringarna gäller inte offerter som redan har lämnats eller order som redan har bekräftats. Fortsatt användning av tjänsten efter ikraftträdandedatum innebär accept av de nya villkoren.",
    ] },
    { titel: "13. Språk", stycken: [
      "Villkoren finns på svenska och engelska. Vid skillnader mellan versionerna gäller den svenska.",
    ] },
  ];
  return [
    { titel: "1. About the service", stycken: [
      `Maskinval is a B2B platform for industrial automation components. The service is provided by ${leverantor} and is intended exclusively for businesses and professionals (not consumers).`,
      "These terms apply to the use of the platform and to all quotes, orders and deliveries from Maskinval. By using the service, sending an order or accepting a quote, you accept these terms.",
    ] },
    { titel: "2. Account and authority", lista: [
      "You must be at least 18 years old and authorised to enter into agreements on behalf of your company",
      "You are responsible for keeping your login details confidential",
      "Maskinval reserves the right to close accounts that misuse the service",
      "One account per person — sharing accounts is not permitted",
    ] },
    { titel: "3. Quotes, prices and agreement", stycken: [
      "Prices on the platform are **indicative** and exclude VAT unless otherwise stated. A request for quotation (RFQ) is not a binding offer.",
      `A quote from Maskinval is valid for **${dagar} days** from the quote date unless otherwise stated in the quote. An agreement is formed when the customer accepts a valid quote, or when Maskinval has confirmed an order in writing (order confirmation).`,
      "The price in an accepted quote or in an order confirmation applies to that order. Before then, prices may change without prior notice due to exchange rates, supplier prices or market conditions. We reserve the right to correct obvious errors in price or item.",
      "Freight is charged in addition and is stated in the quote or the order confirmation.",
    ] },
    { titel: "4. Delivery and lead times", stycken: [
      "Stated lead times are estimates based on supplier information and are not guaranteed. Maskinval is not liable for delays caused by suppliers, customs formalities, transport disruptions or force majeure events (section 9).",
      "Delivery is made to the given address by PostNord or another carrier. The risk for the goods passes to the buyer when they are handed over to the carrier.",
    ] },
    { titel: "5. Payment terms", lista: [
      "Standard payment terms: 30 days net from the invoice date",
      "Late payment incurs interest under the Swedish Interest Act (the reference rate + 8 percentage points)",
      "Title to the goods is retained until full payment has been made",
      "A credit assessment may be made for new customers",
    ] },
    { titel: "6. Claims, warranty and returns", stycken: [
      "Visible defects and transport damage must be reported within **8 days** of receipt of the goods. Hidden defects must be reported within a reasonable time after the defect was discovered or should have been discovered, but no later than **12 months** after delivery, or within the manufacturer's warranty period if that is longer.",
      "The products are covered by the manufacturer's warranty on the manufacturer's terms. Maskinval receives claims and warranty requests and pursues them with the manufacturer or supplier.",
      "Covered defects are remedied by replacement or credit after approval. Returns are accepted only after written approval from Maskinval. The buyer bears the return cost unless the defect lies with Maskinval, the manufacturer or the supplier.",
    ] },
    { titel: "7. AI tools and product recommendations", stycken: [
      "Maskinval's AI chat and configuration tools are **decision support** — not a substitute for professional engineering judgement. Maskinval is not liable for damage resulting from incorrect specifications, sizing errors or incorrect use of products selected with the help of AI tools.",
      "Always have a qualified engineer check that the selected products meet the requirements of your application before installation.",
    ] },
    { titel: "8. Limitation of liability", stycken: [
      "Maskinval's liability is limited to the order value of the transaction concerned. We are not liable for indirect damage, loss of profit, loss of production or consequential damage. These limitations do not apply if the damage was caused intentionally or through gross negligence.",
      "Beyond the manufacturer's warranty (section 6), Maskinval gives no warranties, except where mandatory law provides otherwise.",
    ] },
    { titel: "9. Force majeure", stycken: [
      "A party is released from liability for failure to perform an obligation if the failure is due to circumstances beyond the party's control that the party could not reasonably have foreseen, such as war, natural disaster, epidemic, decisions by authorities, labour disputes, transport disruptions, or defects or delays at a manufacturer or supplier caused by such circumstances. The affected party shall notify the other party without delay.",
    ] },
    { titel: "10. Intellectual property", stycken: [
      "All content on the platform — including product descriptions, images, configuration tools and AI features — is the property of Maskinval or its licensors. Trademarks and product names belong to their respective manufacturers. Copying, scraping or reuse without written permission is prohibited.",
    ] },
    { titel: "11. Governing law and disputes", stycken: [
      "Swedish law applies. Disputes shall primarily be resolved through negotiation. If the parties cannot agree, the dispute shall be referred to the **Stockholm District Court** as the court of first instance, unless the parties agree in writing on arbitration under the rules of the Arbitration Institute of the Stockholm Chamber of Commerce.",
    ] },
    { titel: "12. Changes to the terms", stycken: [
      "Maskinval may update these terms. Material changes are announced by email at least 30 days in advance. Changes do not apply to quotes already issued or orders already confirmed. Continued use of the service after the effective date means acceptance of the new terms.",
    ] },
    { titel: "13. Language", stycken: [
      "These terms are available in Swedish and English. In the event of any discrepancy, the Swedish version prevails.",
    ] },
  ];
}

function TermsPage() {
  const { locale } = Route.useParams();
  const t = makeT(locale as Locale);
  const sv = locale === "sv";
  const [bolag, setBolag] = useState<CompanySettings | null>(null);
  useEffect(() => { fetchCompanySettings().then(setBolag).catch(() => setBolag(null)); }, []);

  // Leverantörens uppgifter (lagen om elektronisk handel, 8 §) med
  // organisationsnummer, adress och momsnummer först när bolaget är
  // registrerat och uppgifterna ifyllda i Admin → Inställningar.
  const leverantor = bolag?.org?.trim()
    ? [
        `${visningsnamn(bolag)} (${sv ? "org.nr" : "reg. no."} ${bolag.org})`,
        [bolag.address, bolag.postal].filter((x) => x?.trim()).join(", "),
        bolag.vat?.trim() ? `${sv ? "momsreg.nr" : "VAT no."} ${bolag.vat}` : "",
      ].filter(Boolean).join(", ")
    : "Maskinval";

  return (
    <div className="container-page py-12 max-w-3xl">
      <Link to="/$locale" params={{ locale }} className="text-xs text-muted-foreground hover:text-info">
        ← {t("common.appName")}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">{sv ? "Allmänna villkor" : "Terms and conditions"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {sv ? "Senast uppdaterad" : "Last updated"}: {VILLKOR_DATUM[sv ? "sv" : "en"]} · Version {VILLKOR_VERSION}
      </p>

      <div className="mt-8 space-y-8 text-sm text-foreground/80 leading-relaxed">
        {avsnitt(sv, leverantor).map((a) => (
          <section key={a.titel}>
            <h2 className="text-base font-semibold text-foreground mb-2">{a.titel}</h2>
            {a.stycken?.map((s, i) => <p key={i} className={i > 0 ? "mt-2" : undefined}><Text s={s} /></p>)}
            {a.lista && (
              <ul className="space-y-1 list-disc list-inside text-foreground/70">
                {a.lista.map((s) => <li key={s}><Text s={s} /></li>)}
              </ul>
            )}
          </section>
        ))}

        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          {sv ? "Frågor? Kontakta oss på" : "Questions? Contact us at"}{" "}
          <a href="mailto:info@maskinval.se" className="text-info hover:underline">info@maskinval.se</a>
          {" "}·{" "}
          <Link to="/$locale/privacy" params={{ locale }} className="text-info hover:underline">
            {sv ? "Integritetspolicy" : "Privacy policy"}
          </Link>
        </div>
      </div>
    </div>
  );
}
