import { createClient } from "@/lib/supabase/client";

export type DashboardSnapshot = {
  customers: number;
  suppliers: number;
  quotations: number;
  opportunities: number;
  deals: number;
  activeShipments: number;
  openInvoices: number;
  openInvoiceValue: number;
  completedPayments: number;
  completedPaymentValue: number;
  openTasks: number;
  unreadNotifications: number;
  pendingApprovals: number;
  fxDeals: number;
  pendingFxApprovals: number;
};

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  createdAt: string;
  severity?: string;
};

async function exactCount(table: string, apply?: (query: any) => any) {
  const supabase = createClient();
  let query: any = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getDashboardSnapshot(userId?: string): Promise<DashboardSnapshot> {
  const supabase = createClient();

  const [
    customers,
    suppliers,
    quotations,
    opportunities,
    deals,
    activeShipments,
    openInvoices,
    completedPayments,
    openTasks,
    unreadNotifications,
    pendingApprovals,
    fxDeals,
    pendingFxApprovals,
    invoiceRows,
    paymentRows,
  ] = await Promise.all([
    exactCount("customers"),
    exactCount("suppliers"),
    exactCount("quotations"),
    exactCount("opportunities"),
    exactCount("deals"),
    exactCount("shipments", (q) => q.not("status", "in", '("delivered","cancelled")')),
    exactCount("invoices", (q) => q.not("status", "in", '("paid","cancelled")')),
    exactCount("payments", (q) => q.eq("status", "completed")),
    exactCount("tasks", (q) => q.not("status", "in", '("done","cancelled")')),
    exactCount("notifications", (q) => {
      let x = q.eq("is_read", false);
      if (userId) x = x.eq("user_id", userId);
      return x;
    }),
    exactCount("approvals", (q) => q.eq("status", "pending")),
    exactCount("fx_deals"),
    exactCount("fx_approvals", (q) => q.eq("status", "pending")),
    supabase.from("invoices").select("total_amount,status").not("status", "in", '("paid","cancelled")'),
    supabase.from("payments").select("amount,status").eq("status", "completed"),
  ]);

  const openInvoiceValue = (invoiceRows.data ?? []).reduce(
    (sum: number, row: any) => sum + Number(row.total_amount ?? 0),
    0,
  );
  const completedPaymentValue = (paymentRows.data ?? []).reduce(
    (sum: number, row: any) => sum + Number(row.amount ?? 0),
    0,
  );

  return {
    customers,
    suppliers,
    quotations,
    opportunities,
    deals,
    activeShipments,
    openInvoices,
    openInvoiceValue,
    completedPayments,
    completedPaymentValue,
    openTasks,
    unreadNotifications,
    pendingApprovals,
    fxDeals,
    pendingFxApprovals,
  };
}

export async function getRecentActivity(userId?: string): Promise<ActivityItem[]> {
  const supabase = createClient();

  const [auditResult, notificationResult, taskResult] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id,entity_type,entity_id,action,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    (() => {
      let query = supabase
        .from("notifications")
        .select("id,title,message,entity_type,entity_id,severity,created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (userId) query = query.eq("user_id", userId);
      return query;
    })(),
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_at,created_at")
      .not("status", "in", '("done","cancelled")')
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const audit = (auditResult.data ?? []).map((row: any) => ({
    id: `audit-${row.id}`,
    title: `${row.action} ${row.entity_type}`,
    detail: row.entity_id ? `Record ${row.entity_id}` : "System activity",
    href: "/reports",
    createdAt: row.created_at,
    severity: "info",
  }));

  const notifications = (notificationResult.data ?? []).map((row: any) => ({
    id: `notification-${row.id}`,
    title: row.title,
    detail: row.message ?? row.entity_type ?? "Notification",
    href: "/notifications",
    createdAt: row.created_at,
    severity: row.severity ?? "info",
  }));

  const tasks = (taskResult.data ?? []).map((row: any) => ({
    id: `task-${row.id}`,
    title: row.title,
    detail: `${row.priority ?? "medium"} priority · ${row.status}`,
    href: "/tasks",
    createdAt: row.created_at,
    severity: row.priority === "critical" ? "critical" : row.priority === "high" ? "warning" : "info",
  }));

  return [...notifications, ...tasks, ...audit]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);
}

export async function markNotificationRead(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
