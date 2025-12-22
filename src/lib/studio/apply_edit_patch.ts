import "server-only";

import type { CarouselEditorState } from "@/lib/db/types";
import type { EditPatch } from "@/lib/studio/edit_contract";
import { isLocked } from "@/lib/studio/locks";

function clone<T>(value: T): T {
  // editor_state is JSON-serializable by design.
  return JSON.parse(JSON.stringify(value)) as T;
}

function getSlideByTarget(
  state: CarouselEditorState,
  target: { slideId?: string; slideIndex?: number }
) {
  const slides = state.slides ?? [];
  if (target.slideId) {
    return slides.find((s) => (s as Record<string, unknown>).id === target.slideId) as
      | Record<string, unknown>
      | undefined;
  }
  if (typeof target.slideIndex === "number") {
    return slides[target.slideIndex - 1] as Record<string, unknown> | undefined;
  }
  return undefined;
}

function getObjects(slide: Record<string, unknown>) {
  const objects = slide.objects;
  return Array.isArray(objects)
    ? (objects as Array<Record<string, unknown>>)
    : [];
}

function findObject(slide: Record<string, unknown>, objectId: string) {
  const objects = getObjects(slide);
  return objects.find((o) => o.id === objectId);
}

export function applyEditPatch(input: {
  editorState: CarouselEditorState;
  locks: unknown;
  patch: EditPatch;
}): {
  nextState: CarouselEditorState;
  applied: number;
  skippedLocked: number;
  skippedMissing: number;
} {
  const nextState = clone(input.editorState);
  nextState.slides = Array.isArray(nextState.slides) ? nextState.slides : [];

  let applied = 0;
  let skippedLocked = 0;
  let skippedMissing = 0;

  for (const op of input.patch.ops) {
    const slide = getSlideByTarget(nextState, op);
    const slideId =
      slide && typeof slide.id === "string" ? (slide.id as string) : undefined;
    const slideIndex = op.slideIndex;

    if (!slide) {
      skippedMissing++;
      continue;
    }

    if (
      isLocked({
        locks: input.locks,
        slideId,
        slideIndex,
        objectId: op.objectId
      })
    ) {
      skippedLocked++;
      continue;
    }

    const obj = findObject(slide, op.objectId);
    if (!obj) {
      skippedMissing++;
      continue;
    }

    if (op.op === "set_text") {
      obj.text = op.text;
      applied++;
      continue;
    }

    if (op.op === "set_style") {
      for (const [k, v] of Object.entries(op.style)) {
        (obj as Record<string, unknown>)[k] = v;
      }
      applied++;
      continue;
    }

    if (op.op === "move") {
      if (typeof op.x === "number") obj.x = op.x;
      if (typeof op.y === "number") obj.y = op.y;
      applied++;
      continue;
    }
  }

  return { nextState, applied, skippedLocked, skippedMissing };
}
