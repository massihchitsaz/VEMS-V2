export type CommercialStage =
  | "lead"
  | "qualified"
  | "quotation"
  | "negotiation"
  | "approval"
  | "won"
  | "lost";

export type CommercialPriority = "low" | "medium" | "high" | "critical";
export type CommercialTaskStatus = "open" | "in-progress" | "completed";

export type CommercialOpportunity = {
  id: string;
  reference: string;
  title: string;
  company: string;
  owner: string;
  stage: CommercialStage;
  value: number;
  currency: string;
  probability: number;
  marginPercent: number;
  nextAction: string;
  dueDate: string;
  priority: CommercialPriority;
  route?: string;
  updatedAt: string;
};

export type CommercialTask = {
  id: string;
  title: string;
  relatedTo: string;
  assignee: string;
  dueDate: string;
  priority: CommercialPriority;
  status: CommercialTaskStatus;
  category: "customer" | "supplier" | "quotation" | "shipment" | "treasury";
};

export type CommercialSupplier = {
  id: string;
  name: string;
  country: string;
  category: string;
  contact: string;
  kycStatus: "approved" | "pending" | "expired";
  performance: number;
  openItems: number;
  strategic: boolean;
};

export type CommercialQuotation = {
  id: string;
  reference: string;
  customer: string;
  subject: string;
  route: string;
  amount: number;
  currency: string;
  status: "draft" | "awaiting-rates" | "commercial-review" | "approval" | "awarded" | "expired";
  validUntil: string;
  marginPercent: number;
  owner: string;
};

export const commercialStages: Array<{ id: CommercialStage; label: string }> = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Qualified" },
  { id: "quotation", label: "Quotation" },
  { id: "negotiation", label: "Negotiation" },
  { id: "approval", label: "Approval" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export const seedOpportunities: CommercialOpportunity[] = [
  {
    id: "opp-001",
    reference: "26-TAG-LO-01",
    title: "Pepper Powder Cross-Stuffing",
    company: "Taam Gostar",
    owner: "Massih Chitsaz",
    stage: "quotation",
    value: 180000,
    currency: "USD",
    probability: 65,
    marginPercent: 11.5,
    nextAction: "Receive JEA launch and land-craft rates",
    dueDate: "2026-08-05",
    priority: "critical",
    route: "Jebel Ali → Iran",
    updatedAt: "2026-08-03T11:30:00Z",
  },
  {
    id: "opp-002",
    reference: "26-VTC-RB-02",
    title: "2,000 MT Rebar Project",
    company: "Regional Steel Buyer",
    owner: "Massih Chitsaz",
    stage: "negotiation",
    value: 3100000,
    currency: "AED",
    probability: 55,
    marginPercent: 8.4,
    nextAction: "Confirm yard capacity and handling tariff",
    dueDate: "2026-08-07",
    priority: "high",
    route: "Iran → Hamriyah",
    updatedAt: "2026-08-03T09:10:00Z",
  },
  {
    id: "opp-003",
    reference: "26-VTC-SG-04",
    title: "Sugar Transit Program",
    company: "Afghanistan Trading Partner",
    owner: "Commercial Team",
    stage: "approval",
    value: 2250000,
    currency: "AED",
    probability: 80,
    marginPercent: 6.8,
    nextAction: "Management approval for carrier nomination",
    dueDate: "2026-08-04",
    priority: "critical",
    route: "Jebel Ali → Bandar Abbas",
    updatedAt: "2026-08-03T12:00:00Z",
  },
  {
    id: "opp-004",
    reference: "26-VTC-PV-08",
    title: "Solar Battery Regional Distribution",
    company: "Power & Sun",
    owner: "Massih Chitsaz",
    stage: "qualified",
    value: 4600000,
    currency: "AED",
    probability: 45,
    marginPercent: 13.2,
    nextAction: "Finalize partnership operating model",
    dueDate: "2026-08-12",
    priority: "high",
    route: "UAE → Regional Markets",
    updatedAt: "2026-08-02T15:20:00Z",
  },
  {
    id: "opp-005",
    reference: "26-VTC-CH-09",
    title: "Chemical Cargo Program",
    company: "MODAVA",
    owner: "Massih Chitsaz",
    stage: "won",
    value: 675000,
    currency: "AED",
    probability: 100,
    marginPercent: 9.7,
    nextAction: "Monitor shipment and settlement",
    dueDate: "2026-08-06",
    priority: "medium",
    route: "India → UAE",
    updatedAt: "2026-08-03T08:45:00Z",
  },
];

export const seedTasks: CommercialTask[] = [
  { id: "task-001", title: "Approve sugar carrier nomination", relatedTo: "26-VTC-SG-04", assignee: "Massih Chitsaz", dueDate: "2026-08-04", priority: "critical", status: "open", category: "shipment" },
  { id: "task-002", title: "Follow up JEA handling rates", relatedTo: "26-TAG-LO-01", assignee: "Commercial Team", dueDate: "2026-08-05", priority: "high", status: "in-progress", category: "quotation" },
  { id: "task-003", title: "Complete Kekule supplier review", relatedTo: "Kekule Pharma", assignee: "Massih Chitsaz", dueDate: "2026-08-06", priority: "high", status: "open", category: "supplier" },
  { id: "task-004", title: "Confirm USD purchase settlement", relatedTo: "FX-2026-003", assignee: "Treasury", dueDate: "2026-08-04", priority: "critical", status: "open", category: "treasury" },
  { id: "task-005", title: "Send partnership meeting minutes", relatedTo: "Power & Sun", assignee: "Commercial Team", dueDate: "2026-08-05", priority: "medium", status: "completed", category: "customer" },
];

export const seedSuppliers: CommercialSupplier[] = [
  { id: "sup-001", name: "Kekule Pharma", country: "India", category: "Chemicals", contact: "Dr. Sridhar", kycStatus: "approved", performance: 62, openItems: 3, strategic: true },
  { id: "sup-002", name: "Power & Sun", country: "UAE", category: "Solar Energy", contact: "Albert Einstein Mx", kycStatus: "approved", performance: 91, openItems: 1, strategic: true },
  { id: "sup-003", name: "Apple Shipping", country: "UAE", category: "Shipping", contact: "Operations Desk", kycStatus: "approved", performance: 48, openItems: 4, strategic: false },
  { id: "sup-004", name: "Orange Group", country: "UAE", category: "Energy", contact: "L.K. Verma", kycStatus: "approved", performance: 88, openItems: 0, strategic: true },
  { id: "sup-005", name: "Torang Darya Shipping", country: "Iran", category: "Shipping Agency", contact: "Operations", kycStatus: "pending", performance: 76, openItems: 2, strategic: false },
];

export const seedQuotations: CommercialQuotation[] = [
  { id: "q-001", reference: "26-TAG-LO-01", customer: "Taam Gostar", subject: "Pepper powder cross-stuffing", route: "JEA → Iran", amount: 180000, currency: "USD", status: "awaiting-rates", validUntil: "2026-08-08", marginPercent: 11.5, owner: "Massih Chitsaz" },
  { id: "q-002", reference: "26-VTC-RB-02", customer: "Regional Steel Buyer", subject: "2,000 MT rebar logistics", route: "Iran → UAE", amount: 3100000, currency: "AED", status: "commercial-review", validUntil: "2026-08-10", marginPercent: 8.4, owner: "Massih Chitsaz" },
  { id: "q-003", reference: "26-VTC-SG-04", customer: "Afghanistan Trading Partner", subject: "Sugar transit program", route: "JEA → BND", amount: 2250000, currency: "AED", status: "approval", validUntil: "2026-08-05", marginPercent: 6.8, owner: "Commercial Team" },
  { id: "q-004", reference: "26-VTC-CH-09", customer: "MODAVA", subject: "Chemical cargo", route: "India → UAE", amount: 675000, currency: "AED", status: "awarded", validUntil: "2026-08-15", marginPercent: 9.7, owner: "Massih Chitsaz" },
];
