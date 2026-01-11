export type Platform = "instagram";

export type CarouselInputMode = "topic" | "prompt";

export type CarouselDraft = {
  inputMode: CarouselInputMode;
  topic?: string;
  prompt?: string;
  slidesCount: number;
  platform: Platform;
  tone?: string;
  targetAudience?: string;
  language?: string;
  presetId?: string;
  templateId?: string;
  creatorInfo?: {
    enabled: boolean;
    name?: string;
    handle?: string;
    role?: string;
  };
  palette?: {
    background?: string;
    text?: string;
    accent?: string;
    additional?: string[];
  };
  referenceSimilarity?: number;
};

export type CarouselGenerationStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

/**
 * Canonical persistence format for the studio/editor.
 * Intentionally tolerant: Fabric.js serialization and our higher-level model can evolve.
 */
export type CarouselEditorState = {
  version: number;
  global?: Record<string, unknown>;
  slides?: Array<Record<string, unknown>>;
};
