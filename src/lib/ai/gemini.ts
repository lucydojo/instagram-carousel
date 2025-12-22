import "server-only";

import { z } from "zod";
import { extractFirstJson } from "@/lib/ai/json";

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

export async function geminiGenerateJson<T>(input: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  model?: string;
}): Promise<{ ok: true; data: T } | { ok: false; error: string; raw?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY não configurada." };
  }

  const model = input.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                input.system,
                "",
                "IMPORTANTE: responda SOMENTE com JSON válido. Sem Markdown. Sem texto extra.",
                "",
                input.user
              ].join("\n")
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 4096
      }
    })
  });

  const json = (await res.json().catch(() => null)) as unknown;
  const rawText = getTextFromGeminiResponse(json);
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
