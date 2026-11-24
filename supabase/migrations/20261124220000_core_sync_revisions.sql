create table if not exists public.core_sync_state (
    table_name text primary key check (table_name in ('students', 'student_ledger', 'payments')),
    revision bigint not null default 1,
    updated_at timestamptz not null default now()
);

insert into public.core_sync_state (table_name, revision)
values ('students', 1), ('student_ledger', 1), ('payments', 1)
on conflict (table_name) do nothing;

alter table public.core_sync_state enable row level security;
revoke all on public.core_sync_state from public;
grant select on public.core_sync_state to anon, authenticated;
drop policy if exists "Core sync state is readable" on public.core_sync_state;
create policy "Core sync state is readable"
on public.core_sync_state
for select
to anon, authenticated
using (true);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.bump_gudlance_core_sync_revision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
    insert into public.core_sync_state (table_name, revision, updated_at)
    values (TG_TABLE_NAME, 2, clock_timestamp())
    on conflict (table_name)
    do update set
        revision = public.core_sync_state.revision + 1,
        updated_at = clock_timestamp();

    if TG_OP = 'DELETE' then
        return OLD;
    end if;
    return NEW;
end;
$$;

revoke all on function private.bump_gudlance_core_sync_revision() from public, anon, authenticated;

drop trigger if exists gudlance_core_sync_revision on public.students;
create trigger gudlance_core_sync_revision
after insert or update or delete on public.students
for each row execute function private.bump_gudlance_core_sync_revision();

drop trigger if exists gudlance_core_sync_revision on public.student_ledger;
create trigger gudlance_core_sync_revision
after insert or update or delete on public.student_ledger
for each row execute function private.bump_gudlance_core_sync_revision();

drop trigger if exists gudlance_core_sync_revision on public.payments;
create trigger gudlance_core_sync_revision
after insert or update or delete on public.payments
for each row execute function private.bump_gudlance_core_sync_revision();
