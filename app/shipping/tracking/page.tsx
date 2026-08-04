import { ModuleDashboard } from "@/components/modules/ModuleDashboard";

export default function TrackingPage() {
  return (
    <ModuleDashboard
      eyebrow="Container & Vessel Visibility"
      title="Shipment Tracking"
      description="Central tracking workspace for containers, vessels, airway bills and delivery milestones."
      metrics={[
        { label: "Tracked Units", value: "38", detail: "Containers and AWBs", tone: "blue" },
        { label: "In Transit", value: "24", detail: "Live operational records", tone: "green" },
        { label: "Arriving in 7 Days", value: "7", detail: "Destination preparation", tone: "amber" },
        { label: "Tracking Exceptions", value: "2", detail: "No recent carrier update", tone: "red" },
      ]}
      actions={[
        { label: "Shipments", href: "/shipping/shipments", description: "Open shipment execution records." },
        { label: "Shipping Control", href: "/shipping", description: "View logistics management dashboard." },
        { label: "Inventory", href: "/inventory", description: "Check cargo and warehouse status." },
        { label: "Reports", href: "/reports", description: "Analyze ETA accuracy and delays." },
      ]}
      rows={[
        { Unit: "REGU5283278", Carrier: "Shipping Line", Location: "At Sea", ETA: "08 Aug 2026" },
        { Unit: "NJGCB26001449", Carrier: "Ocean Freight", Location: "Jebel Ali", ETA: "Arrived" },
        { Unit: "VTC-AWB-26031", Carrier: "Air Cargo", Location: "Dubai", ETA: "Customs" },
        { Unit: "VTC-CN-26022", Carrier: "Rail / Road", Location: "Alashankou", ETA: "18 Aug 2026" },
      ]}
    />
  );
}
