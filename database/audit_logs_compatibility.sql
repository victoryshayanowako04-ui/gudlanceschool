-- Bring the existing audit_logs table in line with the application logger.
-- action_type and created_at already exist in the deployed schema.
alter table public.audit_logs
    add column if not exists "user" text,
    add column if not exists role text,
    add column if not exists details text;
