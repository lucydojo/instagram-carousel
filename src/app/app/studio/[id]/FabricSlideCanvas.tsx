"use client";

import * as React from "react";
import {
  Canvas,
  FixedLayout,
  Group,
  Gradient,
  Image,
  LayoutManager,
  Line,
  Rect,
  Textbox,
  filters,
  type FabricObject
} from "fabric";

type TextVariant = "title" | "body" | "tagline" | "cta" | "custom";

type TextStyleMap = Record<string, Record<string, Record<string, unknown>>>;

const DEFAULT_IMAGE_FILTER_COLOR = "#d11a1a";
const DEFAULT_MARKER_COLOR = "#f5e663";
const DEFAULT_MARKER_HEIGHT = 0.6;
const DEFAULT_MARKER_ANGLE = -2;

type SlideObjectV1 = {
  id?: string;
  type: string;
  variant?: TextVariant;
  hidden?: boolean;
  contentOffsetX?: number; // px inside slot (cover-fit)
  contentOffsetY?: number; // px inside slot (cover-fit)
  cornerRounding?: number; // 0-100 (0 = square, 100 = circle)
  strokeWeight?: "none" | "thin" | "medium" | "thick";
  strokeColor?: string;
  filterColor?: string;
  filterOpacity?: number;
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
  textBackgroundColor?: string | null;
  markerColor?: string;
  markerHeight?: number;
  markerAngle?: number;
  stroke?: string | null;
  strokeWidth?: number;
  strokeLineJoin?: string;
  styles?: TextStyleMap;
  assetId?: string | null;
  slotId?: string;
};

export type SlideV1 = {
  id?: string;
  width: number;
  height: number;
  objects: SlideObjectV1[];
  paletteId?: string | null;
  paletteData?: { background: string; text: string; accent: string };
  background?: {
    color?: string;
    overlay?: {
      enabled?: boolean;
      opacity?: number;
      color?: string;
      mode?: "solid" | "bottom-gradient";
      height?: number;
    };
    overlayScope?: "global" | "slide";
  } | null;
};

export type FabricSlideCanvasHandle = {
  addText: () => boolean;
  deleteSelection: () => boolean;
  duplicateSelection: () => boolean;
  copySelection: () => boolean;
  paste: () => boolean;
  selectById: (id: string) => boolean;
  clearSelection: () => boolean;
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
  { value: "Montserrat", label: "Montserrat" },
  { value: "Bebas Neue", label: "Bebas Neue" },
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

function clampNumberRange(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function strokeWidthForWeight(weight: SlideObjectV1["strokeWeight"]): number {
  if (weight === "thin") return 2;
  if (weight === "medium") return 6;
  if (weight === "thick") return 12;
  return 0;
}

function ensureFixedLayoutManager(group: Group) {
  const anyGroup = group as unknown as { layoutManager?: LayoutManager };
  const current = anyGroup.layoutManager;
  if (current?.strategy instanceof FixedLayout) return;
  current?.dispose?.();
  anyGroup.layoutManager = new LayoutManager(new FixedLayout());
}

type CoverCropResult = {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  scale: number;
  normalizedOffsetX: number;
  normalizedOffsetY: number;
};

function clampInt(value: number, min: number, max: number) {
  const v = Math.trunc(value);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function computeCoverCrop(
  iw: number,
  ih: number,
  frameW: number,
  frameH: number,
  offsetX: number,
  offsetY: number
): CoverCropResult {
  const safeIw = Math.max(1, Math.round(iw));
  const safeIh = Math.max(1, Math.round(ih));
  const safeW = Math.max(1, Math.round(frameW));
  const safeH = Math.max(1, Math.round(frameH));

  const slotAspect = safeW / safeH;
  const imgAspect = safeIw / safeIh;

  if (imgAspect > slotAspect) {
    const cropH = safeIh;
    const cropW = clampInt(safeIh * slotAspect, 1, safeIw);
    const baseX = Math.round((safeIw - cropW) / 2);
    const maxX = Math.max(0, safeIw - cropW);
    const candidate = baseX + Math.round(offsetX);
    const cropX = clampInt(candidate, 0, maxX);
    return {
      cropX,
      cropY: 0,
      cropW,
      cropH,
      scale: safeW / Math.max(1, cropW),
      normalizedOffsetX: cropX - baseX,
      normalizedOffsetY: 0
    };
  }

  if (imgAspect < slotAspect) {
    const cropW = safeIw;
    const cropH = clampInt(safeIw / slotAspect, 1, safeIh);
    const baseY = Math.round((safeIh - cropH) / 2);
    const maxY = Math.max(0, safeIh - cropH);
    const candidate = baseY + Math.round(offsetY);
    const cropY = clampInt(candidate, 0, maxY);
    return {
      cropX: 0,
      cropY,
      cropW,
      cropH,
      scale: safeH / Math.max(1, cropH),
      normalizedOffsetX: 0,
      normalizedOffsetY: cropY - baseY
    };
  }

  return {
    cropX: 0,
    cropY: 0,
    cropW: safeIw,
    cropH: safeIh,
    scale: safeW / Math.max(1, safeIw),
    normalizedOffsetX: 0,
    normalizedOffsetY: 0
  };
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

type ImageMeta = { naturalWidth: number; naturalHeight: number };

function getImageMeta(obj: FabricObject): ImageMeta | null {
  const anyObj = obj as unknown as { dojogramImageMeta?: unknown };
  const meta = anyObj.dojogramImageMeta as ImageMeta | undefined;
  if (!meta || typeof meta !== "object") return null;
  if (
    typeof meta.naturalWidth !== "number" ||
    !Number.isFinite(meta.naturalWidth) ||
    typeof meta.naturalHeight !== "number" ||
    !Number.isFinite(meta.naturalHeight)
  ) {
    return null;
  }
  return meta;
}

function setImageMeta(obj: FabricObject, meta: ImageMeta) {
  (obj as unknown as { dojogramImageMeta?: ImageMeta }).dojogramImageMeta = meta;
}

function configureImageFrameControls(frame: Group) {
  frame.set({
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    borderColor: "#7c3aed",
    cornerStyle: "circle",
    cornerColor: "#7c3aed",
    transparentCorners: false,
    lockRotation: true,
    lockScalingFlip: true,
    lockScalingX: false,
    lockScalingY: false,
    lockSkewingX: true,
    lockSkewingY: true,
    lockUniScaling: false,
    centeredScaling: false
  });
  frame.setControlsVisibility({ mtr: false });
  (frame as unknown as { hasRotatingPoint?: boolean }).hasRotatingPoint = false;
}

function getObjectKind(obj: FabricObject): string | null {
  const anyObj = obj as unknown as { dojogramKind?: unknown };
  return typeof anyObj.dojogramKind === "string" ? anyObj.dojogramKind : null;
}

function setObjectKind(obj: FabricObject, kind: string) {
  (obj as unknown as { dojogramKind?: string }).dojogramKind = kind;
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

function isBebasNeueFamily(fontFamily: string | undefined) {
  if (!fontFamily) return false;
  return normalizeFontFamilyForUi(fontFamily) === "Bebas Neue";
}

function fauxBoldStrokeWidth(fontSize: number | undefined) {
  const size = typeof fontSize === "number" && Number.isFinite(fontSize) ? fontSize : 34;
  return Math.max(1, Math.round(size * 0.02));
}

function resolveFontWeightForFamily(fontFamily: string | undefined, weight: number) {
  const family = normalizeFontFamilyForUi(
    typeof fontFamily === "string" ? fontFamily : ""
  );
  if (family === "Bebas Neue" && weight >= 600) return 400;
  return weight;
}

function cloneTextStyles(styles: unknown): TextStyleMap | null {
  if (!styles || typeof styles !== "object") return null;
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(styles) as TextStyleMap;
    }
  } catch {
    // fall through
  }
  try {
    return JSON.parse(JSON.stringify(styles)) as TextStyleMap;
  } catch {
    return null;
  }
}

function stripTextStyleKeys(styles: TextStyleMap, keys: string[]): TextStyleMap | null {
  const next: TextStyleMap = {};
  for (const [lineKey, lineStyles] of Object.entries(styles)) {
    if (!lineStyles || typeof lineStyles !== "object") continue;
    const nextLine: Record<string, Record<string, unknown>> = {};
    for (const [charKey, charStyle] of Object.entries(lineStyles)) {
      if (!charStyle || typeof charStyle !== "object") continue;
      const nextStyle: Record<string, unknown> = { ...charStyle };
      for (const key of keys) delete nextStyle[key];
      if (Object.keys(nextStyle).length > 0) nextLine[charKey] = nextStyle;
    }
    if (Object.keys(nextLine).length > 0) next[lineKey] = nextLine;
  }
  return Object.keys(next).length > 0 ? next : null;
}

function normalizeBebasNeueStyles(
  styles: TextStyleMap | null,
  baseFill: string,
  fontSize: number | undefined
) {
  if (!styles) return null;
  const next: TextStyleMap = {};
  const fauxWidth = fauxBoldStrokeWidth(fontSize);
  for (const [lineKey, lineStyles] of Object.entries(styles)) {
    if (!lineStyles || typeof lineStyles !== "object") continue;
    const nextLine: Record<string, Record<string, unknown>> = {};
    for (const [charKey, charStyle] of Object.entries(lineStyles)) {
      if (!charStyle || typeof charStyle !== "object") continue;
      const nextStyle: Record<string, unknown> = { ...charStyle };
      const weight = typeof nextStyle.fontWeight === "number" ? nextStyle.fontWeight : null;
      const fill = typeof nextStyle.fill === "string" ? nextStyle.fill : baseFill;
      if (weight !== null && weight >= 600) {
        nextStyle.fontWeight = 400;
        nextStyle.stroke = fill;
        nextStyle.strokeWidth = fauxWidth;
        nextStyle.strokeLineJoin = "round";
      }
      if (Object.keys(nextStyle).length > 0) nextLine[charKey] = nextStyle;
    }
    if (Object.keys(nextLine).length > 0) next[lineKey] = nextLine;
  }
  return Object.keys(next).length > 0 ? next : null;
}

function ensureTextboxMarkerPatch() {
  const proto = Textbox.prototype as unknown as {
    _dojogramMarkerPatch?: boolean;
    _renderTextLinesBackground?: (ctx: CanvasRenderingContext2D) => void;
  };
  if (proto._dojogramMarkerPatch) return;
  const original = proto._renderTextLinesBackground;
  if (typeof original !== "function") return;

  proto._renderTextLinesBackground = function renderMarkerBackground(
    this: Textbox,
    ctx: CanvasRenderingContext2D
  ) {
    const any = this as unknown as {
      markerHeight?: unknown;
      markerAngle?: unknown;
      path?: unknown;
    };
    if (any.path) {
      original.call(this, ctx);
      return;
    }
    const hasMarker =
      Boolean(this.textBackgroundColor) ||
      this._textLines.some((_, index) => this.styleHas("textBackgroundColor", index));
    if (!hasMarker) return;

    const originalFill = ctx.fillStyle;
    const leftOffset = this._getLeftOffset();
    let lineTopOffset = this._getTopOffset();
    const markerHeight = clampNumberRange(
      any.markerHeight,
      0.25,
      1,
      DEFAULT_MARKER_HEIGHT
    );
    const markerAngle = clampNumberRange(
      any.markerAngle,
      -15,
      15,
      DEFAULT_MARKER_ANGLE
    );
    const angle = (markerAngle * Math.PI) / 180;

    for (let i = 0, len = this._textLines.length; i < len; i++) {
      const heightOfLine = this.getHeightOfLine(i);
      if (!this.textBackgroundColor && !this.styleHas("textBackgroundColor", i)) {
        lineTopOffset += heightOfLine;
        continue;
      }
      const jlen = this._textLines[i].length;
      const lineLeftOffset = this._getLineLeftOffset(i);
      const lineHeightScale =
        typeof this.lineHeight === "number" && this.lineHeight > 0 ? this.lineHeight : 1;
      const fullHeight = heightOfLine / lineHeightScale;
      const bgHeight = Math.max(1, fullHeight * markerHeight);
      const baseline = lineTopOffset + fullHeight - fullHeight * this._fontSizeFraction;
      const offsetY = baseline - bgHeight * (1 - this._fontSizeFraction);
      let boxWidth = 0;
      let boxStart = 0;
      let drawStart: number | undefined;
      let currentColor: string | undefined;
      let lastColor = this.getValueOfPropertyAt(i, 0, "textBackgroundColor") as
        | string
        | undefined;

      const drawSegment = (color: string | undefined, start: number, width: number) => {
        if (!color) return;
        let startX = leftOffset + lineLeftOffset + start;
        if (this.direction === "rtl") {
          startX = this.width - startX - width;
        }
        ctx.save();
        ctx.translate(startX, offsetY);
        if (angle) {
          ctx.translate(0, bgHeight / 2);
          ctx.rotate(angle);
          ctx.translate(0, -bgHeight / 2);
        }
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, bgHeight);
        ctx.restore();
      };

      for (let j = 0; j < jlen; j++) {
        const charBox = this.__charBounds[i][j];
        currentColor = this.getValueOfPropertyAt(i, j, "textBackgroundColor") as
          | string
          | undefined;
        if (currentColor !== lastColor) {
          drawStart = leftOffset + lineLeftOffset + boxStart;
          if (this.direction === "rtl") {
            drawStart = this.width - drawStart - boxWidth;
          }
          drawSegment(lastColor, boxStart, boxWidth);
          boxStart = charBox.left;
          boxWidth = charBox.width;
          lastColor = currentColor;
        } else {
          boxWidth += charBox.kernedWidth;
        }
      }
      if (currentColor) {
        drawSegment(currentColor, boxStart, boxWidth);
      }
      lineTopOffset += heightOfLine;
    }

    ctx.fillStyle = originalFill;
    this._removeShadow(ctx);
  };
  proto._dojogramMarkerPatch = true;
}

function hexToRgb(value: string): [number, number, number] | null {
  const raw = value.trim().replace("#", "");
  if (raw.length !== 3 && raw.length !== 6) return null;
  const expanded =
    raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const num = Number.parseInt(expanded, 16);
  if (!Number.isFinite(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getReadableStroke(fill: string) {
  const rgb = hexToRgb(fill);
  if (!rgb) return "#000000";
  const [r, g, b] = rgb;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
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
  layoutKey?: string | number;
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
      layoutKey,
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
  const onSlideChangeRef = React.useRef<Props["onSlideChange"]>(() => {});
  const imageElementCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const imagePromiseCacheRef = React.useRef<Map<string, Promise<HTMLImageElement>>>(new Map());
  const fontLoadCacheRef = React.useRef<Map<string, Promise<void>>>(new Map());
  const clipboardRef = React.useRef<{
    objects: SlideObjectV1[];
    pasteN: number;
    slideKey: string | number | null;
  } | null>(null);
  const accentColor = styleDefaults?.palette?.accent ?? "#111827";
  const toolbarAccent = styleDefaults?.palette?.accent ?? "#7c3aed";
  const onSelectionChangeRef = React.useRef<Props["onSelectionChange"]>(null);
  const [textToolbar, setTextToolbar] = React.useState<{
    left: number;
    top: number;
    id: string;
    variant: TextVariant;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    fill: string;
    fontWeight: number;
    fontStyle: "normal" | "italic";
    underline: boolean;
    linethrough: boolean;
    textAlign: "left" | "center" | "right" | "justify";
    stroke: string | null;
    strokeWidth: number;
    markerActive: boolean;
    markerColor: string;
    markerHeight: number;
    markerAngle: number;
  } | null>(null);
  const [imageToolbar, setImageToolbar] = React.useState<{
    left: number;
    top: number;
    id: string;
    cornerRounding: number;
    strokeWeight: NonNullable<SlideObjectV1["strokeWeight"]>;
    strokeColor: string;
    filterColor: string;
    filterOpacity: number;
  } | null>(null);
  const textToolbarRef = React.useRef<HTMLDivElement | null>(null);
  const imageToolbarRef = React.useRef<HTMLDivElement | null>(null);
  const textToolbarSizeRef = React.useRef({ width: 720, height: 84 });
  const imageToolbarSizeRef = React.useRef({ width: 520, height: 44 });
  const imageToolbarVisibleRef = React.useRef(false);
  const textSelectionRef = React.useRef<
    Record<string, { start: number; end: number; at: number; textLength: number }>
  >({});
  const toolbarRafRef = React.useRef<number | null>(null);
  const [fontSizeDraft, setFontSizeDraft] = React.useState<string>("");
  const [fontSizeFocused, setFontSizeFocused] = React.useState(false);
  const [lineHeightDraft, setLineHeightDraft] = React.useState<string>("");
  const [lineHeightFocused, setLineHeightFocused] = React.useState(false);
  const [letterSpacingDraft, setLetterSpacingDraft] = React.useState<string>("");
  const [letterSpacingFocused, setLetterSpacingFocused] = React.useState(false);
  const [cornerRoundingDraft, setCornerRoundingDraft] = React.useState<string>("");
  const [cornerRoundingFocused, setCornerRoundingFocused] = React.useState(false);
  React.useEffect(() => {
    ensureTextboxMarkerPatch();
  }, []);
  React.useEffect(() => {
    // If the active image changes (or the toolbar disappears), reset transient
    // draft/focus state so sliders don't "stick" across different images.
    setCornerRoundingFocused(false);
    setCornerRoundingDraft("");
  }, [imageToolbar?.id]);

  React.useEffect(() => {
    imageToolbarVisibleRef.current = Boolean(imageToolbar);
  }, [imageToolbar]);

  React.useEffect(() => {
    if (!textToolbar) return;
    if (fontSizeFocused) return;
    setFontSizeDraft(String(Math.round(textToolbar.fontSize)));
  }, [fontSizeFocused, textToolbar?.fontSize]);

  React.useEffect(() => {
    if (!textToolbar) return;
    if (lineHeightFocused) return;
    setLineHeightDraft(String(textToolbar.lineHeight.toFixed(2)));
  }, [lineHeightFocused, textToolbar?.lineHeight]);

  React.useEffect(() => {
    if (!textToolbar) return;
    if (letterSpacingFocused) return;
    setLetterSpacingDraft(String(textToolbar.letterSpacing));
  }, [letterSpacingFocused, textToolbar?.letterSpacing]);

  React.useEffect(() => {
    if (!imageToolbar) return;
    if (cornerRoundingFocused) return;
    setCornerRoundingDraft(String(Math.round(imageToolbar.cornerRounding)));
  }, [cornerRoundingFocused, imageToolbar?.cornerRounding]);

  React.useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange ?? null;
  }, [onSelectionChange]);

  React.useEffect(() => {
    onSlideChangeRef.current = onSlideChange;
  }, [onSlideChange]);

  const emit = React.useCallback((next: SlideV1) => {
    // Keep the ref in sync immediately so Fabric event handlers that depend
    // on `slideRef.current` don't "revert" changes between rapid interactions
    // (e.g. resize → move before the debounced onSlideChange runs).
    slideRef.current = next;
    nextSlideRef.current = next;
    if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current);
    emitTimerRef.current = window.setTimeout(() => {
      if (nextSlideRef.current) onSlideChangeRef.current(nextSlideRef.current);
    }, 120);
  }, []);

  React.useEffect(() => {
    return () => {
      if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    slideRef.current = slide;
  }, [slide]);

  const loadImageElement = React.useCallback((url: string) => {
    const cached = imageElementCacheRef.current.get(url);
    if (cached) return Promise.resolve(cached);

    const inFlight = imagePromiseCacheRef.current.get(url);
    if (inFlight) return inFlight;

    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      const el = document.createElement("img");
      el.crossOrigin = "anonymous";
      el.decoding = "async";
      el.onload = () => {
        imagePromiseCacheRef.current.delete(url);
        imageElementCacheRef.current.set(url, el);
        resolve(el);
      };
      el.onerror = () => {
        imagePromiseCacheRef.current.delete(url);
        reject(new Error("failed to load image"));
      };
      el.src = url;
    });

    imagePromiseCacheRef.current.set(url, p);
    return p;
  }, []);

  const queueFontReflow = React.useCallback(
    (
      textbox: {
        initDimensions?: () => void;
        setCoords?: () => void;
        selectionStart?: number;
        selectionEnd?: number;
        isEditing?: boolean;
      },
      opts: {
        fontFamily?: string;
        fontWeight?: number;
        fontStyle?: "normal" | "italic";
        fontSize?: number;
        token?: number;
        selection?: { start: number; end: number } | null;
      }
    ) => {
      if (typeof document === "undefined" || !document.fonts?.load) return;
      const family = normalizeFontFamilyForUi(opts.fontFamily ?? "");
      if (!family) return;
      const weight =
        typeof opts.fontWeight === "number" && Number.isFinite(opts.fontWeight)
          ? opts.fontWeight
          : 400;
      const style = opts.fontStyle === "italic" ? "italic" : "normal";
      const size =
        typeof opts.fontSize === "number" && Number.isFinite(opts.fontSize)
          ? Math.max(12, opts.fontSize)
          : 40;
      const key = `${family}:${weight}:${style}`;
      let promise = fontLoadCacheRef.current.get(key);
      if (!promise) {
        const spec = `${style} ${weight} ${Math.round(size)}px "${family}"`;
        promise = document.fonts
          .load(spec)
          .then(() => {})
          .catch(() => {});
        fontLoadCacheRef.current.set(key, promise);
      }
      promise.then(() => {
        if (typeof opts.token === "number" && renderTokenRef.current !== opts.token) return;
        const canvas = fabricRef.current;
        if (!canvas) return;
        const selection = opts.selection;
        textbox.initDimensions?.();
        if (selection && textbox.isEditing) {
          textbox.selectionStart = selection.start;
          textbox.selectionEnd = selection.end;
        }
        textbox.setCoords?.();
        canvas.requestRenderAll();
      });
    },
    []
  );

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
    let coords = (active as unknown as { oCoords?: OCoords }).oCoords;
    if (!coords || !coords.tl) {
      (active as unknown as { setCoords?: () => void }).setCoords?.();
      coords = (active as unknown as { oCoords?: OCoords }).oCoords;
    }
    if (!coords || !coords.tl) {
      if ((active as unknown as { isEditing?: boolean }).isEditing) return;
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

    const slideW = clampNumber(slideRef.current.width, 1080);
    const slideH = clampNumber(slideRef.current.height, 1080);
    const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const scaleX = typeof vpt[0] === "number" && Number.isFinite(vpt[0]) ? vpt[0] : 1;
    const scaleY = typeof vpt[3] === "number" && Number.isFinite(vpt[3]) ? vpt[3] : scaleX;
    const tx = typeof vpt[4] === "number" && Number.isFinite(vpt[4]) ? vpt[4] : 0;
    const ty = typeof vpt[5] === "number" && Number.isFinite(vpt[5]) ? vpt[5] : 0;
    const slideLeft = tx / ratio;
    const slideTop = ty / ratio;
    const slideWidth = (slideW * scaleX) / ratio;
    const slideHeight = (slideH * scaleY) / ratio;
    const toolbarWidth = textToolbarSizeRef.current.width;
    const toolbarHeight = textToolbarSizeRef.current.height;
    const minLeft = slideLeft + 8;
    const maxLeft = slideLeft + slideWidth - toolbarWidth - 8;
    const left = Math.max(minLeft, Math.min(maxLeft, cssX));
    const preferTop = cssY - toolbarHeight - 8;
    const minTop = slideTop + 8;
    const maxTop = slideTop + slideHeight - toolbarHeight - 8;
    let top = preferTop < minTop ? cssY + 8 : preferTop;
    top = Math.max(minTop, Math.min(maxTop, top));

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
      stroke?: unknown;
      strokeWidth?: unknown;
      textBackgroundColor?: unknown;
      markerColor?: unknown;
      markerHeight?: unknown;
      markerAngle?: unknown;
    };

    const activeText = active as unknown as {
      isEditing?: boolean;
      selectionStart?: number;
      selectionEnd?: number;
      text?: string;
      getSelectionStyles?: (start?: number, end?: number) => Array<Record<string, unknown>>;
    };

    const isEditing = Boolean(activeText.isEditing);
    const selectionStart =
      typeof activeText.selectionStart === "number" ? activeText.selectionStart : 0;
    const selectionEnd =
      typeof activeText.selectionEnd === "number"
        ? activeText.selectionEnd
        : activeText.text?.length ?? 0;
    const textLength = typeof activeText.text === "string" ? activeText.text.length : 0;
    const lastSelection = textSelectionRef.current[id];
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const recentSelection =
      lastSelection && now - lastSelection.at < 1500 ? lastSelection : null;
    const hasLiveSelection = isEditing && selectionEnd > selectionStart;
    const selectionRange = hasLiveSelection
      ? { start: selectionStart, end: selectionEnd }
      : recentSelection &&
          recentSelection.end > recentSelection.start &&
          recentSelection.textLength === textLength
        ? { start: recentSelection.start, end: recentSelection.end }
        : null;
    const selectionIsFull =
      selectionRange &&
      selectionRange.start <= 0 &&
      selectionRange.end >= textLength &&
      textLength > 0;

    const selectionStyles =
      selectionRange && !selectionIsFull && typeof activeText.getSelectionStyles === "function"
        ? activeText.getSelectionStyles(selectionRange.start, selectionRange.end)
        : null;

    const resolveSelectionValue = <T,>(key: string, fallback: T): T => {
      if (!selectionStyles || selectionStyles.length === 0) return fallback;
      const values = selectionStyles
        .map((style) => (style as Record<string, unknown>)[key])
        .filter((value) => value !== undefined);
      if (values.length === 0) return fallback;
      const first = values[0];
      const allSame = values.every((value) => value === first);
      return allSame ? (first as T) : fallback;
    };

    const selectionFontFamily = resolveSelectionValue("fontFamily", any.fontFamily);
    const selectionFontSize = resolveSelectionValue("fontSize", any.fontSize);
    const selectionFontWeight = resolveSelectionValue("fontWeight", any.fontWeight);
    const selectionFontStyle = resolveSelectionValue("fontStyle", any.fontStyle);
    const selectionLineHeight = resolveSelectionValue("lineHeight", any.lineHeight);
    const selectionCharSpacing = resolveSelectionValue("charSpacing", any.charSpacing);
    const selectionFill = resolveSelectionValue("fill", any.fill);
    const selectionUnderline = resolveSelectionValue("underline", any.underline);
    const selectionLinethrough = resolveSelectionValue("linethrough", any.linethrough);
    const selectionStroke = resolveSelectionValue("stroke", any.stroke);
    const selectionStrokeWidth = resolveSelectionValue("strokeWidth", any.strokeWidth);
    const selectionTextBackground = resolveSelectionValue(
      "textBackgroundColor",
      any.textBackgroundColor
    );

    const variant =
      getObjectVariant(active) ??
      (id === "title"
        ? "title"
        : id === "cta"
          ? "cta"
          : id === "tagline"
            ? "tagline"
            : "body");

    const resolvedFamily =
      typeof selectionFontFamily === "string"
        ? normalizeFontFamilyForUi(selectionFontFamily)
        : "Inter";
    const fauxBold =
      isBebasNeueFamily(resolvedFamily) &&
      typeof selectionStrokeWidth === "number" &&
      selectionStrokeWidth > 0 &&
      typeof selectionStroke === "string" &&
      typeof selectionFill === "string" &&
      selectionStroke === selectionFill;
    const markerActive =
      typeof selectionTextBackground === "string"
        ? true
        : typeof any.textBackgroundColor === "string";
    const markerColor =
      typeof selectionTextBackground === "string"
        ? selectionTextBackground
        : typeof any.textBackgroundColor === "string"
          ? any.textBackgroundColor
          : typeof any.markerColor === "string"
            ? any.markerColor
            : DEFAULT_MARKER_COLOR;
    const markerHeight = clampNumberRange(
      any.markerHeight,
      0.25,
      1,
      DEFAULT_MARKER_HEIGHT
    );
    const markerAngle = clampNumberRange(
      any.markerAngle,
      -15,
      15,
      DEFAULT_MARKER_ANGLE
    );

    setTextToolbar({
      id,
      left,
      top,
      variant,
      fontFamily: resolvedFamily,
      fontSize: typeof selectionFontSize === "number" ? selectionFontSize : 34,
      lineHeight: typeof selectionLineHeight === "number" ? selectionLineHeight : 1.2,
      letterSpacing:
        typeof selectionCharSpacing === "number" && typeof selectionFontSize === "number"
          ? fromFabricCharSpacing(selectionCharSpacing, selectionFontSize)
          : 0,
      fill: typeof selectionFill === "string" ? selectionFill : "#111827",
      fontWeight: fauxBold
        ? 700
        : typeof selectionFontWeight === "number"
          ? selectionFontWeight
          : 600,
      fontStyle: selectionFontStyle === "italic" ? "italic" : "normal",
      underline: Boolean(selectionUnderline),
      linethrough: Boolean(selectionLinethrough),
      textAlign:
        any.textAlign === "center" || any.textAlign === "right" || any.textAlign === "justify"
          ? any.textAlign
          : "left",
      stroke: typeof selectionStroke === "string" ? selectionStroke : null,
      strokeWidth: typeof selectionStrokeWidth === "number" ? selectionStrokeWidth : 0,
      markerActive,
      markerColor,
      markerHeight,
      markerAngle
    });
  }, []);

  const updateImageToolbar = React.useCallback(() => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const active = canvas.getActiveObject() as FabricObject | null;
    if (!active || getObjectKind(active) !== "image") {
      setImageToolbar(null);
      return;
    }

    const id = getObjectId(active);
    if (!id) {
      setImageToolbar(null);
      return;
    }

    const raw = slideRef.current.objects.find((o) => o?.id === id);
    if (!raw || raw.type !== "image") {
      setImageToolbar(null);
      return;
    }

    type CoordPoint = { x: number; y: number };
    type OCoords = { tl: CoordPoint; tr: CoordPoint; br: CoordPoint; bl: CoordPoint };
    const coords = (active as unknown as { oCoords?: OCoords }).oCoords;
    if (!coords || !coords.tl) {
      setImageToolbar(null);
      return;
    }

    const xs = [coords.tl.x, coords.tr.x, coords.br.x, coords.bl.x].filter(
      (v: unknown) => typeof v === "number" && Number.isFinite(v)
    ) as number[];
    const ys = [coords.tl.y, coords.tr.y, coords.br.y, coords.bl.y].filter(
      (v: unknown) => typeof v === "number" && Number.isFinite(v)
    ) as number[];
    if (xs.length === 0 || ys.length === 0) {
      setImageToolbar(null);
      return;
    }

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    const upper = canvas.upperCanvasEl;
    const upperBox = upper.getBoundingClientRect();
    const ratio = upperBox.width > 0 ? upper.width / upperBox.width : 1;
    const cssX = minX / ratio;
    const cssY = minY / ratio;

    const slideW = clampNumber(slideRef.current.width, 1080);
    const slideH = clampNumber(slideRef.current.height, 1080);
    const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const scaleX = typeof vpt[0] === "number" && Number.isFinite(vpt[0]) ? vpt[0] : 1;
    const scaleY = typeof vpt[3] === "number" && Number.isFinite(vpt[3]) ? vpt[3] : scaleX;
    const tx = typeof vpt[4] === "number" && Number.isFinite(vpt[4]) ? vpt[4] : 0;
    const ty = typeof vpt[5] === "number" && Number.isFinite(vpt[5]) ? vpt[5] : 0;
    const slideLeft = tx / ratio;
    const slideTop = ty / ratio;
    const slideWidth = (slideW * scaleX) / ratio;
    const slideHeight = (slideH * scaleY) / ratio;
    const toolbarWidth = imageToolbarSizeRef.current.width;
    const toolbarHeight = imageToolbarSizeRef.current.height;
    const minLeft = slideLeft + 8;
    const maxLeft = slideLeft + slideWidth - toolbarWidth - 8;
    const left = Math.max(minLeft, Math.min(maxLeft, cssX));
    const preferTop = cssY - toolbarHeight - 8;
    const minTop = slideTop + 8;
    const maxTop = slideTop + slideHeight - toolbarHeight - 8;
    let top = preferTop < minTop ? cssY + 8 : preferTop;
    top = Math.max(minTop, Math.min(maxTop, top));

    const cornerRounding = clampNumberRange(raw.cornerRounding, 0, 100, 18);
    const strokeWeight =
      raw.strokeWeight === "thin" || raw.strokeWeight === "medium" || raw.strokeWeight === "thick"
        ? raw.strokeWeight
        : "none";
    const strokeColor =
      typeof raw.strokeColor === "string"
        ? raw.strokeColor
        : toolbarAccent;
    const filterColor =
      typeof raw.filterColor === "string" ? raw.filterColor : DEFAULT_IMAGE_FILTER_COLOR;
    const filterOpacity = clampNumberRange(raw.filterOpacity, 0, 1, 0);

    setImageToolbar({
      id,
      left,
      top,
      cornerRounding,
      strokeWeight,
      strokeColor,
      filterColor,
      filterOpacity
    });
  }, [toolbarAccent]);

  const updateTextToolbarRef = React.useRef<() => void>(() => {});
  const updateImageToolbarRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    updateTextToolbarRef.current = updateTextToolbar;
  }, [updateTextToolbar]);

  React.useEffect(() => {
    updateImageToolbarRef.current = updateImageToolbar;
  }, [updateImageToolbar]);

  const scheduleToolbarUpdate = React.useCallback(() => {
    if (toolbarRafRef.current) cancelAnimationFrame(toolbarRafRef.current);
    toolbarRafRef.current = requestAnimationFrame(() => {
      toolbarRafRef.current = null;
      updateTextToolbarRef.current();
      updateImageToolbarRef.current();
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!textToolbarRef.current) return;
    const rect = textToolbarRef.current.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return;
    if (rect.width <= 0 || rect.height <= 0) return;
    textToolbarSizeRef.current = { width: rect.width, height: rect.height };
    scheduleToolbarUpdate();
  }, [textToolbar?.id, textToolbar?.variant, scheduleToolbarUpdate]);

  React.useLayoutEffect(() => {
    if (!imageToolbarRef.current) return;
    const rect = imageToolbarRef.current.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return;
    if (rect.width <= 0 || rect.height <= 0) return;
    imageToolbarSizeRef.current = { width: rect.width, height: rect.height };
    scheduleToolbarUpdate();
  }, [imageToolbar?.id, imageToolbar?.strokeWeight, imageToolbar?.cornerRounding, scheduleToolbarUpdate]);

  React.useEffect(() => {
    if (!imageToolbarVisibleRef.current) return;
    scheduleToolbarUpdate();
  }, [scheduleToolbarUpdate, toolbarAccent]);

  const getActiveImageGroup = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    const active = canvas.getActiveObject() as FabricObject | null;
    if (!active || getObjectKind(active) !== "image") return null;
    return active as unknown as Group;
  }, []);

  const syncImageGroupAppearance = React.useCallback(
    (group: Group, raw: SlideObjectV1, meta: ImageMeta) => {
      // Prevent FitContentLayout from re-laying out children on every `.set()` call.
      // This was causing images to drift and bounding boxes to desync.
      ensureFixedLayoutManager(group);

      // Defensive: ensure appearance updates never "jump" the group around.
      const prevLeft = typeof group.left === "number" && Number.isFinite(group.left) ? group.left : 0;
      const prevTop = typeof group.top === "number" && Number.isFinite(group.top) ? group.top : 0;
      const prevScaleX =
        typeof (group as unknown as { scaleX?: unknown }).scaleX === "number" &&
        Number.isFinite((group as unknown as { scaleX: number }).scaleX)
          ? (group as unknown as { scaleX: number }).scaleX
          : 1;
      const prevScaleY =
        typeof (group as unknown as { scaleY?: unknown }).scaleY === "number" &&
        Number.isFinite((group as unknown as { scaleY: number }).scaleY)
          ? (group as unknown as { scaleY: number }).scaleY
          : 1;

      const iw = clampNumber(meta.naturalWidth, 1);
      const ih = clampNumber(meta.naturalHeight, 1);
      const frameW = clampNumber(raw.width, 400);
      const frameH = clampNumber(raw.height, frameW);

      const offsetX = clampNumber(raw.contentOffsetX, 0);
      const offsetY = clampNumber(raw.contentOffsetY, 0);

      const cornerValue = clampNumberRange(raw.cornerRounding, 0, 100, 18);
      const radiusPx = (Math.min(frameW, frameH) / 2) * (cornerValue / 100);

      const strokeWeight =
        raw.strokeWeight === "thin" || raw.strokeWeight === "medium" || raw.strokeWeight === "thick"
          ? raw.strokeWeight
          : "none";
      const strokeWidth = strokeWidthForWeight(strokeWeight);
      const strokeColor = typeof raw.strokeColor === "string" ? raw.strokeColor : accentColor;

      const contentW = Math.max(1, frameW);
      const contentH = Math.max(1, frameH);
      const crop = computeCoverCrop(iw, ih, contentW, contentH, offsetX, offsetY);

      const objects = group.getObjects() as unknown as FabricObject[];
      const contentGroup = objects.find(
        (o) => (o as unknown as { dojogramRole?: unknown }).dojogramRole === "content"
      ) as Group | undefined;
      if (contentGroup) ensureFixedLayoutManager(contentGroup);
      // Older builds used `group.clipPath` for rounding; clear it so stroke
      // can extend outside the image frame without being clipped.
      if (contentGroup && (group as unknown as { clipPath?: unknown }).clipPath) {
        (group as unknown as { clipPath?: unknown }).clipPath = undefined;
        (group as unknown as { dirty?: boolean }).dirty = true;
      }

      if (contentGroup) {
        const localLeft = -frameW / 2;
        const localTop = -frameH / 2;
        contentGroup.set({
          left: localLeft,
          top: localTop,
          originX: "left",
          originY: "top",
          width: contentW,
          height: contentH,
          scaleX: 1,
          scaleY: 1,
          objectCaching: false,
          selectable: false,
          evented: false
        });
        contentGroup.setCoords();
        (contentGroup as unknown as { dirty?: boolean }).dirty = true;
      }

      const contentObjects = contentGroup
        ? ((contentGroup.getObjects() as unknown) as FabricObject[])
        : objects;

      const imgObj = contentObjects.find((o) => (o as unknown as { type?: unknown }).type === "image") as
        | Image
        | undefined;
      if (imgObj) {
        // IMPORTANT: Fabric groups use a center-based local coordinate system.
        // With `group.originX/Y = left/top`, the group's top-left is at
        // (-frameW/2, -frameH/2) in local coordinates.
        const localLeft = -contentW / 2;
        const localTop = -contentH / 2;
        imgObj.set({
          left: localLeft,
          top: localTop,
          originX: "left",
          originY: "top",
          cropX: crop.cropX,
          cropY: crop.cropY,
          width: crop.cropW,
          height: crop.cropH,
          scaleX: crop.scale,
          scaleY: crop.scale,
          objectCaching: false,
          selectable: false,
          evented: false
        });
        const filterColor =
          typeof raw.filterColor === "string" ? raw.filterColor : DEFAULT_IMAGE_FILTER_COLOR;
        const filterOpacity = clampNumberRange(raw.filterOpacity, 0, 1, 0);
        const nextFilterKey =
          filterOpacity > 0 ? `${filterColor}:${filterOpacity.toFixed(3)}` : "none";
        const imageAny = imgObj as unknown as {
          filters?: unknown[];
          applyFilters?: () => void;
          dojogramFilterKey?: string;
        };
        if (imageAny.dojogramFilterKey !== nextFilterKey) {
          const currentFilters = Array.isArray(imageAny.filters) ? [...imageAny.filters] : [];
          const keptFilters = currentFilters.filter(
            (f) => (f as { type?: unknown })?.type !== "BlendColor"
          );
          if (filterOpacity > 0) {
            keptFilters.push(
              new filters.BlendColor({
                color: filterColor,
                mode: "multiply",
                alpha: filterOpacity
              })
            );
          }
          imageAny.filters = keptFilters;
          imageAny.applyFilters?.();
          imageAny.dojogramFilterKey = nextFilterKey;
        }
        (imgObj as unknown as { dirty?: boolean }).dirty = true;
      }

      const clipOwner = (contentGroup ?? group) as unknown as { clipPath?: unknown };
      const groupClip = clipOwner.clipPath as Rect | undefined;
      if (groupClip) {
        const localLeft = -contentW / 2;
        const localTop = -contentH / 2;
        groupClip.set({
          left: localLeft,
          top: localTop,
          originX: "left",
          originY: "top",
          width: contentW,
          height: contentH,
          rx: radiusPx,
          ry: radiusPx,
          absolutePositioned: false
        });
        (groupClip as unknown as { objectCaching?: boolean }).objectCaching = false;
        (groupClip as unknown as { setCoords?: () => void }).setCoords?.();
        (groupClip as unknown as { dirty?: boolean }).dirty = true;
      }

      const strokeRect = objects.find(
        (o) => (o as unknown as { dojogramRole?: unknown }).dojogramRole === "stroke"
      ) as Rect | undefined;
      if (strokeRect) {
        // Stroke is drawn INSIDE the frame so it stays aligned with the
        // selection/bounding box while the image remains full-bleed.
        const localLeft = -frameW / 2;
        const localTop = -frameH / 2;
        strokeRect.set({
          left: localLeft,
          top: localTop,
          originX: "left",
          originY: "top",
          width: frameW,
          height: frameH,
          rx: radiusPx,
          ry: radiusPx,
          stroke: strokeColor,
          strokeWidth,
          opacity: strokeWidth > 0 ? 1 : 0,
          fill: "rgba(0,0,0,0)",
          objectCaching: false,
          selectable: false,
          evented: false,
          strokeUniform: true,
          strokeLineJoin: "round"
        });
        if (strokeRect.clipPath) strokeRect.clipPath = undefined;
        strokeRect.setCoords();
        (strokeRect as unknown as { dirty?: boolean }).dirty = true;
      }

      // Ensure the group's width/height matches the frame so bounds/selection
      // stay aligned with the visible image.
      (group as unknown as { objectCaching?: boolean }).objectCaching = false;
      group.set({
        left: prevLeft,
        top: prevTop,
        scaleX: prevScaleX,
        scaleY: prevScaleY,
        width: frameW,
        height: frameH
      });
      group.setCoords();
      (group as unknown as { dirty?: boolean }).dirty = true;
      group.canvas?.requestRenderAll();
      return { normalizedOffsetX: crop.normalizedOffsetX, normalizedOffsetY: crop.normalizedOffsetY };
    },
    [accentColor]
  );

  const patchActiveImage = React.useCallback(
    (patch: Partial<SlideObjectV1>) => {
      const canvas = fabricRef.current;
      if (!canvas) return false;
      const group = getActiveImageGroup();
      if (!group) return false;
      const id = getObjectId(group as unknown as FabricObject);
      if (!id) return false;

      const currentSlide = slideRef.current;
      const rawObj = currentSlide.objects.find((o) => o?.id === id);
      if (!rawObj || rawObj.type !== "image") return false;

      const meta = getImageMeta(group as unknown as FabricObject);
      if (!meta) return false;

      const nextRaw: SlideObjectV1 = {
        ...rawObj,
        ...patch,
        cornerRounding:
          typeof patch.cornerRounding === "number"
            ? clampNumberRange(patch.cornerRounding, 0, 100, 18)
            : rawObj.cornerRounding,
        strokeWeight:
          patch.strokeWeight === "thin" || patch.strokeWeight === "medium" || patch.strokeWeight === "thick"
            ? patch.strokeWeight
            : patch.strokeWeight === "none"
              ? "none"
              : rawObj.strokeWeight,
        filterOpacity:
          typeof patch.filterOpacity === "number"
            ? clampNumberRange(patch.filterOpacity, 0, 1, rawObj.filterOpacity ?? 0)
            : rawObj.filterOpacity
      };
      if (typeof patch.strokeColor === "string") nextRaw.strokeColor = patch.strokeColor;
      if (typeof patch.filterColor === "string") nextRaw.filterColor = patch.filterColor;

      const normalized = syncImageGroupAppearance(group, nextRaw, meta);
      const nextObjects = currentSlide.objects.map((o) => {
        if (!o || o.id !== id) return o;
        return {
          ...nextRaw,
          contentOffsetX: normalized.normalizedOffsetX,
          contentOffsetY: normalized.normalizedOffsetY
        };
      });
      emit({ ...currentSlide, objects: nextObjects });
      scheduleToolbarUpdate();
      return true;
    },
    [emit, getActiveImageGroup, scheduleToolbarUpdate, syncImageGroupAppearance]
  );

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
        "lineHeight" in patch ||
        "letterSpacing" in patch;

      if (typeof patch.variant === "string") setObjectVariant(active, patch.variant);

      const isEditing = Boolean((active as unknown as { isEditing?: boolean }).isEditing);
      const activeText = active as unknown as {
        fontFamily?: string;
        fontSize?: number;
        fill?: string;
        fontWeight?: number;
        fontStyle?: "normal" | "italic";
        lineHeight?: number;
        charSpacing?: number;
        underline?: boolean;
        linethrough?: boolean;
        textBackgroundColor?: string | null;
        markerColor?: string;
        markerHeight?: number;
        markerAngle?: number;
        textAlign?: SlideObjectV1["textAlign"];
        styles?: Record<string, unknown>;
        selectionStart?: number;
        selectionEnd?: number;
        width?: number;
        left?: number;
        top?: number;
        setSelectionStyles?: (
          styles: Record<string, unknown>,
          start?: number,
          end?: number
        ) => void;
        getSelectionStyles?: (
          start?: number,
          end?: number
        ) => Array<Record<string, unknown>>;
        initDimensions?: () => void;
        setCoords?: () => void;
        dirty?: boolean;
        text?: string;
      };

      const prevWidth = typeof active.width === "number" ? active.width : undefined;
      const prevLeft = typeof active.left === "number" ? active.left : undefined;
      const prevTop = typeof active.top === "number" ? active.top : undefined;
      const prevAlign = activeText.textAlign;
      const preserveWidth = prevAlign !== "center" && prevAlign !== "right";
      const anchorX =
        typeof prevLeft === "number" && typeof prevWidth === "number"
          ? prevAlign === "center"
            ? prevLeft + prevWidth / 2
            : prevAlign === "right"
              ? prevLeft + prevWidth
              : prevLeft
          : null;

      const selectionStart =
        typeof activeText.selectionStart === "number" ? activeText.selectionStart : 0;
      const selectionEnd =
        typeof activeText.selectionEnd === "number"
          ? activeText.selectionEnd
          : activeText.text?.length ?? 0;
      const textLength = typeof activeText.text === "string" ? activeText.text.length : 0;
      const lastSelection = textSelectionRef.current[id];
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const recentSelection =
        lastSelection && now - lastSelection.at < 1500 ? lastSelection : null;
      const hasLiveSelection = isEditing && selectionEnd > selectionStart;
      const selectionRange = hasLiveSelection
        ? { start: selectionStart, end: selectionEnd }
        : recentSelection &&
            recentSelection.end > recentSelection.start &&
            recentSelection.textLength === textLength
          ? { start: recentSelection.start, end: recentSelection.end }
          : null;
      const selectionIsFull =
        selectionRange &&
        selectionRange.start <= 0 &&
        selectionRange.end >= textLength &&
        textLength > 0;
      const hasSelection = Boolean(selectionRange && !selectionIsFull);
      const selectionAnchor =
        isEditing &&
        typeof activeText.selectionStart === "number" &&
        typeof activeText.selectionEnd === "number"
          ? { start: activeText.selectionStart, end: activeText.selectionEnd }
          : null;
      const currentWeight =
        typeof activeText.fontWeight === "number" ? activeText.fontWeight : 400;
      const resolvedFontFamily =
        typeof patch.fontFamily === "string" ? patch.fontFamily : activeText.fontFamily;
      const wantsBold = typeof patch.fontWeight === "number" && patch.fontWeight >= 600;
      const wantsNormal = typeof patch.fontWeight === "number" && patch.fontWeight < 600;
      const isBebasNeue = isBebasNeueFamily(resolvedFontFamily);
      const resolvedFontWeight =
        typeof patch.fontWeight === "number"
          ? resolveFontWeightForFamily(resolvedFontFamily, patch.fontWeight)
          : undefined;
      const fauxBoldWidth = fauxBoldStrokeWidth(
        typeof patch.fontSize === "number" ? patch.fontSize : activeText.fontSize
      );
      const fauxBoldFill =
        typeof patch.fill === "string"
          ? patch.fill
          : typeof activeText.fill === "string"
            ? activeText.fill
            : "#111827";
      const normalizedWeightForFamily =
        typeof patch.fontFamily === "string" && !("fontWeight" in patch)
          ? resolveFontWeightForFamily(patch.fontFamily, currentWeight)
          : null;
      const markerColor =
        typeof patch.markerColor === "string"
          ? patch.markerColor
          : typeof activeText.markerColor === "string"
            ? activeText.markerColor
            : typeof activeText.textBackgroundColor === "string"
              ? activeText.textBackgroundColor
              : DEFAULT_MARKER_COLOR;
      const markerHeight =
        typeof patch.markerHeight === "number"
          ? clampNumberRange(patch.markerHeight, 0.25, 1, DEFAULT_MARKER_HEIGHT)
          : clampNumberRange(activeText.markerHeight, 0.25, 1, DEFAULT_MARKER_HEIGHT);
      const markerAngle =
        typeof patch.markerAngle === "number"
          ? clampNumberRange(patch.markerAngle, -15, 15, DEFAULT_MARKER_ANGLE)
          : clampNumberRange(activeText.markerAngle, -15, 15, DEFAULT_MARKER_ANGLE);
      const wantsMarkerToggle = "textBackgroundColor" in patch;
      const nextMarkerValue =
        wantsMarkerToggle && typeof patch.textBackgroundColor === "string"
          ? patch.textBackgroundColor
          : wantsMarkerToggle
            ? null
            : null;
      const shouldUpdateMarkerColor =
        typeof patch.markerColor === "string" &&
        typeof activeText.textBackgroundColor === "string";

      if (!hasSelection && typeof patch.fontFamily === "string") {
        activeText.fontFamily = toFontStack(patch.fontFamily);
        if (
          isBebasNeue &&
          typeof normalizedWeightForFamily === "number" &&
          normalizedWeightForFamily !== currentWeight
        ) {
          activeText.fontWeight = normalizedWeightForFamily;
          if (currentWeight >= 600) {
            (active as unknown as { stroke?: string }).stroke = fauxBoldFill;
            (active as unknown as { strokeWidth?: number }).strokeWidth = fauxBoldWidth;
            (active as unknown as { strokeLineJoin?: string }).strokeLineJoin = "round";
          } else {
            const currentStroke = (active as unknown as { stroke?: unknown }).stroke;
            if (currentStroke === fauxBoldFill) {
              (active as unknown as { stroke?: string }).stroke = undefined;
              (active as unknown as { strokeWidth?: number }).strokeWidth = 0;
            }
          }
        }
      }
      if (!hasSelection && typeof patch.fontSize === "number") {
        activeText.fontSize = patch.fontSize;
      }
      if (!hasSelection && typeof patch.fill === "string") {
        activeText.fill = patch.fill;
      }
      if (!hasSelection && typeof resolvedFontWeight === "number") {
        activeText.fontWeight = resolvedFontWeight;
      }
      if (!hasSelection && typeof patch.fontStyle === "string") {
        activeText.fontStyle = patch.fontStyle;
      }
      if (!hasSelection && typeof patch.lineHeight === "number") {
        activeText.lineHeight = patch.lineHeight;
      }
      if (!hasSelection && typeof patch.letterSpacing === "number") {
        const size = typeof activeText.fontSize === "number" ? activeText.fontSize : 34;
        activeText.charSpacing = toFabricCharSpacing(patch.letterSpacing, size);
      }
      if (!hasSelection && typeof patch.underline === "boolean") {
        activeText.underline = patch.underline;
      }
      if (!hasSelection && typeof patch.linethrough === "boolean") {
        activeText.linethrough = patch.linethrough;
      }
      if (!hasSelection && wantsMarkerToggle) {
        activeText.textBackgroundColor =
          typeof nextMarkerValue === "string" ? nextMarkerValue : undefined;
      }
      if (!hasSelection && shouldUpdateMarkerColor) {
        activeText.textBackgroundColor = markerColor;
      }
      if (typeof patch.markerColor === "string") {
        activeText.markerColor = patch.markerColor;
      }
      if (typeof patch.markerHeight === "number") {
        activeText.markerHeight = markerHeight;
      }
      if (typeof patch.markerAngle === "number") {
        activeText.markerAngle = markerAngle;
      }
      if (typeof patch.textAlign === "string") {
        activeText.textAlign = patch.textAlign;
      }
      if (!hasSelection && (typeof patch.stroke === "string" || patch.stroke === null)) {
        (active as unknown as { stroke?: string }).stroke = patch.stroke ?? undefined;
      }
      if (!hasSelection && typeof patch.strokeWidth === "number") {
        (active as unknown as { strokeWidth?: number }).strokeWidth = patch.strokeWidth;
      }
      if (!hasSelection && typeof patch.strokeLineJoin === "string") {
        (active as unknown as { strokeLineJoin?: string }).strokeLineJoin = patch.strokeLineJoin;
      }
      if (!hasSelection && isBebasNeue && wantsBold) {
        (active as unknown as { stroke?: string }).stroke = fauxBoldFill;
        (active as unknown as { strokeWidth?: number }).strokeWidth = fauxBoldWidth;
        (active as unknown as { strokeLineJoin?: string }).strokeLineJoin = "round";
      }
      if (!hasSelection && isBebasNeue && wantsNormal) {
        const currentStroke = (active as unknown as { stroke?: unknown }).stroke;
        if (currentStroke === fauxBoldFill) {
          (active as unknown as { stroke?: string }).stroke = undefined;
          (active as unknown as { strokeWidth?: number }).strokeWidth = 0;
        }
      }

      if (hasSelection && typeof activeText.setSelectionStyles === "function" && selectionRange) {
        const start = selectionRange.start;
        const end = selectionRange.end;
        const selectionStyles: Record<string, unknown> = {};
        const selectionHasMarker =
          (wantsMarkerToggle || typeof patch.markerColor === "string") &&
          typeof activeText.getSelectionStyles === "function"
            ? activeText
                .getSelectionStyles(start, end)
                .some(
                  (style) =>
                    typeof (style as Record<string, unknown>)?.textBackgroundColor === "string"
                )
            : false;
        if (typeof patch.fill === "string") selectionStyles.fill = patch.fill;
        if (typeof resolvedFontWeight === "number")
          selectionStyles.fontWeight = resolvedFontWeight;
        if (typeof patch.fontStyle === "string") selectionStyles.fontStyle = patch.fontStyle;
        if (typeof patch.underline === "boolean") selectionStyles.underline = patch.underline;
        if (typeof patch.linethrough === "boolean")
          selectionStyles.linethrough = patch.linethrough;
        if (wantsMarkerToggle) selectionStyles.textBackgroundColor = nextMarkerValue;
        if (typeof patch.markerColor === "string" && selectionHasMarker) {
          selectionStyles.textBackgroundColor = patch.markerColor;
        }
        if (typeof patch.fontFamily === "string")
          selectionStyles.fontFamily = toFontStack(patch.fontFamily);
        if (typeof patch.fontSize === "number") selectionStyles.fontSize = patch.fontSize;
        if (typeof patch.lineHeight === "number") selectionStyles.lineHeight = patch.lineHeight;
        if (typeof patch.letterSpacing === "number") {
          const size = typeof activeText.fontSize === "number" ? activeText.fontSize : 34;
          selectionStyles.charSpacing = toFabricCharSpacing(patch.letterSpacing, size);
        }
        if (typeof patch.stroke === "string" || patch.stroke === null) {
          selectionStyles.stroke = patch.stroke ?? undefined;
        }
        if (typeof patch.strokeWidth === "number") {
          selectionStyles.strokeWidth = patch.strokeWidth;
        }
        if (typeof patch.strokeLineJoin === "string") {
          selectionStyles.strokeLineJoin = patch.strokeLineJoin;
        }
        if (isBebasNeue && wantsBold) {
          selectionStyles.stroke = fauxBoldFill;
          selectionStyles.strokeWidth = fauxBoldWidth;
          selectionStyles.strokeLineJoin = "round";
        }
        if (isBebasNeue && wantsNormal) {
          selectionStyles.stroke = null;
          selectionStyles.strokeWidth = 0;
        }
        if (Object.keys(selectionStyles).length > 0) {
          activeText.setSelectionStyles(selectionStyles, start, end);
        }
      }

      if (!hasSelection && activeText.styles && Object.keys(activeText.styles).length > 0) {
        const styleKeysToStrip: string[] = [];
        if ("fill" in patch) styleKeysToStrip.push("fill");
        if ("fontWeight" in patch) styleKeysToStrip.push("fontWeight");
        if ("fontStyle" in patch) styleKeysToStrip.push("fontStyle");
        if ("underline" in patch) styleKeysToStrip.push("underline");
        if ("linethrough" in patch) styleKeysToStrip.push("linethrough");
        if ("fontFamily" in patch) styleKeysToStrip.push("fontFamily");
        if ("fontSize" in patch) styleKeysToStrip.push("fontSize");
        if ("lineHeight" in patch) styleKeysToStrip.push("lineHeight");
        if ("letterSpacing" in patch) styleKeysToStrip.push("charSpacing");
        if ("stroke" in patch) styleKeysToStrip.push("stroke");
        if ("strokeWidth" in patch) styleKeysToStrip.push("strokeWidth");
        if ("strokeLineJoin" in patch) styleKeysToStrip.push("strokeLineJoin");
        if ("textBackgroundColor" in patch) styleKeysToStrip.push("textBackgroundColor");
        if ("markerColor" in patch) styleKeysToStrip.push("textBackgroundColor");
        if (isBebasNeue && "fontWeight" in patch) {
          styleKeysToStrip.push("stroke", "strokeWidth", "strokeLineJoin");
        }
        if (styleKeysToStrip.length > 0) {
          const cleaned = stripTextStyleKeys(
            activeText.styles as TextStyleMap,
            styleKeysToStrip
          );
          activeText.styles = cleaned ?? {};
        }
      }

      const alignChanged =
        typeof patch.textAlign === "string" && patch.textAlign !== prevAlign;
      const shouldInitDimensions = affectsLayout || alignChanged;
      if (preserveWidth && typeof prevWidth === "number") {
        activeText.width = prevWidth;
      }
      if (shouldInitDimensions) {
        activeText.initDimensions?.();
        if (selectionAnchor && isEditing) {
          activeText.selectionStart = selectionAnchor.start;
          activeText.selectionEnd = selectionAnchor.end;
        }
      }
      if (preserveWidth && typeof prevWidth === "number") {
        activeText.width = prevWidth;
      }
      const nextWidth =
        typeof activeText.width === "number" ? activeText.width : prevWidth;
      if (typeof prevTop === "number") {
        activeText.top = prevTop;
      }
      if (anchorX !== null && typeof nextWidth === "number") {
        if (prevAlign === "center") {
          activeText.left = anchorX - nextWidth / 2;
        } else if (prevAlign === "right") {
          activeText.left = anchorX - nextWidth;
        } else if (typeof prevLeft === "number") {
          activeText.left = prevLeft;
        }
      } else if (typeof prevLeft === "number") {
        activeText.left = prevLeft;
      }
      activeText.dirty = true;
      activeText.setCoords?.();
      canvas.requestRenderAll();
      if (isBebasNeue) {
        queueFontReflow(activeText, {
          fontFamily: resolvedFontFamily,
          fontWeight:
            typeof resolvedFontWeight === "number"
              ? resolvedFontWeight
              : typeof activeText.fontWeight === "number"
                ? activeText.fontWeight
                : undefined,
          fontStyle: activeText.fontStyle,
          fontSize: activeText.fontSize,
          selection: selectionAnchor,
          token: undefined
        });
      }

      const normalizedHeight =
        typeof (active as unknown as { height?: unknown }).height === "number"
          ? Math.round((active as unknown as { height: number }).height)
          : undefined;
      const normalizedWidth =
        typeof (active as unknown as { width?: unknown }).width === "number"
          ? Math.round((active as unknown as { width: number }).width)
          : undefined;
      const styleSnapshot = cloneTextStyles(activeText.styles);
      const nextStyles = styleSnapshot && Object.keys(styleSnapshot).length > 0 ? styleSnapshot : null;
      const patchForSlide: Partial<SlideObjectV1> = { ...patch };
      if (typeof patch.markerColor === "string") patchForSlide.markerColor = markerColor;
      if (typeof patch.markerHeight === "number") patchForSlide.markerHeight = markerHeight;
      if (typeof patch.markerAngle === "number") patchForSlide.markerAngle = markerAngle;
      if (wantsMarkerToggle) patchForSlide.textBackgroundColor = nextMarkerValue;
      if (!hasSelection && shouldUpdateMarkerColor) {
        patchForSlide.textBackgroundColor = markerColor;
      }
      if (hasSelection) {
        delete patchForSlide.fontFamily;
        delete patchForSlide.fontSize;
        delete patchForSlide.fill;
        delete patchForSlide.fontWeight;
        delete patchForSlide.fontStyle;
        delete patchForSlide.lineHeight;
        delete patchForSlide.letterSpacing;
        delete patchForSlide.underline;
        delete patchForSlide.linethrough;
        delete patchForSlide.stroke;
        delete patchForSlide.strokeWidth;
        delete patchForSlide.strokeLineJoin;
        delete patchForSlide.textBackgroundColor;
      } else if (typeof resolvedFontWeight === "number") {
        patchForSlide.fontWeight = resolvedFontWeight;
      }
      if (!hasSelection && isBebasNeue && "fontWeight" in patch) {
        patchForSlide.stroke = wantsBold ? fauxBoldFill : null;
        patchForSlide.strokeWidth = wantsBold ? fauxBoldWidth : 0;
        patchForSlide.strokeLineJoin = "round";
      }

      const currentSlide = slideRef.current;
      const nextObjects = (currentSlide.objects ?? []).map((o) => {
        if (!o || o.id !== id) return o;
        return {
          ...o,
          ...patchForSlide,
          ...(typeof normalizedHeight === "number" ? { height: normalizedHeight } : null),
          ...(typeof normalizedWidth === "number" ? { width: normalizedWidth } : null),
          styles: nextStyles ?? undefined
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
  }, [
    assetUrlsById,
    emit,
    loadImageElement,
    queueFontReflow,
    renderKey,
    styleDefaults?.palette?.accent,
    syncImageGroupAppearance
  ]);

  const copySelection = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    if (isAnyEditing(canvas)) return false;
    const ids = getActiveIds(canvas);
    if (ids.length === 0) return false;

    const currentSlide = slideRef.current;
    const selected = (currentSlide.objects ?? []).filter((o) => o?.id && ids.includes(o.id));
    if (selected.length === 0) return false;
    clipboardRef.current = {
      objects: selected.map((o) => ({ ...o })),
      pasteN: 0,
      slideKey: renderKey ?? null
    };
    return true;
  }, [renderKey]);

  const paste = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    if (isAnyEditing(canvas)) return false;

    const clip = clipboardRef.current;
    if (!clip || clip.objects.length === 0) return false;
    const sameSlide = clip.slideKey === renderKey;
    clip.pasteN += 1;
    const dx = sameSlide ? 24 * clip.pasteN : 0;
    const dy = sameSlide ? 24 * clip.pasteN : 0;

    const currentSlide = slideRef.current;
    const nextObjects = [...(currentSlide.objects ?? [])];
    const slideW = clampNumber(currentSlide.width, 1080);
    let lastPastedId: string | null = null;

    for (const o of clip.objects) {
      if (o.type === "text") {
        const id = createId("text");
        const text = o.text ?? "";
        const x = clampNumber(o.x, 80) + dx;
        const y = clampNumber(o.y, 240) + dy;
        const width = clampNumber(o.width, 560);
        const rawStyleSnapshot = cloneTextStyles(o.styles);
        const styleSnapshot = isBebasNeueFamily(o.fontFamily)
          ? normalizeBebasNeueStyles(
              rawStyleSnapshot,
              o.fill ?? "#111827",
              clampNumber(o.fontSize, 48)
            )
          : rawStyleSnapshot;
        const markerHeight = clampNumberRange(
          o.markerHeight,
          0.25,
          1,
          DEFAULT_MARKER_HEIGHT
        );
        const markerAngle = clampNumberRange(
          o.markerAngle,
          -15,
          15,
          DEFAULT_MARKER_ANGLE
        );
        const markerColor =
          typeof o.markerColor === "string"
            ? o.markerColor
            : typeof o.textBackgroundColor === "string"
              ? o.textBackgroundColor
              : DEFAULT_MARKER_COLOR;
        const textBackgroundColor =
          typeof o.textBackgroundColor === "string" ? o.textBackgroundColor : null;
        const resolvedWeight = resolveFontWeightForFamily(
          o.fontFamily,
          clampNumber(o.fontWeight, 600)
        );

        const textbox = new Textbox(text, {
          left: x,
          top: y,
          width,
          originX: "left",
          originY: "top",
          fontFamily: toFontStack(o.fontFamily),
          fontSize: clampNumber(o.fontSize, 48),
          fontWeight: resolvedWeight,
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
          stroke: typeof o.stroke === "string" ? o.stroke : undefined,
          strokeWidth:
            typeof o.strokeWidth === "number" && Number.isFinite(o.strokeWidth)
              ? o.strokeWidth
              : 0,
          strokeLineJoin:
            typeof o.strokeLineJoin === "string" ? o.strokeLineJoin : "round",
          textBackgroundColor: textBackgroundColor ?? undefined,
          styles: styleSnapshot ?? undefined,
          editable: true
        });
        (textbox as unknown as { markerHeight?: number }).markerHeight = markerHeight;
        (textbox as unknown as { markerAngle?: number }).markerAngle = markerAngle;
        (textbox as unknown as { markerColor?: string }).markerColor = markerColor;
        textbox.initDimensions();
        setObjectId(textbox, id);
        setObjectVariant(textbox, (o.variant as TextVariant) ?? "body");
        canvas.add(textbox);
        queueFontReflow(textbox, {
          fontFamily: o.fontFamily,
          fontWeight: resolvedWeight,
          fontStyle: o.fontStyle ?? "normal",
          fontSize: clampNumber(o.fontSize, 48)
        });

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
        lastPastedId = id;
        continue;
      }
      if (o.type !== "image") continue;
      const id = createId("image");
      const assetId = typeof o.assetId === "string" ? o.assetId : null;
      if (!assetId) continue;
      const url =
        typeof assetUrlsById?.[assetId] === "string" ? assetUrlsById?.[assetId] : null;
      const x = clampNumber(o.x, 0) + dx;
      const y = clampNumber(o.y, 0) + dy;
      const width = clampNumber(o.width, Math.max(1, slideW - 160));
      const height = clampNumber(o.height, Math.max(1, width));
      const nextRaw: SlideObjectV1 = {
        ...o,
        id,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      };
      nextObjects.push(nextRaw);
      lastPastedId = id;
      if (!url) continue;

      loadImageElement(url)
        .then((el) => {
          const liveCanvas = fabricRef.current;
          if (!liveCanvas) return;
          const iw = clampNumber(el.naturalWidth, 1);
          const ih = clampNumber(el.naturalHeight, 1);
          const meta: ImageMeta = { naturalWidth: iw, naturalHeight: ih };
          const offsetX = clampNumber(nextRaw.contentOffsetX, 0);
          const offsetY = clampNumber(nextRaw.contentOffsetY, 0);
          const cornerValue = clampNumberRange(nextRaw.cornerRounding, 0, 100, 18);
          const radiusPx = (Math.min(width, height) / 2) * (cornerValue / 100);
          const strokeWeight =
            nextRaw.strokeWeight === "thin" ||
            nextRaw.strokeWeight === "medium" ||
            nextRaw.strokeWeight === "thick"
              ? nextRaw.strokeWeight
              : "none";
          const strokeWidth = strokeWidthForWeight(strokeWeight);
          const strokeColor =
            typeof nextRaw.strokeColor === "string"
              ? nextRaw.strokeColor
              : styleDefaults?.palette?.accent ?? "#7c3aed";
          const contentW = Math.max(1, width);
          const contentH = Math.max(1, height);
          const crop = computeCoverCrop(iw, ih, contentW, contentH, offsetX, offsetY);
          const img = new Image(el);
          const localLeft = -width / 2;
          const localTop = -height / 2;
          const contentLeft = localLeft;
          const contentTop = localTop;
          const contentLocalLeft = -contentW / 2;
          const contentLocalTop = -contentH / 2;
          img.set({
            left: contentLocalLeft,
            top: contentLocalTop,
            originX: "left",
            originY: "top",
            cropX: crop.cropX,
            cropY: crop.cropY,
            width: crop.cropW,
            height: crop.cropH,
            scaleX: crop.scale,
            scaleY: crop.scale,
            objectCaching: false,
            selectable: false,
            evented: false
          });

          const strokeRect = new Rect({
            left: localLeft,
            top: localTop,
            originX: "left",
            originY: "top",
            width: Math.max(1, width),
            height: Math.max(1, height),
            rx: radiusPx,
            ry: radiusPx,
            fill: "rgba(0,0,0,0)",
            opacity: strokeWidth > 0 ? 1 : 0,
            objectCaching: false,
            selectable: false,
            evented: false,
            strokeUniform: true,
            stroke: strokeColor,
            strokeWidth,
            strokeLineJoin: "round"
          });
          (strokeRect as unknown as { dojogramRole?: string }).dojogramRole = "stroke";

          const contentClip = new Rect({
            left: contentLocalLeft,
            top: contentLocalTop,
            originX: "left",
            originY: "top",
            width: contentW,
            height: contentH,
            rx: radiusPx,
            ry: radiusPx,
            objectCaching: false,
            absolutePositioned: false
          });

          const content = new Group([img], {
            left: contentLeft,
            top: contentTop,
            originX: "left",
            originY: "top",
            width: contentW,
            height: contentH,
            layoutManager: new LayoutManager(new FixedLayout()),
            clipPath: contentClip,
            objectCaching: false,
            selectable: false,
            evented: false
          });
          (content as unknown as { dojogramRole?: string }).dojogramRole = "content";

          const frame = new Group([content, strokeRect], {
            left: x,
            top: y,
            originX: "left",
            originY: "top",
            width,
            height,
            layoutManager: new LayoutManager(new FixedLayout()),
            objectCaching: false
          });
          configureImageFrameControls(frame);
          setObjectId(frame as unknown as FabricObject, id);
          setObjectKind(frame as unknown as FabricObject, "image");
          setImageMeta(frame as unknown as FabricObject, meta);
          syncImageGroupAppearance(frame, nextRaw, meta);
          liveCanvas.add(frame);
          liveCanvas.sendObjectToBack(frame);
          frame.setCoords();
          if (lastPastedId === id) {
            liveCanvas.setActiveObject(frame as unknown as FabricObject);
          }
          liveCanvas.requestRenderAll();
        })
        .catch(() => {});
    }

    const lastId = lastPastedId ?? null;
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
  const clearSelection = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    return true;
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
      clearSelection,
      exportPngDataUrl
    }),
    [
      addText,
      clearSelection,
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
    canvas.selectionKey = ["shiftKey", "metaKey", "ctrlKey"];

    const emitSelection = () => {
      const cb = onSelectionChangeRef.current;
      const ids = getActiveIds(canvas);
      cb?.(ids);
      scheduleToolbarUpdate();
    };

    const onEditingEntered = (e: { target?: FabricObject }) => {
      const target = e.target as unknown as { initDimensions?: () => void } | undefined;
      target?.initDimensions?.();
      if (target) {
        const textAny = target as unknown as {
          fontFamily?: string;
          fontWeight?: number;
          fontStyle?: "normal" | "italic";
          fontSize?: number;
        };
        if (typeof textAny.fontFamily === "string") {
          queueFontReflow(target, {
            fontFamily: textAny.fontFamily,
            fontWeight: textAny.fontWeight,
            fontStyle: textAny.fontStyle,
            fontSize: textAny.fontSize
          });
        }
      }
      canvas.calcOffset();
      canvas.requestRenderAll();
    };

    const onEditingExited = (e: { target?: FabricObject }) => {
      if (isHydratingRef.current) return;
      const target = e.target;
      if (!target) return;

      const id = getObjectId(target);
      if (!id) return;
      delete textSelectionRef.current[id];

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

    const onSelectionChanged = (e: { target?: FabricObject }) => {
      const target = e.target as
        | (FabricObject & {
            selectionStart?: number;
            selectionEnd?: number;
            text?: string;
            isEditing?: boolean;
          })
        | undefined;
      if (!target || (target as unknown as { type?: unknown }).type !== "textbox") return;
      if (!target.isEditing) return;
      const id = getObjectId(target as FabricObject);
      if (!id) return;
      const start = typeof target.selectionStart === "number" ? target.selectionStart : 0;
      const end =
        typeof target.selectionEnd === "number"
          ? target.selectionEnd
          : target.text?.length ?? 0;
      const textLength = typeof target.text === "string" ? target.text.length : 0;
      if (end > start) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        textSelectionRef.current[id] = { start, end, at: now, textLength };
      } else {
        delete textSelectionRef.current[id];
      }
      scheduleToolbarUpdate();
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
        const slideW = clampNumber(slideRef.current.width, 1080);
        const slideH = clampNumber(slideRef.current.height, 1080);
        const rect =
          typeof (target as unknown as { getBoundingRect?: unknown }).getBoundingRect === "function"
            ? (target as unknown as {
                getBoundingRect: () => { left: number; top: number; width: number; height: number };
              }).getBoundingRect()
            : {
                left: clampNumber(target.left, 0),
                top: clampNumber(target.top, 0),
                width: clampNumber(target.width, 1),
                height: clampNumber(target.height, 1)
              };
        const outside =
          rect.left > slideW ||
          rect.top > slideH ||
          rect.left + rect.width < 0 ||
          rect.top + rect.height < 0;
        if (outside) {
          const liveCanvas = fabricRef.current;
          if (liveCanvas) {
            liveCanvas.remove(target);
            liveCanvas.requestRenderAll();
          }
          const nextObjects = currentSlide.objects.filter((o) => o?.id !== id);
          emit({ ...currentSlide, objects: nextObjects });
          scheduleToolbarUpdate();
          return;
        }
      }
      if (rawObj?.type === "image") {
        const group = target as unknown as Group;
        const meta = getImageMeta(target);

        const baseW =
          typeof rawObj.width === "number" && Number.isFinite(rawObj.width)
            ? rawObj.width
            : typeof target.width === "number" && Number.isFinite(target.width)
              ? target.width
              : 1;
        const baseH =
          typeof rawObj.height === "number" && Number.isFinite(rawObj.height)
            ? rawObj.height
            : typeof target.height === "number" && Number.isFinite(target.height)
              ? target.height
              : 1;

        const scaledWidth = Math.max(1, Math.round(baseW * scaleX));
        const scaledHeight = Math.max(1, Math.round(baseH * scaleY));

        const nextRaw: SlideObjectV1 = {
          ...rawObj,
          x: Math.round(left),
          y: Math.round(top),
          width: scaledWidth,
          height: scaledHeight
        };

        // Normalize Fabric scaling back into explicit width/height.
        group.set({ scaleX: 1, scaleY: 1 });

        let normalizedOffsetX = clampNumber(rawObj.contentOffsetX, 0);
        let normalizedOffsetY = clampNumber(rawObj.contentOffsetY, 0);
        if (meta) {
          const normalized = syncImageGroupAppearance(group, nextRaw, meta);
          normalizedOffsetX = normalized.normalizedOffsetX;
          normalizedOffsetY = normalized.normalizedOffsetY;
        }

        const nextObjects = currentSlide.objects.map((o) => {
          if (!o || o.id !== id) return o;
          return {
            ...nextRaw,
            contentOffsetX: normalizedOffsetX,
            contentOffsetY: normalizedOffsetY
          };
        });
        emit({ ...currentSlide, objects: nextObjects });
        scheduleToolbarUpdate();
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
        if (typeof (target as unknown as { stroke?: unknown }).stroke === "string") {
          next.stroke = String((target as unknown as { stroke?: unknown }).stroke);
        } else {
          next.stroke = undefined;
        }
        if (typeof (target as unknown as { strokeWidth?: unknown }).strokeWidth === "number") {
          next.strokeWidth = clampNumber(
            (target as unknown as { strokeWidth?: unknown }).strokeWidth,
            0
          );
        } else {
          next.strokeWidth = undefined;
        }
        if (typeof (target as unknown as { strokeLineJoin?: unknown }).strokeLineJoin === "string") {
          next.strokeLineJoin = String(
            (target as unknown as { strokeLineJoin?: unknown }).strokeLineJoin
          );
        } else {
          next.strokeLineJoin = undefined;
        }
        const rawStyles = (target as unknown as { styles?: unknown }).styles;
        const styleSnapshot = cloneTextStyles(rawStyles);
        if (styleSnapshot && Object.keys(styleSnapshot).length > 0) {
          next.styles = styleSnapshot;
        } else {
          next.styles = undefined;
        }
        next.underline = Boolean((target as unknown as { underline?: unknown }).underline);
        next.linethrough = Boolean(
          (target as unknown as { linethrough?: unknown }).linethrough
        );
        const rawTextBackground = (target as unknown as { textBackgroundColor?: unknown })
          .textBackgroundColor;
        if (typeof rawTextBackground === "string") {
          next.textBackgroundColor = rawTextBackground;
        } else {
          next.textBackgroundColor = null;
        }
        const rawMarkerColor = (target as unknown as { markerColor?: unknown }).markerColor;
        if (typeof rawMarkerColor === "string") {
          next.markerColor = rawMarkerColor;
        } else if (typeof rawTextBackground === "string") {
          next.markerColor = rawTextBackground;
        } else {
          next.markerColor = undefined;
        }
        const rawMarkerHeight = (target as unknown as { markerHeight?: unknown }).markerHeight;
        if (typeof rawMarkerHeight === "number") {
          next.markerHeight = clampNumberRange(rawMarkerHeight, 0.25, 1, DEFAULT_MARKER_HEIGHT);
        } else {
          next.markerHeight = undefined;
        }
        const rawMarkerAngle = (target as unknown as { markerAngle?: unknown }).markerAngle;
        if (typeof rawMarkerAngle === "number") {
          next.markerAngle = clampNumberRange(rawMarkerAngle, -15, 15, DEFAULT_MARKER_ANGLE);
        } else {
          next.markerAngle = undefined;
        }
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

    const guidesRef = { v: null as Line | null, h: null as Line | null };
    const ensureGuide = (axis: "v" | "h") => {
      const existing = guidesRef[axis];
      if (existing && existing.canvas === canvas) return existing;
      const line =
        axis === "v"
          ? new Line([0, 0, 0, 0], {
              stroke: "#a855f7",
              strokeWidth: 1,
              selectable: false,
              evented: false,
              excludeFromExport: true,
              strokeDashArray: [4, 4]
            })
          : new Line([0, 0, 0, 0], {
              stroke: "#a855f7",
              strokeWidth: 1,
              selectable: false,
              evented: false,
              excludeFromExport: true,
              strokeDashArray: [4, 4]
            });
      line.visible = false;
      canvas.add(line);
      if (typeof (canvas as unknown as { bringObjectToFront?: unknown }).bringObjectToFront === "function") {
        (canvas as unknown as { bringObjectToFront: (obj: FabricObject) => void }).bringObjectToFront(line);
      }
      guidesRef[axis] = line;
      return line;
    };
    const showGuides = (opts: { x: number | null; y: number | null }) => {
      const slideW = clampNumber(slideRef.current.width, 1080);
      const slideH = clampNumber(slideRef.current.height, 1080);
      if (opts.x !== null) {
        const v = ensureGuide("v");
        v.set({ x1: opts.x, x2: opts.x, y1: 0, y2: slideH, visible: true });
        if (typeof (canvas as unknown as { bringObjectToFront?: unknown }).bringObjectToFront === "function") {
          (canvas as unknown as { bringObjectToFront: (obj: FabricObject) => void }).bringObjectToFront(v);
        }
      } else if (guidesRef.v) {
        guidesRef.v.set({ visible: false });
      }
      if (opts.y !== null) {
        const h = ensureGuide("h");
        h.set({ x1: 0, x2: slideW, y1: opts.y, y2: opts.y, visible: true });
        if (typeof (canvas as unknown as { bringObjectToFront?: unknown }).bringObjectToFront === "function") {
          (canvas as unknown as { bringObjectToFront: (obj: FabricObject) => void }).bringObjectToFront(h);
        }
      } else if (guidesRef.h) {
        guidesRef.h.set({ visible: false });
      }
      canvas.requestRenderAll();
    };
    const hideGuides = () => {
      if (guidesRef.v) guidesRef.v.set({ visible: false });
      if (guidesRef.h) guidesRef.h.set({ visible: false });
      canvas.requestRenderAll();
    };

    const onObjectMoving = (e: { target?: FabricObject }) => {
      const t = e.target;
      if (!t) return;
      const slideW = clampNumber(slideRef.current.width, 1080);
      const slideH = clampNumber(slideRef.current.height, 1080);
      const w =
        typeof (t as unknown as { getScaledWidth?: () => number }).getScaledWidth === "function"
          ? (t as unknown as { getScaledWidth: () => number }).getScaledWidth()
          : clampNumber((t as unknown as { width?: number }).width, 1);
      const h =
        typeof (t as unknown as { getScaledHeight?: () => number }).getScaledHeight === "function"
          ? (t as unknown as { getScaledHeight: () => number }).getScaledHeight()
          : clampNumber((t as unknown as { height?: number }).height, 1);
      const kind = getObjectKind(t);
      const overflow =
        kind === "image"
          ? Math.max(24, Math.min(240, Math.round(Math.min(w, h) * 0.25)))
          : 0;
      let nextLeft = clampNumber(t.left, 0);
      let nextTop = clampNumber(t.top, 0);
      const snap = 6;
      let guideX: number | null = null;
      let guideY: number | null = null;

      const centerX = nextLeft + w / 2;
      const centerY = nextTop + h / 2;

      if (Math.abs(centerX - slideW / 2) <= snap) {
        nextLeft = slideW / 2 - w / 2;
        guideX = slideW / 2;
      } else if (Math.abs(nextLeft) <= snap) {
        nextLeft = 0;
        guideX = 0;
      } else if (Math.abs(nextLeft + w - slideW) <= snap) {
        nextLeft = slideW - w;
        guideX = slideW;
      }

      if (Math.abs(centerY - slideH / 2) <= snap) {
        nextTop = slideH / 2 - h / 2;
        guideY = slideH / 2;
      } else if (Math.abs(nextTop) <= snap) {
        nextTop = 0;
        guideY = 0;
      } else if (Math.abs(nextTop + h - slideH) <= snap) {
        nextTop = slideH - h;
        guideY = slideH;
      }

      let minLeft = 0;
      let maxLeft = Math.max(0, slideW - w);
      let minTop = 0;
      let maxTop = Math.max(0, slideH - h);

      if (kind === "image") {
        const margin = overflow;
        minLeft = -w - margin;
        maxLeft = slideW + margin;
        minTop = -h - margin;
        maxTop = slideH + margin;
      }

      const clampedLeft = Math.min(Math.max(minLeft, nextLeft), maxLeft);
      const clampedTop = Math.min(Math.max(minTop, nextTop), maxTop);
      if (clampedLeft !== nextLeft || clampedTop !== nextTop) {
        nextLeft = clampedLeft;
        nextTop = clampedTop;
      }

      if (nextLeft !== t.left || nextTop !== t.top) {
        t.set({ left: nextLeft, top: nextTop });
      }

      if (guideX !== null || guideY !== null) {
        showGuides({ x: guideX, y: guideY });
      } else {
        hideGuides();
      }
      scheduleToolbarUpdate();
    };
    const onObjectModified = (e: { target?: FabricObject }) => {
      hideGuides();
      onModified(e);
    };
    const onMouseDownBefore = (e: { e?: Event }) => {
      const native = e?.e as MouseEvent | PointerEvent | undefined;
      if (!native) return;
      if (native.altKey) {
        canvas.skipTargetFind = true;
      } else {
        canvas.skipTargetFind = false;
      }
    };
    const onMouseUp = () => {
      canvas.skipTargetFind = false;
    };

    canvas.on("selection:created", emitSelection);
    canvas.on("selection:updated", emitSelection);
    canvas.on("selection:cleared", () => {
      const cb = onSelectionChangeRef.current;
      cb?.([]);
      setTextToolbar(null);
      setImageToolbar(null);
      hideGuides();
    });
    canvas.on("mouse:down", (e) => {
      const activeObj = canvas.getActiveObject() as
        | (FabricObject & {
            isEditing?: boolean;
            exitEditing?: () => void;
            containsPoint?: (point: { x: number; y: number }) => boolean;
            getBoundingRect?: (
              absolute?: boolean,
              calculate?: boolean
            ) => { left: number; top: number; width: number; height: number };
          })
        | null;
      const target = e?.target as FabricObject | undefined;
      const native = e?.e as MouseEvent | PointerEvent | TouchEvent | undefined;
      const findTarget = (canvas as unknown as { findTarget?: (evt: unknown) => unknown }).findTarget;
      const getScenePoint = (canvas as unknown as {
        getScenePoint?: (evt: unknown) => { x: number; y: number };
      }).getScenePoint;
      const slideW = clampNumber(slideRef.current.width, 1080);
      const slideH = clampNumber(slideRef.current.height, 1080);
      const scenePoint =
        native && typeof getScenePoint === "function" ? getScenePoint.call(canvas, native) : null;
      const outsideSlide =
        scenePoint &&
        (scenePoint.x < 0 || scenePoint.y < 0 || scenePoint.x > slideW || scenePoint.y > slideH);
      const isEditing = Boolean(activeObj?.isEditing);
      const insideActive =
        Boolean(activeObj) &&
        Boolean(scenePoint) &&
        (typeof activeObj?.containsPoint === "function"
          ? activeObj.containsPoint(scenePoint as { x: number; y: number })
          : (() => {
              const rect = activeObj?.getBoundingRect?.(true, true);
              if (!rect || !scenePoint) return false;
              return (
                scenePoint.x >= rect.left &&
                scenePoint.x <= rect.left + rect.width &&
                scenePoint.y >= rect.top &&
                scenePoint.y <= rect.top + rect.height
              );
            })());

      if (isEditing && insideActive && !outsideSlide) return;
      const hasFinder = Boolean(native && typeof findTarget === "function");
      const targetInfo = hasFinder
        ? (findTarget.call(canvas, native) as
            | {
                currentTarget?: FabricObject;
                target?: FabricObject;
                currentContainer?: FabricObject;
                container?: FabricObject;
              }
            | undefined)
        : undefined;
      const hitCandidate = hasFinder
        ? targetInfo?.currentTarget ??
          targetInfo?.target ??
          targetInfo?.currentContainer ??
          targetInfo?.container ??
          null
        : target ?? null;
      const isSelectableTarget =
        hitCandidate &&
        (hitCandidate as unknown as { selectable?: boolean }).selectable !== false &&
        (hitCandidate as unknown as { evented?: boolean }).evented !== false;
      const hitIsActive = Boolean(hitCandidate && activeObj && hitCandidate === activeObj);
      const hitValid = Boolean(isSelectableTarget && (!hitIsActive || insideActive));

      if (outsideSlide || !hitValid) {
        if (activeObj?.isEditing && typeof activeObj.exitEditing === "function") {
          activeObj.exitEditing();
        }
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const liveCanvas = fabricRef.current;
      if (!liveCanvas) return;
      const activeObj = liveCanvas.getActiveObject() as
        | (FabricObject & { isEditing?: boolean; exitEditing?: () => void })
        | null;
      if (activeObj?.isEditing && typeof activeObj.exitEditing === "function") {
        activeObj.exitEditing();
      }
      liveCanvas.discardActiveObject();
      liveCanvas.requestRenderAll();
    };
    window.addEventListener("keydown", onKeyDown);
    canvas.on("object:moving", onObjectMoving);
    canvas.on("object:scaling", scheduleToolbarUpdate);
    canvas.on("object:rotating", scheduleToolbarUpdate);
    canvas.on("object:modified", onObjectModified);
    canvas.on("text:changed", onTextChanged);
    canvas.on("text:selection:changed", onSelectionChanged);
    canvas.on("text:editing:entered", onEditingEntered);
    canvas.on("text:editing:exited", onEditingExited);
    canvas.on("mouse:down:before", onMouseDownBefore);
    canvas.on("mouse:up", onMouseUp);
    return () => {
      canvas.off("selection:created", emitSelection);
      canvas.off("selection:updated", emitSelection);
      canvas.off("selection:cleared");
      canvas.off("object:moving", onObjectMoving);
      canvas.off("object:scaling", scheduleToolbarUpdate);
      canvas.off("object:rotating", scheduleToolbarUpdate);
      canvas.off("object:modified", onObjectModified);
      canvas.off("text:changed", onTextChanged);
      canvas.off("text:selection:changed", onSelectionChanged);
      canvas.off("text:editing:entered", onEditingEntered);
      canvas.off("text:editing:exited", onEditingExited);
      canvas.off("mouse:down:before", onMouseDownBefore);
      canvas.off("mouse:up", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      canvas.dispose();
      fabricRef.current = null;
    };
    // We intentionally don't depend on `slide` here; events use `slideRef`.
  }, [emit, queueFontReflow, scheduleToolbarUpdate, syncImageGroupAppearance]);

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
      try {
        canvas.clear();

        const bgColor = slide.background?.color ?? "#ffffff";
        canvas.backgroundColor = bgColor;

        const slideW = clampNumber(slide.width, 1080);
        const slideH = clampNumber(slide.height, 1080);

        // 1) Images (behind text)
      for (const [idx, raw] of (slide.objects ?? []).entries()) {
        if (!raw || typeof raw !== "object") continue;
        if (raw.type !== "image") continue;
        if (raw.hidden) continue;

          const id = raw.id ?? `obj_${idx + 1}`;
          const assetId = typeof raw.assetId === "string" ? raw.assetId : null;
          if (!assetId) continue;
          const url =
            typeof assetUrlsById?.[assetId] === "string" ? assetUrlsById?.[assetId] : null;
          if (!url) continue;

          const x = clampNumber(raw.x, 0);
          const y = clampNumber(raw.y, 0);
          const width = clampNumber(raw.width, Math.max(1, slideW - 160));
          const height = clampNumber(raw.height, Math.max(1, width));

          loadImageElement(url)
            .then((el) => {
              // Ignore if we re-rendered since the request started.
              if (renderTokenRef.current !== token) return;
              if (!fabricRef.current) return;

	              const iw = clampNumber(el.naturalWidth, 1);
	              const ih = clampNumber(el.naturalHeight, 1);
	              const meta: ImageMeta = { naturalWidth: iw, naturalHeight: ih };

	              const offsetX = clampNumber(raw.contentOffsetX, 0);
	              const offsetY = clampNumber(raw.contentOffsetY, 0);

	              const cornerValue = clampNumberRange(raw.cornerRounding, 0, 100, 18);
	              const radiusPx = (Math.min(width, height) / 2) * (cornerValue / 100);

	              const strokeWeight =
	                raw.strokeWeight === "thin" ||
	                raw.strokeWeight === "medium" ||
	                raw.strokeWeight === "thick"
	                  ? raw.strokeWeight
	                  : "none";
	              const strokeWidth = strokeWidthForWeight(strokeWeight);
		              const strokeColor =
		                typeof raw.strokeColor === "string"
		                  ? raw.strokeColor
		                  : styleDefaults?.palette?.accent ?? "#7c3aed";

	              const contentW = Math.max(1, width);
	              const contentH = Math.max(1, height);

              const crop = computeCoverCrop(iw, ih, contentW, contentH, offsetX, offsetY);

	              const img = new Image(el);
              const localLeft = -width / 2;
              const localTop = -height / 2;
              const contentLeft = localLeft;
              const contentTop = localTop;
              const contentLocalLeft = -contentW / 2;
              const contentLocalTop = -contentH / 2;
	              img.set({
	                left: contentLocalLeft,
	                top: contentLocalTop,
	                originX: "left",
	                originY: "top",
	                cropX: crop.cropX,
	                cropY: crop.cropY,
	                width: crop.cropW,
	                height: crop.cropH,
	                scaleX: crop.scale,
	                scaleY: crop.scale,
	                objectCaching: false,
	                selectable: false,
	                evented: false
	              });

		              const strokeRect = new Rect({
		                left: localLeft,
		                top: localTop,
		                originX: "left",
		                originY: "top",
		                width: Math.max(1, width),
		                height: Math.max(1, height),
		                rx: radiusPx,
		                ry: radiusPx,
		                fill: "rgba(0,0,0,0)",
		                opacity: strokeWidth > 0 ? 1 : 0,
		                objectCaching: false,
		                selectable: false,
	                evented: false,
	                strokeUniform: true,
	                stroke: strokeColor,
	                strokeWidth,
	                strokeLineJoin: "round"
	              });
	              (strokeRect as unknown as { dojogramRole?: string }).dojogramRole = "stroke";

		              // Clip only the image content so strokes aren't clipped.
              const contentClip = new Rect({
                left: contentLocalLeft,
                top: contentLocalTop,
                originX: "left",
                originY: "top",
                width: contentW,
                height: contentH,
                rx: radiusPx,
                ry: radiusPx,
                objectCaching: false,
                absolutePositioned: false
              });

	              const content = new Group([img], {
	                left: contentLeft,
	                top: contentTop,
	                originX: "left",
	                originY: "top",
	                width: contentW,
	                height: contentH,
	                layoutManager: new LayoutManager(new FixedLayout()),
	                clipPath: contentClip,
	                objectCaching: false,
	                selectable: false,
	                evented: false
	              });
	              (content as unknown as { dojogramRole?: string }).dojogramRole = "content";

	              const frame = new Group([content, strokeRect], {
	                left: x,
	                top: y,
	                originX: "left",
	                originY: "top",
	                width,
	                height,
	                layoutManager: new LayoutManager(new FixedLayout()),
	                objectCaching: false
	              });
              configureImageFrameControls(frame);
              setObjectId(frame as unknown as FabricObject, id);
              setObjectKind(frame as unknown as FabricObject, "image");
              setImageMeta(frame as unknown as FabricObject, meta);

              // Apply initial crop + rounding/stroke from SlideObject.
              syncImageGroupAppearance(frame, { ...raw, width, height }, meta);

              canvas.add(frame);
              canvas.sendObjectToBack(frame);
              frame.setCoords();
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
          const mode =
            overlay.mode === "bottom-gradient" ? "bottom-gradient" : "solid";
          const height =
            typeof overlay.height === "number" && Number.isFinite(overlay.height)
              ? Math.min(1, Math.max(0.2, overlay.height))
              : 0.6;
          const rect = new Rect({
            left: 0,
            top: 0,
            width: slideW,
            height: slideH,
            originX: "left",
            originY: "top",
            fill: color,
            opacity: mode === "solid" ? opacity : 1,
            selectable: false,
            evented: false
          });
          if (mode === "bottom-gradient") {
            const rgb = hexToRgb(color) ?? [0, 0, 0];
            const [r, g, b] = rgb;
            const start = Math.min(1, Math.max(0, 1 - height));
            rect.set(
              "fill",
              new Gradient({
                type: "linear",
                gradientUnits: "pixels",
                coords: { x1: 0, y1: 0, x2: 0, y2: slideH },
                colorStops: [
                  { offset: 0, color: `rgba(${r}, ${g}, ${b}, 0)` },
                  { offset: start, color: `rgba(${r}, ${g}, ${b}, 0)` },
                  { offset: 1, color: `rgba(${r}, ${g}, ${b}, ${opacity})` }
                ]
              })
            );
          }
          canvas.add(rect);
          canvas.requestRenderAll();
        }

        // 2) Text
        for (const [idx, raw] of (slide.objects ?? []).entries()) {
          if (!raw || typeof raw !== "object") continue;
          if (raw.type !== "text") continue;
          if (raw.hidden) continue;

          const id = raw.id ?? `obj_${idx + 1}`;
          const text = raw.text ?? "";
          const x = clampNumber(raw.x, 80);
          const y = clampNumber(raw.y, 240);
          const width = clampNumber(raw.width, Math.max(240, slideW - 160));
          const rawStyleSnapshot = cloneTextStyles(raw.styles);
          const styleSnapshot = isBebasNeueFamily(raw.fontFamily)
            ? normalizeBebasNeueStyles(
                rawStyleSnapshot,
                raw.fill ?? "#111827",
                clampNumber(raw.fontSize, 56)
              )
            : rawStyleSnapshot;

          const markerHeight = clampNumberRange(
            raw.markerHeight,
            0.25,
            1,
            DEFAULT_MARKER_HEIGHT
          );
          const markerAngle = clampNumberRange(
            raw.markerAngle,
            -15,
            15,
            DEFAULT_MARKER_ANGLE
          );
          const markerColor =
            typeof raw.markerColor === "string"
              ? raw.markerColor
              : typeof raw.textBackgroundColor === "string"
                ? raw.textBackgroundColor
                : DEFAULT_MARKER_COLOR;
          const textBackgroundColor =
            typeof raw.textBackgroundColor === "string" ? raw.textBackgroundColor : null;
          const resolvedWeight = resolveFontWeightForFamily(
            raw.fontFamily,
            clampNumber(raw.fontWeight, 600)
          );
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
            fontWeight: resolvedWeight,
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
            stroke: typeof raw.stroke === "string" ? raw.stroke : undefined,
            strokeWidth:
              typeof raw.strokeWidth === "number" && Number.isFinite(raw.strokeWidth)
                ? raw.strokeWidth
                : 0,
            strokeLineJoin:
              typeof raw.strokeLineJoin === "string" ? raw.strokeLineJoin : "round",
            textBackgroundColor: textBackgroundColor ?? undefined,
            styles: styleSnapshot ?? undefined,
            editable: true
          });
          (textbox as unknown as { markerHeight?: number }).markerHeight = markerHeight;
          (textbox as unknown as { markerAngle?: number }).markerAngle = markerAngle;
          (textbox as unknown as { markerColor?: string }).markerColor = markerColor;

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
          queueFontReflow(textbox, {
            fontFamily: raw.fontFamily,
            fontWeight: resolvedWeight,
            fontStyle: raw.fontStyle ?? "normal",
            fontSize: clampNumber(raw.fontSize, 56),
            token
          });
        }

        fitCanvas();
        canvas.renderAll();
      } catch (err) {
        console.error("FabricSlideCanvas: renderSlide failed", err);
        try {
          canvas.requestRenderAll();
        } catch {
          // ignore
        }
      } finally {
        isHydratingRef.current = false;
      }
  }, [assetUrlsById, fitCanvas, slide]);

  React.useEffect(() => {
    renderSlide();
    // Intentionally only when `renderKey` changes (slide switching / external rehydrate),
    // so typing doesn't cause the canvas to re-render and drop text editing focus.
  }, [renderKey]);

  React.useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // Side panels translate the canvas container with an animation; keep pointer
    // math in sync during the whole transition window.
    let raf: number | null = null;
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();

    const tick = () => {
      canvas.calcOffset();
      canvas.requestRenderAll();
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - start < 260) raf = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [layoutKey]);

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
          className="absolute z-40 flex flex-col gap-1 rounded-2xl border bg-background/90 px-2 py-1 shadow-sm backdrop-blur"
          ref={textToolbarRef}
          style={{ left: textToolbar.left, top: textToolbar.top }}
        >
          <div className="flex flex-wrap items-center gap-1">
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
            type="number"
            min={0.8}
            max={2.5}
            step={0.05}
            inputMode="decimal"
            value={lineHeightDraft}
            onFocus={() => setLineHeightFocused(true)}
            onBlur={() => {
              setLineHeightFocused(false);
              const n = Number(lineHeightDraft.replace(",", "."));
              if (!Number.isFinite(n)) {
                setLineHeightDraft(String(textToolbar.lineHeight.toFixed(2)));
                return;
              }
              const clamped = clampNumberRange(n, 0.8, 2.5, textToolbar.lineHeight);
              setLineHeightDraft(String(clamped.toFixed(2)));
              patchActiveText({ lineHeight: clamped });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.currentTarget as HTMLInputElement).blur();
                return;
              }
              if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
              setLineHeightDraft(raw);
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              const clamped = clampNumberRange(n, 0.8, 2.5, textToolbar.lineHeight);
              patchActiveText({ lineHeight: clamped });
            }}
            className="w-[70px] rounded-lg border bg-background px-2 py-1 text-xs"
            title="Altura (linha)"
          />

            <input
            type="number"
            min={-10}
            max={30}
            step={0.5}
            inputMode="decimal"
            value={letterSpacingDraft}
            onFocus={() => setLetterSpacingFocused(true)}
            onBlur={() => {
              setLetterSpacingFocused(false);
              const n = Number(letterSpacingDraft.replace(",", "."));
              if (!Number.isFinite(n)) {
                setLetterSpacingDraft(String(textToolbar.letterSpacing));
                return;
              }
              const clamped = clampNumberRange(n, -10, 30, textToolbar.letterSpacing);
              setLetterSpacingDraft(String(clamped));
              patchActiveText({ letterSpacing: clamped });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.currentTarget as HTMLInputElement).blur();
                return;
              }
              if (e.key === "e" || e.key === "E" || e.key === "+") {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.,-]/g, "").replace(",", ".");
              setLetterSpacingDraft(raw);
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              const clamped = clampNumberRange(n, -10, 30, textToolbar.letterSpacing);
              patchActiveText({ letterSpacing: clamped });
            }}
            className="w-[70px] rounded-lg border bg-background px-2 py-1 text-xs"
            title="Espaçamento (px)"
          />

            <input
            type="color"
            value={textToolbar.fill}
            onChange={(e) => patchActiveText({ fill: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded-lg border bg-background p-1"
            title="Cor"
          />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
            type="button"
            onClick={() => {
              const bold = textToolbar.fontWeight >= 600;
              patchActiveText({ fontWeight: bold ? 400 : 700 });
            }}
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs font-semibold hover:bg-secondary",
              textToolbar.fontWeight >= 600 ? "border-primary" : ""
            ].join(" ")}
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
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs italic hover:bg-secondary",
              textToolbar.fontStyle === "italic" ? "border-primary" : ""
            ].join(" ")}
            title="Itálico"
          >
            I
          </button>
            <button
            type="button"
            onClick={() => patchActiveText({ underline: !textToolbar.underline })}
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs underline hover:bg-secondary",
              textToolbar.underline ? "border-primary" : ""
            ].join(" ")}
            title="Sublinhado"
          >
            U
          </button>
            <button
            type="button"
            onClick={() => patchActiveText({ linethrough: !textToolbar.linethrough })}
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs line-through hover:bg-secondary",
              textToolbar.linethrough ? "border-primary" : ""
            ].join(" ")}
            title="Tachado"
          >
            S
          </button>
            <button
            type="button"
            onClick={() => {
              const strokeOn =
                typeof textToolbar.strokeWidth === "number" && textToolbar.strokeWidth > 0;
              if (strokeOn) {
                patchActiveText({ stroke: null, strokeWidth: 0 });
                return;
              }
              patchActiveText({
                stroke: getReadableStroke(textToolbar.fill),
                strokeWidth: 2,
                strokeLineJoin: "round"
              });
            }}
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
              textToolbar.strokeWidth > 0 ? "border-primary" : ""
            ].join(" ")}
            title="Contorno"
          >
            Ø
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

            <div className="mx-1 h-6 w-px bg-border" />

            <button
            type="button"
            onClick={() =>
              patchActiveText({
                textBackgroundColor: textToolbar.markerActive ? null : textToolbar.markerColor
              })
            }
            className={[
              "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
              textToolbar.markerActive ? "border-primary" : ""
            ].join(" ")}
            title="Marca-texto"
          >
            ▰
          </button>
            <input
            type="color"
            value={textToolbar.markerColor}
            onChange={(e) => patchActiveText({ markerColor: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded-lg border bg-background p-1"
            title="Cor da marca"
          />
            <input
            type="range"
            min={0.25}
            max={1}
            step={0.05}
            value={textToolbar.markerHeight}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              patchActiveText({
                markerHeight: clampNumberRange(n, 0.25, 1, textToolbar.markerHeight)
              });
            }}
            className="w-[90px]"
            title="Altura da marca"
          />
            <input
            type="number"
            min={-15}
            max={15}
            step={1}
            inputMode="numeric"
            value={Math.round(textToolbar.markerAngle)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              patchActiveText({
                markerAngle: clampNumberRange(n, -15, 15, textToolbar.markerAngle)
              });
            }}
            className="w-[58px] rounded-lg border bg-background px-2 py-1 text-xs"
            title="Ângulo (°)"
          />
          </div>
        </div>
      ) : null}

      {imageToolbar ? (
        <div
          className="absolute z-40 flex items-center gap-2 rounded-2xl border bg-background/90 px-2 py-1 shadow-sm backdrop-blur"
          ref={imageToolbarRef}
          style={{ left: imageToolbar.left, top: imageToolbar.top }}
        >
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Borda</span>
            <input
              type="color"
              value={imageToolbar.strokeColor}
              onChange={(e) => patchActiveImage({ strokeColor: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded-lg border bg-background p-1"
              title="Cor da borda"
            />
            <button
              type="button"
              onClick={() => patchActiveImage({ strokeWeight: "none" })}
              className={[
                "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
                imageToolbar.strokeWeight === "none" ? "border-primary" : ""
              ].join(" ")}
              title="Sem borda"
            >
              Ø
            </button>
            <button
              type="button"
              onClick={() => patchActiveImage({ strokeWeight: "thin" })}
              className={[
                "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
                imageToolbar.strokeWeight === "thin" ? "border-primary" : ""
              ].join(" ")}
              title="Fino"
            >
              F
            </button>
            <button
              type="button"
              onClick={() => patchActiveImage({ strokeWeight: "medium" })}
              className={[
                "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
                imageToolbar.strokeWeight === "medium" ? "border-primary" : ""
              ].join(" ")}
              title="Médio"
            >
              M
            </button>
            <button
              type="button"
              onClick={() => patchActiveImage({ strokeWeight: "thick" })}
              className={[
                "rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary",
                imageToolbar.strokeWeight === "thick" ? "border-primary" : ""
              ].join(" ")}
              title="Grosso"
            >
              G
            </button>
          </div>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtro</span>
            <input
              type="color"
              value={imageToolbar.filterColor}
              onChange={(e) => patchActiveImage({ filterColor: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded-lg border bg-background p-1"
              title="Cor do filtro"
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={imageToolbar.filterOpacity}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                patchActiveImage({ filterOpacity: clampNumberRange(n, 0, 1, 0) });
              }}
              className="w-[90px]"
              title="Intensidade do filtro"
            />
            <span className="text-[10px] text-muted-foreground">
              {Math.round(imageToolbar.filterOpacity * 100)}%
            </span>
          </div>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Cantos</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.max(
                0,
                Math.min(
                  100,
                  Number(cornerRoundingDraft === "" ? imageToolbar.cornerRounding : cornerRoundingDraft)
                )
              )}
              onChange={(e) => {
                const v = Math.max(0, Math.min(100, Math.trunc(Number(e.target.value))));
                setCornerRoundingDraft(String(v));
                patchActiveImage({ cornerRounding: v });
              }}
              className="w-[96px]"
              title="Arredondamento"
            />
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={cornerRoundingDraft}
              onFocus={() => setCornerRoundingFocused(true)}
              onBlur={() => {
                setCornerRoundingFocused(false);
                const n = Number(cornerRoundingDraft);
                if (!Number.isFinite(n)) {
                  setCornerRoundingDraft(String(Math.round(imageToolbar.cornerRounding)));
                  return;
                }
                const clamped = Math.max(0, Math.min(100, Math.trunc(n)));
                setCornerRoundingDraft(String(clamped));
                patchActiveImage({ cornerRounding: clamped });
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
              onChange={(e) => setCornerRoundingDraft(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-[64px] rounded-lg border bg-background px-2 py-1 text-xs"
              title="Arredondamento (0-100)"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
  }
);

FabricSlideCanvas.displayName = "FabricSlideCanvas";

export default FabricSlideCanvas;
