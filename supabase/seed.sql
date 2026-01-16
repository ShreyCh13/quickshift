insert into public.users (username, password, display_name, role)
values
  ('admin', 'admin123', 'Admin', 'admin'),
  ('mandu', 'mandu123', 'Mandu', 'staff')
on conflict (username) do nothing;

insert into public.remark_fields (key, label, sort_order, is_active)
values
  ('tyre', 'Tyre', 1, true),
  ('alignment', 'Alignment', 2, true),
  ('interiors', 'Interiors', 3, true),
  ('exteriors', 'Exteriors', 4, true),
  ('miscellaneous', 'Miscellaneous', 5, true)
on conflict (key) do nothing;
