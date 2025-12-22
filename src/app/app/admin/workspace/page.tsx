import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/app/access";
import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

async function updateWorkspace(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const logoFile = formData.get("logo") as File | null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) redirect("/app");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!workspace?.id) redirect("/app");

  const updates: { name?: string; logo_path?: string | null } = {};
  if (name) updates.name = name;

  if (
    logoFile &&
    typeof logoFile.arrayBuffer === "function" &&
    logoFile.size > 0
  ) {
    const extension = logoFile.name.split(".").pop() || "png";
    const path = `workspaces/${workspace.id}/branding/logo-${crypto.randomUUID()}.${extension}`;

    const admin = createSupabaseAdminClientIfAvailable();
    const storageClient = admin ?? supabase;

    const { error: uploadError } = await storageClient.storage
      .from("workspace-logos")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

    if (uploadError) {
      const message =
        !admin && uploadError.message.toLowerCase().includes("row-level")
          ? `${uploadError.message} (Set SUPABASE_SERVICE_ROLE_KEY or add Storage policies for authenticated uploads.)`
          : uploadError.message;
      redirect(
        `/app/admin/workspace?error=${encodeURIComponent(message)}`
      );
    }

    updates.logo_path = path;
  }

  const { error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", workspace.id);
  if (error)
    redirect(`/app/admin/workspace?error=${encodeURIComponent(error.message)}`);

  redirect("/app/admin/workspace?saved=1");
}

export default async function WorkspaceAdminPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const locale = await getLocale();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) redirect("/app");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, logo_path")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;
  const saved = params?.saved === "1";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">
          {t(locale, "admin.workspace.title")}
        </h1>
        <p className="text-sm text-slate-600">
          {t(locale, "admin.workspace.subtitle")}
        </p>
      </div>

      {saved ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {t(locale, "common.saved")}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!workspace ? (
        <div className="text-sm text-slate-600">
          {t(locale, "admin.workspace.notFound")}
        </div>
      ) : (
        <form
          action={updateWorkspace}
          className="space-y-4 rounded-md border p-4"
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "admin.workspace.name")}
            </span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="name"
              defaultValue={workspace.name}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "admin.workspace.logo")}
            </span>
            <input
              className="w-full"
              type="file"
              name="logo"
              accept="image/*"
            />
            <div className="text-xs text-slate-600">
              {t(locale, "admin.workspace.currentLogo")}{" "}
              {workspace.logo_path ?? t(locale, "admin.workspace.none")}
            </div>
          </label>

          <button
            className="w-full rounded-md bg-black px-3 py-2 text-white"
            type="submit"
          >
            {t(locale, "common.save")}
          </button>
        </form>
      )}
    </div>
  );
}
