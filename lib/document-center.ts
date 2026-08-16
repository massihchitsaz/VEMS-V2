import { createClient } from "@/lib/supabase/client";

export type DocumentRecord = {
  id:string; entity_type:string; entity_id:string|null; document_type:string|null; file_name:string; storage_path:string;
  mime_type:string|null; file_size:number|null; uploaded_by:string|null; created_at:string|null; title:string|null; reference_no:string|null;
  module:string|null; category:string|null; status:string|null; version:number|null; effective_date:string|null; expiry_date:string|null;
  is_required:boolean|null; confidentiality:string|null; notes:string|null; approved_by:string|null; approved_at:string|null; updated_at:string|null;
  parent_document_id:string|null; uploader?:{full_name?:string|null}|null; approver?:{full_name?:string|null}|null;
};

export type LinkOption={id:string;label:string};
export type DocumentAccess={role:string;canWrite:boolean;canApprove:boolean};

const allowedMime = new Set([
  "application/pdf","image/jpeg","image/png","image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "message/rfc822","application/octet-stream"
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function clean(v:any){return v === "" ? null : v;}
function pick(input:any,fields:string[]){const out:Record<string,any>={};for(const k of fields)if(Object.prototype.hasOwnProperty.call(input,k))out[k]=clean(input[k]);return out;}

export async function getDocumentAccess():Promise<DocumentAccess>{
  const s=createClient();
  const [{data:role,error:rErr},{data:write,error:wErr},{data:approve,error:aErr}]=await Promise.all([
    s.rpc("document_current_role"),s.rpc("document_can_write"),s.rpc("document_can_approve")
  ]);
  if(rErr)throw rErr;if(wErr)throw wErr;if(aErr)throw aErr;
  return {role:String(role||"dealer"),canWrite:!!write,canApprove:!!approve};
}

export async function getDocumentCenter(){
  const s=createClient();
  const [docs,shipments,deals,quotes,customers,suppliers,profiles,approvals]=await Promise.all([
    s.from("documents").select("*,uploader:uploaded_by(full_name),approver:approved_by(full_name)").order("updated_at",{ascending:false}),
    s.from("shipments").select("id,shipment_no").order("created_at",{ascending:false}),
    s.from("deals").select("id,deal_no").order("created_at",{ascending:false}),
    s.from("quotations").select("id,quotation_no").order("created_at",{ascending:false}),
    s.from("customers").select("id,company_name").order("company_name"),
    s.from("suppliers").select("id,company_name").order("company_name"),
    s.from("profiles").select("id,full_name,role").eq("active",true).order("full_name"),
    s.from("approvals").select("*,requester:requested_by(full_name),approver:approver_id(full_name,role)").eq("entity_type","document").order("requested_at",{ascending:false})
  ]);
  const failed=[docs,shipments,deals,quotes,customers,suppliers,profiles,approvals].find((x:any)=>x.error) as any;if(failed?.error)throw failed.error;
  return {
    documents:(docs.data??[]) as unknown as DocumentRecord[],
    links:{
      shipment:(shipments.data??[]).map((x:any)=>({id:x.id,label:x.shipment_no})),
      deal:(deals.data??[]).map((x:any)=>({id:x.id,label:x.deal_no})),
      quotation:(quotes.data??[]).map((x:any)=>({id:x.id,label:x.quotation_no})),
      customer:(customers.data??[]).map((x:any)=>({id:x.id,label:x.company_name})),
      supplier:(suppliers.data??[]).map((x:any)=>({id:x.id,label:x.company_name}))
    } as Record<string,LinkOption[]>,
    profiles:(profiles.data??[]).map((x:any)=>({id:x.id,label:x.full_name,role:x.role})),
    approvers:(profiles.data??[]).filter((x:any)=>["admin","ceo","manager"].includes(String(x.role))).map((x:any)=>({id:x.id,label:x.full_name,role:x.role})),
    approvals:approvals.data??[]
  };
}

function validateFile(file:File){
  if(!file)throw new Error("Select a file to upload.");
  if(file.size<=0)throw new Error("The selected file is empty.");
  if(file.size>MAX_FILE_SIZE)throw new Error("Maximum document size is 50 MB.");
  const mime=file.type||"application/octet-stream";
  if(!allowedMime.has(mime))throw new Error(`File type ${mime} is not allowed.`);
}

const documentFields=["entity_type","entity_id","document_type","title","reference_no","module","category","effective_date","expiry_date","is_required","confidentiality","notes","parent_document_id"];

export async function registerDocument(input:any,file:File){
  validateFile(file);
  const s=createClient();const access=await getDocumentAccess();if(!access.canWrite)throw new Error(`Role ${access.role} has read-only document access.`);
  const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");
  if(!String(input.title||"").trim())throw new Error("Document title is required.");
  if(!String(input.document_type||"").trim())throw new Error("Document type is required.");
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=`${input.entity_type||"general"}/${input.entity_id||"unlinked"}/${crypto.randomUUID()}-${safe}`;
  const up=await s.storage.from("vtc-documents").upload(path,file,{upsert:false,contentType:file.type||undefined});if(up.error)throw up.error;
  const payload={...pick(input,documentFields),status:"draft",file_name:file.name,storage_path:path,mime_type:file.type||"application/octet-stream",file_size:file.size,uploaded_by:user.id,version:Number(input.version||1),updated_at:new Date().toISOString()};
  const{data,error}=await s.from("documents").insert(payload).select().single();
  if(error){await s.storage.from("vtc-documents").remove([path]);throw error;}
  const act=await s.from("document_activity").insert({document_id:data.id,action:"uploaded",comments:`Version ${payload.version}`,actor_id:user.id});
  if(act.error)throw act.error;
  return data;
}

export async function updateDocumentMetadata(id:string,patch:any){
  const s=createClient();const access=await getDocumentAccess();if(!access.canWrite)throw new Error(`Role ${access.role} has read-only document access.`);
  const allowed=["title","reference_no","document_type","entity_type","entity_id","module","category","effective_date","expiry_date","is_required","confidentiality","notes"];
  const payload={...pick(patch,allowed),updated_at:new Date().toISOString()};
  const{data,error}=await s.from("documents").update(payload).eq("id",id).select().single();if(error)throw error;
  const{data:{user}}=await s.auth.getUser();
  if(user){const a=await s.from("document_activity").insert({document_id:id,action:"metadata_updated",comments:"Controlled metadata updated",actor_id:user.id});if(a.error)throw a.error;}
  return data;
}

export async function submitDocumentForReview(documentId:string,approverId?:string,comments?:string){
  const s=createClient();const{data,error}=await s.rpc("document_submit_for_review_v1",{p_document_id:documentId,p_approver_id:approverId||null,p_comments:comments||null});if(error)throw error;return data;
}
export async function decideDocumentReview(documentId:string,decision:"approved"|"rejected",comments?:string){
  const s=createClient();const{data,error}=await s.rpc("document_decide_review_v1",{p_document_id:documentId,p_decision:decision,p_comments:comments||null});if(error)throw error;return data;
}
export async function cancelDocument(documentId:string,reason:string){
  const s=createClient();const{data,error}=await s.rpc("document_cancel_v1",{p_document_id:documentId,p_reason:reason});if(error)throw error;return data;
}

export async function uploadNewVersion(parent:DocumentRecord,file:File,notes?:string){
  validateFile(file);
  if(!parent.id)throw new Error("Document not found");
  if(parent.status==="cancelled")throw new Error("Cancelled documents cannot receive a new revision.");
  const next=Number(parent.version??1)+1;
  const child=await registerDocument({entity_type:parent.entity_type,entity_id:parent.entity_id,document_type:parent.document_type,title:parent.title,reference_no:parent.reference_no,module:parent.module,category:parent.category,version:next,effective_date:parent.effective_date,expiry_date:parent.expiry_date,is_required:parent.is_required,confidentiality:parent.confidentiality,notes:notes??parent.notes,parent_document_id:parent.id},file);
  const s=createClient();const{error}=await s.rpc("document_supersede_v1",{p_parent_id:parent.id,p_child_id:child.id,p_comments:notes||null});if(error)throw error;
  return child;
}

export async function openDocument(path:string){const s=createClient();const{data,error}=await s.storage.from("vtc-documents").createSignedUrl(path,300);if(error)throw error;window.open(data.signedUrl,"_blank","noopener,noreferrer")}
export async function downloadDocument(path:string,fileName:string){const s=createClient();const{data,error}=await s.storage.from("vtc-documents").download(path);if(error)throw error;const url=URL.createObjectURL(data);const a=document.createElement("a");a.href=url;a.download=fileName;a.click();URL.revokeObjectURL(url)}
export async function getDocumentActivity(documentId:string){const s=createClient();const{data,error}=await s.from("document_activity").select("*,actor:actor_id(full_name)").eq("document_id",documentId).order("created_at",{ascending:false});if(error)throw error;return data??[]}

// Compatibility exports for legacy components that still compile with the application.
// Status changes are intentionally rejected here so old UI cannot bypass controlled workflow.
export async function updateDocument(id:string,patch:any,_activity?:string){
  if(Object.prototype.hasOwnProperty.call(patch,"status"))throw new Error("Direct document status changes are disabled. Use the controlled review workflow.");
  return updateDocumentMetadata(id,patch);
}

export async function deleteDocument(doc:DocumentRecord){
  const access=await getDocumentAccess();
  if(!access.canApprove)throw new Error("Only authorized document controllers can delete records.");
  if(!["draft","rejected","cancelled"].includes(doc.status||"draft"))throw new Error("Only Draft, Rejected or Cancelled documents can be deleted.");
  const s=createClient();
  const{error}=await s.from("documents").delete().eq("id",doc.id);if(error)throw error;
  const removed=await s.storage.from("vtc-documents").remove([doc.storage_path]);if(removed.error)throw removed.error;
}
