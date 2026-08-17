import {createClient} from "@/lib/supabase/client";
import {createFinanceInvoice,issueFinanceInvoice,setInvoiceDispute,setInvoiceCollection,cancelFinanceInvoice,getFinanceSnapshot} from "@/lib/finance-control";

const s=()=>createClient();

export async function getReceivablesControlData(){
 const c=s();
 const [snapshot,invoices,receipts,allocations,activities,customers,profiles]=await Promise.all([
  getFinanceSnapshot(),
  c.from("invoices").select("id,invoice_no,invoice_type,deal_id,shipment_id,customer_id,currency,amount,tax_amount,total_amount,status,issue_date,due_date,notes,dispute_status,dispute_reason,collection_status,collection_owner_id,promised_payment_date,last_follow_up_at,next_follow_up_at,credit_hold,created_at,customer:customers(company_name,credit_limit,currency),owner:profiles!invoices_collection_owner_id_fkey(full_name)").eq("invoice_type","receivable").order("issue_date",{ascending:false}),
  c.from("payments").select("id,payment_no,invoice_id,customer_id,currency,amount,payment_date,method,reference_no,status,settlement_status,reconciliation_status,notes").eq("payment_type","receipt").order("payment_date",{ascending:false}),
  c.from("payment_allocations").select("id,payment_id,invoice_id,amount,currency,allocated_at,notes").order("allocated_at",{ascending:false}),
  c.from("collection_activities").select("id,invoice_id,activity_type,activity_at,channel,contact_person,notes,outcome,next_follow_up_at,promised_payment_date,creator:profiles(full_name)").order("activity_at",{ascending:false}),
  c.from("customers").select("id,customer_code,company_name,credit_limit,currency,status").eq("status","active").order("company_name"),
  c.from("profiles").select("id,full_name,role,active").eq("active",true).order("full_name")
 ]);
 for(const r of[invoices,receipts,allocations,activities,customers,profiles])if(r.error)throw r.error;
 return{role:snapshot.role,can_write:snapshot.can_write,can_approve:snapshot.can_approve,invoices:invoices.data??[],receipts:receipts.data??[],allocations:allocations.data??[],activities:activities.data??[],customers:customers.data??[],profiles:profiles.data??[]};
}

export async function createReceivableV2(payload:any,issueNow=false){
 const draft=await createFinanceInvoice({...payload,invoice_type:"receivable"});
 if(issueNow)return issueFinanceInvoice(draft.id,payload.due_date||null);
 return draft;
}

export async function issueReceivableV2(id:string,dueDate?:string|null){return issueFinanceInvoice(id,dueDate||null)}
export async function updateCollectionV2(id:string,status:"open"|"contacted"|"promised"|"escalated"|"closed",ownerId?:string|null,promisedDate?:string|null,nextFollowUp?:string|null,notes?:string|null){return setInvoiceCollection(id,status,ownerId||null,promisedDate||null,nextFollowUp||null,notes||null)}
export async function setReceivableDisputeV2(id:string,status:"clear"|"disputed"|"resolved",reason?:string|null){return setInvoiceDispute(id,status,reason||null)}
export async function cancelReceivableV2(id:string,reason:string){return cancelFinanceInvoice(id,reason)}

export async function addCollectionActivityV2(payload:any){const{data,error}=await s().rpc("finance_add_collection_activity_v2",{p_payload:payload});if(error)throw error;return data}
export async function allocateReceiptV2(invoiceId:string,paymentId:string,amount:number,notes?:string|null){const{data,error}=await s().rpc("finance_allocate_receipt_v2",{p_invoice_id:invoiceId,p_payment_id:paymentId,p_amount:amount,p_notes:notes||null});if(error)throw error;return data}
