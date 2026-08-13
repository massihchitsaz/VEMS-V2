import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const CONFIG_URL = "https://wskbegqjufkzrevwxbkm.supabase.co/functions/v1/public-config";
let cachedConfig: { url: string; key: string } | null = null;

async function getRuntimeConfig() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey };
  if (cachedConfig) return cachedConfig;

  const response = await fetch(CONFIG_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load VTC ONE database configuration (${response.status}).`);
  const config = await response.json();
  if (!config?.url || !config?.key) throw new Error("VTC ONE database configuration is incomplete.");
  cachedConfig = { url: config.url, key: config.key };
  return cachedConfig;
}

export async function createClient() {
  const cookieStore = await cookies();
  const config = await getRuntimeConfig();

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies.
        }
      },
    },
  });
}
