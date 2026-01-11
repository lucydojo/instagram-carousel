import "server-only";

import { z } from "zod";
import { extractFirstJson } from "@/lib/ai/json";

const geminiModelsSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string(),
        supportedGenerationMethods: z.array(z.string()).optional()
      })
    )
    .optional()
});

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() }))
        })
      })
    )
    .optional()
});

function getTextFromGeminiResponse(body: unknown): string {
  const parsed = geminiResponseSchema.safeParse(body);
  if (!parsed.success) return "";
  const parts = parsed.data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

function normalizeModelId(model: string): string {
  return model.startsWith("models/") ? model.slice("models/".length) : model;
}

async function listModels(apiKey: string) {
  const versions = ["v1beta", "v1"] as const;

  for (const version of versions) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/${version}/models?key=${encodeURIComponent(apiKey)}`,
      { method: "GET" }
    );
    const json = (await res.json().catch(() => null)) as unknown;
    const parsed = geminiModelsSchema.safeParse(json);
    if (!res.ok || !parsed.success) continue;
    return (parsed.data.models ?? []).map((m) => ({
      name: normalizeModelId(m.name),
      supportedGenerationMethods: m.supportedGenerationMethods ?? []
    }));
  }

  return [];
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
    message.includes("not supported for generatecontent")
  );
}

async function pickFallbackModel(apiKey: string): Promise<string | null> {
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
    if (n.includes("flash")) s += 100;
    if (n.includes("3.0")) s += 30;
    if (n.includes("2.0")) s += 20;
    if (n.includes("1.5")) s += 10;
    return s;
  };

  return candidates
    .slice()
    .sort((a, b) => score(b.name) - score(a.name))[0]?.name ?? null;
}

async function callGenerateContent(input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  images?: Array<{ mimeType: string; data: string }>;
  version?: "v1beta" | "v1";
}) {
  const model = normalizeModelId(input.model);
  const version = input.version ?? "v1beta";
  const url = `https://generativelanguage.googleapis.com/${version}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  const parts: Array<Record<string, unknown>> = [
    {
      text: [
        input.system,
        "",
        "IMPORTANTE: responda SOMENTE com JSON válido. Sem Markdown. Sem texto extra.",
        "",
        input.user
      ].join("\n")
    }
  ];

  if (input.images && input.images.length > 0) {
    for (const img of input.images) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.data
        }
      });
    }
  }

  return await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 4096
      }
    })
  });
}

async function callGenerateContentAnyVersion(input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  images?: Array<{ mimeType: string; data: string }>;
}): Promise<{ res: Response; json: unknown }> {
  const versions: Array<"v1beta" | "v1"> = ["v1beta", "v1"];
  for (const version of versions) {
    const res = await callGenerateContent({ ...input, version });
    const json = (await res.json().catch(() => null)) as unknown;
    if (res.ok) return { res, json };
    if (!isModelError(json) && version === "v1beta") {
      // Not a model/version issue; don't retry on v1.
      return { res, json };
    }
    // If model/version issue, retry with other version.
    if (version === "v1") return { res, json };
  }

  // Unreachable, but keeps TS happy.
  const res = await callGenerateContent({ ...input, version: "v1beta" });
  const json = (await res.json().catch(() => null)) as unknown;
  return { res, json };
}

export async function geminiGenerateJson<T>(input: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  model?: string;
  images?: Array<{ mimeType: string; data: string }>;
}): Promise<{ ok: true; data: T } | { ok: false; error: string; raw?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY não configurada." };
  }

  const preferredModel = normalizeModelId(
    input.model ?? process.env.GEMINI_MODEL ?? "gemini-3.0-flash"
  );

  let { res, json } = await callGenerateContentAnyVersion({
    apiKey,
    model: preferredModel,
    system: input.system,
    user: input.user,
    images: input.images
  });

  let rawText = getTextFromGeminiResponse(json);

  if (!res.ok && isModelError(json)) {
    const fallback = await pickFallbackModel(apiKey);
    if (fallback && fallback !== preferredModel) {
      const second = await callGenerateContentAnyVersion({
        apiKey,
        model: fallback,
        system: input.system,
        user: input.user,
        images: input.images
      });
      res = second.res;
      json = second.json;
      rawText = getTextFromGeminiResponse(json);
    }
  }

  if (!res.ok) {
    const errMsg =
      typeof json === "object" && json && "error" in json
        ? JSON.stringify(json)
        : rawText || `HTTP ${res.status}`;
    return { ok: false, error: `Gemini falhou: ${errMsg}`, raw: rawText };
  }

  const extracted = extractFirstJson(rawText) ?? rawText.trim();
  try {
    const parsedJson = JSON.parse(extracted) as unknown;
    const validated = input.schema.safeParse(parsedJson);
    if (!validated.success) {
      return {
        ok: false,
        error: "Resposta do Gemini não bateu com o schema esperado.",
        raw: extracted
      };
    }
    return { ok: true, data: validated.data };
  } catch {
    return { ok: false, error: "Resposta do Gemini não é JSON válido.", raw: rawText };
  }
}
