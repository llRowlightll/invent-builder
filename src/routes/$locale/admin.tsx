/**
 * Admin layout route — guards all /$locale/admin/* child routes.
 * Only accessible to authenticated admins; others are redirected to login.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAdminGuard } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/$locale/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  // useAdminGuard, inte useIsAdmin. Skillnaden är authLoading.
  //
  // Rättat 2026-09-10: vakten omdirigerade så fort isAdmin var falsk, utan att
  // vänta på att sessionen lästs in. Vid KALL sidladdning -- direktlänk,
  // uppdatering, öppna i ny flik -- är sessionen ännu inte hydrerad, isAdmin är
  // falsk, och effekten sköt iväg till inloggningen direkt. Inuti appen var
  // sessionen redan läst, så navigering mellan sidor fungerade.
  //
  // Verifierat mot produktion: /sv/admin/rfq via länk inifrån appen gav
  // "RFQ / Orderhantering"; exakt samma URL laddad direkt gav inloggningssidan,
  // med ett konto som har admin-rollen.
  //
  // Hooken som löser det fanns redan, med kommentaren "use authLoading to
  // avoid flash-redirect before auth is ready". Den var bara inte inkopplad.
  const { isAdmin, authLoading } = useAdminGuard();
  const navigate = useNavigate();
  const { locale } = Route.useParams();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate({ to: "/$locale/login", params: { locale }, replace: true });
    }
  }, [isAdmin, authLoading, locale, navigate]);

  // Medan sessionen läses in: varken släpp in eller kasta ut.
  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Kontrollerar behörighet…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Åtkomst nekad — logga in som admin.</p>
      </div>
    );
  }

  return <Outlet />;
}
