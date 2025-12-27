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

export default async function StudioPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    slide?: string;
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
  const editSummary = sp?.editSummary ? decodeURIComponent(sp.editSummary) : null;
  const error = sp?.error ? decodeURIComponent(sp.error) : null;

  async function save(formData: FormData) {
    "use server";
    try {
      const result = await saveCarouselEditorStateFromForm(formData);
      if (!result.ok) {
        redirect(`/app/studio/${id}?error=${encodeURIComponent(result.error)}`);
      }
      redirect(`/app/studio/${id}?saved=1`);
    } catch {
      redirect(
        `/app/studio/${id}?error=${encodeURIComponent("Erro ao salvar. Tente novamente.")}`
      );
    }
  }

  async function generate(formData: FormData) {
    "use server";
    const imageModel = formData.get("imageModel")
      ? String(formData.get("imageModel"))
      : undefined;

    const result = await generateFirstDraft({ carouselId: id, imageModel });
    if (!result.ok) {
      const message =
        result.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(result.error ?? "Falha ao gerar.");
      redirect(`/app/studio/${id}?error=${encodeURIComponent(message)}`);
    }
    redirect(`/app/studio/${id}?generated=1`);
  }

  async function cleanup() {
    "use server";
    const result = await cleanupPlaceholderGeneratedAssets({ carouselId: id });
    if (!result.ok) {
      const message =
        result.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(result.error ?? "Falha ao limpar.");
      redirect(`/app/studio/${id}?error=${encodeURIComponent(message)}`);
    }
    redirect(`/app/studio/${id}?cleaned=${result.deleted}`);
  }

  async function saveLocks(formData: FormData) {
    "use server";
    const result = await saveCarouselElementLocksFromForm(formData);
    if (!result.ok) {
      redirect(`/app/studio/${id}?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/app/studio/${id}?locksSaved=1`);
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

    if (!result.ok) {
      const message =
        result.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(result.error ?? "Falha ao aplicar edição.");
      redirect(`/app/studio/${id}?error=${encodeURIComponent(message)}`);
    }

    const qs = new URLSearchParams();
    qs.set("edited", "1");
    qs.set("applied", String(result.applied));
    qs.set("locked", String(result.skippedLocked));
    qs.set("missing", String(result.skippedMissing));
    if (result.summary) qs.set("editSummary", encodeURIComponent(result.summary));
    const slideForRedirect = Number.isFinite(currentSlide) ? currentSlide : slideIndex;
    if (Number.isFinite(slideForRedirect)) qs.set("slide", String(slideForRedirect));
    redirect(`/app/studio/${id}?${qs.toString()}`);
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

  const signedReferenceAssets = await withSignedUrls(referenceAssets, 12);
  const signedGeneratedAssets = await withSignedUrls(generatedAssets, 12);

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <div className="mx-auto max-w-[1440px] px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">Studio</h1>
              <span className="rounded-full border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground backdrop-blur">
                MVP
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Edição visual (canvas) + geração por IA. Por enquanto, o canvas é um preview.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/app/carousels/${id}`}
              className="rounded-xl border bg-card/50 px-3 py-2 text-sm text-foreground shadow-sm backdrop-blur hover:bg-card"
            >
              Voltar ao projeto
            </Link>
            <Link
              href="/app"
              className="rounded-xl border bg-card/50 px-3 py-2 text-sm text-foreground shadow-sm backdrop-blur hover:bg-card"
            >
              Carousels
            </Link>
          </div>
        </div>

        {saved || locksSaved || edited || cleaned !== null || error ? (
          <div className="mb-4 space-y-2">
            {saved ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                Salvo.
              </div>
            ) : null}

            {locksSaved ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                Locks salvos.
              </div>
            ) : null}

            {cleaned !== null ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                Limpeza concluída: removidos {cleaned} assets placeholder.
              </div>
            ) : null}

            {edited ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                Edição aplicada: {applied ?? 0} ops • ignoradas (locked): {locked ?? 0} • ausentes:{" "}
                {missing ?? 0}
                {editSummary ? (
                  <span className="ml-2 text-muted-foreground">({editSummary})</span>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr_380px]">
          {/* Left Sidebar */}
          <aside className="space-y-3 rounded-2xl border bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Ferramentas</div>
              <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {slideCount} slides
              </span>
            </div>

            <details open className="group rounded-xl border bg-background/50 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                <div className="flex items-center justify-between">
                  <span>Gerar</span>
                  <span className="text-xs text-muted-foreground group-open:hidden">
                    expandir
                  </span>
                </div>
              </summary>
              <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-xl border bg-card/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="font-mono text-xs">
                      {projectData.carousel.generation_status}
                    </div>
                  </div>
                  {projectData.carousel.generation_error ? (
                    <div className="mt-2 text-xs text-red-700">
                      {projectData.carousel.generation_error}
                    </div>
                  ) : null}
                  {imagesDone !== null && imagesTotal !== null ? (
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Imagens</span>
                      <span className="font-mono">
                        {imagesDone}/{imagesTotal}
                        {imagesFailed !== null && imagesFailed > 0 ? ` (falhas: ${imagesFailed})` : ""}
                      </span>
                    </div>
                  ) : null}
                </div>

                <form action={generate} className="space-y-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Modelo de imagem</span>
                    <select
                      name="imageModel"
                      defaultValue={GEMINI_IMAGE_MODELS.NANO_BANANA}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    >
                      <option value={GEMINI_IMAGE_MODELS.NANO_BANANA}>Nano Banana</option>
                      <option value={GEMINI_IMAGE_MODELS.NANO_BANANA_PRO}>Nano Banana Pro</option>
                    </select>
                  </label>
                  <button
                    className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                    type="submit"
                  >
                    Gerar rascunho
                  </button>
                </form>

                {placeholderCount > 0 ? (
                  <form action={cleanup}>
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

            <details className="group rounded-xl border bg-background/50 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                <div className="flex items-center justify-between">
                  <span>Paleta</span>
                  <span className="text-xs text-muted-foreground">
                    {projectData.palettes.length} opções
                  </span>
                </div>
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <div className="text-xs text-muted-foreground">
                  (MVP) Seleção/edição avançada entra na próxima etapa.
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {projectData.palettes.slice(0, 10).map((p) => (
                    <div
                      key={p.id}
                      className="h-9 rounded-lg border bg-gradient-to-br from-primary/15 to-transparent"
                      title={p.name}
                    />
                  ))}
                </div>
              </div>
            </details>

            <details className="group rounded-xl border bg-background/50 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                <div className="flex items-center justify-between">
                  <span>Presets</span>
                  <span className="text-xs text-muted-foreground">
                    {projectData.presets.length}
                  </span>
                </div>
              </summary>
              <div className="mt-3 space-y-2">
                {projectData.presets.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    (MVP) Sem presets ainda. Vamos adicionar gestão de presets na UI depois.
                  </div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {projectData.presets.slice(0, 6).map((p) => (
                      <li key={p.id} className="rounded-lg border bg-card/40 px-3 py-2">
                        <div className="text-sm font-medium">{p.name}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>

            <details open className="group rounded-xl border bg-background/50 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                <div className="flex items-center justify-between">
                  <span>Referências</span>
                  <span className="text-xs text-muted-foreground">{referenceAssets.length}</span>
                </div>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Imagens que você envia para guiar estilo/tema.
                  </div>
                  <Link
                    href={`/app/carousels/${id}/upload`}
                    className="rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary"
                  >
                    Enviar
                  </Link>
                </div>
                {signedReferenceAssets.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sem referências.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {signedReferenceAssets.map((a) => (
                      <div key={a.id} className="overflow-hidden rounded-xl border bg-card/30">
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
            </details>
          </aside>

          {/* Center */}
          <main className="space-y-3">
            <section className="rounded-2xl border bg-card/60 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Preview</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Slide</span>
                  <span className="rounded-full border bg-background px-2 py-0.5 font-mono">
                    {selectedSlideIndex}/{Math.max(1, slideCount)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center">
                <div className="relative aspect-square w-full max-w-[720px] overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
                  <div className="absolute inset-0 p-10">
                    <div className="text-xs text-muted-foreground">Canvas (placeholder)</div>
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
              </div>

              <div className="mt-4 flex gap-2 overflow-auto pb-1">
                {slideCount === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum slide ainda.</div>
                ) : (
                  Array.from({ length: slideCount }, (_, i) => {
                    const idx = i + 1;
                    const slide = slidesRaw[i] as Record<string, unknown>;
                    const isActive = idx === selectedSlideIndex;
                    return (
                      <Link
                        key={idx}
                        href={`/app/studio/${id}?slide=${idx}`}
                        className={[
                          "min-w-[140px] rounded-xl border px-3 py-2 text-left text-sm shadow-sm transition",
                          isActive
                            ? "border-primary bg-primary/10"
                            : "bg-background hover:bg-secondary"
                        ].join(" ")}
                      >
                        <div className="text-xs text-muted-foreground">Slide {idx}</div>
                        <div className="mt-1 line-clamp-2 text-sm font-medium">
                          {getSlideTitle(slide, idx)}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          </main>

          {/* Right Sidebar */}
          <aside className="space-y-3 rounded-2xl border bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Ajustes</div>
              <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                slide {selectedSlideIndex}
              </span>
            </div>

            <details open className="group rounded-xl border bg-background/50 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                Edição por comando (IA)
              </summary>
              <div className="mt-3 space-y-3">
                <form action={edit} className="space-y-2">
                  <input type="hidden" name="currentSlide" value={selectedSlideIndex} />
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Comando</span>
                    <textarea
                      name="instruction"
                      className="h-24 w-full rounded-xl border bg-background p-3 text-sm"
                      placeholder='Ex: “Deixe o título mais forte e encurte o texto do corpo.”'
                      required
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Aplicar em</span>
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
                  </label>
                  <button
                    className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                    type="submit"
                  >
                    Aplicar comando
                  </button>
                </form>
                <div className="text-xs text-muted-foreground">
                  Locks (element_locks) são respeitados: elementos travados não são alterados.
                </div>
              </div>
            </details>

            <details className="group rounded-xl border bg-background/50 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                Locks (JSON)
              </summary>
              <div className="mt-3 space-y-2">
                <form action={saveLocks} className="space-y-2">
                  <input
                    type="hidden"
                    name="carouselId"
                    value={projectData.carousel.id}
                  />
                  <textarea
                    name="elementLocksJson"
                    className="h-36 w-full rounded-xl border bg-background p-3 font-mono text-xs"
                    defaultValue={JSON.stringify(
                      projectData.carousel.element_locks ?? {},
                      null,
                      2
                    )}
                  />
                  <button
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-secondary"
                    type="submit"
                  >
                    Salvar locks
                  </button>
                </form>
                <div className="text-xs text-muted-foreground">
                  Exemplo: <span className="font-mono">{`{"slide_1":{"title":true}}`}</span>
                </div>
              </div>
            </details>

            <details open className="group rounded-xl border bg-background/50 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                Assets geradas
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total</span>
                  <span className="font-mono">{generatedAssets.length}</span>
                </div>
                {signedGeneratedAssets.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    Nada gerado ainda. Clique em “Gerar rascunho”.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {signedGeneratedAssets.map((a) => (
                      <div key={a.id} className="overflow-hidden rounded-xl border bg-card/30">
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
                        <div className="px-2 py-1 text-[11px] text-muted-foreground">
                          {a.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>

            <details className="group rounded-xl border bg-background/50 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium">
                Salvar (editor_state)
              </summary>
              <div className="mt-3 space-y-2">
                <form action={save} className="space-y-2">
                  <input
                    type="hidden"
                    name="carouselId"
                    value={projectData.carousel.id}
                  />
                  <textarea
                    name="editorStateJson"
                    className="h-40 w-full rounded-xl border bg-background p-3 font-mono text-xs"
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
          </aside>
        </div>
      </div>
    </div>
  );
}
