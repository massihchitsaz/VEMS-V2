"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { initialDeals, initialUsers } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/client";
import type { Deal, User } from "@/types";

function normalizeRole(role?: string): User["role"] {
  const normalizedRole = role?.trim().toLowerCase();

  if (normalizedRole === "admin") return "Admin";
  if (normalizedRole === "finance") return "Finance";
  if (normalizedRole === "manager") return "Manager";
  return "Dealer";
}

export default function Home() {
  const router = useRouter();

  const [users, setUsers] = useLocalStorage<User[]>("vtc-users", initialUsers);
  const [deals] = useLocalStorage<Deal[]>("vtc-deals", initialDeals);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const demoSession = window.localStorage.getItem("vtc-demo-session");

    if (demoSession) {
      try {
        const demoUser = JSON.parse(demoSession) as User;
        setCurrentUser(demoUser);
        setIsLoading(false);
        return;
      } catch {
        window.localStorage.removeItem("vtc-demo-session");
      }
    }

    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch {
      router.replace("/login");
      return;
    }

    async function loadAuthenticatedUser() {
      setIsLoading(true);
      setAuthError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (isMounted) router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError || !profile || profile.active === false) {
        await supabase.auth.signOut();

        if (isMounted) {
          setAuthError(
            profile?.active === false
              ? "Your account has been deactivated."
              : "User profile was not found.",
          );
          setIsLoading(false);
          router.replace("/login");
        }
        return;
      }

      const authenticatedUser: User = {
        id: user.id,
        username: profile.username ?? user.email ?? "user",
        password: "",
        fullName:
          profile.full_name ??
          profile.fullName ??
          profile.name ??
          user.user_metadata?.full_name ??
          user.email ??
          "VTC User",
        role: normalizeRole(profile.role),
        active: true,
      };

      if (isMounted) {
        setCurrentUser(authenticatedUser);
        setUsers((previousUsers) => {
          const exists = previousUsers.some(
            (item) => item.id === authenticatedUser.id,
          );

          return exists
            ? previousUsers.map((item) =>
                item.id === authenticatedUser.id ? authenticatedUser : item,
              )
            : [authenticatedUser, ...previousUsers];
        });
        setIsLoading(false);
      }
    }

    void loadAuthenticatedUser();

    return () => {
      isMounted = false;
    };
  }, [router, setUsers]);

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[#060a12] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
          <p className="mt-5 text-sm text-slate-400">Loading VTC ONE...</p>
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[#060a12] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h1 className="font-semibold text-red-300">Authentication error</h1>
          <p className="mt-2 text-sm text-red-200">{authError}</p>
        </div>
      </main>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="relative p-5 md:p-8">
      <div className="fixed bottom-4 right-4 z-50 rounded-full border border-blue-400/30 bg-blue-600 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-2xl">
        Dashboard V2 Active
      </div>
      <DashboardPage deals={deals} users={users} />
    </div>
  );
}
