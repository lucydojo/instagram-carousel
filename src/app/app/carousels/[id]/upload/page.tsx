import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

async function uploadReference(params: { id: string }, formData: FormData) {
  "use server";

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  if (files.length === 0) redirect(`/app/carousels/${params.id}`);

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/sign-in");

  const { data: carousel } = await supabase
    .from("carousels")
    .select("id, workspace_id, owner_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!carousel) redirect("/app");
  if (carousel.owner_id !== userData.user.id)
    redirect(`/app/carousels/${params.id}`);

  for (const file of files) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `workspaces/${carousel.workspace_id}/carousels/${carousel.id}/reference/${crypto.randomUUID()}.${ext}`;

    const admin = createSupabaseAdminClientIfAvailable();
    const storageClient = admin ?? supabase;

    const { error: uploadError } = await storageClient.storage
      .from("carousel-assets")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      const message =
        !admin && uploadError.message.toLowerCase().includes("row-level")
          ? `${uploadError.message} (Set SUPABASE_SERVICE_ROLE_KEY or add Storage policies for authenticated uploads.)`
          : uploadError.message;
      redirect(
        `/app/carousels/${params.id}?error=${encodeURIComponent(message)}`
      );
    }

    const { error: insertError } = await supabase
      .from("carousel_assets")
      .insert({
        workspace_id: carousel.workspace_id,
        carousel_id: carousel.id,
        owner_id: userData.user.id,
        asset_type: "reference",
        storage_bucket: "carousel-assets",
        storage_path: path,
        mime_type: file.type
      });

    if (insertError) {
      redirect(
        `/app/carousels/${params.id}?error=${encodeURIComponent(insertError.message)}`
      );
    }
  }

  redirect(`/app/carousels/${params.id}`);
}

export default async function UploadReferencesPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const resolved = await params;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">
          {t(locale, "uploadReferences.title")}
        </h1>
        <p className="text-sm text-slate-600">
          {t(locale, "uploadReferences.subtitle")}
        </p>
      </div>

      <form
        action={uploadReference.bind(null, resolved)}
        className="space-y-4 rounded-md border p-4"
      >
        <input
          className="w-full"
          type="file"
          name="files"
          accept="image/*"
          multiple
          required
        />
        <button
          className="w-full rounded-md bg-black px-3 py-2 text-white"
          type="submit"
        >
          {t(locale, "common.upload")}
        </button>
      </form>
    </div>
  );
}
