drop policy if exists document_insert_authorized on public.documents;
create policy document_insert_authorized on public.documents for insert to authenticated with check(public.document_can_write() and (uploaded_by is null or uploaded_by=auth.uid()) and coalesce(status,'draft')='draft');

create or replace function public.document_guard_status_update() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status is distinct from old.status and current_setting('app.document_status_write',true)<>'on' then raise exception 'Document status must be changed through the controlled review workflow.'; end if;
 if old.status in ('approved','superseded','cancelled') and current_setting('app.document_control_override',true)<>'on' then
  if new.title is distinct from old.title or new.reference_no is distinct from old.reference_no or new.document_type is distinct from old.document_type or new.entity_type is distinct from old.entity_type or new.entity_id is distinct from old.entity_id or new.module is distinct from old.module or new.category is distinct from old.category or new.effective_date is distinct from old.effective_date or new.expiry_date is distinct from old.expiry_date or new.confidentiality is distinct from old.confidentiality or new.storage_path is distinct from old.storage_path or new.file_name is distinct from old.file_name then raise exception 'Approved or closed document metadata cannot be edited. Create a new revision instead.'; end if;
 end if; return new;
end $$;
drop trigger if exists trg_document_guard_status_update on public.documents;
create trigger trg_document_guard_status_update before update on public.documents for each row execute function public.document_guard_status_update();

create or replace function public.document_supersede_v1(p_parent_id uuid,p_child_id uuid,p_comments text default null) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_parent public.documents%rowtype;v_child public.documents%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if; if not public.document_can_write() then raise exception 'Document write permission required.'; end if;
 select * into v_parent from public.documents where id=p_parent_id for update;if not found then raise exception 'Parent document not found.';end if;
 select * into v_child from public.documents where id=p_child_id for update;if not found then raise exception 'New revision not found.';end if;
 if v_child.parent_document_id is distinct from p_parent_id then raise exception 'New revision is not linked to the parent document.';end if;if coalesce(v_child.version,0)<=coalesce(v_parent.version,0) then raise exception 'Revision version must be greater than the parent version.';end if;
 perform set_config('app.document_status_write','on',true);update public.documents set status='superseded',updated_at=now() where id=p_parent_id;
 insert into public.document_activity(document_id,action,comments,actor_id) values(p_parent_id,'superseded',coalesce(nullif(trim(coalesce(p_comments,'')),''),'Superseded by revision v'||v_child.version),auth.uid());
 insert into public.document_activity(document_id,action,comments,actor_id) values(p_child_id,'revision_created','Revision of document '||p_parent_id::text,auth.uid());return jsonb_build_object('parent_id',p_parent_id,'child_id',p_child_id,'parent_status','superseded');
end $$;
revoke all on function public.document_supersede_v1(uuid,uuid,text) from public,anon;grant execute on function public.document_supersede_v1(uuid,uuid,text) to authenticated,service_role;

drop policy if exists vtc_documents_storage_delete on storage.objects;
create policy vtc_documents_storage_delete on storage.objects for delete to authenticated using(bucket_id='vtc-documents' and (public.document_can_approve() or owner_id=auth.uid()::text));
