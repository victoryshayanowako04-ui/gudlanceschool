-- Create a dedicated Supabase table for School groceries.
-- Run once in the Supabase SQL Editor before using the module.

create table if not exists public.school_grocery_ledger (
    id smallint primary key default 1 check (id = 1),
    inventory jsonb not null default '[]'::jsonb,
    movements jsonb not null default '[]'::jsonb,
    reviews jsonb not null default '[]'::jsonb,
    last_updated timestamptz not null default now(),
    constraint school_grocery_inventory_is_array check (jsonb_typeof(inventory) = 'array'),
    constraint school_grocery_movements_are_array check (jsonb_typeof(movements) = 'array'),
    constraint school_grocery_reviews_are_array check (jsonb_typeof(reviews) = 'array')
);

alter table public.school_grocery_ledger enable row level security;

grant select, insert, update on public.school_grocery_ledger to anon, authenticated;

drop policy if exists "staff can read school grocery ledger" on public.school_grocery_ledger;
create policy "staff can read school grocery ledger"
on public.school_grocery_ledger for select to anon, authenticated using (true);

drop policy if exists "staff can create school grocery ledger" on public.school_grocery_ledger;
create policy "staff can create school grocery ledger"
on public.school_grocery_ledger for insert to anon, authenticated
with check (id = 1);

drop policy if exists "staff can update school grocery ledger" on public.school_grocery_ledger;
create policy "staff can update school grocery ledger"
on public.school_grocery_ledger for update to anon, authenticated
using (id = 1) with check (id = 1);

-- Move the earlier grocery record out of school_data if it exists. Keep it
-- there if a different dedicated ledger already exists, so reruns cannot
-- silently discard either copy.
insert into public.school_grocery_ledger (id, inventory, movements, reviews, last_updated)
select
    1,
    coalesce(settings -> 'inventory', '[]'::jsonb),
    coalesce(settings -> 'movements', '[]'::jsonb),
    coalesce(settings -> 'reviews', '[]'::jsonb),
    now()
from public.school_data
where id = 'school_groceries_inventory'
on conflict (id) do nothing;

delete from public.school_data legacy
where legacy.id = 'school_groceries_inventory'
  and exists (
      select 1
      from public.school_grocery_ledger grocery
      where grocery.id = 1
        and grocery.inventory = coalesce(legacy.settings -> 'inventory', '[]'::jsonb)
        and grocery.movements = coalesce(legacy.settings -> 'movements', '[]'::jsonb)
        and grocery.reviews = coalesce(legacy.settings -> 'reviews', '[]'::jsonb)
  );

insert into public.school_grocery_ledger (id)
values (1)
on conflict (id) do nothing;
