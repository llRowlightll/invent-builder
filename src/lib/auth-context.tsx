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

const ADMIN_EMAIL = "alexandrooden@gmail.com";

/** Returns true if the current user is an admin (by email or app_metadata role). */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return (
    user?.email === ADMIN_EMAIL ||
    user?.app_metadata?.role === "admin"
  );
}

/** Returns { isAdmin, authLoading } — use authLoading to avoid flash-redirect before auth is ready. */
export function useAdminGuard(): { isAdmin: boolean; authLoading: boolean } {
  const { user, loading } = useAuth();
  return {
    isAdmin: user?.email === ADMIN_EMAIL || user?.app_metadata?.role === "admin",
    authLoading: loading,
  };
}
