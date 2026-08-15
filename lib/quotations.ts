import { createClient } from "@/lib/supabase/client";

export type QuoteLine={id?:string;description:string;qty:number;unit:string;cost:number;sell:number};
export type QuotePayload={id?:string;quotation_no:string|null;quotation_type:"trading"|"logistics";customer_id:string|null;supplier_id:string|null;opportunity_id:string|null;title:string;contact_person:string;currency:string;valid_until:string|null;incoterm:string;payment_terms:string;origin:string;destination:string;mode:string;commodity:string;hs_code:string;packing_details:string;gross_weight:string;volume_details:string;notes:string;status:string;lines:QuoteLine[]};

export async function listQuotationWorkspace(){
  const s=createClient();
  const[q,c,sup,o]=await Promise.all([
    s.from("quotations").select("*,customers(company_name),suppliers(company_name),opportunities(opportunity_no,title),quotation_items(*)").order("created_at",{ascending:false}),
    s.from("customers").select("id,company_name,contact_person,status").order("company_name"),
    s.from("suppliers").select("id,company_name,status,kyc_status").order("company_name"),
    s.from("opportunities").select("id,opportunity_no,title,customer_id,stage").order("created_at",{ascending:false})
  ]);
  for(const r of[q,c,sup,o])if(r.error)throw r.error;
  return{quotations:q.data??[],customers:c.data??[],suppliers:sup.data??[],opportunities:o.data??[]};
}

export async function saveQuotation(p:QuotePayload){
  const s=createClient();
  const{data:{user},error:authError}=await s.auth.getUser();
  if(authError)throw authError;
  if(!user)throw new Error("Authentication required");

  const quotationNo=(p.quotation_no??"").trim();
  if(p.status!=="draft"&&!quotationNo)throw new Error("Enter a quotation number before moving the quotation out of Draft status.");

  const payload={
    ...p,
    quotation_no:quotationNo||null,
    customer_id:p.customer_id||null,
    supplier_id:p.supplier_id||null,
    opportunity_id:p.opportunity_id||null,
    title:(p.title||"").trim()||"Untitled quotation",
    lines:(p.lines??[]).map(x=>({
      description:(x.description||"").trim(),
      qty:Number.isFinite(Number(x.qty))?Number(x.qty):1,
      unit:(x.unit||"Unit").trim()||"Unit",
      cost:Number.isFinite(Number(x.cost))?Number(x.cost):0,
      sell:Number.isFinite(Number(x.sell))?Number(x.sell):0,
    }))
  };

  const{data,error}=await s.rpc("save_quotation_v2",{p_payload:payload});
  if(error){
    if(error.code==="23505"||/already in use|duplicate/i.test(error.message||""))throw new Error(`Quotation number ${quotationNo} is already in use.`);
    throw new Error(error.message||"Unable to save quotation");
  }
  if(!data?.id)throw new Error("Quotation save did not return a valid record.");
  return data;
}

export async function updateQuotationStatus(id:string,status:string){
  const s=createClient();
  if(status!=="draft"){
    const{data,error}=await s.from("quotations").select("quotation_no").eq("id",id).single();
    if(error)throw error;
    if(!data?.quotation_no)throw new Error("Enter a quotation number before moving the quotation out of Draft status.");
  }
  const{error}=await s.from("quotations").update({status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error)throw error;
}

export async function deleteQuotation(id:string){
  const s=createClient();
  const{error}=await s.from("quotations").delete().eq("id",id);
  if(error)throw error;
}
