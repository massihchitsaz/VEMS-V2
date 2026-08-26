-- Enterprise approval decisions must update the governed module, not only the approvals row.
create or replace function public.enterprise_decide_approval_v1(p_approval_id uuid,p_decision text,p_comments text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.approvals%rowtype; actor uuid:=auth.uid(); v_decision text:=lower(p_decision);
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if v_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into a from public.approvals where id=p_approval_id for update;
  if not found then raise exception 'Approval not found'; end if;
  if a.status<>'pending' then raise exception 'Approval is no longer pending'; end if;
  if not public.enterprise_can_approve(a.module) then raise exception 'You are not authorized to decide this approval'; end if;
  if a.approver_id is not null and a.approver_id<>actor and public.enterprise_current_role()<>'admin' then raise exception 'Approval is assigned to another approver'; end if;
  if v_decision='rejected' and length(trim(coalesce(p_comments,'')))<3 then raise exception 'Rejection comments are required'; end if;
  if a.entity_type='document' then
    perform public.document_decide_review_v1(a.entity_id,v_decision,p_comments);
  elsif a.entity_type='deal' then
    perform public.deal_decide_approval_v1(a.id,v_decision,p_comments);
  elsif a.entity_type='quotation' then
    perform public.quotation_decide_v1(a.entity_id,v_decision,p_comments);
    update public.approvals set status=v_decision,approver_id=coalesce(approver_id,actor),comments=coalesce(nullif(trim(coalesce(p_comments,'')),''),comments),decided_at=now() where id=a.id;
  elsif a.entity_type='payment' then
    if v_decision='approved' then perform public.finance_approve_payment_v1(a.entity_id,p_comments);
    else perform public.finance_cancel_payment_v1(a.entity_id,p_comments); end if;
    update public.approvals set status=v_decision,approver_id=coalesce(approver_id,actor),comments=coalesce(nullif(trim(coalesce(p_comments,'')),''),comments),decided_at=now() where id=a.id;
  else
    update public.approvals set status=v_decision,approver_id=coalesce(approver_id,actor),comments=coalesce(nullif(trim(coalesce(p_comments,'')),''),comments),decided_at=now() where id=a.id;
  end if;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data) values(actor,'approval',p_approval_id::text,'enterprise_'||v_decision,jsonb_build_object('comments',p_comments,'module',a.module,'entity_type',a.entity_type,'entity_id',a.entity_id));
  return jsonb_build_object('approval_id',p_approval_id,'status',v_decision,'entity_type',a.entity_type,'entity_id',a.entity_id);
end;$$;