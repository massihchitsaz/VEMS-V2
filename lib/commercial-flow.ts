import { createClient } from "@/lib/supabase/client";

export type CommercialFlowPermissions = { role: string; canControl: boolean; canWrite: boolean };
export type CommercialFlowData = {
  opportunities: any[];
  quotations: any[];
  deals: any[];
  shipments: any[];
  invoices: any[];
  payments: any[];
  customers: any[];
  suppliers: any[];
  events: any[];
  permissions: CommercialFlowPermissions;
};

const s = () => createClient();

export async function getCommercialFlowPermissions(): Promise<CommercialFlowPermissions> {
  const c=s();
  const [{data:role,error:r1},{data:control,error:r2}] = await Promise.all([
    c.rpc("commercial_flow_role"),
    c.rpc("commercial_flow_can_control")
  ]);
  if(r1) throw r1; if(r2) throw r2;
  const r=String(role??"unknown");
  return {role:r,canControl:Boolean(control),canWrite:["admin","ceo","manager","dealer","operations","logistics"].includes(r)};
}

export async function listCommercialFlow(): Promise<CommercialFlowData> {
  const c=s();
  const [op,q,d,sh,inv,pay,cust,sup,ev,permissions]=await Promise.all([
    c.from("opportunities").select("*,customers(company_name,status),profiles:owner_id(full_name)").order("updated_at",{ascending:false}),
    c.from("quotations").select("*,customers(company_name,status),suppliers(company_name,status,kyc_status,kyc_expiry_date),quotation_items(*)").order("updated_at",{ascending:false}),
    c.from("deals").select("*,customers(company_name,status),suppliers(company_name,status,kyc_status,kyc_expiry_date),profiles:dealer_id(full_name)").order("updated_at",{ascending:false}),
    c.from("shipments").select("id,shipment_no,deal_id,quotation_id,status,mode,etd,eta,customer_id,supplier_id").order("created_at",{ascending:false}),
    c.from("invoices").select("id,invoice_no,invoice_type,deal_id,shipment_id,customer_id,currency,total_amount,status,due_date,collection_status").order("created_at",{ascending:false}),
    c.from("payments").select("id,payment_no,deal_id,invoice_id,currency,amount,status,payment_date").order("created_at",{ascending:false}),
    c.from("customers").select("id,company_name,status,customer_type").order("company_name"),
    c.from("suppliers").select("id,company_name,status,kyc_status,kyc_expiry_date").order("company_name"),
    c.from("commercial_flow_events").select("*").order("created_at",{ascending:false}).limit(100),
    getCommercialFlowPermissions()
  ]);
  for(const r of [op,q,d,sh,inv,pay,cust,sup,ev]) if(r.error) throw r.error;
  return {opportunities:op.data??[],quotations:q.data??[],deals:d.data??[],shipments:sh.data??[],invoices:inv.data??[],payments:pay.data??[],customers:cust.data??[],suppliers:sup.data??[],events:ev.data??[],permissions};
}

export async function createQuotationFromOpportunity(opportunityId:string,supplierId?:string|null){
  const {data,error}=await s().rpc("opportunity_to_quotation_v1",{p_opportunity_id:opportunityId,p_supplier_id:supplierId||null});
  if(error) throw error; return data;
}
export async function submitQuotationForReview(quotationId:string,reason?:string){
  const {data,error}=await s().rpc("quotation_submit_v1",{p_quotation_id:quotationId,p_reason:reason||null}); if(error)throw error; return data;
}
export async function decideQuotation(quotationId:string,decision:"approved"|"rejected",comments?:string){
  const {data,error}=await s().rpc("quotation_decide_v1",{p_quotation_id:quotationId,p_decision:decision,p_comments:comments||null}); if(error)throw error; return data;
}
export async function convertQuotationToDeal(quotationId:string){
  const {data,error}=await s().rpc("quotation_to_deal_v1",{p_quotation_id:quotationId}); if(error)throw error; return data;
}
export async function createShipmentFromCommercialDeal(dealId:string,mode:string){
  const {data,error}=await s().rpc("deal_create_shipment_v1",{p_deal_id:dealId,p_mode:mode}); if(error)throw error; return data;
}
export async function generateReceivableInvoice(dealId:string,shipmentId?:string|null,dueDate?:string|null){
  const {data,error}=await s().rpc("commercial_generate_invoice_v1",{p_deal_id:dealId,p_shipment_id:shipmentId||null,p_due_date:dueDate||null}); if(error)throw error; return data;
}
export async function getCommercialFlowSnapshot(dealId:string){
  const {data,error}=await s().rpc("commercial_flow_snapshot_v1",{p_deal_id:dealId}); if(error)throw error; return data;
}
