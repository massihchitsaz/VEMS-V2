import { createClient } from "@/lib/supabase/client";

export async function getTreasurySnapshot(){
  const s=createClient();
  const [invoices,payments,fxDeals,fxSettlements,fxApprovals,profiles]=await Promise.all([
    s.from("invoices").select("*,customers(company_name),suppliers(company_name)").order("due_date",{ascending:true}),
    s.from("payments").select("*,customers(company_name),suppliers(company_name),invoices(invoice_no)").order("created_at",{ascending:false}),
    s.from("fx_deals").select("*,profiles:dealer_id(full_name),approver:approved_by(full_name)").order("created_at",{ascending:false}),
    s.from("fx_settlements").select("*").order("created_at",{ascending:false}),
    s.from("fx_approvals").select("*,profiles:approver_id(full_name),fx_deals(deal_no,counterparty_name,base_currency,quote_currency,base_amount)").order("created_at",{ascending:false}),
    s.from("profiles").select("id,full_name,role,active").eq("active",true).order("full_name")
  ]);
  for(const r of [invoices,payments,fxDeals,fxSettlements,fxApprovals,profiles]) if(r.error) throw r.error;
  return {invoices:invoices.data??[],payments:payments.data??[],fxDeals:fxDeals.data??[],fxSettlements:fxSettlements.data??[],fxApprovals:fxApprovals.data??[],profiles:profiles.data??[]};
}

export async function updatePayment(id:string,patch:Record<string,unknown>){
  const s=createClient();
  const {error}=await s.from("payments").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);
  if(error) throw error;
}

export async function updateInvoice(id:string,patch:Record<string,unknown>){
  const s=createClient();
  const {error}=await s.from("invoices").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);
  if(error) throw error;
}

export async function updateFxDeal(id:string,patch:Record<string,unknown>){
  const s=createClient();
  const {error}=await s.from("fx_deals").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);
  if(error) throw error;
}
