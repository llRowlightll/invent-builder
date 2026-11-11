import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}

/**
 * Admin avgörs av rollen i kontots app_metadata, som bara servern kan sätta.
 * En hårdkodad privat Gmail-adress stod här till 2026-11-11 -- i ett publikt
 * repo, och utan funktion: adminkontot har rollen både i app_metadata och i
 * user_roles. Databasens RLS är det som faktiskt skyddar; det här styr bara
 * vilka sidor som visas.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.app_metadata?.role === "admin";
}

/** Returns { isAdmin, authLoading } — use authLoading to avoid flash-redirect before auth is ready. */
export function useAdminGuard(): { isAdmin: boolean; authLoading: boolean } {
  const { user, loading } = useAuth();
  return {
    isAdmin: user?.app_metadata?.role === "admin",
    authLoading: loading,
  };
}
