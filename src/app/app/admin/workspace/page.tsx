import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/app/access";

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

    const { error: uploadError } = await supabase.storage
      .from("workspace-logos")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

    if (uploadError) {
      redirect(
        `/app/admin/workspace?error=${encodeURIComponent(uploadError.message)}`
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
        <h1 className="text-xl font-semibold">Workspace branding</h1>
        <p className="text-sm text-slate-600">
          Minimal white-label controls: name and logo.
        </p>
      </div>

      {saved ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Saved.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!workspace ? (
        <div className="text-sm text-slate-600">No workspace found.</div>
      ) : (
        <form
          action={updateWorkspace}
          className="space-y-4 rounded-md border p-4"
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium">Name</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="name"
              defaultValue={workspace.name}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Logo</span>
            <input
              className="w-full"
              type="file"
              name="logo"
              accept="image/*"
            />
            <div className="text-xs text-slate-600">
              Current: {workspace.logo_path ?? "none"}
            </div>
          </label>

          <button
            className="w-full rounded-md bg-black px-3 py-2 text-white"
            type="submit"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}
