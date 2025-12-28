"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Settings2,
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

function getSlideTitle(slide: SlideLike | null, fallbackIndex: number): string {
  if (!slide) return `Slide ${fallbackIndex}`;
  const objects = Array.isArray(slide.objects) ? (slide.objects as unknown[]) : [];
  const title = objects.find((o) => {
    if (!o || typeof o !== "object") return false;
    const r = o as Record<string, unknown>;
    return r.type === "text" && (r.id === "title" || r.id === "headline");
  }) as Record<string, unknown> | undefined;
  const text = title?.text;
  if (typeof text === "string" && text.trim().length > 0) return text.trim();
  return `Slide ${fallbackIndex}`;
}

function getSlideBody(slide: SlideLike | null): string | null {
  if (!slide) return null;
  const objects = Array.isArray(slide.objects) ? (slide.objects as unknown[]) : [];
  const body = objects.find((o) => {
    if (!o || typeof o !== "object") return false;
    const r = o as Record<string, unknown>;
    return r.type === "text" && (r.id === "body" || r.id === "paragraph");
  }) as Record<string, unknown> | undefined;
  const text = body?.text;
  if (typeof text === "string" && text.trim().length > 0) return text.trim();
  return null;
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
  | "text";

function DockButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-10 w-10 items-center justify-center rounded-xl transition",
        active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

export default function StudioShell(props: Props) {
  const router = useRouter();
  const [selectedSlideIndex, setSelectedSlideIndex] = React.useState(() =>
    clampInt(props.initialSlideIndex, 1, Math.max(1, props.slideCount))
  );
  const [leftOpen, setLeftOpen] = React.useState(false);
  const [rightOpen, setRightOpen] = React.useState(false);
  const [rightMode, setRightMode] = React.useState<"controls" | "advanced">(
    "controls"
  );
  const [assetsTab, setAssetsTab] = React.useState<"generated" | "reference">(
    "generated"
  );
  const [activeDock, setActiveDock] = React.useState<DockItem>("generate");

  React.useEffect(() => {
    setSelectedSlideIndex((current) =>
      clampInt(current, 1, Math.max(1, props.slideCount))
    );
  }, [props.slideCount]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectedSlide =
    props.slideCount > 0 ? props.slides[selectedSlideIndex - 1] : null;

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

  const generateAction = studioGenerate;
  const editAction = studioEdit;
  const saveLocksAction = studioSaveLocks;

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
          <div className="fixed left-5 top-28 z-40 hidden md:block">
            <div className="flex flex-col gap-2 rounded-2xl border bg-background/80 p-2 shadow-sm backdrop-blur">
              <DockButton
                active={false}
                icon={<ArrowLeft className="h-5 w-5" />}
                label="Voltar ao projeto"
                onClick={() => {
                  router.push(`/app/carousels/${props.carouselId}`);
                }}
              />
              <DockButton
                active={false}
                icon={<LayoutGrid className="h-5 w-5" />}
                label="Carrosséis"
                onClick={() => {
                  router.push("/app");
                }}
              />
              <div className="my-1 h-px bg-border" />

              <DockButton
                active={leftOpen && activeDock === "generate"}
                icon={<Sparkles className="h-5 w-5" />}
                label="IA"
                onClick={() => toggleLeft("generate")}
              />
              <DockButton
                active={leftOpen && activeDock === "assets"}
                icon={<ImageIcon className="h-5 w-5" />}
                label="Assets"
                onClick={() => toggleLeft("assets")}
              />
              <DockButton
                active={leftOpen && activeDock === "brand"}
                icon={<UserCircle2 className="h-5 w-5" />}
                label="Brand"
                onClick={() => toggleLeft("brand")}
              />
              <DockButton
                active={leftOpen && activeDock === "colors"}
                icon={<Palette className="h-5 w-5" />}
                label="Cores"
                onClick={() => toggleLeft("colors")}
              />
              <DockButton
                active={leftOpen && activeDock === "text"}
                icon={<Type className="h-5 w-5" />}
                label="Texto"
                onClick={() => toggleLeft("text")}
              />
            </div>
          </div>

          {/* Left panel */}
          <aside
            className={[
              "fixed bottom-4 left-20 top-24 z-30 hidden w-[360px] md:block",
              "transition-transform duration-200 ease-out",
              leftOpen ? "translate-x-0" : "-translate-x-[120%]"
            ].join(" ")}
            aria-hidden={!leftOpen}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border bg-background/90 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-sm font-semibold">
                  {activeDock === "generate"
                    ? "Geração"
                    : activeDock === "command"
                      ? "Edição por comando"
                      : activeDock === "assets"
                        ? "Assets"
                        : activeDock === "brand"
                          ? "Branding"
                          : activeDock === "colors"
                            ? "Cores"
                            : activeDock === "text"
                              ? "Texto"
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

              <div className="flex-1 overflow-auto p-4">
                {showGenerate ? (
                  <div className="space-y-6">
                    <section className="space-y-3 rounded-2xl border bg-background px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Geração (IA)</div>
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
                        <input type="hidden" name="carouselId" value={props.carouselId} />
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
                        <div className="text-sm font-medium">Edição por comando</div>
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
                    <div className="text-sm font-medium">Branding</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      No MVP, branding é “personal” (avatar + @). A UI completa entra nas próximas tasks.
                    </div>
                  </div>
                ) : null}

                {showColors ? (
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <div className="text-sm font-medium">Cores</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Paletas globais/custom já existem no backend. A UI completa entra nas próximas tasks.
                    </div>
                  </div>
                ) : null}

                {showText ? (
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <div className="text-sm font-medium">Texto</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Tipografia global/per-slide entra nas próximas tasks. Por enquanto, o preview valida o pipeline.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          {/* Right handle */}
          <button
            type="button"
            onClick={() => setRightOpen((v) => !v)}
            className="fixed right-5 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 shadow-sm backdrop-blur hover:bg-secondary md:flex"
            aria-label={rightOpen ? "Fechar propriedades" : "Abrir propriedades"}
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            {rightOpen ? (
              <ChevronRight className="absolute right-1.5 h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronLeft className="absolute left-1.5 h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Right panel */}
          <aside
            className={[
              "fixed bottom-4 right-4 top-40 z-30 hidden w-[360px] md:block",
              "transition-transform duration-200 ease-out",
              rightOpen ? "translate-x-0" : "translate-x-[120%]"
            ].join(" ")}
            aria-hidden={!rightOpen}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border bg-background/90 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-sm font-semibold">Propriedades</div>
                <div className="flex overflow-hidden rounded-xl border bg-background">
                  <button
                    type="button"
                    onClick={() => setRightMode("controls")}
                    className={[
                      "px-3 py-2 text-sm",
                      rightMode === "controls"
                        ? "bg-foreground text-background"
                        : "hover:bg-secondary"
                    ].join(" ")}
                  >
                    Controles
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightMode("advanced")}
                    className={[
                      "px-3 py-2 text-sm",
                      rightMode === "advanced"
                        ? "bg-foreground text-background"
                        : "hover:bg-secondary"
                    ].join(" ")}
                  >
                    Avançado
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <section className="space-y-2 rounded-2xl border bg-background px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Locks</div>
                    <span className="text-xs text-muted-foreground">proteção</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Formato: <span className="font-mono">{`{"slide_1":{"title":true}}`}</span>
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
                </section>

                {rightMode === "advanced" ? (
                  <section className="mt-4 space-y-2 rounded-2xl border bg-background px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Editor State (JSON)</div>
                      <span className="text-xs text-muted-foreground">avançado</span>
                    </div>
                    <form action={studioSaveEditorState} className="space-y-2">
                      <input type="hidden" name="carouselId" value={props.carouselId} />
                      <input
                        type="hidden"
                        name="currentSlide"
                        value={selectedSlideIndex}
                      />
                      <textarea
                        name="editorStateJson"
                        className="h-48 w-full rounded-xl border bg-background p-3 font-mono text-xs"
                        defaultValue={props.defaults.editorStateJson}
                      />
                      <button
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                        type="submit"
                      >
                        Salvar editor_state
                      </button>
                    </form>
                  </section>
                ) : null}
              </div>
            </div>
          </aside>

          {/* Canvas */}
          <section className="relative mx-auto max-w-[980px] pb-8 pt-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Slide{" "}
                <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono">
                  {selectedSlideIndex}/{Math.max(1, props.slideCount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLeftOpen((v) => !v)}
                className="rounded-xl border bg-background/70 px-3 py-2 text-sm shadow-sm hover:bg-secondary md:hidden"
              >
                Painel
              </button>
            </div>

            <div className="relative mt-5 flex items-center justify-center">
              <div className="relative aspect-square w-full max-w-[720px] rounded-[28px] bg-background p-10 shadow-[0_30px_120px_rgba(0,0,0,0.14)]">
                <div className="text-xs text-muted-foreground">Preview (placeholder)</div>
                <div className="mt-6 text-5xl font-semibold tracking-tight">
                  {getSlideTitle(selectedSlide, selectedSlideIndex)}
                </div>
                {getSlideBody(selectedSlide) ? (
                  <div className="mt-6 max-w-xl text-lg text-muted-foreground">
                    {getSlideBody(selectedSlide)}
                  </div>
                ) : (
                  <div className="mt-6 max-w-xl text-sm text-muted-foreground">
                    Gere um rascunho para preencher os slides.
                  </div>
                )}

                {/* Slide navigator (floating) */}
                {props.slideCount > 0 ? (
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
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
              </div>
            </div>

            {/* Subtle hints */}
            <div className="mt-6 text-center text-xs text-muted-foreground">
              Dica: pressione <span className="font-mono">Esc</span> para fechar painéis.
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
