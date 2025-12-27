import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStudioProject } from "@/lib/studio/queries";
import {
  applyNaturalLanguageEdit,
  cleanupPlaceholderGeneratedAssets,
  generateFirstDraft,
  saveCarouselElementLocksFromForm,
  saveCarouselEditorStateFromForm
} from "@/lib/studio/actions";
import { GEMINI_IMAGE_MODELS } from "@/lib/ai/gemini_image";
import { createSignedUrl } from "@/lib/studio/storage";

function getUiQueryFromForm(formData: FormData) {
  const raw = formData.get("uiQuery");
  const qs = new URLSearchParams(typeof raw === "string" ? raw : "");
  qs.delete("saved");
  qs.delete("generated");
  qs.delete("cleaned");
  qs.delete("locksSaved");
  qs.delete("edited");
  qs.delete("applied");
  qs.delete("locked");
  qs.delete("missing");
  qs.delete("editSummary");
  qs.delete("error");
  return qs;
}

function toStudioUrl(id: string, qs: URLSearchParams) {
  const query = qs.toString();
  return query ? `/app/studio/${id}?${query}` : `/app/studio/${id}`;
}

export default async function StudioPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    slide?: string;
    left?: string;
    right?: string;
    panel?: string;
    assetsTab?: string;
    saved?: string;
    cleaned?: string;
    locksSaved?: string;
    edited?: string;
    applied?: string;
    locked?: string;
    missing?: string;
    editSummary?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const { user, project } = await getStudioProject(id);
  if (!user) redirect("/sign-in");
  if (!project) notFound();
  const projectData = project!;

  const sp = await searchParams;
  const saved = sp?.saved === "1";
  const cleaned = sp?.cleaned ? Number(sp.cleaned) : null;
  const locksSaved = sp?.locksSaved === "1";
  const edited = sp?.edited === "1";
  const applied = sp?.applied ? Number(sp.applied) : null;
  const locked = sp?.locked ? Number(sp.locked) : null;
  const missing = sp?.missing ? Number(sp.missing) : null;
  const editSummary = sp?.editSummary ?? null;
  const error = sp?.error ?? null;

  const leftHidden = sp?.left === "0";
  const rightHidden = sp?.right === "0";
  const panelMode = sp?.panel === "advanced" ? "advanced" : "controls";
  const assetsTab = sp?.assetsTab === "reference" ? "reference" : "generated";

  async function save(formData: FormData) {
    "use server";
    try {
      const result = await saveCarouselEditorStateFromForm(formData);
      const qs = getUiQueryFromForm(formData);
      if (!result.ok) {
        qs.set("error", result.error);
        redirect(toStudioUrl(id, qs));
      }
      qs.set("saved", "1");
      redirect(toStudioUrl(id, qs));
    } catch {
      const qs = getUiQueryFromForm(formData);
      qs.set("error", "Erro ao salvar. Tente novamente.");
      redirect(toStudioUrl(id, qs));
    }
  }

  async function generate(formData: FormData) {
    "use server";
    const imageModel = formData.get("imageModel")
      ? String(formData.get("imageModel"))
      : undefined;

    const result = await generateFirstDraft({ carouselId: id, imageModel });
    const qs = getUiQueryFromForm(formData);
    if (!result.ok) {
      const message =
        result.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(result.error ?? "Falha ao gerar.");
      qs.set("error", message);
      redirect(toStudioUrl(id, qs));
    }
    qs.set("generated", "1");
    redirect(toStudioUrl(id, qs));
  }

  async function cleanup(formData: FormData) {
    "use server";
    const result = await cleanupPlaceholderGeneratedAssets({ carouselId: id });
    const qs = getUiQueryFromForm(formData);
    if (!result.ok) {
      const message =
        result.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(result.error ?? "Falha ao limpar.");
      qs.set("error", message);
      redirect(toStudioUrl(id, qs));
    }
    qs.set("cleaned", String(result.deleted));
    redirect(toStudioUrl(id, qs));
  }

  async function saveLocks(formData: FormData) {
    "use server";
    const result = await saveCarouselElementLocksFromForm(formData);
    const qs = getUiQueryFromForm(formData);
    if (!result.ok) {
      qs.set("error", result.error);
      redirect(toStudioUrl(id, qs));
    }
    qs.set("locksSaved", "1");
    redirect(toStudioUrl(id, qs));
  }

  async function edit(formData: FormData) {
    "use server";
    const instruction = formData.get("instruction")
      ? String(formData.get("instruction"))
      : "";
    const slideIndexRaw = formData.get("slideIndex");
    const currentSlideRaw = formData.get("currentSlide");
    const slideIndex =
      typeof slideIndexRaw === "string" && slideIndexRaw.trim().length > 0
        ? Number(slideIndexRaw)
        : undefined;
    const currentSlide =
      typeof currentSlideRaw === "string" && currentSlideRaw.trim().length > 0
        ? Number(currentSlideRaw)
        : undefined;

    const result = await applyNaturalLanguageEdit({
      carouselId: id,
      instruction,
      slideIndex: Number.isFinite(slideIndex) ? slideIndex : undefined
    });

    const qs = getUiQueryFromForm(formData);
    if (!result.ok) {
      const message =
        result.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(result.error ?? "Falha ao aplicar edição.");
      qs.set("error", message);
      redirect(toStudioUrl(id, qs));
    }

    qs.set("edited", "1");
    qs.set("applied", String(result.applied));
    qs.set("locked", String(result.skippedLocked));
    qs.set("missing", String(result.skippedMissing));
    if (result.summary) qs.set("editSummary", result.summary);
    const slideForRedirect = Number.isFinite(currentSlide) ? currentSlide : slideIndex;
    if (Number.isFinite(slideForRedirect)) qs.set("slide", String(slideForRedirect));
    redirect(toStudioUrl(id, qs));
  }

  const placeholderCount = projectData.assets.filter((a) => {
    const meta = a.metadata as unknown;
    if (!meta || typeof meta !== "object") return false;
    return (meta as Record<string, unknown>).provider === "placeholder";
  }).length;

  const generationMeta = projectData.carousel.generation_meta as unknown;
  const imagesMeta =
    generationMeta && typeof generationMeta === "object"
      ? ((generationMeta as Record<string, unknown>).images as
          | Record<string, unknown>
          | undefined)
      : undefined;
  const imagesDone = typeof imagesMeta?.done === "number" ? imagesMeta.done : null;
  const imagesTotal = typeof imagesMeta?.total === "number" ? imagesMeta.total : null;
  const imagesFailed =
    typeof imagesMeta?.failed === "number" ? imagesMeta.failed : null;

  const editorState = projectData.carousel.editor_state as unknown;
  const slidesRaw =
    editorState && typeof editorState === "object"
      ? Array.isArray((editorState as Record<string, unknown>).slides)
        ? ((editorState as Record<string, unknown>).slides as unknown[]).filter(
            (s) => s && typeof s === "object"
          )
        : []
      : [];

  const slideCount = slidesRaw.length;
  const selectedSlideIndex = (() => {
    const raw = sp?.slide ? Number(sp.slide) : 1;
    const i = Number.isFinite(raw) ? Math.trunc(raw) : 1;
    if (i < 1) return 1;
    if (i > Math.max(1, slideCount)) return Math.max(1, slideCount);
    return i;
  })();

  const uiQueryString = (() => {
    const qs = new URLSearchParams();
    qs.set("slide", String(selectedSlideIndex));
    if (leftHidden) qs.set("left", "0");
    if (rightHidden) qs.set("right", "0");
    if (panelMode === "advanced") qs.set("panel", "advanced");
    if (assetsTab === "reference") qs.set("assetsTab", "reference");
    return qs.toString();
  })();

  function studioHref(overrides: Record<string, string | null | undefined>) {
    const qs = new URLSearchParams(uiQueryString);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === undefined || value === "") qs.delete(key);
      else qs.set(key, value);
    }
    return toStudioUrl(id, qs);
  }

  const selectedSlide =
    slideCount > 0 ? (slidesRaw[selectedSlideIndex - 1] as Record<string, unknown>) : null;

  function getSlideTitle(
    slide: Record<string, unknown> | null,
    fallbackIndex?: number
  ): string {
    if (!slide) return "Sem slide";
    const objects = Array.isArray(slide.objects) ? (slide.objects as unknown[]) : [];
    const title = objects.find((o) => {
      if (!o || typeof o !== "object") return false;
      const r = o as Record<string, unknown>;
      return r.type === "text" && (r.id === "title" || r.id === "headline");
    }) as Record<string, unknown> | undefined;
    const text = title?.text;
    if (typeof text === "string" && text.trim().length > 0) return text.trim();
    return `Slide ${fallbackIndex ?? selectedSlideIndex}`;
  }

  function getSlideBody(slide: Record<string, unknown> | null): string | null {
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

  type CarouselAsset = (typeof projectData.assets)[number];
  const referenceAssets = projectData.assets.filter(
    (a) => a.asset_type === "reference"
  );
  const generatedAssets = projectData.assets.filter(
    (a) => a.asset_type === "generated"
  );

  async function withSignedUrls(
    assets: CarouselAsset[],
    limit: number
  ): Promise<
    Array<
      CarouselAsset & {
        signedUrl: string | null;
      }
    >
  > {
    const selected = assets.slice(0, limit);
    const signed = await Promise.all(
      selected.map(async (asset) => {
        const { signedUrl } = await createSignedUrl({
          bucket: asset.storage_bucket,
          path: asset.storage_path,
          expiresIn: 60 * 10
        });
        return { ...asset, signedUrl };
      })
    );
    return signed;
  }

  const signedReferenceAssets =
    assetsTab === "reference" ? await withSignedUrls(referenceAssets, 12) : [];
  const signedGeneratedAssets =
    assetsTab === "generated" ? await withSignedUrls(generatedAssets, 12) : [];

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-x-hidden bg-muted/30">
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        <header className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight">Studio</h1>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {projectData.carousel.generation_status === "succeeded"
                  ? "Pronto"
                  : projectData.carousel.generation_status === "running"
                    ? "Gerando"
                    : "MVP"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Você poderá editar elementos no canvas mais adiante. Por enquanto, este preview
              valida geração, assets, locks e edições por comando.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={studioHref({ left: leftHidden ? null : "0" })}
              className="rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
            >
              {leftHidden ? "Mostrar painel" : "Ocultar painel"}
            </Link>
            <Link
              href={studioHref({ right: rightHidden ? null : "0" })}
              className="rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
            >
              {rightHidden ? "Mostrar propriedades" : "Ocultar propriedades"}
            </Link>

            <div className="flex overflow-hidden rounded-xl border bg-background">
              <Link
                href={studioHref({ panel: null })}
                className={[
                  "px-3 py-2 text-sm",
                  panelMode === "controls"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                ].join(" ")}
              >
                Controles
              </Link>
              <Link
                href={studioHref({ panel: "advanced" })}
                className={[
                  "px-3 py-2 text-sm",
                  panelMode === "advanced"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                ].join(" ")}
              >
                Avançado
              </Link>
            </div>

            <Link
              href={`/app/carousels/${id}`}
              className="rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
            >
              Voltar ao projeto
            </Link>
            <Link
              href="/app"
              className="rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
            >
              Carrosséis
            </Link>
          </div>
        </header>

        {saved || locksSaved || edited || cleaned !== null || error ? (
          <div className="mt-4 space-y-2">
            {saved ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                Salvo.
              </div>
            ) : null}
            {locksSaved ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                Locks salvos.
              </div>
            ) : null}
            {cleaned !== null ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                Limpeza concluída: removidos {cleaned} assets placeholder.
              </div>
            ) : null}
            {edited ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                Edição aplicada: {applied ?? 0} • ignoradas (locked): {locked ?? 0} • ausentes:{" "}
                {missing ?? 0}
                {editSummary ? (
                  <span className="ml-2 text-muted-foreground">({editSummary})</span>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className={[
            "mt-5 grid gap-4",
            leftHidden && rightHidden
              ? "grid-cols-1"
              : leftHidden
                ? "grid-cols-1 lg:grid-cols-[1fr_320px]"
                : rightHidden
                  ? "grid-cols-1 lg:grid-cols-[320px_1fr]"
                  : "grid-cols-1 lg:grid-cols-[320px_1fr_320px]"
          ].join(" ")}
        >
          {!leftHidden ? (
            <aside className="rounded-3xl border bg-background/80 shadow-sm backdrop-blur">
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Studio</div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {slideCount} slides
                  </span>
                </div>
              </div>

              <div className="divide-y">
                <details open className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                    <span>Geração</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {projectData.carousel.generation_status === "succeeded"
                        ? "Pronto"
                        : projectData.carousel.generation_status === "running"
                          ? "Gerando"
                          : "—"}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="text-xs text-muted-foreground">
                      {imagesDone !== null && imagesTotal !== null ? (
                        <span className="font-mono">
                          Imagens: {imagesDone}/{imagesTotal}
                          {imagesFailed !== null && imagesFailed > 0
                            ? ` (falhas: ${imagesFailed})`
                            : ""}
                        </span>
                      ) : (
                        <span>Status: <span className="font-mono">{projectData.carousel.generation_status}</span></span>
                      )}
                      {projectData.carousel.generation_error ? (
                        <span className="ml-2 text-red-700">
                          {projectData.carousel.generation_error}
                        </span>
                      ) : null}
                    </div>

                    <form action={generate} className="space-y-2">
                      <input type="hidden" name="uiQuery" value={uiQueryString} />
                      <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">Modelo de imagem</span>
                        <select
                          name="imageModel"
                          defaultValue={GEMINI_IMAGE_MODELS.NANO_BANANA}
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        >
                          <option value={GEMINI_IMAGE_MODELS.NANO_BANANA}>Nano Banana</option>
                          <option value={GEMINI_IMAGE_MODELS.NANO_BANANA_PRO}>
                            Nano Banana Pro
                          </option>
                        </select>
                      </label>
                      <button
                        className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        type="submit"
                      >
                        Gerar rascunho
                      </button>
                    </form>

                    {placeholderCount > 0 ? (
                      <form action={cleanup}>
                        <input type="hidden" name="uiQuery" value={uiQueryString} />
                        <button
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                          type="submit"
                        >
                          Limpar placeholders ({placeholderCount})
                        </button>
                      </form>
                    ) : null}
                  </div>
                </details>

                <details open className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                    <span>Edição por comando</span>
                    <span className="text-xs text-muted-foreground">IA</span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <form action={edit} className="space-y-2">
                      <input type="hidden" name="uiQuery" value={uiQueryString} />
                      <input type="hidden" name="currentSlide" value={selectedSlideIndex} />
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
                          {Array.from({ length: slideCount }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              Slide {i + 1}
                            </option>
                          ))}
                          <option value="">Todos</option>
                        </select>
                        <button
                          className="whitespace-nowrap rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          type="submit"
                        >
                          Aplicar
                        </button>
                      </div>
                    </form>
                    <div className="text-xs text-muted-foreground">
                      Locks protegem elementos contra edições por IA.
                    </div>
                  </div>
                </details>

                <details open className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                    <span>Assets</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {generatedAssets.length + referenceAssets.length}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Geradas</span>: imagens criadas pela IA.{" "}
                      <span className="font-medium text-foreground">Referências</span>: imagens que você envia como inspiração.
                    </div>

                    <div className="flex overflow-hidden rounded-xl border bg-background">
                      <Link
                        href={studioHref({ assetsTab: "generated" })}
                        className={[
                          "flex-1 px-3 py-2 text-center text-sm",
                          assetsTab === "generated"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary"
                        ].join(" ")}
                      >
                        Geradas ({generatedAssets.length})
                      </Link>
                      <Link
                        href={studioHref({ assetsTab: "reference" })}
                        className={[
                          "flex-1 px-3 py-2 text-center text-sm",
                          assetsTab === "reference"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary"
                        ].join(" ")}
                      >
                        Referências ({referenceAssets.length})
                      </Link>
                    </div>

                    {assetsTab === "reference" ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            Envie imagens antes (ou durante) para guiar estilo/tema.
                          </div>
                          <Link
                            href={`/app/carousels/${id}/upload`}
                            className="rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary"
                          >
                            Enviar
                          </Link>
                        </div>
                        {signedReferenceAssets.length === 0 ? (
                          <div className="text-xs text-muted-foreground">
                            Nenhuma referência enviada.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {signedReferenceAssets.map((a) => (
                              <div
                                key={a.id}
                                className="overflow-hidden rounded-xl bg-muted/30"
                              >
                                {a.signedUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    alt=""
                                    src={a.signedUrl}
                                    className="h-24 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                                    Sem preview
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {signedGeneratedAssets.length === 0 ? (
                          <div className="text-xs text-muted-foreground">
                            Nenhuma imagem gerada ainda.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {signedGeneratedAssets.map((a) => (
                              <div
                                key={a.id}
                                className="overflow-hidden rounded-xl bg-muted/30"
                              >
                                {a.signedUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    alt=""
                                    src={a.signedUrl}
                                    className="h-24 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
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
                </details>
              </div>
            </aside>
          ) : null}

          <section className="rounded-3xl bg-muted/30">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm font-semibold">Canvas</div>
              <div className="text-xs text-muted-foreground">
                Slide{" "}
                <span className="rounded-full bg-background px-2 py-0.5 font-mono">
                  {selectedSlideIndex}/{Math.max(1, slideCount)}
                </span>
              </div>
            </div>

            <div className="px-4 pb-6">
              <div className="flex items-center justify-center py-6">
                <div className="relative aspect-square w-full max-w-[560px] rounded-2xl bg-background p-10 shadow-[0_30px_120px_rgba(0,0,0,0.12)]">
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
                </div>
              </div>

              <div className="flex justify-center">
                <span className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
                  Slide {selectedSlideIndex}
                </span>
              </div>

              <div className="mt-6 flex justify-center">
                <div className="flex max-w-full gap-2 overflow-auto rounded-2xl bg-background/70 p-2 shadow-sm">
                  {slideCount === 0
                    ? null
                    : Array.from({ length: slideCount }, (_, i) => {
                        const idx = i + 1;
                        const isActive = idx === selectedSlideIndex;
                        return (
                          <Link
                            key={idx}
                            href={studioHref({ slide: String(idx) })}
                            className={[
                              "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "bg-background hover:bg-secondary"
                            ].join(" ")}
                            aria-current={isActive ? "page" : undefined}
                            title={`Slide ${idx}`}
                          >
                            {idx}
                          </Link>
                        );
                      })}
                </div>
              </div>
            </div>
          </section>

          {!rightHidden ? (
            <aside className="rounded-3xl border bg-background/80 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between px-4 py-4">
                <div className="text-sm font-semibold">Propriedades</div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Slide {selectedSlideIndex}
                </span>
              </div>

              <div className="divide-y">
                <details open className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                    <span>Locks</span>
                    <span className="text-xs text-muted-foreground">proteção</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Locks protegem elementos de edições automáticas da IA. Formato:
                      <span className="ml-1 font-mono">{`{"slide_1":{"title":true}}`}</span>
                    </div>
                    <form action={saveLocks} className="space-y-2">
                      <input type="hidden" name="uiQuery" value={uiQueryString} />
                      <input type="hidden" name="carouselId" value={projectData.carousel.id} />
                      <textarea
                        name="elementLocksJson"
                        className="h-36 w-full rounded-xl border bg-background p-3 font-mono text-xs"
                        defaultValue={JSON.stringify(projectData.carousel.element_locks ?? {}, null, 2)}
                      />
                      <button
                        className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        type="submit"
                      >
                        Salvar locks
                      </button>
                    </form>
                  </div>
                </details>

                {panelMode === "advanced" ? (
                  <>
                    <details className="group px-4 py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                        <span>Editor State (JSON)</span>
                        <span className="text-xs text-muted-foreground">avançado</span>
                      </summary>
                      <div className="mt-3 space-y-2">
                        <form action={save} className="space-y-2">
                          <input type="hidden" name="uiQuery" value={uiQueryString} />
                          <input type="hidden" name="carouselId" value={projectData.carousel.id} />
                          <textarea
                            name="editorStateJson"
                            className="h-44 w-full rounded-xl border bg-background p-3 font-mono text-xs"
                            defaultValue={JSON.stringify(projectData.carousel.editor_state, null, 2)}
                          />
                          <button
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                            type="submit"
                          >
                            Salvar editor_state
                          </button>
                        </form>
                      </div>
                    </details>

                    <details className="group px-4 py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                        <span>Resumo</span>
                        <span className="text-xs text-muted-foreground">debug</span>
                      </summary>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Carousel</div>
                          <div className="font-mono text-xs">{projectData.carousel.id}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Status</div>
                          <div className="font-mono text-xs">{projectData.carousel.generation_status}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Geradas</div>
                          <div className="text-sm">{generatedAssets.length}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Referências</div>
                          <div className="text-sm">{referenceAssets.length}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Tons</div>
                          <div className="text-sm">{projectData.tones.length}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Públicos</div>
                          <div className="text-sm">{projectData.audiences.length}</div>
                        </div>
                      </div>
                    </details>
                  </>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
