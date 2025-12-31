"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  Code2,
  Download,
  Image as ImageIcon,
  LayoutTemplate,
  LayoutGrid,
  Lock,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  UserCircle2
} from "lucide-react";
import {
  studioCleanup,
  studioCreatePalette,
  studioDeletePalette,
  studioEditInline,
  studioGenerate,
  studioSaveEditorState,
  studioSaveEditorStateInline,
  studioSaveLocksInline
} from "./actions";
import { MotionDock, MotionDockItem } from "./MotionDock";
import FabricSlideCanvas, {
  type FabricSlideCanvasHandle,
  type SlideV1
} from "./FabricSlideCanvas";

type Asset = {
  id: string;
  asset_type: "generated" | "reference" | string;
  signedUrl: string | null;
};

type SlideLike = Record<string, unknown>;

function clampInt(value: number, min: number, max: number) {
  const v = Number.isFinite(value) ? Math.trunc(value) : min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

type Flash = {
  saved: boolean;
  locksSaved: boolean;
  edited: boolean;
  cleaned: number | null;
  error: string | null;
  editSummary: string | null;
  applied: number | null;
  locked: number | null;
  missing: number | null;
};

type Props = {
  carouselId: string;
  slideCount: number;
  initialSlideIndex: number;
  slides: SlideLike[];
  placeholderCount: number;
  statusLabel: string;
  progress: {
    imagesDone: number | null;
    imagesTotal: number | null;
    imagesFailed: number | null;
  };
  assets: {
    generated: Asset[];
    reference: Asset[];
  };
  palettes: Array<{
    id: string;
    name: string;
    is_global: boolean;
    palette_data: Record<string, unknown>;
  }>;
  templates: Array<{
    id: string;
    name: string;
    is_global: boolean;
    template_data: Record<string, unknown>;
  }>;
  catalog: {
    templates: number;
    presets: number;
    palettes: number;
    tones: number;
    audiences: number;
    creators: number;
  };
  flash: Flash;
  imageModels: string[];
  defaults: {
    elementLocksJson: string;
    editorStateJson: string;
  };
};

type DockItem =
  | "nav"
  | "slide"
  | "generate"
  | "command"
  | "assets"
  | "brand"
  | "colors"
  | "text"
  | "templates"
  | "presets"
  | "locks"
  | "json";

type Rect01 = { x: number; y: number; w: number; h: number };
type TemplateDataV1 = {
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

type PaletteV1 = { background: string; text: string; accent: string };
type TypographyV1 = {
  titleFontFamily: string;
  bodyFontFamily: string;
  ctaFontFamily?: string;
  taglineFontFamily?: string;
  titleSize: number;
  bodySize: number;
  taglineSize?: number;
  ctaSize?: number;
  titleLineHeight?: number;
  bodyLineHeight?: number;
  taglineLineHeight?: number;
  ctaLineHeight?: number;
  titleSpacing?: number;
  bodySpacing?: number;
  taglineSpacing?: number;
  ctaSpacing?: number;
};

type OverlayV1 = { enabled: boolean; opacity: number; color: string };

type PaletteOption = {
  id: string;
  name: string;
  is_global: boolean;
  palette_data: Record<string, unknown>;
  palette: PaletteV1;
};

const BUILTIN_TEMPLATES: TemplateDataV1[] = [
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
        ctaSize: 26,
        lineHeightTight: 1.1,
        lineHeightNormal: 1.25
      },
      spacing: { padding: 80 },
      background: {}
    }
  }
];

type FontOption = { id: string; titleFont: string; bodyFont: string };

const FONT_FAMILIES: Array<{ value: string; label: string }> = [
  { value: "Inter", label: "Inter" },
  { value: "Space Grotesk", label: "Space Grotesk" },
  { value: "Poppins", label: "Poppins" },
  { value: "Rubik", label: "Rubik" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "Space Mono", label: "Space Mono" },
  {
    value:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    label: "Sistema (sans)"
  },
  { value: "ui-serif, Georgia, serif", label: "Sistema (serif)" }
];

const FONT_PAIRS: FontOption[] = [
  { id: "inter-inter", titleFont: "Inter", bodyFont: "Inter" },
  { id: "spacegrotesk-inter", titleFont: "Space Grotesk", bodyFont: "Inter" },
  { id: "poppins-inter", titleFont: "Poppins", bodyFont: "Inter" },
  { id: "rubik-inter", titleFont: "Rubik", bodyFont: "Inter" },
  { id: "playfair-poppins", titleFont: "Playfair Display", bodyFont: "Poppins" },
  { id: "playfair-inter", titleFont: "Playfair Display", bodyFont: "Inter" },
  { id: "merriweather-inter", titleFont: "Merriweather", bodyFont: "Inter" },
  { id: "merriweather-poppins", titleFont: "Merriweather", bodyFont: "Poppins" },
  { id: "spacegrotesk-rubik", titleFont: "Space Grotesk", bodyFont: "Rubik" },
  { id: "poppins-rubik", titleFont: "Poppins", bodyFont: "Rubik" },
  { id: "rubik-poppins", titleFont: "Rubik", bodyFont: "Poppins" },
  { id: "spacegrotesk-spacegrotesk", titleFont: "Space Grotesk", bodyFont: "Space Grotesk" },
  { id: "poppins-poppins", titleFont: "Poppins", bodyFont: "Poppins" },
  { id: "rubik-rubik", titleFont: "Rubik", bodyFont: "Rubik" },
  { id: "spacemono-inter", titleFont: "Space Mono", bodyFont: "Inter" }
];

function isTemplateDataV1(value: unknown): value is TemplateDataV1 {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.version === 1 && typeof v.id === "string" && typeof v.name === "string";
}

function parsePaletteV1(value: unknown): PaletteV1 | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const background = typeof v.background === "string" ? v.background : null;
  const text = typeof v.text === "string" ? v.text : null;
  const accent = typeof v.accent === "string" ? v.accent : null;
  if (!background || !text || !accent) return null;
  return { background, text, accent };
}

function parseTypographyV1(value: unknown): TypographyV1 | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const titleFontFamily =
    typeof v.titleFontFamily === "string"
      ? v.titleFontFamily
      : typeof v.fontFamily === "string"
        ? v.fontFamily
        : null;
  const bodyFontFamily =
    typeof v.bodyFontFamily === "string"
      ? v.bodyFontFamily
      : typeof v.fontFamily === "string"
        ? v.fontFamily
        : null;
  const titleSize = typeof v.titleSize === "number" ? v.titleSize : null;
  const bodySize = typeof v.bodySize === "number" ? v.bodySize : null;
  if (!titleFontFamily || !bodyFontFamily || !titleSize || !bodySize) return null;
  const taglineSize = typeof v.taglineSize === "number" ? v.taglineSize : undefined;
  const ctaSize = typeof v.ctaSize === "number" ? v.ctaSize : undefined;
  const ctaFontFamily = typeof v.ctaFontFamily === "string" ? v.ctaFontFamily : undefined;
  const taglineFontFamily =
    typeof v.taglineFontFamily === "string" ? v.taglineFontFamily : undefined;
  const titleLineHeight =
    typeof v.titleLineHeight === "number" ? v.titleLineHeight : undefined;
  const bodyLineHeight = typeof v.bodyLineHeight === "number" ? v.bodyLineHeight : undefined;
  const taglineLineHeight =
    typeof v.taglineLineHeight === "number" ? v.taglineLineHeight : undefined;
  const ctaLineHeight = typeof v.ctaLineHeight === "number" ? v.ctaLineHeight : undefined;
  const titleSpacing = typeof v.titleSpacing === "number" ? v.titleSpacing : undefined;
  const bodySpacing = typeof v.bodySpacing === "number" ? v.bodySpacing : undefined;
  const taglineSpacing =
    typeof v.taglineSpacing === "number" ? v.taglineSpacing : undefined;
  const ctaSpacing = typeof v.ctaSpacing === "number" ? v.ctaSpacing : undefined;
  return {
    titleFontFamily,
    bodyFontFamily,
    ctaFontFamily,
    taglineFontFamily,
    titleSize,
    bodySize,
    taglineSize,
    ctaSize,
    titleLineHeight,
    bodyLineHeight,
    taglineLineHeight,
    ctaLineHeight,
    titleSpacing,
    bodySpacing,
    taglineSpacing,
    ctaSpacing
  };
}

function clampNumberRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function parsePaletteOptionsFromProps(
  palettes: Props["palettes"]
): PaletteOption[] {
  return palettes
    .map((p) => {
      const parsed = parsePaletteV1(p.palette_data);
      return parsed ? { ...p, palette: parsed } : null;
    })
    .filter((v): v is PaletteOption => Boolean(v));
}

function toHexColor(value: string): string | null {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1]!;
    const g = v[2]!;
    const b = v[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function rectToPx(rect: Rect01, width: number, height: number) {
  return {
    x: Math.round(rect.x * width),
    y: Math.round(rect.y * height),
    w: Math.round(rect.w * width),
    h: Math.round(rect.h * height)
  };
}

function rectToPct(rect: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`
  };
}

function createStudioId(prefix: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rand}`;
}

function Switch({
  checked,
  onCheckedChange,
  label
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="flex items-center justify-between gap-3"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={[
          "inline-flex h-6 w-11 items-center rounded-full border px-0.5 transition-colors",
          checked ? "bg-emerald-500 border-emerald-500" : "bg-muted/40 border-border",
          checked ? "justify-end" : "justify-start"
        ].join(" ")}
      >
        <span
          className={[
            "h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform"
          ].join(" ")}
        />
      </span>
    </button>
  );
}

function preventExponentKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "e" || e.key === "E") e.preventDefault();
}

function NumericField(props: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  min: number;
  max: number;
  step: number;
  allowDecimal?: boolean;
  allowNegative?: boolean;
}) {
  const { label, value, onCommit, min, max, step, allowDecimal, allowNegative } = props;
  const [draft, setDraft] = React.useState<string>(() => String(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [focused, value]);

  const commit = React.useCallback(() => {
    setFocused(false);
    if (draft.trim() === "") {
      setDraft(String(value));
      return;
    }
    const parsed = allowDecimal ? Number(draft) : Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const nextRaw = allowDecimal ? parsed : Math.trunc(parsed);
    const clamped = clampNumberRange(nextRaw, min, max);
    setDraft(String(clamped));
    onCommit(clamped);
  }, [allowDecimal, draft, max, min, onCommit, value]);

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = e.target.value;
    const decimal = Boolean(allowDecimal);
    const negative = Boolean(allowNegative);
    const re = decimal
      ? negative
        ? /^-?\d*(\.\d*)?$/
        : /^\d*(\.\d*)?$/
      : negative
        ? /^-?\d*$/
        : /^\d*$/;
    if (next === "" || re.test(next)) setDraft(next);
  };

  return (
    <label className="space-y-1">
      {label ? <div className="text-[11px] text-muted-foreground">{label}</div> : null}
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        inputMode={allowDecimal || allowNegative ? "decimal" : "numeric"}
        onKeyDown={(e) => {
          preventExponentKey(e);
          if (!allowNegative && e.key === "-") e.preventDefault();
          if (!allowDecimal && e.key === ".") e.preventDefault();
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onChange={onChange}
        className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
      />
    </label>
  );
}

function PaletteSwatchButton(props: {
  palette: PaletteV1;
  active: boolean;
  onClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="group relative h-9">
      <button
        type="button"
        onClick={props.onClick}
        className={[
          "h-full w-full overflow-hidden rounded-xl border bg-background shadow-sm transition",
          props.active ? "ring-2 ring-primary/40" : "hover:bg-secondary"
        ].join(" ")}
      >
        <div className="grid h-full w-full grid-cols-3">
          <div style={{ background: props.palette.background }} />
          <div style={{ background: props.palette.text }} />
          <div style={{ background: props.palette.accent }} />
        </div>
      </button>
      {props.actions ? (
        <div
          className={[
            "pointer-events-none absolute inset-0 flex items-start justify-end p-1 transition-opacity",
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          ].join(" ")}
        >
          <div className="pointer-events-auto">{props.actions}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function StudioShell(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const canvasApiRef = React.useRef<FabricSlideCanvasHandle | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = React.useState(() =>
    clampInt(props.initialSlideIndex, 1, Math.max(1, props.slideCount))
  );
  const [slotPicker, setSlotPicker] = React.useState<{
    slideIndex: number;
    slotId: string;
  } | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = React.useState<string[]>([]);
  const [locksDirty, setLocksDirty] = React.useState(false);
  const [canvasRevision, setCanvasRevision] = React.useState(0);
  const [leftOpen, setLeftOpen] = React.useState(false);
  const [assetsTab, setAssetsTab] = React.useState<"generated" | "reference">(
    "generated"
  );
  const [extraGeneratedAssets, setExtraGeneratedAssets] = React.useState<Asset[]>([]);
  const [activeDock, setActiveDock] = React.useState<DockItem>("generate");
  const [editInstruction, setEditInstruction] = React.useState("");
  const [editTarget, setEditTarget] = React.useState<string>(() => String(props.initialSlideIndex));
  const [lastEdit, setLastEdit] = React.useState<{
    applied: number;
    blockedByLock: number;
    ignored: number;
    missing: number;
    summary: string | null;
  } | null>(null);
  const [editorState, setEditorState] = React.useState<Record<string, unknown>>(
    () =>
      safeParseJson<Record<string, unknown>>(props.defaults.editorStateJson) ?? {
        version: 1,
        slides: props.slides
      }
  );
  const [elementLocks, setElementLocks] = React.useState<
    Record<string, Record<string, boolean>>
  >(() => {
    const parsed = safeParseJson<Record<string, unknown>>(props.defaults.elementLocksJson);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as unknown as Record<string, Record<string, boolean>>;
  });
  const historyRef = React.useRef<
    Map<number, { past: string[]; future: string[]; lastPushedAt: number }>
  >(new Map());

  React.useEffect(() => {
    setDirty(false);
    setSelectedSlideIndex((current) =>
      clampInt(current, 1, Math.max(1, props.slideCount))
    );
    setSelectedObjectIds([]);
  }, [props.slideCount]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLeftOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }

      const api = canvasApiRef.current;
      if (!api) return;

      const isMeta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Add text
      if (!isMeta && key === "t") {
        if (api.addText()) e.preventDefault();
        return;
      }

      // Delete selected object(s)
      if (!isMeta && (e.key === "Backspace" || e.key === "Delete")) {
        if (api.deleteSelection()) e.preventDefault();
        return;
      }

      // Copy / Paste / Duplicate
      if (isMeta && key === "c") {
        if (api.copySelection()) e.preventDefault();
        return;
      }
      if (isMeta && key === "v") {
        if (api.paste()) e.preventDefault();
        return;
      }
      if (isMeta && key === "d") {
        if (api.duplicateSelection()) e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const slidesFromState = Array.isArray(editorState.slides)
    ? (editorState.slides as SlideLike[])
    : props.slides;
  const generatedAssets = React.useMemo(
    () => [...extraGeneratedAssets, ...props.assets.generated],
    [extraGeneratedAssets, props.assets.generated]
  );
  const assetUrlsById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of [...generatedAssets, ...props.assets.reference]) {
      if (typeof a.id !== "string") continue;
      if (typeof a.signedUrl !== "string" || !a.signedUrl) continue;
      map[a.id] = a.signedUrl;
    }
    return map;
  }, [generatedAssets, props.assets.reference]);
  const selectedSlide =
    slidesFromState.length > 0 ? slidesFromState[selectedSlideIndex - 1] : null;

  const currentSlideKey = React.useMemo(() => {
    const rawId =
      selectedSlide && typeof selectedSlide === "object"
        ? (selectedSlide as Record<string, unknown>).id
        : null;
    return typeof rawId === "string" && rawId.trim().length > 0
      ? rawId
      : `slide_${selectedSlideIndex}`;
  }, [selectedSlide, selectedSlideIndex]);
  const editorStateJson = React.useMemo(
    () => JSON.stringify(editorState, null, 2),
    [editorState]
  );
  const elementLocksJson = React.useMemo(
    () => JSON.stringify(elementLocks ?? {}, null, 2),
    [elementLocks]
  );

  const currentGlobal = React.useMemo(() => {
    const g =
      editorState.global && typeof editorState.global === "object"
        ? (editorState.global as Record<string, unknown>)
        : {};
    return g;
  }, [editorState.global]);

  const templateOptions = React.useMemo(() => {
    const fromDb: TemplateDataV1[] = props.templates
      .map((t) => t.template_data)
      .filter(isTemplateDataV1);
    const byId = new Map<string, TemplateDataV1>();
    for (const t of [...fromDb, ...BUILTIN_TEMPLATES]) byId.set(t.id, t);
    return Array.from(byId.values());
  }, [props.templates]);

  const selectedTemplateId =
    typeof currentGlobal.templateId === "string"
      ? currentGlobal.templateId
      : (() => {
          const embedded = currentGlobal.templateData;
          if (isTemplateDataV1(embedded)) return embedded.id;
          return BUILTIN_TEMPLATES[0]?.id ?? "builtin/background-overlay";
        })();

  const effectiveTemplate = React.useMemo(() => {
    const embedded = currentGlobal.templateData;
    if (isTemplateDataV1(embedded)) return embedded;
    const found = templateOptions.find((t) => t.id === selectedTemplateId);
    return found ?? BUILTIN_TEMPLATES[0]!;
  }, [currentGlobal.templateData, selectedTemplateId, templateOptions]);

  const globalTypography = React.useMemo(() => {
    const fromGlobal = parseTypographyV1((currentGlobal as Record<string, unknown>).typography);
    if (fromGlobal) return fromGlobal;
    const baseFont = effectiveTemplate.defaults.typography.fontFamily;
    return {
      titleFontFamily: baseFont,
      bodyFontFamily: baseFont,
      titleSize: effectiveTemplate.defaults.typography.titleSize,
      bodySize: effectiveTemplate.defaults.typography.bodySize,
      taglineSize: effectiveTemplate.defaults.typography.taglineSize,
      ctaSize: effectiveTemplate.defaults.typography.ctaSize,
      titleLineHeight: effectiveTemplate.defaults.typography.lineHeightTight,
      bodyLineHeight: effectiveTemplate.defaults.typography.lineHeightNormal,
      taglineLineHeight: effectiveTemplate.defaults.typography.lineHeightNormal,
      ctaLineHeight: effectiveTemplate.defaults.typography.lineHeightNormal,
      titleSpacing: 0,
      bodySpacing: 0,
      taglineSpacing: 0,
      ctaSpacing: 0
    } satisfies TypographyV1;
  }, [currentGlobal, effectiveTemplate.defaults.typography]);

  const matchedFontPairId = React.useMemo(() => {
    const found = FONT_PAIRS.find(
      (p) =>
        p.titleFont === globalTypography.titleFontFamily &&
        p.bodyFont === globalTypography.bodyFontFamily
    );
    return found?.id ?? FONT_PAIRS[0]?.id ?? "inter-inter";
  }, [globalTypography.bodyFontFamily, globalTypography.titleFontFamily]);

  const [customPairingEnabled, setCustomPairingEnabled] = React.useState(false);
  const [customSizesEnabled, setCustomSizesEnabled] = React.useState(false);
  const [fontPairId, setFontPairId] = React.useState(matchedFontPairId);

  React.useEffect(() => {
    setFontPairId(matchedFontPairId);
  }, [matchedFontPairId]);

  const baseTypography = React.useMemo(() => {
    const baseFont = effectiveTemplate.defaults.typography.fontFamily;
    const title = effectiveTemplate.defaults.typography.titleSize;
    const body = effectiveTemplate.defaults.typography.bodySize;
    const cta =
      effectiveTemplate.defaults.typography.ctaSize ?? Math.max(14, Math.round(body * 0.82));
    const tagline =
      effectiveTemplate.defaults.typography.taglineSize ?? Math.max(14, Math.round(body * 0.6));
    return {
      baseFont,
      title,
      body,
      cta,
      tagline,
      lineHeightTight: effectiveTemplate.defaults.typography.lineHeightTight,
      lineHeightNormal: effectiveTemplate.defaults.typography.lineHeightNormal
    };
  }, [effectiveTemplate.defaults.typography]);

  const globalOverlay = React.useMemo((): OverlayV1 => {
    const g = (currentGlobal as Record<string, unknown>).background;
    const bg = g && typeof g === "object" ? (g as Record<string, unknown>) : {};
    const hasOverlay = Boolean(bg.overlay);
    const ov =
      bg.overlay && typeof bg.overlay === "object"
        ? (bg.overlay as Record<string, unknown>)
        : {};

    const templateOv = effectiveTemplate.defaults.background.overlay;
    const fallbackEnabled =
      templateOv && typeof templateOv.enabled === "boolean" ? templateOv.enabled : false;
    const fallbackOpacity =
      templateOv && typeof templateOv.opacity === "number" && Number.isFinite(templateOv.opacity)
        ? clampNumberRange(templateOv.opacity, 0, 0.95)
        : 0.35;
    const fallbackColor =
      templateOv && typeof templateOv.color === "string" ? templateOv.color : "#000000";

    const enabled = hasOverlay ? Boolean(ov.enabled) : fallbackEnabled;
    const opacity =
      typeof ov.opacity === "number" && Number.isFinite(ov.opacity)
        ? clampNumberRange(ov.opacity, 0, 0.95)
        : fallbackOpacity;
    const color = typeof ov.color === "string" ? ov.color : fallbackColor;
    return { enabled, opacity, color };
  }, [currentGlobal, effectiveTemplate.defaults.background.overlay]);

  const [paletteOptions, setPaletteOptions] = React.useState<PaletteOption[]>(() =>
    parsePaletteOptionsFromProps(props.palettes)
  );

  React.useEffect(() => {
    const incoming = parsePaletteOptionsFromProps(props.palettes);
    setPaletteOptions((prev) => {
      const prevById = new Map(prev.map((p) => [p.id, p]));
      const merged = incoming.map((p) => prevById.get(p.id) ?? p);
      const incomingIds = new Set(incoming.map((p) => p.id));
      // Preserve optimistic palettes (created/renamed/deleted locally) until refresh.
      for (const p of prev) if (!incomingIds.has(p.id)) merged.push(p);
      return merged;
    });
  }, [props.palettes]);

  const userPaletteOptions = React.useMemo(() => {
    return paletteOptions.filter((p) => !p.is_global);
  }, [paletteOptions]);

  const globalPaletteOptions = React.useMemo(() => {
    return paletteOptions
      .filter((p) => p.is_global)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [paletteOptions]);

  const selectedPaletteId =
    typeof currentGlobal.paletteId === "string" &&
    paletteOptions.some((p) => p.id === currentGlobal.paletteId)
      ? currentGlobal.paletteId
      : globalPaletteOptions[0]?.id ?? userPaletteOptions[0]?.id ?? null;

  const [pendingTemplateId, setPendingTemplateId] = React.useState(selectedTemplateId);
  const [pendingPaletteId, setPendingPaletteId] = React.useState<string | null>(
    selectedPaletteId
  );

  React.useEffect(() => {
    setPendingTemplateId(selectedTemplateId);
  }, [selectedTemplateId]);

  React.useEffect(() => {
    setPendingPaletteId(selectedPaletteId);
  }, [selectedPaletteId]);

  const applyTemplate = React.useCallback(
    (template: TemplateDataV1) => {
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];

        const templateOverlay: OverlayV1 = {
          enabled: Boolean(template.defaults.background.overlay?.enabled),
          opacity:
            typeof template.defaults.background.overlay?.opacity === "number" &&
            Number.isFinite(template.defaults.background.overlay.opacity)
              ? clampNumberRange(template.defaults.background.overlay.opacity, 0, 0.95)
              : 0.35,
          color:
            typeof template.defaults.background.overlay?.color === "string"
              ? template.defaults.background.overlay.color
              : "#000000"
        };

        const nextSlides = prevSlides.map((s) => {
          if (!s || typeof s !== "object") return s;
          const slideObj = s as Record<string, unknown>;
          const w =
            typeof slideObj.width === "number" ? (slideObj.width as number) : 1080;
          const h =
            typeof slideObj.height === "number" ? (slideObj.height as number) : 1080;
          const objects = Array.isArray(slideObj.objects)
            ? ([...(slideObj.objects as unknown[])] as Record<string, unknown>[])
            : [];

          const zoneForId: Record<string, Rect01 | undefined> = {
            title: template.zones.title,
            body: template.zones.body,
            cta: template.zones.cta,
            tagline: template.zones.tagline
          };

          const sizeForId: Record<string, number | undefined> = {
            title: template.defaults.typography.titleSize,
            body: template.defaults.typography.bodySize,
            cta: template.defaults.typography.ctaSize,
            tagline: template.defaults.typography.taglineSize
          };

          const nextObjects = objects.map((o) => {
            const id = typeof o.id === "string" ? o.id : null;
            if (!id) return o;
            const zone = zoneForId[id];
            if (!zone) return o;
            const rect = rectToPx(zone, w, h);
            return {
              ...o,
              x: rect.x,
              y: rect.y,
              width: rect.w,
              height: rect.h,
              fontFamily: template.defaults.typography.fontFamily,
              fontSize: sizeForId[id] ?? o.fontSize
            };
          });

          // Ensure image slot placeholders exist in the editor_state.
          const existingSlotIds = new Set(
            objects
              .map((o) => (typeof (o as Record<string, unknown>).slotId === "string"
                ? String((o as Record<string, unknown>).slotId)
                : null))
              .filter((v): v is string => Boolean(v))
          );
          const placeholders = template.images
            .filter((img) => img.kind === "slot")
            .filter((img) => !existingSlotIds.has(img.id))
            .map((img) => {
              const rect = rectToPx(img.bounds, w, h);
              return {
                id: `image_${img.id}`,
                type: "image",
                slotId: img.id,
                x: rect.x,
                y: rect.y,
                width: rect.w,
                height: rect.h,
                assetId: null
              } as Record<string, unknown>;
            });

          const background =
            slideObj.background && typeof slideObj.background === "object"
              ? ({ ...(slideObj.background as Record<string, unknown>) } as Record<
                  string,
                  unknown
                >)
              : {};
          background.overlay = templateOverlay;
          return {
            ...slideObj,
            background,
            objects: [...nextObjects, ...placeholders]
          };
        });

        const prevGlobal =
          prev.global && typeof prev.global === "object"
            ? (prev.global as Record<string, unknown>)
            : {};
        const nextTypography: TypographyV1 = {
          titleFontFamily: template.defaults.typography.fontFamily,
          bodyFontFamily: template.defaults.typography.fontFamily,
          titleSize: template.defaults.typography.titleSize,
          bodySize: template.defaults.typography.bodySize,
          taglineSize: template.defaults.typography.taglineSize,
          ctaSize: template.defaults.typography.ctaSize
        };
        const globalBg =
          prevGlobal.background && typeof prevGlobal.background === "object"
            ? ({ ...(prevGlobal.background as Record<string, unknown>) } as Record<
                string,
                unknown
              >)
            : {};
        globalBg.overlay = templateOverlay;
        const nextGlobal = {
          ...prevGlobal,
          templateId: template.id,
          templateData: template,
          typography: nextTypography,
          background: globalBg
        };
        return { ...prev, global: nextGlobal, slides: nextSlides };
      });
      setDirty(true);
      setCanvasRevision((v) => v + 1);
    },
    [props.slides]
  );

  const applyPaletteColors = React.useCallback(
    (palette: PaletteV1, paletteId: string | null) => {
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];

        const nextSlides = prevSlides.map((s) => {
          if (!s || typeof s !== "object") return s;
          const slideObj = s as Record<string, unknown>;
          const objects = Array.isArray(slideObj.objects)
            ? ([...(slideObj.objects as unknown[])] as Record<string, unknown>[])
            : [];
          const nextObjects = objects.map((o) => {
            if (o.type !== "text") return o;
            const id = typeof o.id === "string" ? o.id : null;
            const variant =
              typeof (o as Record<string, unknown>).variant === "string"
                ? String((o as Record<string, unknown>).variant)
                : null;
            const key = id === "swipe" ? "body" : (variant ?? id ?? "body");
            const fill = key === "title" ? palette.accent : palette.text;
            return { ...o, fill };
          });
          const background =
            slideObj.background && typeof slideObj.background === "object"
              ? ({ ...(slideObj.background as Record<string, unknown>) } as Record<
                  string,
                  unknown
                >)
              : {};
          background.color = palette.background;
          return { ...slideObj, background, objects: nextObjects };
        });

        const prevGlobal =
          prev.global && typeof prev.global === "object"
            ? (prev.global as Record<string, unknown>)
            : {};
        const nextGlobal = {
          ...prevGlobal,
          paletteId,
          paletteData: palette
        };

        return { ...prev, global: nextGlobal, slides: nextSlides };
      });
      setDirty(true);
      setCanvasRevision((v) => v + 1);
    },
    [props.slides]
  );

  const applyTypography = React.useCallback(
    (typography: TypographyV1) => {
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];

        const nextSlides = prevSlides.map((s) => {
          if (!s || typeof s !== "object") return s;
          const slideObj = s as Record<string, unknown>;
          const objects = Array.isArray(slideObj.objects)
            ? ([...(slideObj.objects as unknown[])] as Record<string, unknown>[])
            : [];
          const nextObjects = objects.map((o) => {
            if (o.type !== "text") return o;
            const id = typeof o.id === "string" ? o.id : null;
            const variant = typeof (o as Record<string, unknown>).variant === "string"
              ? String((o as Record<string, unknown>).variant)
              : null;
            const key = id === "swipe" ? "body" : (variant ?? id ?? "body");
            const nextFontSize =
              key === "title"
                ? typography.titleSize
                : key === "body"
                  ? typography.bodySize
                  : key === "cta" && typeof typography.ctaSize === "number"
                    ? typography.ctaSize
                    : key === "tagline" && typeof typography.taglineSize === "number"
                      ? typography.taglineSize
                      : (o.fontSize as unknown as number | undefined);
            const nextFontFamily =
              key === "title"
                ? typography.titleFontFamily
                : key === "body"
                  ? typography.bodyFontFamily
                  : key === "cta"
                    ? typography.ctaFontFamily ?? typography.bodyFontFamily
                    : key === "tagline"
                      ? typography.taglineFontFamily ?? typography.bodyFontFamily
                      : typography.bodyFontFamily;

            const nextLineHeight =
              key === "title"
                ? typography.titleLineHeight
                : key === "body"
                  ? typography.bodyLineHeight
                  : key === "cta"
                    ? typography.ctaLineHeight
                    : key === "tagline"
                      ? typography.taglineLineHeight
                      : undefined;
            const nextSpacing =
              key === "title"
                ? typography.titleSpacing
                : key === "body"
                  ? typography.bodySpacing
                  : key === "cta"
                    ? typography.ctaSpacing
                    : key === "tagline"
                      ? typography.taglineSpacing
                      : undefined;
            return {
              ...o,
              fontFamily: nextFontFamily,
              ...(typeof nextFontSize === "number"
                ? { fontSize: nextFontSize }
                : null)
              ,
              ...(typeof nextLineHeight === "number" ? { lineHeight: nextLineHeight } : null),
              ...(typeof nextSpacing === "number" ? { letterSpacing: nextSpacing } : null)
            };
          });
          return { ...slideObj, objects: nextObjects };
        });

        const prevGlobal =
          prev.global && typeof prev.global === "object"
            ? (prev.global as Record<string, unknown>)
            : {};
        const nextGlobal = {
          ...prevGlobal,
          typography
        };

        return { ...prev, global: nextGlobal, slides: nextSlides };
      });
      setDirty(true);
      setCanvasRevision((v) => v + 1);
    },
    [props.slides]
  );

  const applyOverlay = React.useCallback(
    (overlay: OverlayV1) => {
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];

        const nextSlides = prevSlides.map((s) => {
          if (!s || typeof s !== "object") return s;
          const slideObj = s as Record<string, unknown>;
          const background =
            slideObj.background && typeof slideObj.background === "object"
              ? ({ ...(slideObj.background as Record<string, unknown>) } as Record<
                  string,
                  unknown
                >)
              : {};
          background.overlay = overlay;
          return { ...slideObj, background };
        });

        const prevGlobal =
          prev.global && typeof prev.global === "object"
            ? (prev.global as Record<string, unknown>)
            : {};
        const globalBg =
          prevGlobal.background && typeof prevGlobal.background === "object"
            ? ({ ...(prevGlobal.background as Record<string, unknown>) } as Record<
                string,
                unknown
              >)
            : {};
        globalBg.overlay = overlay;

        const nextGlobal = {
          ...prevGlobal,
          background: globalBg
        };

        return { ...prev, global: nextGlobal, slides: nextSlides };
      });
      setDirty(true);
      setCanvasRevision((v) => v + 1);
    },
    [props.slides]
  );

  const [customPalette, setCustomPalette] = React.useState<PaletteV1>(() => {
    const fromGlobal = parsePaletteV1(currentGlobal.paletteData);
    return (
      fromGlobal ?? {
        background: "#ffffff",
        text: "#111827",
        accent: "#7c3aed"
      }
    );
  });

  const appliedPalette = React.useMemo(() => {
    return parsePaletteV1((currentGlobal as Record<string, unknown>).paletteData) ?? customPalette;
  }, [currentGlobal, customPalette]);

  React.useEffect(() => {
    const fromGlobal = parsePaletteV1(currentGlobal.paletteData);
    if (fromGlobal) setCustomPalette(fromGlobal);
  }, [currentGlobal.paletteData]);

  const saveCustomPalette = React.useCallback(async () => {
    const name = `Custom ${new Date().toLocaleDateString("pt-BR")}`;
    const result = await studioCreatePalette({
      name,
      paletteData: customPalette as unknown as Record<string, unknown>
    });
    if (!result.ok) {
      setSaveError("Não foi possível salvar a paleta.");
      return null;
    }
    const created: PaletteOption = {
      id: result.id,
      name,
      is_global: false,
      palette_data: customPalette as unknown as Record<string, unknown>,
      palette: customPalette
    };
    setPaletteOptions((prev) => {
      // Put custom palettes first.
      const next = prev.filter((p) => p.id !== created.id);
      return [created, ...next];
    });
    return result.id;
  }, [customPalette]);

  const deletePalette = React.useCallback(
    async (id: string) => {
      const current = paletteOptions.find((p) => p.id === id);
      if (!current || current.is_global) return;
      const ok = window.confirm("Excluir esta paleta? Essa ação não pode ser desfeita.");
      if (!ok) return;
      const result = await studioDeletePalette({ id });
      if (!result.ok) {
        setSaveError("Não foi possível excluir a paleta.");
        return;
      }
      setPaletteOptions((prev) => prev.filter((p) => p.id !== id));
      if (pendingPaletteId === id) {
        // Keep the currently applied colors, but detach from the deleted id.
        setPendingPaletteId(null);
        applyPaletteColors(customPalette, null);
      }
    },
    [applyPaletteColors, customPalette, paletteOptions, pendingPaletteId]
  );

  const imagesTotal = props.progress.imagesTotal;
  const imagesDone = props.progress.imagesDone;
  const imagesFailed = props.progress.imagesFailed;

  const progressPct =
    typeof imagesTotal === "number" &&
    imagesTotal > 0 &&
    typeof imagesDone === "number"
      ? Math.min(100, Math.max(0, (imagesDone / imagesTotal) * 100))
      : null;

  const saveNow = React.useCallback(() => {
    if (!dirty || isPending) return;
    setSaveError(null);
    startTransition(() => {
      studioSaveEditorStateInline({
        carouselId: props.carouselId,
        editorStateJson
      })
        .then((result) => {
          if (!result.ok) {
            setSaveError(result.error);
            return;
          }
          setDirty(false);
          setLastSavedAt(result.updatedAt ?? new Date().toISOString());
        })
        .catch(() => {
          setSaveError("Erro ao salvar. Tente novamente.");
        });
    });
  }, [dirty, editorStateJson, isPending, props.carouselId, startTransition]);

  const saveLocksNow = React.useCallback(() => {
    if (!locksDirty || isPending) return;
    setSaveError(null);
    const elementLocksJson = JSON.stringify(elementLocks ?? {}, null, 2);
    startTransition(() => {
      studioSaveLocksInline({
        carouselId: props.carouselId,
        elementLocksJson
      })
        .then((result) => {
          if (!result.ok) {
            setSaveError(result.error);
            return;
          }
          setLocksDirty(false);
        })
        .catch(() => {
          setSaveError("Erro ao salvar locks. Tente novamente.");
        });
    });
  }, [elementLocks, isPending, locksDirty, props.carouselId, startTransition]);

  React.useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      saveNow();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [dirty, editorStateJson, saveNow]);

  React.useEffect(() => {
    if (!locksDirty) return;
    const t = window.setTimeout(() => {
      saveLocksNow();
    }, 800);
    return () => window.clearTimeout(t);
  }, [locksDirty, elementLocks, saveLocksNow]);

  function isLocked(objectId: string) {
    const bySlide = elementLocks?.[currentSlideKey];
    return Boolean(bySlide && bySlide[objectId]);
  }

  const toggleLocksForSelection = React.useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const allLocked = selectedObjectIds.every((id) => isLocked(id));
    setElementLocks((prev) => {
      const next: Record<string, Record<string, boolean>> = { ...(prev ?? {}) };
      const slideLocks: Record<string, boolean> = { ...(next[currentSlideKey] ?? {}) };
      for (const id of selectedObjectIds) {
        if (allLocked) delete slideLocks[id];
        else slideLocks[id] = true;
      }
      if (Object.keys(slideLocks).length === 0) delete next[currentSlideKey];
      else next[currentSlideKey] = slideLocks;
      return next;
    });
    setLocksDirty(true);
  }, [currentSlideKey, selectedObjectIds]);

  function getHistoryEntry(index: number) {
    const current = historyRef.current.get(index);
    if (current) return current;
    const created = { past: [] as string[], future: [] as string[], lastPushedAt: 0 };
    historyRef.current.set(index, created);
    return created;
  }

  function applySlideSnapshot(index: number, snapshotJson: string) {
    const parsed = safeParseJson<SlideLike>(snapshotJson);
    if (!parsed) return;
    setEditorState((prev) => {
      const prevSlides = Array.isArray(prev.slides)
        ? ([...(prev.slides as SlideLike[])] as SlideLike[])
        : [...props.slides];
      if (index - 1 >= 0 && index - 1 < prevSlides.length) {
        prevSlides[index - 1] = parsed;
      }
      return { ...prev, slides: prevSlides };
    });
    setDirty(true);
    setCanvasRevision((v) => v + 1);
  }

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;
      if (e.key.toLowerCase() !== "z") return;

      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }

      const entry = getHistoryEntry(selectedSlideIndex);
      if (!entry) return;

      if (e.shiftKey) {
        const next = entry.future.pop();
        if (!next) return;
        const currentSnapshot = JSON.stringify(selectedSlide ?? {}, null, 0);
        entry.past.push(currentSnapshot);
        applySlideSnapshot(selectedSlideIndex, next);
        e.preventDefault();
        return;
      }

      const prev = entry.past.pop();
      if (!prev) return;
      const currentSnapshot = JSON.stringify(selectedSlide ?? {}, null, 0);
      entry.future.push(currentSnapshot);
      applySlideSnapshot(selectedSlideIndex, prev);
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applySlideSnapshot, selectedSlide, selectedSlideIndex]);

  function openLeft(dock: DockItem) {
    setActiveDock(dock);
    setLeftOpen(true);
  }

  function toggleLeft(dock: DockItem) {
    if (!leftOpen) {
      openLeft(dock);
      return;
    }
    if (activeDock === dock) {
      setLeftOpen(false);
      return;
    }
    openLeft(dock);
  }

  const showGenerate =
    activeDock === "generate" || activeDock === "nav" || activeDock === "command";
  const showSlide = activeDock === "slide";
  const showAssets = activeDock === "assets";
  const showBrand = activeDock === "brand";
  const showColors = activeDock === "colors";
  const showText = activeDock === "text";
  const showTemplates = activeDock === "templates";
  const showPresets = activeDock === "presets";
  const showLocks = activeDock === "locks";
  const showJson = activeDock === "json";

  const generateAction = studioGenerate;
  const editInlineAction = studioEditInline;
  const saveEditorStateAction = studioSaveEditorState;

  const leftShiftPx = leftOpen ? 220 : 0;
  const hasBackgroundImageZone = React.useMemo(
    () => effectiveTemplate.images.some((img) => img.kind === "background"),
    [effectiveTemplate.images]
  );
  const backgroundImageSlotId = React.useMemo(() => {
    const bg = effectiveTemplate.images.find((img) => img.kind === "background");
    return bg ? bg.id : null;
  }, [effectiveTemplate.images]);

  const canvasSlide: SlideV1 = React.useMemo(() => {
    const s = selectedSlide;
    if (!s || typeof s !== "object") return { width: 1080, height: 1080, objects: [] };
    const width =
      typeof (s as Record<string, unknown>).width === "number"
        ? ((s as Record<string, unknown>).width as number)
        : 1080;
    const height =
      typeof (s as Record<string, unknown>).height === "number"
        ? ((s as Record<string, unknown>).height as number)
        : 1080;
    const objectsRaw = Array.isArray((s as Record<string, unknown>).objects)
      ? ((s as Record<string, unknown>).objects as unknown[])
      : [];
    const objects = objectsRaw.filter((o) => o && typeof o === "object") as unknown as SlideV1["objects"];
    const background =
      (s as Record<string, unknown>).background &&
      typeof (s as Record<string, unknown>).background === "object"
        ? ((s as Record<string, unknown>).background as SlideV1["background"])
        : null;
    return { ...(s as unknown as SlideV1), width, height, objects, background };
  }, [selectedSlide]);

  const missingImageSlots = React.useMemo(() => {
    const objects = canvasSlide.objects ?? [];
    const filled = new Set<string>();
    for (const o of objects as unknown as Array<Record<string, unknown>>) {
      if (o.type !== "image") continue;
      const slotId = typeof o.slotId === "string" ? o.slotId : null;
      const assetId = typeof o.assetId === "string" ? o.assetId : null;
      if (slotId && assetId) filled.add(slotId);
    }
    return (effectiveTemplate.images ?? [])
      .filter((img) => img.kind === "slot")
      .filter((img) => !filled.has(img.id))
      .map((img) => ({ id: img.id, bounds: img.bounds }));
  }, [canvasSlide.objects, effectiveTemplate.images]);

  const lockedBadges = React.useMemo(() => {
    const slideLocks = elementLocks?.[currentSlideKey] ?? {};
    const ids = Object.entries(slideLocks)
      .filter(([, v]) => Boolean(v))
      .map(([id]) => id);
    if (ids.length === 0) return [];
    const w = canvasSlide.width || 1080;
    const h = canvasSlide.height || 1080;
    const objects = (canvasSlide.objects ?? []) as unknown as Array<Record<string, unknown>>;
    return ids
      .map((id) => {
        const obj = objects.find((o) => o && o.id === id);
        if (!obj) return null;
        const x = typeof obj.x === "number" ? obj.x : null;
        const y = typeof obj.y === "number" ? obj.y : null;
        const width = typeof obj.width === "number" ? obj.width : null;
        if (x == null || y == null || width == null) return null;
        const px = Math.min(1, Math.max(0, (x + width) / w));
        const py = Math.min(1, Math.max(0, y / h));
        return { id, leftPct: px * 100, topPct: py * 100 };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));
  }, [canvasSlide.height, canvasSlide.objects, canvasSlide.width, currentSlideKey, elementLocks]);

  const assignAssetToSpecificSlot = React.useCallback(
    (slideIndex: number, slotId: string, assetId: string) => {
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];

        const idx = slideIndex - 1;
        const slide = idx >= 0 && idx < prevSlides.length ? prevSlides[idx] : null;
        if (!slide || typeof slide !== "object") return prev;

        // Undo support: snapshot current slide before mutation.
        const entry = getHistoryEntry(slideIndex);
        const snapshot = JSON.stringify(slide);
        const last = entry.past.length > 0 ? entry.past[entry.past.length - 1] : null;
        if (snapshot !== last) entry.past.push(snapshot);
        entry.future = [];
        entry.lastPushedAt = Date.now();

        const slideObj = slide as Record<string, unknown>;
        const w = typeof slideObj.width === "number" ? (slideObj.width as number) : 1080;
        const h =
          typeof slideObj.height === "number" ? (slideObj.height as number) : 1080;
        const objects = Array.isArray(slideObj.objects)
          ? ([...(slideObj.objects as unknown[])] as Record<string, unknown>[])
          : [];

        let didSet = false;
        const nextObjects = objects.map((o) => {
          if (o.type !== "image") return o;
          const oSlot = typeof o.slotId === "string" ? o.slotId : null;
          if (oSlot !== slotId && o.id !== slotId && o.id !== `image_${slotId}`) return o;
          didSet = true;
          return { ...o, assetId };
        });

        if (!didSet) {
          const def = effectiveTemplate.images.find((img) => img.id === slotId);
          if (def) {
            const rect =
              def.kind === "background"
                ? { x: 0, y: 0, w, h }
                : rectToPx(def.bounds, w, h);
            nextObjects.push({
              id: `image_${slotId}`,
              type: "image",
              slotId,
              x: rect.x,
              y: rect.y,
              width: rect.w,
              height: rect.h,
              assetId
            });
          }
        }

        const nextSlide = { ...slideObj, objects: nextObjects };
        prevSlides[idx] = nextSlide;
        return { ...prev, slides: prevSlides };
      });
      setDirty(true);
      setCanvasRevision((v) => v + 1);
    },
    [effectiveTemplate.images, props.slides]
  );

  const assignAssetToSlot = React.useCallback(
    (assetId: string) => {
      if (!slotPicker) return;
      const { slideIndex, slotId } = slotPicker;
      assignAssetToSpecificSlot(slideIndex, slotId, assetId);
      setSlotPicker(null);
    },
    [assignAssetToSpecificSlot, slotPicker]
  );

  const insertAssetIntoSlide = React.useCallback(
    (assetId: string) => {
      const slideIndex = selectedSlideIndex;
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];

        const idx = slideIndex - 1;
        const slide = idx >= 0 && idx < prevSlides.length ? prevSlides[idx] : null;
        if (!slide || typeof slide !== "object") return prev;

        const entry = getHistoryEntry(slideIndex);
        const snapshot = JSON.stringify(slide);
        const last = entry.past.length > 0 ? entry.past[entry.past.length - 1] : null;
        if (snapshot !== last) entry.past.push(snapshot);
        entry.future = [];
        entry.lastPushedAt = Date.now();

        const slideObj = slide as Record<string, unknown>;
        const w = typeof slideObj.width === "number" ? (slideObj.width as number) : 1080;
        const h =
          typeof slideObj.height === "number" ? (slideObj.height as number) : 1080;
        const objects = Array.isArray(slideObj.objects)
          ? ([...(slideObj.objects as unknown[])] as Record<string, unknown>[])
          : [];

        const size = Math.round(Math.min(w, h) * 0.42);
        const x = Math.round((w - size) / 2);
        const y = Math.round((h - size) / 2);

        const nextObjects = [
          ...objects,
          {
            id: createStudioId("image"),
            type: "image",
            x,
            y,
            width: size,
            height: size,
            assetId
          }
        ];

        const nextSlide = { ...slideObj, objects: nextObjects };
        prevSlides[idx] = nextSlide;
        return { ...prev, slides: prevSlides };
      });

      setDirty(true);
      setCanvasRevision((v) => v + 1);
    },
    [props.slides, selectedSlideIndex]
  );

  const toggleBackgroundImageVisibility = React.useCallback(
    (slideIndex: number, visible: boolean) => {
      if (!backgroundImageSlotId) return;
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];

        const idx = slideIndex - 1;
        const slide = idx >= 0 && idx < prevSlides.length ? prevSlides[idx] : null;
        if (!slide || typeof slide !== "object") return prev;

        const entry = getHistoryEntry(slideIndex);
        const snapshot = JSON.stringify(slide);
        const last = entry.past.length > 0 ? entry.past[entry.past.length - 1] : null;
        if (snapshot !== last) entry.past.push(snapshot);
        entry.future = [];
        entry.lastPushedAt = Date.now();

        const slideObj = slide as Record<string, unknown>;
        const objects = Array.isArray(slideObj.objects)
          ? ([...(slideObj.objects as unknown[])] as Record<string, unknown>[])
          : [];
        const nextObjects = objects.map((o) => {
          if (o.type !== "image") return o;
          const id = typeof o.id === "string" ? o.id : null;
          const slotId = typeof o.slotId === "string" ? o.slotId : null;
          if (id !== backgroundImageSlotId && slotId !== backgroundImageSlotId) return o;
          return { ...o, hidden: !visible };
        });
        const nextSlide = { ...slideObj, objects: nextObjects };
        prevSlides[idx] = nextSlide;
        return { ...prev, slides: prevSlides };
      });
      setDirty(true);
      setCanvasRevision((v) => v + 1);
    },
    [backgroundImageSlotId, props.slides]
  );

  const toggleSlideElement = React.useCallback(
    (role: "title" | "body" | "tagline" | "cta" | "swipe", visible: boolean) => {
      const slideIndex = selectedSlideIndex;
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];
        const idx = slideIndex - 1;
        const slide = idx >= 0 && idx < prevSlides.length ? prevSlides[idx] : null;
        if (!slide || typeof slide !== "object") return prev;

        const entry = getHistoryEntry(slideIndex);
        const snapshot = JSON.stringify(slide);
        const last = entry.past.length > 0 ? entry.past[entry.past.length - 1] : null;
        if (snapshot !== last) entry.past.push(snapshot);
        entry.future = [];
        entry.lastPushedAt = Date.now();

        const slideObj = slide as Record<string, unknown>;
        const w = typeof slideObj.width === "number" ? (slideObj.width as number) : 1080;
        const h = typeof slideObj.height === "number" ? (slideObj.height as number) : 1080;
        const objects = Array.isArray(slideObj.objects)
          ? ([...(slideObj.objects as unknown[])] as Record<string, unknown>[])
          : [];

        const findMatch = (o: Record<string, unknown>) => {
          if (o.type !== "text") return false;
          const id = typeof o.id === "string" ? o.id : null;
          const variant =
            typeof (o as Record<string, unknown>).variant === "string"
              ? String((o as Record<string, unknown>).variant)
              : null;
          if (role === "swipe") return id === "swipe";
          return (variant ?? id) === role;
        };

        let found = false;
        const nextObjects = objects.map((o) => {
          if (!findMatch(o)) return o;
          found = true;
          return { ...o, hidden: !visible };
        });

        if (!found && visible) {
          let rect: { x: number; y: number; w: number; h: number } | null = null;
          if (role === "title") rect = rectToPx(effectiveTemplate.zones.title, w, h);
          else if (role === "body" && effectiveTemplate.zones.body)
            rect = rectToPx(effectiveTemplate.zones.body, w, h);
          else if (role === "cta" && effectiveTemplate.zones.cta)
            rect = rectToPx(effectiveTemplate.zones.cta, w, h);
          else if (role === "tagline" && effectiveTemplate.zones.tagline)
            rect = rectToPx(effectiveTemplate.zones.tagline, w, h);
          else if (role === "swipe" && effectiveTemplate.zones.swipe)
            rect = rectToPx(effectiveTemplate.zones.swipe, w, h);

          // Fallbacks: if the template doesn't define a zone, place the element near the title/body.
          if (!rect && role === "tagline") {
            const titleRect = rectToPx(effectiveTemplate.zones.title, w, h);
            rect = {
              x: titleRect.x,
              y: Math.max(0, titleRect.y - Math.round(titleRect.h * 0.6)),
              w: titleRect.w,
              h: Math.max(24, Math.round(titleRect.h * 0.35))
            };
          } else if (!rect && role === "cta" && effectiveTemplate.zones.body) {
            const bodyRect = rectToPx(effectiveTemplate.zones.body, w, h);
            rect = {
              x: bodyRect.x,
              y: Math.min(h - 48, bodyRect.y + bodyRect.h + Math.round(h * 0.04)),
              w: bodyRect.w,
              h: Math.max(28, Math.round(h * 0.08))
            };
          } else if (!rect && role === "swipe") {
            rect = {
              x: Math.round(w * 0.82),
              y: Math.round(h * 0.9),
              w: Math.max(120, Math.round(w * 0.12)),
              h: Math.max(42, Math.round(h * 0.06))
            };
          }

          if (rect) {
            const id = role;
            const isTitle = role === "title";
            const isBody = role === "body";
            const isCta = role === "cta";
            const isTagline = role === "tagline";
            const text =
              role === "swipe"
                ? "Arraste →"
                : isTitle
                  ? "Título"
                  : isBody
                    ? "Texto"
                    : isCta
                      ? "Chamada"
                      : isTagline
                        ? "Subtítulo"
                        : "Texto";
            nextObjects.push({
              id,
              type: "text",
              variant: role === "swipe" ? "custom" : role,
              x: rect.x,
              y: rect.y,
              width: rect.w,
              height: rect.h,
              text,
              fontFamily: isTitle
                ? globalTypography.titleFontFamily
                : globalTypography.bodyFontFamily,
              fontSize: isTitle
                ? globalTypography.titleSize
                : isBody
                  ? globalTypography.bodySize
                  : isCta
                    ? globalTypography.ctaSize ??
                      Math.max(14, Math.round(globalTypography.bodySize * 0.82))
                    : isTagline
                      ? globalTypography.taglineSize ??
                        Math.max(14, Math.round(globalTypography.bodySize * 0.6))
                      : 24,
              fill: isTitle ? appliedPalette.accent : appliedPalette.text,
              fontWeight: isTitle ? 700 : 600,
              lineHeight: isTitle
                ? globalTypography.titleLineHeight ?? 1.1
                : globalTypography.bodyLineHeight ?? 1.25,
              letterSpacing: isTitle
                ? globalTypography.titleSpacing ?? 0
                : globalTypography.bodySpacing ?? 0
            });
          }
        }

        const nextSlide = { ...slideObj, objects: nextObjects };
        prevSlides[idx] = nextSlide;
        return { ...prev, slides: prevSlides };
      });
      setDirty(true);
      setCanvasRevision((v) => v + 1);
    },
    [appliedPalette.accent, appliedPalette.text, effectiveTemplate.zones, globalTypography, props.slides, selectedSlideIndex]
  );

  const onCanvasSlideChange = React.useCallback(
    (nextSlide: SlideV1) => {
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];

        const idx = selectedSlideIndex - 1;
        const prevSlide = idx >= 0 && idx < prevSlides.length ? prevSlides[idx] : null;
        const entry = getHistoryEntry(selectedSlideIndex);
        const now = Date.now();
        if (prevSlide && now - entry.lastPushedAt > 600) {
          const snapshot = JSON.stringify(prevSlide);
          const last = entry.past.length > 0 ? entry.past[entry.past.length - 1] : null;
          if (snapshot !== last) entry.past.push(snapshot);
          entry.future = [];
          entry.lastPushedAt = now;
        }
        if (idx >= 0 && idx < prevSlides.length) {
          prevSlides[idx] = nextSlide as unknown as SlideLike;
        }
        return { ...prev, slides: prevSlides };
      });
      setDirty(true);
    },
    [props.slides, selectedSlideIndex]
  );

  const reorderSlides = React.useCallback(
    (from: number, to: number) => {
      if (!Number.isFinite(from) || !Number.isFinite(to)) return;
      if (from === to) return;

      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];
        if (prevSlides.length <= 1) return prev;

        const safeFrom = clampInt(from, 0, prevSlides.length - 1);
        const safeTo = clampInt(to, 0, prevSlides.length - 1);
        if (safeFrom === safeTo) return prev;

        const next = [...prevSlides];
        const [moved] = next.splice(safeFrom, 1);
        next.splice(safeTo, 0, moved);
        return { ...prev, slides: next };
      });

      setDirty(true);
      setCanvasRevision((v) => v + 1);

      setSelectedSlideIndex((current) => {
        const cur = current - 1;
        const safeFrom = clampInt(from, 0, props.slideCount - 1);
        const safeTo = clampInt(to, 0, props.slideCount - 1);
        if (cur === safeFrom) return safeTo + 1;
        if (safeFrom < safeTo) {
          if (cur > safeFrom && cur <= safeTo) return cur; // (cur-1)+1
          return current;
        }
        if (cur >= safeTo && cur < safeFrom) return cur + 2; // (cur+1)+1
        return current;
      });
    },
    [props.slideCount, props.slides]
  );

  const downloadActiveSlidePng = React.useCallback(() => {
    const api = canvasApiRef.current;
    if (!api) return;
    const dataUrl = api.exportPngDataUrl(1080);
    if (!dataUrl) {
      setSaveError("Não foi possível exportar o slide.");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `dojogram_${props.carouselId}_slide_${selectedSlideIndex}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [props.carouselId, selectedSlideIndex]);

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-screen w-screen overflow-x-hidden bg-muted/30">
      <div
        className={[
          "absolute inset-0 opacity-60",
          "bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.08)_1px,transparent_0)]",
          "bg-[size:18px_18px]",
          "dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.10)_1px,transparent_0)]"
        ].join(" ")}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1400px] px-4 py-5">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight">Studio</h1>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {props.statusLabel}
              </span>
            </div>
            <div className="hidden text-sm text-muted-foreground md:block">
              Canvas-first • painéis colapsáveis • estilo PostNitro
            </div>
          </div>
        </header>

        {props.flash.saved ||
        props.flash.locksSaved ||
        props.flash.edited ||
        props.flash.cleaned !== null ||
        props.flash.error ? (
          <div className="mt-4 space-y-2">
            {props.flash.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {props.flash.error}
              </div>
            ) : null}
            {props.flash.saved ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                Salvo.
              </div>
            ) : null}
            {props.flash.locksSaved ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                Locks salvos.
              </div>
            ) : null}
            {props.flash.cleaned !== null ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                Placeholders removidos: {props.flash.cleaned}.
              </div>
            ) : null}
            {props.flash.edited ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                Edição aplicada.{" "}
                {typeof props.flash.applied === "number"
                  ? `Alterações: ${props.flash.applied}. `
                  : null}
                {typeof props.flash.locked === "number"
                  ? `Bloqueados: ${props.flash.locked}. `
                  : null}
                {typeof props.flash.missing === "number"
                  ? `Ausentes: ${props.flash.missing}. `
                  : null}
                {props.flash.editSummary ? (
                  <span className="block pt-2 text-sm text-green-900/90">
                    {props.flash.editSummary}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <main className="relative mt-6">
          {/* Floating dock */}
          <div className="fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 md:block">
            <MotionDock className="border-border">
              <MotionDockItem
                active={false}
                label="Voltar ao projeto"
                onClick={() => router.push(`/app/carousels/${props.carouselId}`)}
              >
                <ArrowLeft className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={false}
                label="Carrosséis"
                onClick={() => router.push("/app")}
              >
                <LayoutGrid className="h-full w-full" />
              </MotionDockItem>

              <div className="my-1 h-px w-full bg-border" />

              <MotionDockItem
                active={leftOpen && activeDock === "generate"}
                label="IA"
                onClick={() => toggleLeft("generate")}
              >
                <Sparkles className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={leftOpen && activeDock === "slide"}
                label="Slide"
                onClick={() => toggleLeft("slide")}
              >
                <SlidersHorizontal className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={leftOpen && activeDock === "assets"}
                label="Assets"
                onClick={() => toggleLeft("assets")}
              >
                <ImageIcon className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={leftOpen && activeDock === "templates"}
                label="Templates"
                onClick={() => toggleLeft("templates")}
              >
                <LayoutTemplate className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={leftOpen && activeDock === "presets"}
                label="Presets"
                onClick={() => toggleLeft("presets")}
              >
                <Bookmark className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={leftOpen && activeDock === "brand"}
                label="Brand"
                onClick={() => toggleLeft("brand")}
              >
                <UserCircle2 className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={leftOpen && activeDock === "colors"}
                label="Cores"
                onClick={() => toggleLeft("colors")}
              >
                <Palette className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={leftOpen && activeDock === "text"}
                label="Texto"
                onClick={() => toggleLeft("text")}
              >
                <Type className="h-full w-full" />
              </MotionDockItem>

              <div className="my-1 h-px w-full bg-border" />

              <MotionDockItem
                active={leftOpen && activeDock === "locks"}
                label="Locks"
                onClick={() => toggleLeft("locks")}
              >
                <Lock className="h-full w-full" />
              </MotionDockItem>
              <MotionDockItem
                active={leftOpen && activeDock === "json"}
                label="Editor state"
                onClick={() => toggleLeft("json")}
              >
                <Code2 className="h-full w-full" />
              </MotionDockItem>
            </MotionDock>
          </div>

          {/* Left panel */}
          <AnimatePresence>
            {leftOpen ? (
              <aside className="fixed left-24 top-1/2 z-30 hidden w-[380px] -translate-y-1/2 md:block">
                <motion.div
                  initial={{ opacity: 0, x: -28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -28 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="max-h-[calc(100vh-9rem)] overflow-hidden rounded-3xl border border-border bg-background/90 shadow-lg backdrop-blur"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="text-base font-semibold">
                      {activeDock === "generate"
                        ? "Geração"
                        : activeDock === "slide"
                          ? "Slide"
                        : activeDock === "command"
                          ? "Edição por comando"
                          : activeDock === "assets"
                            ? "Assets"
                            : activeDock === "templates"
                              ? "Templates"
                              : activeDock === "presets"
                                ? "Presets"
                            : activeDock === "brand"
                              ? "Branding"
                            : activeDock === "colors"
                              ? "Cores"
                            : activeDock === "text"
                              ? "Texto"
                              : activeDock === "locks"
                                ? "Locks"
                                : activeDock === "json"
                                  ? "Editor state"
                                  : "Studio"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLeftOpen(false)}
                      className="rounded-xl p-2 hover:bg-secondary"
                      aria-label="Fechar painel"
                    >
                      <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="max-h-[calc(100vh-13rem)] overflow-auto p-4">
                    {showGenerate ? (
                      <div className="space-y-6">
                        <section className="space-y-3 rounded-2xl border border-border bg-background px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="text-base font-medium">
                              Geração (IA)
                            </div>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {props.statusLabel}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs text-muted-foreground">
                            {progressPct !== null ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span>Imagens</span>
                                  <span className="font-mono">
                                    {imagesDone ?? 0}/{imagesTotal ?? 0}
                                    {typeof imagesFailed === "number" &&
                                    imagesFailed > 0
                                      ? ` • falhas ${imagesFailed}`
                                      : ""}
                                  </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                Gere um rascunho para preencher os slides.
                              </div>
                            )}
                          </div>

                          <form action={generateAction} className="space-y-2">
                            <input
                              type="hidden"
                              name="carouselId"
                              value={props.carouselId}
                            />
                            <input
                              type="hidden"
                              name="currentSlide"
                              value={selectedSlideIndex}
                            />
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Modelo de imagem
                              </label>
                          <select
                            name="imageModel"
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            defaultValue=""
                          >
                            <option value="">Automático (padrão)</option>
                            {props.imageModels.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <div className="text-xs text-muted-foreground">
                            Se a imagem precisar conter texto, o sistema pode forçar o Pro.
                          </div>
                        </div>

                        <button
                          className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          type="submit"
                        >
                          Gerar rascunho
                        </button>
                      </form>

                      {props.placeholderCount > 0 ? (
                        <form action={studioCleanup}>
                          <input type="hidden" name="carouselId" value={props.carouselId} />
                          <input
                            type="hidden"
                            name="currentSlide"
                            value={selectedSlideIndex}
                          />
                          <button
                            className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                            type="submit"
                          >
                            Limpar placeholders ({props.placeholderCount})
                          </button>
                        </form>
                      ) : null}
                    </section>

                    <section className="space-y-3 rounded-2xl border bg-background px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-medium">Edição por comando</div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          IA
                        </span>
                      </div>

                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (isPending) return;
                          const instruction = editInstruction.trim();
                          if (instruction.length < 2) return;
                          const raw = editTarget.trim();
                          const slideIndex =
                            raw.length === 0 ? undefined : Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : undefined;

                          startTransition(async () => {
                            const res = await editInlineAction({
                              carouselId: props.carouselId,
                              instruction,
                              slideIndex
                            });

                            if (!res.ok) {
                              const message =
                                res.error === "UNAUTHENTICATED"
                                  ? "Você precisa entrar novamente."
                                  : String(res.error ?? "Falha ao aplicar edição.");
                              setSaveError(message);
                              return;
                            }

                            setSaveError(null);
                            setLastEdit({
                              applied: res.applied,
                              blockedByLock:
                                typeof (res as { blockedByLock?: unknown }).blockedByLock ===
                                "number"
                                  ? ((res as { blockedByLock: number }).blockedByLock as number)
                                  : res.skippedLocked,
                              ignored:
                                typeof (res as { skippedPolicy?: unknown }).skippedPolicy ===
                                "number"
                                  ? ((res as { skippedPolicy: number }).skippedPolicy as number)
                                  : 0,
                              missing: res.skippedMissing,
                              summary: res.summary ?? null
                            });
                            setEditorState(res.nextState as unknown as Record<string, unknown>);
                            setDirty(false);
                            setLastSavedAt(new Date().toISOString());
                            setCanvasRevision((v) => v + 1);
                            setEditInstruction("");

                            const newAssets = Array.isArray(res.newAssets) ? res.newAssets : [];
                            if (newAssets.length > 0) {
                              setExtraGeneratedAssets((prev) => {
                                const existing = new Set(prev.map((a) => a.id));
                                const next = [...prev];
                                for (const a of newAssets) {
                                  if (!a || typeof a !== "object") continue;
                                  const id =
                                    "id" in a && typeof (a as { id?: unknown }).id === "string"
                                      ? (a as { id: string }).id
                                      : null;
                                  const signedUrl =
                                    "signedUrl" in a &&
                                    typeof (a as { signedUrl?: unknown }).signedUrl === "string"
                                      ? (a as { signedUrl: string }).signedUrl
                                      : null;
                                  if (!id || existing.has(id)) continue;
                                  existing.add(id);
                                  next.push({ id, asset_type: "generated", signedUrl });
                                }
                                return next;
                              });
                            }
                          });
                        }}
                      >
                        <textarea
                          name="instruction"
                          className="h-24 w-full rounded-xl border bg-background p-3 text-sm"
                          placeholder='Ex: “Deixe o título mais forte e encurte o texto do corpo.”'
                          required
                          value={editInstruction}
                          onChange={(e) => setEditInstruction(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <select
                            name="slideIndex"
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            value={editTarget}
                            onChange={(e) => setEditTarget(e.target.value)}
                          >
                            {Array.from({ length: props.slideCount }, (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                Slide {i + 1}
                              </option>
                            ))}
                            <option value="">Todos</option>
                          </select>
                          <button
                            className="whitespace-nowrap rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
                            type="submit"
                          >
                            {isPending ? "Aplicando..." : "Aplicar"}
                          </button>
                        </div>
                      </form>

                      {lastEdit ? (
                        <div className="rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground">
                          <div>
                            Aplicado: <span className="font-medium text-foreground">{lastEdit.applied}</span>{" "}
                            · Bloqueados (lock):{" "}
                            <span className="font-medium text-foreground">{lastEdit.blockedByLock}</span>{" "}
                            · Ignorados:{" "}
                            <span className="font-medium text-foreground">{lastEdit.ignored}</span>{" "}
                            · Não encontrados:{" "}
                            <span className="font-medium text-foreground">{lastEdit.missing}</span>
                          </div>
                          {lastEdit.summary ? (
                            <div className="mt-1 text-muted-foreground">{lastEdit.summary}</div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="text-xs text-muted-foreground">
                        Use locks para proteger elementos contra alterações automáticas.
                      </div>
                    </section>
                  </div>
                ) : null}

                {showSlide ? (
                  <div className="space-y-6">
                    <section className="space-y-3 rounded-2xl border bg-background px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-medium">Visibilidade</div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Slide {selectedSlideIndex}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <Switch
                          label="Título"
                          checked={Boolean(
                            canvasSlide.objects.find(
                              (o) =>
                                o.type === "text" &&
                                (o.variant === "title" || o.id === "title") &&
                                !o.hidden
                            )
                          )}
                          onCheckedChange={(next) => toggleSlideElement("title", next)}
                        />
                        <Switch
                          label="Corpo"
                          checked={Boolean(
                            canvasSlide.objects.find(
                              (o) =>
                                o.type === "text" &&
                                (o.variant === "body" || o.id === "body") &&
                                !o.hidden
                            )
                          )}
                          onCheckedChange={(next) => toggleSlideElement("body", next)}
                        />
                        <Switch
                          label="Tagline"
                          checked={Boolean(
                            canvasSlide.objects.find(
                              (o) =>
                                o.type === "text" &&
                                (o.variant === "tagline" || o.id === "tagline") &&
                                !o.hidden
                            )
                          )}
                          onCheckedChange={(next) => toggleSlideElement("tagline", next)}
                        />
                        <Switch
                          label="CTA"
                          checked={Boolean(
                            canvasSlide.objects.find(
                              (o) =>
                                o.type === "text" &&
                                (o.variant === "cta" || o.id === "cta") &&
                                !o.hidden
                            )
                          )}
                          onCheckedChange={(next) => toggleSlideElement("cta", next)}
                        />
                        <Switch
                          label="Swipe"
                          checked={Boolean(
                            canvasSlide.objects.find(
                              (o) =>
                                o.type === "text" && o.id === "swipe" && !o.hidden
                            )
                          )}
                          onCheckedChange={(next) => toggleSlideElement("swipe", next)}
                        />
                        {hasBackgroundImageZone ? (
                          <Switch
                            label="Imagem de fundo"
                            checked={Boolean(
                              canvasSlide.objects.find((o) => {
                                if (o.type !== "image") return false;
                                if (!backgroundImageSlotId) return false;
                                return (
                                  (o.id === backgroundImageSlotId ||
                                    o.slotId === backgroundImageSlotId) &&
                                  !o.hidden
                                );
                              })
                            )}
                            onCheckedChange={(next) => toggleBackgroundImageVisibility(selectedSlideIndex, next)}
                          />
                        ) : null}
                      </div>
	                    </section>

	                    <section className="space-y-3 rounded-2xl border bg-background px-4 py-3">
	                      <div className="text-base font-medium">Ordem dos slides</div>
	                      <div className="text-xs text-muted-foreground">
	                        Arraste para reordenar. (MVP)
	                      </div>
	                      <div className="space-y-2">
	                        <div
	                          className="rounded-xl border border-dashed bg-background/40 px-3 py-2 text-xs text-muted-foreground"
	                          onDragOver={(e) => {
	                            e.preventDefault();
	                            e.dataTransfer.dropEffect = "move";
	                          }}
	                          onDrop={(e) => {
	                            e.preventDefault();
	                            const from = Number(e.dataTransfer.getData("text/plain"));
	                            if (!Number.isFinite(from)) return;
	                            reorderSlides(from, 0);
	                          }}
	                        >
	                          Solte aqui para mover ao início
	                        </div>
	                        {slidesFromState.map((s, i) => {
                          const slideObj = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
                          const objects = Array.isArray(slideObj.objects)
                            ? (slideObj.objects as unknown[])
                            : [];
                          const titleObj = objects.find((o) => {
                            if (!o || typeof o !== "object") return false;
                            const rec = o as Record<string, unknown>;
                            if (rec.type !== "text") return false;
                            const variant = typeof rec.variant === "string" ? rec.variant : null;
                            const id = typeof rec.id === "string" ? rec.id : null;
                            return variant === "title" || id === "title";
                          });
                          const titleText =
                            titleObj && typeof (titleObj as Record<string, unknown>).text === "string"
                              ? String((titleObj as Record<string, unknown>).text)
                              : "";
	                          return (
	                            <div
                              key={typeof slideObj.id === "string" ? (slideObj.id as string) : `idx_${i}`}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", String(i));
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                              }}
	                              onDrop={(e) => {
	                                e.preventDefault();
	                                const from = Number(e.dataTransfer.getData("text/plain"));
	                                if (!Number.isFinite(from)) return;
	                                reorderSlides(from, i);
	                              }}
                              className={[
                                "flex cursor-grab items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2",
                                i + 1 === selectedSlideIndex ? "ring-2 ring-primary/30" : ""
                              ].join(" ")}
                              title="Arraste para reordenar"
                            >
                              <button
                                type="button"
                                className="min-w-0 text-left"
                                onClick={() => setSelectedSlideIndex(i + 1)}
                              >
                                <div className="text-sm font-medium">Slide {i + 1}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {titleText || "—"}
                                </div>
                              </button>
                              <span className="text-xs text-muted-foreground">⋮⋮</span>
                            </div>
	                          );
	                        })}
	                        <div
	                          className="rounded-xl border border-dashed bg-background/40 px-3 py-2 text-xs text-muted-foreground"
	                          onDragOver={(e) => {
	                            e.preventDefault();
	                            e.dataTransfer.dropEffect = "move";
	                          }}
	                          onDrop={(e) => {
	                            e.preventDefault();
	                            const from = Number(e.dataTransfer.getData("text/plain"));
	                            if (!Number.isFinite(from)) return;
	                            reorderSlides(from, slidesFromState.length - 1);
	                          }}
	                        >
	                          Solte aqui para mover ao fim
	                        </div>
	                      </div>
	                    </section>
                  </div>
                ) : null}

                {showAssets ? (
                  <div className="space-y-4">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Geradas</span>: imagens criadas pela IA.{" "}
                      <span className="font-medium text-foreground">Referências</span>: imagens que você envia como inspiração.
                    </div>

                    <div className="flex overflow-hidden rounded-xl border bg-background">
                      <button
                        type="button"
                        onClick={() => setAssetsTab("generated")}
                        className={[
                          "flex-1 px-3 py-2 text-center text-sm",
                          assetsTab === "generated"
                            ? "bg-foreground text-background"
                            : "hover:bg-secondary"
                        ].join(" ")}
                      >
                        Geradas ({generatedAssets.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssetsTab("reference")}
                        className={[
                          "flex-1 px-3 py-2 text-center text-sm",
                          assetsTab === "reference"
                            ? "bg-foreground text-background"
                            : "hover:bg-secondary"
                        ].join(" ")}
                      >
                        Referências ({props.assets.reference.length})
                      </button>
                    </div>

                    {slotPicker ? (
                      <div className="rounded-xl border bg-background/70 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-muted-foreground">
                            Selecionar imagem para o <span className="font-medium text-foreground">slot</span>{" "}
                            <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono">
                              {slotPicker.slotId}
                            </span>{" "}
                            (slide {slotPicker.slideIndex}).
                          </div>
                          <button
                            type="button"
                            onClick={() => setSlotPicker(null)}
                            className="rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary"
                          >
                            Cancelar
                          </button>
                        </div>
                        <div className="mt-2 text-muted-foreground">
                          Clique em uma imagem abaixo para preencher o slot.
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground">
                        Clique em uma imagem para inserir no canvas, ou clique no placeholder verde para preencher um slot.
                      </div>
                    )}

                    {assetsTab === "reference" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            Envie imagens para guiar estilo/tema.
                          </div>
                          <Link
                            href={`/app/carousels/${props.carouselId}/upload`}
                            className="rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary"
                          >
                            Enviar
                          </Link>
                        </div>

                        {props.assets.reference.length === 0 ? (
                          <div className="text-xs text-muted-foreground">
                            Nenhuma referência enviada.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
	                            {props.assets.reference.slice(0, 12).map((a) => (
	                              <button
	                                key={a.id}
	                                type="button"
	                                draggable
	                                onDragStart={(e) => {
	                                  e.dataTransfer.setData(
	                                    "application/x-dojogram-asset-id",
	                                    a.id
	                                  );
	                                  e.dataTransfer.effectAllowed = "copy";
	                                }}
	                                disabled={!a.signedUrl}
	                                onClick={() => {
	                                  if (slotPicker) {
	                                    assignAssetToSlot(a.id);
                                    return;
                                  }
                                  insertAssetIntoSlide(a.id);
                                }}
                                className="overflow-hidden rounded-xl bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {a.signedUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    alt=""
                                    src={a.signedUrl}
                                    className="h-28 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                                    Sem preview
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {generatedAssets.length === 0 ? (
                          <div className="text-xs text-muted-foreground">
                            Nenhuma imagem gerada ainda.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
	                            {generatedAssets.slice(0, 12).map((a) => (
	                              <button
	                                key={a.id}
	                                type="button"
	                                draggable
	                                onDragStart={(e) => {
	                                  e.dataTransfer.setData(
	                                    "application/x-dojogram-asset-id",
	                                    a.id
	                                  );
	                                  e.dataTransfer.effectAllowed = "copy";
	                                }}
	                                disabled={!a.signedUrl}
	                                onClick={() => {
	                                  if (slotPicker) {
	                                    assignAssetToSlot(a.id);
	                                    return;
                                  }
                                  insertAssetIntoSlide(a.id);
                                }}
                                className="overflow-hidden rounded-xl bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {a.signedUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    alt=""
                                    src={a.signedUrl}
                                    className="h-28 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                                    Sem preview
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {showBrand ? (
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <div className="text-base font-medium">Branding</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      No MVP, branding é “personal” (avatar + @). A UI completa entra nas próximas tasks.
                    </div>
                  </div>
                ) : null}

                {showColors ? (
                  <div className="space-y-3">
                    {/* Custom palette (always available) */}
                    <div className="rounded-xl border bg-background/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground">
                          Custom
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-4 w-4 rounded-md border"
                            style={{ background: customPalette.background }}
                            title="Background"
                          />
                          <div
                            className="h-4 w-4 rounded-md border"
                            style={{ background: customPalette.text }}
                            title="Text"
                          />
                          <div
                            className="h-4 w-4 rounded-md border"
                            style={{ background: customPalette.accent }}
                            title="Accent"
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {(
                          [
                            ["background", "Fundo"],
                            ["text", "Texto"],
                            ["accent", "Destaque"]
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">
                              {label}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={customPalette[key]}
                                onChange={(e) =>
                                  setCustomPalette((prev) => ({
                                    ...prev,
                                    [key]: e.target.value
                                  }))
                                }
                                className="h-9 w-9 cursor-pointer rounded-lg border bg-background p-1"
                              />
                              <input
                                value={customPalette[key]}
                                onChange={(e) => {
                                  const next = toHexColor(e.target.value);
                                  if (!next) return;
                                  setCustomPalette((prev) => ({ ...prev, [key]: next }));
                                }}
                                className="h-9 w-full rounded-lg border bg-background px-2 font-mono text-xs"
                              />
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingPaletteId(null);
                            applyPaletteColors(customPalette, null);
                          }}
                          className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              const id = await saveCustomPalette();
                              if (!id) return;
                              setPendingPaletteId(id);
                              // Apply immediately using the custom palette colors.
                              applyPaletteColors(customPalette, id);
                            });
                          }}
                          className="rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>

                    {/* Paletas (PostNitro-style): swatches agrupados */}
                    {paletteOptions.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Nenhuma paleta disponível ainda.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-xl border bg-background/70 p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-muted-foreground">
                              Salvas
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {userPaletteOptions.length}
                            </div>
                          </div>
                          {userPaletteOptions.length === 0 ? (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Salve uma paleta em “Custom” para ela aparecer aqui.
                            </div>
                          ) : (
                            <div className="mt-2 grid grid-cols-4 gap-2">
                              {userPaletteOptions.map((p) => {
                                const checked = p.id === pendingPaletteId;
                                return (
                                  <PaletteSwatchButton
                                    key={p.id}
                                    palette={p.palette}
                                    active={checked}
                                    onClick={() => {
                                      setPendingPaletteId(p.id);
                                      applyPaletteColors(p.palette, p.id);
                                    }}
                                    actions={
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void deletePalette(p.id);
                                          }}
                                          className="rounded-md border bg-background/90 p-0.5 shadow-sm hover:bg-secondary"
                                          aria-label="Excluir paleta"
                                          title="Excluir"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    }
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border bg-background/70 p-3">
                          <div className="text-xs font-medium text-muted-foreground">
                            Globais
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-2">
                            {globalPaletteOptions.map((p) => {
                              const checked = p.id === pendingPaletteId;
                              return (
                                <PaletteSwatchButton
                                  key={p.id}
                                  palette={p.palette}
                                  active={checked}
                                  onClick={() => {
                                    setPendingPaletteId(p.id);
                                    applyPaletteColors(p.palette, p.id);
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div className="text-[11px] text-muted-foreground">
                          Aplicação instantânea (sem “salvar”). No MVP: fundo + cores do texto.
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border bg-background/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground">
                          Overlay (legibilidade)
                        </div>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={globalOverlay.enabled}
                            onChange={(e) => {
                              applyOverlay({ ...globalOverlay, enabled: e.target.checked });
                            }}
                          />
                          Ativar
                        </label>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">Cor</div>
                          <input
                            type="color"
                            value={globalOverlay.color}
                            onChange={(e) =>
                              applyOverlay({ ...globalOverlay, color: e.target.value })
                            }
                            className="h-9 w-16 cursor-pointer rounded-lg border bg-background p-1"
                            disabled={!globalOverlay.enabled}
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">
                            Opacidade: {Math.round(globalOverlay.opacity * 100)}%
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={0.95}
                            step={0.05}
                            value={globalOverlay.opacity}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n)) return;
                              applyOverlay({
                                ...globalOverlay,
                                opacity: clampNumberRange(n, 0, 0.95)
                              });
                            }}
                            className="w-full"
                            disabled={!globalOverlay.enabled}
                          />
                        </label>
                      </div>

                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Útil quando você usa imagem de fundo e quer garantir contraste do texto.
                      </div>
                    </div>
                  </div>
                ) : null}

                {showText ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-semibold">
                              Upload de fontes customizadas
                              <span className="rounded-md bg-emerald-200/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">
                                NEW
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Em breve: envie arquivos .ttf/.otf e crie seus próprios pareamentos.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled
                          className="mt-3 w-full rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white opacity-70"
                        >
                          Em breve
                        </button>
                      </div>

                      <div className="mt-4 space-y-5">
                        <div className="space-y-3">
                          <div className="text-sm font-medium">Par de fontes</div>

                          {!customPairingEnabled ? (
                            <select
                              value={fontPairId}
                              onChange={(e) => {
                                const id = e.target.value;
                                setFontPairId(id);
                                const pair = FONT_PAIRS.find((p) => p.id === id) ?? null;
                                if (!pair) return;
                                applyTypography({
                                  ...globalTypography,
                                  titleFontFamily: pair.titleFont,
                                  bodyFontFamily: pair.bodyFont,
                                  ctaFontFamily: undefined,
                                  taglineFontFamily: undefined
                                });
                              }}
                              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            >
                              {FONT_PAIRS.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.titleFont} / {p.bodyFont}
                                </option>
                              ))}
                            </select>
                          ) : null}

                          <Switch
                            checked={customPairingEnabled}
                            onCheckedChange={(next) => {
                              setCustomPairingEnabled(next);
                              if (!next) {
                                const pair = FONT_PAIRS.find((p) => p.id === fontPairId) ?? null;
                                if (!pair) return;
                                applyTypography({
                                  ...globalTypography,
                                  titleFontFamily: pair.titleFont,
                                  bodyFontFamily: pair.bodyFont,
                                  ctaFontFamily: undefined,
                                  taglineFontFamily: undefined
                                });
                              }
                            }}
                            label="Personalizar pareamento"
                          />

                          {customPairingEnabled ? (
                            <div className="grid grid-cols-2 gap-3">
                              <label className="space-y-1">
                                <div className="text-[11px] text-muted-foreground">
                                  Fonte do título
                                </div>
                                <select
                                  value={globalTypography.titleFontFamily}
                                  onChange={(e) =>
                                    applyTypography({
                                      ...globalTypography,
                                      titleFontFamily: e.target.value
                                    })
                                  }
                                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                                >
                                  {FONT_FAMILIES.map((f) => (
                                    <option key={f.label} value={f.value}>
                                      {f.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="space-y-1">
                                <div className="text-[11px] text-muted-foreground">
                                  Fonte do corpo
                                </div>
                                <select
                                  value={globalTypography.bodyFontFamily}
                                  onChange={(e) =>
                                    applyTypography({
                                      ...globalTypography,
                                      bodyFontFamily: e.target.value
                                    })
                                  }
                                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                                >
                                  {FONT_FAMILIES.map((f) => (
                                    <option key={f.label} value={f.value}>
                                      {f.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="text-sm font-medium">Tamanho</div>

                          {(() => {
                            const ratio =
                              baseTypography.title > 0
                                ? globalTypography.titleSize / baseTypography.title
                                : 1;
                            const preset =
                              ratio < 0.93 ? "sm" : ratio > 1.07 ? "lg" : "md";
                            const presets = [
                              { id: "sm", title: "Pequeno", scale: 0.85, iconClass: "text-xs" },
                              { id: "md", title: "Médio", scale: 1.0, iconClass: "text-sm" },
                              { id: "lg", title: "Grande", scale: 1.15, iconClass: "text-base" }
                            ] as const;
                            return (
                              <div className="flex items-center gap-2">
                                {presets.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    title={p.title}
                                    onClick={() => {
                                      const nextTitle = clampNumberRange(
                                        Math.round(baseTypography.title * p.scale),
                                        24,
                                        140
                                      );
                                      const nextBody = clampNumberRange(
                                        Math.round(baseTypography.body * p.scale),
                                        12,
                                        80
                                      );
                                      const nextCta = clampNumberRange(
                                        Math.round(baseTypography.cta * p.scale),
                                        12,
                                        80
                                      );
                                      const nextTagline = clampNumberRange(
                                        Math.round(baseTypography.tagline * p.scale),
                                        10,
                                        64
                                      );
                                      applyTypography({
                                        ...globalTypography,
                                        titleSize: nextTitle,
                                        bodySize: nextBody,
                                        ctaSize: nextCta,
                                        taglineSize: nextTagline
                                      });
                                    }}
                                    className={[
                                      "flex h-10 w-10 items-center justify-center rounded-xl border bg-background transition hover:bg-secondary",
                                      preset === p.id ? "border-foreground/40" : ""
                                    ].join(" ")}
                                  >
                                    <span className={["font-semibold", p.iconClass].join(" ")}>
                                      Aa
                                    </span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}

                          <Switch
                            checked={customSizesEnabled}
                            onCheckedChange={setCustomSizesEnabled}
                            label="Tamanhos personalizados"
                          />

                          {customSizesEnabled ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                                <div>Tamanho (px)</div>
                                <div>Altura</div>
                                <div>Espaçamento (px)</div>
                              </div>

                              {(() => {
                                type SizeKey = "taglineSize" | "titleSize" | "bodySize" | "ctaSize";
                                type HeightKey =
                                  | "taglineLineHeight"
                                  | "titleLineHeight"
                                  | "bodyLineHeight"
                                  | "ctaLineHeight";
                                type SpacingKey =
                                  | "taglineSpacing"
                                  | "titleSpacing"
                                  | "bodySpacing"
                                  | "ctaSpacing";

                                type Row = {
                                  label: string;
                                  sizeKey: SizeKey;
                                  heightKey: HeightKey;
                                  spacingKey: SpacingKey;
                                };

                                const rows: Row[] = [
                                  {
                                    label: "Subtítulo",
                                    sizeKey: "taglineSize",
                                    heightKey: "taglineLineHeight",
                                    spacingKey: "taglineSpacing"
                                  },
                                  {
                                    label: "Título",
                                    sizeKey: "titleSize",
                                    heightKey: "titleLineHeight",
                                    spacingKey: "titleSpacing"
                                  },
                                  {
                                    label: "Descrição",
                                    sizeKey: "bodySize",
                                    heightKey: "bodyLineHeight",
                                    spacingKey: "bodySpacing"
                                  },
                                  {
                                    label: "CTA",
                                    sizeKey: "ctaSize",
                                    heightKey: "ctaLineHeight",
                                    spacingKey: "ctaSpacing"
                                  }
                                ];

                                const setField = <K extends keyof TypographyV1>(
                                  key: K,
                                  value: TypographyV1[K]
                                ) => ({ ...globalTypography, [key]: value } satisfies TypographyV1);

                                return rows.map((row) => {
                                  const sizeValue =
                                    globalTypography[row.sizeKey] ??
                                    (row.sizeKey === "taglineSize"
                                      ? Math.max(12, Math.round(globalTypography.bodySize * 0.6))
                                      : row.sizeKey === "ctaSize"
                                        ? 28
                                        : 32);
                                  const heightValue =
                                    globalTypography[row.heightKey] ??
                                    (row.heightKey === "titleLineHeight"
                                      ? baseTypography.lineHeightTight
                                      : baseTypography.lineHeightNormal);
                                  const spacingValue = globalTypography[row.spacingKey] ?? 0;

                                return (
                                  <div key={row.label} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <div className="h-px flex-1 bg-border" />
                                      <div className="text-[11px] font-medium text-muted-foreground">
                                        {row.label}
                                      </div>
                                      <div className="h-px flex-1 bg-border" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <NumericField
                                        label=""
                                        value={Number(sizeValue)}
                                        onCommit={(n) =>
                                          applyTypography(
                                            setField(row.sizeKey, Math.trunc(n))
                                          )
                                        }
                                        min={1}
                                        max={140}
                                        step={1}
                                      />
                                      <NumericField
                                        label=""
                                        value={Number(heightValue)}
                                        onCommit={(n) => applyTypography(setField(row.heightKey, n))}
                                        min={0.8}
                                        max={2.2}
                                        step={0.05}
                                        allowDecimal
                                      />
                                      <NumericField
                                        label=""
                                        value={Number(spacingValue)}
                                        onCommit={(n) => applyTypography(setField(row.spacingKey, n))}
                                        min={-10}
                                        max={10}
                                        step={0.25}
                                        allowDecimal
                                        allowNegative
                                      />
                                    </div>
                                  </div>
                                );
                                });
                              })()}
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const baseFont = effectiveTemplate.defaults.typography.fontFamily;
                            const resetPairId =
                              FONT_PAIRS.find(
                                (p) => p.titleFont === baseFont && p.bodyFont === baseFont
                              )?.id ??
                              FONT_PAIRS[0]?.id ??
                              matchedFontPairId;
                            setCustomPairingEnabled(false);
                            setCustomSizesEnabled(false);
                            setFontPairId(resetPairId);
                            applyTypography({
                              titleFontFamily: baseFont,
                              bodyFontFamily: baseFont,
                              ctaFontFamily: undefined,
                              taglineFontFamily: undefined,
                              titleSize: baseTypography.title,
                              bodySize: baseTypography.body,
                              taglineSize: baseTypography.tagline,
                              ctaSize: baseTypography.cta,
                              titleLineHeight: baseTypography.lineHeightTight,
                              bodyLineHeight: baseTypography.lineHeightNormal,
                              taglineLineHeight: baseTypography.lineHeightNormal,
                              ctaLineHeight: baseTypography.lineHeightNormal,
                              titleSpacing: 0,
                              bodySpacing: 0,
                              taglineSpacing: 0,
                              ctaSpacing: 0
                            });
                          }}
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                        >
                          Resetar para o template
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => canvasApiRef.current?.addText()}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                    >
                      Adicionar texto
                    </button>
                  </div>
                ) : null}

                {showTemplates ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Templates</div>
                    <div className="text-xs text-muted-foreground">
                      Template define zonas e <span className="font-medium">slots de imagem</span>. No MVP, mostramos placeholders; imagens entram na próxima fase.
                    </div>

                    <div className="max-h-[420px] overflow-auto pr-1">
                      <div className="grid grid-cols-2 gap-3">
                        {templateOptions.map((t) => {
                          const checked = t.id === pendingTemplateId;
                          const slot = t.images.find((img) => img.kind === "slot") ?? null;
                          const isBuiltin = t.id.startsWith("builtin/");
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setPendingTemplateId(t.id);
                                applyTemplate(t); // apply immediately (PostNitro-style)
                              }}
                              className={[
                                "group rounded-2xl border bg-background/70 p-2 text-left shadow-sm transition hover:bg-secondary",
                                checked ? "border-primary ring-1 ring-primary/30" : ""
                              ].join(" ")}
                            >
                              <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted/40">
                                {/* fake background */}
                                <div className="absolute inset-0 bg-gradient-to-br from-muted/20 via-background to-muted/30" />

                                {/* image slot */}
                                {slot ? (
                                  <div
                                    className="absolute rounded-lg border border-dashed border-muted-foreground/50 bg-muted/20"
                                    style={rectToPct(slot.bounds)}
                                  />
                                ) : null}

                                {/* text zones */}
                                <div
                                  className="absolute rounded-md bg-foreground/10"
                                  style={rectToPct(t.zones.title)}
                                />
                                {t.zones.body ? (
                                  <div
                                    className="absolute rounded-md bg-foreground/10"
                                    style={rectToPct(t.zones.body)}
                                  />
                                ) : null}
                                {t.zones.cta ? (
                                  <div
                                    className="absolute rounded-md bg-foreground/10"
                                    style={rectToPct(t.zones.cta)}
                                  />
                                ) : null}
                              </div>

                              <div className="mt-2 flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold leading-tight">
                                    {t.name}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    {isBuiltin ? "Built‑in" : "Custom"}
                                  </div>
                                </div>
                                {checked ? (
                                  <div className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                    Ativo
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      No MVP: reposicionamos apenas <span className="font-mono">title/body/cta/tagline</span> e adicionamos placeholders de imagem no <span className="font-mono">editor_state</span>.
                    </div>
                  </div>
                ) : null}

                {showPresets ? (
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <div className="text-base font-medium">Presets</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Presets salvos:{" "}
                      <span className="font-mono">{props.catalog.presets}</span>. UI de gestão entra nas próximas tasks.
                    </div>
                  </div>
                ) : null}

                {showLocks ? (
                  <div className="space-y-3 rounded-2xl border bg-background px-4 py-3">
                    <div className="text-base font-medium">Locks</div>
                    <div className="text-xs text-muted-foreground">
                      Locks protegem elementos contra alterações automáticas da IA (não impedem edição manual).
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-3 text-xs">
                      <div className="font-medium">Seleção</div>
                      {selectedObjectIds.length === 0 ? (
                        <div className="mt-1 text-muted-foreground">
                          Selecione um elemento no canvas para bloquear/desbloquear.
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1">
                          <div className="text-muted-foreground">
                            {selectedObjectIds.length} elemento(s) selecionado(s).
                          </div>
                          <button
                            type="button"
                            onClick={toggleLocksForSelection}
                            className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            <Lock className="h-4 w-4" />
                            {selectedObjectIds.every((id) => isLocked(id))
                              ? "Desbloquear seleção"
                              : "Bloquear seleção"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Dica: o ícone “IA” aparece no canto do elemento bloqueado.
                    </div>

                    <details className="rounded-xl border bg-background p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Avançado (JSON)
                      </summary>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Formato esperado: <span className="font-mono">{`{"slide_1":{"title":true}}`}</span>
                      </div>
                      <div className="mt-2 space-y-2">
                        <textarea
                          className="h-40 w-full rounded-xl border bg-background p-3 font-mono text-xs"
                          value={elementLocksJson}
                          readOnly
                        />
                        <button
                          type="button"
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                          onClick={() => {
                            navigator.clipboard?.writeText(elementLocksJson);
                          }}
                        >
                          Copiar JSON
                        </button>
                      </div>
                    </details>
                  </div>
                ) : null}

                {showJson ? (
                  <div className="space-y-3 rounded-2xl border bg-background px-4 py-3">
                    <div className="text-base font-medium">Editor state (JSON)</div>
                    <div className="text-xs text-muted-foreground">
                      Avançado/debug. Use apenas se precisar inspecionar/ajustar manualmente.
                    </div>
                    <form action={saveEditorStateAction} className="space-y-2">
                      <input type="hidden" name="carouselId" value={props.carouselId} />
                      <input
                        type="hidden"
                        name="currentSlide"
                        value={selectedSlideIndex}
                      />
                      <textarea
                        name="editorStateJson"
                        className="h-48 w-full rounded-xl border bg-background p-3 font-mono text-xs"
                        value={editorStateJson}
                        readOnly
                      />
                      <button
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                        type="submit"
                      >
                        Salvar editor_state
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
                </motion.div>
              </aside>
            ) : null}
          </AnimatePresence>

          {/* Canvas */}
          <section className="relative mx-auto max-w-[980px] pb-8 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Slide{" "}
                <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono">
                  {selectedSlideIndex}/{Math.max(1, props.slideCount)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadActiveSlidePng}
                  className="hidden items-center gap-2 rounded-xl border bg-background/70 px-3 py-2 text-sm shadow-sm hover:bg-secondary sm:inline-flex"
                >
                  <Download className="h-4 w-4" />
                  Baixar PNG
                </button>
                <button
                  type="button"
                  onClick={toggleLocksForSelection}
                  disabled={selectedObjectIds.length === 0 || isPending}
                  title={
                    selectedObjectIds.length === 0
                      ? "Selecione um elemento para bloquear/desbloquear"
                      : selectedObjectIds.every((id) => isLocked(id))
                        ? "Desbloquear seleção (somente IA)"
                        : "Bloquear seleção (somente IA)"
                  }
                  className="hidden items-center gap-2 rounded-xl border bg-background/70 px-3 py-2 text-sm shadow-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
                >
                  <Lock className="h-4 w-4" />
                  {selectedObjectIds.length === 0
                    ? "Locks"
                    : selectedObjectIds.every((id) => isLocked(id))
                      ? "Desbloquear"
                      : "Bloquear"}
                </button>
                <button
                  type="button"
                  onClick={saveNow}
                  disabled={!dirty || isPending}
                  className="hidden rounded-xl border bg-background/70 px-3 py-2 text-sm shadow-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background/70 sm:block"
                >
                  {isPending ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => setLeftOpen((v) => !v)}
                  className="rounded-xl border bg-background/70 px-3 py-2 text-sm shadow-sm hover:bg-secondary md:hidden"
                >
                  Painel
                </button>
                {saveError ? (
                  <span className="hidden text-sm text-red-600 sm:block">
                    {saveError}
                  </span>
                ) : !dirty && lastSavedAt ? (
                  <span className="hidden text-sm text-muted-foreground sm:block">
                    Salvo
                  </span>
                ) : null}
              </div>
            </div>

            <div
              className="relative mt-5 flex items-center justify-center transition-transform duration-200 ease-out"
              style={{ transform: `translateX(${leftShiftPx}px)` }}
            >
              <div className="relative aspect-square w-full max-w-[720px] overflow-hidden rounded-[28px] bg-background shadow-[0_30px_120px_rgba(0,0,0,0.14)]">
                <div className="pointer-events-none absolute left-8 top-6 z-10 text-xs text-muted-foreground">
                  Canvas (MVP)
                </div>
                <FabricSlideCanvas
                  ref={canvasApiRef}
                  slide={canvasSlide}
                  assetUrlsById={assetUrlsById}
                  renderKey={`${selectedSlideIndex}:${canvasRevision}`}
                  onSlideChange={onCanvasSlideChange}
                  onSelectionChange={setSelectedObjectIds}
                  styleDefaults={{ typography: globalTypography, palette: appliedPalette }}
                />
                {/* Locked indicator badges (AI lock) */}
                {lockedBadges.map((b) => (
                  <div
                    key={b.id}
                    className="pointer-events-none absolute z-20"
                    style={{ left: `${b.leftPct}%`, top: `${b.topPct}%` }}
                  >
                    <div className="-translate-x-full -translate-y-2 rounded-full border bg-background/90 px-2 py-1 shadow-sm">
                      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        IA
                      </div>
                    </div>
                  </div>
                ))}
                {/* Image slot placeholders (template-driven) */}
	                {missingImageSlots.map((slot) => (
	                  <button
	                    key={slot.id}
	                    type="button"
	                    className="absolute z-20"
	                    style={rectToPct(slot.bounds)}
	                    onDragOver={(e) => {
	                      e.preventDefault();
	                      e.dataTransfer.dropEffect = "copy";
	                    }}
	                    onDrop={(e) => {
	                      e.preventDefault();
	                      const dropped = e.dataTransfer.getData("application/x-dojogram-asset-id");
	                      const assetId = typeof dropped === "string" ? dropped.trim() : "";
	                      if (assetId) {
	                        assignAssetToSpecificSlot(selectedSlideIndex, slot.id, assetId);
	                        return;
	                      }
	                    }}
	                    onClick={() => {
	                      setSlotPicker({ slideIndex: selectedSlideIndex, slotId: slot.id });
	                      setActiveDock("assets");
	                      setAssetsTab("generated");
	                      setLeftOpen(true);
	                    }}
	                  >
                    <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400/70 bg-emerald-50/10 text-[11px] font-medium text-emerald-700">
                      Clique para adicionar imagem
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {props.slideCount > 0 ? (
              <div
                className="mt-6 flex justify-center transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${leftShiftPx}px)` }}
              >
                <div className="flex gap-2 rounded-2xl border bg-background/80 p-2 shadow-sm backdrop-blur">
                  {Array.from({ length: props.slideCount }, (_, i) => {
                    const idx = i + 1;
                    const isActive = idx === selectedSlideIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedSlideIndex(idx)}
                        className={[
                          "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary"
                        ].join(" ")}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {idx}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Subtle hints */}
            <div
              className="mt-4 text-center text-xs text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: `translateX(${leftShiftPx}px)` }}
            >
              Dica: pressione <span className="font-mono">Esc</span> para fechar painéis.
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
