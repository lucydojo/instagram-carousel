import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstanceSettings } from "@/lib/app/instance";
import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function isSupabaseErrorLike(error: unknown): error is SupabaseErrorLike {
  return !!error && typeof error === "object" && "message" in error;
}

function getSupabaseErrorMessage(error: unknown): string {
  if (!isSupabaseErrorLike(error)) return "Unknown error.";
  const details = error.details ? ` (${error.details})` : "";
  const hint = error.hint ? ` Hint: ${error.hint}` : "";
  return `${error.message ?? "Unknown error."}${details}${hint}`;
}

function isMissingMigrationsError(error: unknown): boolean {
  if (!isSupabaseErrorLike(error)) return false;
  return (
    error.code === "42P01" ||
    (typeof error.message === "string" &&
      error.message.toLowerCase().includes("does not exist"))
  );
}

function isEmailNotConfirmedError(error: unknown): boolean {
  if (!isSupabaseErrorLike(error)) return false;
  return (
    typeof error.message === "string" &&
    error.message.toLowerCase().includes("email not confirmed")
  );
}

async function confirmEmailIfPossible(admin: ReturnType<
  typeof createSupabaseAdminClientIfAvailable
>, email: string) {
  if (!admin) return { error: null as SupabaseErrorLike | null };

  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { error };

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (user?.id) {
      const { error: confirmError } = await admin.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );
      return { error: confirmError };
    }

    if (!data.nextPage) break;
    page = data.nextPage;
  }

  return {
    error: {
      message:
        "Unable to find the user to confirm email. Try deleting the user in Supabase Auth and retry."
    }
  };
}

async function bootstrap(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  const logoFile = formData.get("logo") as File | null;

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClientIfAvailable();
  const dbClient = admin ?? supabase;

  let instance: Awaited<ReturnType<typeof getInstanceSettings>>;
  try {
    instance = await getInstanceSettings();
  } catch (error) {
    const message = isMissingMigrationsError(error)
      ? "Database schema not found. Apply the Supabase migrations first, then reload /setup."
      : getSupabaseErrorMessage(error);
    redirect(`/setup?error=${encodeURIComponent(message)}`);
  }
  if (instance.initialized) {
    redirect("/sign-in");
  }

  let userId: string | null = null;

  const signInAttempt = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInAttempt.data.user) {
    userId = signInAttempt.data.user.id;
  } else if (isEmailNotConfirmedError(signInAttempt.error) && admin) {
    const { error: confirmError } = await confirmEmailIfPossible(admin, email);
    if (confirmError) {
      redirect(`/setup?error=${encodeURIComponent(confirmError.message ?? "")}`);
    }

    const secondSignIn = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (!secondSignIn.data.user) {
      redirect(
        `/setup?error=${encodeURIComponent(
          secondSignIn.error?.message ?? "Sign in failed"
        )}`
      );
    }
    userId = secondSignIn.data.user.id;
  } else if (isEmailNotConfirmedError(signInAttempt.error) && !admin) {
    redirect(
      `/setup?error=${encodeURIComponent(
        "Email not confirmed (Confirm the email first, or set SUPABASE_SERVICE_ROLE_KEY so setup can auto-confirm.)"
      )}`
    );
  } else {
    if (admin) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (error || !data.user) {
        redirect(
          `/setup?error=${encodeURIComponent(error?.message ?? "User creation failed")}`
        );
      }

      userId = data.user.id;

      const { error: postCreateSignInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (postCreateSignInError) {
        redirect(
          `/setup?error=${encodeURIComponent(
            `${postCreateSignInError.message} (User was created; try signing in on /sign-in.)`
          )}`
        );
      }
    } else {
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password
        });

      if (signUpError || !signUpData.user) {
        redirect(
          `/setup?error=${encodeURIComponent(signUpError?.message ?? "Sign up failed")}`
        );
      }

      if (!signUpData.session) {
        redirect(
          `/setup?error=${encodeURIComponent(
            "Email confirmation is enabled in Supabase Auth, so setup can't complete automatically. Disable email confirmations temporarily or set SUPABASE_SERVICE_ROLE_KEY."
          )}`
        );
      }

      userId = signUpData.user.id;
    }
  }

  if (!userId) {
    redirect(`/setup?error=${encodeURIComponent("Unable to create/sign in user")}`);
  }

  const { error: superAdminError } = await dbClient
    .from("super_admins")
    .insert({
      user_id: userId,
      email
    });
  if (superAdminError) {
    redirect(`/setup?error=${encodeURIComponent(superAdminError.message)}`);
  }

  const { data: workspace, error: workspaceError } = await dbClient
    .from("workspaces")
    .insert({
      name: workspaceName || "Dojogram",
      created_by: userId
    })
    .select("*")
    .single();

  if (workspaceError || !workspace) {
    redirect(
      `/setup?error=${encodeURIComponent(workspaceError?.message ?? "Workspace failed")}`
    );
  }

  const { error: membershipError } = await dbClient
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: "owner"
    });
  if (membershipError) {
    redirect(`/setup?error=${encodeURIComponent(membershipError.message)}`);
  }

  const { error: allowlistError } = await dbClient
    .from("allowlisted_emails")
    .insert({
      email,
      invited_by: userId
    });
  if (allowlistError) {
    redirect(`/setup?error=${encodeURIComponent(allowlistError.message)}`);
  }

  if (
    logoFile &&
    typeof logoFile.arrayBuffer === "function" &&
    logoFile.size > 0
  ) {
    const extension = logoFile.name.split(".").pop() || "png";
    const path = `workspaces/${workspace.id}/branding/logo-${crypto.randomUUID()}.${extension}`;

    const storageClient = admin ?? supabase;

    const { error: uploadError } = await storageClient.storage
      .from("workspace-logos")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

    if (uploadError) {
      redirect(`/setup?error=${encodeURIComponent(uploadError.message)}`);
    }

    const { error: updateError } = await dbClient
      .from("workspaces")
      .update({ logo_path: path })
      .eq("id", workspace.id);

    if (updateError) {
      redirect(`/setup?error=${encodeURIComponent(updateError.message)}`);
    }
  }

  const { error: instanceError } = await dbClient
    .from("instance_settings")
    .update({ initialized: true })
    .eq("id", 1);

  if (instanceError) {
    redirect(`/setup?error=${encodeURIComponent(instanceError.message)}`);
  }

  redirect("/app");
}

export default async function SetupPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const locale = await getLocale();
  let instance: Awaited<ReturnType<typeof getInstanceSettings>> | null = null;
  let instanceLoadError: string | null = null;
  const hasAdminKey = !!createSupabaseAdminClientIfAvailable();

  try {
    instance = await getInstanceSettings();
  } catch (error) {
    instanceLoadError = isMissingMigrationsError(error)
      ? "Database schema not found. Apply the Supabase migrations (including `supabase/migrations/20251221180000_foundations.sql`) and reload."
      : getSupabaseErrorMessage(error);
  }

  if (instance?.initialized) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;
  const combinedError = error ?? instanceLoadError;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t(locale, "setup.title")}</h1>
        <p className="text-sm text-slate-600">
          {t(locale, "setup.subtitle")}
        </p>
      </div>

      {!hasAdminKey ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t(locale, "setup.tipServiceRole").split("SUPABASE_SERVICE_ROLE_KEY")[0]}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>
          {t(locale, "setup.tipServiceRole").split("SUPABASE_SERVICE_ROLE_KEY")[1] ?? ""}
        </div>
      ) : null}

      {combinedError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {combinedError}
        </div>
      ) : null}

      <form action={bootstrap} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">
            {t(locale, "setup.superAdminEmail")}
          </span>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="email"
            name="email"
            required
            disabled={!instance}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">{t(locale, "setup.password")}</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            name="password"
            minLength={8}
            required
            disabled={!instance}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">
            {t(locale, "setup.workspaceName")}
          </span>
          <input
            className="w-full rounded-md border px-3 py-2"
            name="workspaceName"
            disabled={!instance}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">
            {t(locale, "setup.workspaceLogo")}
          </span>
          <input
            className="w-full"
            type="file"
            name="logo"
            accept="image/*"
            disabled={!instance}
          />
        </label>

        <button
          className="w-full rounded-md bg-black px-3 py-2 text-white"
          type="submit"
          disabled={!instance}
        >
          {t(locale, "setup.cta")}
        </button>
      </form>
    </main>
  );
}
