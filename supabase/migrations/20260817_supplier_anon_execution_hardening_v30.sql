revoke all on function public.supplier_set_status_v1(uuid,text,text) from anon;
revoke all on function public.supplier_set_kyc_v1(uuid,text,text) from anon;
revoke all on function public.supplier_set_kyc_v2(uuid,text,date,text) from anon;
revoke all on function public.supplier_set_terms_v1(uuid,text,text,text) from anon;
revoke all on function public.supplier_assign_manager_v1(uuid,uuid,text) from anon;
revoke all on function public.supplier_set_rating_v1(uuid,numeric,text) from anon;
revoke all on function public.supplier_delete_v1(uuid,text) from anon;
revoke all on function public.supplier_account_snapshot_v1(uuid) from anon;
