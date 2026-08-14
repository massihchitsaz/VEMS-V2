import { createClient } from "@/lib/supabase/client";

export async function getPayablesWorkspace(){
  const s=createClient();
  const [invoices,suppliers,profiles,deals,shipments,payments,allocations,activities]=await Promise.all([
    s.from("invoices").select("*,supplier:suppliers(company_name),deal:deals(deal_no,commodity),shipment:shipments(shipment_no),finance_owner:profiles!invoices_finance_owner_id_fkey(full_name)").eq("invoice_type","payable").order("due_date",{ascending:true}),
    s.from("suppliers").select("id,company_name,currency,payment_terms,status").order("company_name"),
    s.from("profiles").select("id,full_name,active").eq("active",true).order("full_name"),
    s.from("deals").select("id,deal_no,supplier_id,commodity").order("created_at",{ascending:false}),
    s.from("shipments").select("id,shipment_no,supplier_id").order("created_at",{ascending:false}),
    s.from("payments").select("*").eq("payment_type","outgoing").order("payment_date",{ascending:false}),
    s.from("payment_allocations").select("*").order("created_at",{ascending:false}),
    s.from("payable_activities").select("*,creator:profiles(full_name)").order("activity_at",{ascending:false}),
  ]);
  for(const r of [invoices,suppliers,profiles,deals,shipments,payments,allocations,activities]) if(r.error) throw r.error;
  return {invoices:invoices.data??[],suppliers:suppliers.data??[],profiles:profiles.data??[],deals:deals.data??[],shipments:shipments.data??[],payments:payments.data??[],allocations:allocations.data??[],activities:activities.data??[]};
}

export async function createPayable(input:any){
 const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
 const amount=Number(input.amount||0), tax=Number(input.tax_amount||0), total=amount+tax;
 if(!input.supplier_id||!amount||!input.due_date) throw new Error("Supplier, amount and due date are required");
 const invoice_no=input.invoice_no?.trim()||`AP-${Date.now().toString().slice(-8)}`;
 const payload={invoice_no,invoice_type:"payable",supplier_id:input.supplier_id,deal_id:input.deal_id||null,shipment_id:input.shipment_id||null,currency:input.currency||"AED",amount,tax_amount:tax,total_amount:total,status:"issued",issue_date:input.issue_date||new Date().toISOString().slice(0,10),due_date:input.due_date,notes:input.notes||null,payment_priority:input.payment_priority||"normal",approval_status:input.approval_required?"pending":"not_required",scheduled_payment_date:input.scheduled_payment_date||null,vendor_reference:input.vendor_reference||null,payment_terms:input.payment_terms||null,finance_owner_id:input.finance_owner_id||null,created_by:user.id};
 const {data,error}=await s.from("invoices").insert(payload).select().single(); if(error) throw error; return data;
}

export async function updatePayable(id:string,patch:any){const s=createClient();const{error}=await s.from("invoices").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error}

export async function approvePayable(id:string){const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");const{error}=await s.from("invoices").update({approval_status:"approved",approved_by:user.id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error}

export async function addPayableActivity(input:any){const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");const{error}=await s.from("payable_activities").insert({invoice_id:input.invoice_id,activity_type:input.activity_type,channel:input.channel||null,notes:input.notes||null,outcome:input.outcome||null,created_by:user.id});if(error)throw error}

export async function allocateOutgoingPayment(input:any){
 const s=createClient(); const amount=Number(input.amount||0); if(!input.invoice_id||!input.payment_id||amount<=0)throw new Error("Payment and allocation amount are required");
 const [{data:inv,error:ie},{data:pay,error:pe},{data:ia,error:iae},{data:pa,error:pae}]=await Promise.all([
  s.from("invoices").select("id,total_amount,currency,status").eq("id",input.invoice_id).single(),
  s.from("payments").select("id,amount,currency,status").eq("id",input.payment_id).single(),
  s.from("payment_allocations").select("amount").eq("invoice_id",input.invoice_id),
  s.from("payment_allocations").select("amount").eq("payment_id",input.payment_id),
 ]); if(ie)throw ie;if(pe)throw pe;if(iae)throw iae;if(pae)throw pae;
 if(inv.currency!==pay.currency) throw new Error("Invoice and payment currencies must match");
 const invUsed=(ia??[]).reduce((x:any,r:any)=>x+Number(r.amount||0),0), payUsed=(pa??[]).reduce((x:any,r:any)=>x+Number(r.amount||0),0);
 const invRemain=Number(inv.total_amount||0)-invUsed, payRemain=Number(pay.amount||0)-payUsed;
 if(amount>invRemain+0.0001)throw new Error("Allocation exceeds invoice outstanding balance");
 if(amount>payRemain+0.0001)throw new Error("Allocation exceeds available payment amount");
 const {error}=await s.from("payment_allocations").insert({invoice_id:input.invoice_id,payment_id:input.payment_id,amount,notes:input.notes||null});if(error)throw error;
 const newPaid=invUsed+amount; const status=newPaid>=Number(inv.total_amount||0)-0.0001?"paid":"partially_paid"; const u=await s.from("invoices").update({status,updated_at:new Date().toISOString()}).eq("id",input.invoice_id);if(u.error)throw u.error;
}

export async function deletePayable(id:string){const s=createClient();const{data:inv,error}=await s.from("invoices").select("status").eq("id",id).single();if(error)throw error;const{count,error:ce}=await s.from("payment_allocations").select("id",{count:"exact",head:true}).eq("invoice_id",id);if(ce)throw ce;if((count||0)>0)throw new Error("Payable with payment allocations cannot be deleted");if(!["draft","cancelled"].includes(inv.status))throw new Error("Only draft or cancelled payables can be deleted");const d=await s.from("invoices").delete().eq("id",id);if(d.error)throw d.error}
