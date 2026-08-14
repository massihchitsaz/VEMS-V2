import { createClient } from "@/lib/supabase/client";

export type TrackingShipment = any;

export async function getTrackingWorkspace(){
  const s=createClient();
  const [shipments,units,events,milestones]=await Promise.all([
    s.from("shipments").select("id,shipment_no,mode,status,priority,risk_level,exception_status,origin,destination,pol,pod,carrier,booking_no,container_no,bl_no,awb_no,vessel_name,voyage_no,flight_no,etd,eta,cargo_description,customs_status,last_tracking_at,customer:customers(company_name),owner:profiles(full_name)").order("created_at",{ascending:false}),
    s.from("shipment_units").select("*").order("created_at",{ascending:true}),
    s.from("shipment_events").select("*").order("event_time",{ascending:false}),
    s.from("shipment_milestones").select("*").order("sequence_no",{ascending:true}),
  ]);
  for(const r of [shipments,units,events,milestones]) if(r.error) throw r.error;
  return {shipments:shipments.data??[],units:units.data??[],events:events.data??[],milestones:milestones.data??[]};
}

export async function addTrackingEvent(input:any){
  const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
  const payload={shipment_id:input.shipment_id,unit_id:input.unit_id||null,event_type:input.event_type,event_time:input.event_time||new Date().toISOString(),location:input.location||null,source:input.source||"manual",reference_no:input.reference_no||null,details:input.details||null,is_exception:!!input.is_exception,severity:input.severity||"info",created_by:user.id};
  const {data,error}=await s.from("shipment_events").insert(payload).select().single(); if(error) throw error;
  const shipPatch:any={last_tracking_at:payload.event_time,updated_at:new Date().toISOString()};
  if(input.shipment_status) shipPatch.status=input.shipment_status;
  if(input.eta) shipPatch.eta=input.eta;
  if(input.is_exception){shipPatch.exception_status=input.severity==="critical"?"escalated":"watch";shipPatch.risk_level=input.severity==="critical"?"critical":"watch"}
  const shipUpdate=await s.from("shipments").update(shipPatch).eq("id",input.shipment_id); if(shipUpdate.error) throw shipUpdate.error;
  if(input.unit_id){const p:any={last_event_at:payload.event_time}; if(input.location)p.current_location=input.location;if(input.unit_status)p.status=input.unit_status;const u=await s.from("shipment_units").update(p).eq("id",input.unit_id);if(u.error)throw u.error}
  return data;
}

export async function updateTrackingUnit(id:string,patch:any){const s=createClient();const{error}=await s.from("shipment_units").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error}
export async function updateShipmentTracking(id:string,patch:any){const s=createClient();const{error}=await s.from("shipments").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error}

export async function resolveShipmentException(shipmentId:string,note:string){
 const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user) throw new Error("Authentication required");
 const now=new Date().toISOString();
 const u=await s.from("shipments").update({exception_status:"clear",risk_level:"normal",updated_at:now}).eq("id",shipmentId);if(u.error)throw u.error;
 const e=await s.from("shipment_events").insert({shipment_id:shipmentId,event_type:"exception_resolved",event_time:now,source:"manual",details:note||"Exception resolved",is_exception:false,severity:"success",created_by:user.id});if(e.error)throw e.error;
}
