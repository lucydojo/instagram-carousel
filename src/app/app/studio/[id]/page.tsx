import { notFound, redirect } from "next/navigation";
import { getStudioProject } from "@/lib/studio/queries";
import { generateFirstDraft, saveCarouselEditorStateFromForm } from "@/lib/studio/actions";

export default async function StudioPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { user, project } = await getStudioProject(id);
  if (!user) redirect("/sign-in");
  if (!project) notFound();

  const sp = await searchParams;
  const saved = sp?.saved === "1";
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

  async function generate() {
    "use server";
    const result = await generateFirstDraft({ carouselId: id });
    if (!result.ok) {
      const message =
        result.error === "UNAUTHENTICATED"
          ? "Você precisa entrar novamente."
          : String(result.error ?? "Falha ao gerar.");
      redirect(`/app/studio/${id}?error=${encodeURIComponent(message)}`);
    }
    redirect(`/app/studio/${id}?generated=1`);
  }

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

      <section className="flex items-center justify-between gap-3 rounded-md border p-4">
        <div className="text-sm">
          <div className="font-medium">Geração (IA)</div>
          <div className="text-slate-600">
            Status atual: <span className="font-mono">{project.carousel.generation_status}</span>
            {project.carousel.generation_error ? (
              <span className="ml-2 text-red-700">
                ({project.carousel.generation_error})
              </span>
            ) : null}
          </div>
        </div>
        <form action={generate}>
          <button className="rounded-md bg-black px-3 py-2 text-sm text-white" type="submit">
            Gerar rascunho
          </button>
        </form>
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
