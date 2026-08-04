export type DocumentStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "EXPIRED";
export type DocumentRecord = {
  id: string;
  title: string;
  category: "CONTRACT" | "INVOICE" | "PACKING_LIST" | "BL" | "SWIFT" | "KYC" | "OTHER";
  module: "COMMERCIAL" | "TREASURY" | "LOGISTICS" | "FINANCE" | "ADMIN";
  reference: string;
  owner: string;
  status: DocumentStatus;
  updatedAt: string;
  expiryDate?: string;
};

export type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  module: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string;
  read: boolean;
  href: string;
};

export type AuditRecord = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  module: string;
  reference: string;
  result: "SUCCESS" | "WARNING" | "FAILED";
};

export type RoleRecord = {
  id: string;
  name: string;
  description: string;
  users: number;
  permissions: string[];
  active: boolean;
};

export const initialDocuments: DocumentRecord[] = [
  { id: "DOC-260801", title: "Kekule Commercial Invoice", category: "INVOICE", module: "COMMERCIAL", reference: "KPL/EXP/016/2026-27", owner: "Massih Chitsaz", status: "APPROVED", updatedAt: "2026-08-03T09:30:00Z" },
  { id: "DOC-260802", title: "Pepper Powder Packing List", category: "PACKING_LIST", module: "LOGISTICS", reference: "26-TAG-LO-01", owner: "Logistics Desk", status: "UNDER_REVIEW", updatedAt: "2026-08-03T08:10:00Z" },
  { id: "DOC-260803", title: "USD Purchase SWIFT", category: "SWIFT", module: "TREASURY", reference: "FX-2026-0042", owner: "Treasury Desk", status: "APPROVED", updatedAt: "2026-08-02T15:25:00Z" },
  { id: "DOC-260804", title: "Supplier KYC Package", category: "KYC", module: "ADMIN", reference: "SUP-0098", owner: "Compliance", status: "EXPIRED", updatedAt: "2026-08-01T11:40:00Z", expiryDate: "2026-07-31" },
  { id: "DOC-260805", title: "Jebel Ali to Bandar Abbas BL Draft", category: "BL", module: "LOGISTICS", reference: "SHP-2026-118", owner: "Shipping Desk", status: "DRAFT", updatedAt: "2026-08-03T10:05:00Z" },
];

export const initialNotifications: NotificationRecord[] = [
  { id: "NTF-1", title: "Treasury approval required", message: "EUR sell deal exceeds the approved minimum rate.", module: "TREASURY", priority: "HIGH", createdAt: "2026-08-03T10:18:00Z", read: false, href: "/approvals" },
  { id: "NTF-2", title: "Shipment cutoff approaching", message: "SHP-2026-118 cutoff is within 18 hours.", module: "LOGISTICS", priority: "CRITICAL", createdAt: "2026-08-03T09:42:00Z", read: false, href: "/shipping/shipments" },
  { id: "NTF-3", title: "Customer payment overdue", message: "MODAVA receivable is 4 days overdue.", module: "FINANCE", priority: "HIGH", createdAt: "2026-08-03T08:12:00Z", read: false, href: "/finance/receivables" },
  { id: "NTF-4", title: "Supplier KYC expired", message: "SUP-0098 cannot be used for a new transaction until KYC is renewed.", module: "ADMIN", priority: "MEDIUM", createdAt: "2026-08-02T16:20:00Z", read: true, href: "/documents" },
];

export const initialAuditRecords: AuditRecord[] = [
  { id: "AUD-1001", timestamp: "2026-08-03T10:21:00Z", actor: "Massih Chitsaz", action: "Created FX deal", module: "TREASURY", reference: "FX-2026-0042", result: "SUCCESS" },
  { id: "AUD-1002", timestamp: "2026-08-03T10:05:00Z", actor: "Shipping Desk", action: "Uploaded BL draft", module: "LOGISTICS", reference: "SHP-2026-118", result: "SUCCESS" },
  { id: "AUD-1003", timestamp: "2026-08-03T09:56:00Z", actor: "Finance Desk", action: "Changed receivable status", module: "FINANCE", reference: "AR-2026-031", result: "WARNING" },
  { id: "AUD-1004", timestamp: "2026-08-03T09:18:00Z", actor: "Demo Dealer", action: "Attempted out-of-limit deal", module: "TREASURY", reference: "FX-DRAFT-19", result: "FAILED" },
];

export const initialRoles: RoleRecord[] = [
  { id: "ROLE-ADMIN", name: "System Administrator", description: "Full platform administration and configuration access.", users: 1, permissions: ["ALL_MODULES", "USER_MANAGEMENT", "ROLE_MANAGEMENT", "AUDIT_VIEW"], active: true },
  { id: "ROLE-COMMERCIAL", name: "Commercial Manager", description: "Commercial, customer, supplier, quotation and management access.", users: 2, permissions: ["COMMERCIAL_FULL", "APPROVAL_DECISION", "REPORTS_VIEW", "LOGISTICS_VIEW", "TREASURY_VIEW"], active: true },
  { id: "ROLE-DEALER", name: "FX Dealer", description: "FX positions, quotations and deal registration within assigned limits.", users: 3, permissions: ["FX_POSITION_VIEW", "FX_DEAL_CREATE", "FX_QUOTE_CREATE"], active: true },
  { id: "ROLE-LOGISTICS", name: "Logistics Operator", description: "Shipment, booking, document and tracking operations.", users: 4, permissions: ["SHIPMENT_FULL", "DOCUMENT_UPLOAD", "TRACKING_UPDATE"], active: true },
];
