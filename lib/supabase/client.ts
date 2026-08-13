import { createBrowserClient } from "@supabase/ssr";

type RuntimeConfig = { url: string; key: string };

declare global {
  var __VTC_SUPABASE_CONFIG__: RuntimeConfig | undefined;
}

export function createClient() {
  const runtime = globalThis.__VTC_SUPABASE_CONFIG__;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || runtime?.url;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    runtime?.key;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("VTC ONE database configuration is not ready.");
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
