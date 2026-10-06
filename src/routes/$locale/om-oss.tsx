import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchCompanySettings, type CompanySettings } from "@/lib/company-settings";
import { SITE, hreflangLinks } from "@/lib/site";
import type { Locale } from "@/lib/i18n";

/**
 * Om oss. Bara det som stämmer i dag: vad sajten gör, hur den arbetar och de
 * bolagsuppgifter som faktiskt är ifyllda i Admin → Inställningar. Namn och
 * bild på personerna bakom läggs till när de finns -- hellre ingen sektion än
 * en påhittad.
 */
type Text = {
  titel: string; ingress: string; gorTitel: string; gor: string[];
  arbetarTitel: string; arbetar: string[]; kontaktTitel: string; kontaktLank: string; meta: string;
};

const TEXT: Record<string, Text> = {
  sv: {
    titel: "Om Maskinval",
    ingress: "Maskinval hjälper maskinbyggare, konstruktörer och underhållsingenjörer att hitta rätt pneumatik- och automationskomponenter – från åtta fabrikat i en sökning.",
    gorTitel: "Det här kan du göra",
    gor: [
      "Söka bland artiklar från Festo, SMC, Parker, AVENTICS, Bosch Rexroth, Norgren, Metal Work och Camozzi – och jämföra dem sida vid sida.",
      "Ersätta en komponent: skriv artikelnumret eller fota typskylten, och få samma artikel eller en motsvarighet med samma ISO-standard från ett annat fabrikat.",
      "Beskriva vad maskinen ska göra: maskinbyggaren ställer följdfrågor, prövar komponenterna mot kraven och ger en stycklista med artikelnummer.",
      "Konfigurera själv: välj borrning, slag och tillval och få en komplett beställningskod.",
    ],
    arbetarTitel: "Så arbetar vi",
    arbetar: [
      "Uppgifterna kommer från tillverkarnas kataloger och datablad. När ett värde har en källa står den på produktsidan, och när underlaget inte räcker säger vi det i stället för att gissa.",
      "AI:n föreslår – en människa bekräftar. Offertförfrågningar besvaras inom 1–2 arbetsdagar, och priset bekräftas innan något beställs.",
      "Fabrikaten jämförs på samma villkor, med skillnaderna utskrivna.",
    ],
    kontaktTitel: "Kontakt",
    kontaktLank: "Skicka en fråga",
    meta: "Maskinval hjälper maskinbyggare och underhållsingenjörer att hitta rätt pneumatik- och automationskomponenter från åtta fabrikat.",
  },
  en: {
    titel: "About Maskinval",
    ingress: "Maskinval helps machine builders, designers and maintenance engineers find the right pneumatic and automation components – from eight brands in one search.",
    gorTitel: "What you can do here",
    gor: [
      "Search parts from Festo, SMC, Parker, AVENTICS, Bosch Rexroth, Norgren, Metal Work and Camozzi – and compare them side by side.",
      "Replace a component: type the part number or photograph the nameplate, and get the same part or an equivalent with the same ISO standard from another brand.",
      "Describe what the machine needs to do: the machine builder asks follow-up questions, checks the components against the requirements and returns a bill of materials with part numbers.",
      "Configure it yourself: choose bore, stroke and options and get a complete order code.",
    ],
    arbetarTitel: "How we work",
    arbetar: [
      "The data comes from the manufacturers' catalogues and datasheets. When a value has a source, it is shown on the product page, and when the data is not enough we say so instead of guessing.",
      "The AI suggests – a person confirms. Quote requests are answered within 1–2 working days, and the price is confirmed before anything is ordered.",
      "The brands are compared on equal terms, with the differences spelled out.",
    ],
    kontaktTitel: "Contact",
    kontaktLank: "Send a question",
    meta: "Maskinval helps machine builders and maintenance engineers find the right pneumatic and automation components from eight brands.",
  },
};

export const Route = createFileRoute("/$locale/om-oss")({
  head: ({ params }) => {
    const x = TEXT[params.locale] ?? TEXT.en;
    return {
      meta: [
        { title: `${x.titel} — Maskinval` },
        { name: "description", content: x.meta },
        { property: "og:title", content: `${x.titel} — Maskinval` },
        { property: "og:description", content: x.meta },
        { property: "og:url", content: `${SITE}/${params.locale}/om-oss` },
      ],
      links: [{ rel: "canonical", href: `${SITE}/${params.locale}/om-oss` }, ...hreflangLinks("om-oss")],
    };
  },
  component: OmOss,
});

function OmOss() {
  const { locale } = Route.useParams() as { locale: Locale };
  const x = TEXT[locale] ?? TEXT.en;
  const [bolag, setBolag] = useState<CompanySettings | null>(null);
  useEffect(() => { fetchCompanySettings().then(setBolag).catch(() => setBolag(null)); }, []);

  // Bolagsnamnet med "AB" först när organisationsnumret finns -- före
  // registreringen finns inget aktiebolag att skriva ut.
  const rader = bolag ? [
    bolag.org ? `${bolag.name} · org.nr ${bolag.org}` : "Maskinval",
    [bolag.address, bolag.postal].filter(Boolean).join(", "),
    bolag.phone,
  ].filter(Boolean) : [];

  return (
    <div className="container-page py-10 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">{x.titel}</h1>
      <p className="mt-3 text-base text-foreground/80 leading-relaxed">{x.ingress}</p>

      <h2 className="mt-10 text-lg font-semibold">{x.gorTitel}</h2>
      <ul className="mt-3 space-y-2 text-sm text-foreground/80 leading-relaxed list-disc pl-5">
        {x.gor.map((g) => <li key={g}>{g}</li>)}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">{x.arbetarTitel}</h2>
      <ul className="mt-3 space-y-2 text-sm text-foreground/80 leading-relaxed list-disc pl-5">
        {x.arbetar.map((g) => <li key={g}>{g}</li>)}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">{x.kontaktTitel}</h2>
      <div className="mt-3 space-y-1 text-sm text-foreground/80">
        {rader.map((r) => <div key={r}>{r}</div>)}
        <div><a href={`mailto:${bolag?.email || "info@maskinval.se"}`} className="text-info hover:underline">{bolag?.email || "info@maskinval.se"}</a></div>
      </div>
      <Link to="/$locale/advisor" params={{ locale }} search={{ q: undefined } as never}
        className="mt-4 inline-block rounded-md bg-info px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
        {x.kontaktLank}
      </Link>
    </div>
  );
}
