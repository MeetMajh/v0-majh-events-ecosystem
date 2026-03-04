-- MAJH EVENTS: Profiles table linked to Supabase auth.users
-- Stores user profile data: name, phone, birthday, address, points balance

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  birthday date,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  avatar_url text,
  points_balance integer not null default 0,
  marketing_email_opt_in boolean not null default false,
  marketing_sms_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- Users can insert their own profile
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Users can update their own profile
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Users can delete their own profile
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- Auto-update updated_at on row change
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();
