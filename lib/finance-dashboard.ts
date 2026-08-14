import { createClient } from "@/lib/supabase/client";

export async function getFinanceDashboardData() {
  const s = createClient();

  const [invoices, payments, approvals] = await Promise.all([
    s.from("invoices")
      .select("id,invoice_no,invoice_type,deal_id,shipment_id,customer_id,supplier_id,currency,amount,tax_amount,total_amount,status,issue_date,due_date,notes,created_at,updated_at,customer:customers(company_name),supplier:suppliers(company_name),deal:deals(deal_no),shipment:shipments(shipment_no)")
      .order("due_date", { ascending: true, nullsFirst: false }),
    s.from("payments")
      .select("id,payment_no,invoice_id,deal_id,payment_type,currency,amount,payment_date,method,bank_name,reference_no,status,notes,created_at,approved_by")
      .order("payment_date", { ascending: false }),
    s.from("approvals")
      .select("id,entity_type,entity_id,approval_type,status,requested_at,decided_at")
      .in("entity_type", ["payment", "invoice"])
      .order("requested_at", { ascending: false }),
  ]);

  for (const result of [invoices, payments, approvals]) {
    if (result.error) throw result.error;
  }

  return {
    invoices: invoices.data ?? [],
    payments: payments.data ?? [],
    approvals: approvals.data ?? [],
  };
}
