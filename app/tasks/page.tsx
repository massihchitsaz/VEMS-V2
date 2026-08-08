"use client";

import { FormEvent, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
};

export default function TasksPage() {
  const [items, setItems] = useState<TaskRow[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("tasks")
        .select("id,title,description,status,priority,due_at,created_at")
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setItems((data ?? []) as TaskRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTask(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");
      const { error: insertError } = await supabase.from("tasks").insert({
        title: title.trim(),
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        created_by: user.id,
        assigned_to: user.id,
        status: "open",
      });
      if (insertError) throw insertError;
      setTitle("");
      setDueAt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    const supabase = createClient();
    const { error: updateError } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">Execution Queue</p>
          <h1 className="mt-2 text-3xl font-bold">Tasks</h1>
          <p className="mt-2 text-sm text-slate-400">Shared operational tasks stored in Supabase.</p>
        </header>

        <form onSubmit={createTask} className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-[#0c1424] p-5 md:grid-cols-[1fr_180px_220px_auto]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
          <button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{saving ? "Saving…" : "Add Task"}</button>
        </form>

        {error ? <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

        <section className="space-y-3">
          {!loading && items.length === 0 ? <div className="rounded-2xl border border-slate-800 bg-[#0c1424] p-6 text-sm text-slate-500">No tasks yet.</div> : null}
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-800 bg-[#0c1424] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{item.title}</h2>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-300">{item.priority}</span>
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-300">{item.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{item.due_at ? `Due ${new Date(item.due_at).toLocaleString("en-GB")}` : "No deadline"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void setStatus(item.id, "in_progress")} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold">In progress</button>
                  <button onClick={() => void setStatus(item.id, "done")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold">Done</button>
                  <button onClick={() => void setStatus(item.id, "cancelled")} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300">Cancel</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
