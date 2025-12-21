import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isEmailAllowlisted, isCurrentUserSuperAdmin } from "@/lib/app/access";

async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/sign-in");
  }

  const email = data.user.email ?? "";
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  const allowlisted = email ? await isEmailAllowlisted(email) : false;

  if (!isSuperAdmin && !allowlisted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Access not granted</h1>
        <p className="text-sm text-slate-600">
          Your email is not allowlisted for this demo. Ask a super admin to
          invite you.
        </p>
        <form action={signOut}>
          <button className="rounded-md border px-3 py-2" type="submit">
            Sign out
          </button>
        </form>
      </main>
    );
  }

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", data.user.id);

  const workspaceId = memberships?.[0]?.workspace_id;

  // Attempt self-join to default workspace for allowlisted users (ignore errors).
  if (!workspaceId && allowlisted) {
    const { data: defaultWorkspace } = await supabase
      .from("workspaces")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (defaultWorkspace?.id) {
      await supabase.from("workspace_members").insert({
        workspace_id: defaultWorkspace.id,
        user_id: data.user.id,
        role: "member"
      });
    }
  }

  const { data: workspace } = workspaceId
    ? await supabase
        .from("workspaces")
        .select("id, name, logo_path")
        .eq("id", workspaceId)
        .single()
    : { data: null };

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Link className="font-semibold" href="/app">
              {workspace?.name ?? "Dojogram"}
            </Link>
            {isSuperAdmin ? (
              <Link
                className="text-sm text-slate-600 underline"
                href="/app/admin"
              >
                Admin
              </Link>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{email}</span>
            <form action={signOut}>
              <button
                className="rounded-md border px-3 py-2 text-sm"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
