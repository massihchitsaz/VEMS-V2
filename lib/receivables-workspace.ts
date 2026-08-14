import { createClient } from "@/lib/supabase/client";

export async function getReceivablesWorkspace(){
  const s=createClient();
  const [invoices,payments,allocations,activities,customers,profiles,deals,shipments]=await Promise.all([
    s.from("invoices").select("id,invoice_no,invoice_type,deal_id,shipment_id,customer_id,currency,amount,tax_amount,total_amount,status,issue_date,due_date,notes,dispute_status,dispute_reason,collection_status,collection_owner_id,promised_payment_date,last_follow_up_at,next_follow_up_at,credit_hold,created_at,customer:customers(company_name,credit_limit,currency),owner:profiles!invoices_collection_owner_id_fkey(full_name)").eq("invoice_type","receivable").order("issue_date",{ascending:false}),
    s.from("payments").select("id,payment_no,invoice_id,deal_id,payment_type,currency,amount,payment_date,method,bank_name,reference_no,status,notes,created_at").eq("payment_type","receipt").order("payment_date",{ascending:false}),
    s.from("payment_allocations").select("*").order("allocated_at",{ascending:false}),
    s.from("collection_activities").select("*,creator:profiles(full_name)").order("activity_at",{ascending:false}),
    s.from("customers").select("id,customer_code,company_name,credit_limit,currency,status").eq("status","active").order("company_name"),
    s.from("profiles").select("id,full_name,department,position,active").eq("active",true).order("full_name"),
    s.from("deals").select("id,deal_no,customer_id,status,commodity").order("created_at",{ascending:false}),
    s.from("shipments").select("id,shipment_no,customer_id,status").order("created_at",{ascending:false}),
  ]);
  for(const r of [invoices,payments,allocations,activities,customers,profiles,deals,shipments]) if(r.error) throw r.error;
  return {invoices:invoices.data??[],payments:payments.data??[],allocations:allocations.data??[],activities:activities.data??[],customers:customers.data??[],profiles:profiles.data??[],deals:deals.data??[],shipments:shipments.data??[]};
}

export async function createReceivable(input:any){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const invoiceNo=input.invoice_no?.trim()||`AR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const payload={invoice_no:invoiceNo,invoice_type:"receivable",customer_id:input.customer_id,deal_id:input.deal_id||null,shipment_id:input.shipment_id||null,currency:input.currency||"AED",amount:Number(input.amount||0),tax_amount:Number(input.tax_amount||0),total_amount:Number(input.amount||0)+Number(input.tax_amount||0),status:input.status||"issued",issue_date:input.issue_date,due_date:input.due_date,notes:input.notes||null,collection_status:"open",collection_owner_id:input.collection_owner_id||null,credit_hold:!!input.credit_hold,created_by:user.id};
  const {data,error}=await s.from("invoices").insert(payload).select().single(); if(error) throw error; return data;
}

export async function updateReceivable(id:string,patch:any){
  const s=createClient(); const p={...patch,updated_at:new Date().toISOString()};
  if("amount" in p||"tax_amount" in p) p.total_amount=Number(p.amount||0)+Number(p.tax_amount||0);
  const {error}=await s.from("invoices").update(p).eq("id",id); if(error) throw error;
}

export async function addCollectionActivity(input:any){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const now=input.activity_at||new Date().toISOString();
  const {error}=await s.from("collection_activities").insert({invoice_id:input.invoice_id,activity_type:input.activity_type||"follow_up",activity_at:now,channel:input.channel||null,contact_person:input.contact_person||null,notes:input.notes||null,outcome:input.outcome||null,next_follow_up_at:input.next_follow_up_at||null,promised_payment_date:input.promised_payment_date||null,created_by:user.id}); if(error) throw error;
  const patch:any={last_follow_up_at:now,next_follow_up_at:input.next_follow_up_at||null}; if(input.promised_payment_date) patch.promised_payment_date=input.promised_payment_date;
  const u=await s.from("invoices").update(patch).eq("id",input.invoice_id); if(u.error) throw u.error;
}

export async function allocateReceipt(input:any){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const amount=Number(input.amount||0); if(amount<=0) throw new Error("Allocation amount must be greater than zero");
  const {data:inv,error:ie}=await s.from("invoices").select("id,currency,total_amount").eq("id",input.invoice_id).single(); if(ie) throw ie;
  const {data:pay,error:pe}=await s.from("payments").select("id,currency,amount,status").eq("id",input.payment_id).single(); if(pe) throw pe;
  if(inv.currency!==pay.currency) throw new Error("Payment and invoice currencies must match");
  const [ia,pa]=await Promise.all([
    s.from("payment_allocations").select("amount").eq("invoice_id",input.invoice_id),
    s.from("payment_allocations").select("amount").eq("payment_id",input.payment_id),
  ]); if(ia.error) throw ia.error;if(pa.error)throw pa.error;
  const invAllocated=(ia.data??[]).reduce((x:any,r:any)=>x+Number(r.amount||0),0); const payAllocated=(pa.data??[]).reduce((x:any,r:any)=>x+Number(r.amount||0),0);
  if(amount>Number(inv.total_amount)-invAllocated+0.0001) throw new Error("Allocation exceeds invoice outstanding balance");
  if(amount>Number(pay.amount)-payAllocated+0.0001) throw new Error("Allocation exceeds unapplied receipt balance");
  const {error}=await s.from("payment_allocations").insert({payment_id:input.payment_id,invoice_id:input.invoice_id,amount,currency:inv.currency,allocated_by:user.id,notes:input.notes||null}); if(error) throw error;
  const newInvAllocated=invAllocated+amount; const invStatus=newInvAllocated+0.0001>=Number(inv.total_amount)?"paid":"partially_paid";
  const u=await s.from("invoices").update({status:invStatus,collection_status:invStatus==="paid"?"closed":"open",updated_at:new Date().toISOString()}).eq("id",input.invoice_id); if(u.error) throw u.error;
  const newPayAllocated=payAllocated+amount; if(newPayAllocated+0.0001>=Number(pay.amount)){const p=await s.from("payments").update({status:"allocated",updated_at:new Date().toISOString()}).eq("id",input.payment_id);if(p.error)throw p.error}
}

export async function deleteReceivable(id:string){
  const s=createClient(); const {data:a,error:e}=await s.from("payment_allocations").select("id").eq("invoice_id",id).limit(1); if(e)throw e; if((a??[]).length) throw new Error("Invoice has allocations and cannot be deleted");
  const {data:inv,error:ie}=await s.from("invoices").select("status").eq("id",id).single(); if(ie)throw ie; if(!["draft","cancelled"].includes(String(inv.status).toLowerCase())) throw new Error("Only draft or cancelled invoices can be deleted");
  const {error}=await s.from("invoices").delete().eq("id",id); if(error) throw error;
}
