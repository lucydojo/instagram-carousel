import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

async function getSignedUrl(bucket: string, path: string) {
  const admin = createSupabaseAdminClientIfAvailable();
  const supabase = admin ?? (await createSupabaseServerClient());
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

export default async function CarouselDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: carousel } = await supabase
    .from("carousels")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!carousel) notFound();

  const { data: assets } = await supabase
    .from("carousel_assets")
    .select("*")
    .eq("carousel_id", id)
    .order("created_at", { ascending: false });

  const isOwner = carousel.owner_id === userData.user.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {carousel.title ?? t(locale, "common.untitled")}
          </h1>
          <div className="text-xs text-slate-600">
            {isOwner
              ? t(locale, "common.youCanEdit")
              : t(locale, "common.viewOnly")}{" "}
            •{" "}
            {new Date(carousel.created_at).toLocaleString()}
          </div>
        </div>
        <Link className="text-sm underline" href="/app">
          {t(locale, "common.back")}
        </Link>
      </div>

      <section className="space-y-2 rounded-md border p-4">
        <div className="text-sm font-medium">
          {t(locale, "carousel.detailDraftTitle")}
        </div>
        <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
          {JSON.stringify(carousel.draft, null, 2)}
        </pre>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-medium">
            {t(locale, "carousel.assetsTitle")}
          </div>
          {isOwner ? (
            <Link
              className="text-sm underline"
              href={`/app/carousels/${carousel.id}/upload`}
            >
              {t(locale, "carousel.assetsUpload")}
            </Link>
          ) : null}
        </div>

        {(assets ?? []).length === 0 ? (
          <div className="text-sm text-slate-600">
            {t(locale, "carousel.assetsEmpty")}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {await Promise.all(
              (assets ?? []).map(async (asset) => {
                const url = await getSignedUrl(
                  asset.storage_bucket,
                  asset.storage_path
                );
                return (
                  <li key={asset.id} className="rounded-md border p-2">
                    <div className="text-xs text-slate-600">
                      {asset.storage_path}
                    </div>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="mt-2 w-full rounded" src={url} />
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">
                        {t(locale, "carousel.assetsUnableToSign")}
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
