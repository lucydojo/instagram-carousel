import "server-only";

import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CarouselEditorState } from "@/lib/db/types";
import { geminiGenerateJson } from "@/lib/ai/gemini";
import {
  geminiNanoBananaGenerateImage,
  type GeminiImageModel,
  GEMINI_IMAGE_MODELS,
  isSupportedGeminiImageModel
} from "@/lib/ai/gemini_image";
import {
  plannerOutputSchema,
  type PlannerOutput
} from "@/lib/studio/planner_contract";
import {
  BUILTIN_TEMPLATES,
  extractTemplateLayout,
  extractTemplatePrompt,
  extractTemplateVisual,
  isTemplateDataV1,
  isTemplateVisualV1,
  type Rect01,
  type TemplateDataV1
} from "@/lib/studio/templates";

type ReferenceImageInput = { mimeType: string; data: string; name: string; kind: "style" | "content" };

const generationDebugEnabled = () =>
  process.env.GENERATION_DEBUG === "1" || process.env.NODE_ENV === "development";

const truncateText = (value: string, max = 220) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

function normalizeImageMimeType(mimeType: string | null, filename: string | null) {
  const raw = typeof mimeType === "string" ? mimeType.trim().toLowerCase() : "";
  if (raw.startsWith("image/") && raw !== "image/heic") return raw;
  if (raw && raw !== "application/octet-stream") return null;
  const name = typeof filename === "string" ? filename.toLowerCase() : "";
  const ext = name.split(".").pop() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

const summarizePlan = (plan: PlannerOutput) => ({
  version: plan.version,
  globalStyle: {
    palette: plan.globalStyle.palette,
    typography: plan.globalStyle.typography,
    spacing: plan.globalStyle.spacing,
    templateId: plan.globalStyle.templateId,
    backgroundOverlay: plan.globalStyle.backgroundOverlay ?? null
  },
  slides: plan.slides.map((slide) => ({
    index: slide.index,
    text: {
      tagline: slide.text.tagline ? truncateText(slide.text.tagline, 80) : null,
      title: truncateText(slide.text.title, 120),
      body: slide.text.body ? truncateText(slide.text.body, 160) : null,
      cta: slide.text.cta ? truncateText(slide.text.cta, 80) : null
    },
    images: (slide.images ?? []).map((img) => ({
      slotId: img.slotId ?? null,
      purpose: img.purpose,
      aspect: img.aspect ?? null,
      containsText: img.containsText,
      prompt: truncateText(img.prompt, 200)
    }))
  }))
});

function rectToPx(rect: Rect01, width: number, height: number) {
  return {
    x: Math.round(rect.x * width),
    y: Math.round(rect.y * height),
    w: Math.round(rect.w * width),
    h: Math.round(rect.h * height)
  };
}

function describeZone(zone: Rect01) {
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const horiz = cx < 0.33 ? "esquerda" : cx > 0.66 ? "direita" : "centro";
  const vert = cy < 0.33 ? "superior" : cy > 0.66 ? "inferior" : "central";
  return `${vert} ${horiz}`.trim();
}

function resolvePaletteFromDraft(draft: Record<string, unknown>) {
  const palette =
    draft.palette && typeof draft.palette === "object"
      ? (draft.palette as Record<string, unknown>)
      : null;
  const background = palette && typeof palette.background === "string" ? palette.background : null;
  const text = palette && typeof palette.text === "string" ? palette.text : null;
  const accent = palette && typeof palette.accent === "string" ? palette.accent : null;
  if (!background || !text || !accent) return null;
  return { background, text, accent };
}

function resolvePaletteFromVisual(visual: CarouselEditorState | null) {
  if (!visual || typeof visual !== "object") return null;
  const global =
    visual.global && typeof visual.global === "object"
      ? (visual.global as Record<string, unknown>)
      : null;
  const palette =
    global && typeof global.paletteData === "object"
      ? (global.paletteData as Record<string, unknown>)
      : null;
  const background =
    palette && typeof palette.background === "string" ? palette.background : null;
  const text = palette && typeof palette.text === "string" ? palette.text : null;
  const accent = palette && typeof palette.accent === "string" ? palette.accent : null;
  if (!background || !text || !accent) return null;
  return { background, text, accent };
}

async function loadReferenceImages(input: {
  carouselId: string;
  workspaceId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const { data: assets, error } = await input.supabase
    .from("carousel_assets")
    .select("storage_bucket, storage_path, mime_type, metadata, created_at")
    .eq("carousel_id", input.carouselId)
    .eq("asset_type", "reference")
    .order("created_at", { ascending: true });

  if (error || !assets) {
    return { style: [] as ReferenceImageInput[], content: [] as ReferenceImageInput[] };
  }

  const admin = createSupabaseAdminClientIfAvailable();
  const storageClient = admin ?? input.supabase;

  const style: ReferenceImageInput[] = [];
  const content: ReferenceImageInput[] = [];

  for (const asset of assets) {
    const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
    const referenceKind =
      typeof metadata.reference_kind === "string"
        ? metadata.reference_kind
        : "";
    if (referenceKind !== "style" && referenceKind !== "content") {
      continue;
    }
    const kind = referenceKind;

    if (kind === "style" && style.length >= 10) continue;
    if (kind === "content" && content.length >= 10) continue;

    const { data, error: downloadError } = await storageClient.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);

    if (downloadError || !data) continue;

    const arrayBuffer =
      data instanceof ArrayBuffer ? data : await data.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const name = asset.storage_path.split("/").slice(-1)[0] ?? "reference";
    const safeMimeType = normalizeImageMimeType(asset.mime_type, name);
    if (!safeMimeType) continue;

    const entry = {
      mimeType: safeMimeType,
      data: base64,
      name,
      kind
    };

    if (kind === "style") {
      style.push(entry);
    } else {
      content.push(entry);
    }
  }

  return { style, content };
}

type TemplateBundle = {
  layout: TemplateDataV1;
  prompt: string | null;
  visual: CarouselEditorState | null;
};

async function resolveTemplateBundle(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  templateId?: string | null;
}): Promise<TemplateBundle> {
  const fallback = BUILTIN_TEMPLATES[0]!;
  const empty = { layout: fallback, prompt: null, visual: null };
  const templateId = typeof input.templateId === "string" ? input.templateId.trim() : "";
  if (!templateId) return empty;

  const builtin = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
  if (builtin) return { layout: builtin, prompt: null, visual: null };

  const { data, error } = await input.supabase
    .from("carousel_templates")
    .select("template_data")
    .eq("id", templateId)
    .maybeSingle();
  if (error || !data) return empty;
  const templateData = data.template_data;
  if (isTemplateDataV1(templateData)) {
    return { layout: templateData, prompt: null, visual: null };
  }
  if (isTemplateVisualV1(templateData)) {
    return {
      layout: extractTemplateLayout(templateData) ?? fallback,
      prompt: extractTemplatePrompt(templateData),
      visual: extractTemplateVisual(templateData)
    };
  }
  return empty;
}

function buildPlannerPrompt(input: {
  topicOrPrompt: string;
  slidesCount: number;
  inputMode: "topic" | "prompt";
  tone?: string;
  targetAudience?: string;
  language?: string;
  template: TemplateDataV1;
  templatePrompt?: string | null;
  palette?: { background: string; text: string; accent: string } | null;
  creator?: { enabled: boolean; name?: string; handle?: string; role?: string };
  styleReferences: ReferenceImageInput[];
  contentReferences: ReferenceImageInput[];
  similarity?: number;
}): { system: string; user: string } {
  const schemaGuide = [
    "Formato JSON obrigatório (PlannerOutputV1):",
    "{",
    "  \"version\": 1,",
    "  \"globalStyle\": {",
    "    \"palette\": {\"background\": \"#ffffff\", \"text\": \"#111111\", \"accent\": \"#ff5500\"},",
    "    \"backgroundOverlay\": {\"enabled\": true, \"opacity\": 0.35, \"color\": \"#000000\"},",
    "    \"typography\": {",
    "      \"titleFontFamily\": \"Inter\",",
    "      \"bodyFontFamily\": \"Inter\",",
    "      \"titleSize\": 64,",
    "      \"bodySize\": 32,",
    "      \"ctaSize\": 26,",
    "      \"alignment\": \"left\"",
    "    },",
    "    \"spacing\": {\"padding\": 80},",
    "    \"templateId\": \"builtin/split-left-text-right-image\"",
    "  },",
    "  \"slides\": [",
    "    {",
    "      \"index\": 1,",
    "      \"text\": {",
    "        \"tagline\": \"string opcional\",",
    "        \"title\": \"string obrigatória\",",
    "        \"body\": \"string opcional\",",
    "        \"cta\": \"string opcional\"",
    "      },",
    "      \"images\": [",
    "        {",
    "          \"slotId\": \"hero\",",
    "          \"purpose\": \"slot\",",
    "          \"prompt\": \"descrição da imagem\",",
    "          \"containsText\": false,",
    "          \"aspect\": \"4:5\",",
    "          \"safeZones\": [{\"x\":0.84,\"y\":0.9,\"w\":0.12,\"h\":0.06}],",
    "          \"styleHints\": [\"minimalista\"],",
    "          \"avoid\": [\"texto na imagem\"]",
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "",
    "Regras: ",
    "- Sempre inclua version=1, globalStyle e slides.",
    "- Nunca use chaves antigas como \"elements\", \"zoneId\" ou \"content\".",
    "- Use apenas chaves do formato acima.",
    "- Responda SOMENTE com JSON válido (sem Markdown, sem texto extra)."
  ].join("\n");

  const system = [
    "Você é o Planner de um gerador de carrosséis.",
    "Responda SOMENTE com JSON válido no formato PlannerOutputV1.",
    "Respeite template, zonas e safe-areas.",
    "Mantenha consistência visual entre slides.",
    "Planeje legibilidade: evite textos sobre áreas muito escuras ou muito detalhadas.",
    "Quando o template usar imagem de fundo, prefira composições com áreas de respiro nas zonas de texto.",
    "Se necessário, defina backgroundOverlay para melhorar contraste.",
    "Não peça para desenhar caixas, blur, faixas, guias ou coordenadas na imagem.",
    "Nunca inclua coordenadas numéricas ou rótulos técnicos dentro do campo prompt.",
    "Referências visuais (imagens) serão anexadas após o texto.",
    "Use as referências de estilo conforme o nível de similaridade pedido.",
    "Não copie conteúdo literal de referências.",
    input.templatePrompt
      ? "Siga as instruções em `templateInstructions` para preencher textos e imagens."
      : null,
    schemaGuide
  ]
    .filter(Boolean)
    .join("\n");

  const similarity = Number.isFinite(input.similarity)
    ? Math.max(0, Math.min(100, Math.round(input.similarity ?? 70)))
    : 70;
  const referenceOrder = [
    ...input.styleReferences.map((ref, index) => ({
      kind: "style",
      name: ref.name,
      index: index + 1
    })),
    ...input.contentReferences.map((ref, index) => ({
      kind: "content",
      name: ref.name,
      index: input.styleReferences.length + index + 1
    }))
  ];

  const payload = {
    project: {
      platform: "instagram",
      language: input.language ?? "pt-BR",
      slidesCount: input.slidesCount,
      inputMode: input.inputMode,
      topic: input.inputMode === "topic" ? input.topicOrPrompt : undefined,
      prompt: input.inputMode === "prompt" ? input.topicOrPrompt : undefined,
      tone: input.tone,
      audience: input.targetAudience,
      creator: input.creator ?? { enabled: true }
    },
    layout: {
      templateId: input.template.id,
      templateData: input.template,
      spacing: { padding: input.template.defaults.spacing.padding }
    },
    templateInstructions: input.templatePrompt ?? null,
    style: {
      palette: input.palette ?? null,
      overlay: input.template.defaults.background.overlay ?? null,
      typography: {
        titleFontFamily: input.template.defaults.typography.fontFamily,
        bodyFontFamily: input.template.defaults.typography.fontFamily,
        titleSize: input.template.defaults.typography.titleSize,
        bodySize: input.template.defaults.typography.bodySize,
        ctaSize: input.template.defaults.typography.ctaSize ?? 26
      }
    },
    references: {
      styleSimilarity: similarity,
      styleImages: input.styleReferences.map((ref) => ref.name),
      contentImages: input.contentReferences.map((ref) => ref.name),
      order: referenceOrder
    },
    memory: {
      summary: "",
      lastTurns: []
    },
    constraints: {
      allowedFonts: ["Inter", "Poppins", "Lora", "Merriweather", "Montserrat", "Manrope"],
      templates: Array.from(
        new Set([...BUILTIN_TEMPLATES.map((t) => t.id), input.template.id])
      ),
      imageModels: {
        default: GEMINI_IMAGE_MODELS.NANO_BANANA,
        withText: GEMINI_IMAGE_MODELS.NANO_BANANA_PRO
      }
    }
  };

  return { system, user: JSON.stringify(payload, null, 2) };
}

function buildAestheticReviewPrompt(input: {
  plan: PlannerOutput;
  template: TemplateDataV1;
  topicOrPrompt: string;
  tone?: string;
  targetAudience?: string;
  language?: string;
}): { system: string; user: string } {
  const system = [
    "Você é um diretor de arte revisando um plano de carrossel.",
    "Objetivo: garantir legibilidade e estética moderna, sem mudar o conteúdo principal.",
    "Ajuste somente o necessário: paleta, overlay, prompts de imagem e cortes de texto (body/cta).",
    "Evite colocar texto sobre áreas escuras ou muito detalhadas.",
    "Quando usar imagem de fundo, instrua áreas de respiro nas zonas de texto.",
    "Se for preciso, remova body/cta em alguns slides para melhorar a composição.",
    "Não inclua coordenadas, caixas, blur, faixas, guias ou rótulos nas imagens.",
    "Não escreva coordenadas numéricas ou rótulos técnicos nos prompts.",
    "Responda SOMENTE com JSON válido no formato PlannerOutputV1."
  ].join("\n");

  const user = {
    context: {
      topicOrPrompt: input.topicOrPrompt,
      tone: input.tone ?? null,
      audience: input.targetAudience ?? null,
      language: input.language ?? "pt-BR"
    },
    template: input.template,
    plan: input.plan
  };

  return { system, user: JSON.stringify(user, null, 2) };
}

function toEditorStateFromPlan(input: {
  plan: PlannerOutput;
  template: TemplateDataV1;
}): CarouselEditorState {
  const { plan, template } = input;
  const slideW = template.slide.width;
  const slideH = template.slide.height;
  const palette = plan.globalStyle.palette;
  const typography = plan.globalStyle.typography;

  const lineHeightTight = template.defaults.typography.lineHeightTight ?? 1.1;
  const lineHeightNormal = template.defaults.typography.lineHeightNormal ?? 1.25;

  const alignment = typography.alignment ?? "left";
  const taglineSize =
    template.defaults.typography.taglineSize ??
    Math.max(16, Math.round(typography.bodySize * 0.6));
  const ctaSize =
    template.defaults.typography.ctaSize ?? Math.max(16, Math.round(typography.bodySize * 0.8));

  const zoneMap: Record<string, Rect01 | undefined> = {
    tagline: template.zones.tagline,
    title: template.zones.title,
    body: template.zones.body,
    cta: template.zones.cta
  };

  const overlaySource =
    plan.globalStyle.backgroundOverlay ?? template.defaults.background.overlay;
  const overlay = overlaySource
    ? {
        enabled: Boolean(overlaySource.enabled),
        opacity: overlaySource.opacity ?? 0.35,
        color: overlaySource.color ?? "#000000",
        mode: overlaySource.mode === "bottom-gradient" ? "bottom-gradient" : "solid",
        height: overlaySource.height ?? 0.6
      }
    : {
        enabled: false,
        opacity: 0.35,
        color: "#000000",
        mode: "solid",
        height: 0.6
      };

  const slides = plan.slides.map((s) => {
    const objects: Array<Record<string, unknown>> = [];
    const addText = (key: "tagline" | "title" | "body" | "cta", text?: string) => {
      const zone = zoneMap[key];
      if (!zone || !text) return;
      const rect = rectToPx(zone, slideW, slideH);
      const isTitle = key === "title";
      const isCta = key === "cta";
      const isTagline = key === "tagline";
      objects.push({
        id: key,
        type: "text",
        variant: key,
        text,
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        fontFamily: isTitle ? typography.titleFontFamily : typography.bodyFontFamily,
        fontSize: isTitle ? typography.titleSize : isCta ? ctaSize : isTagline ? taglineSize : typography.bodySize,
        fontWeight: isTitle ? 700 : isCta ? 600 : 600,
        fill: isTitle || isCta ? palette.accent : palette.text,
        textAlign: alignment,
        fontStyle: "normal",
        lineHeight: isTitle ? lineHeightTight : lineHeightNormal,
        underline: false,
        linethrough: false,
        letterSpacing: 0
      });
    };

    addText("tagline", s.text.tagline);
    addText("title", s.text.title);
    addText("body", s.text.body);
    addText("cta", s.text.cta);

    for (const img of template.images) {
      const rect = rectToPx(img.bounds, slideW, slideH);
      objects.push({
        id: `image_${img.id}`,
        type: "image",
        slotId: img.id,
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        assetId: null
      });
    }

    return {
      id: `slide_${s.index}`,
      width: slideW,
      height: slideH,
      background: {
        color: palette.background,
        overlay
      },
      objects
    };
  });

  return {
    version: 1,
    global: {
      templateId: template.id,
      templateData: template,
      paletteData: palette,
      typography: {
        titleFontFamily: typography.titleFontFamily,
        bodyFontFamily: typography.bodyFontFamily,
        titleSize: typography.titleSize,
        bodySize: typography.bodySize,
        taglineSize,
        ctaSize
      },
      background: { overlay }
    },
    slides
  };
}

function applyPlanToVisualTemplate(input: {
  plan: PlannerOutput;
  template: TemplateDataV1;
  visual: CarouselEditorState;
}): CarouselEditorState {
  const fallbackState = toEditorStateFromPlan({ plan: input.plan, template: input.template });
  const base = JSON.parse(JSON.stringify(input.visual)) as CarouselEditorState;
  const baseSlides = Array.isArray(base.slides) ? base.slides : [];
  const fallbackSlides = Array.isArray(fallbackState.slides) ? fallbackState.slides : [];
  const planSlides = input.plan.slides ?? [];

  const templateSlotIds = new Set(input.template.images.map((img) => img.id));

  const nextSlides = fallbackSlides.map((fallbackSlide, index) => {
    const baseSlide =
      index < baseSlides.length && baseSlides[index] && typeof baseSlides[index] === "object"
        ? (baseSlides[index] as Record<string, unknown>)
        : null;
    const fallback = fallbackSlide as Record<string, unknown>;
    const slide = baseSlide ? { ...fallback, ...baseSlide } : { ...fallback };

    const baseObjects = Array.isArray((slide as Record<string, unknown>).objects)
      ? ([...(slide as Record<string, unknown>).objects as Record<string, unknown>[]] as Record<
          string,
          unknown
        >[])
      : [];
    const fallbackObjects = Array.isArray(fallback.objects)
      ? ([...(fallback.objects as Record<string, unknown>[])] as Record<string, unknown>[])
      : [];
    const objects = baseObjects.length > 0 ? baseObjects : fallbackObjects;

    const planSlide =
      planSlides.find((s) => s.index === index + 1) ?? planSlides[index] ?? null;

    const textMap = planSlide
      ? {
          tagline: planSlide.text.tagline ?? null,
          title: planSlide.text.title ?? null,
          body: planSlide.text.body ?? null,
          cta: planSlide.text.cta ?? null
        }
      : null;

    const planSlotIds = new Set(
      (planSlide?.images ?? [])
        .map((img) => (typeof img.slotId === "string" ? img.slotId : null))
        .filter((slotId): slotId is string => Boolean(slotId))
    );

    const nextObjects = objects.map((obj) => {
      if (!obj || typeof obj !== "object") return obj;
      if (obj.type === "text") {
        const variant =
          typeof obj.variant === "string"
            ? obj.variant
            : typeof obj.id === "string"
              ? obj.id
              : null;
        if (!variant || !textMap || !(variant in textMap)) return obj;
        const nextText = textMap[variant as keyof typeof textMap];
        if (typeof nextText === "string" && nextText.trim().length > 0) {
          return { ...obj, text: nextText, hidden: false };
        }
        return { ...obj, text: "", hidden: true };
      }
      if (obj.type === "image") {
        const rawId = typeof obj.id === "string" ? obj.id : null;
        const rawSlotId = typeof obj.slotId === "string" ? obj.slotId : null;
        const derivedSlot =
          rawSlotId ??
          (rawId && rawId.startsWith("image_") ? rawId.slice("image_".length) : rawId);
        if (!derivedSlot || !templateSlotIds.has(derivedSlot)) return obj;
        const shouldReset = planSlotIds.has(derivedSlot) || templateSlotIds.has(derivedSlot);
        return {
          ...obj,
          slotId: derivedSlot,
          assetId: shouldReset ? null : (obj as { assetId?: unknown }).assetId
        };
      }
      return obj;
    });

    if (templateSlotIds.size > 0) {
      const existingSlots = new Set(
        nextObjects
          .filter((obj) => obj.type === "image" && typeof obj.slotId === "string")
          .map((obj) => obj.slotId as string)
      );
      for (const fallbackObj of fallbackObjects) {
        if (fallbackObj.type !== "image") continue;
        const slotId = typeof fallbackObj.slotId === "string" ? fallbackObj.slotId : null;
        if (!slotId || !templateSlotIds.has(slotId) || existingSlots.has(slotId)) continue;
        nextObjects.push({ ...fallbackObj, assetId: null });
        existingSlots.add(slotId);
      }
    }

    return { ...slide, objects: nextObjects };
  });

  const nextGlobal = {
    ...(base.global && typeof base.global === "object" ? base.global : {}),
    templateId: input.template.id,
    templateData: input.template
  } as Record<string, unknown>;

  return {
    ...base,
    version: base.version ?? 1,
    global: nextGlobal,
    slides: nextSlides
  };
}

async function uploadBytesToStorage(input: {
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const admin = createSupabaseAdminClientIfAvailable();
  const supabase = admin ?? (await createSupabaseServerClient());

  const body = Buffer.from(input.bytes);
  const { error } = await supabase.storage
    .from(input.bucket)
    .upload(input.path, body, { upsert: false, contentType: input.contentType });

  return { error };
}

export async function generateFirstDraftForCarousel(input: {
  carouselId: string;
  imageModel?: GeminiImageModel;
}) {
  const carouselId = input.carouselId;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data: carousel } = await supabase
    .from("carousels")
    .select("*")
    .eq("id", carouselId)
    .maybeSingle();

  if (!carousel) return { ok: false as const, error: "NOT_FOUND" };
  if (carousel.owner_id !== userData.user.id)
    return { ok: false as const, error: "FORBIDDEN" };
  if (carousel.generation_status === "running") {
    return { ok: false as const, error: "GENERATION_RUNNING" };
  }

  const draft = carousel.draft as Record<string, unknown>;
  const slidesCount = Number(draft.slidesCount ?? 5);
  const topicOrPrompt =
    (draft.inputMode === "prompt" ? draft.prompt : draft.topic) ??
    draft.prompt ??
    draft.topic;

  if (!topicOrPrompt || typeof topicOrPrompt !== "string") {
    return { ok: false as const, error: "Sem tema/prompt para gerar." };
  }

  const imageModel = isSupportedGeminiImageModel(input.imageModel)
    ? input.imageModel
    : GEMINI_IMAGE_MODELS.NANO_BANANA;

  const inputMode =
    draft.inputMode === "prompt" || draft.inputMode === "topic"
      ? draft.inputMode
      : draft.prompt
        ? "prompt"
        : "topic";

  const templateBundle = await resolveTemplateBundle({
    supabase,
    templateId:
      typeof draft.templateId === "string"
        ? draft.templateId
        : typeof draft.template_id === "string"
          ? draft.template_id
          : undefined
  });

  const template = templateBundle.layout;
  const visualTemplate = templateBundle.visual;
  const templatePrompt = templateBundle.prompt;

  const palette = resolvePaletteFromDraft(draft) ?? resolvePaletteFromVisual(visualTemplate);
  const referenceSimilarityRaw = Number(draft.referenceSimilarity ?? 70);
  const referenceSimilarity = Number.isFinite(referenceSimilarityRaw)
    ? Math.max(0, Math.min(100, Math.round(referenceSimilarityRaw)))
    : 70;

  const visualSlidesCount = Array.isArray(visualTemplate?.slides)
    ? visualTemplate?.slides?.length ?? 0
    : 0;
  const effectiveSlidesCount =
    visualSlidesCount > 0 ? visualSlidesCount : slidesCount;

  const { style: styleReferences, content: contentReferences } = await loadReferenceImages({
    carouselId: carousel.id,
    workspaceId: carousel.workspace_id,
    supabase
  });

  const progressMeta: Record<string, unknown> = {
    started_at: new Date().toISOString(),
    provider: "gemini",
    stage: "text",
    images: {
      model: imageModel,
      total: 0,
      done: 0,
      failed: 0,
      bySlide: [] as Array<Record<string, unknown>>
    }
  };

  await supabase
    .from("carousels")
    .update({
      generation_status: "running",
      generation_error: null,
      generation_meta: progressMeta
    })
    .eq("id", carouselId);

  const { system, user } = buildPlannerPrompt({
    topicOrPrompt,
    slidesCount: effectiveSlidesCount,
    inputMode,
    tone: typeof draft.tone === "string" ? draft.tone : undefined,
    targetAudience:
      typeof draft.targetAudience === "string" ? draft.targetAudience : undefined,
    language: typeof draft.language === "string" ? draft.language : undefined,
    template,
    templatePrompt,
    palette,
    creator:
      draft.creatorInfo && typeof draft.creatorInfo === "object"
        ? (draft.creatorInfo as {
            enabled: boolean;
            name?: string;
            handle?: string;
            role?: string;
          })
        : undefined,
    styleReferences,
    contentReferences,
    similarity: referenceSimilarity
  });

  if (generationDebugEnabled()) {
    console.log(
      `[generation] references style=${styleReferences.length} content=${contentReferences.length} similarity=${referenceSimilarity}`
    );
  }

  const referenceImages = [...styleReferences, ...contentReferences].map((ref) => ({
    mimeType: ref.mimeType,
    data: ref.data
  }));

  const gen = await geminiGenerateJson({
    system,
    user,
    schema: plannerOutputSchema,
    images: referenceImages
  });

  if (!gen.ok) {
    const prevMeta =
      typeof carousel.generation_meta === "object" && carousel.generation_meta
        ? (carousel.generation_meta as Record<string, unknown>)
        : {};
    await supabase
      .from("carousels")
      .update({
        generation_status: "failed",
        generation_error: gen.error,
        generation_meta: { ...prevMeta, stage: "failed_text", raw: gen.raw ?? null }
      })
      .eq("id", carouselId);
    return { ok: false as const, error: gen.error };
  }

  let plan = gen.data;
  if (generationDebugEnabled()) {
    progressMeta.debug = {
      ...(typeof progressMeta.debug === "object" && progressMeta.debug
        ? (progressMeta.debug as Record<string, unknown>)
        : {}),
      planner: summarizePlan(plan),
      references: {
        style: styleReferences.length,
        content: contentReferences.length,
        similarity: referenceSimilarity
      }
    };
    await supabase
      .from("carousels")
      .update({ generation_meta: progressMeta })
      .eq("id", carouselId);
    console.log("[generation] planner output", summarizePlan(plan));
  }

  const maxPassesRaw = Number(process.env.AESTHETIC_MAX_PASSES ?? 1);
  const maxPasses = Number.isFinite(maxPassesRaw)
    ? Math.max(0, Math.min(2, Math.floor(maxPassesRaw)))
    : 1;

  if (maxPasses > 0) {
    progressMeta.stage = "aesthetic_review";
    await supabase
      .from("carousels")
      .update({ generation_meta: progressMeta })
      .eq("id", carouselId);

    const { system: reviewSystem, user: reviewUser } = buildAestheticReviewPrompt({
      plan,
      template,
      topicOrPrompt,
      tone: typeof draft.tone === "string" ? draft.tone : undefined,
      targetAudience:
        typeof draft.targetAudience === "string" ? draft.targetAudience : undefined,
      language: typeof draft.language === "string" ? draft.language : undefined
    });

    const review = await geminiGenerateJson({
      system: reviewSystem,
      user: reviewUser,
      schema: plannerOutputSchema
    });

    if (review.ok) {
      plan = review.data;
      if (generationDebugEnabled()) {
        progressMeta.debug = {
          ...(typeof progressMeta.debug === "object" && progressMeta.debug
            ? (progressMeta.debug as Record<string, unknown>)
            : {}),
          review: summarizePlan(plan)
        };
        await supabase
          .from("carousels")
          .update({ generation_meta: progressMeta })
          .eq("id", carouselId);
        console.log("[generation] aesthetic review plan", summarizePlan(plan));
      }
    } else {
      const prevMeta =
        typeof carousel.generation_meta === "object" && carousel.generation_meta
          ? (carousel.generation_meta as Record<string, unknown>)
          : {};
      await supabase
        .from("carousels")
        .update({
          generation_meta: { ...prevMeta, stage: "aesthetic_review_failed", raw: review.raw ?? null }
        })
        .eq("id", carouselId);
    }
  }
  const totalImages = plan.slides.reduce(
    (sum, slide) => sum + (slide.images?.length ?? 0),
    0
  );

  (progressMeta.images as Record<string, unknown>).total = totalImages;
  progressMeta.stage = "images";
  progressMeta.title = plan.slides[0]?.text.title ?? topicOrPrompt;
  await supabase
    .from("carousels")
    .update({ generation_meta: progressMeta })
    .eq("id", carouselId);

  const editorState = visualTemplate
    ? applyPlanToVisualTemplate({ plan, template, visual: visualTemplate })
    : toEditorStateFromPlan({ plan, template });

  const generatedAssets: Array<{ slideIndex: number; path: string }> = [];

  const templateImageMap = new Map(template.images.map((img) => [img.id, img]));

  const appendImagePrompt = (base: string, extra: string[]) => {
    const text = [base, ...extra.filter(Boolean)].join("\n");
    return text.trim();
  };

  const resolveSlotRect = (slotId?: string) => {
    if (!slotId) return null;
    const slot = templateImageMap.get(slotId);
    if (!slot) return null;
    return rectToPx(slot.bounds, template.slide.width, template.slide.height);
  };

  const assignAssetId = (slideIndex: number, slotId: string | undefined, assetId: string) => {
    const slide = editorState.slides.find((s) => s.id === `slide_${slideIndex}`);
    if (!slide || !slotId) return;
    const imageObj = slide.objects.find(
      (obj) => obj.type === "image" && obj.slotId === slotId
    );
    if (imageObj) {
      imageObj.assetId = assetId;
    }
  };

  for (const slide of plan.slides) {
    const images = slide.images ?? [];
    for (const request of images) {
      const slotRect = resolveSlotRect(request.slotId);
      const safeZones =
        request.safeZones && request.safeZones.length > 0
          ? request.safeZones
          : request.slotId
            ? templateImageMap.get(request.slotId)?.safeZones ?? []
            : [];

      const extra: string[] = [];
      if (slotRect) {
        extra.push(
          `Formato do slot: ${slotRect.w}x${slotRect.h}px (proporção ${slotRect.w}:${slotRect.h}).`
        );
      } else if (request.aspect) {
        extra.push(`Proporção: ${request.aspect}.`);
      }

      if (safeZones.length > 0) {
        const zoneHints = Array.from(new Set(safeZones.map(describeZone)));
        extra.push(
          `Reserve áreas limpas para texto nas regiões: ${zoneHints.join(", ")}.`
        );
        extra.push(
          "Crie áreas de respiro (baixo contraste e poucos detalhes) nessas regiões."
        );
        extra.push(
          "Não desenhe caixas, blur, faixas, guias, coordenadas ou texto para indicar essas áreas."
        );
      }

      extra.push(`Paleta: ${plan.globalStyle.palette.background}, ${plan.globalStyle.palette.text}, ${plan.globalStyle.palette.accent}.`);
      extra.push(`Tom: ${typeof draft.tone === "string" ? draft.tone : "neutro"}.`);
      if (!request.containsText) {
        extra.push("Sem texto na imagem.");
      }

      const prompt = appendImagePrompt(request.prompt, extra);
      const debugPrompt = generationDebugEnabled() ? truncateText(prompt, 300) : undefined;
      if (debugPrompt) {
        console.log(
          `[generation] image prompt slide ${slide.index} slot ${request.slotId ?? "background"}: ${debugPrompt}`
        );
      }
      const model = request.containsText ? GEMINI_IMAGE_MODELS.NANO_BANANA_PRO : imageModel;
      const image = await geminiNanoBananaGenerateImage({ prompt, model });

      const imagesMeta = progressMeta.images as Record<string, unknown>;
      const bySlide = imagesMeta.bySlide as Array<Record<string, unknown>>;

      if (!image.ok) {
        imagesMeta.failed = Number(imagesMeta.failed ?? 0) + 1;
        bySlide.push({
          slideIndex: slide.index,
          slotId: request.slotId ?? null,
          status: "failed",
          ...(debugPrompt ? { prompt: debugPrompt } : {})
        });
        await supabase
          .from("carousels")
          .update({ generation_meta: progressMeta })
          .eq("id", carouselId);
        continue;
      }

      const ext = image.mimeType.includes("png")
        ? "png"
        : image.mimeType.includes("jpeg") || image.mimeType.includes("jpg")
          ? "jpg"
          : "png";

      const path = `workspaces/${carousel.workspace_id}/carousels/${carousel.id}/generated/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await uploadBytesToStorage({
        bucket: "carousel-assets",
        path,
        bytes: image.bytes,
        contentType: image.mimeType
      });

      if (uploadError) {
        imagesMeta.failed = Number(imagesMeta.failed ?? 0) + 1;
        bySlide.push({
          slideIndex: slide.index,
          slotId: request.slotId ?? null,
          status: "failed_upload",
          ...(debugPrompt ? { prompt: debugPrompt } : {})
        });
        await supabase
          .from("carousels")
          .update({ generation_meta: progressMeta })
          .eq("id", carouselId);
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("carousel_assets")
        .insert({
          workspace_id: carousel.workspace_id,
          carousel_id: carousel.id,
          owner_id: userData.user.id,
          asset_type: "generated",
          storage_bucket: "carousel-assets",
          storage_path: path,
          mime_type: image.mimeType,
          status: "ready",
          metadata: {
            provider: image.provider,
            model: image.model,
            slideIndex: slide.index,
            slotId: request.slotId ?? null,
            prompt: request.prompt ?? null,
            aspect: request.aspect ?? null
          }
        })
        .select("id")
        .maybeSingle();

      if (!insertError && inserted) {
        generatedAssets.push({ slideIndex: slide.index, path });
        imagesMeta.done = Number(imagesMeta.done ?? 0) + 1;
        bySlide.push({
          slideIndex: slide.index,
          slotId: request.slotId ?? null,
          status: "ready",
          path,
          ...(debugPrompt ? { prompt: debugPrompt } : {})
        });
        assignAssetId(slide.index, request.slotId, inserted.id);
        await supabase
          .from("carousels")
          .update({ generation_meta: progressMeta })
          .eq("id", carouselId);
      } else {
        imagesMeta.failed = Number(imagesMeta.failed ?? 0) + 1;
        bySlide.push({
          slideIndex: slide.index,
          slotId: request.slotId ?? null,
          status: "failed_db",
          ...(debugPrompt ? { prompt: debugPrompt } : {})
        });
        await supabase
          .from("carousels")
          .update({ generation_meta: progressMeta })
          .eq("id", carouselId);
      }
    }
  }

  progressMeta.stage = "done";
  progressMeta.finished_at = new Date().toISOString();

  await supabase
    .from("carousels")
    .update({
      title: plan.slides[0]?.text.title ?? carousel.title,
      editor_state: editorState,
      generation_status: "succeeded",
      generation_error: null,
      generation_meta: progressMeta
    })
    .eq("id", carouselId);

  return { ok: true as const, result: gen.data, assets: generatedAssets };
}
