import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/app/access";
import { getEnv } from "@/lib/env";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

const emailSchema = z.string().email();

async function addAllowlist(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  if (!emailSchema.safeParse(email).success) {
    redirect("/app/admin/allowlist?error=Invalid%20email");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) redirect("/app");

  const { error } = await supabase.from("allowlisted_emails").upsert({
    email,
    invited_by: data.user.id
  });

  if (error)
    redirect(`/app/admin/allowlist?error=${encodeURIComponent(error.message)}`);

  redirect("/app/admin/allowlist");
}

async function inviteAllowlisted(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  if (!emailSchema.safeParse(email).success) {
    redirect("/app/admin/allowlist?error=Invalid%20email");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) redirect("/app");

  await supabase.from("allowlisted_emails").upsert({
    email,
    invited_by: data.user.id
  });

  const env = getEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect(
      "/app/admin/allowlist?error=Missing%20SUPABASE_SERVICE_ROLE_KEY%20for%20invites"
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/sign-in`
  });

  if (error)
    redirect(`/app/admin/allowlist?error=${encodeURIComponent(error.message)}`);

  redirect("/app/admin/allowlist?invited=1");
}

export default async function AllowlistPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; invited?: string }>;
}) {
  const locale = await getLocale();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) redirect("/app");

  const { data: allowlist } = await supabase
    .from("allowlisted_emails")
    .select("*")
    .order("created_at", { ascending: false });

  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;
  const invited = params?.invited === "1";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">
          {t(locale, "admin.allowlist.title")}
        </h1>
        <p className="text-sm text-slate-600">
          {t(locale, "admin.allowlist.subtitle")}
        </p>
      </div>

      {invited ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {t(locale, "admin.allowlist.inviteSent")}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3 rounded-md border p-4">
        <form action={addAllowlist} className="flex gap-2">
          <input
            className="flex-1 rounded-md border px-3 py-2"
            name="email"
            type="email"
            placeholder={t(locale, "admin.allowlist.emailPlaceholder")}
            required
          />
          <button className="rounded-md border px-3 py-2" type="submit">
            {t(locale, "admin.allowlist.allowlistAction")}
          </button>
        </form>

        <form action={inviteAllowlisted} className="flex gap-2">
          <input
            className="flex-1 rounded-md border px-3 py-2"
            name="email"
            type="email"
            placeholder={t(locale, "admin.allowlist.emailPlaceholder")}
            required
          />
          <button
            className="rounded-md bg-black px-3 py-2 text-white"
            type="submit"
          >
            {t(locale, "admin.allowlist.inviteAction")}
          </button>
        </form>

        <p className="text-xs text-slate-600">
          “Allowlist + invite” requires `SUPABASE_SERVICE_ROLE_KEY` in env. If
          missing, you can still allowlist and manually create users in
          Supabase.
        </p>
      </div>

      <ul className="space-y-2">
        {(allowlist ?? []).map((entry) => (
          <li key={entry.email} className="rounded-md border p-3">
            <div className="font-medium">{entry.email}</div>
            <div className="text-xs text-slate-600">
              {new Date(entry.created_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
