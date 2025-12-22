import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstanceSettings } from "@/lib/app/instance";
import { SignInForm } from "./SignInForm";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

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
  const locale = await getLocale();
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
    <div className="relative">
      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher redirectTo="/sign-in" />
      </div>
      <SignInForm
        action={signIn}
        error={error}
        copy={{
          title: t(locale, "signIn.title"),
          subtitle: t(locale, "signIn.subtitle"),
          emailLabel: t(locale, "signIn.email"),
          emailPlaceholder: t(locale, "signIn.emailPlaceholder"),
          passwordLabel: t(locale, "signIn.password"),
          passwordPlaceholder: t(locale, "signIn.passwordPlaceholder"),
          cta: t(locale, "signIn.cta")
        }}
      />
    </div>
  );
}
