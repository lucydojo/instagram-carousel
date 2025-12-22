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

export default async function StudioPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
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
    const slideIndex =
      typeof slideIndexRaw === "string" && slideIndexRaw.trim().length > 0
        ? Number(slideIndexRaw)
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
    redirect(`/app/studio/${id}?${qs.toString()}`);
  }

  const placeholderCount = project.assets.filter((a) => {
    const meta = a.metadata as unknown;
    if (!meta || typeof meta !== "object") return false;
    return (meta as Record<string, unknown>).provider === "placeholder";
  }).length;

  const generationMeta = project.carousel.generation_meta as unknown;
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

  const editorState = project.carousel.editor_state as unknown;
  const slideCount =
    editorState && typeof editorState === "object"
      ? Array.isArray((editorState as Record<string, unknown>).slides)
        ? ((editorState as Record<string, unknown>).slides as unknown[]).length
        : 0
      : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Studio (MVP)</h1>
        <p className="text-sm text-slate-600">
          Página provisória para testar as server actions da Task Group 4.
        </p>
      </div>

      {saved ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Salvo.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {locksSaved ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Locks salvos.
        </div>
      ) : null}

      {cleaned !== null ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Limpeza concluída: removidos {cleaned} assets placeholder.
        </div>
      ) : null}

      {edited ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Edição aplicada: {applied ?? 0} ops • ignoradas (locked): {locked ?? 0} •
          ausentes: {missing ?? 0}
          {editSummary ? <span className="ml-2 text-slate-700">({editSummary})</span> : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <div className="font-medium">Geração (IA)</div>
          <div className="text-slate-600">
            Status atual: <span className="font-mono">{project.carousel.generation_status}</span>
            {project.carousel.generation_error ? (
              <span className="ml-2 text-red-700">
                ({project.carousel.generation_error})
              </span>
            ) : null}
            {imagesDone !== null && imagesTotal !== null ? (
              <span className="ml-2">
                • Imagens:{" "}
                <span className="font-mono">
                  {imagesDone}/{imagesTotal}
                </span>
                {imagesFailed !== null && imagesFailed > 0 ? (
                  <span className="ml-1 text-amber-700">
                    (falhas: {imagesFailed})
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>
        <form action={generate} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-xs text-slate-600" htmlFor="imageModel">
            Modelo de imagem
          </label>
          <select
            id="imageModel"
            name="imageModel"
            defaultValue={GEMINI_IMAGE_MODELS.NANO_BANANA}
            className="rounded-md border bg-transparent px-2 py-1 text-sm"
          >
            <option value={GEMINI_IMAGE_MODELS.NANO_BANANA}>
              Nano Banana (Flash)
            </option>
            <option value={GEMINI_IMAGE_MODELS.NANO_BANANA_PRO}>
              Nano Banana Pro (Preview)
            </option>
          </select>
          <button className="rounded-md bg-black px-3 py-2 text-sm text-white" type="submit">
            Gerar rascunho
          </button>
        </form>
      </section>

      {placeholderCount > 0 ? (
        <section className="flex items-center justify-between gap-3 rounded-md border p-4">
          <div className="text-sm text-slate-700">
            Existem {placeholderCount} imagens antigas (placeholder) no projeto.
          </div>
          <form action={cleanup}>
            <button className="rounded-md border px-3 py-2 text-sm" type="submit">
              Limpar placeholders
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-md border p-4">
        <div className="mb-2 text-sm font-medium">Edição por comando (IA)</div>
        <form action={edit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs text-slate-600">Comando</span>
              <textarea
                name="instruction"
                className="h-24 w-full rounded-md border p-2 text-sm"
                placeholder='Ex: "Deixe o título do slide 1 mais forte e mude o texto do corpo para ser mais direto."'
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-600">Slide (opcional)</span>
              <select
                name="slideIndex"
                className="w-full rounded-md border bg-transparent px-2 py-2 text-sm"
                defaultValue=""
              >
                <option value="">Todos</option>
                {Array.from({ length: slideCount }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="rounded-md bg-black px-3 py-2 text-sm text-white" type="submit">
            Aplicar comando
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-600">
          Locks (element_locks) são respeitados; elementos travados não serão alterados.
        </p>
      </section>

      <section className="rounded-md border p-4">
        <div className="mb-2 text-sm font-medium">element_locks (JSON)</div>
        <form action={saveLocks} className="space-y-3">
          <input type="hidden" name="carouselId" value={project.carousel.id} />
          <textarea
            name="elementLocksJson"
            className="h-40 w-full rounded-md border bg-slate-50 p-3 font-mono text-xs"
            defaultValue={JSON.stringify(project.carousel.element_locks ?? {}, null, 2)}
          />
          <button className="rounded-md border px-3 py-2 text-sm" type="submit">
            Salvar element_locks
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-600">
          Formato recomendado: <code className="font-mono">{`{"slide_1":{"title":true}}`}</code>
        </p>
      </section>

      <section className="rounded-md border p-4">
        <div className="text-sm font-medium">Resumo</div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-600">Carousel</dt>
            <dd className="font-mono">{project.carousel.id}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Assets</dt>
            <dd>{project.assets.length}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Tons</dt>
            <dd>{project.tones.length}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Públicos</dt>
            <dd>{project.audiences.length}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Paletas</dt>
            <dd>{project.palettes.length}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Templates</dt>
            <dd>{project.templates.length}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-md border p-4">
        <div className="mb-2 text-sm font-medium">editor_state</div>
        <form action={save} className="space-y-3">
          <input type="hidden" name="carouselId" value={project.carousel.id} />
          <textarea
            name="editorStateJson"
            className="h-64 w-full rounded-md border bg-slate-50 p-3 font-mono text-xs"
            defaultValue={JSON.stringify(project.carousel.editor_state, null, 2)}
          />
          <button
            className="rounded-md bg-black px-3 py-2 text-sm text-white"
            type="submit"
          >
            Salvar editor_state
          </button>
        </form>
      </section>
    </div>
  );
}
