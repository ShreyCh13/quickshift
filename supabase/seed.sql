-- Default users are NOT seeded here. Create them via POST /api/seed, which reads
-- SEED_ADMIN_PASSWORD / SEED_STAFF_PASSWORD from the environment and stores the
-- passwords HASHED. Never put plaintext credentials in this file.

insert into public.remark_fields (key, label, sort_order, is_active)
values
  ('tyre', 'Tyre', 1, true),
  ('alignment', 'Alignment', 2, true),
  ('interiors', 'Interiors', 3, true),
  ('exteriors', 'Exteriors', 4, true),
  ('miscellaneous', 'Miscellaneous', 5, true)
on conflict (key) do nothing;
