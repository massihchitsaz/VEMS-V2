"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CommercialOpportunity, CommercialQuotation, CommercialSupplier, CommercialTask } from "@/lib/commercial-data";

type CommercialState = { opportunities: CommercialOpportunity[]; tasks: CommercialTask[]; suppliers: CommercialSupplier[]; quotations: CommercialQuotation[] };
const emptyState: CommercialState = { opportunities: [], tasks: [], suppliers: [], quotations: [] };

const mapQuotation=(q:any):CommercialQuotation=>({id:q.id,reference:q.quotation_no,customer:q.customers?.company_name??"Unassigned",subject:q.title??"",route:q.route??"",currency:q.currency??"AED",amount:Number(q.total_amount??0),marginPercent:Number(q.margin_percent??0),validUntil:q.valid_until??"",status:q.status??"draft"} as CommercialQuotation);
const mapSupplier=(s:any):CommercialSupplier=>({id:s.id,name:s.company_name,country:s.country??"",category:s.category??"General",contact:s.contact_person??"",email:s.email??"",phone:s.phone??"",rating:Number(s.rating??0),status:s.status??"active"} as CommercialSupplier);
const mapOpportunity=(o:any):CommercialOpportunity=>({id:o.id,reference:o.opportunity_no,customer:o.customers?.company_name??"Unassigned",title:o.title??"",currency:o.currency??"AED",value:Number(o.estimated_value??0),stage:o.stage??"qualified",probability:Number(o.probability??0),expectedClose:o.expected_close_date??"",priority:o.priority??"medium",nextAction:o.next_action??"",updatedAt:o.updated_at} as CommercialOpportunity);
const mapTask=(t:any):CommercialTask=>({id:t.id,title:t.title,description:t.description??"",priority:t.priority??"medium",status:t.status??"open",dueDate:t.due_at??""} as CommercialTask);

export function useCommercialStore(){
 const [state,setState]=useState<CommercialState>(emptyState); const [ready,setReady]=useState(false); const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{setError(null);const supabase=createClient();const [q,o,s,t]=await Promise.all([
  supabase.from("quotations").select("*,customers(company_name)").order("created_at",{ascending:false}),
  supabase.from("opportunities").select("*,customers(company_name)").order("created_at",{ascending:false}),
  supabase.from("suppliers").select("*").order("created_at",{ascending:false}),
  supabase.from("tasks").select("*").order("created_at",{ascending:false})]);
  const first=[q,o,s,t].find((x:any)=>x.error) as any;if(first?.error){setError(first.error.message);setReady(true);return}
  setState({quotations:(q.data??[]).map(mapQuotation),opportunities:(o.data??[]).map(mapOpportunity),suppliers:(s.data??[]).map(mapSupplier),tasks:(t.data??[]).map(mapTask)});setReady(true)},[]);
 useEffect(()=>{void load();const supabase=createClient();const channel=supabase.channel("commercial-live").on("postgres_changes",{event:"*",schema:"public",table:"quotations"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"opportunities"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"suppliers"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"tasks"},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel)}},[load]);
 const updateOpportunity=useCallback(async(id:string,patch:Partial<CommercialOpportunity>)=>{const supabase=createClient();const db:any={};if(patch.stage!==undefined)db.stage=patch.stage;if(patch.probability!==undefined)db.probability=patch.probability;if(patch.priority!==undefined)db.priority=patch.priority;if(patch.nextAction!==undefined)db.next_action=patch.nextAction;const{error}=await supabase.from("opportunities").update(db).eq("id",id);if(error)throw error;await load()},[load]);
 const updateTask=useCallback(async(id:string,patch:Partial<CommercialTask>)=>{const supabase=createClient();const db:any={};if(patch.status!==undefined)db.status=patch.status;if(patch.priority!==undefined)db.priority=patch.priority;const{error}=await supabase.from("tasks").update(db).eq("id",id);if(error)throw error;await load()},[load]);
 const addOpportunity=useCallback(async(input:Omit<CommercialOpportunity,"id"|"updatedAt">)=>{const supabase=createClient();const{data:customer}=await supabase.from("customers").select("id").eq("company_name",(input as any).customer).maybeSingle();const{data,error}=await supabase.from("opportunities").insert({opportunity_no:(input as any).reference||`OPP-${Date.now()}`,customer_id:customer?.id??null,title:(input as any).title,currency:(input as any).currency??"AED",estimated_value:(input as any).value??0,stage:(input as any).stage??"qualified",probability:(input as any).probability??0,expected_close_date:(input as any).expectedClose||null,priority:(input as any).priority??"medium",next_action:(input as any).nextAction??null}).select("*,customers(company_name)").single();if(error)throw error;await load();return mapOpportunity(data)},[load]);
 return{...state,ready,error,refresh:load,updateOpportunity,updateTask,addOpportunity,resetStore:load};
}
