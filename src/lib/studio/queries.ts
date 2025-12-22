import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CarouselEditorState } from "@/lib/db/types";

export const editorStateSchema: z.ZodType<CarouselEditorState> = z.object({
  version: z.number().int().min(1),
  global: z.record(z.unknown()).optional(),
  slides: z.array(z.record(z.unknown())).optional()
});

export async function getStudioProject(carouselId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { user: null, project: null };

  const { data: carousel } = await supabase
    .from("carousels")
    .select("*")
    .eq("id", carouselId)
    .maybeSingle();

  if (!carousel) return { user: userData.user, project: null };

  const { data: assets } = await supabase
    .from("carousel_assets")
    .select("*")
    .eq("carousel_id", carouselId)
    .order("created_at", { ascending: false });

  const { data: tones } = await supabase
    .from("tones")
    .select("id, name, is_global")
    .order("is_global", { ascending: false })
    .order("name", { ascending: true });

  const { data: audiences } = await supabase
    .from("audiences")
    .select("id, name, is_global")
    .order("is_global", { ascending: false })
    .order("name", { ascending: true });

  const { data: palettes } = await supabase
    .from("palettes")
    .select("id, name, is_global, palette_data")
    .order("is_global", { ascending: false })
    .order("name", { ascending: true });

  const { data: templates } = await supabase
    .from("carousel_templates")
    .select("id, name, is_global, template_data")
    .order("is_global", { ascending: false })
    .order("name", { ascending: true });

  const { data: presets } = await supabase
    .from("user_presets")
    .select("id, name, preset_data, updated_at")
    .order("updated_at", { ascending: false });

  const { data: creatorProfiles } = await supabase
    .from("creator_profiles")
    .select(
      "id, display_name, handle, role_title, avatar_path, is_default, updated_at"
    )
    .order("updated_at", { ascending: false });

  return {
    user: userData.user,
    project: {
      carousel,
      assets: assets ?? [],
      tones: tones ?? [],
      audiences: audiences ?? [],
      palettes: palettes ?? [],
      templates: templates ?? [],
      presets: presets ?? [],
      creatorProfiles: creatorProfiles ?? []
    }
  };
}

