import { createClient } from "@/lib/supabase/client";
import { registerDocument } from "@/lib/document-center";

export type ReadinessItem = {
  rule_id:string;
  document_type:string;
  gate:string;
  state:string;
  document_id:string|null;
  document_status:string|null;
  expiry_date:string|null;
  version:number|null;
  notes:string|null;
};

export type DocumentReadiness = {
  entity_type:"shipment"|"deal";
  entity_id:string;
  label:string;
  mode:string|null;
  is_dg:boolean;
  temperature_controlled:boolean;
  required_count:number;
  ready_count:number;
  missing_count:number;
  blocked_count:number;
  completion_percent:number;
  gate_status:"ready"|"blocked"|"not_configured";
  items:ReadinessItem[];
};

export type RequirementRule = {
  id:string;
  entity_type:"shipment"|"deal";
  document_type:string;
  gate:string;
  modes:string[];
  requires_dg:boolean;
  requires_temperature_controlled:boolean;
  is_required:boolean;
  active:boolean;
  sort_order:number;
  notes:string|null;
  created_at:string;
  updated_at:string;
};

export async function getReadinessWorkspace(){
  const s=createClient();
  const [overview,rules]=await Promise.all([
    s.rpc("document_readiness_overview_v2",{p_limit_each:100}),
    s.from("document_requirement_rules").select("*").order("entity_type").order("sort_order").order("document_type")
  ]);
  if(overview.error)throw overview.error;
  if(rules.error)throw rules.error;
  const raw=(overview.data??{}) as any;
  return {
    shipments:(raw.shipments??[]) as DocumentReadiness[],
    deals:(raw.deals??[]) as DocumentReadiness[],
    rules:(rules.data??[]) as RequirementRule[]
  };
}

export async function getDocumentReadiness(entityType:"shipment"|"deal",entityId:string){
  const s=createClient();
  const {data,error}=await s.rpc("document_readiness_v1",{p_entity_type:entityType,p_entity_id:entityId});
  if(error)throw error;
  return data as unknown as DocumentReadiness;
}

export async function saveRequirementRule(payload:Partial<RequirementRule> & {entity_type:string;document_type:string}){
  const s=createClient();
  const {data,error}=await s.rpc("document_requirement_save_v1",{p_payload:payload as any});
  if(error)throw error;
  return data as string;
}

export async function setRequirementRuleActive(ruleId:string,active:boolean){
  const s=createClient();
  const {error}=await s.rpc("document_requirement_set_active_v1",{p_rule_id:ruleId,p_active:active});
  if(error)throw error;
}

export async function registerMissingRequirement(readiness:DocumentReadiness,item:ReadinessItem,file:File,referenceNo?:string,notes?:string){
  return registerDocument({
    entity_type:readiness.entity_type,
    entity_id:readiness.entity_id,
    document_type:item.document_type,
    title:`${readiness.label} - ${item.document_type}`,
    reference_no:referenceNo||null,
    module:readiness.entity_type==="shipment"?"LOGISTICS":"COMMERCIAL",
    category:"Required Document",
    is_required:true,
    confidentiality:"internal",
    notes:notes||`Registered from readiness gate: ${item.gate}`
  },file);
}
