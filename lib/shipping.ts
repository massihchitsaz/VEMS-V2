import { createClient } from "@/lib/supabase/client";

export type ShipmentOverview = {
  id: string;
  shipment_no: string;
  mode: string;
  status: string;
  priority: string | null;
  risk_level: string | null;
  exception_status: string | null;
  origin: string | null;
  destination: string | null;
  carrier: string | null;
  booking_no: string | null;
  container_no: string | null;
  bl_no: string | null;
  awb_no: string | null;
  etd: string | null;
  eta: string | null;
  cargo_description: string | null;
  customs_status: string | null;
  last_tracking_at: string | null;
  customer?: { company_name?: string | null } | null;
  supplier?: { company_name?: string | null } | null;
  owner?: { full_name?: string | null } | null;
};

export type ShippingDashboardData = {
  shipments: ShipmentOverview[];
  activeCount: number;
  inTransitCount: number;
  customsCount: number;
  exceptionCount: number;
  arrivingSevenDays: number;
  staleTrackingCount: number;
  overdueMilestones: number;
  openCriticalEvents: number;
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function getShippingDashboard(): Promise<ShippingDashboardData> {
  const supabase = createClient();
  const today = new Date();
  const seven = new Date(today);
  seven.setDate(today.getDate() + 7);
  const stale = new Date(today);
  stale.setHours(today.getHours() - 48);

  const [shipmentsResult, milestonesResult, eventsResult] = await Promise.all([
    supabase
      .from("shipments")
      .select("id,shipment_no,mode,status,priority,risk_level,exception_status,origin,destination,carrier,booking_no,container_no,bl_no,awb_no,etd,eta,cargo_description,customs_status,last_tracking_at,customer:customers(company_name),supplier:suppliers(company_name),owner:profiles(full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("shipment_milestones")
      .select("id,status,planned_at")
      .in("status", ["pending", "in_progress", "delayed"]),
    supabase
      .from("shipment_events")
      .select("id,severity,is_exception,event_time")
      .eq("is_exception", true),
  ]);

  if (shipmentsResult.error) throw shipmentsResult.error;
  if (milestonesResult.error) throw milestonesResult.error;
  if (eventsResult.error) throw eventsResult.error;

  const shipments = (shipmentsResult.data ?? []) as unknown as ShipmentOverview[];
  const active = shipments.filter((s) => !["delivered", "cancelled"].includes(s.status));
  const inTransit = shipments.filter((s) => ["picked_up", "in_transit"].includes(s.status));
  const customs = shipments.filter((s) => s.status === "customs" || (s.customs_status && !["not_started", "cleared", "released"].includes(s.customs_status)));
  const exceptions = shipments.filter((s) => ["watch", "blocked", "escalated"].includes(s.exception_status ?? "clear") || ["high", "critical"].includes(s.risk_level ?? "normal"));
  const arriving = shipments.filter((s) => s.eta && s.eta >= dateOnly(today) && s.eta <= dateOnly(seven) && !["delivered", "cancelled"].includes(s.status));
  const staleTracking = active.filter((s) => !s.last_tracking_at || new Date(s.last_tracking_at) < stale);
  const overdueMilestones = (milestonesResult.data ?? []).filter((m) => m.planned_at && new Date(m.planned_at) < today && m.status !== "completed");
  const criticalEvents = (eventsResult.data ?? []).filter((e) => e.severity === "critical");

  return {
    shipments,
    activeCount: active.length,
    inTransitCount: inTransit.length,
    customsCount: customs.length,
    exceptionCount: exceptions.length,
    arrivingSevenDays: arriving.length,
    staleTrackingCount: staleTracking.length,
    overdueMilestones: overdueMilestones.length,
    openCriticalEvents: criticalEvents.length,
  };
}
