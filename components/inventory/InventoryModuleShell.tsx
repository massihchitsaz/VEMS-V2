"use client";

import { useEffect, useMemo, useState } from "react";
import { InventoryCommandCenter } from "@/components/inventory/InventoryCommandCenter";
import { MultiWarehouseControl } from "@/components/inventory/MultiWarehouseControl";
import { InventoryIntelligenceControl } from "@/components/inventory/InventoryIntelligenceControl";
import { WarehouseOperationsControl } from "@/components/inventory/WarehouseOperationsControl";

type Section = "command" | "network" | "intelligence" | "operations";

const sections: Array<{ key: Section; label: string; eyebrow: string; description: string }> = [
  { key: "command", label: "Inventory Command Center", eyebrow: "Stock & Master Data", description: "Stock visibility, warehouse and location master data, items, receipts, movements and reservations." },
  { key: "network", label: "Warehouse Network", eyebrow: "Multi-Warehouse", description: "Warehouse-by-warehouse balances, locations and audited inter-warehouse stock transfers." },
  { key: "intelligence", label: "Inventory Intelligence", eyebrow: "Planning & Control", description: "FEFO allocation, expiry exposure, reorder alerts, capacity utilization and commercial linkage." },
  { key: "operations", label: "Operations Desk", eyebrow: "Controlled Execution", description: "Lot holds, releases, damage postings, stock adjustments, reservation fulfillment and activity trail." },
];

function parseHash(): Section {
  if (typeof window === "undefined") return "command";
  const value = window.location.hash.replace("#", "") as Section;
  return sections.some(section => section.key === value) ? value : "command";
}

export function InventoryModuleShell() {
  const [active, setActive] = useState<Section>("command");

  useEffect(() => {
    const sync = () => setActive(parseHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const current = useMemo(() => sections.find(section => section.key === active) || sections[0], [active]);

  const select = (key: Section) => {
    setActive(key);
    const url = `${window.location.pathname}${window.location.search}#${key}`;
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <main className="pb-10 text-white">
    <section className="px-5 pt-5 md:px-8">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1120] shadow-2xl shadow-black/20">
        <div className="border-b border-slate-800 bg-gradient-to-br from-blue-950/40 via-[#0b1120] to-cyan-950/20 p-5 md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-blue-900 bg-blue-950/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-blue-300">VTC ONE · Inventory & Warehouse</span>
                <span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-300">Production Workspace</span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Inventory & Warehouse Control</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">One controlled operational workspace for receiving, storage, allocation, transfer, reservation, exception handling and warehouse intelligence across the VTC network.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 xl:min-w-[290px]">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">Current workspace</p>
              <p className="mt-1 font-semibold text-white">{current.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{current.description}</p>
            </div>
          </div>
        </div>

        <nav className="grid gap-px bg-slate-800 md:grid-cols-2 xl:grid-cols-4" aria-label="Inventory workspaces">
          {sections.map(section => {
            const selected = active === section.key;
            return <button
              key={section.key}
              type="button"
              onClick={() => select(section.key)}
              aria-pressed={selected}
              className={`min-h-28 bg-[#0d1423] p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${selected ? "bg-blue-950/35" : "hover:bg-slate-900/90"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-[.18em] ${selected ? "text-blue-300" : "text-slate-500"}`}>{section.eyebrow}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-blue-400 shadow-[0_0_16px_rgba(96,165,250,.8)]" : "bg-slate-700"}`} />
              </div>
              <p className="mt-2 font-semibold text-white">{section.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
            </button>;
          })}
        </nav>
      </div>
    </section>

    {active === "command" && <InventoryCommandCenter />}
    {active === "network" && <MultiWarehouseControl />}
    {active === "intelligence" && <InventoryIntelligenceControl />}
    {active === "operations" && <WarehouseOperationsControl />}
  </main>;
}
