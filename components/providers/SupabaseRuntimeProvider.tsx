"use client";

import { useEffect, useState } from "react";

const CONFIG_URL = "https://wskbegqjufkzrevwxbkm.supabase.co/functions/v1/public-config";

export function SupabaseRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const response = await fetch(CONFIG_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`Config request failed (${response.status})`);
        const config = await response.json();
        if (!config?.url || !config?.key) throw new Error("Database configuration is incomplete");
        globalThis.__VTC_SUPABASE_CONFIG__ = { url: config.url, key: config.key };
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load database configuration");
      }
    }

    void loadConfig();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060a12] px-6 text-white">
        <div className="max-w-lg rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-xl font-semibold">VTC ONE configuration error</h1>
          <p className="mt-2 text-sm text-red-200">{error}</p>
        </div>
      </main>
    );
  }

  if (!ready) {
    return <main className="flex min-h-screen items-center justify-center bg-[#060a12] text-slate-400">Loading VTC ONE...</main>;
  }

  return <>{children}</>;
}
