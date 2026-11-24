-- Create a dedicated, independent Supabase table for School stationery.
-- Run once in the Supabase SQL Editor before using the module.

create table if not exists public.school_stationery_ledger (
    id smallint primary key default 1 check (id = 1),
    products jsonb not null default '[]'::jsonb,
    orders jsonb not null default '[]'::jsonb,
    movements jsonb not null default '[]'::jsonb,
    distributions jsonb not null default '[]'::jsonb,
    last_updated timestamptz not null default now(),
    constraint school_stationery_products_are_array check (jsonb_typeof(products) = 'array'),
    constraint school_stationery_orders_are_array check (jsonb_typeof(orders) = 'array'),
    constraint school_stationery_movements_are_array check (jsonb_typeof(movements) = 'array'),
    constraint school_stationery_distributions_are_array check (jsonb_typeof(distributions) = 'array')
);

alter table public.school_stationery_ledger enable row level security;

grant select, insert, update on public.school_stationery_ledger to anon, authenticated;

drop policy if exists "staff can read school stationery ledger" on public.school_stationery_ledger;
create policy "staff can read school stationery ledger"
on public.school_stationery_ledger for select to anon, authenticated using (true);

drop policy if exists "staff can create school stationery ledger" on public.school_stationery_ledger;
create policy "staff can create school stationery ledger" 
on public.school_stationery_ledger for insert to anon, authenticated
with check (id = 1);

drop policy if exists "staff can update school stationery ledger" on public.school_stationery_ledger;
create policy "staff can update school stationery ledger"
on public.school_stationery_ledger for update to anon, authenticated
using (id = 1) with check (id = 1);

insert into public.school_stationery_ledger (id)
values (1)
on conflict (id) do nothing;
