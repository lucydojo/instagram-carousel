import "server-only";

export type Rect01 = { x: number; y: number; w: number; h: number };

export type TemplateDataV1 = {
  version: 1;
  id: string;
  name: string;
  slide: { width: 1080; height: 1080 };
  zones: {
    tagline?: Rect01;
    title: Rect01;
    body?: Rect01;
    cta?: Rect01;
    creator: Rect01;
    swipe?: Rect01;
  };
  images: Array<
    | { id: string; kind: "background"; bounds: Rect01; safeZones: Rect01[] }
    | { id: string; kind: "slot"; bounds: Rect01; safeZones: Rect01[] }
  >;
  defaults: {
    typography: {
      fontFamily: string;
      titleSize: number;
      bodySize: number;
      taglineSize?: number;
      ctaSize?: number;
      lineHeightTight?: number;
      lineHeightNormal?: number;
    };
    spacing: { padding: number };
    background: { overlay?: { enabled: boolean; opacity: number; color?: string } };
  };
};

export function isTemplateDataV1(value: unknown): value is TemplateDataV1 {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.version !== 1) return false;
  if (typeof obj.id !== "string" || typeof obj.name !== "string") return false;
  if (!obj.slide || typeof obj.slide !== "object") return false;
  if (!obj.zones || typeof obj.zones !== "object") return false;
  if (!Array.isArray(obj.images)) return false;
  return true;
}

export const BUILTIN_TEMPLATES: TemplateDataV1[] = [
  {
    version: 1,
    id: "builtin/background-overlay",
    name: "Imagem de fundo + overlay",
    slide: { width: 1080, height: 1080 },
    zones: {
      title: { x: 0.08, y: 0.2, w: 0.84, h: 0.22 },
      body: { x: 0.08, y: 0.42, w: 0.7, h: 0.22 },
      cta: { x: 0.08, y: 0.74, w: 0.6, h: 0.08 },
      creator: { x: 0.06, y: 0.88, w: 0.6, h: 0.1 },
      swipe: { x: 0.82, y: 0.88, w: 0.12, h: 0.08 }
    },
    images: [
      {
        id: "background",
        kind: "background",
        bounds: { x: 0, y: 0, w: 1, h: 1 },
        safeZones: [
          { x: 0.08, y: 0.2, w: 0.84, h: 0.22 },
          { x: 0.08, y: 0.42, w: 0.7, h: 0.22 },
          { x: 0.08, y: 0.74, w: 0.6, h: 0.08 },
          { x: 0.06, y: 0.88, w: 0.6, h: 0.1 },
          { x: 0.82, y: 0.88, w: 0.12, h: 0.08 }
        ]
      }
    ],
    defaults: {
      typography: {
        fontFamily: "Inter",
        titleSize: 72,
        bodySize: 34,
        taglineSize: 24,
        ctaSize: 28,
        lineHeightTight: 1.1,
        lineHeightNormal: 1.25
      },
      spacing: { padding: 80 },
      background: { overlay: { enabled: true, opacity: 0.35, color: "#000000" } }
    }
  },
  {
    version: 1,
    id: "builtin/split-left-text-right-image",
    name: "Split (texto à esquerda, imagem à direita)",
    slide: { width: 1080, height: 1080 },
    zones: {
      title: { x: 0.08, y: 0.18, w: 0.4, h: 0.24 },
      body: { x: 0.08, y: 0.42, w: 0.4, h: 0.26 },
      cta: { x: 0.08, y: 0.74, w: 0.4, h: 0.08 },
      creator: { x: 0.08, y: 0.88, w: 0.4, h: 0.1 },
      swipe: { x: 0.84, y: 0.9, w: 0.12, h: 0.06 }
    },
    images: [
      {
        id: "hero",
        kind: "slot",
        bounds: { x: 0.52, y: 0.1, w: 0.4, h: 0.8 },
        safeZones: [{ x: 0.84, y: 0.9, w: 0.12, h: 0.06 }]
      }
    ],
    defaults: {
      typography: {
        fontFamily: "Inter",
        titleSize: 64,
        bodySize: 32,
        taglineSize: 22,
        ctaSize: 26,
        lineHeightTight: 1.1,
        lineHeightNormal: 1.25
      },
      spacing: { padding: 80 },
      background: {}
    }
  }
];
