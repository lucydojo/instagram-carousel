import "server-only";

import { createSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createStorageClient() {
  const admin = createSupabaseAdminClientIfAvailable();
  if (admin) return admin;
  return await createSupabaseServerClient();
}

export async function createSignedUrl(input: {
  bucket: string;
  path: string;
  expiresIn?: number;
}): Promise<{ signedUrl: string | null; error?: string }> {
  const supabase = await createStorageClient();
  const expiresIn = input.expiresIn ?? 60 * 10;
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .createSignedUrl(input.path, expiresIn);

  if (error) return { signedUrl: null, error: error.message };
  return { signedUrl: data.signedUrl };
}

