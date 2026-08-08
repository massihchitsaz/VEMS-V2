"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CommercialOpportunity, CommercialQuotation, CommercialSupplier, CommercialTask } from "@/lib/commercial-data";

type CommercialState={opportunities:CommercialOpportunity[];tasks:CommercialTask[];suppliers:CommercialSupplier[];quotations:CommercialQuotation[]};
const emptyState:CommercialState={opportunities:[],tasks:[],suppliers:[],quotations:[]};

const quotationStatus=(v:string):CommercialQuotation["status"]=>["draft","awaiting-rates","commercial-review","approval","awarded","expired"].includes(v)?v as CommercialQuotation["status"]:"draft";
const opportunityStage=(v:string):CommercialOpportunity["stage"]=>["lead","qualified","quotation","negotiation","approval","won","lost"].includes(v)?v as CommercialOpportunity["stage"]:"qualified";
const priority=(v:string):CommercialOpportunity["priority"]=>["low","medium","high","critical"].includes(v)?v as CommercialOpportunity["priority"]:"medium";
const taskStatus=(v:string):CommercialTask["status"]=>v==="done"||v==="completed"?"completed":v==="in_progress"||v==="in-progress"?"in-progress":"open";

const mapQuotation=(q:any):CommercialQuotation=>({id:q.id,reference:q.quotation_no,customer:q.customers?.company_name??"Unassigned",subject:q.title??"",route:q.route??"",amount:Number(q.total_amount??0),currency:q.currency??"AED",status:quotationStatus(q.status??"draft"),validUntil:q.valid_until??"",marginPercent:Number(q.margin_percent??0),owner:q.profiles?.full_name??"Commercial Team"});
const mapSupplier=(s:any):CommercialSupplier=>({id:s.id,name:s.company_name,country:s.country??"",category:s.category??"General",contact:s.contact_person??"",kycStatus:["approved","pending","expired"].includes(s.kyc_status)?s.kyc_status:"pending",performance:Math.max(0,Math.min(100,Number(s.rating??0)*20)),openItems:0,strategic:Number(s.rating??0)>=4});
const mapOpportunity=(o:any):CommercialOpportunity=>({id:o.id,reference:o.opportunity_no,title:o.title??"",company:o.customers?.company_name??"Unassigned",owner:o.profiles?.full_name??"Commercial Team",stage:opportunityStage(o.stage??"qualified"),value:Number(o.estimated_value??0),currency:o.currency??"AED",probability:Number(o.probability??0),marginPercent:Number(o.quotations?.margin_percent??0),nextAction:o.next_action??"Review opportunity",dueDate:o.expected_close_date??"",priority:priority(o.priority??"medium"),route:o.quotations?.route??"",updatedAt:o.updated_at??o.created_at??new Date().toISOString()});
const mapTask=(t:any):CommercialTask=>({id:t.id,title:t.title,relatedTo:t.entity_type??"General",assignee:t.profiles?.full_name??"Unassigned",dueDate:t.due_at??"",priority:priority(t.priority??"medium"),status:taskStatus(t.status??"open"),category:["customer","supplier","quotation","shipment","treasury"].includes(t.entity_type)?t.entity_type:"customer"});

export function useCommercialStore(){
 const[state,setState]=useState<CommercialState>(emptyState);const[ready,setReady]=useState(false);const[error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{setError(null);const s=createClient();const[q,o,sup,t]=await Promise.all([
  s.from("quotations").select("*,customers(company_name),profiles:owner_id(full_name)").order("created_at",{ascending:false}),
  s.from("opportunities").select("*,customers(company_name),profiles:owner_id(full_name),quotations(margin_percent,route)").order("created_at",{ascending:false}),
  s.from("suppliers").select("*").order("created_at",{ascending:false}),
  s.from("tasks").select("*,profiles:assigned_to(full_name)").order("created_at",{ascending:false})]);
  const failed=[q,o,sup,t].find((x:any)=>x.error) as any;if(failed?.error){setError(failed.error.message);setReady(true);return}
  setState({quotations:(q.data??[]).map(mapQuotation),opportunities:(o.data??[]).map(mapOpportunity),suppliers:(sup.data??[]).map(mapSupplier),tasks:(t.data??[]).map(mapTask)});setReady(true)},[]);
 useEffect(()=>{void load();const s=createClient();const channel=s.channel("commercial-live").on("postgres_changes",{event:"*",schema:"public",table:"quotations"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"opportunities"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"suppliers"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"tasks"},()=>void load()).subscribe();return()=>{void s.removeChannel(channel)}},[load]);
 const updateOpportunity=useCallback(async(id:string,patch:Partial<CommercialOpportunity>)=>{const s=createClient();const db:any={updated_at:new Date().toISOString()};if(patch.stage!==undefined)db.stage=patch.stage;if(patch.probability!==undefined)db.probability=patch.probability;if(patch.priority!==undefined)db.priority=patch.priority;if(patch.nextAction!==undefined)db.next_action=patch.nextAction;if(patch.dueDate!==undefined)db.expected_close_date=patch.dueDate||null;const{error}=await s.from("opportunities").update(db).eq("id",id);if(error)throw error;await load()},[load]);
 const updateTask=useCallback(async(id:string,patch:Partial<CommercialTask>)=>{const s=createClient();const db:any={updated_at:new Date().toISOString()};if(patch.status!==undefined)db.status=patch.status==="completed"?"done":patch.status==="in-progress"?"in_progress":"open";if(patch.priority!==undefined)db.priority=patch.priority;const{error}=await s.from("tasks").update(db).eq("id",id);if(error)throw error;await load()},[load]);
 const addOpportunity=useCallback(async(input:Omit<CommercialOpportunity,"id"|"updatedAt">)=>{const s=createClient();const{data:{user}}=await s.auth.getUser();let{data:customer}=await s.from("customers").select("id").eq("company_name",input.company).maybeSingle();if(!customer){const created=await s.from("customers").insert({company_name:input.company,created_by:user?.id??null}).select("id").single();if(created.error)throw created.error;customer=created.data}const{data,error}=await s.from("opportunities").insert({opportunity_no:input.reference||`OPP-${Date.now()}`,customer_id:customer?.id??null,title:input.title,currency:input.currency,estimated_value:input.value,stage:input.stage,probability:input.probability,expected_close_date:input.dueDate||null,owner_id:user?.id??null,priority:input.priority,next_action:input.nextAction,created_by:user?.id??null}).select("*,customers(company_name),profiles:owner_id(full_name)").single();if(error)throw error;await load();return mapOpportunity(data)},[load]);
 return{...state,ready,error,refresh:load,updateOpportunity,updateTask,addOpportunity,resetStore:load};
}
