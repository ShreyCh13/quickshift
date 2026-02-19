-- Migration v4: checklist_items table for admin-configurable inspection checklist
-- Run this in Supabase SQL Editor (safe to run multiple times - uses IF NOT EXISTS)

-- ============================================================
-- 1. CHECKLIST ITEMS TABLE
-- Stores the inspection checklist items that can be managed by admins.
-- category_key/category_label define the section (exterior, interior, road_test).
-- item_key must be unique and matches the key stored in inspections.remarks_json.
-- ============================================================
create table if not exists public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  category_key   text not null check (length(category_key) between 1 and 100),
  category_label text not null check (length(category_label) between 1 and 200),
  item_key       text not null unique check (length(item_key) between 1 and 100),
  item_label     text not null check (length(item_label) between 1 and 300),
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.users(id) on delete set null,
  updated_by     uuid references public.users(id) on delete set null
);

create index if not exists checklist_items_category_idx on public.checklist_items (category_key);
create index if not exists checklist_items_is_active_idx on public.checklist_items (is_active);
create index if not exists checklist_items_sort_order_idx on public.checklist_items (sort_order);

drop trigger if exists checklist_items_set_updated_at on public.checklist_items;
create trigger checklist_items_set_updated_at
before update on public.checklist_items
for each row
execute function public.set_updated_at();

-- ============================================================
-- 2. SEED DEFAULT CHECKLIST ITEMS
-- Mirrors the INSPECTION_CATEGORIES in src/lib/constants.ts.
-- Uses INSERT ... ON CONFLICT DO NOTHING so it is safe to re-run.
-- ============================================================
insert into public.checklist_items (category_key, category_label, item_key, item_label, sort_order) values
  -- Exterior Inspection
  ('exterior', 'Exterior Inspection', 'body_condition',  'Body condition (scratches, dents, rust)',    1),
  ('exterior', 'Exterior Inspection', 'windshield',      'Windshield and windows (cracks, chips)',     2),
  ('exterior', 'Exterior Inspection', 'mirrors',         'Mirrors (side & rearview)',                  3),
  ('exterior', 'Exterior Inspection', 'headlights',      'Headlights / Tail lights / Indicators',      4),
  ('exterior', 'Exterior Inspection', 'brake_lights',    'Brake lights',                               5),
  ('exterior', 'Exterior Inspection', 'wipers',          'Wipers and washer fluid',                    6),
  ('exterior', 'Exterior Inspection', 'doors',           'Doors, locks, and handles',                  7),
  ('exterior', 'Exterior Inspection', 'tyres',           'Tyres (tread depth, condition)',              8),
  -- Interior Inspection
  ('interior', 'Interior Inspection', 'battery',         'Battery',                                    9),
  ('interior', 'Interior Inspection', 'seat_belts',      'Seat belts condition',                      10),
  ('interior', 'Interior Inspection', 'dashboard_warning','Dashboard warning lights',                 11),
  ('interior', 'Interior Inspection', 'speedometer',     'Speedometer functioning',                   12),
  ('interior', 'Interior Inspection', 'fuel_gauge',      'Fuel gauge working',                        13),
  ('interior', 'Interior Inspection', 'interior_lights', 'Interior lights',                           14),
  ('interior', 'Interior Inspection', 'handbrake',       'Handbrake functioning',                     15),
  ('interior', 'Interior Inspection', 'foot_brake',      'Foot brake response',                       16),
  ('interior', 'Interior Inspection', 'dry_cleaning',    'Dry Cleaning',                              17),
  -- Road Test
  ('road_test', 'Road Test', 'ac_heater',        'Air conditioning / Heater',    18),
  ('road_test', 'Road Test', 'engine_start',     'Smooth engine start',          19),
  ('road_test', 'Road Test', 'steering',         'Steering alignment',            20),
  ('road_test', 'Road Test', 'brake_performance','Brake performance',             21),
  ('road_test', 'Road Test', 'suspension',       'Suspension condition',          22),
  ('road_test', 'Road Test', 'unusual_noises',   'Unusual noises',                23),
  ('road_test', 'Road Test', 'gear_shifting',    'Gear shifting smooth',          24),
  ('road_test', 'Road Test', 'clutch',           'Clutch',                        25),
  ('road_test', 'Road Test', 'wheel_alignment',  'Wheel alignment',               26),
  ('road_test', 'Road Test', 'horn',             'Horn',                          27),
  ('road_test', 'Road Test', 'music_system',     'Music system',                  28)
on conflict (item_key) do nothing;
