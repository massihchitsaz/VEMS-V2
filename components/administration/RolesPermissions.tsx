"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileRole={role:string;active:boolean};
const roleCatalog=[
  {id:"admin",name:"Admin",description:"Platform administration, security and full operational control.",permissions:["Platform administration","User management","Commercial control","Finance control","Shipping control","Audit access"]},
  {id:"ceo",name:"CEO",description:"Executive oversight and controlled management actions across the group.",permissions:["Executive dashboards","Commercial approval","Finance approval","Treasury oversight","Shipping oversight","Audit access"]},
  {id:"manager",name:"Manager",description:"Operational management and approval authority across assigned workflows.",permissions:["Commercial control","Finance approval","Customer credit","Supplier governance","Shipping override","Operational reporting"]},
  {id:"finance",name:"Finance",description:"Invoices, collections, payables, payments and treasury execution.",permissions:["Receivables","Payables","Payment instructions","Settlement","Reconciliation","Treasury write"]},
  {id:"dealer",name:"Dealer",description:"Commercial origination and ownership-scoped customer, quotation and deal activity.",permissions:["Own customers","Own opportunities","Own quotations","Own deals","Commercial tasks","Read linked operations"]},
  {id:"operations",name:"Operations",description:"Operational execution access for linked commercial and logistics records.",permissions:["Operational visibility","Linked finance visibility","Shipment operations","Task execution"]},
  {id:"logistics",name:"Logistics",description:"Shipment, tracking, document and warehouse operational access.",permissions:["Shipping workspace","Shipment execution","Tracking","Document readiness","Inventory operations"]},
];

export function RolesPermissions(){
  const[profiles,setProfiles]=useState<ProfileRole[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{void(async()=>{try{const s=createClient();const{data,error}=await s.from("profiles").select("role,active");if(error)throw error;setProfiles((data??[]) as ProfileRole[])}catch(e:any){setError(e?.message||"Unable to load role assignments.")}finally{setLoading(false)}})()},[]);
  const counts=useMemo(()=>Object.fromEntries(roleCatalog.map(r=>[r.id,{total:profiles.filter(p=>String(p.role).toLowerCase()===r.id).length,active:profiles.filter(p=>String(p.role).toLowerCase()===r.id&&p.active).length}])),[profiles]);
  return <main className="min-h-screen bg-[#060a12] p-5 text-white md:p-8"><div className="mx-auto max-w-7xl">
    <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">Administration & Access Control</p><h1 className="mt-2 text-3xl font-bold">Roles & Permissions</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">System roles are controlled by the platform security model. User role assignment is managed from User Management; this page shows the live assignment matrix rather than pretending local browser settings are security.</p></div><Link href="/users" className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold hover:bg-blue-500">Manage User Assignments</Link></header>
    {error&&<div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="System Roles" value={roleCatalog.length}/><Metric label="Assigned Users" value={loading?"…":profiles.length}/><Metric label="Active Users" value={loading?"…":profiles.filter(p=>p.active).length}/><Metric label="Security Model" value="RBAC + RLS"/></section>
    <section className="mt-6 grid gap-5 lg:grid-cols-2">{roleCatalog.map(role=>{const c=counts[role.id]??{total:0,active:0};return <article key={role.id} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">{role.name}</h2><span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-300">System Role</span></div><p className="mt-2 text-sm leading-6 text-slate-400">{role.description}</p></div><div className="text-right"><p className="text-2xl font-bold text-blue-300">{loading?"…":c.active}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">active / {loading?"…":c.total}</p></div></div><div className="mt-5 flex flex-wrap gap-2">{role.permissions.map(permission=><span key={permission} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-medium text-slate-300">{permission}</span>)}</div></article>})}</section>
    <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100"><b>Security rule:</b> roles are not created or toggled in browser local storage. Changes to user access must be made through controlled user administration and remain enforceable by Supabase RLS/RPC policies.</div>
  </div></main>
}
function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-2xl border border-slate-800 bg-[#0d1423] p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>}
