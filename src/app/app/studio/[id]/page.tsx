import { notFound, redirect } from "next/navigation";
import { getStudioProject } from "@/lib/studio/queries";
import { GEMINI_IMAGE_MODELS } from "@/lib/ai/gemini_image";
import { createSignedUrl } from "@/lib/studio/storage";
import StudioShell from "./StudioShell";

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
          expiresIn: 60 * 60 * 6
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
      catalog={{
        templates: projectData.templates.length,
        presets: projectData.presets.length,
        palettes: projectData.palettes.length,
        tones: projectData.tones.length,
        audiences: projectData.audiences.length,
        creators: projectData.creatorProfiles.length
      }}
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
