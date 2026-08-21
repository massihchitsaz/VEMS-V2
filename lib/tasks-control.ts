import { createClient } from "@/lib/supabase/client";

export type TaskInput={title:string;description?:string;entity_type?:string;entity_id?:string;assigned_to?:string;priority:string;status:string;due_at?:string};
const db=()=>createClient();

async function userId(){const s=db();const{data,error}=await s.auth.getSession();if(error||!data.session?.user?.id)throw new Error("Your session is not available. Please sign in again and retry.");return data.session.user.id}

export async function getTaskWorkspace(){const s=db();const[t,u]=await Promise.all([s.from("tasks").select("*,profiles:assigned_to(full_name)").order("created_at",{ascending:false}),s.from("profiles").select("id,full_name,email").eq("active",true).order("full_name")]);if(t.error)throw t.error;if(u.error)throw u.error;return{tasks:t.data??[],users:u.data??[]}}

export async function saveTask(input:TaskInput,id?:string){const s=db();const payload:any={title:input.title.trim(),description:input.description?.trim()||null,entity_type:input.entity_type||null,entity_id:input.entity_id?.trim()||null,assigned_to:input.assigned_to||null,priority:input.priority||"medium",status:input.status||"open",due_at:input.due_at?new Date(input.due_at).toISOString():null,completed_at:input.status==="done"?new Date().toISOString():null,updated_at:new Date().toISOString()};if(!payload.title)throw new Error("Task title is required.");if(id){const{data,error}=await s.from("tasks").update(payload).eq("id",id).select("id").single();if(error)throw error;if(!data?.id)throw new Error("Task update did not affect a record.");return data}const createdBy=await userId();const{data,error}=await s.from("tasks").insert({...payload,created_by:createdBy}).select("id").single();if(error)throw error;if(!data?.id)throw new Error("Task save did not return a valid record.");return data}

export async function setTaskStatus(id:string,status:string){const s=db();const patch={status,completed_at:status==="done"?new Date().toISOString():null,updated_at:new Date().toISOString()};const{data,error}=await s.from("tasks").update(patch).eq("id",id).select("id").single();if(error)throw error;if(!data?.id)throw new Error("Task status update did not affect a record.")}

export async function deleteTask(id:string){const{data,error}=await db().from("tasks").delete().eq("id",id).select("id").single();if(error)throw error;if(!data?.id)throw new Error("Task delete did not affect a record.")}
