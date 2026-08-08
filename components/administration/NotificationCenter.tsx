"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type NotificationRecord = {
  id: string;
  title: string;
  message: string | null;
  severity: string;
  module: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
};

function priorityClass(priority: string) {
  const value = priority.toLowerCase();
  if (value === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (value === "high" || value === "warning") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (value === "medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-600 bg-slate-800 text-slate-300";
}

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: queryError } = await supabase
        .from("notifications")
        .select("id,title,message,severity,module,href,is_read,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setItems((data ?? []) as NotificationRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const unread = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  async function markRead(id: string) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
  }

  async function markAllRead() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
  }

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">Operational Attention Queue</p>
            <h1 className="mt-2 text-3xl font-bold">Notification Center</h1>
            <p className="mt-2 text-sm text-slate-400">{loading ? "Loading…" : `${unread} unread operational alerts require review.`}</p>
          </div>
          <button type="button" onClick={() => void markAllRead()} className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-blue-500">Mark all as read</button>
        </header>

        {error ? <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        <section className="space-y-4">
          {!loading && items.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6 text-sm text-slate-500">No notifications yet.</div>
          ) : null}
          {items.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-5 transition ${item.is_read ? "border-slate-800 bg-[#0d1423] opacity-70" : "border-blue-500/30 bg-blue-500/5"}`}>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="flex gap-4">
                  <span className={`mt-1 h-3 w-3 rounded-full ${item.is_read ? "bg-slate-700" : "bg-blue-500"}`} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-white">{item.title}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${priorityClass(item.severity)}`}>{item.severity}</span>
                      {item.module ? <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{item.module}</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{item.message}</p>
                    <p className="mt-3 text-xs text-slate-600">{new Date(item.created_at).toLocaleString("en-GB")}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={item.href || "/"} onClick={() => void markRead(item.id)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold hover:bg-blue-500">Open</Link>
                  {!item.is_read ? <button type="button" onClick={() => void markRead(item.id)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500">Dismiss</button> : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
