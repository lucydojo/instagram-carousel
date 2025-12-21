import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

export function createSupabaseBrowserClient() {
  const env = getEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
