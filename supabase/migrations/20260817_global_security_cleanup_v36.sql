drop table if exists public."MASSIH CHITSAZ";

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.customer_account_snapshot_v1(uuid) from public, anon;
revoke all on function public.customer_assign_owner_v1(uuid,uuid,text) from public, anon;
revoke all on function public.customer_can_control_credit() from public, anon;
revoke all on function public.customer_can_delete() from public, anon;
revoke all on function public.customer_can_write() from public, anon;
revoke all on function public.customer_current_role() from public, anon;
revoke all on function public.customer_delete_v1(uuid,text) from public, anon;
revoke all on function public.customer_set_credit_v1(uuid,numeric,text,text) from public, anon;
revoke all on function public.customer_set_status_v1(uuid,text,text) from public, anon;
revoke all on function public.handle_new_user() from public, anon;
revoke all on function public.notify_approval_request() from public, anon;
revoke all on function public.supplier_can_control() from public, anon;
revoke all on function public.supplier_can_control_terms() from public, anon;
revoke all on function public.supplier_can_delete() from public, anon;
revoke all on function public.supplier_can_rate() from public, anon;
revoke all on function public.supplier_can_write() from public, anon;
revoke all on function public.supplier_current_role() from public, anon;
revoke all on function public.update_invoice_status_after_payment() from public, anon;

alter function public.shipment_transition_gate(text) set search_path=public;
alter function public.shipment_status_hard_lock_v1() set search_path=public;
alter function public.shipment_creation_status_guard_v1() set search_path=public;