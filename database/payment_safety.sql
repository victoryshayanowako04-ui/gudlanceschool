-- Run this once in the Supabase SQL Editor before enabling cross-device
-- duplicate reference protection in the application.

create table if not exists public.payment_reference_claims (
    reference text primary key,
    student_id text not null,
    source text not null,
    claimed_at timestamptz not null default now(),
    receipt_no text
);

alter table public.payment_reference_claims enable row level security;

-- Match the application’s authenticated staff workflow. Adapt these policies
-- if your project uses more restrictive Supabase roles.
drop policy if exists "staff can read payment reference claims" on public.payment_reference_claims;
create policy "staff can read payment reference claims"
on public.payment_reference_claims for select to anon, authenticated using (true);

drop policy if exists "staff can create payment reference claims" on public.payment_reference_claims;
create policy "staff can create payment reference claims"
on public.payment_reference_claims for insert to anon, authenticated with check (true);

drop policy if exists "staff can remove payment reference claims" on public.payment_reference_claims;
create policy "staff can remove payment reference claims"
on public.payment_reference_claims for delete to anon, authenticated using (true);

-- Check existing duplicates before adding unique receipt indexes manually.
-- select receipt_no, count(*) from public.payments where receipt_no is not null group by receipt_no having count(*) > 1;
-- select receipt_no, count(*) from public.student_ledger where receipt_no is not null group by receipt_no having count(*) > 1;