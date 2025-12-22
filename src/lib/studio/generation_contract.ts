import "server-only";

import { z } from "zod";

export const slideSpecSchema = z.object({
  index: z.number().int().min(1),
  tagline: z.string().trim().max(140).optional(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(600).optional(),
  cta: z.string().trim().max(120).optional(),
  imagePrompt: z.string().trim().max(800).optional()
});

export const generationResultSchema = z.object({
  title: z.string().trim().min(1).max(120),
  caption: z.string().trim().max(2200).optional(),
  slides: z.array(slideSpecSchema).min(2).max(10)
});

export type GenerationResult = z.infer<typeof generationResultSchema>;

