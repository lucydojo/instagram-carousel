import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstanceSettings } from "@/lib/app/instance";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  try {
    const instance = await getInstanceSettings();
    if (!instance.initialized) redirect("/setup");
  } catch {
    redirect("/setup");
  }

  if (userData.user) redirect("/app");
  redirect("/sign-in");
}
