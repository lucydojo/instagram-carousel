import { redirect } from "next/navigation";
import { z } from "zod";
import type { CarouselDraft } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const newCarouselSchema = z.object({
  inputMode: z.enum(["topic", "prompt"]),
  topic: z.string().optional(),
  prompt: z.string().optional(),
  slidesCount: z.coerce.number().int().min(2).max(10),
  platform: z.literal("instagram"),
  tone: z.string().optional(),
  targetAudience: z.string().optional(),
  language: z.string().optional(),
  templateId: z.string().optional(),
  presetId: z.string().optional(),
  creatorEnabled: z.coerce.boolean().optional(),
  creatorName: z.string().optional(),
  creatorHandle: z.string().optional(),
  creatorRole: z.string().optional(),
  paletteBackground: z.string().optional(),
  paletteText: z.string().optional(),
  paletteAccent: z.string().optional()
});

async function createCarousel(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/sign-in");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!membership?.workspace_id) {
    redirect("/app");
  }

  const parsed = newCarouselSchema.safeParse({
    inputMode: formData.get("inputMode"),
    topic: formData.get("topic") ? String(formData.get("topic")) : undefined,
    prompt: formData.get("prompt") ? String(formData.get("prompt")) : undefined,
    slidesCount: formData.get("slidesCount"),
    platform: "instagram",
    tone: formData.get("tone") ? String(formData.get("tone")) : undefined,
    targetAudience: formData.get("targetAudience")
      ? String(formData.get("targetAudience"))
      : undefined,
    language: formData.get("language")
      ? String(formData.get("language"))
      : undefined,
    templateId: formData.get("templateId")
      ? String(formData.get("templateId"))
      : undefined,
    presetId: formData.get("presetId")
      ? String(formData.get("presetId"))
      : undefined,
    creatorEnabled: formData.get("creatorEnabled") ? true : false,
    creatorName: formData.get("creatorName")
      ? String(formData.get("creatorName"))
      : undefined,
    creatorHandle: formData.get("creatorHandle")
      ? String(formData.get("creatorHandle"))
      : undefined,
    creatorRole: formData.get("creatorRole")
      ? String(formData.get("creatorRole"))
      : undefined,
    paletteBackground: formData.get("paletteBackground")
      ? String(formData.get("paletteBackground"))
      : undefined,
    paletteText: formData.get("paletteText")
      ? String(formData.get("paletteText"))
      : undefined,
    paletteAccent: formData.get("paletteAccent")
      ? String(formData.get("paletteAccent"))
      : undefined
  });

  if (!parsed.success) {
    redirect(`/app/new?error=${encodeURIComponent("Invalid form")}`);
  }

  const values = parsed.data;

  const draft: CarouselDraft = {
    inputMode: values.inputMode,
    topic: values.topic,
    prompt: values.prompt,
    slidesCount: values.slidesCount,
    platform: values.platform,
    tone: values.tone,
    targetAudience: values.targetAudience,
    language: values.language,
    presetId: values.presetId,
    templateId: values.templateId,
    creatorInfo: {
      enabled: Boolean(values.creatorEnabled),
      name: values.creatorName,
      handle: values.creatorHandle,
      role: values.creatorRole
    },
    palette: {
      background: values.paletteBackground,
      text: values.paletteText,
      accent: values.paletteAccent
    }
  };

  const { data: created, error } = await supabase
    .from("carousels")
    .insert({
      workspace_id: membership.workspace_id,
      owner_id: userData.user.id,
      title: values.topic || "Untitled carousel",
      draft
    })
    .select("id")
    .single();

  if (error || !created) {
    redirect(
      `/app/new?error=${encodeURIComponent(error?.message ?? "Failed to create")}`
    );
  }

  redirect(`/app/carousels/${created.id}`);
}

export default async function NewCarouselPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">New carousel (draft)</h1>
        <p className="text-sm text-slate-600">
          No generation yet — this only saves your inputs.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form action={createCarousel} className="space-y-4 rounded-md border p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Input mode</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              name="inputMode"
              defaultValue="topic"
            >
              <option value="topic">Topic</option>
              <option value="prompt">Prompt</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Slides</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="slidesCount"
              type="number"
              min={2}
              max={10}
              defaultValue={5}
              required
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Topic</span>
          <input className="w-full rounded-md border px-3 py-2" name="topic" />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Prompt</span>
          <textarea
            className="w-full rounded-md border px-3 py-2"
            name="prompt"
            rows={4}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Tone</span>
            <input className="w-full rounded-md border px-3 py-2" name="tone" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Audience</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="targetAudience"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Language</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="language"
              defaultValue="English"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Template (id)</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="templateId"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Preset (id)</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              name="presetId"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="creatorEnabled" />
            <span className="text-sm font-medium">Creator info</span>
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Name</span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="creatorName"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Handle</span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="creatorHandle"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Role</span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="creatorRole"
              />
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="text-sm font-medium">Palette</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Background</span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="paletteBackground"
                placeholder="#ffffff"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Text</span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="paletteText"
                placeholder="#111827"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Accent</span>
              <input
                className="w-full rounded-md border px-3 py-2"
                name="paletteAccent"
                placeholder="#a78bfa"
              />
            </label>
          </div>
        </div>

        <button
          className="w-full rounded-md bg-black px-3 py-2 text-white"
          type="submit"
        >
          Create draft
        </button>
      </form>
    </div>
  );
}
