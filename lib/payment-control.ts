import { createClient } from "@/lib/supabase/client";

export async function getPaymentWorkspace(){
  const s=createClient();
  const [payments,suppliers,customers,invoices,allocations,profiles,approvals,events]=await Promise.all([
    s.from("payments").select("id,payment_no,invoice_id,deal_id,supplier_id,customer_id,payment_type,currency,amount,payment_date,method,bank_name,reference_no,status,notes,approved_by,created_at,updated_at,beneficiary_name,beneficiary_country,beneficiary_bank,beneficiary_iban,beneficiary_account_no,beneficiary_swift,intermediary_bank,source_account,purpose,priority,approval_required,approval_status,compliance_status,compliance_notes,scheduled_date,value_date,executed_at,settlement_status,reconciliation_status,failure_reason,bank_fee,fx_rate,instruction_reference,supplier:suppliers(company_name),customer:customers(company_name)").order("created_at",{ascending:false}),
    s.from("suppliers").select("id,company_name,status,kyc_status,currency,payment_terms").order("company_name"),
    s.from("customers").select("id,company_name,status,currency").order("company_name"),
    s.from("invoices").select("id,invoice_no,invoice_type,supplier_id,customer_id,currency,total_amount,status,due_date").order("due_date",{ascending:true}),
    s.from("payment_allocations").select("id,payment_id,invoice_id,amount,currency,allocated_at,notes").order("allocated_at",{ascending:false}),
    s.from("profiles").select("id,full_name,department,position,active").eq("active",true).order("full_name"),
    s.from("approvals").select("id,entity_type,entity_id,approval_type,approver_id,status,comments,requested_at,decided_at,approver:profiles!approvals_approver_id_fkey(full_name)").eq("entity_type","payment").order("requested_at",{ascending:false}),
    s.from("payment_events").select("id,payment_id,event_type,event_at,status_from,status_to,notes,bank_reference,creator:profiles(full_name)").order("event_at",{ascending:false}),
  ]);
  for(const r of [payments,suppliers,customers,invoices,allocations,profiles,approvals,events]) if(r.error) throw r.error;
  return {payments:payments.data??[],suppliers:suppliers.data??[],customers:customers.data??[],invoices:invoices.data??[],allocations:allocations.data??[],profiles:profiles.data??[],approvals:approvals.data??[],events:events.data??[]};
}

export async function createPayment(input:any){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const amount=Number(input.amount||0); if(amount<=0) throw new Error("Payment amount must be greater than zero");
  const paymentNo=input.payment_no?.trim()||`PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const payload:any={payment_no:paymentNo,invoice_id:input.invoice_id||null,deal_id:input.deal_id||null,supplier_id:input.supplier_id||null,customer_id:input.customer_id||null,payment_type:input.payment_type||"outgoing",currency:input.currency||"AED",amount,payment_date:input.payment_date||new Date().toISOString().slice(0,10),method:input.method||"bank_transfer",bank_name:input.beneficiary_bank||input.bank_name||null,reference_no:input.reference_no||null,status:input.status||"draft",notes:input.notes||null,created_by:user.id,beneficiary_name:input.beneficiary_name||null,beneficiary_country:input.beneficiary_country||null,beneficiary_bank:input.beneficiary_bank||null,beneficiary_iban:input.beneficiary_iban||null,beneficiary_account_no:input.beneficiary_account_no||null,beneficiary_swift:input.beneficiary_swift||null,intermediary_bank:input.intermediary_bank||null,source_account:input.source_account||null,purpose:input.purpose||null,priority:input.priority||"normal",approval_required:input.approval_required!==false,approval_status:input.approval_required===false?"not_required":"pending",compliance_status:input.compliance_status||"pending",scheduled_date:input.scheduled_date||null,value_date:input.value_date||null,settlement_status:"unsettled",reconciliation_status:"unreconciled",bank_fee:Number(input.bank_fee||0),fx_rate:input.fx_rate?Number(input.fx_rate):null,instruction_reference:input.instruction_reference||null};
  const {data,error}=await s.from("payments").insert(payload).select().single(); if(error) throw error;
  await s.from("payment_events").insert({payment_id:data.id,event_type:"created",status_to:data.status,notes:"Payment instruction created",created_by:user.id});
  return data;
}

export async function updatePayment(id:string,patch:any){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const {data:old,error:oe}=await s.from("payments").select("status,approval_status,compliance_status").eq("id",id).single(); if(oe) throw oe;
  const p={...patch,updated_at:new Date().toISOString()};
  if(p.status==="completed"&&!p.executed_at) p.executed_at=new Date().toISOString();
  const {error}=await s.from("payments").update(p).eq("id",id); if(error) throw error;
  if(p.status&&p.status!==old.status) await s.from("payment_events").insert({payment_id:id,event_type:"status_change",status_from:old.status,status_to:p.status,notes:p.failure_reason||null,created_by:user.id});
}

export async function requestPaymentApproval(id:string,approverId?:string){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const {data:p,error:e}=await s.from("payments").select("approval_required,approval_status,status").eq("id",id).single(); if(e) throw e;
  if(!p.approval_required) throw new Error("This payment does not require approval");
  const existing=await s.from("approvals").select("id,status").eq("entity_type","payment").eq("entity_id",id).in("status",["pending","requested"]).limit(1); if(existing.error) throw existing.error;
  if((existing.data??[]).length) throw new Error("An approval request is already open");
  const {error}=await s.from("approvals").insert({entity_type:"payment",entity_id:id,approval_type:"payment_approval",requested_by:user.id,approver_id:approverId||null,status:"pending"}); if(error) throw error;
  await s.from("payments").update({approval_status:"pending",status:p.status==="draft"?"approval":p.status,updated_at:new Date().toISOString()}).eq("id",id);
  await s.from("payment_events").insert({payment_id:id,event_type:"approval_requested",notes:"Approval requested",created_by:user.id});
}

export async function decidePaymentApproval(approvalId:string,paymentId:string,status:"approved"|"rejected",comments?:string){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const {error}=await s.from("approvals").update({status,comments:comments||null,approver_id:user.id,decided_at:new Date().toISOString()}).eq("id",approvalId); if(error) throw error;
  const patch:any={approval_status:status,approved_by:status==="approved"?user.id:null,updated_at:new Date().toISOString()}; if(status==="rejected") patch.status="rejected";
  const u=await s.from("payments").update(patch).eq("id",paymentId); if(u.error) throw u.error;
  await s.from("payment_events").insert({payment_id:paymentId,event_type:`approval_${status}`,notes:comments||null,created_by:user.id});
}

export async function addPaymentEvent(paymentId:string,input:any){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const {error}=await s.from("payment_events").insert({payment_id:paymentId,event_type:input.event_type||"note",event_at:input.event_at||new Date().toISOString(),notes:input.notes||null,bank_reference:input.bank_reference||null,created_by:user.id}); if(error) throw error;
}

export async function deletePayment(id:string){
  const s=createClient();
  const {data:a,error:ae}=await s.from("payment_allocations").select("id").eq("payment_id",id).limit(1); if(ae) throw ae; if((a??[]).length) throw new Error("Allocated payments cannot be deleted");
  const {data:p,error:pe}=await s.from("payments").select("status").eq("id",id).single(); if(pe) throw pe;
  if(!["draft","cancelled","rejected"].includes(String(p.status).toLowerCase())) throw new Error("Only draft, cancelled or rejected payments can be deleted");
  const {error}=await s.from("payments").delete().eq("id",id); if(error) throw error;
}
