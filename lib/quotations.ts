import { createClient } from "@/lib/supabase/client";

export type QuoteLine={id?:string;description:string;qty:number;unit:string;cost:number;sell:number};
export type QuotePayload={id?:string;quotation_no:string|null;quotation_type:"trading"|"logistics";customer_id:string|null;supplier_id:string|null;opportunity_id:string|null;title:string;contact_person:string;currency:string;valid_until:string|null;incoterm:string;payment_terms:string;origin:string;destination:string;mode:string;commodity:string;hs_code:string;packing_details:string;gross_weight:string;volume_details:string;notes:string;status:string;lines:QuoteLine[]};

export async function listQuotationWorkspace(){
  const s=createClient();
  const[q,c,sup,o]=await Promise.all([
    s.from("quotations").select("*,customers(company_name,status),suppliers(company_name,status,kyc_status,kyc_expiry_date),opportunities(opportunity_no,title),quotation_items(*),deals(id,deal_no,status)").order("created_at",{ascending:false}),
    s.from("customers").select("id,company_name,contact_person,status,customer_type").order("company_name"),
    s.from("suppliers").select("id,company_name,status,kyc_status,kyc_expiry_date").order("company_name"),
    s.from("opportunities").select("id,opportunity_no,title,customer_id,stage,quotation_id").order("created_at",{ascending:false})
  ]);
  for(const r of[q,c,sup,o])if(r.error)throw r.error;
  return{quotations:q.data??[],customers:c.data??[],suppliers:sup.data??[],opportunities:o.data??[]};
}

function quoteError(error:any,quotationNo:string){
  if(error?.code==="23505"||/already in use|duplicate/i.test(error?.message||""))return new Error(`Quotation number ${quotationNo} is already in use.`);
  if(/jwt|session|authentication|not authenticated|not logged in/i.test(`${error?.message||""} ${error?.details||""}`))return new Error("Your session is no longer valid. Please sign in again and retry.");
  const detail=[error?.message,error?.details,error?.hint].filter(Boolean).join(" · ");
  return new Error(detail||"Unable to save quotation.");
}

function cleanLines(lines:QuoteLine[]){
  return (lines??[]).map(x=>({
    description:(x.description||"").trim(),
    qty:Number.isFinite(Number(x.qty))?Number(x.qty):1,
    unit:(x.unit||"Unit").trim()||"Unit",
    cost:Number.isFinite(Number(x.cost))?Number(x.cost):0,
    sell:Number.isFinite(Number(x.sell))?Number(x.sell):0
  }));
}

export async function saveQuotation(p:QuotePayload){
  const s=createClient();
  const quotationNo=(p.quotation_no??"").trim();

  const{data:userData,error:userError}=await s.auth.getUser();
  if(userError||!userData.user)throw quoteError(userError??new Error("Not authenticated"),quotationNo);

  const lines=cleanLines(p.lines);
  if(lines.some(x=>x.qty<0||x.cost<0||x.sell<0))throw new Error("Quotation quantities and rates cannot be negative.");

  const payload={
    ...p,
    id:p.id||"",
    quotation_no:quotationNo||null,
    customer_id:p.customer_id||null,
    supplier_id:p.supplier_id||null,
    opportunity_id:p.opportunity_id||null,
    title:(p.title||"").trim()||"Untitled quotation",
    lines
  };

  const{data,error}=await s.rpc("save_quotation_v4",{p_payload:payload});
  if(error)throw quoteError(error,quotationNo);
  if(!data?.id)throw new Error("Quotation save completed without returning a valid record.");

  // Do not trust a success toast alone. Re-read the record and its lines from the database.
  const{data:persisted,error:verifyError}=await s
    .from("quotations")
    .select("*,quotation_items(*)")
    .eq("id",data.id)
    .single();
  if(verifyError)throw quoteError(verifyError,quotationNo);
  if(!persisted?.id)throw new Error("Quotation was not found after save. The save has not been confirmed.");

  const expectedLines=lines.filter(x=>x.description.length>0).length;
  const persistedLines=Array.isArray(persisted.quotation_items)?persisted.quotation_items.length:0;
  if(persistedLines!==expectedLines)throw new Error(`Quotation header was saved but line verification failed (${persistedLines}/${expectedLines}).`);

  return persisted;
}

export async function updateQuotationStatus(_id?:string,_status?:string){throw new Error("Quotation status is controlled by Commercial Flow. Use Submit / Approve / Reject actions.")}
export async function deleteQuotation(id:string){const s=createClient();const{error}=await s.from("quotations").delete().eq("id",id);if(error)throw error}
