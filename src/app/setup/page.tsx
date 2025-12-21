import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInstanceSettings } from "@/lib/app/instance";

async function bootstrap(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  const logoFile = formData.get("logo") as File | null;

  const supabase = await createSupabaseServerClient();

  const instance = await getInstanceSettings();
  if (instance.initialized) {
    redirect("/sign-in");
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });
  if (signUpError || !signUpData.user) {
    redirect(
      `/setup?error=${encodeURIComponent(signUpError?.message ?? "Sign up failed")}`
    );
  }

  const userId = signUpData.user.id;

  const { error: superAdminError } = await supabase
    .from("super_admins")
    .insert({
      user_id: userId,
      email
    });
  if (superAdminError) {
    redirect(`/setup?error=${encodeURIComponent(superAdminError.message)}`);
  }

  const { data: workspace, error: workspaceError } = await supabase
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

  const { error: membershipError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: "owner"
    });
  if (membershipError) {
    redirect(`/setup?error=${encodeURIComponent(membershipError.message)}`);
  }

  const { error: allowlistError } = await supabase
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

    const { error: uploadError } = await supabase.storage
      .from("workspace-logos")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

    if (uploadError) {
      redirect(`/setup?error=${encodeURIComponent(uploadError.message)}`);
    }

    const { error: updateError } = await supabase
      .from("workspaces")
      .update({ logo_path: path })
      .eq("id", workspace.id);

    if (updateError) {
      redirect(`/setup?error=${encodeURIComponent(updateError.message)}`);
    }
  }

  const { error: instanceError } = await supabase
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
  const instance = await getInstanceSettings();

  if (instance.initialized) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">First run setup</h1>
        <p className="text-sm text-slate-600">
          Create the first super admin and the initial workspace.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form action={bootstrap} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Super admin email</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="email"
            name="email"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Password</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="password"
            name="password"
            minLength={8}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Workspace name</span>
          <input
            className="w-full rounded-md border px-3 py-2"
            name="workspaceName"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Workspace logo (optional)</span>
          <input className="w-full" type="file" name="logo" accept="image/*" />
        </label>

        <button
          className="w-full rounded-md bg-black px-3 py-2 text-white"
          type="submit"
        >
          Create admin + workspace
        </button>
      </form>
    </main>
  );
}
