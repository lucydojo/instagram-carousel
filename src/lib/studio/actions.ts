"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/app/access";
import { editorStateSchema } from "@/lib/studio/queries";
import { createSignedUrl } from "@/lib/studio/storage";
import { generateFirstDraftForCarousel } from "@/lib/studio/generation";
import { isSupportedGeminiImageModel } from "@/lib/ai/gemini_image";

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
