"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Mode = "Commercial" | "Treasury" | "Logistics" | "Finance" | "Executive";
type Message = { id: number; role: "user" | "assistant"; text: string };

const prompts: Record<Mode, string[]> = {
  Commercial: ["Summarize priority opportunities", "Which quotation needs approval?", "Draft a customer follow-up"],
  Treasury: ["Explain the IRR position", "Recommend the next FX action", "Show deals outside limits"],
  Logistics: ["List delayed shipments", "What requires customs action?", "Prepare a shipment escalation"],
  Finance: ["Summarize overdue receivables", "Which payments are urgent?", "Explain the 7-day cash gap"],
  Executive: ["Give me today's management brief", "List the top five risks", "What decisions need my approval?"],
};

function generateResponse(mode: Mode, input: string): string {
  const normalized = input.toLowerCase();
  if (mode === "Treasury") return normalized.includes("irr") ? "IRR is currently short by 4.0 billion against AED. The recommended action is BUY IRR within the approved treasury limit. A rate exception requires approval before confirmation." : "Treasury priorities: cover the IRR short position, review two rate exceptions and reconcile today's settlements before releasing new dealer limits.";
  if (mode === "Logistics") return "Logistics priorities: one Kekule shipment is delayed, two bookings require confirmation and one Jebel Ali storage exposure needs commercial escalation. Open the Shipment Board for record-level action.";
  if (mode === "Finance") return "Finance priorities: AED 540K is overdue from MODAVA, AED 760K supplier payment requires approval and the 7-day liquidity forecast is negative by approximately AED 1.3M before FX settlements.";
  if (mode === "Commercial") return "Commercial priorities: protect margin on the Power & Sun quotation, follow up MODAVA receivables and close the highest-probability opportunities before confirming additional supplier commitments.";
  return "Executive brief: the most urgent items are the IRR treasury position, overdue MODAVA receipt, Kekule shipment delay and two pending management approvals. Current operations remain stable, but liquidity and timing risk require action today.";
}

export function AiOperationsAssistant() {
  const [mode, setMode] = useState<Mode>("Executive");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: "assistant", text: "VTC ONE AI is ready. Select an operating area or ask for a management brief." }]);
  const recommendations = useMemo(() => [
    { title: "Cover IRR short position", detail: "Treasury action required before today's settlement window.", href: "/fx/positions", tone: "red" },
    { title: "Escalate overdue receipt", detail: "MODAVA balance of AED 540K remains overdue.", href: "/finance/receivables", tone: "amber" },
    { title: "Review shipment delay", detail: "Kekule dispatch timing is affecting customer commitment.", href: "/shipping/shipments", tone: "blue" },
  ], []);

  function submit(text = input) {
    const clean = text.trim(); if (!clean) return;
    const userMessage: Message = { id: Date.now(), role: "user", text: clean };
    const assistantMessage: Message = { id: Date.now() + 1, role: "assistant", text: generateResponse(mode, clean) };
    setMessages((current) => [...current, userMessage, assistantMessage]); setInput("");
  }

  return (
    <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">VTC ONE Intelligence Layer</p><h1 className="mt-2 text-3xl font-bold">AI Operations Assistant</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">A unified operating assistant for commercial, treasury, logistics, finance and executive decision support.</p></header>

        <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-6">
            <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6"><h2 className="text-lg font-semibold">Operating Mode</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{(["Executive", "Commercial", "Treasury", "Logistics", "Finance"] as Mode[]).map((item) => <button key={item} onClick={() => setMode(item)} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${mode === item ? "border-blue-500 bg-blue-500/10 text-blue-300" : "border-slate-800 bg-slate-950/40 text-slate-400"}`}>{item}</button>)}</div></article>
            <article className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6"><h2 className="text-lg font-semibold">Priority Recommendations</h2><div className="mt-4 space-y-3">{recommendations.map((item) => <Link key={item.href} href={item.href} className="block rounded-xl border border-slate-800 bg-slate-950/40 p-4 hover:border-blue-500/40"><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></Link>)}</div></article>
          </div>

          <article className="flex min-h-[680px] flex-col rounded-2xl border border-slate-800 bg-[#0d1423]">
            <div className="border-b border-slate-800 p-5"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">{mode} Assistant</h2><p className="mt-1 text-xs text-emerald-400">● Connected to VEMS demo operating data</p></div><button onClick={() => setMessages([{ id: Date.now(), role: "assistant", text: "Conversation cleared. How can I assist?" }])} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400">Clear</button></div><div className="mt-4 flex flex-wrap gap-2">{prompts[mode].map((prompt) => <button key={prompt} onClick={() => submit(prompt)} className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-300 hover:border-blue-500/50">{prompt}</button>)}</div></div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">{messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-950/60 text-slate-300"}`}>{message.text}</div></div>)}</div>
            <div className="border-t border-slate-800 p-5"><div className="flex gap-3"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={`Ask the ${mode} assistant...`} className="min-h-14 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500" /><button onClick={() => submit()} className="rounded-xl bg-blue-600 px-6 font-semibold hover:bg-blue-500">Send</button></div></div>
          </article>
        </section>
      </div>
    </main>
  );
}
