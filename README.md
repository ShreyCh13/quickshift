# QuickShift

**A mobile-first PWA for fleet vehicle inspection and maintenance tracking.**

QuickShift is a production app that runs a real fleet operation — drivers and staff log
vehicle inspections and maintenance from their phones, online or off, and managers get a
live view across the fleet. Built end-to-end (UI, API, auth, database, offline sync) on
Next.js, TypeScript, and Supabase.

<!-- TODO: drop a screenshot or GIF of the mobile UI here — biggest single README upgrade. -->

## Highlights

- **Mobile-first PWA** — installable, works offline, syncs when the connection returns.
- **Real auth, built from primitives** — HMAC-SHA256 signed session tokens with
  constant-time verification, PBKDF2 password hashing, IP rate-limiting with progressive
  blocking after repeated failures.
- **Role-based access** — admin vs. staff, enforced in the API and the database (Supabase
  Row-Level Security policies via ordered SQL migrations).
- **Offline-first data layer** — optimistic React Query mutations, a service worker, and
  offline validation so the app stays usable and correct with no signal.
- **Soft-delete audit trail** and a Google-Sheets sync path for reporting.

## Tech stack

Next.js (App Router) · TypeScript · Supabase (Postgres + RLS) · React Query · Tailwind ·
PWA / service worker.

## Run it locally

```bash
npm install
cp env.example .env.local      # fill in your Supabase project + secrets
npm run dev
```

Required environment variables (see `env.example`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side admin operations |
| `SESSION_SECRET` | signs session tokens |
| `SEED_ADMIN_PASSWORD` / `SEED_STAFF_PASSWORD` | initial user passwords (required to seed; stored hashed) |

**Seed the first users:** `POST /api/seed` (passwords come from the env vars above and are
hashed before storage — no default passwords ship in the code).

## Project structure

```
src/
├── app/            # Next.js routes + API (auth, seed, vehicles, inspections)
├── features/       # per-domain api/components/page modules
├── components/     # shared UI
├── lib/            # session tokens, auth, offline, constants
└── hooks/
supabase/           # schema + ordered migrations
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design in depth.

## License

MIT — see [LICENSE](LICENSE).
