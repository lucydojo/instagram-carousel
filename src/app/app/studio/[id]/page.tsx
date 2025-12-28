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
import StudioShell from "./StudioShell";

function toStudioUrl(id: string, qs: URLSearchParams) {
  const query = qs.toString();
  return query ? `/app/studio/${id}?${query}` : `/app/studio/${id}`;
}

function getSlideParam(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

type SearchParams = {
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
};

type SignedAsset = {
  id: string;
  asset_type: string;
  signedUrl: string | null;
};

export default async function StudioPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const { user, project } = await getStudioProject(id);
  if (!user) redirect("/sign-in");
  if (!project) notFound();
  const projectData = project;

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

  function redirectWith(
    formData: FormData,
    extras: Record<string, string | null>
  ) {
    const qs = new URLSearchParams();
    const currentSlide = getSlideParam(formData.get("currentSlide"));
    const slideIndex = currentSlide ?? selectedSlideIndex;
    if (Number.isFinite(slideIndex)) qs.set("slide", String(slideIndex));
    for (const [key, value] of Object.entries(extras)) {
      if (value === null) qs.delete(key);
      else qs.set(key, value);
    }
    redirect(toStudioUrl(id, qs));
  }

  async function saveEditorState(formData: FormData) {
    "use server";
    try {
      const result = await saveCarouselEditorStateFromForm(formData);
      if (!result.ok) redirectWith(formData, { error: result.error });
      redirectWith(formData, { saved: "1" });
    } catch {
      redirectWith(formData, { error: "Erro ao salvar. Tente novamente." });
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
      redirectWith(formData, { error: message });
    }
    redirectWith(formData, { saved: null, error: null });
  }

  async function cleanup(formData: FormData) {
    "use server";
    const result = await cleanupPlaceholderGeneratedAssets({ carouselId: id });
    if (!result.ok) {
      const message =
        result.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(result.error ?? "Falha ao limpar.");
      redirectWith(formData, { error: message });
    }
    redirectWith(formData, { cleaned: String(result.deleted), error: null });
  }

  async function saveLocks(formData: FormData) {
    "use server";
    const result = await saveCarouselElementLocksFromForm(formData);
    if (!result.ok) redirectWith(formData, { error: result.error });
    redirectWith(formData, { locksSaved: "1", error: null });
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
      redirectWith(formData, { error: message });
    }

    redirectWith(formData, {
      edited: "1",
      applied: String(result.applied),
      locked: String(result.skippedLocked),
      missing: String(result.skippedMissing),
      editSummary: result.summary ?? null,
      error: null
    });
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
  const imagesTotal =
    typeof imagesMeta?.total === "number" ? imagesMeta.total : null;
  const imagesFailed =
    typeof imagesMeta?.failed === "number" ? imagesMeta.failed : null;

  async function withSignedUrls(
    assets: Array<(typeof projectData.assets)[number]>,
    limit: number
  ): Promise<SignedAsset[]> {
    const selected = assets.slice(0, limit);
    const signed = await Promise.all(
      selected.map(async (asset) => {
        const { signedUrl } = await createSignedUrl({
          bucket: asset.storage_bucket,
          path: asset.storage_path,
          expiresIn: 60 * 10
        });
        return { id: asset.id, asset_type: asset.asset_type, signedUrl };
      })
    );
    return signed;
  }

  const referenceAssets = projectData.assets.filter(
    (a) => a.asset_type === "reference"
  );
  const generatedAssets = projectData.assets.filter(
    (a) => a.asset_type === "generated"
  );

  const [signedReferenceAssets, signedGeneratedAssets] = await Promise.all([
    withSignedUrls(referenceAssets, 12),
    withSignedUrls(generatedAssets, 12)
  ]);

  const statusLabel =
    projectData.carousel.generation_status === "succeeded"
      ? "Pronto"
      : projectData.carousel.generation_status === "running"
        ? "Gerando"
        : "MVP";

  return (
    <StudioShell
      carouselId={id}
      slideCount={slideCount}
      initialSlideIndex={selectedSlideIndex}
      slides={slidesRaw as Record<string, unknown>[]}
      placeholderCount={placeholderCount}
      statusLabel={statusLabel}
      progress={{ imagesDone, imagesTotal, imagesFailed }}
      assets={{ generated: signedGeneratedAssets, reference: signedReferenceAssets }}
      flash={{
        saved,
        locksSaved,
        edited,
        cleaned,
        error,
        editSummary,
        applied,
        locked,
        missing
      }}
      imageModels={Object.values(GEMINI_IMAGE_MODELS)}
      actions={{
        generate,
        cleanup,
        edit,
        saveLocks,
        saveEditorState
      }}
      defaults={{
        elementLocksJson: JSON.stringify(
          projectData.carousel.element_locks ?? {},
          null,
          2
        ),
        editorStateJson: JSON.stringify(projectData.carousel.editor_state ?? {}, null, 2)
      }}
    />
  );
}
