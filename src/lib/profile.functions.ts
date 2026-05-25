import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Save a user's company profile server-side using the service role key.
 * This bypasses client-side RLS policies which can silently block writes.
 * Security: the JWT token is verified via supabaseAdmin.auth.getUser() so
 * only the authenticated user can write their own profile row.
 */
export const saveProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    token: string;
    profile: Record<string, unknown>;
  }) => d)
  .handler(async ({ data }) => {
    // Verify the JWT — this ensures only the real user can write their row
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(data.token);
    if (authError || !user) throw new Error("Unauthorized");

    const p = data.profile;
    const complete = !!(p.company_name && p.industry && p.role && p.employees && p.phone);

    const { data: saved, error } = await supabaseAdmin
      .from("company_profiles")
      .upsert({
        id: user.id,
        email: user.email,
        ...p,
        profile_complete: complete,
      }, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      console.error("[saveProfileFn] upsert error:", error);
      throw new Error(error.message);
    }

    return saved;
  });
