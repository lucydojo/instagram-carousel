import { redirect } from "next/navigation";
import { z } from "zod";
import type { CarouselDraft } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";
import { generateFirstDraftForCarousel } from "@/lib/studio/generation";
import {
  BUILTIN_TEMPLATES,
  extractTemplatePrompt,
  isTemplateDataV1,
  isTemplateVisualV1
} from "@/lib/studio/template_shared";
import NewCarouselForm from "./NewCarouselForm";

const newCarouselSchema = z.object({
  inputMode: z.enum(["topic", "prompt"]),
  topic: z.string().optional(),
  prompt: z.string().optional(),
  slidesCount: z.coerce.number().int().min(2).max(10),
  platform: z.literal("instagram"),
  tone: z.string().optional(),
  tonePreset: z.string().optional(),
  toneCustom: z.string().optional(),
  targetAudience: z.string().optional(),
  audiencePreset: z.string().optional(),
  audienceCustom: z.string().optional(),
  language: z.string().optional(),
  templateId: z.string().optional(),
  presetId: z.string().optional(),
  paletteId: z.string().optional(),
  creatorEnabled: z.coerce.boolean().optional(),
  creatorName: z.string().optional(),
  creatorHandle: z.string().optional(),
  creatorRole: z.string().optional(),
  paletteBackground: z.string().optional(),
  paletteText: z.string().optional(),
  paletteAccent: z.string().optional(),
  referenceSimilarity: z.coerce.number().int().min(0).max(100).optional()
});

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const CUSTOM_PALETTE_ID = "__custom__";
const CUSTOM_INPUT_VALUE = "__custom__";

type PaletteV1 = { background: string; text: string; accent: string };

function parsePaletteV1(value: unknown): PaletteV1 | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const background = typeof v.background === "string" ? v.background : null;
  const text = typeof v.text === "string" ? v.text : null;
  const accent = typeof v.accent === "string" ? v.accent : null;
  if (!background || !text || !accent) return null;
  return { background, text, accent };
}

function resolveImageMimeType(file: File) {
  const raw = file.type?.trim().toLowerCase() ?? "";
  if (raw.startsWith("image/") && raw !== "image/heic") return raw;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

async function uploadAssetFiles(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  carouselId: string;
  workspaceId: string;
  ownerId: string;
  files: File[];
}) {
  const admin = createSupabaseAdminClientIfAvailable();
  const storageClient = admin ?? input.supabase;

  for (const file of input.files) {
    const mimeType = resolveImageMimeType(file);
    if (!mimeType) {
      throw new Error("Envie apenas imagens (png, jpg, webp ou gif).");
    }
    const ext = file.name.split(".").pop() || "bin";
    const path = `workspaces/${input.workspaceId}/carousels/${input.carouselId}/reference/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await storageClient.storage
      .from("carousel-assets")
      .upload(path, file, { upsert: false, contentType: mimeType });

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
        mime_type: mimeType,
        metadata: {
          reference_kind: "upload",
          source: "user_upload"
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

  const assetFilesRaw = formData
    .getAll("assetUploads")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const totalUploadBytes = [...assetFilesRaw].reduce(
    (sum, file) => sum + file.size,
    0
  );
  if (totalUploadBytes > MAX_UPLOAD_BYTES) {
    redirect(
      `/app/new?error=${encodeURIComponent(
        "Os uploads excedem 500MB. Reduza o tamanho das imagens."
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
    tonePreset: formData.get("tonePreset")
      ? String(formData.get("tonePreset"))
      : undefined,
    toneCustom: formData.get("toneCustom")
      ? String(formData.get("toneCustom"))
      : undefined,
    targetAudience: formData.get("targetAudience")
      ? String(formData.get("targetAudience"))
      : undefined,
    audiencePreset: formData.get("audiencePreset")
      ? String(formData.get("audiencePreset"))
      : undefined,
    audienceCustom: formData.get("audienceCustom")
      ? String(formData.get("audienceCustom"))
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
    paletteId: formData.get("paletteId")
      ? String(formData.get("paletteId"))
      : undefined,
    creatorEnabled: formData.get("creatorEnabled") ? true : undefined,
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
  let paletteBackground =
    values.paletteId === CUSTOM_PALETTE_ID ? values.paletteBackground : undefined;
  let paletteText =
    values.paletteId === CUSTOM_PALETTE_ID ? values.paletteText : undefined;
  let paletteAccent =
    values.paletteId === CUSTOM_PALETTE_ID ? values.paletteAccent : undefined;
  let templateSlidesCount: number | null = null;
  let templatePalette: PaletteV1 | null = null;
  let templatePrompt: string | null = null;

  if (values.templateId) {
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === values.templateId);
    if (!builtin) {
      const { data: templateRow } = await supabase
        .from("carousel_templates")
        .select("template_data")
        .eq("id", values.templateId)
        .maybeSingle();
      if (templateRow && isTemplateVisualV1(templateRow.template_data)) {
        templatePrompt = extractTemplatePrompt(templateRow.template_data);
        const data = templateRow.template_data as {
          visual?: { slides?: unknown[]; global?: Record<string, unknown> };
        };
        templateSlidesCount = Array.isArray(data.visual?.slides)
          ? data.visual?.slides?.length ?? null
          : null;
        templatePalette = parsePaletteV1(
          data.visual && typeof data.visual.global === "object"
            ? (data.visual.global as Record<string, unknown>).paletteData
            : null
        );
      }
    }
  }

  const toneCustom =
    typeof values.toneCustom === "string" ? values.toneCustom.trim() : "";
  const tonePresetRaw =
    typeof values.tonePreset === "string" ? values.tonePreset.trim() : "";
  const tonePreset =
    tonePresetRaw.length > 0 && tonePresetRaw !== CUSTOM_INPUT_VALUE
      ? tonePresetRaw
      : "";
  const tone = toneCustom.length > 0 ? toneCustom : tonePreset || values.tone;

  const audienceCustom =
    typeof values.audienceCustom === "string" ? values.audienceCustom.trim() : "";
  const audiencePresetRaw =
    typeof values.audiencePreset === "string" ? values.audiencePreset.trim() : "";
  const audiencePreset =
    audiencePresetRaw.length > 0 && audiencePresetRaw !== CUSTOM_INPUT_VALUE
      ? audiencePresetRaw
      : "";
  const targetAudience =
    audienceCustom.length > 0 ? audienceCustom : audiencePreset || values.targetAudience;

  if ((!values.paletteId || values.paletteId === "") && templatePalette) {
    paletteBackground = templatePalette.background;
    paletteText = templatePalette.text;
    paletteAccent = templatePalette.accent;
  }

  if (values.paletteId && values.paletteId !== CUSTOM_PALETTE_ID) {
    const { data: paletteRow } = await supabase
      .from("palettes")
      .select("palette_data")
      .eq("id", values.paletteId)
      .maybeSingle();
    const parsedPalette = parsePaletteV1(paletteRow?.palette_data);
    if (parsedPalette) {
      paletteBackground = parsedPalette.background;
      paletteText = parsedPalette.text;
      paletteAccent = parsedPalette.accent;
    }
  }

  const creatorEnabled =
    typeof values.creatorEnabled === "boolean" ? values.creatorEnabled : true;
  const slidesCount = templateSlidesCount ?? values.slidesCount;
  const topicValue =
    typeof values.topic === "string" ? values.topic.trim() : "";
  const promptValue =
    typeof values.prompt === "string" ? values.prompt.trim() : "";
  let resolvedPrompt = promptValue;

  if (values.inputMode === "prompt" && !resolvedPrompt && templatePrompt) {
    resolvedPrompt = templatePrompt;
  }

  if (values.inputMode === "prompt" && resolvedPrompt && topicValue) {
    const separator = resolvedPrompt.endsWith("\n") ? "\n" : "\n\n";
    resolvedPrompt = `${resolvedPrompt}${separator}Assunto: ${topicValue}`;
  }

  if (
    (values.inputMode === "topic" && topicValue.length === 0) ||
    (values.inputMode === "prompt" && resolvedPrompt.length === 0)
  ) {
    redirect(
      `/app/new?error=${encodeURIComponent("Informe um tema ou prompt válido.")}`
    );
  }

  const draft: CarouselDraft = {
    inputMode: values.inputMode,
    topic: values.topic,
    prompt: values.inputMode === "prompt" ? resolvedPrompt : values.prompt,
    slidesCount,
    platform: values.platform,
    tone,
    targetAudience,
    language: values.language,
    presetId: values.presetId,
    templateId: values.templateId,
    creatorInfo: {
      enabled: creatorEnabled,
      name: values.creatorName,
      handle: values.creatorHandle,
      role: values.creatorRole
    },
    palette: {
      background: paletteBackground,
      text: paletteText,
      accent: paletteAccent
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

  const assetFiles = assetFilesRaw.slice(0, 12);

  try {
    if (assetFiles.length > 0) {
      await uploadAssetFiles({
        supabase,
        carouselId: created.id,
        workspaceId: membership.workspace_id,
        ownerId: userData.user.id,
        files: assetFiles
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
  const supabase = await createSupabaseServerClient();

  const [
    tonesResult,
    audiencesResult,
    palettesResult,
    templatesResult,
    presetsResult
  ] = await Promise.all([
    supabase
      .from("tones")
      .select("id, name, is_global")
      .order("is_global", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("audiences")
      .select("id, name, is_global")
      .order("is_global", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("palettes")
      .select("id, name, is_global, palette_data")
      .order("is_global", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("carousel_templates")
      .select("id, name, is_global, template_data")
      .order("is_global", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("user_presets")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false })
  ]);

  const tones = tonesResult.data ?? [];
  const audiences = audiencesResult.data ?? [];
  const palettesRaw = palettesResult.data ?? [];
  const templatesRaw = templatesResult.data ?? [];
  const presets = presetsResult.data ?? [];

  const paletteOptions = palettesRaw
    .map((p) => {
      const palette = parsePaletteV1(p.palette_data);
      if (!palette) return null;
      return { ...p, palette };
    })
    .filter(
      (value): value is (typeof palettesRaw)[number] & { palette: PaletteV1 } =>
        Boolean(value)
    );

  const visualTemplateMeta = templatesRaw
    .filter((t) => isTemplateVisualV1(t.template_data))
    .map((t) => {
      const data = t.template_data as {
        visual?: { slides?: unknown[]; global?: Record<string, unknown> };
      };
      const slidesCount = Array.isArray(data.visual?.slides)
        ? data.visual?.slides?.length ?? null
        : null;
      const palette = parsePaletteV1(
        data.visual && typeof data.visual.global === "object"
          ? (data.visual.global as Record<string, unknown>).paletteData
          : null
      );
      const prompt = extractTemplatePrompt(t.template_data);
      return {
        id: t.id,
        name: t.name,
        kind: "visual" as const,
        slidesCount,
        palette,
        prompt
      };
    });

  const layoutTemplateMeta = templatesRaw
    .filter((t) => isTemplateDataV1(t.template_data))
    .map((t) => ({
      id: t.id,
      name: t.name,
      kind: "layout" as const,
      slidesCount: null,
      palette: null
    }));

  const builtinTemplateMeta = BUILTIN_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    kind: "builtin" as const,
    slidesCount: null,
    palette: null
  }));

  const labels = {
    title: t(locale, "newCarousel.title"),
    subtitle: t(locale, "newCarousel.subtitle"),
    inputMode: t(locale, "newCarousel.inputMode"),
    inputModeTopic: t(locale, "newCarousel.inputModeTopic"),
    inputModePrompt: t(locale, "newCarousel.inputModePrompt"),
    slides: t(locale, "newCarousel.slides"),
    topic: t(locale, "newCarousel.topic"),
    prompt: t(locale, "newCarousel.prompt"),
    tone: t(locale, "newCarousel.tone"),
    audience: t(locale, "newCarousel.audience"),
    language: t(locale, "newCarousel.language"),
    templateId: t(locale, "newCarousel.templateId"),
    presetId: t(locale, "newCarousel.presetId"),
    palette: t(locale, "newCarousel.palette"),
    paletteBackground: t(locale, "newCarousel.paletteBackground"),
    paletteText: t(locale, "newCarousel.paletteText"),
    paletteAccent: t(locale, "newCarousel.paletteAccent"),
    create: t(locale, "newCarousel.create")
  };

  return (
    <NewCarouselForm
      action={createCarousel}
      error={error}
      defaultDraftLanguage={defaultDraftLanguage}
      tones={tones}
      audiences={audiences}
      templates={[...visualTemplateMeta, ...layoutTemplateMeta, ...builtinTemplateMeta]}
      presets={presets}
      palettes={paletteOptions}
      labels={labels}
    />
  );
}
