import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getInstanceSettings() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("instance_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
