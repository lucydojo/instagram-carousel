"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/app/access";
import { editorStateSchema } from "@/lib/studio/queries";
import { createSignedUrl } from "@/lib/studio/storage";
import { generateFirstDraftForCarousel } from "@/lib/studio/generation";
import {
  geminiNanoBananaGenerateImage,
  GEMINI_IMAGE_MODELS,
  isSupportedGeminiImageModel,
  type GeminiImageModel
} from "@/lib/ai/gemini_image";
import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { editPatchSchema } from "@/lib/studio/edit_contract";
import { applyEditPatch } from "@/lib/studio/apply_edit_patch";
import { geminiGenerateJson } from "@/lib/ai/gemini";
import { isLocked } from "@/lib/studio/locks";

const idSchema = z.string().uuid();

function parseJsonSafe(
  value: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
}

export async function saveCarouselEditorStateFromForm(formData: FormData) {
  const parsed = z
    .object({
      carouselId: idSchema,
      editorStateJson: z.string().min(2)
    })
    .safeParse({
      carouselId: formData.get("carouselId"),
      editorStateJson: formData.get("editorStateJson")
    });

  if (!parsed.success) {
    return { ok: false as const, error: "Formulário inválido." };
  }

  const parsedJson = parseJsonSafe(parsed.data.editorStateJson);
  if (!parsedJson.ok) {
    return { ok: false as const, error: parsedJson.error };
  }

  const editorState = editorStateSchema.safeParse(parsedJson.value);
  if (!editorState.success) {
    return {
      ok: false as const,
      error: "editor_state inválido (precisa conter {\"version\": number})."
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return { ok: false as const, error: "Você precisa entrar novamente." };

  const { data: updated, error } = await supabase
    .from("carousels")
    .update({ editor_state: editorState.data })
    .eq("id", parsed.data.carouselId)
    .select("updated_at")
    .single();

  if (error || !updated) {
    return {
      ok: false as const,
      error: error?.message ?? "Não foi possível salvar."
    };
  }

  return { ok: true as const, updatedAt: updated.updated_at };
}

const nameSchema = z.string().trim().min(1).max(80);

export async function createUserTone(input: { name: string }) {
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false as const, error: "Invalid name." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("tones")
    .insert({ owner_id: userData.user.id, name: parsed.data, is_global: false })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "" };
  return { ok: true as const, id: data.id };
}

export async function createUserAudience(input: { name: string }) {
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false as const, error: "Invalid name." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("audiences")
    .insert({ owner_id: userData.user.id, name: parsed.data, is_global: false })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "" };
  return { ok: true as const, id: data.id };
}

const paletteSchema = z.object({
  name: nameSchema,
  paletteData: z.record(z.unknown())
});

export async function createUserPalette(input: {
  name: string;
  paletteData: Record<string, unknown>;
}) {
  const parsed = paletteSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid palette." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("palettes")
    .insert({
      owner_id: userData.user.id,
      name: parsed.data.name,
      palette_data: parsed.data.paletteData,
      is_global: false
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "" };
  return { ok: true as const, id: data.id };
}

export async function deleteUserPalette(input: { id: string }) {
  const parsed = z.object({ id: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid palette." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("palettes")
    .delete()
    .eq("id", parsed.data.id)
    .eq("owner_id", userData.user.id)
    .eq("is_global", false);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

const templateSchema = z.object({
  name: nameSchema,
  templateData: z.record(z.unknown()),
  isGlobal: z.boolean().optional()
});

export async function createCarouselTemplate(input: {
  name: string;
  templateData: Record<string, unknown>;
  isGlobal?: boolean;
}) {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid template." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const isGlobal = Boolean(parsed.data.isGlobal);
  if (isGlobal) {
    const allowed = await isCurrentUserSuperAdmin();
    if (!allowed) return { ok: false as const, error: "FORBIDDEN" };
  }

  const { data, error } = await supabase
    .from("carousel_templates")
    .insert({
      name: parsed.data.name,
      template_data: parsed.data.templateData,
      is_global: isGlobal,
      owner_id: isGlobal ? null : userData.user.id,
      workspace_id: null
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false as const, error: error?.message ?? "" };
  return { ok: true as const, id: data.id };
}

export async function updateCarouselTemplate(input: {
  id: string;
  name?: string;
  templateData?: Record<string, unknown>;
}) {
  const parsed = z
    .object({
      id: idSchema,
      name: nameSchema.optional(),
      templateData: z.record(z.unknown()).optional()
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid template." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data: current, error: currentError } = await supabase
    .from("carousel_templates")
    .select("is_global")
    .eq("id", parsed.data.id)
    .single();
  if (currentError || !current)
    return {
      ok: false as const,
      error: currentError?.message ?? "Not found."
    };

  if (current.is_global) {
    const allowed = await isCurrentUserSuperAdmin();
    if (!allowed) return { ok: false as const, error: "FORBIDDEN" };
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.templateData !== undefined)
    updates.template_data = parsed.data.templateData;

  const { error } = await supabase
    .from("carousel_templates")
    .update(updates)
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function deleteCarouselTemplate(input: { id: string }) {
  const parsed = idSchema.safeParse(input.id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("carousel_templates")
    .delete()
    .eq("id", parsed.data);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

const presetSchema = z.object({
  name: nameSchema,
  presetData: z.record(z.unknown())
});

async function getWorkspaceIdForUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.workspace_id ?? null;
}

export async function createUserPreset(input: {
  name: string;
  presetData: Record<string, unknown>;
}) {
  const parsed = presetSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid preset." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const workspaceId = await getWorkspaceIdForUser(supabase, userData.user.id);
  if (!workspaceId) return { ok: false as const, error: "NO_WORKSPACE" };

  const { data, error } = await supabase
    .from("user_presets")
    .insert({
      workspace_id: workspaceId,
      owner_id: userData.user.id,
      name: parsed.data.name,
      preset_data: parsed.data.presetData
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false as const, error: error?.message ?? "" };
  return { ok: true as const, id: data.id };
}

export async function updateUserPreset(input: {
  id: string;
  name?: string;
  presetData?: Record<string, unknown>;
}) {
  const parsed = z
    .object({
      id: idSchema,
      name: nameSchema.optional(),
      presetData: z.record(z.unknown()).optional()
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid preset." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.presetData !== undefined)
    updates.preset_data = parsed.data.presetData;

  const { error } = await supabase
    .from("user_presets")
    .update(updates)
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function deleteUserPreset(input: { id: string }) {
  const parsed = idSchema.safeParse(input.id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { error } = await supabase.from("user_presets").delete().eq("id", input.id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

const creatorProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  handle: z.string().trim().min(1).max(80).optional(),
  roleTitle: z.string().trim().min(1).max(120).optional(),
  avatarPath: z.string().trim().min(1).max(500).optional(),
  isDefault: z.boolean().optional()
});

export async function createCreatorProfile(input: {
  displayName: string;
  handle?: string;
  roleTitle?: string;
  avatarPath?: string;
  isDefault?: boolean;
}) {
  const parsed = creatorProfileSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: "Invalid creator profile." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const workspaceId = await getWorkspaceIdForUser(supabase, userData.user.id);
  if (!workspaceId) return { ok: false as const, error: "NO_WORKSPACE" };

  const { data, error } = await supabase
    .from("creator_profiles")
    .insert({
      workspace_id: workspaceId,
      owner_id: userData.user.id,
      display_name: parsed.data.displayName,
      handle: parsed.data.handle ?? null,
      role_title: parsed.data.roleTitle ?? null,
      avatar_path: parsed.data.avatarPath ?? null,
      is_default: Boolean(parsed.data.isDefault)
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false as const, error: error?.message ?? "" };
  return { ok: true as const, id: data.id };
}

export async function updateCreatorProfile(input: {
  id: string;
  displayName?: string;
  handle?: string | null;
  roleTitle?: string | null;
  avatarPath?: string | null;
  isDefault?: boolean;
}) {
  const parsed = z
    .object({
      id: idSchema,
      displayName: z.string().trim().min(1).max(120).optional(),
      handle: z.string().trim().min(1).max(80).nullable().optional(),
      roleTitle: z.string().trim().min(1).max(120).nullable().optional(),
      avatarPath: z.string().trim().min(1).max(500).nullable().optional(),
      isDefault: z.boolean().optional()
    })
    .safeParse(input);

  if (!parsed.success)
    return { ok: false as const, error: "Invalid creator profile." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const updates: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined)
    updates.display_name = parsed.data.displayName;
  if (parsed.data.handle !== undefined) updates.handle = parsed.data.handle;
  if (parsed.data.roleTitle !== undefined)
    updates.role_title = parsed.data.roleTitle;
  if (parsed.data.avatarPath !== undefined)
    updates.avatar_path = parsed.data.avatarPath;
  if (parsed.data.isDefault !== undefined)
    updates.is_default = parsed.data.isDefault;

  const { error } = await supabase
    .from("creator_profiles")
    .update(updates)
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function deleteCreatorProfile(input: { id: string }) {
  const parsed = idSchema.safeParse(input.id);
  if (!parsed.success) return { ok: false as const, error: "Invalid id." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("creator_profiles")
    .delete()
    .eq("id", parsed.data);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function getSignedUrl(input: {
  bucket: string;
  path: string;
  expiresIn?: number;
}) {
  return await createSignedUrl(input);
}

export async function getSignedUrlForCarouselAsset(input: {
  assetId: string;
  expiresIn?: number;
}) {
  const parsed = z
    .object({ assetId: idSchema, expiresIn: z.number().int().min(10).optional() })
    .safeParse(input);
  if (!parsed.success) return { signedUrl: null, error: "Invalid asset id." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { signedUrl: null, error: "UNAUTHENTICATED" };

  const { data: asset, error } = await supabase
    .from("carousel_assets")
    .select("storage_bucket, storage_path")
    .eq("id", parsed.data.assetId)
    .single();

  if (error || !asset) return { signedUrl: null, error: error?.message ?? "" };

  return await createSignedUrl({
    bucket: asset.storage_bucket,
    path: asset.storage_path,
    expiresIn: parsed.data.expiresIn
  });
}

export async function generateFirstDraft(input: {
  carouselId: string;
  imageModel?: string;
}) {
  const parsed = z
    .object({
      carouselId: idSchema,
      imageModel: z.string().optional()
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid carouselId." };

  const imageModel =
    parsed.data.imageModel && isSupportedGeminiImageModel(parsed.data.imageModel)
      ? parsed.data.imageModel
      : undefined;

  return await generateFirstDraftForCarousel({
    carouselId: parsed.data.carouselId,
    imageModel
  });
}

export async function cleanupPlaceholderGeneratedAssets(input: { carouselId: string }) {
  const parsed = z.object({ carouselId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid carouselId." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data: carousel } = await supabase
    .from("carousels")
    .select("id, owner_id")
    .eq("id", parsed.data.carouselId)
    .maybeSingle();

  if (!carousel) return { ok: false as const, error: "NOT_FOUND" };
  if (carousel.owner_id !== userData.user.id)
    return { ok: false as const, error: "FORBIDDEN" };

  const { data: assets, error: assetsError } = await supabase
    .from("carousel_assets")
    .select("id, storage_bucket, storage_path, metadata, asset_type")
    .eq("carousel_id", parsed.data.carouselId)
    .eq("asset_type", "generated");

  if (assetsError) return { ok: false as const, error: assetsError.message };

  const placeholderAssets = (assets ?? []).filter((a) => {
    const meta = a.metadata as unknown;
    if (!meta || typeof meta !== "object") return false;
    const provider = (meta as Record<string, unknown>).provider;
    return provider === "placeholder";
  });

  if (placeholderAssets.length === 0) {
    return { ok: true as const, deleted: 0 };
  }

  const admin = createSupabaseAdminClientIfAvailable();
  if (admin) {
    const byBucket = new Map<string, string[]>();
    for (const a of placeholderAssets) {
      const list = byBucket.get(a.storage_bucket) ?? [];
      list.push(a.storage_path);
      byBucket.set(a.storage_bucket, list);
    }

    for (const [bucket, paths] of byBucket.entries()) {
      // remove supports batches; keep it small anyway
      for (let i = 0; i < paths.length; i += 100) {
        await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      }
    }
  }

  const ids = placeholderAssets.map((a) => a.id);
  const { error: deleteError } = await supabase
    .from("carousel_assets")
    .delete()
    .in("id", ids);

  if (deleteError) return { ok: false as const, error: deleteError.message };
  return { ok: true as const, deleted: ids.length };
}

export async function saveCarouselElementLocksFromForm(formData: FormData) {
  const parsed = z
    .object({
      carouselId: idSchema,
      elementLocksJson: z.string().min(2)
    })
    .safeParse({
      carouselId: formData.get("carouselId"),
      elementLocksJson: formData.get("elementLocksJson")
    });

  if (!parsed.success) {
    return { ok: false as const, error: "Formulário inválido." };
  }

  const parsedJson = parseJsonSafe(parsed.data.elementLocksJson);
  if (!parsedJson.ok) {
    return { ok: false as const, error: parsedJson.error };
  }

  if (!parsedJson.value || typeof parsedJson.value !== "object") {
    return { ok: false as const, error: "element_locks precisa ser um objeto JSON." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return { ok: false as const, error: "Você precisa entrar novamente." };

  const { data: updated, error } = await supabase
    .from("carousels")
    .update({ element_locks: parsedJson.value as Record<string, unknown> })
    .eq("id", parsed.data.carouselId)
    .select("updated_at")
    .single();

  if (error || !updated) {
    return { ok: false as const, error: error?.message ?? "Não foi possível salvar." };
  }

  return { ok: true as const, updatedAt: updated.updated_at };
}

const nlEditInputSchema = z.object({
  carouselId: idSchema,
  instruction: z.string().trim().min(2).max(2000),
  slideIndex: z.coerce.number().int().min(1).max(20).optional()
});

function toEditableSummary(editorState: unknown) {
  if (!editorState || typeof editorState !== "object") return [];
  const slides = (editorState as Record<string, unknown>).slides;
  if (!Array.isArray(slides)) return [];
  return slides.map((s, idx) => {
    const slide = s as Record<string, unknown>;
    const objects = Array.isArray(slide.objects)
      ? (slide.objects as unknown[])
      : [];
    return {
      slideIndex: idx + 1,
      slideId: typeof slide.id === "string" ? slide.id : null,
      objects: objects
        .filter((o) => o && typeof o === "object")
        .map((o) => {
          const obj = o as Record<string, unknown>;
          return {
            id: obj.id ?? null,
            type: obj.type ?? null,
            text: obj.text ?? null,
            x: obj.x ?? null,
            y: obj.y ?? null,
            width: obj.width ?? null,
            height: obj.height ?? null,
            slotId: obj.slotId ?? null,
            assetId: obj.assetId ?? null
          };
        })
    };
  });
}

async function uploadBytesToStorage(input: {
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const admin = createSupabaseAdminClientIfAvailable();
  const supabase = admin ?? (await createSupabaseServerClient());

  const body = Buffer.from(input.bytes);
  const { error } = await supabase.storage
    .from(input.bucket)
    .upload(input.path, body, { upsert: false, contentType: input.contentType });

  return { error };
}

function listLockedElements(elementLocks: unknown) {
  const locks: Array<{ slideKey: string; objectId: string }> = [];

  if (!elementLocks || typeof elementLocks !== "object") return locks;
  if (Array.isArray(elementLocks)) {
    for (const v of elementLocks) {
      if (typeof v !== "string") continue;
      const [slideKey, objectId] = v.split(":");
      if (slideKey && objectId) locks.push({ slideKey, objectId });
    }
    return locks;
  }

  const root = elementLocks as Record<string, unknown>;
  for (const [slideKey, value] of Object.entries(root)) {
    if (!value || typeof value !== "object") continue;
    for (const [objectId, locked] of Object.entries(value as Record<string, unknown>)) {
      if (locked) locks.push({ slideKey, objectId });
    }
  }

  return locks;
}

type RequestedRole = "title" | "body" | "tagline" | "cta" | "image" | "text";

function inferRequestedRoles(instruction: string): { wantsAll: boolean; roles: Set<RequestedRole> } {
  const raw = instruction.toLowerCase();
  const roles = new Set<RequestedRole>();

  const wantsAll =
    /\b(tudo|todos|todas|everything|all)\b/.test(raw) ||
    /carrossel\s+(inteiro|completo)/.test(raw) ||
    /mude\s+tudo|troque\s+tudo|refa[cç]a\s+tudo|reescreva\s+tudo/.test(raw);

  const wantsImage =
    /\b(imagem|imagens|foto|fotos|image|images|background|fundo)\b/.test(raw) ||
    /regenera(r)?\s+imagem/.test(raw);
  const wantsTitle = /\b(t[ií]tulo|title|heading)\b/.test(raw);
  const wantsBody =
    /\b(corpo|body|descri[cç][aã]o|par[aá]grafo)\b/.test(raw) ||
    /texto\s+do\s+corpo/.test(raw);
  const wantsCta = /\b(cta|call to action|chamada)\b/.test(raw);
  const wantsTagline = /\b(tagline|subt[ií]tulo|subtitle)\b/.test(raw);

  if (wantsImage) roles.add("image");
  if (wantsTitle) roles.add("title");
  if (wantsBody) roles.add("body");
  if (wantsCta) roles.add("cta");
  if (wantsTagline) roles.add("tagline");

  // If user explicitly says "texto" but not image, treat as "text" intent.
  if (!wantsImage && /\b(texto|copy)\b/.test(raw)) roles.add("text");

  return { wantsAll, roles };
}

function inferRoleForObject(obj: { id?: unknown; type?: unknown }): RequestedRole | null {
  const type = typeof obj.type === "string" ? obj.type : null;
  const id = typeof obj.id === "string" ? obj.id : null;
  if (type === "image") return "image";
  if (type !== "text") return null;
  const key = (id ?? "").toLowerCase();
  if (key === "title" || key.includes("title") || key.includes("titulo")) return "title";
  if (key === "body" || key.includes("body") || key.includes("corpo") || key.includes("desc"))
    return "body";
  if (key === "cta" || key.includes("cta")) return "cta";
  if (key === "tagline" || key.includes("tagline") || key.includes("subtitulo")) return "tagline";
  // Unknown text object: treat as generic text (only allowed when user asked for "texto" or "tudo").
  return "text";
}

function buildSlideIdMap(summary: Array<{ slideIndex: number; slideId: string | null }>) {
  const map = new Map<number, { slideId: string | null; slideKeyFallback: string }>();
  for (const s of summary) {
    map.set(s.slideIndex, {
      slideId: s.slideId ?? null,
      slideKeyFallback: `slide_${s.slideIndex}`
    });
  }
  return map;
}

function buildAllowedTargetKeys(input: {
  summary: ReturnType<typeof toEditableSummary>;
  slideIndex?: number;
  requested: { wantsAll: boolean; roles: Set<RequestedRole> };
}) {
  const allowed = new Set<string>();
  const wantText = input.requested.roles.has("text");

  for (const slide of input.summary) {
    if (typeof input.slideIndex === "number" && slide.slideIndex !== input.slideIndex) continue;
    for (const obj of slide.objects) {
      const id = typeof obj.id === "string" ? obj.id : null;
      if (!id) continue;
      const role = inferRoleForObject(obj);
      if (!role) continue;

      const allow =
        input.requested.wantsAll ||
        input.requested.roles.size === 0 ||
        input.requested.roles.has(role) ||
        (wantText && role !== "image");
      if (!allow) continue;

      allowed.add(`${slide.slideIndex}:${id}`);
    }
  }

  return allowed;
}

export async function applyNaturalLanguageEdit(input: {
  carouselId: string;
  instruction: string;
  slideIndex?: number;
}) {
  const parsed = nlEditInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Entrada inválida." };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data: carousel } = await supabase
    .from("carousels")
    .select("id, workspace_id, owner_id, editor_state, element_locks, generation_meta")
    .eq("id", parsed.data.carouselId)
    .maybeSingle();

  if (!carousel) return { ok: false as const, error: "NOT_FOUND" };
  if (carousel.owner_id !== userData.user.id)
    return { ok: false as const, error: "FORBIDDEN" };

  const editorState = carousel.editor_state as unknown;
  const summary = toEditableSummary(editorState);
  const locked = listLockedElements(carousel.element_locks as unknown);
  const requested = inferRequestedRoles(parsed.data.instruction);
  const allowedTargets = buildAllowedTargetKeys({
    summary,
    slideIndex: parsed.data.slideIndex,
    requested
  });
  const slideIdMap = buildSlideIdMap(summary);

  const system = [
    "Você é um assistente de edição de um editor de carrosséis.",
    "Sua tarefa é gerar um PATCH JSON para alterar o editor_state.",
    "NÃO inclua Markdown. Responda SOMENTE com JSON válido.",
    "Regras:",
    "- Use apenas operações: set_text, set_style, move, regenerate_image",
    "- Sempre inclua slideIndex (1..N) e objectId",
    "- Use regenerate_image SOMENTE se o usuário pedir para mudar/gerar imagem",
    "- Em regenerate_image.prompt, descreva a imagem e inclua '1080x1080' e o estilo desejado",
    "- NÃO modifique elementos travados (lockedElements).",
    "- Se o usuário pedir para mudar um elemento travado, NÃO compense mudando outro elemento; apenas ignore e explique no summary.",
    "- Não invente novos objectIds. Use apenas ids existentes no contexto.",
    parsed.data.slideIndex
      ? `- Restrinja a edição ao slideIndex alvo (${parsed.data.slideIndex}).`
      : "- Se o usuário escolher um slide alvo, edite apenas aquele slide."
  ].join("\n");

  const user = [
    "Contexto (slides e elementos):",
    JSON.stringify(summary, null, 2),
    "",
    "lockedElements:",
    JSON.stringify(locked, null, 2),
    "",
    "allowedTargets (slideIndex:objectId) — se um target não estiver aqui, NÃO edite:",
    JSON.stringify(Array.from(allowedTargets), null, 2),
    "",
    parsed.data.slideIndex ? `slideIndex alvo: ${parsed.data.slideIndex}` : "",
    `Instrução do usuário: ${parsed.data.instruction}`,
    "",
    "Formato esperado:",
    JSON.stringify(
      {
        ops: [
          { op: "set_text", slideIndex: 1, objectId: "title", text: "..." },
          { op: "set_style", slideIndex: 1, objectId: "title", style: { fontWeight: 700 } },
          { op: "move", slideIndex: 1, objectId: "title", x: 100, y: 200 },
          {
            op: "regenerate_image",
            slideIndex: 1,
            objectId: "image_hero",
            prompt: "Gere uma imagem ...",
            withText: false
          }
        ],
        summary: "..."
      },
      null,
      2
    )
  ]
    .filter(Boolean)
    .join("\n");

  // Early return: if user is requesting only locked targets (common "mude o título"),
  // avoid spending tokens and just report the lock.
  if (!requested.wantsAll && requested.roles.size > 0 && allowedTargets.size > 0) {
    const slideIndex = parsed.data.slideIndex;
    if (typeof slideIndex === "number") {
      const slideMeta = slideIdMap.get(slideIndex);
      const lockedRequested = Array.from(allowedTargets)
        .filter((k) => k.startsWith(`${slideIndex}:`))
        .filter((k) => {
          const objectId = k.split(":")[1] ?? "";
          return isLocked({
            locks: carousel.element_locks as unknown,
            slideId: slideMeta?.slideId ?? undefined,
            slideIndex,
            objectId
          });
        });

      const hasAnyUnlockedAllowedTarget = Array.from(allowedTargets)
        .filter((k) => k.startsWith(`${slideIndex}:`))
        .some((k) => {
          const objectId = k.split(":")[1] ?? "";
          return !isLocked({
            locks: carousel.element_locks as unknown,
            slideId: slideMeta?.slideId ?? undefined,
            slideIndex,
            objectId
          });
        });

      if (lockedRequested.length > 0 && !hasAnyUnlockedAllowedTarget) {
        return {
          ok: true as const,
          applied: 0,
          skippedLocked: 0,
          skippedMissing: 0,
          blockedByLock: lockedRequested.length,
          skippedPolicy: 0,
          summary: "Nada foi aplicado porque os elementos solicitados estão bloqueados por lock.",
          nextState: currentStateSchemaFallback(editorState),
          newAssets: []
        };
      }
    }
  }

  const patchRes = await geminiGenerateJson({
    system,
    user,
    schema: editPatchSchema
  });

  if (!patchRes.ok) {
    return { ok: false as const, error: patchRes.error };
  }

  const currentState = editorStateSchema.safeParse(editorState);
  if (!currentState.success) {
    return {
      ok: false as const,
      error: "editor_state atual inválido; não foi possível aplicar edição."
    };
  }

  // Policy: avoid "retargeting" edits when user asked for specific elements.
  const originalOps = patchRes.data.ops;
  const filteredOps: typeof originalOps = [];
  let skippedPolicy = 0;
  for (const op of originalOps) {
    const slideIndex = typeof op.slideIndex === "number" ? op.slideIndex : null;
    if (typeof parsed.data.slideIndex === "number" && slideIndex !== parsed.data.slideIndex) {
      skippedPolicy++;
      continue;
    }
    const key = `${op.slideIndex}:${op.objectId}`;
    if (allowedTargets.size > 0 && !allowedTargets.has(key)) {
      skippedPolicy++;
      continue;
    }
    filteredOps.push(op);
  }

  // Convert image regeneration ops into concrete assets (set_asset).
  const admin = createSupabaseAdminClientIfAvailable();
  const supabaseForInsert = admin ?? supabase;

  const setAssetOps: Array<{ op: "set_asset"; slideIndex: number; objectId: string; assetId: string }> = [];
  const newAssets: Array<{ id: string; signedUrl: string | null }> = [];

  for (const op of filteredOps) {
    if (op.op !== "regenerate_image") continue;
    const slideIndex = typeof op.slideIndex === "number" ? op.slideIndex : null;
    if (!slideIndex) continue;

    const wantsText =
      Boolean(op.withText) ||
      /texto\s+na\s+imagem|com\s+texto/i.test(parsed.data.instruction);

    const model: GeminiImageModel = wantsText
      ? GEMINI_IMAGE_MODELS.NANO_BANANA_PRO
      : GEMINI_IMAGE_MODELS.NANO_BANANA;

    const image = await geminiNanoBananaGenerateImage({
      prompt: op.prompt,
      model
    });
    if (!image.ok) continue;

    const ext = image.mimeType.includes("png")
      ? "png"
      : image.mimeType.includes("jpeg") || image.mimeType.includes("jpg")
        ? "jpg"
        : "png";

    const path = `workspaces/${carousel.workspace_id}/carousels/${carousel.id}/generated/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await uploadBytesToStorage({
      bucket: "carousel-assets",
      path,
      bytes: image.bytes,
      contentType: image.mimeType
    });
    if (uploadError) continue;

    const { data: inserted, error: insertError } = await supabaseForInsert
      .from("carousel_assets")
      .insert({
        workspace_id: carousel.workspace_id,
        carousel_id: carousel.id,
        owner_id: userData.user.id,
        asset_type: "generated",
        storage_bucket: "carousel-assets",
        storage_path: path,
        mime_type: image.mimeType,
        status: "ready",
        metadata: {
          provider: image.provider,
          model: image.model,
          slideIndex,
          prompt: op.prompt,
          source: "nl_edit"
        }
      })
      .select("id")
      .single();

    if (insertError || !inserted) continue;
    setAssetOps.push({ op: "set_asset", slideIndex, objectId: op.objectId, assetId: inserted.id });

    const signed = await createSignedUrl({ bucket: "carousel-assets", path });
    newAssets.push({ id: inserted.id, signedUrl: signed.signedUrl });
  }

  const patchForApply = {
    ...patchRes.data,
    ops: [
      ...filteredOps.filter((op) => op.op !== "regenerate_image"),
      ...setAssetOps
    ]
  };

  const applied = applyEditPatch({
    editorState: currentState.data,
    locks: carousel.element_locks as unknown,
    patch: patchForApply
  });

  // Count locks in a user-meaningful way: include both (a) ops skipped due to lock and
  // (b) elements the user requested that are locked (even if model didn't emit an op).
  const blockedTargets = new Set<string>();
  for (const op of applied.skippedLockedOps) {
    const s = typeof op.slideIndex === "number" ? op.slideIndex : null;
    if (!s) continue;
    blockedTargets.add(`${s}:${op.objectId}`);
  }
  for (const key of allowedTargets) {
    const [sRaw, objectId] = key.split(":");
    const slideIndex = Number(sRaw);
    if (!Number.isFinite(slideIndex) || !objectId) continue;
    const slideMeta = slideIdMap.get(slideIndex);
    if (
      isLocked({
        locks: carousel.element_locks as unknown,
        slideId: slideMeta?.slideId ?? undefined,
        slideIndex,
        objectId
      })
    ) {
      blockedTargets.add(`${slideIndex}:${objectId}`);
    }
  }

  const appliedOps = applied.appliedOps;
  const didText =
    appliedOps.some((o) => o.op === "set_text") || appliedOps.some((o) => o.op === "set_style");
  const didMove = appliedOps.some((o) => o.op === "move");
  const didImage = appliedOps.some((o) => o.op === "set_asset");
  const summaryParts: string[] = [];
  if (didText) summaryParts.push("Atualizou texto/estilo");
  if (didMove) summaryParts.push("Moveu elementos");
  if (didImage) summaryParts.push("Atualizou imagem");
  if (summaryParts.length === 0) summaryParts.push("Nenhuma alteração aplicada");
  if (blockedTargets.size > 0) summaryParts.push(`Locks respeitados: ${blockedTargets.size}`);
  if (skippedPolicy > 0) summaryParts.push(`Ignorados por política: ${skippedPolicy}`);

  const prevMeta =
    carousel.generation_meta && typeof carousel.generation_meta === "object"
      ? (carousel.generation_meta as Record<string, unknown>)
      : {};

  const history = Array.isArray(prevMeta.edits) ? (prevMeta.edits as unknown[]) : [];
  const nextHistory = [
    {
      at: new Date().toISOString(),
      instruction: parsed.data.instruction,
      slideIndex: parsed.data.slideIndex ?? null,
      patch: patchRes.data,
      applied: applied.applied,
      skippedLocked: applied.skippedLocked,
      skippedMissing: applied.skippedMissing,
      model: process.env.GEMINI_MODEL ?? "gemini"
    },
    ...history
  ].slice(0, 20);

  const nextMeta = { ...prevMeta, edits: nextHistory };

  const { error: updateError } = await supabase
    .from("carousels")
    .update({ editor_state: applied.nextState, generation_meta: nextMeta })
    .eq("id", parsed.data.carouselId);

  if (updateError) return { ok: false as const, error: updateError.message };

  return {
    ok: true as const,
    applied: applied.applied,
    skippedLocked: applied.skippedLocked,
    skippedMissing: applied.skippedMissing,
    skippedPolicy,
    blockedByLock: blockedTargets.size,
    summary: summaryParts.join(" · "),
    nextState: applied.nextState,
    newAssets
  };
}

function currentStateSchemaFallback(editorState: unknown) {
  const parsed = editorStateSchema.safeParse(editorState);
  return parsed.success ? parsed.data : ({ version: 1, slides: [] } as unknown);
}
