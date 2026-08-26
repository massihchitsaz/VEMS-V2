-- Document Control production hardening v27
-- Applied to production Supabase on 2026-08-26.

create unique index if not exists ux_document_requirement_rule_scope
on public.document_requirement_rules(entity_type, lower(document_type), gate, modes, requires_dg, requires_temperature_controlled);

create or replace function public.document_guard_status_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status is distinct from old.status and current_user not in ('postgres','service_role') then
    raise exception 'Document status must be changed through the controlled review workflow.';
  end if;
  if old.status not in ('draft','rejected') and current_user not in ('postgres','service_role') then
    if new.title is distinct from old.title or new.reference_no is distinct from old.reference_no or new.document_type is distinct from old.document_type
      or new.entity_type is distinct from old.entity_type or new.entity_id is distinct from old.entity_id or new.module is distinct from old.module
      or new.category is distinct from old.category or new.effective_date is distinct from old.effective_date or new.expiry_date is distinct from old.expiry_date
      or new.is_required is distinct from old.is_required or new.confidentiality is distinct from old.confidentiality or new.notes is distinct from old.notes
      or new.storage_path is distinct from old.storage_path or new.file_name is distinct from old.file_name or new.mime_type is distinct from old.mime_type
      or new.file_size is distinct from old.file_size then
      raise exception 'Document metadata is locked outside Draft or Rejected status. Create a new revision instead.';
    end if;
  end if;
  return new;
end;$$;

create or replace function public.document_register_v2(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid(); v_doc public.documents%rowtype;
  v_entity_type text:=lower(trim(coalesce(p_payload->>'entity_type','general')));
  v_entity_id uuid:=nullif(p_payload->>'entity_id','')::uuid;
  v_title text:=trim(coalesce(p_payload->>'title','')); v_doc_type text:=trim(coalesce(p_payload->>'document_type',''));
  v_file_name text:=trim(coalesce(p_payload->>'file_name','')); v_storage_path text:=trim(coalesce(p_payload->>'storage_path',''));
  v_file_size bigint:=coalesce(nullif(p_payload->>'file_size','')::bigint,0);
  v_effective date:=nullif(p_payload->>'effective_date','')::date; v_expiry date:=nullif(p_payload->>'expiry_date','')::date;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.document_can_write() then raise exception 'Document write permission required.'; end if;
  if v_entity_type not in ('shipment','deal','quotation','customer','supplier','general') then raise exception 'Invalid linked entity type.'; end if;
  if v_entity_type <> 'general' and v_entity_id is null then raise exception 'Select the linked record or use General as the entity type.'; end if;
  if v_title='' then raise exception 'Document title is required.'; end if;
  if v_doc_type='' then raise exception 'Document type is required.'; end if;
  if v_file_name='' or v_storage_path='' then raise exception 'Uploaded file metadata is incomplete.'; end if;
  if v_file_size<=0 or v_file_size>52428800 then raise exception 'Document file size is invalid or exceeds 50 MB.'; end if;
  if v_effective is not null and v_expiry is not null and v_expiry<v_effective then raise exception 'Expiry date cannot be before effective date.'; end if;
  insert into public.documents(entity_type,entity_id,document_type,file_name,storage_path,mime_type,file_size,uploaded_by,title,reference_no,module,category,status,version,effective_date,expiry_date,is_required,confidentiality,notes,parent_document_id,updated_at)
  values(v_entity_type,v_entity_id,v_doc_type,v_file_name,v_storage_path,nullif(p_payload->>'mime_type',''),v_file_size,v_user,v_title,
    nullif(trim(coalesce(p_payload->>'reference_no','')),''),coalesce(nullif(trim(coalesce(p_payload->>'module','')),''),'LOGISTICS'),
    nullif(trim(coalesce(p_payload->>'category','')),''),'draft',1,v_effective,v_expiry,coalesce((p_payload->>'is_required')::boolean,false),
    coalesce(nullif(lower(trim(coalesce(p_payload->>'confidentiality',''))),''),'internal'),nullif(p_payload->>'notes',''),null,now()) returning * into v_doc;
  insert into public.document_activity(document_id,action,comments,actor_id) values(v_doc.id,'uploaded','Version 1 registered in controlled document register',v_user);
  return to_jsonb(v_doc);
end;$$;

create or replace function public.document_update_metadata_v2(p_document_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid(); v_doc public.documents%rowtype; v_entity_type text; v_entity_id uuid; v_effective date; v_expiry date;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.document_can_write() then raise exception 'Document write permission required.'; end if;
  select * into v_doc from public.documents where id=p_document_id for update; if not found then raise exception 'Document not found.'; end if;
  if v_doc.status not in ('draft','rejected') then raise exception 'Only Draft or Rejected document metadata can be edited. Create a new revision instead.'; end if;
  v_entity_type:=lower(trim(coalesce(p_payload->>'entity_type',v_doc.entity_type)));
  v_entity_id:=case when p_payload ? 'entity_id' then nullif(p_payload->>'entity_id','')::uuid else v_doc.entity_id end;
  if v_entity_type not in ('shipment','deal','quotation','customer','supplier','general') then raise exception 'Invalid linked entity type.'; end if;
  if v_entity_type <> 'general' and v_entity_id is null then raise exception 'Select the linked record or use General as the entity type.'; end if;
  v_effective:=case when p_payload ? 'effective_date' then nullif(p_payload->>'effective_date','')::date else v_doc.effective_date end;
  v_expiry:=case when p_payload ? 'expiry_date' then nullif(p_payload->>'expiry_date','')::date else v_doc.expiry_date end;
  if v_effective is not null and v_expiry is not null and v_expiry<v_effective then raise exception 'Expiry date cannot be before effective date.'; end if;
  update public.documents set
    title=coalesce(nullif(trim(coalesce(p_payload->>'title','')),''),title),
    reference_no=case when p_payload ? 'reference_no' then nullif(trim(coalesce(p_payload->>'reference_no','')),'') else reference_no end,
    document_type=coalesce(nullif(trim(coalesce(p_payload->>'document_type','')),''),document_type), entity_type=v_entity_type,
    entity_id=case when v_entity_type='general' then null else v_entity_id end,
    module=coalesce(nullif(trim(coalesce(p_payload->>'module','')),''),module),
    category=case when p_payload ? 'category' then nullif(trim(coalesce(p_payload->>'category','')),'') else category end,
    effective_date=v_effective, expiry_date=v_expiry,
    is_required=case when p_payload ? 'is_required' then coalesce((p_payload->>'is_required')::boolean,false) else is_required end,
    confidentiality=coalesce(nullif(lower(trim(coalesce(p_payload->>'confidentiality',''))),''),confidentiality),
    notes=case when p_payload ? 'notes' then nullif(p_payload->>'notes','') else notes end, updated_at=now()
  where id=p_document_id returning * into v_doc;
  insert into public.document_activity(document_id,action,comments,actor_id) values(v_doc.id,'metadata_updated','Controlled metadata updated',v_user);
  return to_jsonb(v_doc);
end;$$;

create or replace function public.document_register_revision_v2(p_parent_id uuid,p_file jsonb,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid(); v_parent public.documents%rowtype; v_child public.documents%rowtype;
  v_size bigint:=coalesce(nullif(p_file->>'file_size','')::bigint,0); v_name text:=trim(coalesce(p_file->>'file_name','')); v_path text:=trim(coalesce(p_file->>'storage_path',''));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.document_can_write() then raise exception 'Document write permission required.'; end if;
  select * into v_parent from public.documents where id=p_parent_id for update; if not found then raise exception 'Parent document not found.'; end if;
  if v_parent.status not in ('draft','rejected','approved') then raise exception 'A new revision can only be created from Draft, Rejected or Approved documents.'; end if;
  if v_name='' or v_path='' then raise exception 'New revision file metadata is incomplete.'; end if;
  if v_size<=0 or v_size>52428800 then raise exception 'Revision file size is invalid or exceeds 50 MB.'; end if;
  insert into public.documents(entity_type,entity_id,document_type,file_name,storage_path,mime_type,file_size,uploaded_by,title,reference_no,module,category,status,version,effective_date,expiry_date,is_required,confidentiality,notes,parent_document_id,updated_at)
  values(v_parent.entity_type,v_parent.entity_id,v_parent.document_type,v_name,v_path,nullif(p_file->>'mime_type',''),v_size,v_user,v_parent.title,v_parent.reference_no,v_parent.module,v_parent.category,'draft',coalesce(v_parent.version,1)+1,v_parent.effective_date,v_parent.expiry_date,v_parent.is_required,v_parent.confidentiality,coalesce(nullif(trim(coalesce(p_notes,'')),''),v_parent.notes),v_parent.id,now()) returning * into v_child;
  update public.approvals set status='cancelled',comments=coalesce(comments,'Superseded by document revision'),decided_at=now() where entity_type='document' and entity_id=v_parent.id and status='pending';
  update public.documents set status='superseded',updated_at=now() where id=v_parent.id;
  insert into public.document_activity(document_id,action,comments,actor_id) values(v_parent.id,'superseded',coalesce(nullif(trim(coalesce(p_notes,'')),''),'Superseded by revision v'||v_child.version),v_user);
  insert into public.document_activity(document_id,action,comments,actor_id) values(v_child.id,'revision_created','Revision of document '||v_parent.id::text,v_user);
  return to_jsonb(v_child);
end;$$;

create or replace function public.document_log_access_v1(p_document_id uuid,p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_doc public.documents%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_action not in ('opened','downloaded') then raise exception 'Unsupported document access action.'; end if;
  select * into v_doc from public.documents where id=p_document_id; if not found then raise exception 'Document not found.'; end if;
  if coalesce(v_doc.confidentiality,'internal')='restricted' and v_doc.uploaded_by<>v_user and not public.document_can_approve() then raise exception 'You do not have access to this restricted document.'; end if;
  insert into public.document_activity(document_id,action,comments,actor_id) values(v_doc.id,p_action,null,v_user);
end;$$;

create or replace function public.document_can_access_storage_path(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.documents d where d.storage_path=p_path and auth.uid() is not null and (coalesce(d.confidentiality,'internal')<>'restricted' or d.uploaded_by=auth.uid() or public.document_can_approve()))
$$;

revoke all on function public.document_register_v2(jsonb) from public,anon;
revoke all on function public.document_update_metadata_v2(uuid,jsonb) from public,anon;
revoke all on function public.document_register_revision_v2(uuid,jsonb,text) from public,anon;
revoke all on function public.document_log_access_v1(uuid,text) from public,anon;
revoke all on function public.document_can_access_storage_path(text) from public,anon;
grant execute on function public.document_register_v2(jsonb) to authenticated;
grant execute on function public.document_update_metadata_v2(uuid,jsonb) to authenticated;
grant execute on function public.document_register_revision_v2(uuid,jsonb,text) to authenticated;
grant execute on function public.document_log_access_v1(uuid,text) to authenticated;
grant execute on function public.document_can_access_storage_path(text) to authenticated;

drop policy if exists document_read_authenticated on public.documents;
create policy document_read_authenticated on public.documents for select to authenticated using (coalesce(confidentiality,'internal')<>'restricted' or uploaded_by=auth.uid() or public.document_can_approve());

drop policy if exists vtc_documents_storage_select on storage.objects;
create policy vtc_documents_storage_select on storage.objects for select to authenticated using (bucket_id='vtc-documents' and public.document_can_access_storage_path(name));
