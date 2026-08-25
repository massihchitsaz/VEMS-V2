create or replace function public.quotation_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select lower(p.role::text)
       from public.profiles p
      where p.id = auth.uid()
        and p.active = true
      limit 1),
    'unknown'
  )
$$;

grant execute on function public.quotation_current_role() to authenticated;
