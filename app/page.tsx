"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LiveDashboardPage } from "@/components/dashboard/LiveDashboardPage";
import { createClient } from "@/lib/supabase/client";

type AuthenticatedProfile = {
  id: string;
  fullName: string;
};

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<AuthenticatedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const { data: userProfile, error: profileError } = await supabase
          .from("profiles")
          .select("id,full_name,active")
          .eq("id", user.id)
          .single();

        if (profileError || !userProfile) {
          if (mounted) {
            setAuthError("User profile was not found.");
            setIsLoading(false);
          }
          return;
        }

        if (userProfile.active === false) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (mounted) {
          setProfile({
            id: user.id,
            fullName: userProfile.full_name || user.email || "VTC User",
          });
          setIsLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setAuthError(error instanceof Error ? error.message : "Authentication failed.");
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060a12] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
          <p className="mt-5 text-sm text-slate-400">Loading live VTC ONE data...</p>
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#060a12] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h1 className="font-semibold text-red-300">Authentication error</h1>
          <p className="mt-2 text-sm text-red-200">{authError}</p>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  return <LiveDashboardPage userId={profile.id} fullName={profile.fullName} />;
}
