import { createClient } from "@/lib/supabase/client";

const fail=(e:any,fallback:string)=>{if(!e)return;throw new Error(e.message||fallback)};
export async function getPaymentsControlData(){
 const s=createClient();
 const [payments,suppliers,customers,invoices,allocations,profiles,events,roleRes]=await Promise.all([
  s.from("payments").select("id,payment_no,invoice_id,deal_id,supplier_id,customer_id,payment_type,currency,amount,payment_date,method,bank_name,reference_no,status,notes,approved_by,created_by,created_at,updated_at,beneficiary_name,beneficiary_country,beneficiary_bank,beneficiary_iban,beneficiary_account_no,beneficiary_swift,intermediary_bank,source_account,purpose,priority,approval_required,approval_status,compliance_status,compliance_notes,scheduled_date,value_date,executed_at,settlement_status,reconciliation_status,failure_reason,bank_fee,fx_rate,instruction_reference,supplier:suppliers(company_name),customer:customers(company_name)").order("created_at",{ascending:false}),
  s.from("suppliers").select("id,company_name,status,kyc_status,currency,payment_terms").eq("status","active").order("company_name"),
  s.from("customers").select("id,company_name,status,currency").eq("status","active").order("company_name"),
  s.from("invoices").select("id,invoice_no,invoice_type,supplier_id,customer_id,currency,total_amount,status,due_date").neq("status","cancelled").order("due_date",{ascending:true}),
  s.from("payment_allocations").select("id,payment_id,invoice_id,amount,currency,allocated_at,notes").order("allocated_at",{ascending:false}),
  s.from("profiles").select("id,full_name,role,active").eq("active",true).order("full_name"),
  s.from("payment_events").select("id,payment_id,event_type,event_at,status_from,status_to,notes,bank_reference,creator:profiles(full_name)").order("event_at",{ascending:false}),
  s.rpc("finance_current_role")
 ]);
 for(const r of [payments,suppliers,customers,invoices,allocations,profiles,events]) fail(r.error,"Unable to load payment workspace");
 fail(roleRes.error,"Unable to resolve finance role");
 const role=String(roleRes.data||"").toLowerCase();
 return {payments:payments.data??[],suppliers:suppliers.data??[],customers:customers.data??[],invoices:invoices.data??[],allocations:allocations.data??[],profiles:profiles.data??[],events:events.data??[],role,can_write:["admin","ceo","manager","finance"].includes(role),can_approve:["admin","ceo","manager"].includes(role)};
}
export async function createPaymentV2(input:any){
 const s=createClient(); const amount=Number(input.amount||0); if(amount<=0)throw new Error("Payment amount must be greater than zero.");
 const type=input.payment_type==="receipt"?"receipt":"payment";
 if(type==="payment"&&!input.supplier_id&&!input.beneficiary_name?.trim())throw new Error("Supplier or beneficiary is required for an outgoing payment.");
 if(type==="receipt"&&!input.customer_id&&!input.invoice_id)throw new Error("Customer or receivable invoice is required for a receipt.");
 const {data,error}=await s.rpc("finance_create_payment_v1",{p_payload:{...input,payment_type:type,amount,currency:input.currency||"AED",payment_date:input.payment_date||new Date().toISOString().slice(0,10)}}); fail(error,"Unable to create payment"); return data;
}
export async function approvePaymentV2(id:string,comments?:string){const s=createClient();const{data,error}=await s.rpc("finance_approve_payment_v1",{p_payment_id:id,p_comments:comments||null});fail(error,"Unable to approve payment");return data}
export async function settlePaymentV2(id:string,outcome:"completed"|"failed",reference?:string|null,reason?:string|null){const s=createClient();const{data,error}=await s.rpc("finance_settle_payment_v1",{p_payment_id:id,p_outcome:outcome,p_reference:reference||null,p_reason:reason||null});fail(error,"Unable to settle payment");return data}
export async function cancelPaymentV2(id:string,reason:string){if(reason.trim().length<5)throw new Error("Cancellation reason is required.");const s=createClient();const{data,error}=await s.rpc("finance_cancel_payment_v1",{p_payment_id:id,p_reason:reason});fail(error,"Unable to cancel payment");return data}
export async function setPaymentComplianceV2(id:string,status:string,notes?:string|null){const s=createClient();const{data,error}=await s.rpc("finance_set_payment_compliance_v2",{p_payment_id:id,p_status:status,p_notes:notes||null});fail(error,"Unable to update compliance");return data}
export async function setPaymentReconciliationV2(id:string,status:string,reference?:string|null,valueDate?:string|null,notes?:string|null){const s=createClient();const{data,error}=await s.rpc("finance_set_payment_reconciliation_v2",{p_payment_id:id,p_status:status,p_reference:reference||null,p_value_date:valueDate||null,p_notes:notes||null});fail(error,"Unable to update reconciliation");return data}
export async function addPaymentEventV2(id:string,input:any){const s=createClient();const{data,error}=await s.rpc("finance_add_payment_event_v2",{p_payment_id:id,p_event_type:input.event_type,p_event_at:input.event_at||new Date().toISOString(),p_bank_reference:input.bank_reference||null,p_notes:input.notes||null});fail(error,"Unable to add payment event");return data}
