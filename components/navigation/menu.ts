export type NavigationItem = { label: string; href: string; icon: string; description?: string; badge?: string };
export type NavigationGroup = { label: string; items: NavigationItem[] };

export const navigationGroups: NavigationGroup[] = [
  { label: "Overview", items: [{ label: "Executive Dashboard", href: "/", icon: "▦", description: "Group command centre" }] },
  { label: "Commercial", items: [
    { label: "Commercial Center", href: "/commercial", icon: "▦" },
    { label: "Opportunities", href: "/commercial/opportunities", icon: "◈", badge: "5" },
    { label: "Commercial Tasks", href: "/commercial/tasks", icon: "✓", badge: "4" },
    { label: "Customers", href: "/customers", icon: "◎" },
    { label: "Suppliers", href: "/suppliers", icon: "◌" },
    { label: "Quotations", href: "/quotations", icon: "◇", badge: "3" },
    { label: "Commercial Deals", href: "/deals/new", icon: "◆" },
  ]},
  { label: "Treasury", items: [
    { label: "FX Dashboard", href: "/fx", icon: "◫" },
    { label: "Positions", href: "/fx/positions", icon: "◈", badge: "3" },
    { label: "FX Deals", href: "/fx/deals", icon: "⇄" },
    { label: "New FX Deal", href: "/fx/deals/new", icon: "+" },
    { label: "Approvals", href: "/approvals", icon: "✓", badge: "2" },
    { label: "Cash Flow", href: "/cash-flow", icon: "⌁" },
  ]},
  { label: "Logistics", items: [
    { label: "Shipping Control", href: "/shipping", icon: "▰" },
    { label: "Shipments", href: "/shipping/shipments", icon: "▱", badge: "12" },
    { label: "Tracking", href: "/shipping/tracking", icon: "⌖" },
    { label: "Inventory", href: "/inventory", icon: "▣" },
  ]},
  { label: "Finance", items: [
    { label: "Finance Overview", href: "/finance", icon: "◒" },
    { label: "Receivables", href: "/finance/receivables", icon: "↙", badge: "3" },
    { label: "Payables", href: "/finance/payables", icon: "↗", badge: "3" },
    { label: "Payments", href: "/finance/payments", icon: "◎", badge: "2" },
    { label: "Banking", href: "/banking", icon: "▥" },
    { label: "Cash Flow", href: "/cash-flow", icon: "⌁" },
  ]},
  { label: "Management", items: [
    { label: "Reports", href: "/reports", icon: "▤", badge: "4" },
    { label: "AI Assistant", href: "/ai", icon: "✦", badge: "NEW" },
    { label: "Documents", href: "/documents", icon: "▧", badge: "5" },
    { label: "Notifications", href: "/notifications", icon: "●", badge: "3" },
    { label: "Audit Log", href: "/audit", icon: "≣" },
    { label: "Users", href: "/users", icon: "◉" },
    { label: "Roles & Permissions", href: "/admin/roles", icon: "⌘" },
    { label: "Settings", href: "/settings", icon: "⚙" },
  ]},
];
