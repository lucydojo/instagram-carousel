import "server-only";

import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CarouselEditorState } from "@/lib/db/types";
import { geminiGenerateJson } from "@/lib/ai/gemini";
import { geminiNanoBananaGenerateImage } from "@/lib/ai/gemini_image";
import {
  generationResultSchema,
  type GenerationResult
} from "@/lib/studio/generation_contract";

function buildPrompt(input: {
  topicOrPrompt: string;
  slidesCount: number;
  tone?: string;
  targetAudience?: string;
  language?: string;
}): { system: string; user: string } {
  const system = [
    "Você é um redator especialista em carrosséis para Instagram.",
    "Gere um carrossel completo e objetivo.",
    "Responda SOMENTE com JSON válido no formato esperado.",
    "Regras:",
    "- slides deve ter exatamente o número pedido",
    "- slide.index começa em 1 e é sequencial",
    "- title deve ser curto e forte",
    "- body pode ser vazio em slides curtos",
    "- imagePrompt deve ser útil para gerar uma imagem (sem texto dentro da imagem)"
  ].join("\n");

  const user = [
    `Tema/Pedido: ${input.topicOrPrompt}`,
    `Slides: ${input.slidesCount}`,
    input.tone ? `Tom: ${input.tone}` : "",
    input.targetAudience ? `Público: ${input.targetAudience}` : "",
    input.language ? `Idioma: ${input.language}` : "Idioma: pt-BR",
    "",
    "Formato JSON esperado:",
    JSON.stringify(
      {
        title: "string",
        caption: "string (opcional)",
        slides: [
          {
            index: 1,
            tagline: "string (opcional)",
            title: "string",
            body: "string (opcional)",
            cta: "string (opcional)",
            imagePrompt: "string (opcional)"
          }
        ]
      },
      null,
      2
    )
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

function toEditorState(result: GenerationResult): CarouselEditorState {
  const slides = result.slides.map((s) => {
    const objects: Array<Record<string, unknown>> = [];

    if (s.tagline) {
      objects.push({
        id: "tagline",
        type: "text",
        text: s.tagline,
        x: 80,
        y: 140,
        fontSize: 34
      });
    }

    objects.push({
      id: "title",
      type: "text",
      text: s.title,
      x: 80,
      y: 240,
      fontSize: 72,
      fontWeight: 700
    });

    if (s.body) {
      objects.push({
        id: "body",
        type: "text",
        text: s.body,
        x: 80,
        y: 420,
        fontSize: 34
      });
    }

    if (s.cta) {
      objects.push({
        id: "cta",
        type: "text",
        text: s.cta,
        x: 80,
        y: 900,
        fontSize: 28
      });
    }

    return {
      id: `slide_${s.index}`,
      width: 1080,
      height: 1080,
      objects
    };
  });

  return { version: 1, slides };
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

export async function generateFirstDraftForCarousel(carouselId: string) {
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

  const draft = carousel.draft as Record<string, unknown>;
  const slidesCount = Number(draft.slidesCount ?? 5);
  const topicOrPrompt =
    (draft.inputMode === "prompt" ? draft.prompt : draft.topic) ??
    draft.prompt ??
    draft.topic;

  if (!topicOrPrompt || typeof topicOrPrompt !== "string") {
    return { ok: false as const, error: "Sem tema/prompt para gerar." };
  }

  await supabase
    .from("carousels")
    .update({
      generation_status: "running",
      generation_error: null,
      generation_meta: { started_at: new Date().toISOString(), provider: "gemini" }
    })
    .eq("id", carouselId);

  const { system, user } = buildPrompt({
    topicOrPrompt,
    slidesCount,
    tone: typeof draft.tone === "string" ? draft.tone : undefined,
    targetAudience:
      typeof draft.targetAudience === "string" ? draft.targetAudience : undefined,
    language: typeof draft.language === "string" ? draft.language : undefined
  });

  const gen = await geminiGenerateJson({
    system,
    user,
    schema: generationResultSchema
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
        generation_meta: { ...prevMeta, raw: gen.raw ?? null }
      })
      .eq("id", carouselId);
    return { ok: false as const, error: gen.error };
  }

  const editorState = toEditorState(gen.data);

  // Generate one background image per slide (optional prompt).
  const generatedAssets: Array<{ slideIndex: number; path: string }> = [];
  for (const slide of gen.data.slides) {
    const prompt = slide.imagePrompt ?? "";
    const image = await geminiNanoBananaGenerateImage({
      prompt:
        (prompt || `Imagem para o slide ${slide.index} do carrossel: ${gen.data.title}`) +
        "\n\nRequisitos: 1080x1080, sem texto na imagem."
    });

    if (!image.ok) continue;

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
      continue;
    }

    const { error: insertError } = await supabase.from("carousel_assets").insert({
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
        prompt: slide.imagePrompt ?? null
      }
    });

    if (!insertError) {
      generatedAssets.push({ slideIndex: slide.index, path });
    }
  }

  await supabase
    .from("carousels")
    .update({
      title: gen.data.title,
      editor_state: editorState,
      generation_status: "succeeded",
      generation_error: null,
      generation_meta: {
        finished_at: new Date().toISOString(),
        provider: "gemini",
        images: { count: generatedAssets.length }
      }
    })
    .eq("id", carouselId);

  return { ok: true as const, result: gen.data, assets: generatedAssets };
}
