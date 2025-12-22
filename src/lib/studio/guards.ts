import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSupabaseAndUserOrRedirect() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  return { supabase, user: data.user };
}

export async function getWorkspaceIdForUserOrRedirect(userId: string) {
  const { supabase } = await getSupabaseAndUserOrRedirect();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  return membership?.workspace_id ?? null;
}

