import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

export function createSupabaseAdminClient() {
  const env = getEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to create an admin Supabase client."
    );
  }

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false }
    }
  );
}

export function createSupabaseAdminClientIfAvailable() {
  const env = getEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseAdminClient();
}

