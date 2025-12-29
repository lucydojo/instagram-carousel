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
  Pencil,
  Sparkles,
  Trash2,
  Type,
  UserCircle2
} from "lucide-react";
import {
  studioCleanup,
  studioCreatePalette,
  studioDeletePalette,
  studioEdit,
  studioGenerate,
  studioRenamePalette,
  studioSaveEditorState,
  studioSaveEditorStateInline,
  studioSaveLocks
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
    background: { overlay?: { enabled: boolean; opacity: number } };
  };
};

type PaletteV1 = { background: string; text: string; accent: string };

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
      background: { overlay: { enabled: true, opacity: 0.35 } }
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

function PaletteSwatchButton(props: {
  palette: PaletteV1;
  active: boolean;
  title: string;
  onClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="group relative h-10 w-[74px]">
      <button
        type="button"
        title={props.title}
        onClick={props.onClick}
        className={[
          "h-full w-full overflow-hidden rounded-2xl border bg-background shadow-sm transition",
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
            "pointer-events-none absolute inset-0 flex items-end justify-end p-1 transition-opacity",
            props.active
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
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
  const [dirty, setDirty] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [canvasRevision, setCanvasRevision] = React.useState(0);
  const [leftOpen, setLeftOpen] = React.useState(false);
  const [assetsTab, setAssetsTab] = React.useState<"generated" | "reference">(
    "generated"
  );
  const [activeDock, setActiveDock] = React.useState<DockItem>("generate");
  const [editorState, setEditorState] = React.useState<Record<string, unknown>>(
    () =>
      safeParseJson<Record<string, unknown>>(props.defaults.editorStateJson) ?? {
        version: 1,
        slides: props.slides
      }
  );
  const historyRef = React.useRef<
    Map<number, { past: string[]; future: string[]; lastPushedAt: number }>
  >(new Map());

  React.useEffect(() => {
    setDirty(false);
    setSelectedSlideIndex((current) =>
      clampInt(current, 1, Math.max(1, props.slideCount))
    );
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
  const selectedSlide =
    slidesFromState.length > 0 ? slidesFromState[selectedSlideIndex - 1] : null;
  const editorStateJson = React.useMemo(
    () => JSON.stringify(editorState, null, 2),
    [editorState]
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
    return paletteOptions
      .filter((p) => !p.is_global)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [paletteOptions]);

  const globalPaletteOptions = React.useMemo(() => {
    return paletteOptions
      .filter((p) => p.is_global)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [paletteOptions]);

  const globalPaletteGroups = React.useMemo(() => {
    const dojo = globalPaletteOptions.filter((p) => /dojo/i.test(p.name));
    const other = globalPaletteOptions.filter((p) => !/dojo/i.test(p.name));
    const groups: Array<{ label: string; palettes: PaletteOption[] }> = [];
    if (dojo.length) groups.push({ label: "Dojo", palettes: dojo });
    if (other.length) groups.push({ label: "Outras", palettes: other });
    return groups;
  }, [globalPaletteOptions]);

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

          return { ...slideObj, objects: [...nextObjects, ...placeholders] };
        });

        const prevGlobal =
          prev.global && typeof prev.global === "object"
            ? (prev.global as Record<string, unknown>)
            : {};
        const nextGlobal = {
          ...prevGlobal,
          templateId: template.id,
          templateData: template
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
          const fill = id === "title" ? palette.accent : palette.text;
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

  const [paletteRenameDraft, setPaletteRenameDraft] = React.useState<{
    id: string | null;
    name: string;
  }>({ id: null, name: "" });

  const startRenamePalette = React.useCallback(
    (id: string) => {
      const current = paletteOptions.find((p) => p.id === id);
      if (!current || current.is_global) return;
      setPaletteRenameDraft({ id, name: current.name });
    },
    [paletteOptions]
  );

  const commitRenamePalette = React.useCallback(async () => {
    const id = paletteRenameDraft.id;
    const name = paletteRenameDraft.name.trim();
    if (!id || !name) return;
    const current = paletteOptions.find((p) => p.id === id);
    if (!current || current.is_global) return;
    const result = await studioRenamePalette({ id, name });
    if (!result.ok) {
      setSaveError("Não foi possível renomear a paleta.");
      return;
    }
    setPaletteOptions((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    setPaletteRenameDraft({ id: null, name: "" });
  }, [paletteOptions, paletteRenameDraft.id, paletteRenameDraft.name]);

  const deletePalette = React.useCallback(
    async (id: string) => {
      const current = paletteOptions.find((p) => p.id === id);
      if (!current || current.is_global) return;
      const ok = window.confirm(
        `Excluir a paleta “${current.name}”? Essa ação não pode ser desfeita.`
      );
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

  React.useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      saveNow();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [dirty, editorStateJson, saveNow]);

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
  const showAssets = activeDock === "assets";
  const showBrand = activeDock === "brand";
  const showColors = activeDock === "colors";
  const showText = activeDock === "text";
  const showTemplates = activeDock === "templates";
  const showPresets = activeDock === "presets";
  const showLocks = activeDock === "locks";
  const showJson = activeDock === "json";

  const generateAction = studioGenerate;
  const editAction = studioEdit;
  const saveLocksAction = studioSaveLocks;
  const saveEditorStateAction = studioSaveEditorState;

  const leftShiftPx = leftOpen ? 220 : 0;

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

                      <form action={editAction} className="space-y-2">
                        <input type="hidden" name="carouselId" value={props.carouselId} />
                        <input
                          type="hidden"
                          name="currentSlide"
                          value={selectedSlideIndex}
                        />
                        <textarea
                          name="instruction"
                          className="h-24 w-full rounded-xl border bg-background p-3 text-sm"
                          placeholder='Ex: “Deixe o título mais forte e encurte o texto do corpo.”'
                          required
                        />
                        <div className="flex items-center gap-2">
                          <select
                            name="slideIndex"
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            defaultValue={selectedSlideIndex}
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
                            Aplicar
                          </button>
                        </div>
                      </form>

                      <div className="text-xs text-muted-foreground">
                        Use locks para proteger elementos contra alterações automáticas.
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
                        Geradas ({props.assets.generated.length})
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
                              <div
                                key={a.id}
                                className="overflow-hidden rounded-xl bg-muted/30"
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
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {props.assets.generated.length === 0 ? (
                          <div className="text-xs text-muted-foreground">
                            Nenhuma imagem gerada ainda.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {props.assets.generated.slice(0, 12).map((a) => (
                              <div
                                key={a.id}
                                className="overflow-hidden rounded-xl bg-muted/30"
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
                              </div>
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
                    <div className="text-sm font-semibold">Cores</div>

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
                            <div className="mt-2 flex flex-wrap gap-2">
                              {userPaletteOptions.map((p) => {
                                const checked = p.id === pendingPaletteId;
                                return (
                                  <PaletteSwatchButton
                                    key={p.id}
                                    palette={p.palette}
                                    active={checked}
                                    title={p.name}
                                    onClick={() => {
                                      setPendingPaletteId(p.id);
                                      applyPaletteColors(p.palette, p.id);
                                    }}
                                    actions={
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startRenamePalette(p.id);
                                          }}
                                          className="rounded-lg border bg-background/90 p-1 shadow-sm hover:bg-secondary"
                                          aria-label="Renomear paleta"
                                          title="Renomear"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void deletePalette(p.id);
                                          }}
                                          className="ml-1 rounded-lg border bg-background/90 p-1 shadow-sm hover:bg-secondary"
                                          aria-label="Excluir paleta"
                                          title="Excluir"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    }
                                  />
                                );
                              })}
                            </div>
                          )}

                          {paletteRenameDraft.id ? (
                            <div className="mt-3 rounded-xl border bg-background p-2">
                              <div className="text-[11px] font-medium text-muted-foreground">
                                Renomear paleta
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  value={paletteRenameDraft.name}
                                  onChange={(e) =>
                                    setPaletteRenameDraft((prev) => ({
                                      ...prev,
                                      name: e.target.value
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void commitRenamePalette();
                                    if (e.key === "Escape")
                                      setPaletteRenameDraft({ id: null, name: "" });
                                  }}
                                  className="h-9 flex-1 rounded-lg border bg-background px-2 text-sm"
                                  placeholder="Nome da paleta"
                                />
                                <button
                                  type="button"
                                  onClick={() => void commitRenamePalette()}
                                  className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaletteRenameDraft({ id: null, name: "" })}
                                  className="h-9 rounded-lg border bg-background px-3 text-sm hover:bg-secondary"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-xl border bg-background/70 p-3">
                          <div className="text-xs font-medium text-muted-foreground">
                            Globais
                          </div>
                          <div className="mt-2 space-y-3">
                            {globalPaletteGroups.map((group) => (
                              <div
                                key={group.label}
                                className="rounded-xl border bg-background p-2"
                              >
                                <div className="text-[11px] text-muted-foreground">
                                  {group.label}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {group.palettes.map((p) => {
                                    const checked = p.id === pendingPaletteId;
                                    return (
                                      <PaletteSwatchButton
                                        key={p.id}
                                        palette={p.palette}
                                        active={checked}
                                        title={p.name}
                                        onClick={() => {
                                          setPendingPaletteId(p.id);
                                          applyPaletteColors(p.palette, p.id);
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="text-[11px] text-muted-foreground">
                          Aplicação instantânea (sem “salvar”). No MVP: fundo + cores do texto.
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {showText ? (
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <div className="text-base font-medium">Texto</div>
                    <div className="mt-2 space-y-3 text-xs text-muted-foreground">
                      <div>
                        Tipografia global/per-slide entra nas próximas tasks. Por enquanto, você pode inserir e editar caixas de texto no canvas.
                      </div>
                      <button
                        type="button"
                        onClick={() => canvasApiRef.current?.addText()}
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                      >
                        Adicionar texto <span className="font-mono text-xs text-muted-foreground">(T)</span>
                      </button>
                      <div className="text-[11px] text-muted-foreground">
                        Atalhos: <span className="font-mono">Del/Backspace</span> (remover),{" "}
                        <span className="font-mono">⌘/Ctrl+C</span>,{" "}
                        <span className="font-mono">⌘/Ctrl+V</span>,{" "}
                        <span className="font-mono">⌘/Ctrl+D</span>.
                      </div>
                    </div>
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
                      Locks protegem elementos contra alterações automáticas da IA. Formato:{" "}
                      <span className="font-mono">{`{"slide_1":{"title":true}}`}</span>
                    </div>
                    <form action={saveLocksAction} className="space-y-2">
                      <input type="hidden" name="carouselId" value={props.carouselId} />
                      <input
                        type="hidden"
                        name="currentSlide"
                        value={selectedSlideIndex}
                      />
                      <textarea
                        name="elementLocksJson"
                        className="h-36 w-full rounded-xl border bg-background p-3 font-mono text-xs"
                        defaultValue={props.defaults.elementLocksJson}
                      />
                      <button
                        className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        type="submit"
                      >
                        Salvar locks
                      </button>
                    </form>
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
                  renderKey={`${selectedSlideIndex}:${canvasRevision}`}
                  onSlideChange={onCanvasSlideChange}
                />
                {/* Image slot placeholders (template-driven) */}
                {missingImageSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="pointer-events-none absolute z-20"
                    style={rectToPct(slot.bounds)}
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400/70 bg-emerald-50/10 text-[11px] font-medium text-emerald-700">
                      Clique para adicionar imagem
                    </div>
                  </div>
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
