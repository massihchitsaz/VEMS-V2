"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { initialNotifications, type NotificationRecord } from "@/lib/administration-data";

const storageKey = "vems-notifications-v1";

function priorityClass(priority: NotificationRecord["priority"]) {
  if (priority === "CRITICAL") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (priority === "HIGH") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (priority === "MEDIUM") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-600 bg-slate-800 text-slate-300";
}

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationRecord[]>(initialNotifications);
  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) { try { setItems(JSON.parse(raw) as NotificationRecord[]); } catch { localStorage.removeItem(storageKey); } }
  }, []);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(items)); }, [items]);

  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);
  function markRead(id: string) { setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item)); }
  function markAllRead() { setItems((current) => current.map((item) => ({ ...item, read: true }))); }

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">Operational Attention Queue</p><h1 className="mt-2 text-3xl font-bold">Notification Center</h1><p className="mt-2 text-sm text-slate-400">{unread} unread operational alerts require review.</p></div>
          <button type="button" onClick={markAllRead} className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-blue-500">Mark all as read</button>
        </header>
        <section className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-5 transition ${item.read ? "border-slate-800 bg-[#0d1423] opacity-70" : "border-blue-500/30 bg-blue-500/5"}`}>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="flex gap-4"><span className={`mt-1 h-3 w-3 rounded-full ${item.read ? "bg-slate-700" : "bg-blue-500"}`} /><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-white">{item.title}</h2><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${priorityClass(item.priority)}`}>{item.priority}</span><span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{item.module}</span></div><p className="mt-2 text-sm text-slate-400">{item.message}</p><p className="mt-3 text-xs text-slate-600">{new Date(item.createdAt).toLocaleString("en-GB")}</p></div></div>
                <div className="flex gap-2"><Link href={item.href} onClick={() => markRead(item.id)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold hover:bg-blue-500">Open</Link>{!item.read && <button type="button" onClick={() => markRead(item.id)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500">Dismiss</button>}</div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
