-- Firma Clara · esquema mínimo para Supabase
-- Ejecuta este archivo completo en SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('sign', 'verify')),
  format text not null check (format in ('PDF', 'P7S', 'XML', 'JWS')),
  file_name text not null,
  file_size bigint not null check (file_size >= 0),
  status text not null check (status in ('valid', 'invalid', 'indeterminate', 'signed')),
  digest text,
  created_at timestamptz not null default now()
);

create index if not exists activities_user_created_idx
  on public.activities (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;

drop policy if exists "users_read_own_profile" on public.profiles;
create policy "users_read_own_profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "users_update_own_profile" on public.profiles;
create policy "users_update_own_profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "users_read_own_activities" on public.activities;
create policy "users_read_own_activities"
  on public.activities for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users_insert_own_activities" on public.activities;
create policy "users_insert_own_activities"
  on public.activities for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "users_delete_own_activities" on public.activities;
create policy "users_delete_own_activities"
  on public.activities for delete
  using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.activities to authenticated;
