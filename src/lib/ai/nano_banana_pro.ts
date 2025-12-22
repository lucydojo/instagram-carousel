import "server-only";

import { z } from "zod";

const imageResponseSchema = z.object({
  image_base64: z.string().min(10),
  mime_type: z.string().min(3).optional()
});

export async function nanoBananaProGenerateImage(input: {
  prompt: string;
  width: number;
  height: number;
}): Promise<{
  ok: true;
  bytes: Uint8Array;
  mimeType: string;
  provider: "nano_banana_pro";
} | { ok: false; error: string }> {
  const apiUrl = process.env.NANO_BANANA_PRO_API_URL;
  const apiKey = process.env.NANO_BANANA_PRO_API_KEY;

  if (!apiUrl || !apiKey) {
    return {
      ok: false,
      error: "NANO_BANANA_PRO_API_URL/NANO_BANANA_PRO_API_KEY não configuradas."
    };
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      prompt: input.prompt,
      width: input.width,
      height: input.height
    })
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok || !json) {
    return { ok: false, error: `Nano Banana Pro falhou (HTTP ${res.status}).` };
  }

  const parsed = imageResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "Resposta inválida do Nano Banana Pro." };
  }

  const bytes = Uint8Array.from(Buffer.from(parsed.data.image_base64, "base64"));
  return {
    ok: true,
    bytes,
    mimeType: parsed.data.mime_type ?? "image/png",
    provider: "nano_banana_pro"
  };
}
