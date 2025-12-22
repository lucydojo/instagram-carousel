import "server-only";

export type ElementLocks = Record<string, unknown>;

function getNested(lockRoot: unknown, k1: string, k2: string): boolean {
  if (!lockRoot || typeof lockRoot !== "object") return false;
  const level1 = (lockRoot as Record<string, unknown>)[k1];
  if (!level1 || typeof level1 !== "object") return false;
  const v = (level1 as Record<string, unknown>)[k2];
  return Boolean(v);
}

function getTopLevel(lockRoot: unknown, key: string): boolean {
  if (!lockRoot || typeof lockRoot !== "object") return false;
  return Boolean((lockRoot as Record<string, unknown>)[key]);
}

export function isLocked(input: {
  locks: unknown;
  slideId?: string;
  slideIndex?: number;
  objectId: string;
}): boolean {
  const { locks, slideId, slideIndex, objectId } = input;

  // Array format: ["slide_1:title", "1:title", ...]
  if (Array.isArray(locks)) {
    const tokens = locks.filter((x): x is string => typeof x === "string");
    if (slideId && tokens.includes(`${slideId}:${objectId}`)) return true;
    if (typeof slideIndex === "number" && tokens.includes(`${slideIndex}:${objectId}`))
      return true;
    return false;
  }

  // Object formats:
  // - { slide_1: { title: true } }
  // - { "1": { title: true } }
  // - { "slide_1.title": true }
  // - { "1.title": true }
  if (slideId && getNested(locks, slideId, objectId)) return true;
  if (typeof slideIndex === "number" && getNested(locks, String(slideIndex), objectId))
    return true;

  if (slideId && getTopLevel(locks, `${slideId}.${objectId}`)) return true;
  if (typeof slideIndex === "number" && getTopLevel(locks, `${slideIndex}.${objectId}`))
    return true;

  // Alternate root container
  if (locks && typeof locks === "object" && "bySlide" in locks) {
    const bySlide = (locks as Record<string, unknown>).bySlide;
    if (slideId && getNested(bySlide, slideId, objectId)) return true;
    if (typeof slideIndex === "number" && getNested(bySlide, String(slideIndex), objectId))
      return true;
  }

  return false;
}

