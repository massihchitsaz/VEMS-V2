import { createClient } from "@/lib/supabase/client";

const ref=(prefix:string)=>`${prefix}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(Date.now()).slice(-6)}`;

export async function quotationToOpportunity(quotationId:string){
 const s=createClient();const{data:q,error}=await s.from("quotations").select("*").eq("id",quotationId).single();if(error)throw error;
 const{data:opportunity,error:e}=await s.from("opportunities").insert({opportunity_no:ref("OPP"),quotation_id:q.id,customer_id:q.customer_id,title:q.title,currency:q.currency,estimated_value:q.total_amount,stage:"qualified",probability:50,priority:"medium",owner_id:q.owner_id,created_by:q.created_by}).select().single();if(e)throw e;
 await s.from("quotations").update({status:"awarded"}).eq("id",quotationId);return opportunity;
}

export async function opportunityToDeal(opportunityId:string){
 const s=createClient();const{data:o,error}=await s.from("opportunities").select("*,quotations(*)").eq("id",opportunityId).single();if(error)throw error;const q:any=o.quotations;
 const{data:deal,error:e}=await s.from("deals").insert({deal_no:ref("DEAL"),customer_id:o.customer_id,supplier_id:q?.supplier_id??null,dealer_id:o.owner_id??o.created_by,quotation_id:o.quotation_id,opportunity_id:o.id,amount:o.estimated_value??0,buy_currency:o.currency??"AED",sell_currency:o.currency??"AED",status:"draft",notes:o.title}).select().single();if(e)throw e;
 await s.from("opportunities").update({stage:"won",probability:100}).eq("id",opportunityId);return deal;
}

export async function requestDealApproval(dealId:string){const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");const{data,error}=await s.from("approvals").insert({entity_type:"deal",entity_id:dealId,approval_type:"commercial",requested_by:user.id,status:"pending"}).select().single();if(error)throw error;await s.from("deals").update({status:"pending"}).eq("id",dealId);return data}

export async function decideApproval(approvalId:string,status:"approved"|"rejected",comments?:string){const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");const{data:a,error}=await s.from("approvals").update({status,comments:comments??null,approver_id:user.id,decided_at:new Date().toISOString()}).eq("id",approvalId).select().single();if(error)throw error;if(a.entity_type==="deal")await s.from("deals").update({status:status==="approved"?"approved":"cancelled"}).eq("id",a.entity_id);return a}

export async function dealToShipment(dealId:string){const s=createClient();const{data:d,error}=await s.from("deals").select("*").eq("id",dealId).single();if(error)throw error;if(d.status!=="approved"&&d.status!=="completed")throw new Error("Deal must be approved before shipment creation");const{data,error:e}=await s.from("shipments").insert({shipment_no:ref("SHP"),deal_id:d.id,quotation_id:d.quotation_id,customer_id:d.customer_id,supplier_id:d.supplier_id,status:"planning",origin:d.origin_country??null,destination:d.destination_country??null,cargo_description:d.commodity??d.notes,currency:d.sell_currency??"AED",owner_id:d.dealer_id,created_by:d.dealer_id}).select().single();if(e)throw e;await s.from("deals").update({shipment_status:"planning"}).eq("id",dealId);return data}

export async function shipmentToInvoice(shipmentId:string){const s=createClient();const{data:sh,error}=await s.from("shipments").select("*,deals(*)").eq("id",shipmentId).single();if(error)throw error;const d:any=sh.deals;const amount=Number(d?.amount??d?.sell_price??0);const{data:{user}}=await s.auth.getUser();const{data,error:e}=await s.from("invoices").insert({invoice_no:ref("INV"),invoice_type:"sales",deal_id:sh.deal_id,shipment_id:sh.id,customer_id:sh.customer_id,currency:d?.sell_currency??sh.currency??"AED",amount,tax_amount:0,total_amount:amount,status:"issued",issue_date:new Date().toISOString().slice(0,10),created_by:user?.id??null}).select().single();if(e)throw e;return data}

export async function recordInvoicePayment(invoiceId:string,amount:number,method="bank_transfer"){const s=createClient();const{data:i,error}=await s.from("invoices").select("*").eq("id",invoiceId).single();if(error)throw error;const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");const{data,error:e}=await s.from("payments").insert({payment_no:ref("PAY"),invoice_id:i.id,deal_id:i.deal_id,payment_type:"receipt",currency:i.currency,amount,payment_date:new Date().toISOString().slice(0,10),method,status:"completed",created_by:user.id}).select().single();if(e)throw e;const{data:rows}=await s.from("payments").select("amount").eq("invoice_id",invoiceId).eq("status","completed");const paid=(rows??[]).reduce((n:number,r:any)=>n+Number(r.amount??0),0);await s.from("invoices").update({status:paid>=Number(i.total_amount)?"paid":"partially_paid"}).eq("id",invoiceId);return data}
