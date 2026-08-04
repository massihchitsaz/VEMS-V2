"use client";

import { useEffect, useState } from "react";
import { initialRoles, type RoleRecord } from "@/lib/administration-data";

const storageKey = "vems-roles-v1";

export function RolesPermissions() {
  const [roles, setRoles] = useState<RoleRecord[]>(initialRoles);
  useEffect(() => { const raw = localStorage.getItem(storageKey); if (raw) { try { setRoles(JSON.parse(raw) as RoleRecord[]); } catch { localStorage.removeItem(storageKey); } } }, []);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(roles)); }, [roles]);
  function toggle(id: string) { setRoles((current) => current.map((role) => role.id === id ? { ...role, active: !role.active } : role)); }

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">Administration & Access Control</p><h1 className="mt-2 text-3xl font-bold">Roles & Permissions</h1><p className="mt-2 text-sm text-slate-400">Define operational access by responsibility, approval authority and control level.</p></div><button type="button" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">+ Create Role</button></header>
        <section className="grid gap-5 lg:grid-cols-2">{roles.map((role) => <article key={role.id} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{role.name}</h2><p className="mt-2 text-sm text-slate-400">{role.description}</p></div><button type="button" onClick={() => toggle(role.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${role.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{role.active ? "ACTIVE" : "DISABLED"}</button></div><div className="mt-5 flex items-center justify-between border-y border-slate-800 py-4"><span className="text-sm text-slate-400">Assigned users</span><span className="text-xl font-bold text-blue-300">{role.users}</span></div><div className="mt-5 flex flex-wrap gap-2">{role.permissions.map((permission) => <span key={permission} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300">{permission}</span>)}</div></article>)}</section>
      </div>
    </main>
  );
}
