import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/app/access";

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-slate-600">
          You do not have access to this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          <Link className="underline" href="/app/admin/allowlist">
            Allowlist + invites
          </Link>
        </li>
        <li>
          <Link className="underline" href="/app/admin/workspace">
            Workspace branding
          </Link>
        </li>
      </ul>
    </div>
  );
}
