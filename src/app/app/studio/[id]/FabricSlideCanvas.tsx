"use client";

import * as React from "react";
import { Canvas, Group, Image, Rect, Textbox, type FabricObject } from "fabric";

type SlideObjectV1 = {
  id?: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  fill?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  assetId?: string | null;
  slotId?: string;
};

export type SlideV1 = {
  id?: string;
  width: number;
  height: number;
  objects: SlideObjectV1[];
  background?: { color?: string } | null;
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

function clampNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function getObjectId(obj: FabricObject): string | null {
  const anyObj = obj as unknown as { dojogramId?: unknown };
  return typeof anyObj.dojogramId === "string" ? anyObj.dojogramId : null;
}

function setObjectId(obj: FabricObject, id: string) {
  (obj as unknown as { dojogramId?: string }).dojogramId = id;
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
};

const FabricSlideCanvas = React.forwardRef<FabricSlideCanvasHandle, Props>(
  function FabricSlideCanvas(
    { slide, assetUrlsById, className, renderKey, onSlideChange },
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

    const textbox = new Textbox("Novo texto", {
      left: x,
      top: y,
      width,
      originX: "left",
      originY: "top",
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
      fontSize: 48,
      fontWeight: 600,
      fill: "#111827",
      textAlign: "left",
      editable: true
    });
    textbox.initDimensions();
    setObjectId(textbox, id);
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
      x,
      y,
      width,
      height:
        typeof textbox.height === "number" ? Math.round(textbox.height) : undefined,
      text: textbox.text ?? "",
      fontSize: 48,
      fontWeight: 600,
      fill: "#111827",
      textAlign: "left"
    };
    emit({ ...currentSlide, objects: [...(currentSlide.objects ?? []), nextObj] });
    return true;
  }, [emit]);

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
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: clampNumber(o.fontSize, 48),
        fontWeight: clampNumber(o.fontWeight, 600),
        fill: o.fill ?? "#111827",
        textAlign: o.textAlign ?? "left",
        editable: true
      });
      textbox.initDimensions();
      setObjectId(textbox, id);
      canvas.add(textbox);

      nextObjects.push({
        ...o,
        id,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: typeof textbox.height === "number" ? Math.round(textbox.height) : o.height
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
        const getScaledWidth = (target as unknown as { getScaledWidth?: () => number })
          .getScaledWidth;
        const getScaledHeight = (target as unknown as { getScaledHeight?: () => number })
          .getScaledHeight;
        const scaledWidth =
          typeof getScaledWidth === "function"
            ? clampNumber(getScaledWidth(), 1)
            : typeof target.width === "number"
              ? Math.max(1, Math.round(target.width * scaleX))
              : 1;
        const scaledHeight =
          typeof getScaledHeight === "function"
            ? clampNumber(getScaledHeight(), 1)
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

    canvas.on("object:modified", onModified);
    canvas.on("text:changed", onTextChanged);
    canvas.on("text:editing:entered", onEditingEntered);
    canvas.on("text:editing:exited", onEditingExited);

    return () => {
      canvas.off("object:modified", onModified);
      canvas.off("text:changed", onTextChanged);
      canvas.off("text:editing:entered", onEditingEntered);
      canvas.off("text:editing:exited", onEditingExited);
      canvas.dispose();
      fabricRef.current = null;
    };
    // We intentionally don't depend on `slide` here; events use `slideRef`.
  }, [emit]);

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
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
        fontSize: clampNumber(raw.fontSize, 56),
        fontWeight: clampNumber(raw.fontWeight, 600),
        fill: raw.fill ?? "#111827",
        textAlign: raw.textAlign ?? "left",
        editable: true
      });

      setObjectId(textbox, id);
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
    <div ref={containerRef} className={["h-full w-full", className ?? ""].join(" ")}>
      <canvas ref={canvasElRef} className="h-full w-full" />
    </div>
  );
  }
);

FabricSlideCanvas.displayName = "FabricSlideCanvas";

export default FabricSlideCanvas;
