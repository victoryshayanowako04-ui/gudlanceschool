create extension if not exists pgcrypto;

create table if not exists public.chief_admin_verification_codes (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    code_hash text not null,
    expires_at timestamptz not null,
    verified_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists chief_admin_verification_codes_user_id_idx
    on public.chief_admin_verification_codes (user_id, created_at desc);

alter table public.chief_admin_verification_codes enable row level security;
