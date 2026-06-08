import { createFileRoute, redirect } from "@tanstack/react-router";

// Bare /configurator → the product-family picker (/configure), which links on to
// the per-family wizard at /configurator/$family.
export const Route = createFileRoute("/$locale/configurator/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$locale/configure",
      params: { locale: (params as { locale: string }).locale } as never,
    });
  },
});
