"use client";

import { useEffect, useMemo, useState } from "react";
import { DocumentCenterV3 } from "@/components/administration/DocumentCenterV3";
import { DocumentReadinessControl } from "@/components/administration/DocumentReadinessControl";

type Section="register"|"readiness";

const sections=[
  {key:"register" as Section,label:"Document Register",eyebrow:"Controlled Records",description:"Upload, link, review, approve, revise, open and download controlled documents with a complete audit trail."},
  {key:"readiness" as Section,label:"Readiness & Requirements",eyebrow:"Operational Gates",description:"Check shipment and deal document completeness, clear blocked gates and manage the requirement matrix."},
];

function hashSection():Section{
  if(typeof window==="undefined")return "register";
  const value=window.location.hash.replace("#","") as Section;
  return sections.some(x=>x.key===value)?value:"register";
}

export function DocumentModuleShell(){
  const[active,setActive]=useState<Section>("register");
  useEffect(()=>{const sync=()=>setActive(hashSection());sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync)},[]);
  const current=useMemo(()=>sections.find(x=>x.key===active)||sections[0],[active]);
  const select=(key:Section)=>{setActive(key);window.history.replaceState(null,"",`${window.location.pathname}${window.location.search}#${key}`);window.scrollTo({top:0,behavior:"smooth"})};

  return <main className="pb-10 text-white">
    <section className="px-5 pt-5 md:px-8 md:pt-8">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1120] shadow-2xl shadow-black/20">
        <div className="border-b border-slate-800 bg-gradient-to-br from-cyan-950/30 via-[#0b1120] to-blue-950/30 p-5 md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-cyan-900 bg-cyan-950/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">VTC ONE · Document Control</span><span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-300">Production Workspace</span></div><h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Document Control & Operational Readiness</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">A controlled records environment for private storage, approval, revision, expiry monitoring and shipment/deal document readiness.</p></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 xl:min-w-[320px]"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">Current workspace</p><p className="mt-1 font-semibold">{current.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{current.description}</p></div>
          </div>
        </div>
        <nav className="grid gap-px bg-slate-800 md:grid-cols-2" aria-label="Document control workspaces">
          {sections.map(s=>{const selected=active===s.key;return <button key={s.key} type="button" aria-pressed={selected} onClick={()=>select(s.key)} className={`min-h-28 bg-[#0d1423] p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500 ${selected?"bg-cyan-950/25":"hover:bg-slate-900/90"}`}><div className="flex items-center justify-between gap-3"><span className={`text-[10px] font-bold uppercase tracking-[.18em] ${selected?"text-cyan-300":"text-slate-500"}`}>{s.eyebrow}</span><span className={`h-2.5 w-2.5 rounded-full ${selected?"bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,.8)]":"bg-slate-700"}`}/></div><p className="mt-2 font-semibold">{s.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{s.description}</p></button>})}
        </nav>
      </div>
    </section>

    {active==="register"&&<DocumentCenterV3/>}
    {active==="readiness"&&<DocumentReadinessControl/>}
  </main>;
}
