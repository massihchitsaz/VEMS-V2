import {createClient} from "@/lib/supabase/client";

export type DealStatus="draft"|"pending"|"review"|"approved"|"completed"|"cancelled";
export type DealReadiness={ready:boolean;blockers:string[];warnings:string[];gross_profit:number;margin_percent:number;status:DealStatus;cross_currency?:boolean};
export type DealOperational={invoice_count:number;open_invoices:number;invoice_total:number;received_total:number;payment_state:string;shipment_count:number;active_shipments:number;delivered_shipments:number;shipment_state:string;last_event_at:string|null};
export type DealRow={
 id:string;deal_no:string;customer_id:string|null;supplier_id:string|null;dealer_id:string;quotation_id:string|null;opportunity_id:string|null;
 buy_currency:string;sell_currency:string;amount:number;buy_rate:number|null;sell_rate:number|null;profit_aed:number;status:DealStatus;notes:string|null;
 commodity:string|null;origin_country:string|null;destination_country:string|null;incoterm:string|null;quantity:number|null;unit:string|null;buy_price:number|null;sell_price:number|null;profit:number|null;
 etd:string|null;eta:string|null;container_no:string|null;bl_no:string|null;created_at:string;updated_at:string;
 customers?:{company_name:string;status:string}|null;suppliers?:{company_name:string;status:string;kyc_status:string|null;kyc_expiry_date:string|null;rating:number|null}|null;profiles?:{full_name:string}|null;quotations?:{quotation_no:string|null;title:string|null;status:string|null}|null;
 readiness?:DealReadiness;operational?:DealOperational;
};
export type DealEvent={id:string;deal_id:string;event_type:string;from_value:string|null;to_value:string|null;reason:string|null;metadata:Record<string,unknown>;performed_by:string|null;created_at:string;profiles?:{full_name:string}|null};
export type DealPermissions={role:string;canWrite:boolean;canApprove:boolean};
export type NewDealInput={customer_id:string;supplier_id:string|null;commodity:string;origin_country:string;destination_country:string;incoterm:string;quantity:number;unit:string;buy_currency:string;sell_currency:string;buy_price:number;sell_price:number;buy_rate:number|null;sell_rate:number|null;etd:string|null;eta:string|null;notes:string};

const s=()=>createClient();
const n=(v:unknown)=>Number(v??0);

export async function getDealPermissions():Promise<DealPermissions>{
 const c=s(); const[{data:roleData,error:r1},{data:approveData,error:r2}]=await Promise.all([c.rpc("deal_current_role"),c.rpc("deal_can_approve")]);
 if(r1)throw r1;if(r2)throw r2;const role=String(roleData??"unknown");return{role,canWrite:["admin","ceo","manager","dealer"].includes(role),canApprove:Boolean(approveData)};
}

export async function getDealRows():Promise<DealRow[]>{
 const c=s(); const{data,error}=await c.from("deals").select("*,customers(company_name,status),suppliers(company_name,status,kyc_status,kyc_expiry_date,rating),profiles:dealer_id(full_name),quotations(quotation_no,title,status)").order("created_at",{ascending:false});
 if(error)throw error;const rows=(data??[]) as DealRow[];
 await Promise.all(rows.map(async d=>{const[r,o]=await Promise.all([c.rpc("deal_readiness_v1",{p_deal_id:d.id}),c.rpc("deal_operational_snapshot_v1",{p_deal_id:d.id})]);if(!r.error)d.readiness=r.data as DealReadiness;if(!o.error)d.operational=o.data as DealOperational;}));
 return rows;
}

export async function getDealEvents(dealId:string):Promise<DealEvent[]>{const c=s();const{data,error}=await c.from("deal_events").select("*,profiles:performed_by(full_name)").eq("deal_id",dealId).order("created_at",{ascending:false});if(error)throw error;return(data??[]) as DealEvent[]}

export async function submitDeal(dealId:string,reason?:string){const{data,error}=await s().rpc("deal_submit_review_v1",{p_deal_id:dealId,p_reason:reason||null});if(error)throw error;return data}
export async function decideDeal(dealId:string,decision:"approved"|"rejected",comments?:string){const{data,error}=await s().rpc("deal_decide_v1",{p_deal_id:dealId,p_decision:decision,p_comments:comments||null});if(error)throw error;return data}
export async function cancelDeal(dealId:string,reason:string){const{data,error}=await s().rpc("deal_cancel_v1",{p_deal_id:dealId,p_reason:reason});if(error)throw error;return data}
export async function completeDeal(dealId:string,reason?:string){const{data,error}=await s().rpc("deal_complete_v1",{p_deal_id:dealId,p_reason:reason||null});if(error)throw error;return data}
export async function reopenDeal(dealId:string,reason:string){const{data,error}=await s().rpc("deal_reopen_v1",{p_deal_id:dealId,p_reason:reason});if(error)throw error;return data}
export async function assignDealOwner(dealId:string,ownerId:string,reason?:string){const{data,error}=await s().rpc("deal_assign_owner_v1",{p_deal_id:dealId,p_owner_id:ownerId,p_reason:reason||null});if(error)throw error;return data}
export async function createShipmentFromDeal(dealId:string,mode:string){const{data,error}=await s().rpc("deal_create_shipment_v1",{p_deal_id:dealId,p_mode:mode});if(error)throw error;return data}
export async function deleteDealControlled(dealId:string,reason:string){const{data,error}=await s().rpc("deal_delete_v1",{p_deal_id:dealId,p_reason:reason});if(error)throw error;return Boolean(data)}

export async function getDealFormLookups(){
 const c=s();const[cust,supp,prof]=await Promise.all([
  c.from("customers").select("id,company_name,status,customer_type").eq("status","active").order("company_name"),
  c.from("suppliers").select("id,company_name,status,kyc_status,kyc_expiry_date,rating").order("company_name"),
  c.from("profiles").select("id,full_name,role,active").eq("active",true).order("full_name")
 ]); if(cust.error)throw cust.error;if(supp.error)throw supp.error;if(prof.error)throw prof.error;
 return{customers:(cust.data??[]).filter((x:any)=>["customer","both"].includes(x.customer_type)),suppliers:supp.data??[],profiles:prof.data??[]};
}

export async function createDealControlled(v:NewDealInput){
 const c=s();const{data:{user},error:uErr}=await c.auth.getUser();if(uErr||!user)throw new Error("Authentication required.");
 if(!v.customer_id)throw new Error("Customer is required.");if(!v.commodity.trim())throw new Error("Commodity is required.");if(n(v.quantity)<=0)throw new Error("Quantity must be greater than zero.");
 if(n(v.buy_price)<0||n(v.sell_price)<0)throw new Error("Prices cannot be negative.");
 const cross=v.buy_currency!==v.sell_currency;if(cross&&(n(v.buy_rate)<=0||n(v.sell_rate)<=0))throw new Error("AED conversion rates are required when buy and sell currencies differ.");
 const qty=n(v.quantity),buy=n(v.buy_price),sell=n(v.sell_price),amount=qty*sell;const nativeProfit=cross?null:qty*(sell-buy);const profitAed=cross?qty*((sell*n(v.sell_rate))-(buy*n(v.buy_rate))):v.sell_currency==="AED"?Number(nativeProfit??0):(n(v.sell_rate)>0?Number(nativeProfit??0)*n(v.sell_rate):0);
 if((nativeProfit??profitAed)<0)throw new Error("Negative gross profit is not permitted.");
 const no=`VTC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(Date.now()).slice(-6)}`;
 const payload={deal_no:no,customer_id:v.customer_id,supplier_id:v.supplier_id||null,dealer_id:user.id,buy_currency:v.buy_currency,sell_currency:v.sell_currency,amount,buy_rate:v.buy_rate||null,sell_rate:v.sell_rate||null,buy_price:buy,sell_price:sell,profit:nativeProfit,profit_aed:profitAed,commodity:v.commodity.trim(),origin_country:v.origin_country.trim()||null,destination_country:v.destination_country.trim()||null,incoterm:v.incoterm.trim()||null,quantity:qty,unit:v.unit.trim(),etd:v.etd||null,eta:v.eta||null,notes:v.notes.trim()||null};
 const{data,error}=await c.from("deals").insert(payload).select("*").single();if(error)throw error;return data as DealRow;
}
