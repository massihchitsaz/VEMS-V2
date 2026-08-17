import { createClient } from "@/lib/supabase/client";

const ref=(prefix:string)=>`${prefix}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(Date.now()).slice(-6)}`;

export async function quotationToOpportunity(quotationId:string){
 const s=createClient();const{data:q,error}=await s.from("quotations").select("*").eq("id",quotationId).single();if(error)throw error;
 const{data:opportunity,error:e}=await s.from("opportunities").insert({opportunity_no:ref("OPP"),quotation_id:q.id,customer_id:q.customer_id,title:q.title,currency:q.currency,estimated_value:q.total_amount,stage:"qualified",probability:50,priority:"medium",owner_id:q.owner_id,created_by:q.created_by}).select().single();if(e)throw e;
 return opportunity;
}

export async function opportunityToDeal(opportunityId:string){
 const s=createClient();const{data:o,error}=await s.from("opportunities").select("*,quotations(*)").eq("id",opportunityId).single();if(error)throw error;const q:any=o.quotations;
 const dealerId=o.owner_id??o.created_by;if(!dealerId)throw new Error("Opportunity must have an owner before creating a deal");
 const{data:deal,error:e}=await s.from("deals").insert({deal_no:ref("DEAL"),customer_id:o.customer_id,supplier_id:q?.supplier_id??null,dealer_id:dealerId,quotation_id:o.quotation_id,opportunity_id:o.id,amount:Number(o.estimated_value??0),buy_currency:o.currency??"AED",sell_currency:o.currency??"AED",status:"draft",notes:o.title}).select().single();if(e)throw e;
 await s.from("opportunities").update({stage:"won",probability:100,updated_at:new Date().toISOString()}).eq("id",opportunityId);return deal;
}

export async function requestDealApproval(dealId:string){const s=createClient();const{data,error}=await s.rpc("deal_submit_review_v1",{p_deal_id:dealId,p_reason:null});if(error)throw error;return data}

export async function decideApproval(approvalId:string,status:"approved"|"rejected",comments?:string){
 const s=createClient();const{data:a,error}=await s.from("approvals").select("*").eq("id",approvalId).single();if(error)throw error;
 if(a.entity_type==="deal"){const{data,error:e}=await s.rpc("deal_decide_v1",{p_deal_id:a.entity_id,p_decision:status,p_comments:comments??null});if(e)throw e;return data}
 const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");const{data:updated,error:e}=await s.from("approvals").update({status,comments:comments??null,approver_id:user.id,decided_at:new Date().toISOString()}).eq("id",approvalId).select().single();if(e)throw e;return updated;
}

export async function dealToShipment(dealId:string){const s=createClient();const{data,error}=await s.rpc("deal_create_shipment_v1",{p_deal_id:dealId,p_mode:"sea"});if(error)throw error;return data}

export async function shipmentToInvoice(shipmentId:string){const s=createClient();const{data:sh,error}=await s.from("shipments").select("*,deals(*)").eq("id",shipmentId).single();if(error)throw error;const d:any=sh.deals;const amount=Number(d?.amount??d?.sell_price??0);const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");const{data,error:e}=await s.from("invoices").insert({invoice_no:ref("INV"),invoice_type:"receivable",deal_id:sh.deal_id,shipment_id:sh.id,customer_id:sh.customer_id,currency:d?.sell_currency??sh.currency??"AED",amount,tax_amount:0,total_amount:amount,status:"issued",issue_date:new Date().toISOString().slice(0,10),created_by:user.id}).select().single();if(e)throw e;return data}

export async function recordInvoicePayment(invoiceId:string,amount:number,method="bank_transfer"){const s=createClient();if(!Number.isFinite(amount)||amount<=0)throw new Error("Payment amount must be greater than zero");const{data:i,error}=await s.from("invoices").select("*").eq("id",invoiceId).single();if(error)throw error;const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");const{data,error:e}=await s.from("payments").insert({payment_no:ref("PAY"),invoice_id:i.id,deal_id:i.deal_id,payment_type:"receipt",currency:i.currency,amount,payment_date:new Date().toISOString().slice(0,10),method,status:"completed",created_by:user.id}).select().single();if(e)throw e;const{data:rows,error:paymentsError}=await s.from("payments").select("amount").eq("invoice_id",invoiceId).eq("status","completed");if(paymentsError)throw paymentsError;const paid=(rows??[]).reduce((n:number,r:any)=>n+Number(r.amount??0),0);await s.from("invoices").update({status:paid>=Number(i.total_amount)?"paid":"partially_paid",updated_at:new Date().toISOString()}).eq("id",invoiceId);return data}
