"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  applyNaturalLanguageEdit,
  cleanupPlaceholderGeneratedAssets,
  generateFirstDraft,
  saveCarouselElementLocksFromForm,
  saveCarouselEditorStateFromForm
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

export async function studioGenerate(formData: FormData) {
  const carouselId = getCarouselId(formData);
  const imageModel = formData.get("imageModel")
    ? String(formData.get("imageModel"))
    : undefined;
  const result = await generateFirstDraft({ carouselId, imageModel });
  if (!result.ok) {
    const message =
      result.error === "UNAUTHENTICATED"
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
