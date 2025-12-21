import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  const user = userData.user;
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.workspace_id) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Welcome</h1>
        <p className="text-sm text-slate-600">
          You’re allowlisted, but not yet in a workspace. Ask a super admin to
          invite you, or try again.
        </p>
      </div>
    );
  }

  const { data: carousels } = await supabase
    .from("carousels")
    .select("id, title, owner_id, created_at")
    .eq("workspace_id", membership.workspace_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Carousels</h1>
        <Link
          className="rounded-md bg-black px-3 py-2 text-sm text-white"
          href="/app/new"
        >
          New carousel
        </Link>
      </div>

      <ul className="space-y-2">
        {(carousels ?? []).map((carousel) => (
          <li key={carousel.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">
                  {carousel.title ?? "Untitled"}
                </div>
                <div className="text-xs text-slate-600">
                  {carousel.owner_id === user.id ? "You" : "Workspace member"} •{" "}
                  {new Date(carousel.created_at).toLocaleString()}
                </div>
              </div>
              <Link
                className="text-sm underline"
                href={`/app/carousels/${carousel.id}`}
              >
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
