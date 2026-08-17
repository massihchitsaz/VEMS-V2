alter table public.deals drop constraint if exists deals_quantity_nonnegative;
alter table public.deals add constraint deals_quantity_nonnegative check (quantity is null or quantity>=0);
alter table public.deals drop constraint if exists deals_buy_price_nonnegative;
alter table public.deals add constraint deals_buy_price_nonnegative check (buy_price is null or buy_price>=0);
alter table public.deals drop constraint if exists deals_sell_price_nonnegative;
alter table public.deals add constraint deals_sell_price_nonnegative check (sell_price is null or sell_price>=0);
create or replace function public.deal_readiness_v1(p_deal_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.deals; blockers jsonb:='[]'::jsonb; warnings jsonb:='[]'::jsonb; c_status text; s_status text; s_kyc text; s_exp date; gp numeric; margin numeric; native_profit numeric;
begin
 select * into d from public.deals where id=p_deal_id; if not found then raise exception 'Deal not found.'; end if;
 if d.customer_id is null then blockers:=blockers||jsonb_build_array('Customer is required.'); else select status into c_status from public.customers where id=d.customer_id; if c_status is distinct from 'active' then blockers:=blockers||jsonb_build_array('Customer account must be active.'); end if; end if;
 if d.supplier_id is not null then select status,kyc_status,kyc_expiry_date into s_status,s_kyc,s_exp from public.suppliers where id=d.supplier_id; if s_status is distinct from 'active' then blockers:=blockers||jsonb_build_array('Supplier must be active.'); end if; if s_kyc is distinct from 'approved' then blockers:=blockers||jsonb_build_array('Supplier KYC must be approved.'); end if; if s_exp is not null and s_exp<current_date then blockers:=blockers||jsonb_build_array('Supplier KYC is expired.'); end if; else warnings:=warnings||jsonb_build_array('No supplier is linked to this deal.'); end if;
 if coalesce(d.amount,0)<=0 then blockers:=blockers||jsonb_build_array('Deal value must be greater than zero.'); end if;
 if d.commodity is not null and coalesce(d.quantity,0)<=0 then blockers:=blockers||jsonb_build_array('Commercial quantity must be greater than zero.'); end if;
 if d.buy_currency is distinct from d.sell_currency and (coalesce(d.buy_rate,0)<=0 or coalesce(d.sell_rate,0)<=0) then blockers:=blockers||jsonb_build_array('AED conversion rates are required for a cross-currency deal.'); end if;
 if d.buy_currency=d.sell_currency and d.buy_price is not null and d.sell_price is not null and d.quantity is not null then native_profit:=d.quantity*(d.sell_price-d.buy_price); else native_profit:=null; end if;
 gp:=case when d.buy_currency=d.sell_currency then coalesce(d.profit,native_profit,d.profit_aed,0) else coalesce(d.profit_aed,0) end;
 if gp<0 then blockers:=blockers||jsonb_build_array('Gross profit cannot be negative.'); elsif gp=0 then warnings:=warnings||jsonb_build_array('Gross profit is zero or has not been normalized to AED.'); end if;
 margin:=case when d.buy_currency=d.sell_currency and coalesce(d.amount,0)>0 and native_profit is not null then round((native_profit/d.amount)*100,2) when coalesce(d.amount,0)>0 and coalesce(d.profit_aed,0)<>0 then round((d.profit_aed/d.amount)*100,2) else 0 end;
 return jsonb_build_object('ready',jsonb_array_length(blockers)=0,'blockers',blockers,'warnings',warnings,'gross_profit',gp,'margin_percent',margin,'status',d.status::text,'cross_currency',d.buy_currency is distinct from d.sell_currency);
end $$;
revoke all on function public.deal_readiness_v1(uuid) from public,anon;
grant execute on function public.deal_readiness_v1(uuid) to authenticated,service_role;
