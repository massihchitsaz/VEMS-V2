import { ModuleDashboard } from "@/components/modules/ModuleDashboard";

export default function ShipmentsPage() {
  return (
    <ModuleDashboard
      eyebrow="VTC Logistics Execution"
      title="Active Shipments"
      description="Monitor booking, origin handling, customs, transit, arrival and delivery milestones."
      metrics={[
        { label: "Active Shipments", value: "12", detail: "Sea, air and land", tone: "blue" },
        { label: "Departing This Week", value: "5", detail: "Cut-off control active", tone: "green" },
        { label: "Documents Pending", value: "7", detail: "BL, invoice or packing list", tone: "amber" },
        { label: "Delayed", value: "3", detail: "Management attention", tone: "red" },
      ]}
      actions={[
        { label: "+ New Shipment", href: "/shipping", description: "Create shipment execution record." },
        { label: "Container Tracking", href: "/shipping/tracking", description: "Track containers and vessels." },
        { label: "Inventory", href: "/inventory", description: "Review cargo stock and reservations." },
        { label: "Reports", href: "/reports", description: "Transit, cost and delay performance." },
      ]}
      rows={[
        { Shipment: "VTC-SHP-26081", Route: "Jebel Ali → Bandar Abbas", Cargo: "Pepper Powder", Status: "Booking" },
        { Shipment: "VTC-SHP-26079", Route: "Nhava Sheva → Jebel Ali", Cargo: "Chemicals", Status: "At CFS" },
        { Shipment: "VTC-SHP-26075", Route: "Shanghai → Jebel Ali", Cargo: "Industrial Parts", Status: "In Transit" },
        { Shipment: "VTC-SHP-26072", Route: "Italy → Dubai", Cargo: "Air Cargo", Status: "Customs" },
      ]}
    />
  );
}
