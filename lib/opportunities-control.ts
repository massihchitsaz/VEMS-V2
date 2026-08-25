import {createClient} from "@/lib/supabase/client";
export type OpportunityCreateInput={title:string;customer_id:string;currency:string;estimated_value:number;probability:number;priority:string;expected_close_date?:string|null;next_action?:string};
export async function createOpportunityControlled(input:OpportunityCreateInput){
  const s=createClient();
  const{data:{session},error:sessionError}=await s.auth.getSession();
  if(sessionError||!session?.user?.id)throw new Error("Your session is not available. Please sign in again and retry.");
  const{data:{user},error:userError}=await s.auth.getUser();
  if(userError||!user?.id)throw new Error("Your session could not be verified. Please sign in again and retry.");
  if(!input.title.trim()||!input.customer_id)throw new Error("Customer and opportunity title are required.");
  const opportunityNo=`OPP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const payload={opportunity_no:opportunityNo,customer_id:input.customer_id,title:input.title.trim(),currency:input.currency||"AED",estimated_value:Number(input.estimated_value||0),stage:"lead",probability:Math.max(0,Math.min(100,Number(input.probability||0))),expected_close_date:input.expected_close_date||null,owner_id:user.id,created_by:user.id,priority:input.priority||"medium",next_action:input.next_action?.trim()||null};
  const{data:row,error}=await s.from("opportunities").insert(payload).select("id,opportunity_no,title,customer_id,stage,created_at").single();
  if(error)throw error;
  if(!row?.id)throw new Error("Opportunity save did not return a valid record.");
  const{data:verified,error:verifyError}=await s.from("opportunities").select("id,opportunity_no,title,customer_id,stage,updated_at").eq("id",row.id).single();
  if(verifyError||!verified?.id)throw verifyError||new Error("Opportunity save could not be verified.");
  return verified;
}
