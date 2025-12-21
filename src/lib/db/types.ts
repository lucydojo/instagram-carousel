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
};
