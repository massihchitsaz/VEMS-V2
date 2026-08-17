import { createClient } from "@/lib/supabase/client";

const s=()=>createClient();
export async function getPayablesControlData(){const{data,error}=await s().rpc("finance_payables_snapshot_v2");if(error)throw error;return data}
export async function createPayableV2(payload:any,issue=false){const{data,error}=await s().rpc("finance_create_payable_v2",{p_payload:payload,p_issue:issue});if(error)throw error;return data}
export async function issuePayableV2(id:string,dueDate?:string|null){const{data,error}=await s().rpc("finance_issue_invoice_v1",{p_invoice_id:id,p_due_date:dueDate||null});if(error)throw error;return data}
export async function decidePayableV2(id:string,decision:"approved"|"rejected",comments?:string|null){const{data,error}=await s().rpc("finance_decide_payable_v2",{p_invoice_id:id,p_decision:decision,p_comments:comments||null});if(error)throw error;return data}
export async function setPayableControlV2(id:string,input:any){const{data,error}=await s().rpc("finance_set_payable_control_v2",{p_invoice_id:id,p_priority:input.priority||null,p_payment_hold:typeof input.payment_hold==="boolean"?input.payment_hold:null,p_scheduled_date:input.scheduled_date||null,p_owner_id:input.owner_id||null,p_payment_terms:input.payment_terms||null,p_reason:input.reason||null});if(error)throw error;return data}
export async function addPayableActivityV2(payload:any){const{data,error}=await s().rpc("finance_add_payable_activity_v2",{p_payload:payload});if(error)throw error;return data}
export async function setPayableDisputeV2(id:string,status:"clear"|"disputed"|"resolved",reason?:string|null){const{data,error}=await s().rpc("finance_set_invoice_dispute_v1",{p_invoice_id:id,p_status:status,p_reason:reason||null});if(error)throw error;return data}
export async function createPayablePaymentV2(id:string,payload:any){const{data,error}=await s().rpc("finance_create_payable_payment_v2",{p_invoice_id:id,p_payload:payload});if(error)throw error;return data}
export async function allocatePaymentV2(invoiceId:string,paymentId:string,amount:number,notes?:string|null){const{data,error}=await s().rpc("finance_allocate_payment_v2",{p_invoice_id:invoiceId,p_payment_id:paymentId,p_amount:amount,p_notes:notes||null});if(error)throw error;return data}
export async function approvePaymentV2(id:string,comments?:string|null){const{data,error}=await s().rpc("finance_approve_payment_v1",{p_payment_id:id,p_comments:comments||null});if(error)throw error;return data}
export async function settlePaymentV2(id:string,outcome:"completed"|"failed",reference?:string|null,reason?:string|null){const{data,error}=await s().rpc("finance_settle_payment_v1",{p_payment_id:id,p_outcome:outcome,p_reference:reference||null,p_reason:reason||null});if(error)throw error;return data}
export async function cancelPaymentV2(id:string,reason:string){const{data,error}=await s().rpc("finance_cancel_payment_v1",{p_payment_id:id,p_reason:reason});if(error)throw error;return data}
export async function cancelPayableV2(id:string,reason:string){const{data,error}=await s().rpc("finance_cancel_invoice_v1",{p_invoice_id:id,p_reason:reason});if(error)throw error;return data}
