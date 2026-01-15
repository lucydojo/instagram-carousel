"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { createSignedUrl } from "@/lib/studio/storage";
import {
  applyNaturalLanguageEdit,
  cleanupPlaceholderGeneratedAssets,
  createCarouselTemplate,
  createUserPalette,
  deleteUserPalette,
  generateFirstDraft,
  saveCarouselElementLocksFromForm,
  saveCarouselEditorStateFromForm,
  updateCarouselTemplate
} from "@/lib/studio/actions";

function getCarouselId(formData: FormData): string {
  const raw = formData.get("carouselId");
  if (typeof raw !== "string" || raw.trim().length === 0) return "";
  return raw.trim();
}

function getSlideIndex(formData: FormData): number | null {
  const raw = formData.get("currentSlide");
  if (typeof raw !== "string") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

function redirectBack(
  carouselId: string,
  formData: FormData,
  extras: Record<string, string | null>
) {
  if (!carouselId) redirect("/app");
  const qs = new URLSearchParams();
  const slide = getSlideIndex(formData);
  if (slide) qs.set("slide", String(slide));
  for (const [key, value] of Object.entries(extras)) {
    if (value === null) qs.delete(key);
    else qs.set(key, value);
  }
  const query = qs.toString();
  redirect(query ? `/app/studio/${carouselId}?${query}` : `/app/studio/${carouselId}`);
}

export async function studioSaveEditorState(formData: FormData) {
  const carouselId = getCarouselId(formData);
  try {
    const result = await saveCarouselEditorStateFromForm(formData);
    if (!result.ok) redirectBack(carouselId, formData, { error: result.error });
    redirectBack(carouselId, formData, { saved: "1", error: null });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectBack(carouselId, formData, {
      error: "Erro ao salvar. Tente novamente."
    });
  }
}

export async function studioSaveEditorStateInline(input: {
  carouselId: string;
  editorStateJson: string;
}) {
  const formData = new FormData();
  formData.set("carouselId", input.carouselId);
  formData.set("editorStateJson", input.editorStateJson);
  return await saveCarouselEditorStateFromForm(formData);
}

export async function studioSaveLocksInline(input: {
  carouselId: string;
  elementLocksJson: string;
}) {
  const formData = new FormData();
  formData.set("carouselId", input.carouselId);
  formData.set("elementLocksJson", input.elementLocksJson);
  return await saveCarouselElementLocksFromForm(formData);
}

export async function studioCreatePalette(input: {
  name: string;
  paletteData: Record<string, unknown>;
}) {
  return await createUserPalette({
    name: input.name,
    paletteData: input.paletteData
  });
}

export async function studioDeletePalette(input: { id: string }) {
  return await deleteUserPalette(input);
}

export async function studioCreateTemplate(input: {
  name: string;
  templateData: Record<string, unknown>;
  isGlobal?: boolean;
}) {
  return await createCarouselTemplate({
    name: input.name,
    templateData: input.templateData,
    isGlobal: input.isGlobal
  });
}

export async function studioUpdateTemplate(input: {
  id: string;
  name?: string;
  templateData?: Record<string, unknown>;
}) {
  return await updateCarouselTemplate(input);
}

export async function studioUploadReferences(formData: FormData) {
  const carouselId = getCarouselId(formData);
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File);

  if (!carouselId) {
    return { ok: false as const, error: "Carrossel inválido." };
  }
  if (files.length === 0) {
    return { ok: false as const, error: "Nenhum arquivo enviado." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false as const, error: "UNAUTHENTICATED" };
  }

  const { data: carousel } = await supabase
    .from("carousels")
    .select("id, workspace_id, owner_id")
    .eq("id", carouselId)
    .maybeSingle();

  if (!carousel) {
    return { ok: false as const, error: "Carrossel não encontrado." };
  }
  if (carousel.owner_id !== userData.user.id) {
    return { ok: false as const, error: "Acesso negado." };
  }

  const admin = createSupabaseAdminClientIfAvailable();
  const storageClient = admin ?? supabase;
  const insertedAssets: Array<{ id: string; signedUrl: string | null }> = [];

  for (const file of files) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `workspaces/${carousel.workspace_id}/carousels/${carousel.id}/reference/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await storageClient.storage
      .from("carousel-assets")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      const message =
        !admin && uploadError.message.toLowerCase().includes("row-level")
          ? `${uploadError.message} (Set SUPABASE_SERVICE_ROLE_KEY or add Storage policies for authenticated uploads.)`
          : uploadError.message;
      return { ok: false as const, error: message };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("carousel_assets")
      .insert({
        workspace_id: carousel.workspace_id,
        carousel_id: carousel.id,
        owner_id: userData.user.id,
        asset_type: "reference",
        storage_bucket: "carousel-assets",
        storage_path: path,
        mime_type: file.type
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return {
        ok: false as const,
        error: insertError?.message ?? "Falha ao salvar referência."
      };
    }

    const signed = await createSignedUrl({ bucket: "carousel-assets", path });
    insertedAssets.push({ id: inserted.id, signedUrl: signed.signedUrl });
  }

  return { ok: true as const, assets: insertedAssets };
}

export async function studioGenerate(formData: FormData) {
  const carouselId = getCarouselId(formData);
  const imageModel = formData.get("imageModel")
    ? String(formData.get("imageModel"))
    : undefined;
  const result = await generateFirstDraft({ carouselId, imageModel });
  if (!result.ok) {
    const message =
      result.error === "GENERATION_RUNNING"
        ? "Geração já em andamento."
        : result.error === "UNAUTHENTICATED"
        ? "Você precisa entrar novamente."
        : String(result.error ?? "Falha ao gerar.");
    redirectBack(carouselId, formData, { error: message });
  }
  redirectBack(carouselId, formData, { error: null });
}

export async function studioCleanup(formData: FormData) {
  const carouselId = getCarouselId(formData);
  const result = await cleanupPlaceholderGeneratedAssets({ carouselId });
  if (!result.ok) {
    const message =
      result.error === "UNAUTHENTICATED"
        ? "Você precisa entrar novamente."
        : String(result.error ?? "Falha ao limpar.");
    redirectBack(carouselId, formData, { error: message });
  }
  redirectBack(carouselId, formData, {
    cleaned: String(result.deleted),
    error: null
  });
}

export async function studioSaveLocks(formData: FormData) {
  const carouselId = getCarouselId(formData);
  const result = await saveCarouselElementLocksFromForm(formData);
  if (!result.ok) redirectBack(carouselId, formData, { error: result.error });
  redirectBack(carouselId, formData, { locksSaved: "1", error: null });
}

export async function studioEdit(formData: FormData) {
  const carouselId = getCarouselId(formData);
  const instruction = formData.get("instruction")
    ? String(formData.get("instruction"))
    : "";
  const slideIndexRaw = formData.get("slideIndex");
  const slideIndex =
    typeof slideIndexRaw === "string" && slideIndexRaw.trim().length > 0
      ? Number(slideIndexRaw)
      : undefined;

  const result = await applyNaturalLanguageEdit({
    carouselId,
    instruction,
    slideIndex: Number.isFinite(slideIndex) ? slideIndex : undefined
  });

  if (!result.ok) {
    const message =
      result.error === "UNAUTHENTICATED"
        ? "Você precisa entrar novamente."
        : String(result.error ?? "Falha ao aplicar edição.");
    redirectBack(carouselId, formData, { error: message });
  }

  redirectBack(carouselId, formData, {
    edited: "1",
    applied: String(result.applied),
    locked: String(result.skippedLocked),
    missing: String(result.skippedMissing),
    editSummary: result.summary ?? null,
    error: null
  });
}

export async function studioEditInline(input: {
  carouselId: string;
  instruction: string;
  slideIndex?: number;
}) {
  return await applyNaturalLanguageEdit(input);
}
