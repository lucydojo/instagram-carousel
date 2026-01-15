import "server-only";

import { z } from "zod";

const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}){1,2}$/)
  .transform((value) => value.toLowerCase());

const safeZoneSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1)
});

const imageRequestSchema = z
  .object({
    slotId: z.string().trim().min(1).optional(),
    purpose: z.enum(["background", "slot"]),
    prompt: z.string().trim().min(1).max(1600),
    containsText: z.boolean().default(false),
    aspect: z.string().trim().min(1).max(32).optional(),
    safeZones: z.array(safeZoneSchema).max(6).optional(),
    styleHints: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
    avoid: z.array(z.string().trim().min(1).max(120)).max(12).optional()
  })
  .refine(
    (value) => (value.purpose === "slot" ? Boolean(value.slotId) : true),
    {
      message: "slotId is required when purpose=slot",
      path: ["slotId"]
    }
  );

const slideTextSchema = z.object({
  tagline: z.string().trim().max(140).optional(),
  title: z.string().trim().min(1).max(140),
  body: z.string().trim().max(800).optional(),
  cta: z.string().trim().max(140).optional()
});

const slidePlanSchema = z.object({
  index: z.number().int().min(1),
  text: slideTextSchema,
  images: z.array(imageRequestSchema).max(6).optional()
});

const globalStyleSchema = z.object({
  palette: z.object({
    background: hexColorSchema,
    text: hexColorSchema,
    accent: hexColorSchema
  }),
  backgroundOverlay: z
    .object({
      enabled: z.boolean(),
      opacity: z.number().min(0).max(1),
      color: hexColorSchema.optional(),
      mode: z.enum(["solid", "bottom-gradient"]).optional(),
      height: z.number().min(0).max(1).optional()
    })
    .optional(),
  typography: z.object({
    titleFontFamily: z.string().trim().min(1).max(80),
    bodyFontFamily: z.string().trim().min(1).max(80),
    titleSize: z.number().int().min(8).max(200),
    bodySize: z.number().int().min(8).max(200),
    ctaSize: z.number().int().min(8).max(200),
    alignment: z.enum(["left", "center", "right"]).default("left")
  }),
  spacing: z.object({
    padding: z.number().int().min(0).max(240)
  }),
  templateId: z.string().trim().min(1)
});

export const plannerOutputSchema = z.object({
  version: z.literal(1),
  globalStyle: globalStyleSchema,
  slides: z.array(slidePlanSchema).min(1).max(20),
  notes: z.array(z.string().trim().min(1).max(200)).max(8).optional()
});

export type PlannerOutput = z.infer<typeof plannerOutputSchema>;
