"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Result={id:string;type:string;title:string;subtitle:string;href:string};

export default function SearchPage(){
 const params=useSearchParams();const q=(params.get("q")||"").trim();const[rows,setRows]=useState<Result[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
 useEffect(()=>{let mounted=true;async function run(){setLoading(true);setError("");if(!q){setRows([]);setLoading(false);return}const s=createClient();const pattern=`%${q}%`;const [customers,suppliers,quotations,opportunities,shipments,invoices]=await Promise.all([
  s.from("customers").select("id,company_name,country,city").ilike("company_name",pattern).limit(10),
  s.from("suppliers").select("id,company_name,country,category").ilike("company_name",pattern).limit(10),
  s.from("quotations").select("id,quotation_no,title,status").or(`quotation_no.ilike.${pattern},title.ilike.${pattern}`).limit(10),
  s.from("opportunities").select("id,opportunity_no,title,stage").or(`opportunity_no.ilike.${pattern},title.ilike.${pattern}`).limit(10),
  s.from("shipments").select("id,shipment_no,origin,destination,status").or(`shipment_no.ilike.${pattern},origin.ilike.${pattern},destination.ilike.${pattern}`).limit(10),
  s.from("invoices").select("id,invoice_no,status,currency,total_amount").ilike("invoice_no",pattern).limit(10)
 ]);const failed=[customers,suppliers,quotations,opportunities,shipments,invoices].find((x:any)=>x.error) as any;if(failed?.error){if(mounted){setError(failed.error.message);setLoading(false)}return}
 const result:Result[]=[
 ...(customers.data??[]).map((x:any)=>({id:x.id,type:"Customer",title:x.company_name,subtitle:[x.city,x.country].filter(Boolean).join(", "),href:"/customers"})),
 ...(suppliers.data??[]).map((x:any)=>({id:x.id,type:"Supplier",title:x.company_name,subtitle:[x.category,x.country].filter(Boolean).join(" · "),href:"/suppliers"})),
 ...(quotations.data??[]).map((x:any)=>({id:x.id,type:"Quotation",title:x.quotation_no,subtitle:`${x.title||""} · ${x.status}`,href:"/quotations"})),
 ...(opportunities.data??[]).map((x:any)=>({id:x.id,type:"Opportunity",title:x.opportunity_no,subtitle:`${x.title||""} · ${x.stage}`,href:"/commercial/opportunities"})),
 ...(shipments.data??[]).map((x:any)=>({id:x.id,type:"Shipment",title:x.shipment_no,subtitle:`${x.origin||""} → ${x.destination||""} · ${x.status}`,href:"/shipping/shipments"})),
 ...(invoices.data??[]).map((x:any)=>({id:x.id,type:"Invoice",title:x.invoice_no,subtitle:`${x.currency} ${Number(x.total_amount||0).toLocaleString()} · ${x.status}`,href:"/finance/receivables"}))];if(mounted){setRows(result);setLoading(false)}}void run();return()=>{mounted=false}},[q]);
 return <main className="p-5 text-white md:p-8"><div className="mx-auto max-w-5xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">Global Search</p><h1 className="mt-2 text-3xl font-bold">Results for “{q}”</h1>{loading?<p className="mt-6 text-slate-400">Searching live data...</p>:error?<p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>:rows.length===0?<p className="mt-6 text-slate-400">No matching records.</p>:<div className="mt-6 space-y-3">{rows.map(r=><Link key={`${r.type}-${r.id}`} href={r.href} className="block rounded-2xl border border-slate-800 bg-[#0d1423] p-5 hover:border-blue-500/50"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-blue-400">{r.type}</p><h2 className="mt-1 font-semibold">{r.title}</h2><p className="mt-1 text-sm text-slate-500">{r.subtitle}</p></div><span className="text-blue-400">Open →</span></div></Link>)}</div>}</div></main>
}
