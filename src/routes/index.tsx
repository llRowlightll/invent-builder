import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { detectBrowserLocale, getCookie, isLocale, type Locale } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: RootRedirect,
});

function RootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) cookie
      const cookieLocale = getCookie("lifemap_locale");
      if (isLocale(cookieLocale)) {
        if (!cancelled) navigate({ to: "/$locale", params: { locale: cookieLocale }, replace: true });
        return;
      }
      // 2) profile (if signed in)
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) {
          const { data: profile } = await supabase
            .from("users_profile")
            .select("locale")
            .eq("user_id", sess.session.user.id)
            .maybeSingle();
          if (profile && isLocale(profile.locale)) {
            if (!cancelled)
              navigate({
                to: "/$locale",
                params: { locale: profile.locale as Locale },
                replace: true,
              });
            return;
          }
        }
      } catch {
        // ignore
      }
      // 3) browser
      const locale = detectBrowserLocale();
      if (!cancelled) navigate({ to: "/$locale", params: { locale }, replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}
