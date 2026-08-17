-- Quotation status alignment v41
alter table public.quotations drop constraint if exists quotations_status_check;
alter table public.quotations add constraint quotations_status_check check (status in ('draft','sent','review','approved','accepted','rejected','expired','awarded','superseded'));
