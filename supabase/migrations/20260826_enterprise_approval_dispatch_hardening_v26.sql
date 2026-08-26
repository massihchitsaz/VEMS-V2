-- Restore the deal approval hard lock and keep controlled modules on their official workflow RPCs.
create or replace function public.deal_approval_hard_lock_v1()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user not in ('postgres','service_role') then
    if tg_op='INSERT' and new.entity_type='deal' then raise exception 'Deal approvals must be created through the controlled deal approval workflow.'; end if;
    if tg_op='UPDATE' and (old.entity_type='deal' or new.entity_type='deal') then raise exception 'Deal approval decisions must use the controlled deal approval workflow.'; end if;
    if tg_op='DELETE' and old.entity_type='deal' then raise exception 'Deal approval history cannot be deleted directly.'; end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;$$;
-- enterprise_decide_approval_v1 now refuses document/deal/quotation/payment decisions; the client control layer dispatches those to their official governed RPCs.