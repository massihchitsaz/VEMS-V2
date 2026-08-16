create or replace function public.document_is_valid_approver(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=p_user_id and p.active=true and lower(p.role::text) in ('admin','ceo','manager'))
$$;
revoke all on function public.document_is_valid_approver(uuid) from public,anon;
grant execute on function public.document_is_valid_approver(uuid) to authenticated,service_role;

create or replace function public.document_submit_for_review_v1(p_document_id uuid,p_approver_id uuid default null,p_comments text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_doc public.documents%rowtype;v_approval_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;if not public.document_can_write() then raise exception 'You do not have permission to submit documents for review.';end if;
 select * into v_doc from public.documents where id=p_document_id for update;if not found then raise exception 'Document not found.';end if;if v_doc.status not in ('draft','rejected') then raise exception 'Only draft or rejected documents can be submitted for review.';end if;
 if p_approver_id is not null and not public.document_is_valid_approver(p_approver_id) then raise exception 'Selected approver is not authorized for document approval.';end if;
 update public.approvals set status='cancelled',comments=coalesce(comments,'Superseded by a new review request'),decided_at=now() where entity_type='document' and entity_id=p_document_id and status='pending';
 insert into public.approvals(entity_type,entity_id,approval_type,requested_by,approver_id,status,comments) values('document',p_document_id,'document_review',auth.uid(),p_approver_id,'pending',nullif(trim(coalesce(p_comments,'')),'')) returning id into v_approval_id;
 perform set_config('app.document_status_write','on',true);update public.documents set status='under_review',approved_by=null,approved_at=null,updated_at=now() where id=p_document_id;
 insert into public.document_activity(document_id,action,comments,actor_id) values(p_document_id,'submitted_for_review',nullif(trim(coalesce(p_comments,'')),''),auth.uid());
 return jsonb_build_object('document_id',p_document_id,'status','under_review','approval_id',v_approval_id);
end $$;
