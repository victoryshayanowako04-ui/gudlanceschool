create index if not exists idx_users_username
    on public.users (username);
create index if not exists idx_users_name
    on public.users (name);
create index if not exists idx_users_data_username
    on public.users ((data->>'username'));
create index if not exists idx_users_data_user
    on public.users ((data->>'user'));
create index if not exists idx_users_data_name
    on public.users ((data->>'name'));
