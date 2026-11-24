-- Run once in the Supabase SQL Editor to enable inventory descriptions
-- and configurable low-stock alerts in the shop inventory editor.

alter table public.inventory
    add column if not exists description text not null default '';

alter table public.inventory
    add column if not exists low_stock_threshold integer not null default 5;

alter table public.inventory
    alter column low_stock_threshold set default 5;