import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function isCurrentUserSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;

  const { data: isSuperAdmin, error: rpcError } = await supabase.rpc(
    "is_super_admin",
    {
      user_id: data.user.id
    }
  );

  if (rpcError) return false;
  return Boolean(isSuperAdmin);
}

export async function isEmailAllowlisted(email: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("is_email_allowlisted", {
    p_email: email
  });
  if (error) return false;
  return Boolean(data);
}
