import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Nyhetssidan är borttagen (2026-10-03) och adressen leder till guiderna.
 *
 * Granskningen hittade tio "nyheter" som var 18–24 månader gamla, saknade
 * källa och innehöll fel om tillverkarnas produkter. Exempel: "EMMT-AS
 * kombinerar servomotor, drivsteg och positionsgivare i en enhet" -- medan
 * sajtens egen produktsida, med rätta, säger att EMMT-AS styrs av en separat
 * CMMT-AS. "Läs mer"-länkarna gick till tillverkarnas startsidor. En sida som
 * påstår saker om andras produkter utan källa kostar mer förtroende än den
 * ger. Adressen omdirigeras i stället för att ge 404, eftersom den kan finnas
 * i sökmotorer och bokmärken. Innehållet finns kvar i git-historiken.
 */
export const Route = createFileRoute("/$locale/new")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$locale/guider",
      params: { locale: (params as { locale: string }).locale } as never,
      statusCode: 301,
    });
  },
});
