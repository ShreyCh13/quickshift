# QuickShift AI Guide

## System summary
- Mobile-first web app for vehicle inspections and maintenance logging.
- Core tables: `users`, `vehicles`, `remark_fields`, `inspections`, `maintenance`.
- Event types: inspections (remarks_json) and maintenance (supplier, amount).

## Where to change fields
- Add a new maintenance field:
  - Database: `supabase/schema.sql` (table `maintenance`)
  - Types: `src/lib/types.ts` (`MaintenanceRow`)
  - Validation: `src/lib/validation.ts` (`maintenanceCreateSchema`, `maintenanceUpdateSchema`)
  - API: `src/app/api/events/maintenance/route.ts`
  - UI: `src/features/maintenance/page.tsx`
  - Export: `src/app/api/export/route.ts`
- Change remark categories:
  - Table: `remark_fields` in `supabase/schema.sql`
  - Seed: `supabase/seed.sql`
  - Admin UI: `src/features/admin/page.tsx`
  - Inspection form: `src/features/inspections/page.tsx` + `src/features/inspections/components.tsx`

## API routes map
- `POST /api/auth/login` -> `src/app/api/auth/login/route.ts`
- `POST /api/auth/logout` -> `src/app/api/auth/logout/route.ts`
- `GET|POST|PUT|DELETE /api/users` -> `src/app/api/users/route.ts`
- `GET|POST|PUT|DELETE /api/vehicles` -> `src/app/api/vehicles/route.ts`
- `POST /api/vehicles/import` -> `src/app/api/vehicles/import/route.ts`
- `GET|POST|PUT|DELETE /api/events/inspections` -> `src/app/api/events/inspections/route.ts`
- `GET|POST|PUT|DELETE /api/events/maintenance` -> `src/app/api/events/maintenance/route.ts`
- `GET|POST|PUT|DELETE /api/config/remarks` -> `src/app/api/config/remarks/route.ts`
- `GET /api/export` -> `src/app/api/export/route.ts`
- `POST /api/backup` -> `src/app/api/backup/route.ts`
- `GET /api/analytics` -> `src/app/api/analytics/route.ts`

## Auth flow
- Seed: login page calls `GET /api/users?seedCheck=1`.
- Login: `POST /api/auth/login` validates username + password.
- Session stored in localStorage key `qs_session`.
- Session forwarded in every API call via header `x-qs-session: <stringified json>`.
- Server parses session in `src/lib/auth.ts` (`parseSessionFromRequest` + `requireSession`).
- This is intentionally simple and insecure. Replace later with Supabase Auth.

## RLS (deliberate choice)
- Row Level Security is OFF for all tables.
- All access control is enforced in API routes using `requireSession`.

## Filtering rules
- All filtering is server-side in API routes:
  - Inspections: `src/app/api/events/inspections/route.ts`
  - Maintenance: `src/app/api/events/maintenance/route.ts`
  - Vehicles: `src/app/api/vehicles/route.ts`
- Client sends filters as base64 JSON in `filters` query param.

## Export architecture
- `GET /api/export` reads filters and returns CSV or XLSX.
- XLSX generation: `src/lib/excel.ts`
- Export buttons fetch with session header and download from UI:
  - Vehicles: `src/features/vehicles/page.tsx`
  - Inspections: `src/features/inspections/page.tsx`
  - Maintenance: `src/features/maintenance/page.tsx`
  - Admin full export: `src/features/admin/page.tsx`

## Backup architecture
- `POST /api/backup`:
  - keep-alive query
  - CSV exports for vehicles/inspections/maintenance
  - uploads to S3-compatible storage
- Storage uploader: `src/lib/storage.ts`
- Workflow: `.github/workflows/weekly-backup.yml`

## Do not refactor rules
- Keep current file structure (no new layers).
- Keep auth helpers in `src/lib/auth.ts`.
- No hidden state managers or service classes.
- Keep API routes as direct, readable handlers.

## Test checklist
- Seed works on empty DB (login page triggers seed).
- Staff cannot access admin routes.
- Export downloads correct filtered rows.
- Backup uploads CSVs to S3 bucket.
