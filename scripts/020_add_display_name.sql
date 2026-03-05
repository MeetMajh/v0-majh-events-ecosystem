-- Add display_name and full_name generated columns to profiles for Supabase select joins
-- Also add public read RLS policy so forum/esports queries can resolve profile names

-- Add generated columns (stored)
alter table public.profiles
  add column if not exists display_name text
    generated always as (coalesce(first_name, '') || ' ' || coalesce(last_name, '')) stored;

alter table public.profiles
  add column if not exists full_name text
    generated always as (coalesce(first_name, '') || ' ' || coalesce(last_name, '')) stored;

-- Allow anyone to read profiles (display_name, avatar_url) for public pages
-- Drop first in case it already exists
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);
