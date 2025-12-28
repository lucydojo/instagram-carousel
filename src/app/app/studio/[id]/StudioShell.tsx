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
  Image as ImageIcon,
  LayoutTemplate,
  LayoutGrid,
  Lock,
  Palette,
  Sparkles,
  Type,
  UserCircle2
} from "lucide-react";
import {
  studioCleanup,
  studioEdit,
  studioGenerate,
  studioSaveEditorState,
  studioSaveLocks
} from "./actions";
import { MotionDock, MotionDockItem } from "./MotionDock";
import FabricSlideCanvas, { type SlideV1 } from "./FabricSlideCanvas";

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

export default function StudioShell(props: Props) {
  const router = useRouter();
  const [selectedSlideIndex, setSelectedSlideIndex] = React.useState(() =>
    clampInt(props.initialSlideIndex, 1, Math.max(1, props.slideCount))
  );
  const [dirty, setDirty] = React.useState(false);
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

  const slidesFromState = Array.isArray(editorState.slides)
    ? (editorState.slides as SlideLike[])
    : props.slides;
  const selectedSlide =
    slidesFromState.length > 0 ? slidesFromState[selectedSlideIndex - 1] : null;
  const editorStateJson = React.useMemo(
    () => JSON.stringify(editorState, null, 2),
    [editorState]
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

  const onCanvasSlideChange = React.useCallback(
    (nextSlide: SlideV1) => {
      setEditorState((prev) => {
        const prevSlides = Array.isArray(prev.slides)
          ? ([...(prev.slides as SlideLike[])] as SlideLike[])
          : [...props.slides];
        if (selectedSlideIndex - 1 >= 0 && selectedSlideIndex - 1 < prevSlides.length) {
          prevSlides[selectedSlideIndex - 1] = nextSlide as unknown as SlideLike;
        }
        return { ...prev, slides: prevSlides };
      });
      setDirty(true);
    },
    [props.slides, selectedSlideIndex]
  );

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
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <div className="text-base font-medium">Cores</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Paletas globais/custom já existem no backend. A UI completa entra nas próximas tasks.
                    </div>
                  </div>
                ) : null}

                {showText ? (
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <div className="text-base font-medium">Texto</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Tipografia global/per-slide entra nas próximas tasks. Por enquanto, o preview valida o pipeline.
                    </div>
                  </div>
                ) : null}

                {showTemplates ? (
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <div className="text-base font-medium">Templates</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Templates disponíveis:{" "}
                      <span className="font-mono">{props.catalog.templates}</span>. UI de seleção entra nas próximas tasks.
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
                <form action={saveEditorStateAction} className="hidden sm:block">
                  <input type="hidden" name="carouselId" value={props.carouselId} />
                  <input type="hidden" name="currentSlide" value={selectedSlideIndex} />
                  <input type="hidden" name="editorStateJson" value={editorStateJson} />
                  <button
                    type="submit"
                    disabled={!dirty}
                    className="rounded-xl border bg-background/70 px-3 py-2 text-sm shadow-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background/70"
                  >
                    Salvar
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setLeftOpen((v) => !v)}
                  className="rounded-xl border bg-background/70 px-3 py-2 text-sm shadow-sm hover:bg-secondary md:hidden"
                >
                  Painel
                </button>
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
                  slide={canvasSlide}
                  onSlideChange={onCanvasSlideChange}
                />
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
