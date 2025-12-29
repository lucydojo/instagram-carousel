"use client";

import * as React from "react";
import { Canvas, Group, Image, Rect, Textbox, type FabricObject } from "fabric";

type TextVariant = "title" | "body" | "tagline" | "cta" | "custom";

type SlideObjectV1 = {
  id?: string;
  type: string;
  variant?: TextVariant;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fill?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  fontStyle?: "normal" | "italic";
  lineHeight?: number;
  letterSpacing?: number; // px (UI-friendly); converted to Fabric `charSpacing`
  underline?: boolean;
  linethrough?: boolean;
  assetId?: string | null;
  slotId?: string;
};

export type SlideV1 = {
  id?: string;
  width: number;
  height: number;
  objects: SlideObjectV1[];
  background?: {
    color?: string;
    overlay?: { enabled?: boolean; opacity?: number; color?: string };
  } | null;
};

export type FabricSlideCanvasHandle = {
  addText: () => boolean;
  deleteSelection: () => boolean;
  duplicateSelection: () => boolean;
  copySelection: () => boolean;
  paste: () => boolean;
  selectById: (id: string) => boolean;
  exportPngDataUrl: (targetSize?: number) => string | null;
};

type StyleDefaults = {
  typography?: {
    titleFontFamily: string;
    bodyFontFamily: string;
    ctaFontFamily?: string;
    taglineFontFamily?: string;
    titleSize: number;
    bodySize: number;
    ctaSize?: number;
    taglineSize?: number;
    titleLineHeight?: number;
    bodyLineHeight?: number;
    ctaLineHeight?: number;
    taglineLineHeight?: number;
    titleSpacing?: number;
    bodySpacing?: number;
    ctaSpacing?: number;
    taglineSpacing?: number;
  };
  palette?: { background: string; text: string; accent: string };
};

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

function clampNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function toFabricCharSpacing(letterSpacingPx: number | undefined, fontSize: number) {
  if (typeof letterSpacingPx !== "number" || !Number.isFinite(letterSpacingPx)) return 0;
  if (!Number.isFinite(fontSize) || fontSize <= 0) return 0;
  return Math.round((letterSpacingPx / fontSize) * 1000);
}

function fromFabricCharSpacing(charSpacing: number | undefined, fontSize: number) {
  if (typeof charSpacing !== "number" || !Number.isFinite(charSpacing)) return 0;
  if (!Number.isFinite(fontSize) || fontSize <= 0) return 0;
  // 1/1000 em → px
  return (charSpacing / 1000) * fontSize;
}

function getObjectId(obj: FabricObject): string | null {
  const anyObj = obj as unknown as { dojogramId?: unknown };
  return typeof anyObj.dojogramId === "string" ? anyObj.dojogramId : null;
}

function setObjectId(obj: FabricObject, id: string) {
  (obj as unknown as { dojogramId?: string }).dojogramId = id;
}

function getObjectVariant(obj: FabricObject): TextVariant | null {
  const anyObj = obj as unknown as { dojogramVariant?: unknown };
  return typeof anyObj.dojogramVariant === "string"
    ? (anyObj.dojogramVariant as TextVariant)
    : null;
}

function setObjectVariant(obj: FabricObject, variant: TextVariant) {
  (obj as unknown as { dojogramVariant?: TextVariant }).dojogramVariant = variant;
}

function toFontStack(fontFamily: string | undefined) {
  const raw = typeof fontFamily === "string" ? fontFamily.trim() : "";
  if (!raw) {
    return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
  }
  // If caller already provided a stack, keep it as-is.
  if (raw.includes(",")) return raw;
  return `${raw}, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function normalizeFontFamilyForUi(value: string) {
  const first = value.split(",")[0]?.trim() ?? value.trim();
  return first.replace(/^['"]/, "").replace(/['"]$/, "");
}

function createId(prefix = "obj") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rand}`;
}

function getActiveIds(canvas: Canvas): string[] {
  // Fabric already normalizes multi-selection via getActiveObjects().
  const activeObjects = canvas.getActiveObjects() as FabricObject[];
  const ids = activeObjects
    .map((o) => getObjectId(o))
    .filter((v): v is string => typeof v === "string");
  if (ids.length > 0) return ids;

  // Fallback: single active object.
  const active = canvas.getActiveObject() as FabricObject | null;
  const id = active ? getObjectId(active) : null;
  return id ? [id] : [];
}

function isAnyEditing(canvas: Canvas) {
  return canvas
    .getObjects()
    .some((o) => Boolean((o as unknown as { isEditing?: unknown }).isEditing));
}

function selectObjectById(canvas: Canvas, id: string) {
  const obj = canvas.getObjects().find((o) => getObjectId(o as FabricObject) === id);
  if (!obj) return false;
  canvas.setActiveObject(obj as unknown as FabricObject);
  canvas.requestRenderAll();
  return true;
}

type Props = {
  slide: SlideV1;
  assetUrlsById?: Record<string, string>;
  className?: string;
  renderKey: string | number;
  onSlideChange: (next: SlideV1) => void;
  onSelectionChange?: (ids: string[]) => void;
  styleDefaults?: StyleDefaults;
};

const FabricSlideCanvas = React.forwardRef<FabricSlideCanvasHandle, Props>(
  function FabricSlideCanvas(
    {
      slide,
      assetUrlsById,
      className,
      renderKey,
      onSlideChange,
      onSelectionChange,
      styleDefaults
    },
    ref
  ) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasElRef = React.useRef<HTMLCanvasElement>(null);
  const fabricRef = React.useRef<Canvas | null>(null);
  const isHydratingRef = React.useRef(false);
  const renderTokenRef = React.useRef(0);
  const emitTimerRef = React.useRef<number | null>(null);
  const nextSlideRef = React.useRef<SlideV1 | null>(null);
  const slideRef = React.useRef(slide);
  const clipboardRef = React.useRef<{ objects: SlideObjectV1[]; pasteN: number } | null>(
    null
  );
  const onSelectionChangeRef = React.useRef<Props["onSelectionChange"]>(null);
  const [textToolbar, setTextToolbar] = React.useState<{
    left: number;
    top: number;
    id: string;
    variant: TextVariant;
    fontFamily: string;
    fontSize: number;
    fill: string;
    fontWeight: number;
    fontStyle: "normal" | "italic";
    underline: boolean;
    linethrough: boolean;
    textAlign: "left" | "center" | "right" | "justify";
  } | null>(null);
  const toolbarRafRef = React.useRef<number | null>(null);
  const [fontSizeDraft, setFontSizeDraft] = React.useState<string>("");
  const [fontSizeFocused, setFontSizeFocused] = React.useState(false);

  React.useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange ?? null;
  }, [onSelectionChange]);

  const emit = React.useCallback(
    (next: SlideV1) => {
      nextSlideRef.current = next;
      if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current);
      emitTimerRef.current = window.setTimeout(() => {
        if (nextSlideRef.current) onSlideChange(nextSlideRef.current);
      }, 120);
    },
    [onSlideChange]
  );

  React.useEffect(() => {
    return () => {
      if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    slideRef.current = slide;
  }, [slide]);

  const updateTextToolbar = React.useCallback(() => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const active = canvas.getActiveObject() as FabricObject | null;
    if (!active || (active as unknown as { type?: unknown }).type !== "textbox") {
      setTextToolbar(null);
      return;
    }

    const id = getObjectId(active);
    if (!id) {
      setTextToolbar(null);
      return;
    }

    type CoordPoint = { x: number; y: number };
    type OCoords = { tl: CoordPoint; tr: CoordPoint; br: CoordPoint; bl: CoordPoint };
    const coords = (active as unknown as { oCoords?: OCoords }).oCoords;
    if (!coords || !coords.tl) {
      setTextToolbar(null);
      return;
    }

    const xs = [coords.tl.x, coords.tr.x, coords.br.x, coords.bl.x].filter(
      (v: unknown) => typeof v === "number" && Number.isFinite(v)
    ) as number[];
    const ys = [coords.tl.y, coords.tr.y, coords.br.y, coords.bl.y].filter(
      (v: unknown) => typeof v === "number" && Number.isFinite(v)
    ) as number[];
    if (xs.length === 0 || ys.length === 0) {
      setTextToolbar(null);
      return;
    }

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    const upper = canvas.upperCanvasEl;
    const upperBox = upper.getBoundingClientRect();
    const ratio = upperBox.width > 0 ? upper.width / upperBox.width : 1;
    const cssX = minX / ratio;
    const cssY = minY / ratio;

    const box = container.getBoundingClientRect();
    const maxLeft = Math.max(8, box.width - 360);
    const left = Math.max(8, Math.min(maxLeft, cssX));
    const top = Math.max(8, cssY - 54);

      const any = active as unknown as {
        fontFamily?: unknown;
        fontSize?: unknown;
        fill?: unknown;
        fontWeight?: unknown;
        fontStyle?: unknown;
        lineHeight?: unknown;
        charSpacing?: unknown;
        underline?: unknown;
        linethrough?: unknown;
        textAlign?: unknown;
      };

    const variant =
      getObjectVariant(active) ??
      (id === "title"
        ? "title"
        : id === "cta"
          ? "cta"
          : id === "tagline"
            ? "tagline"
            : "body");

    setTextToolbar({
      id,
      left,
      top,
      variant,
      fontFamily:
        typeof any.fontFamily === "string"
          ? normalizeFontFamilyForUi(any.fontFamily)
          : "Inter",
      fontSize: typeof any.fontSize === "number" ? any.fontSize : 34,
      fill: typeof any.fill === "string" ? any.fill : "#111827",
      fontWeight: typeof any.fontWeight === "number" ? any.fontWeight : 600,
      fontStyle: any.fontStyle === "italic" ? "italic" : "normal",
      underline: Boolean(any.underline),
      linethrough: Boolean(any.linethrough),
      textAlign:
        any.textAlign === "center" || any.textAlign === "right" || any.textAlign === "justify"
          ? any.textAlign
          : "left"
    });

    if (!fontSizeFocused) {
      setFontSizeDraft(String(Math.round(typeof any.fontSize === "number" ? any.fontSize : 34)));
    }
  }, []);

  const scheduleToolbarUpdate = React.useCallback(() => {
    if (toolbarRafRef.current) cancelAnimationFrame(toolbarRafRef.current);
    toolbarRafRef.current = requestAnimationFrame(() => {
      toolbarRafRef.current = null;
      updateTextToolbar();
    });
  }, [updateTextToolbar]);

  const patchActiveText = React.useCallback(
    (patch: Partial<SlideObjectV1>) => {
      const canvas = fabricRef.current;
      if (!canvas) return false;
      const active = canvas.getActiveObject() as FabricObject | null;
      if (!active || (active as unknown as { type?: unknown }).type !== "textbox") return false;

      const id = getObjectId(active);
      if (!id) return false;

      const affectsLayout =
        "fontFamily" in patch ||
        "fontSize" in patch ||
        "fontWeight" in patch ||
        "fontStyle" in patch ||
        "underline" in patch ||
        "linethrough" in patch ||
        "lineHeight" in patch ||
        "letterSpacing" in patch;

      if (typeof patch.variant === "string") setObjectVariant(active, patch.variant);

      if (typeof patch.fontFamily === "string") {
        (active as unknown as { fontFamily?: string }).fontFamily = toFontStack(
          patch.fontFamily
        );
      }
      if (typeof patch.fontSize === "number") {
        (active as unknown as { fontSize?: number }).fontSize = patch.fontSize;
      }
      if (typeof patch.fill === "string") {
        (active as unknown as { fill?: string }).fill = patch.fill;
      }
      if (typeof patch.fontWeight === "number") {
        (active as unknown as { fontWeight?: number }).fontWeight = patch.fontWeight;
      }
      if (typeof patch.fontStyle === "string") {
        (active as unknown as { fontStyle?: "normal" | "italic" }).fontStyle = patch.fontStyle;
      }
      if (typeof patch.lineHeight === "number") {
        (active as unknown as { lineHeight?: number }).lineHeight = patch.lineHeight;
      }
      if (typeof patch.letterSpacing === "number") {
        const size =
          typeof (active as unknown as { fontSize?: unknown }).fontSize === "number"
            ? (active as unknown as { fontSize: number }).fontSize
            : 34;
        (active as unknown as { charSpacing?: number }).charSpacing = toFabricCharSpacing(
          patch.letterSpacing,
          size
        );
      }
      if (typeof patch.underline === "boolean") {
        (active as unknown as { underline?: boolean }).underline = patch.underline;
      }
      if (typeof patch.linethrough === "boolean") {
        (active as unknown as { linethrough?: boolean }).linethrough = patch.linethrough;
      }
      if (typeof patch.textAlign === "string") {
        (active as unknown as { textAlign?: SlideObjectV1["textAlign"] }).textAlign = patch.textAlign;
      }

      if (affectsLayout) {
        (active as unknown as { initDimensions?: () => void }).initDimensions?.();
      }
      (active as unknown as { setCoords: () => void }).setCoords();
      canvas.requestRenderAll();

      const normalizedHeight =
        typeof (active as unknown as { height?: unknown }).height === "number"
          ? Math.round((active as unknown as { height: number }).height)
          : undefined;
      const normalizedWidth =
        typeof (active as unknown as { width?: unknown }).width === "number"
          ? Math.round((active as unknown as { width: number }).width)
          : undefined;

      const currentSlide = slideRef.current;
      const nextObjects = (currentSlide.objects ?? []).map((o) => {
        if (!o || o.id !== id) return o;
        return {
          ...o,
          ...patch,
          ...(typeof normalizedHeight === "number" ? { height: normalizedHeight } : null),
          ...(typeof normalizedWidth === "number" ? { width: normalizedWidth } : null)
        };
      });
      emit({ ...currentSlide, objects: nextObjects });
      scheduleToolbarUpdate();
      return true;
    },
    [emit, scheduleToolbarUpdate]
  );

  const addText = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    if (isAnyEditing(canvas)) return false;

    const id = createId("text");
    const slideW = clampNumber(slideRef.current.width, 1080);
    const slideH = clampNumber(slideRef.current.height, 1080);
    const x = Math.round(slideW * 0.12);
    const y = Math.round(slideH * 0.18);
    const width = Math.max(240, Math.round(slideW * 0.55));

    const defaults = styleDefaults?.typography;
    const fontFamily = defaults?.bodyFontFamily ?? "Inter";
    const fontSize = defaults?.bodySize ?? 48;
    const fill = styleDefaults?.palette?.text ?? "#111827";

    const textbox = new Textbox("Novo texto", {
      left: x,
      top: y,
      width,
      originX: "left",
      originY: "top",
      fontFamily: toFontStack(fontFamily),
      fontSize,
      fontWeight: 600,
      fill,
      textAlign: "left",
      lineHeight: 1.2,
      charSpacing: 0,
      editable: true
    });
    textbox.initDimensions();
    setObjectId(textbox, id);
    setObjectVariant(textbox, "body");
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();

    window.setTimeout(() => {
      textbox.enterEditing();
      textbox.selectAll();
      canvas.requestRenderAll();
    }, 0);

    const currentSlide = slideRef.current;
    const nextObj: SlideObjectV1 = {
      id,
      type: "text",
      variant: "body",
      x,
      y,
      width,
      height:
        typeof textbox.height === "number" ? Math.round(textbox.height) : undefined,
      text: textbox.text ?? "",
      fontFamily,
      fontSize,
      fontWeight: 600,
      fill,
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: "left"
    };
    emit({ ...currentSlide, objects: [...(currentSlide.objects ?? []), nextObj] });
    return true;
  }, [emit, styleDefaults?.palette?.text, styleDefaults?.typography]);

  const deleteSelection = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    if (isAnyEditing(canvas)) return false;
    const ids = getActiveIds(canvas);
    if (ids.length === 0) return false;

    for (const o of canvas.getObjects()) {
      const oid = getObjectId(o as FabricObject);
      if (oid && ids.includes(oid)) canvas.remove(o);
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    const currentSlide = slideRef.current;
    const nextObjects = (currentSlide.objects ?? []).filter((o) => !ids.includes(o?.id ?? ""));
    emit({ ...currentSlide, objects: nextObjects });
    return true;
  }, [emit]);

  const copySelection = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    if (isAnyEditing(canvas)) return false;
    const ids = getActiveIds(canvas);
    if (ids.length === 0) return false;

    const currentSlide = slideRef.current;
    const selected = (currentSlide.objects ?? []).filter((o) => o?.id && ids.includes(o.id));
    if (selected.length === 0) return false;
    clipboardRef.current = { objects: selected.map((o) => ({ ...o })), pasteN: 0 };
    return true;
  }, []);

  const paste = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    if (isAnyEditing(canvas)) return false;

    const clip = clipboardRef.current;
    if (!clip || clip.objects.length === 0) return false;
    clip.pasteN += 1;
    const dx = 24 * clip.pasteN;
    const dy = 24 * clip.pasteN;

    const currentSlide = slideRef.current;
    const nextObjects = [...(currentSlide.objects ?? [])];

    for (const o of clip.objects) {
      if (o.type !== "text") continue;
      const id = createId("text");
      const text = o.text ?? "";
      const x = clampNumber(o.x, 80) + dx;
      const y = clampNumber(o.y, 240) + dy;
      const width = clampNumber(o.width, 560);

      const textbox = new Textbox(text, {
        left: x,
        top: y,
        width,
        originX: "left",
        originY: "top",
        fontFamily: toFontStack(o.fontFamily),
        fontSize: clampNumber(o.fontSize, 48),
        fontWeight: clampNumber(o.fontWeight, 600),
        fill: o.fill ?? "#111827",
        textAlign: o.textAlign ?? "left",
        fontStyle: o.fontStyle ?? "normal",
        lineHeight: clampNumber(o.lineHeight, 1.2),
        charSpacing: toFabricCharSpacing(
          typeof o.letterSpacing === "number" ? o.letterSpacing : 0,
          clampNumber(o.fontSize, 48)
        ),
        underline: Boolean(o.underline),
        linethrough: Boolean(o.linethrough),
        editable: true
      });
      textbox.initDimensions();
      setObjectId(textbox, id);
      setObjectVariant(textbox, (o.variant as TextVariant) ?? "body");
      canvas.add(textbox);

      nextObjects.push({
        ...o,
        id,
        variant: (o.variant as TextVariant) ?? "body",
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: typeof textbox.height === "number" ? Math.round(textbox.height) : o.height,
        lineHeight: clampNumber(o.lineHeight, 1.2),
        letterSpacing:
          typeof o.letterSpacing === "number" ? o.letterSpacing : 0
      });
    }

    const lastId = nextObjects.length > 0 ? nextObjects[nextObjects.length - 1]?.id : null;
    if (lastId) {
      const lastCanvasObj = canvas
        .getObjects()
        .find((o) => getObjectId(o as FabricObject) === lastId);
      if (lastCanvasObj) canvas.setActiveObject(lastCanvasObj);
    }
    canvas.requestRenderAll();

    emit({ ...currentSlide, objects: nextObjects });
    return true;
  }, [emit]);

  const duplicateSelection = React.useCallback(() => {
    const didCopy = copySelection();
    if (!didCopy) return false;
    return paste();
  }, [copySelection, paste]);

  const exportPngDataUrl = React.useCallback((targetSize = 1080) => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    if (!w || !h) return null;

    // Export at a stable, known size (Instagram: 1080x1080). We scale from the
    // current backstore size to avoid any DPR-specific artifacts.
    const base = Math.min(w, h);
    const multiplier = Math.max(0.1, targetSize / base);
    try {
      return canvas.toDataURL({ format: "png", multiplier });
    } catch {
      return null;
    }
  }, []);

  const selectById = React.useCallback((id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    if (isAnyEditing(canvas)) return false;
    return selectObjectById(canvas, id);
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      addText,
      deleteSelection,
      duplicateSelection,
      copySelection,
      paste,
      selectById,
      exportPngDataUrl
    }),
    [
      addText,
      copySelection,
      deleteSelection,
      duplicateSelection,
      exportPngDataUrl,
      paste,
      selectById
    ]
  );

  React.useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const canvas = new Canvas(el, {
      selection: true,
      preserveObjectStacking: true,
      // Important: Fabric's retina scaling can misalign IText/Textbox cursor
      // metrics on high-DPR displays when combined with responsive sizing.
      // We keep a large backstore (e.g. 1080x1080) and scale via CSS instead.
      enableRetinaScaling: false
    });
    fabricRef.current = canvas;

    const emitSelection = () => {
      const cb = onSelectionChangeRef.current;
      const ids = getActiveIds(canvas);
      cb?.(ids);
      scheduleToolbarUpdate();
    };

    const onEditingEntered = (e: { target?: FabricObject }) => {
      const target = e.target as unknown as { initDimensions?: () => void } | undefined;
      target?.initDimensions?.();
      canvas.calcOffset();
      canvas.requestRenderAll();
    };

    const onEditingExited = (e: { target?: FabricObject }) => {
      if (isHydratingRef.current) return;
      const target = e.target;
      if (!target) return;

      const id = getObjectId(target);
      if (!id) return;

      const text = (target as unknown as { text?: unknown }).text;
      if (typeof text !== "string") return;

      // UX: like "Canvas" apps — if the user leaves editing with an empty
      // textbox, auto-delete the object.
      if (text.trim().length > 0) return;

      // Important: don't remove the object synchronously. Fabric is still
      // unwinding its internal "exit editing" flow and may call `canvas.fire`
      // on the textbox; removing it immediately can lead to
      // "Cannot read properties of undefined (reading 'fire')".
      const tryDelete = () => {
        const liveCanvas = fabricRef.current;
        if (!liveCanvas) return;

        // Wait until Fabric fully finishes editing teardown.
        if (isAnyEditing(liveCanvas)) {
          window.setTimeout(tryDelete, 50);
          return;
        }

        const liveObj = liveCanvas
          .getObjects()
          .find((o) => getObjectId(o as FabricObject) === id);
        if (!liveObj) return;

        // Avoid discardActiveObject() here — it can trigger deselect flows
        // that still expect the textbox to have a live `canvas` reference.
        liveCanvas.remove(liveObj);
        liveCanvas.requestRenderAll();

        const currentSlide = slideRef.current;
        const nextObjects = currentSlide.objects.filter((o) => o?.id !== id);
        emit({ ...currentSlide, objects: nextObjects });
      };

      window.setTimeout(tryDelete, 50);
    };

    const onModified = (e: { target?: FabricObject }) => {
      if (isHydratingRef.current) return;
      const target = e.target;
      if (!target) return;

      const id = getObjectId(target);
      if (!id) return;

      const currentSlide = slideRef.current;
      const left = clampNumber(target.left, 0);
      const top = clampNumber(target.top, 0);
      const scaleX = clampNumber(target.scaleX, 1);
      const scaleY = clampNumber(target.scaleY, 1);

      const rawObj = currentSlide.objects.find((o) => o?.id === id);
      if (rawObj?.type === "image") {
        // Important: don't destructure Fabric methods like getScaledWidth/getScaledHeight.
        // They depend on `this` and will throw if called unbound.
        const getScaledWidth = (target as unknown as { getScaledWidth?: () => number })
          .getScaledWidth;
        const getScaledHeight = (target as unknown as { getScaledHeight?: () => number })
          .getScaledHeight;
        const scaledWidth =
          typeof getScaledWidth === "function"
            ? clampNumber(getScaledWidth.call(target as unknown as object), 1)
            : typeof target.width === "number"
              ? Math.max(1, Math.round(target.width * scaleX))
              : 1;
        const scaledHeight =
          typeof getScaledHeight === "function"
            ? clampNumber(getScaledHeight.call(target as unknown as object), 1)
            : typeof target.height === "number"
              ? Math.max(1, Math.round(target.height * scaleY))
              : 1;

        const nextObjects = currentSlide.objects.map((o) => {
          if (!o || o.id !== id) return o;
          return {
            ...o,
            x: Math.round(left),
            y: Math.round(top),
            width: Math.round(scaledWidth),
            height: Math.round(scaledHeight)
          };
        });
        emit({ ...currentSlide, objects: nextObjects });
        return;
      }

      let normalizedWidth: number | undefined;
      let normalizedHeight: number | undefined;

      const nextObjects = currentSlide.objects.map((o) => {
        if (!o || o.id !== id) return o;
        const width =
          typeof target.width === "number"
            ? Math.max(1, Math.round(target.width * scaleX))
            : o.width;
        const height =
          typeof target.height === "number"
            ? Math.max(1, Math.round(target.height * scaleY))
            : o.height;

        normalizedWidth = width;
        normalizedHeight = height;

        const next: SlideObjectV1 = {
          ...o,
          x: Math.round(left),
          y: Math.round(top),
          width,
          height
        };

        if (typeof (target as unknown as { text?: unknown }).text === "string") {
          next.text = String((target as unknown as { text?: unknown }).text);
        }
        if (
          typeof (target as unknown as { fontSize?: unknown }).fontSize === "number"
        ) {
          next.fontSize = clampNumber(
            (target as unknown as { fontSize?: unknown }).fontSize,
            next.fontSize ?? 40
          );
        }
        if (
          typeof (target as unknown as { fontWeight?: unknown }).fontWeight ===
          "number"
        ) {
          next.fontWeight = clampNumber(
            (target as unknown as { fontWeight?: unknown }).fontWeight,
            next.fontWeight ?? 400
          );
        }
        if (
          typeof (target as unknown as { fontFamily?: unknown }).fontFamily === "string"
        ) {
          next.fontFamily = String(
            (target as unknown as { fontFamily?: unknown }).fontFamily
          );
        }
        if (typeof (target as unknown as { fill?: unknown }).fill === "string") {
          next.fill = String((target as unknown as { fill?: unknown }).fill);
        }
        if (
          typeof (target as unknown as { textAlign?: unknown }).textAlign === "string"
        ) {
          const a = String((target as unknown as { textAlign?: unknown }).textAlign);
          if (a === "left" || a === "center" || a === "right" || a === "justify") {
            next.textAlign = a;
          }
        }
        if (
          typeof (target as unknown as { fontStyle?: unknown }).fontStyle === "string"
        ) {
          const fs = String((target as unknown as { fontStyle?: unknown }).fontStyle);
          if (fs === "normal" || fs === "italic") next.fontStyle = fs;
        }
        if (
          typeof (target as unknown as { lineHeight?: unknown }).lineHeight === "number"
        ) {
          next.lineHeight = clampNumber(
            (target as unknown as { lineHeight?: unknown }).lineHeight,
            next.lineHeight ?? 1.2
          );
        }
        if (
          typeof (target as unknown as { charSpacing?: unknown }).charSpacing === "number"
        ) {
          const cs = clampNumber(
            (target as unknown as { charSpacing?: unknown }).charSpacing,
            0
          );
          const fs =
            typeof (target as unknown as { fontSize?: unknown }).fontSize === "number"
              ? clampNumber(
                  (target as unknown as { fontSize?: unknown }).fontSize,
                  next.fontSize ?? 34
                )
              : next.fontSize ?? 34;
          next.letterSpacing = fromFabricCharSpacing(cs, fs);
        }
        next.underline = Boolean((target as unknown as { underline?: unknown }).underline);
        next.linethrough = Boolean(
          (target as unknown as { linethrough?: unknown }).linethrough
        );
        const variant = getObjectVariant(target);
        if (variant) next.variant = variant;

        return next;
      });

      if (scaleX !== 1 || scaleY !== 1) {
        target.set({ scaleX: 1, scaleY: 1 });
        if (typeof normalizedWidth === "number" && typeof target.width === "number") {
          target.set({ width: normalizedWidth });
        }
        if (
          typeof normalizedHeight === "number" &&
          typeof target.height === "number"
        ) {
          target.set({ height: normalizedHeight });
        }
        canvas.requestRenderAll();
      }

      emit({ ...currentSlide, objects: nextObjects });
    };

    const onTextChanged = (e: { target?: FabricObject }) => onModified(e);

    canvas.on("selection:created", emitSelection);
    canvas.on("selection:updated", emitSelection);
    canvas.on("selection:cleared", () => {
      const cb = onSelectionChangeRef.current;
      cb?.([]);
      setTextToolbar(null);
    });
    canvas.on("object:moving", scheduleToolbarUpdate);
    canvas.on("object:scaling", scheduleToolbarUpdate);
    canvas.on("object:rotating", scheduleToolbarUpdate);
    canvas.on("object:modified", onModified);
    canvas.on("text:changed", onTextChanged);
    canvas.on("text:editing:entered", onEditingEntered);
    canvas.on("text:editing:exited", onEditingExited);

    return () => {
      canvas.off("selection:created", emitSelection);
      canvas.off("selection:updated", emitSelection);
      canvas.off("selection:cleared");
      canvas.off("object:moving", scheduleToolbarUpdate);
      canvas.off("object:scaling", scheduleToolbarUpdate);
      canvas.off("object:rotating", scheduleToolbarUpdate);
      canvas.off("object:modified", onModified);
      canvas.off("text:changed", onTextChanged);
      canvas.off("text:editing:entered", onEditingEntered);
      canvas.off("text:editing:exited", onEditingExited);
      canvas.dispose();
      fabricRef.current = null;
    };
    // We intentionally don't depend on `slide` here; events use `slideRef`.
  }, [emit, scheduleToolbarUpdate]);

  const fitCanvas = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const size = Math.floor(Math.min(box.width, box.height));
    if (size <= 0) return;
    const slideW = clampNumber(slide.width, 1080);
    const slideH = clampNumber(slide.height, 1080);
    const dpr =
      typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : 1;
    // Make the backstore match the visible size (accounting for DPR) and use
    // viewport zoom to map "slide coordinates" (e.g. 1080x1080) into it.
    // This keeps Fabric's cursor math in the same coordinate space it renders.
    const internalW = Math.max(1, Math.round(size * dpr));
    const internalH = Math.max(1, Math.round(size * dpr));

    const scale = Math.min(internalW / slideW, internalH / slideH);
    const tx = (internalW - slideW * scale) / 2;
    const ty = (internalH - slideH * scale) / 2;

    canvas.setDimensions({ width: internalW, height: internalH }, { cssOnly: false });
    canvas.setDimensions({ width: size, height: size }, { cssOnly: true });
    canvas.setViewportTransform([scale, 0, 0, scale, tx, ty]);
    canvas.calcOffset();
    canvas.requestRenderAll();
  }, [slide.height, slide.width]);

    const renderSlide = React.useCallback(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const token = (renderTokenRef.current += 1);
      isHydratingRef.current = true;
      canvas.clear();

      const bgColor = slide.background?.color ?? "#ffffff";
      canvas.backgroundColor = bgColor;

      const slideW = clampNumber(slide.width, 1080);
      const slideH = clampNumber(slide.height, 1080);

      // 1) Images (behind text)
      for (const [idx, raw] of (slide.objects ?? []).entries()) {
        if (!raw || typeof raw !== "object") continue;
        if (raw.type !== "image") continue;

      const id = raw.id ?? `obj_${idx + 1}`;
      const assetId = typeof raw.assetId === "string" ? raw.assetId : null;
      if (!assetId) continue;
      const url = typeof assetUrlsById?.[assetId] === "string" ? assetUrlsById?.[assetId] : null;
      if (!url) continue;

      const x = clampNumber(raw.x, 0);
      const y = clampNumber(raw.y, 0);
      const width = clampNumber(raw.width, Math.max(1, slideW - 160));
      const height = clampNumber(raw.height, Math.max(1, width));

      Image.fromURL(url, { crossOrigin: "anonymous" })
        .then((img) => {
          // Ignore if we re-rendered since the request started.
          if (renderTokenRef.current !== token) return;
          if (!fabricRef.current) return;

          const iw = clampNumber((img as unknown as { width?: unknown }).width, 1);
          const ih = clampNumber((img as unknown as { height?: unknown }).height, 1);
          const slotAspect = width / Math.max(1, height);
          const imgAspect = iw / Math.max(1, ih);

          let cropW = iw;
          let cropH = ih;
          let cropX = 0;
          let cropY = 0;
          if (imgAspect > slotAspect) {
            // Wider than slot: crop horizontally.
            cropW = Math.round(ih * slotAspect);
            cropH = ih;
            cropX = Math.round((iw - cropW) / 2);
            cropY = 0;
          } else if (imgAspect < slotAspect) {
            // Taller than slot: crop vertically.
            cropW = iw;
            cropH = Math.round(iw / slotAspect);
            cropX = 0;
            cropY = Math.round((ih - cropH) / 2);
          }

          const scale = width / Math.max(1, cropW);

          img.set({
            left: 0,
            top: 0,
            cropX,
            cropY,
            width: cropW,
            height: cropH,
            scaleX: scale,
            scaleY: scale,
            selectable: false,
            evented: false
          });

          const frame = new Group([img], {
            left: x,
            top: y,
            originX: "left",
            originY: "top",
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            borderColor: "#7c3aed",
            cornerStyle: "circle",
            cornerColor: "#7c3aed",
            transparentCorners: false
          });
          setObjectId(frame as unknown as FabricObject, id);
          frame.clipPath = new Rect({
            left: 0,
            top: 0,
            width,
            height,
            rx: 18,
            ry: 18
          });

          canvas.add(frame);
          canvas.sendObjectToBack(frame);
          canvas.requestRenderAll();
        })
        .catch(() => {
          // ignore load errors
        });
    }

    // 1.5) Overlay (global/per-slide background readability)
    const overlay = slide.background?.overlay;
    if (overlay?.enabled) {
      const opacity =
        typeof overlay.opacity === "number" && Number.isFinite(overlay.opacity)
          ? Math.min(0.95, Math.max(0, overlay.opacity))
          : 0.35;
      const color = typeof overlay.color === "string" ? overlay.color : "#000000";
      const rect = new Rect({
        left: 0,
        top: 0,
        width: slideW,
        height: slideH,
        originX: "left",
        originY: "top",
        fill: color,
        opacity,
        selectable: false,
        evented: false
      });
      canvas.add(rect);
      canvas.requestRenderAll();
    }

    // 2) Text
    for (const [idx, raw] of (slide.objects ?? []).entries()) {
      if (!raw || typeof raw !== "object") continue;
      if (raw.type !== "text") continue;

      const id = raw.id ?? `obj_${idx + 1}`;
      const text = raw.text ?? "";
      const x = clampNumber(raw.x, 80);
      const y = clampNumber(raw.y, 240);
      const width = clampNumber(raw.width, Math.max(240, slideW - 160));

      const textbox = new Textbox(text, {
        left: x,
        top: y,
        width,
        originX: "left",
        originY: "top",
        // Use a reliably available font stack to keep text measurement stable
        // (cursor positioning depends on accurate glyph metrics).
        fontFamily: toFontStack(raw.fontFamily),
        fontSize: clampNumber(raw.fontSize, 56),
        fontWeight: clampNumber(raw.fontWeight, 600),
        fill: raw.fill ?? "#111827",
        textAlign: raw.textAlign ?? "left",
        fontStyle: raw.fontStyle ?? "normal",
        lineHeight: clampNumber(raw.lineHeight, 1.2),
        charSpacing: toFabricCharSpacing(
          typeof raw.letterSpacing === "number" ? raw.letterSpacing : 0,
          clampNumber(raw.fontSize, 56)
        ),
        underline: Boolean(raw.underline),
        linethrough: Boolean(raw.linethrough),
        editable: true
      });

      setObjectId(textbox, id);
      const variantRaw =
        typeof raw.variant === "string"
          ? (raw.variant as TextVariant)
          : id === "title"
            ? "title"
            : id === "cta"
              ? "cta"
              : id === "tagline"
                ? "tagline"
                : "body";
      setObjectVariant(textbox, variantRaw);
      canvas.add(textbox);
    }

    fitCanvas();
    canvas.renderAll();
    isHydratingRef.current = false;
  }, [assetUrlsById, fitCanvas, slide]);

  React.useEffect(() => {
    renderSlide();
    // Intentionally only when `renderKey` changes (slide switching / external rehydrate),
    // so typing doesn't cause the canvas to re-render and drop text editing focus.
  }, [renderKey]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => fitCanvas());
    obs.observe(container);
    return () => obs.disconnect();
  }, [fitCanvas]);

  return (
    <div
      ref={containerRef}
      className={["relative h-full w-full", className ?? ""].join(" ")}
    >
      <canvas ref={canvasElRef} className="h-full w-full" />

      {textToolbar ? (
        <div
          className="absolute z-40 flex items-center gap-1 rounded-2xl border bg-background/90 px-2 py-1 shadow-sm backdrop-blur"
          style={{ left: textToolbar.left, top: textToolbar.top }}
        >
          <select
            value={textToolbar.variant}
            onChange={(e) => {
              const variant = e.target.value as TextVariant;
              const typ = styleDefaults?.typography;
              const pal = styleDefaults?.palette;
              const applyPreset: Partial<SlideObjectV1> =
                variant === "title"
                  ? {
                      variant,
                      fontFamily: typ?.titleFontFamily ?? textToolbar.fontFamily,
                      fontSize: typ?.titleSize ?? textToolbar.fontSize,
                      fill: pal?.accent ?? textToolbar.fill,
                      fontWeight: 700,
                      lineHeight: typ?.titleLineHeight ?? 1.1,
                      letterSpacing: typ?.titleSpacing ?? 0
                    }
                  : variant === "cta"
                    ? {
                        variant,
                        fontFamily:
                          typ?.ctaFontFamily ??
                          typ?.bodyFontFamily ??
                          textToolbar.fontFamily,
                        fontSize: typ?.ctaSize ?? textToolbar.fontSize,
                        fill: pal?.text ?? textToolbar.fill,
                        fontWeight: 600,
                        lineHeight: typ?.ctaLineHeight ?? 1.25,
                        letterSpacing: typ?.ctaSpacing ?? 0
                      }
                    : variant === "tagline"
                      ? {
                          variant,
                          fontFamily:
                            typ?.taglineFontFamily ??
                            typ?.bodyFontFamily ??
                            textToolbar.fontFamily,
                          fontSize: typ?.taglineSize ?? textToolbar.fontSize,
                          fill: pal?.text ?? textToolbar.fill,
                          fontWeight: 600,
                          lineHeight: typ?.taglineLineHeight ?? 1.25,
                          letterSpacing: typ?.taglineSpacing ?? 0
                        }
                      : variant === "body"
                        ? {
                            variant,
                            fontFamily: typ?.bodyFontFamily ?? textToolbar.fontFamily,
                            fontSize: typ?.bodySize ?? textToolbar.fontSize,
                            fill: pal?.text ?? textToolbar.fill,
                            fontWeight: 600,
                            lineHeight: typ?.bodyLineHeight ?? 1.25,
                            letterSpacing: typ?.bodySpacing ?? 0
                          }
                        : { variant };
              patchActiveText(applyPreset);
            }}
            className="rounded-lg border bg-background px-2 py-1 text-xs"
            title="Tipo"
          >
            <option value="title">Título</option>
            <option value="body">Corpo</option>
            <option value="tagline">Tagline</option>
            <option value="cta">CTA</option>
            <option value="custom">Custom</option>
          </select>

          <select
            value={textToolbar.fontFamily}
            onChange={(e) => patchActiveText({ fontFamily: e.target.value })}
            className="rounded-lg border bg-background px-2 py-1 text-xs"
            title="Fonte"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            max={140}
            step={1}
            inputMode="numeric"
            value={fontSizeDraft}
            onFocus={() => setFontSizeFocused(true)}
            onBlur={() => {
              setFontSizeFocused(false);
              const n = Number(fontSizeDraft);
              if (!Number.isFinite(n)) {
                setFontSizeDraft(String(Math.round(textToolbar.fontSize)));
                return;
              }
              const clamped = Math.max(1, Math.min(140, Math.trunc(n)));
              setFontSizeDraft(String(clamped));
              patchActiveText({ fontSize: clamped });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.currentTarget as HTMLInputElement).blur();
                return;
              }
              if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-" || e.key === ".") {
                e.preventDefault();
              }
            }}
            onChange={(e) => setFontSizeDraft(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-[72px] rounded-lg border bg-background px-2 py-1 text-xs"
            title="Tamanho (px)"
          />

          <input
            type="color"
            value={textToolbar.fill}
            onChange={(e) => patchActiveText({ fill: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded-lg border bg-background p-1"
            title="Cor"
          />

          <button
            type="button"
            onClick={() => {
              const bold = textToolbar.fontWeight >= 600;
              patchActiveText({ fontWeight: bold ? 400 : 700 });
            }}
            className="rounded-lg border bg-background px-2 py-1 text-xs font-semibold hover:bg-secondary"
            title="Negrito"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => {
              patchActiveText({
                fontStyle: textToolbar.fontStyle === "italic" ? "normal" : "italic"
              });
            }}
            className="rounded-lg border bg-background px-2 py-1 text-xs italic hover:bg-secondary"
            title="Itálico"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => patchActiveText({ underline: !textToolbar.underline })}
            className="rounded-lg border bg-background px-2 py-1 text-xs underline hover:bg-secondary"
            title="Sublinhado"
          >
            U
          </button>
          <button
            type="button"
            onClick={() => patchActiveText({ linethrough: !textToolbar.linethrough })}
            className="rounded-lg border bg-background px-2 py-1 text-xs line-through hover:bg-secondary"
            title="Tachado"
          >
            S
          </button>

          <div className="mx-1 h-6 w-px bg-border" />

          <button
            type="button"
            onClick={() => patchActiveText({ textAlign: "left" })}
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
              textToolbar.textAlign === "left" ? "border-primary" : ""
            ].join(" ")}
            title="Alinhar à esquerda"
          >
            ⟸
          </button>
          <button
            type="button"
            onClick={() => patchActiveText({ textAlign: "center" })}
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
              textToolbar.textAlign === "center" ? "border-primary" : ""
            ].join(" ")}
            title="Centralizar"
          >
            ≡
          </button>
          <button
            type="button"
            onClick={() => patchActiveText({ textAlign: "right" })}
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
              textToolbar.textAlign === "right" ? "border-primary" : ""
            ].join(" ")}
            title="Alinhar à direita"
          >
            ⟹
          </button>
        </div>
      ) : null}
    </div>
  );
  }
);

FabricSlideCanvas.displayName = "FabricSlideCanvas";

export default FabricSlideCanvas;
