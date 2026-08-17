import { createClient } from "@/lib/supabase/client";

export type FinanceSnapshot={role:string;can_write:boolean;can_approve:boolean;receivables:any[];payables:any[];payments:any[];events:any[]};
const s=()=>createClient();

export async function getFinanceSnapshot():Promise<FinanceSnapshot>{const{data,error}=await s().rpc("finance_snapshot_v1");if(error)throw error;return data as FinanceSnapshot}
export async function getFinanceLookups(){const c=s();const[customers,suppliers,deals,shipments,profiles]=await Promise.all([
 c.from("customers").select("id,company_name,status").eq("status","active").order("company_name"),
 c.from("suppliers").select("id,company_name,status,kyc_status").eq("status","active").order("company_name"),
 c.from("deals").select("id,deal_no,customer_id,supplier_id,status").order("created_at",{ascending:false}).limit(250),
 c.from("shipments").select("id,shipment_no,deal_id,customer_id,supplier_id,status").order("created_at",{ascending:false}).limit(250),
 c.from("profiles").select("id,full_name,role,active").eq("active",true).order("full_name")
]);for(const r of[customers,suppliers,deals,shipments,profiles])if(r.error)throw r.error;return{customers:customers.data??[],suppliers:suppliers.data??[],deals:deals.data??[],shipments:shipments.data??[],profiles:profiles.data??[]}}

export async function createFinanceInvoice(payload:any){const{data,error}=await s().rpc("finance_create_invoice_v1",{p_payload:payload});if(error)throw error;return data}
export async function issueFinanceInvoice(id:string,dueDate?:string|null){const{data,error}=await s().rpc("finance_issue_invoice_v1",{p_invoice_id:id,p_due_date:dueDate||null});if(error)throw error;return data}
export async function setInvoiceDispute(id:string,status:"clear"|"disputed"|"resolved",reason?:string|null){const{data,error}=await s().rpc("finance_set_invoice_dispute_v1",{p_invoice_id:id,p_status:status,p_reason:reason||null});if(error)throw error;return data}
export async function setInvoiceCollection(id:string,status:"open"|"contacted"|"promised"|"escalated"|"closed",ownerId?:string|null,promisedDate?:string|null,nextFollowUp?:string|null,notes?:string|null){const{data,error}=await s().rpc("finance_set_collection_v1",{p_invoice_id:id,p_collection_status:status,p_owner_id:ownerId||null,p_promised_date:promisedDate||null,p_next_follow_up:nextFollowUp||null,p_notes:notes||null});if(error)throw error;return data}
export async function cancelFinanceInvoice(id:string,reason:string){const{data,error}=await s().rpc("finance_cancel_invoice_v1",{p_invoice_id:id,p_reason:reason});if(error)throw error;return data}

export async function createFinancePayment(payload:any){const{data,error}=await s().rpc("finance_create_payment_v1",{p_payload:payload});if(error)throw error;return data}
export async function approveFinancePayment(id:string,comments?:string|null){const{data,error}=await s().rpc("finance_approve_payment_v1",{p_payment_id:id,p_comments:comments||null});if(error)throw error;return data}
export async function settleFinancePayment(id:string,outcome:"completed"|"failed",reference?:string|null,reason?:string|null){const{data,error}=await s().rpc("finance_settle_payment_v1",{p_payment_id:id,p_outcome:outcome,p_reference:reference||null,p_reason:reason||null});if(error)throw error;return data}
export async function cancelFinancePayment(id:string,reason:string){const{data,error}=await s().rpc("finance_cancel_payment_v1",{p_payment_id:id,p_reason:reason});if(error)throw error;return data}
