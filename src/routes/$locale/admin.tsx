/**
 * Admin layout route — guards all /$locale/admin/* child routes.
 * Only accessible to authenticated admins; others are redirected to login.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useIsAdmin } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/$locale/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const { locale } = Route.useParams();

  useEffect(() => {
    if (!isAdmin) {
      navigate({ to: "/$locale/login", params: { locale }, replace: true });
    }
  }, [isAdmin, locale, navigate]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Åtkomst nekad — logga in som admin.</p>
      </div>
    );
  }

  return <Outlet />;
}
