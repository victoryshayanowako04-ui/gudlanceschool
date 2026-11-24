-- Add structured, independent charge lines to existing Pre-Sales receipts.
-- Run after the pre_enrollment_receipts table has been created.

alter table public.pre_enrollment_receipts
    add column if not exists charge_items jsonb not null default '[]'::jsonb;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.pre_enrollment_receipts'::regclass
          and conname = 'pre_enrollment_receipts_charge_items_array'
    ) then
        alter table public.pre_enrollment_receipts
            add constraint pre_enrollment_receipts_charge_items_array
            check (jsonb_typeof(charge_items) = 'array');
    end if;
end
$$;
