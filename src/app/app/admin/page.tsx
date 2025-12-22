import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/app/access";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

export default async function AdminHomePage() {
  const locale = await getLocale();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{t(locale, "common.admin")}</h1>
        <p className="text-sm text-slate-600">
          {t(locale, "admin.home.noAccess")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t(locale, "common.admin")}</h1>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          <Link className="underline" href="/app/admin/allowlist">
            {t(locale, "admin.home.allowlistLink")}
          </Link>
        </li>
        <li>
          <Link className="underline" href="/app/admin/workspace">
            {t(locale, "admin.home.workspaceLink")}
          </Link>
        </li>
      </ul>
    </div>
  );
}
