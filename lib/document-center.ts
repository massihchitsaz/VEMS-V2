import { createClient } from "@/lib/supabase/client";

export type DocumentRecord = {
  id:string; entity_type:string; entity_id:string|null; document_type:string|null; file_name:string; storage_path:string;
  mime_type:string|null; file_size:number|null; uploaded_by:string|null; created_at:string|null; title:string|null; reference_no:string|null;
  module:string|null; category:string|null; status:string|null; version:number|null; effective_date:string|null; expiry_date:string|null;
  is_required:boolean|null; confidentiality:string|null; notes:string|null; approved_by:string|null; approved_at:string|null; updated_at:string|null;
  parent_document_id:string|null; uploader?:{full_name?:string|null}|null; approver?:{full_name?:string|null}|null;
};

export type LinkOption={id:string;label:string};

export async function getDocumentCenter(){
  const s=createClient();
  const [docs,shipments,deals,quotes,customers,suppliers,profiles]=await Promise.all([
    s.from("documents").select("*,uploader:uploaded_by(full_name),approver:approved_by(full_name)").order("updated_at",{ascending:false}),
    s.from("shipments").select("id,shipment_no").order("created_at",{ascending:false}),
    s.from("deals").select("id,deal_no").order("created_at",{ascending:false}),
    s.from("quotations").select("id,quotation_no").order("created_at",{ascending:false}),
    s.from("customers").select("id,company_name").order("company_name"),
    s.from("suppliers").select("id,company_name").order("company_name"),
    s.from("profiles").select("id,full_name").eq("active",true).order("full_name")
  ]);
  const failed=[docs,shipments,deals,quotes,customers,suppliers,profiles].find((x:any)=>x.error) as any;if(failed?.error)throw failed.error;
  return {
    documents:(docs.data??[]) as unknown as DocumentRecord[],
    links:{
      shipment:(shipments.data??[]).map((x:any)=>({id:x.id,label:x.shipment_no})),
      deal:(deals.data??[]).map((x:any)=>({id:x.id,label:x.deal_no})),
      quotation:(quotes.data??[]).map((x:any)=>({id:x.id,label:x.quotation_no})),
      customer:(customers.data??[]).map((x:any)=>({id:x.id,label:x.company_name})),
      supplier:(suppliers.data??[]).map((x:any)=>({id:x.id,label:x.company_name}))
    } as Record<string,LinkOption[]>,
    profiles:(profiles.data??[]).map((x:any)=>({id:x.id,label:x.full_name})) as LinkOption[]
  };
}

export async function registerDocument(input:any,file:File){
  const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`${input.entity_type||"general"}/${input.entity_id||"unlinked"}/${crypto.randomUUID()}-${safe}`;
  const up=await s.storage.from("vtc-documents").upload(path,file,{upsert:false,contentType:file.type||undefined});if(up.error)throw up.error;
  const payload={...input,file_name:file.name,storage_path:path,mime_type:file.type||null,file_size:file.size,uploaded_by:user.id,version:Number(input.version||1),updated_at:new Date().toISOString()};
  const{data,error}=await s.from("documents").insert(payload).select().single();if(error){await s.storage.from("vtc-documents").remove([path]);throw error}
  await s.from("document_activity").insert({document_id:data.id,action:"uploaded",comments:`Version ${payload.version}`,actor_id:user.id});return data;
}

export async function updateDocument(id:string,patch:any,activity?:string){
  const s=createClient();const{data:{user}}=await s.auth.getUser();if(!user)throw new Error("Authentication required");
  const p={...patch,updated_at:new Date().toISOString()};if(p.status==="approved"){p.approved_by=user.id;p.approved_at=new Date().toISOString()}if(p.status&&p.status!=="approved"){p.approved_by=null;p.approved_at=null}
  const{data,error}=await s.from("documents").update(p).eq("id",id).select().single();if(error)throw error;
  if(activity)await s.from("document_activity").insert({document_id:id,action:activity,comments:patch.notes??null,actor_id:user.id});return data;
}

export async function uploadNewVersion(parent:DocumentRecord,file:File,notes?:string){
  if(!parent.id)throw new Error("Document not found");
  const next=Number(parent.version??1)+1;
  const data=await registerDocument({entity_type:parent.entity_type,entity_id:parent.entity_id,document_type:parent.document_type,title:parent.title,reference_no:parent.reference_no,module:parent.module,category:parent.category,status:"draft",version:next,effective_date:parent.effective_date,expiry_date:parent.expiry_date,is_required:parent.is_required,confidentiality:parent.confidentiality,notes:notes??parent.notes,parent_document_id:parent.id},file);
  await updateDocument(parent.id,{status:"superseded"},"superseded");return data;
}

export async function openDocument(path:string){const s=createClient();const{data,error}=await s.storage.from("vtc-documents").createSignedUrl(path,300);if(error)throw error;window.open(data.signedUrl,"_blank","noopener,noreferrer")}
export async function downloadDocument(path:string,fileName:string){const s=createClient();const{data,error}=await s.storage.from("vtc-documents").download(path);if(error)throw error;const url=URL.createObjectURL(data);const a=document.createElement("a");a.href=url;a.download=fileName;a.click();URL.revokeObjectURL(url)}
export async function deleteDocument(doc:DocumentRecord){const s=createClient();if(doc.status==="approved")throw new Error("Approved documents cannot be deleted. Supersede or cancel them instead.");const{error}=await s.from("documents").delete().eq("id",doc.id);if(error)throw error;await s.storage.from("vtc-documents").remove([doc.storage_path])}
export async function getDocumentActivity(documentId:string){const s=createClient();const{data,error}=await s.from("document_activity").select("*,actor:actor_id(full_name)").eq("document_id",documentId).order("created_at",{ascending:false});if(error)throw error;return data??[]}
