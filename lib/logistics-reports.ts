import { createClient } from "@/lib/supabase/client";

export async function getLogisticsReportData(){
  const s=createClient();
  const [shipments,charges,events,milestones,units]=await Promise.all([
    s.from("shipments").select("id,shipment_no,customer_id,mode,status,origin,destination,port_of_loading,port_of_discharge,carrier,etd,eta,actual_delivery_date,cargo_description,weight_kg,volume_cbm,cost,currency,customs_status,risk_level,exception_status,last_tracking_at,created_at,customer:customers(company_name)").order("created_at",{ascending:false}),
    s.from("shipment_charges").select("id,shipment_id,charge_type,currency,estimated_amount,actual_amount,billable_amount,status,vendor:suppliers(company_name)"),
    s.from("shipment_events").select("id,shipment_id,event_type,event_time,location,is_exception,severity,details").order("event_time",{ascending:false}),
    s.from("shipment_milestones").select("id,shipment_id,milestone_type,title,planned_at,actual_at,status,location").order("sequence_no",{ascending:true}),
    s.from("shipment_units").select("id,shipment_id,unit_type,unit_no,equipment_type,status,current_location,last_event_at")
  ]);
  for(const r of [shipments,charges,events,milestones,units]) if(r.error) throw r.error;
  return {shipments:shipments.data??[],charges:charges.data??[],events:events.data??[],milestones:milestones.data??[],units:units.data??[]};
}
