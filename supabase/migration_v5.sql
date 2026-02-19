-- Migration v5: Add 'dev' role + create dev user
-- Run this in Supabase SQL Editor (safe to run once)

-- ============================================================
-- 1. Widen the role check constraint to allow 'dev'
-- ============================================================
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (role in ('admin', 'staff', 'dev'));

-- ============================================================
-- 2. Insert dev user (shrey / shrey123)
--    Uses ON CONFLICT DO NOTHING so safe to re-run.
-- ============================================================
insert into public.users (username, password, display_name, role)
values ('shrey', 'shrey123', 'Shrey', 'dev')
on conflict (username) do nothing;
