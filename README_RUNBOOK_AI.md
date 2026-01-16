# QuickShift Runbook (AI)

## Deploy steps
- Create Supabase project.
- Run schema: `supabase/schema.sql`.
- Optional: run seed: `supabase/seed.sql`.
- Deploy to Vercel (App Router project).
- Set Vercel env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `BACKUP_SECRET`
  - `S3_ENDPOINT`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
  - `S3_BUCKET`
  - `S3_REGION`
- Add GitHub Actions secrets:
  - `BACKUP_URL` (https://your-vercel-domain/api/backup)
  - `BACKUP_SECRET`

## DB initialization
- Apply schema: `supabase/schema.sql`.
- Optional seed: `supabase/seed.sql`.
- Runtime seeding still occurs on login page.

## Restore procedure
- Download latest CSV backups from S3.
- Create new Supabase project.
- Run `supabase/schema.sql`.
- Import CSVs in Supabase table editor:
  - `vehicles.csv` -> `vehicles`
  - `inspections.csv` -> `inspections`
  - `maintenance.csv` -> `maintenance`

## Key rotation
- Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase.
- Update Vercel env vars.
- Rotate S3 keys in storage provider.
- Update Vercel env vars.
- Rotate `BACKUP_SECRET` in Vercel and GitHub Actions secrets.

## Supabase pauses (free tier)
- Unpause project in Supabase.
- Call `POST /api/backup` manually to revive activity.
- Verify data via `/api/vehicles` list.
