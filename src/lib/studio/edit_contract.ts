import "server-only";

import { z } from "zod";

const slideTargetSchema = z.object({
  slideId: z.string().min(1).optional(),
  slideIndex: z.number().int().min(1).max(20).optional()
});

export const editOpSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("set_text"),
      objectId: z.string().min(1),
      text: z.string().min(1).max(1500)
    })
    .merge(slideTargetSchema),
  z
    .object({
      op: z.literal("set_style"),
      objectId: z.string().min(1),
      style: z.record(z.unknown())
    })
    .merge(slideTargetSchema),
  z
    .object({
      op: z.literal("move"),
      objectId: z.string().min(1),
      x: z.number().finite().optional(),
      y: z.number().finite().optional()
    })
    .merge(slideTargetSchema)
]);

export const editPatchSchema = z.object({
  ops: z.array(editOpSchema).min(1).max(50),
  summary: z.string().max(300).optional()
});

export type EditPatch = z.infer<typeof editPatchSchema>;

