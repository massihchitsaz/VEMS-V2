import { createClient } from "@/lib/supabase/client";

export type ShipmentOverview = {
  id:string; shipment_no:string; mode:string; status:string; priority:string|null; risk_level:string|null; exception_status:string|null;
  origin:string|null; destination:string|null; carrier:string|null; booking_no:string|null; container_no:string|null; bl_no:string|null; awb_no:string|null;
  etd:string|null; eta:string|null; cargo_description:string|null; customs_status:string|null; last_tracking_at:string|null; is_dg?:boolean|null;
  temperature_controlled?:boolean|null; vessel_name?:string|null; flight_no?:string|null; port_of_loading?:string|null; port_of_discharge?:string|null;
  weight_kg?:number|null; volume_cbm?:number|null; cost?:number|null; currency?:string|null;
  customer?:{company_name?:string|null}|null; supplier?:{company_name?:string|null}|null; owner?:{full_name?:string|null}|null;
};

export type ShippingDashboardData = {
  shipments:ShipmentOverview[]; activeCount:number; inTransitCount:number; customsCount:number; exceptionCount:number; arrivingSevenDays:number; staleTrackingCount:number;
  overdueMilestones:number; openCriticalEvents:number; dgCount:number; temperatureCount:number; bookedCount:number; planningCount:number;
  totalUnits:number; estimatedCost:number; billableAmount:number; modeBreakdown:{mode:string;count:number}[]; statusBreakdown:{status:string;count:number}[];
  upcomingMilestones:any[]; recentExceptions:any[];
};
const dateOnly=(v:Date)=>v.toISOString().slice(0,10);
export async function getShippingDashboard():Promise<ShippingDashboardData>{
 const s=createClient(),today=new Date(),seven=new Date();seven.setDate(today.getDate()+7);const stale=new Date(Date.now()-48*3600000);
 const [sr,mr,er,ur,cr]=await Promise.all([
  s.from("shipments").select("id,shipment_no,mode,status,priority,risk_level,exception_status,origin,destination,carrier,booking_no,container_no,bl_no,awb_no,etd,eta,cargo_description,customs_status,last_tracking_at,is_dg,temperature_controlled,vessel_name,flight_no,port_of_loading,port_of_discharge,weight_kg,volume_cbm,cost,currency,customer:customers(company_name),supplier:suppliers(company_name),owner:profiles(full_name)").order("created_at",{ascending:false}),
  s.from("shipment_milestones").select("id,shipment_id,title,milestone_type,status,planned_at,actual_at,location,responsible_party").order("planned_at",{ascending:true}),
  s.from("shipment_events").select("id,shipment_id,event_type,event_time,location,details,severity,is_exception").order("event_time",{ascending:false}),
  s.from("shipment_units").select("id,shipment_id,unit_type,unit_no,equipment_type,status,current_location,last_event_at"),
  s.from("shipment_charges").select("id,shipment_id,currency,estimated_amount,actual_amount,billable_amount,status")
 ]);
 for(const r of [sr,mr,er,ur,cr])if(r.error)throw r.error;
 const shipments=(sr.data??[]) as unknown as ShipmentOverview[], active=shipments.filter(x=>!["delivered","cancelled"].includes(x.status));
 const inTransit=shipments.filter(x=>["picked_up","in_transit"].includes(x.status)), customs=shipments.filter(x=>x.status==="customs"||(x.customs_status&&!["not_started","cleared","released"].includes(x.customs_status)));
 const exceptions=shipments.filter(x=>["watch","blocked","escalated"].includes(x.exception_status??"clear")||["high","critical"].includes(x.risk_level??"normal"));
 const arriving=shipments.filter(x=>x.eta&&x.eta>=dateOnly(today)&&x.eta<=dateOnly(seven)&&!["delivered","cancelled"].includes(x.status));
 const staleTracking=active.filter(x=>!x.last_tracking_at||new Date(x.last_tracking_at)<stale);
 const overdue=(mr.data??[]).filter((m:any)=>m.planned_at&&new Date(m.planned_at)<today&&!['completed','skipped','cancelled'].includes(m.status));
 const critical=(er.data??[]).filter((e:any)=>e.is_exception&&e.severity==="critical");
 const breakdown=(key:"mode"|"status")=>Object.entries(shipments.reduce((a:any,x:any)=>{const k=x[key]||"unknown";a[k]=(a[k]||0)+1;return a},{})).map(([k,v])=>({[key]:k,count:Number(v)})) as any;
 return {shipments,activeCount:active.length,inTransitCount:inTransit.length,customsCount:customs.length,exceptionCount:exceptions.length,arrivingSevenDays:arriving.length,staleTrackingCount:staleTracking.length,overdueMilestones:overdue.length,openCriticalEvents:critical.length,dgCount:active.filter(x=>x.is_dg).length,temperatureCount:active.filter(x=>x.temperature_controlled).length,bookedCount:shipments.filter(x=>x.status==="booked").length,planningCount:shipments.filter(x=>x.status==="planning").length,totalUnits:(ur.data??[]).length,estimatedCost:(cr.data??[]).reduce((n:any,x:any)=>n+Number(x.actual_amount||x.estimated_amount||0),0),billableAmount:(cr.data??[]).reduce((n:any,x:any)=>n+Number(x.billable_amount||0),0),modeBreakdown:breakdown("mode"),statusBreakdown:breakdown("status"),upcomingMilestones:(mr.data??[]).filter((m:any)=>m.planned_at&&new Date(m.planned_at)>=today&&!['completed','cancelled'].includes(m.status)).slice(0,8),recentExceptions:(er.data??[]).filter((e:any)=>e.is_exception).slice(0,8)};
}
