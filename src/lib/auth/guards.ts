import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSessionUserOrRedirect() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null };
  }

  return { user: data.user };
}

export async function requireUser() {
  const result = await getSessionUserOrRedirect();
  if (!result.user) {
    throw new Error("UNAUTHENTICATED");
  }
  return result.user;
}
