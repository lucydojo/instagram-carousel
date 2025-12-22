import "server-only";

import { z } from "zod";

const modelsResponseSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string(),
        supportedGenerationMethods: z.array(z.string()).optional()
      })
    )
    .optional()
});

const generateResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(
            z.object({
              inlineData: z
                .object({
                  mimeType: z.string().optional(),
                  data: z.string().min(10)
                })
                .optional()
            })
          )
        })
      })
    )
    .optional()
});

function normalizeModelId(model: string): string {
  return model.startsWith("models/") ? model.slice("models/".length) : model;
}

function isModelError(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  if (!("error" in body)) return false;

  const errorValue = (body as Record<string, unknown>).error;
  if (!errorValue || typeof errorValue !== "object") return false;

  const errorObj = errorValue as Record<string, unknown>;
  const messageRaw = errorObj.message;
  const statusRaw = errorObj.status;
  const codeRaw = errorObj.code;

  const message = typeof messageRaw === "string" ? messageRaw.toLowerCase() : "";
  const status = typeof statusRaw === "string" ? statusRaw.toLowerCase() : "";
  const code = typeof codeRaw === "number" ? codeRaw : null;

  return (
    code === 404 ||
    status.includes("not_found") ||
    message.includes("not found") ||
    message.includes("not supported")
  );
}

async function listModels(apiKey: string) {
  const versions = ["v1beta", "v1"] as const;

  for (const version of versions) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/${version}/models?key=${encodeURIComponent(apiKey)}`,
      { method: "GET" }
    );
    const json = (await res.json().catch(() => null)) as unknown;
    const parsed = modelsResponseSchema.safeParse(json);
    if (!res.ok || !parsed.success) continue;
    return (parsed.data.models ?? []).map((m) => ({
      name: normalizeModelId(m.name),
      supportedGenerationMethods: m.supportedGenerationMethods ?? []
    }));
  }

  return [];
}

async function pickImageModelFallback(apiKey: string): Promise<string | null> {
  const models = await listModels(apiKey);
  const eligible = models.filter((m) =>
    m.supportedGenerationMethods.length === 0
      ? true
      : m.supportedGenerationMethods.includes("generateContent")
  );

  const candidates = eligible.length > 0 ? eligible : models;
  if (candidates.length === 0) return null;

  const score = (name: string) => {
    const n = name.toLowerCase();
    let s = 0;
    if (n.includes("flash-image") || n.includes("flash_image")) s += 100;
    if (n.includes("pro-image") || n.includes("pro_image")) s += 80;
    if (n.includes("image")) s += 20;
    if (n.includes("2.5")) s += 10;
    if (n.includes("3")) s += 5;
    return s;
  };

  return candidates
    .slice()
    .sort((a, b) => score(b.name) - score(a.name))[0]?.name ?? null;
}

async function callGenerateContent(input: {
  apiKey: string;
  model: string;
  prompt: string;
  version: "v1beta" | "v1";
}) {
  const model = normalizeModelId(input.model);
  const url = `https://generativelanguage.googleapis.com/${input.version}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: input.prompt }]
        }
      ]
    })
  });
}

function getInlineData(body: unknown): { data: string; mimeType: string } | null {
  const parsed = generateResponseSchema.safeParse(body);
  if (!parsed.success) return null;
  const parts = parsed.data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data) {
      return { data: inline.data, mimeType: inline.mimeType ?? "image/png" };
    }
  }
  return null;
}

function seemsLikePng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function seemsLikeJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function geminiNanoBananaGenerateImage(input: {
  prompt: string;
  model?: string;
}): Promise<
  | {
      ok: true;
      bytes: Uint8Array;
      mimeType: string;
      provider: "gemini";
      model: string;
    }
  | { ok: false; error: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY não configurada." };

  const preferred = normalizeModelId(
    input.model ?? process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image"
  );

  const versions: Array<"v1beta" | "v1"> = ["v1beta", "v1"];
  let lastErr: unknown = null;

  for (const version of versions) {
    const res = await callGenerateContent({
      apiKey,
      model: preferred,
      prompt: input.prompt,
      version
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      lastErr = json;
      if (isModelError(json)) continue;
      return { ok: false, error: `Gemini image falhou (HTTP ${res.status}).` };
    }

    const inline = getInlineData(json);
    if (!inline) return { ok: false, error: "Gemini não retornou imagem." };

    const bytes = Uint8Array.from(Buffer.from(inline.data, "base64"));
    const mimeType = inline.mimeType;

    if (bytes.length < 128) {
      return { ok: false, error: "Imagem gerada muito pequena (provável erro)." };
    }

    if (
      (mimeType.includes("png") && !seemsLikePng(bytes)) ||
      (mimeType.includes("jpeg") && !seemsLikeJpeg(bytes))
    ) {
      return { ok: false, error: "Imagem gerada com formato inválido." };
    }

    return { ok: true, bytes, mimeType, provider: "gemini", model: preferred };
  }

  // If model seems unsupported, pick a fallback image model and retry.
  if (lastErr && isModelError(lastErr)) {
    const fallback = await pickImageModelFallback(apiKey);
    if (fallback) {
      for (const version of versions) {
        const res = await callGenerateContent({
          apiKey,
          model: fallback,
          prompt: input.prompt,
          version
        });
        const json = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) continue;
        const inline = getInlineData(json);
        if (!inline) continue;
        const bytes = Uint8Array.from(Buffer.from(inline.data, "base64"));
        const mimeType = inline.mimeType;
        if (bytes.length < 128) continue;
        return { ok: true, bytes, mimeType, provider: "gemini", model: fallback };
      }
    }
  }

  return { ok: false, error: "Não foi possível gerar imagem via Gemini." };
}

export const GEMINI_IMAGE_MODELS = {
  NANO_BANANA: "gemini-2.5-flash-image",
  NANO_BANANA_PRO: "gemini-3-pro-image-preview"
} as const;

export type GeminiImageModel =
  (typeof GEMINI_IMAGE_MODELS)[keyof typeof GEMINI_IMAGE_MODELS];

export function isSupportedGeminiImageModel(value: unknown): value is GeminiImageModel {
  return value === GEMINI_IMAGE_MODELS.NANO_BANANA || value === GEMINI_IMAGE_MODELS.NANO_BANANA_PRO;
}
