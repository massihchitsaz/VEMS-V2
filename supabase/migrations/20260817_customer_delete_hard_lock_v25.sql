drop policy if exists "Authenticated users can view customers" on public.customers;
drop policy if exists customers_delete_roles on public.customers;
revoke delete on public.customers from authenticated;
-- Customer deletion is available only through customer_delete_v1(), which performs dependency checks.
