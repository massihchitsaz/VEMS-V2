import { ModuleDashboard } from "@/components/modules/ModuleDashboard";

export default function BankingPage() {
  return (
    <ModuleDashboard
      eyebrow="Banking & Transfer Control"
      title="Banking Workspace"
      description="Track operating accounts, transfers, SWIFT references, KYC requests and rejected payments."
      metrics={[
        { label: "Bank Accounts", value: "9", detail: "UAE and international", tone: "blue" },
        { label: "Transfers in Process", value: "5", detail: "AED 1.7M equivalent", tone: "amber" },
        { label: "Completed Today", value: "8", detail: "Confirmed by bank", tone: "green" },
        { label: "Rejected / Held", value: "2", detail: "Compliance follow-up", tone: "red" },
      ]}
      actions={[
        { label: "Finance Overview", href: "/finance", description: "Return to finance management." },
        { label: "Cash Flow", href: "/cash-flow", description: "Review funding requirements." },
        { label: "FX Deals", href: "/fx/deals", description: "Match bank settlement to FX deals." },
        { label: "Approvals", href: "/approvals", description: "Review payment approvals." },
      ]}
      rows={[
        { Reference: "VTC-BNK-26091", Bank: "Emirates Islamic", Currency: "AED", Status: "Completed" },
        { Reference: "VTC-BNK-26089", Bank: "Mellat", Currency: "EUR", Status: "Compliance Review" },
        { Reference: "VTC-BNK-26086", Bank: "Intermediary Bank", Currency: "USD", Status: "Rejected" },
        { Reference: "VTC-BNK-26083", Bank: "UAE Bank", Currency: "AED", Status: "Processing" },
      ]}
    />
  );
}
