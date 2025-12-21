import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstanceSettings } from "@/lib/app/instance";
import { SignInForm } from "./SignInForm";

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/app");
}

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) redirect("/app");

  // If not initialized (or missing migrations), guide users to setup.
  let initialized = false;
  try {
    const instance = await getInstanceSettings();
    initialized = instance.initialized;
  } catch {
    initialized = false;
  }

  if (!initialized) redirect("/setup");

  return (
    <SignInForm
      action={signIn}
      error={error}
      canSetup={false}
    />
  );
}
