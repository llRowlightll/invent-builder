import { createFileRoute, redirect } from "@tanstack/react-router";

// Server-side redirect: bare "/" → "/sv".
// Runs in beforeLoad during SSR, so Googlebot and direct visitors get a clean
// 302 to the Swedish homepage instead of a client-side "Loading…" shell that
// requires JavaScript to resolve. hreflang tags on /sv announce /en /de /es,
// so Google still discovers and indexes every locale. A .se domain canonically
// defaults to Swedish.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$locale", params: { locale: "sv" }, replace: true });
  },
});
