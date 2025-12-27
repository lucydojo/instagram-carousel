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
  const referenceAssets = (assets ?? []).filter((a) => a.asset_type === "reference");
  const generatedAssets = (assets ?? []).filter((a) => a.asset_type === "generated");
  const exportAssets = (assets ?? []).filter((a) => a.asset_type === "export");

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
        <div className="flex items-center gap-3">
          <Link
            className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href={`/app/studio/${carousel.id}`}
          >
            Abrir no Studio
          </Link>
          <Link className="text-sm underline" href="/app">
            {t(locale, "common.back")}
          </Link>
        </div>
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
          <div className="text-sm font-medium">Assets</div>
        </div>

        {(assets ?? []).length === 0 ? (
          <div className="text-sm text-slate-600">{t(locale, "carousel.assetsEmpty")}</div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium">
                  Referências <span className="text-xs text-slate-600">({referenceAssets.length})</span>
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
              {referenceAssets.length === 0 ? (
                <div className="text-sm text-slate-600">Sem referências.</div>
              ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {await Promise.all(
                    referenceAssets.map(async (asset) => {
                      const url = await getSignedUrl(
                        asset.storage_bucket,
                        asset.storage_path
                      );
                      return (
                        <li key={asset.id} className="rounded-md border p-2">
                          <div className="text-xs text-slate-600">{asset.storage_path}</div>
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

            <section className="space-y-3">
              <div className="text-sm font-medium">
                Geradas pela IA{" "}
                <span className="text-xs text-slate-600">({generatedAssets.length})</span>
              </div>
              {generatedAssets.length === 0 ? (
                <div className="text-sm text-slate-600">Nada gerado ainda.</div>
              ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {await Promise.all(
                    generatedAssets.map(async (asset) => {
                      const url = await getSignedUrl(
                        asset.storage_bucket,
                        asset.storage_path
                      );
                      return (
                        <li key={asset.id} className="rounded-md border p-2">
                          <div className="text-xs text-slate-600">{asset.storage_path}</div>
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

            <section className="space-y-3">
              <div className="text-sm font-medium">
                Exportações{" "}
                <span className="text-xs text-slate-600">({exportAssets.length})</span>
              </div>
              {exportAssets.length === 0 ? (
                <div className="text-sm text-slate-600">Nenhuma exportação ainda.</div>
              ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {await Promise.all(
                    exportAssets.map(async (asset) => {
                      const url = await getSignedUrl(
                        asset.storage_bucket,
                        asset.storage_path
                      );
                      return (
                        <li key={asset.id} className="rounded-md border p-2">
                          <div className="text-xs text-slate-600">{asset.storage_path}</div>
                          {url ? (
                            <a className="mt-2 inline-block text-sm underline" href={url}>
                              Baixar
                            </a>
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
        )}
      </section>
    </div>
  );
}
