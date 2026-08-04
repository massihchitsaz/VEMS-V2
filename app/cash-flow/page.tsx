import { ModuleDashboard } from "@/components/modules/ModuleDashboard";

export default function CashFlowPage() {
  return (
    <ModuleDashboard
      eyebrow="Treasury Liquidity Planning"
      title="Cash Flow Forecast"
      description="Consolidated expected receipts, payments, FX settlements and operating commitments."
      metrics={[
        { label: "Today Net Cash", value: "+AED 420K", detail: "Receipts exceed payments", tone: "green" },
        { label: "7-Day Requirement", value: "AED 1.3M", detail: "Funding required", tone: "amber" },
        { label: "30-Day Inflow", value: "AED 6.8M", detail: "Expected customer receipts", tone: "blue" },
        { label: "Overdue Receipts", value: "AED 540K", detail: "Commercial follow-up", tone: "red" },
      ]}
      actions={[
        { label: "Finance Overview", href: "/finance", description: "View consolidated finance position." },
        { label: "Banking", href: "/banking", description: "Review accounts and transfers." },
        { label: "FX Positions", href: "/fx/positions", description: "Cover currency requirements." },
        { label: "Approvals", href: "/approvals", description: "Release pending transactions." },
      ]}
      rows={[
        { Period: "Today", Inflows: "AED 1,850,000", Outflows: "AED 1,430,000", Net: "+AED 420,000" },
        { Period: "Next 7 Days", Inflows: "AED 2,900,000", Outflows: "AED 4,200,000", Net: "-AED 1,300,000" },
        { Period: "Next 30 Days", Inflows: "AED 6,800,000", Outflows: "AED 5,950,000", Net: "+AED 850,000" },
      ]}
    />
  );
}
