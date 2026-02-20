-- Migration v6: Add staff users
-- Run this in Supabase SQL Editor (safe to re-run with ON CONFLICT)

insert into public.users (username, password, display_name, role)
values
  ('pradeep', 'pradeep24', 'Pradeep Jha', 'staff'),
  ('harinder', 'harinder31', 'Harinder Bisht', 'staff'),
  ('ramkumar', 'ramkumar7', 'Ram Kumar', 'staff'),
  ('vipin', 'vipinch99', 'Vipin Chauhan', 'staff'),
  ('amar', 'amarjha12', 'Amar Jha', 'staff'),
  ('ajay', 'ajayrout3', 'Ajay Rout', 'staff'),
  ('omprakash', 'omprakash8', 'Omprakash', 'staff')
on conflict (username) do nothing;
