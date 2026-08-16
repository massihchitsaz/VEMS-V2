create or replace function public.document_current_role() returns text language sql stable security definer set search_path=public as $$ select lower(coalesce(p.role::text,'dealer')) from public.profiles p where p.id=auth.uid() and p.active=true $$;
create or replace function public.document_can_write() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.document_current_role() in ('admin','ceo','manager','finance'),false) $$;
create or replace function public.document_can_approve() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.document_current_role() in ('admin','ceo','manager'),false) $$;
revoke all on function public.document_current_role(),public.document_can_write(),public.document_can_approve() from public,anon;
grant execute on function public.document_current_role(),public.document_can_write(),public.document_can_approve() to authenticated,service_role;

drop policy if exists authenticated_insert on public.documents; drop policy if exists authenticated_select on public.documents; drop policy if exists authenticated_update on public.documents; drop policy if exists manager_delete on public.documents;
create policy document_read_authenticated on public.documents for select to authenticated using(true);
create policy document_insert_authorized on public.documents for insert to authenticated with check(public.document_can_write() and (uploaded_by is null or uploaded_by=auth.uid()));
create policy document_update_authorized on public.documents for update to authenticated using(public.document_can_write()) with check(public.document_can_write());
create policy document_delete_authorized on public.documents for delete to authenticated using(public.document_can_approve() and status in ('draft','rejected','cancelled'));

drop policy if exists document_activity_insert_auth on public.document_activity; drop policy if exists document_activity_select_auth on public.document_activity;
create policy document_activity_read_authenticated on public.document_activity for select to authenticated using(true);
create policy document_activity_insert_authorized on public.document_activity for insert to authenticated with check(public.document_can_write() and (actor_id is null or actor_id=auth.uid()));

drop policy if exists vtc_documents_storage_select on storage.objects; drop policy if exists vtc_documents_storage_insert on storage.objects; drop policy if exists vtc_documents_storage_update on storage.objects; drop policy if exists vtc_documents_storage_delete on storage.objects;
create policy vtc_documents_storage_select on storage.objects for select to authenticated using(bucket_id='vtc-documents');
create policy vtc_documents_storage_insert on storage.objects for insert to authenticated with check(bucket_id='vtc-documents' and public.document_can_write());
create policy vtc_documents_storage_update on storage.objects for update to authenticated using(bucket_id='vtc-documents' and public.document_can_write()) with check(bucket_id='vtc-documents' and public.document_can_write());
create policy vtc_documents_storage_delete on storage.objects for delete to authenticated using(bucket_id='vtc-documents' and public.document_can_approve());

drop policy if exists authenticated_insert on public.approvals; drop policy if exists authenticated_select on public.approvals; drop policy if exists authenticated_update on public.approvals;
create policy approvals_read_authenticated on public.approvals for select to authenticated using(true);
create policy approvals_insert_authenticated on public.approvals for insert to authenticated with check(auth.uid() is not null);
create policy approvals_update_owner_or_approver on public.approvals for update to authenticated using(auth.uid()=approver_id or auth.uid()=requested_by or public.document_can_approve()) with check(auth.uid()=approver_id or auth.uid()=requested_by or public.document_can_approve());

create index if not exists idx_documents_entity on public.documents(entity_type,entity_id);
create index if not exists idx_documents_status_expiry on public.documents(status,expiry_date);
create index if not exists idx_documents_parent on public.documents(parent_document_id);
create index if not exists idx_document_activity_doc_created on public.document_activity(document_id,created_at desc);
create index if not exists idx_approvals_document on public.approvals(entity_type,entity_id,status,requested_at desc);
