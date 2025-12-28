"use client";

import * as React from "react";
import { Canvas, Textbox, type FabricObject } from "fabric";

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
};

export type SlideV1 = {
  id?: string;
  width: number;
  height: number;
  objects: SlideObjectV1[];
  background?: { color?: string } | null;
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

type Props = {
  slide: SlideV1;
  className?: string;
  renderKey: string | number;
  onSlideChange: (next: SlideV1) => void;
};

export default function FabricSlideCanvas({
  slide,
  className,
  renderKey,
  onSlideChange
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasElRef = React.useRef<HTMLCanvasElement>(null);
  const fabricRef = React.useRef<Canvas | null>(null);
  const isHydratingRef = React.useRef(false);
  const emitTimerRef = React.useRef<number | null>(null);
  const nextSlideRef = React.useRef<SlideV1 | null>(null);
  const slideRef = React.useRef(slide);

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

      const currentSlide = slideRef.current;
      const nextObjects = currentSlide.objects.filter((o) => o?.id !== id);

      canvas.remove(target);
      canvas.discardActiveObject();
      canvas.requestRenderAll();

      emit({ ...currentSlide, objects: nextObjects });
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

    isHydratingRef.current = true;
    canvas.clear();

    const bgColor = slide.background?.color ?? "#ffffff";
    canvas.backgroundColor = bgColor;

    const slideW = clampNumber(slide.width, 1080);

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
  }, [fitCanvas, slide]);

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
