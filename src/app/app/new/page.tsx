import { redirect } from "next/navigation";
import { z } from "zod";
import type { CarouselDraft } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";
import { generateFirstDraftForCarousel } from "@/lib/studio/generation";

const newCarouselSchema = z.object({
  inputMode: z.enum(["topic", "prompt"]),
  topic: z.string().optional(),
  prompt: z.string().optional(),
  slidesCount: z.coerce.number().int().min(2).max(10),
  platform: z.literal("instagram"),
  tone: z.string().optional(),
  targetAudience: z.string().optional(),
  language: z.string().optional(),
  templateId: z.string().optional(),
  presetId: z.string().optional(),
  creatorEnabled: z.coerce.boolean().optional(),
  creatorName: z.string().optional(),
  creatorHandle: z.string().optional(),
  creatorRole: z.string().optional(),
  paletteBackground: z.string().optional(),
  paletteText: z.string().optional(),
  paletteAccent: z.string().optional(),
  referenceSimilarity: z.coerce.number().int().min(0).max(100).optional()
});

const MAX_REFERENCE_BYTES = 500 * 1024 * 1024;

async function uploadReferenceFiles(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  carouselId: string;
  workspaceId: string;
  ownerId: string;
  files: File[];
  kind: "style" | "content";
}) {
  const admin = createSupabaseAdminClientIfAvailable();
  const storageClient = admin ?? input.supabase;

  for (const file of input.files) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `workspaces/${input.workspaceId}/carousels/${input.carouselId}/reference/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await storageClient.storage
      .from("carousel-assets")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: insertError } = await input.supabase
      .from("carousel_assets")
      .insert({
        workspace_id: input.workspaceId,
        carousel_id: input.carouselId,
        owner_id: input.ownerId,
        asset_type: "reference",
        storage_bucket: "carousel-assets",
        storage_path: path,
        mime_type: file.type,
        metadata: {
          reference_kind: input.kind
        }
      });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

async function createCarousel(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/sign-in");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!membership?.workspace_id) {
    redirect("/app");
  }

  const styleFilesRaw = formData
    .getAll("styleReferences")
    .filter((f): f is File => f instanceof File);
  const contentFilesRaw = formData
    .getAll("contentReferences")
    .filter((f): f is File => f instanceof File);
  const totalReferenceBytes = [...styleFilesRaw, ...contentFilesRaw].reduce(
    (sum, file) => sum + file.size,
    0
  );
  if (totalReferenceBytes > MAX_REFERENCE_BYTES) {
    redirect(
      `/app/new?error=${encodeURIComponent(
        "As referências excedem 500MB. Reduza o tamanho das imagens."
      )}`
    );
  }

  const parsed = newCarouselSchema.safeParse({
    inputMode: formData.get("inputMode"),
    topic: formData.get("topic") ? String(formData.get("topic")) : undefined,
    prompt: formData.get("prompt") ? String(formData.get("prompt")) : undefined,
    slidesCount: formData.get("slidesCount"),
    platform: "instagram",
    tone: formData.get("tone") ? String(formData.get("tone")) : undefined,
    targetAudience: formData.get("targetAudience")
      ? String(formData.get("targetAudience"))
      : undefined,
    language: formData.get("language")
      ? String(formData.get("language"))
      : undefined,
    templateId: formData.get("templateId")
      ? String(formData.get("templateId"))
      : undefined,
    presetId: formData.get("presetId")
      ? String(formData.get("presetId"))
      : undefined,
    creatorEnabled: formData.get("creatorEnabled") ? true : false,
    creatorName: formData.get("creatorName")
      ? String(formData.get("creatorName"))
      : undefined,
    creatorHandle: formData.get("creatorHandle")
      ? String(formData.get("creatorHandle"))
      : undefined,
    creatorRole: formData.get("creatorRole")
      ? String(formData.get("creatorRole"))
      : undefined,
    paletteBackground: formData.get("paletteBackground")
      ? String(formData.get("paletteBackground"))
      : undefined,
    paletteText: formData.get("paletteText")
      ? String(formData.get("paletteText"))
      : undefined,
    paletteAccent: formData.get("paletteAccent")
      ? String(formData.get("paletteAccent"))
      : undefined,
    referenceSimilarity: formData.get("referenceSimilarity")
      ? Number(formData.get("referenceSimilarity"))
      : undefined
  });

  if (!parsed.success) {
    redirect(`/app/new?error=${encodeURIComponent("Invalid form")}`);
  }

  const values = parsed.data;
  const hasTopic = typeof values.topic === "string" && values.topic.trim().length > 0;
  const hasPrompt = typeof values.prompt === "string" && values.prompt.trim().length > 0;
  if (
    (values.inputMode === "topic" && !hasTopic) ||
    (values.inputMode === "prompt" && !hasPrompt)
  ) {
    redirect(
      `/app/new?error=${encodeURIComponent("Informe um tema ou prompt válido.")}`
    );
  }

  const draft: CarouselDraft = {
    inputMode: values.inputMode,
    topic: values.topic,
    prompt: values.prompt,
    slidesCount: values.slidesCount,
    platform: values.platform,
    tone: values.tone,
    targetAudience: values.targetAudience,
    language: values.language,
    presetId: values.presetId,
    templateId: values.templateId,
    creatorInfo: {
      enabled: Boolean(values.creatorEnabled),
      name: values.creatorName,
      handle: values.creatorHandle,
      role: values.creatorRole
    },
    palette: {
      background: values.paletteBackground,
      text: values.paletteText,
      accent: values.paletteAccent
    },
    referenceSimilarity: values.referenceSimilarity
  };

  const { data: created, error } = await supabase
    .from("carousels")
    .insert({
      workspace_id: membership.workspace_id,
      owner_id: userData.user.id,
      title: values.topic || "Untitled carousel",
      draft
    })
    .select("id")
    .single();

  if (error || !created) {
    redirect(
      `/app/new?error=${encodeURIComponent(error?.message ?? "Failed to create")}`
    );
  }

  const styleFiles = styleFilesRaw.slice(0, 10);
  const contentFiles = contentFilesRaw.slice(0, 10);

  try {
    if (styleFiles.length > 0) {
      await uploadReferenceFiles({
        supabase,
        carouselId: created.id,
        workspaceId: membership.workspace_id,
        ownerId: userData.user.id,
        files: styleFiles,
        kind: "style"
      });
    }
    if (contentFiles.length > 0) {
      await uploadReferenceFiles({
        supabase,
        carouselId: created.id,
        workspaceId: membership.workspace_id,
        ownerId: userData.user.id,
        files: contentFiles,
        kind: "content"
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao enviar referências.";
    redirect(`/app/new?error=${encodeURIComponent(message)}`);
  }

  const generated = await generateFirstDraftForCarousel({ carouselId: created.id });
  if (!generated.ok) {
    const message =
      generated.error === "GENERATION_RUNNING"
        ? "Geração já em andamento."
        : generated.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(generated.error ?? "Falha ao gerar.");
    redirect(`/app/studio/${created.id}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/app/carousels/${created.id}`);
}

export default async function NewCarouselPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;
  const defaultDraftLanguage = locale === "pt-BR" ? "Português (Brasil)" : "English";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t(locale, "newCarousel.title")}</h1>
        <p className="text-sm text-slate-600">
          {t(locale, "newCarousel.subtitle")}
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form action={createCarousel} className="space-y-4 rounded-md border p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "newCarousel.inputMode")}
            </span>
            <select
              className="w-full rounded-md border px-3 py-2"
              name="inputMode"
              defaultValue="topic"
            >
              <option value="topic">{t(locale, "newCarousel.inputModeTopic")}</option>
              <option value="prompt">{t(locale, "newCarousel.inputModePrompt")}</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "newCarousel.slides")}
            </span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="slidesCount"
              type="number"
              min={2}
              max={10}
              defaultValue={5}
              required
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">{t(locale, "newCarousel.topic")}</span>
          <input className="w-full rounded-md border px-3 py-2" name="topic" />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">{t(locale, "newCarousel.prompt")}</span>
          <textarea
            className="w-full rounded-md border px-3 py-2"
            name="prompt"
            rows={4}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium">{t(locale, "newCarousel.tone")}</span>
            <input className="w-full rounded-md border px-3 py-2" name="tone" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "newCarousel.audience")}
            </span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="targetAudience"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "newCarousel.language")}
            </span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="language"
              defaultValue={defaultDraftLanguage}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "newCarousel.templateId")}
            </span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="templateId"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "newCarousel.presetId")}
            </span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="presetId"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="creatorEnabled" />
            <span className="text-sm font-medium">
              {t(locale, "newCarousel.creatorInfo")}
            </span>
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t(locale, "newCarousel.creatorName")}
              </span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="creatorName"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t(locale, "newCarousel.creatorHandle")}
              </span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="creatorHandle"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t(locale, "newCarousel.creatorRole")}
              </span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="creatorRole"
              />
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="text-sm font-medium">{t(locale, "newCarousel.palette")}</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t(locale, "newCarousel.paletteBackground")}
              </span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="paletteBackground"
                placeholder="#ffffff"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t(locale, "newCarousel.paletteText")}
              </span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="paletteText"
                placeholder="#111827"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t(locale, "newCarousel.paletteAccent")}
              </span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="paletteAccent"
                placeholder="#a78bfa"
              />
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="text-sm font-medium">
            {t(locale, "newCarousel.referencesTitle")}
          </div>
          <p className="text-xs text-slate-600">
            {t(locale, "newCarousel.referenceHint")}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t(locale, "newCarousel.styleReferences")}
              </span>
              <input
                className="w-full"
                type="file"
                name="styleReferences"
                accept="image/*"
                multiple
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t(locale, "newCarousel.contentReferences")}
              </span>
              <input
                className="w-full"
                type="file"
                name="contentReferences"
                accept="image/*"
                multiple
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium">
              {t(locale, "newCarousel.similarity")}
            </span>
            <div className="flex items-center gap-3">
              <input
                className="w-full"
                type="range"
                name="referenceSimilarity"
                min={0}
                max={100}
                defaultValue={70}
              />
            </div>
            <p className="text-xs text-slate-600">
              {t(locale, "newCarousel.similarityHint")}
            </p>
          </label>
        </div>

        <button
          className="w-full rounded-md bg-black px-3 py-2 text-white"
          type="submit"
        >
          {t(locale, "newCarousel.create")}
        </button>
      </form>
    </div>
  );
}
