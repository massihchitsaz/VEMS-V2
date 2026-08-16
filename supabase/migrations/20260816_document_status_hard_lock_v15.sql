create or replace function public.document_guard_status_update()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.status is distinct from old.status and current_user not in ('postgres','service_role') then raise exception 'Document status must be changed through the controlled review workflow.'; end if;
 if old.status in ('approved','superseded','cancelled') and current_user not in ('postgres','service_role') then
  if new.title is distinct from old.title or new.reference_no is distinct from old.reference_no or new.document_type is distinct from old.document_type or new.entity_type is distinct from old.entity_type or new.entity_id is distinct from old.entity_id or new.module is distinct from old.module or new.category is distinct from old.category or new.effective_date is distinct from old.effective_date or new.expiry_date is distinct from old.expiry_date or new.confidentiality is distinct from old.confidentiality or new.storage_path is distinct from old.storage_path or new.file_name is distinct from old.file_name then raise exception 'Approved or closed document metadata cannot be edited. Create a new revision instead.'; end if;
 end if;return new;
end $$;

create or replace function public.document_submit_for_review_v1(p_document_id uuid,p_approver_id uuid default null,p_comments text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_doc public.documents%rowtype;v_approval_id uuid;v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'Authentication required';end if;if not public.document_can_write() then raise exception 'You do not have permission to submit documents for review.';end if;
 select * into v_doc from public.documents where id=p_document_id for update;if not found then raise exception 'Document not found.';end if;if v_doc.status not in ('draft','rejected') then raise exception 'Only draft or rejected documents can be submitted for review.';end if;
 if p_approver_id is not null and not public.document_is_valid_approver(p_approver_id) then raise exception 'Selected approver is not authorized for document approval.';end if;
 update public.approvals set status='cancelled',comments=coalesce(comments,'Superseded by a new review request'),decided_at=now() where entity_type='document' and entity_id=p_document_id and status='pending';
 insert into public.approvals(entity_type,entity_id,approval_type,requested_by,approver_id,status,comments) values('document',p_document_id,'document_review',v_actor,p_approver_id,'pending',nullif(trim(coalesce(p_comments,'')),'')) returning id into v_approval_id;
 update public.documents set status='under_review',approved_by=null,approved_at=null,updated_at=now() where id=p_document_id;
 insert into public.document_activity(document_id,action,comments,actor_id) values(p_document_id,'submitted_for_review',nullif(trim(coalesce(p_comments,'')),''),v_actor);
 return jsonb_build_object('document_id',p_document_id,'status','under_review','approval_id',v_approval_id);
end $$;

create or replace function public.document_decide_review_v1(p_document_id uuid,p_decision text,p_comments text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_doc public.documents%rowtype;v_approval public.approvals%rowtype;v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'Authentication required';end if;if not public.document_can_approve() then raise exception 'Only authorized approvers may approve or reject controlled documents.';end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.';end if;if p_decision='rejected' and nullif(trim(coalesce(p_comments,'')),'') is null then raise exception 'Rejection comments are required.';end if;
 select * into v_doc from public.documents where id=p_document_id for update;if not found then raise exception 'Document not found.';end if;if v_doc.status<>'under_review' then raise exception 'Document is not under review.';end if;
 select * into v_approval from public.approvals where entity_type='document' and entity_id=p_document_id and status='pending' order by requested_at desc limit 1 for update;if not found then raise exception 'Pending document approval request not found.';end if;
 if v_approval.approver_id is not null and v_approval.approver_id<>v_actor and public.document_current_role()<>'admin' then raise exception 'This review is assigned to another approver.';end if;
 update public.approvals set status=case when p_decision='approved' then 'approved' else 'rejected' end,comments=coalesce(nullif(trim(coalesce(p_comments,'')),''),comments),decided_at=now(),approver_id=coalesce(approver_id,v_actor) where id=v_approval.id;
 update public.documents set status=p_decision,approved_by=case when p_decision='approved' then v_actor else null end,approved_at=case when p_decision='approved' then now() else null end,updated_at=now() where id=p_document_id;
 insert into public.document_activity(document_id,action,comments,actor_id) values(p_document_id,p_decision,nullif(trim(coalesce(p_comments,'')),''),v_actor);
 return jsonb_build_object('document_id',p_document_id,'status',p_decision,'approval_id',v_approval.id);
end $$;

create or replace function public.document_cancel_v1(p_document_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_doc public.documents%rowtype;v_actor uuid:=auth.uid();begin
 if v_actor is null then raise exception 'Authentication required';end if;if not public.document_can_approve() then raise exception 'Only authorized controllers may cancel documents.';end if;if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Cancellation reason is required.';end if;
 select * into v_doc from public.documents where id=p_document_id for update;if not found then raise exception 'Document not found.';end if;if v_doc.status in ('superseded','cancelled') then raise exception 'Document is already closed.';end if;
 update public.approvals set status='cancelled',comments=coalesce(comments,p_reason),decided_at=now() where entity_type='document' and entity_id=p_document_id and status='pending';update public.documents set status='cancelled',approved_by=null,approved_at=null,updated_at=now() where id=p_document_id;
 insert into public.document_activity(document_id,action,comments,actor_id) values(p_document_id,'cancelled',p_reason,v_actor);return jsonb_build_object('document_id',p_document_id,'status','cancelled');end $$;

create or replace function public.document_supersede_v1(p_parent_id uuid,p_child_id uuid,p_comments text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_parent public.documents%rowtype;v_child public.documents%rowtype;v_actor uuid:=auth.uid();begin
 if v_actor is null then raise exception 'Authentication required';end if;if not public.document_can_write() then raise exception 'Document write permission required.';end if;
 select * into v_parent from public.documents where id=p_parent_id for update;if not found then raise exception 'Parent document not found.';end if;select * into v_child from public.documents where id=p_child_id for update;if not found then raise exception 'New revision not found.';end if;
 if v_child.parent_document_id is distinct from p_parent_id then raise exception 'New revision is not linked to the parent document.';end if;if coalesce(v_child.version,0)<=coalesce(v_parent.version,0) then raise exception 'Revision version must be greater than the parent version.';end if;if v_parent.status='superseded' then raise exception 'Parent document is already superseded.';end if;
 update public.documents set status='superseded',updated_at=now() where id=p_parent_id;insert into public.document_activity(document_id,action,comments,actor_id) values(p_parent_id,'superseded',coalesce(nullif(trim(coalesce(p_comments,'')),''),'Superseded by revision v'||v_child.version),v_actor);insert into public.document_activity(document_id,action,comments,actor_id) values(p_child_id,'revision_created','Revision of document '||p_parent_id::text,v_actor);return jsonb_build_object('parent_id',p_parent_id,'child_id',p_child_id,'parent_status','superseded');end $$;

revoke all on function public.document_submit_for_review_v1(uuid,uuid,text),public.document_decide_review_v1(uuid,text,text),public.document_cancel_v1(uuid,text),public.document_supersede_v1(uuid,uuid,text) from public,anon;
grant execute on function public.document_submit_for_review_v1(uuid,uuid,text),public.document_decide_review_v1(uuid,text,text),public.document_cancel_v1(uuid,text),public.document_supersede_v1(uuid,uuid,text) to authenticated,service_role;
