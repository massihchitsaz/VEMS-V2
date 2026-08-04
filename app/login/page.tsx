"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setErrorMessage("");
  setIsLoading(true);

  const normalizedEmail = email.trim().toLowerCase();

  if (
    normalizedEmail !== "massih.chitsaz@gmail.com" ||
    password !== "123456"
  ) {
    setErrorMessage("Invalid demo email or password.");
    setIsLoading(false);
    return;
  }

  const demoUser = {
    id: "demo-admin-001",
    email: normalizedEmail,
    username: "massih",
    fullName: "Massih Chitsaz",
    role: "Admin",
    active: true,
  };

  localStorage.setItem("vtc-demo-session", JSON.stringify(demoUser));

  router.replace("/");
  router.refresh();
}

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b14] px-4">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1422] p-8 shadow-2xl">
        <div className="mb-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">
            V
          </div>

          <p className="text-xs font-medium uppercase tracking-[0.25em] text-blue-400">
            VTC GROUP
          </p>

          <h1 className="mt-2 text-2xl font-semibold text-white">
            Secure Login
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            VTC ONE Enterprise Platform
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-slate-300">
              Email address
            </label>

            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#080d17] px-4 py-3 text-white outline-none focus:border-blue-500"
              placeholder="name@vtcgroup.ae"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-slate-300">
              Password
            </label>

            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#080d17] px-4 py-3 text-white outline-none focus:border-blue-500"
              placeholder="Enter your password"
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
