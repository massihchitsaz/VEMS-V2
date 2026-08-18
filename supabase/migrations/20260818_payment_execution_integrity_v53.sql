create or replace function public.finance_create_payment_v1(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text:=public.finance_current_role(); v public.payments%rowtype; v_no text; v_type text; v_invoice public.invoices%rowtype;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.'; end if;
 if coalesce((p_payload->>'amount')::numeric,0)<=0 then raise exception 'Payment amount must be greater than zero.'; end if;
 v_type:=coalesce(p_payload->>'payment_type',''); if v_type not in ('receipt','payment') then raise exception 'Payment type must be receipt or payment.'; end if;
 if v_type='payment' and nullif(p_payload->>'supplier_id','') is null and length(btrim(coalesce(p_payload->>'beneficiary_name','')))<2 then raise exception 'Supplier or beneficiary is required for an outgoing payment.'; end if;
 if v_type='receipt' and nullif(p_payload->>'customer_id','') is null and nullif(p_payload->>'invoice_id','') is null then raise exception 'Customer or receivable invoice is required for a receipt.'; end if;
 if nullif(p_payload->>'invoice_id','') is not null then
  select * into v_invoice from public.invoices where id=(p_payload->>'invoice_id')::uuid; if not found then raise exception 'Invoice not found.'; end if;
  if v_type='receipt' and v_invoice.invoice_type<>'receivable' then raise exception 'Receipt can only reference a receivable invoice.'; end if;
  if v_type='payment' and v_invoice.invoice_type<>'payable' then raise exception 'Outgoing payment can only reference a payable invoice.'; end if;
  if coalesce(nullif(p_payload->>'currency',''),v_invoice.currency)<>v_invoice.currency then raise exception 'Payment currency must match invoice currency.'; end if;
 end if;
 v_no:=coalesce(nullif(btrim(p_payload->>'payment_no'),''),'PAY-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'));
 insert into public.payments(payment_no,invoice_id,deal_id,payment_type,currency,amount,payment_date,method,bank_name,reference_no,status,notes,created_by,supplier_id,customer_id,beneficiary_name,beneficiary_country,beneficiary_bank,beneficiary_iban,beneficiary_account_no,beneficiary_swift,intermediary_bank,source_account,purpose,priority,approval_required,approval_status,compliance_status,scheduled_date,bank_fee,fx_rate,instruction_reference)
 values(v_no,nullif(p_payload->>'invoice_id','')::uuid,nullif(p_payload->>'deal_id','')::uuid,v_type,coalesce(nullif(p_payload->>'currency',''),case when v_invoice.id is not null then v_invoice.currency else 'AED' end),(p_payload->>'amount')::numeric,coalesce(nullif(p_payload->>'payment_date','')::date,current_date),nullif(p_payload->>'method',''),nullif(p_payload->>'bank_name',''),nullif(p_payload->>'reference_no',''),'pending',nullif(p_payload->>'notes',''),v_user,nullif(p_payload->>'supplier_id','')::uuid,nullif(p_payload->>'customer_id','')::uuid,nullif(p_payload->>'beneficiary_name',''),nullif(p_payload->>'beneficiary_country',''),nullif(p_payload->>'beneficiary_bank',''),nullif(p_payload->>'beneficiary_iban',''),nullif(p_payload->>'beneficiary_account_no',''),nullif(p_payload->>'beneficiary_swift',''),nullif(p_payload->>'intermediary_bank',''),nullif(p_payload->>'source_account',''),nullif(p_payload->>'purpose',''),coalesce(nullif(p_payload->>'priority',''),'normal'),true,'pending',coalesce(nullif(p_payload->>'compliance_status',''),'pending'),nullif(p_payload->>'scheduled_date','')::date,coalesce(nullif(p_payload->>'bank_fee','')::numeric,0),nullif(p_payload->>'fx_rate','')::numeric,nullif(p_payload->>'instruction_reference','')) returning * into v;
 insert into public.finance_events(entity_type,entity_id,event_type,to_status,metadata,performed_by) values('payment',v.id,'payment_created','pending',jsonb_build_object('payment_no',v.payment_no,'amount',v.amount,'currency',v.currency,'type',v.payment_type),v_user);
 return to_jsonb(v);
end $$;

create or replace function public.finance_settle_payment_v1(p_payment_id uuid,p_outcome text,p_reference text default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text:=public.finance_current_role(); v public.payments%rowtype; v_to text;
begin
 if v_user is null or v_role not in ('admin','ceo','manager','finance') then raise exception 'Finance write access required.'; end if;
 if p_outcome not in ('completed','failed') then raise exception 'Outcome must be completed or failed.'; end if;
 select * into v from public.payments where id=p_payment_id for update; if not found then raise exception 'Payment not found.'; end if;
 if v.status<>'approved' then raise exception 'Only approved payments can be settled.'; end if;
 if p_outcome='completed' and coalesce(v.compliance_status,'pending')<>'clear' then raise exception 'Compliance must be clear before settlement.'; end if;
 if p_outcome='completed' and length(btrim(coalesce(p_reference,'')))<2 then raise exception 'Bank settlement reference is required.'; end if;
 if p_outcome='failed' and length(btrim(coalesce(p_reason,'')))<5 then raise exception 'Failure reason is required.'; end if;
 v_to:=p_outcome;
 update public.payments set status=v_to,reference_no=coalesce(nullif(btrim(p_reference),''),reference_no),executed_at=case when v_to='completed' then now() else executed_at end,settlement_status=case when v_to='completed' then 'settled' else 'failed' end,failure_reason=case when v_to='failed' then btrim(p_reason) else null end,updated_at=now() where id=p_payment_id returning * into v;
 if v_to='completed' and v.invoice_id is not null then perform public.finance_recalculate_invoice_status_v1(v.invoice_id); end if;
 insert into public.finance_events(entity_type,entity_id,event_type,from_status,to_status,reason,metadata,performed_by) values('payment',v.id,'payment_'||v_to,'approved',v_to,nullif(btrim(p_reason),''),jsonb_build_object('reference_no',v.reference_no),v_user);
 return to_jsonb(v);
end $$;
revoke all on function public.finance_create_payment_v1(jsonb) from public,anon;
revoke all on function public.finance_settle_payment_v1(uuid,text,text,text) from public,anon;
grant execute on function public.finance_create_payment_v1(jsonb) to authenticated,service_role;
grant execute on function public.finance_settle_payment_v1(uuid,text,text,text) to authenticated,service_role;
