# QuickShift

Mobile-first fleet vehicle inspection and maintenance tracking app.

## Tech Stack

- **Frontend**: Next.js 14, React 19, TypeScript, Tailwind CSS, React Query
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Deployment**: Vercel

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and fill in values
cp env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BACKUP_SECRET=your-backup-secret
S3_ENDPOINT=your-s3-endpoint
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=your-bucket-name
S3_REGION=your-region
```

## Database Setup

Run in Supabase SQL Editor:

1. **First time setup**: Run `supabase/schema.sql`
2. **Seed data (optional)**: Run `supabase/seed.sql`
3. **Existing database**: Run `supabase/migration_improvements.sql`

## Project Structure

```
src/
├── app/                    # Next.js pages and API routes
│   ├── api/               # Backend API endpoints
│   └── [pages]/           # Frontend pages
├── components/            # Shared UI components
├── features/              # Feature modules (vehicles, inspections, etc.)
├── hooks/                 # React hooks (React Query, debounce, etc.)
└── lib/                   # Utilities (auth, db, validation, etc.)
```

## Key Features

- Vehicle management with import/export
- Inspection logging with customizable remarks
- Maintenance tracking with costs
- Analytics dashboard
- Weekly automated backups to S3
- Soft delete for data preservation
- Rate limiting on login
- Password hashing for new users

## API Routes

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | User login |
| `GET/POST/PUT/DELETE /api/vehicles` | Vehicle CRUD |
| `POST /api/vehicles/import` | Bulk vehicle import |
| `GET/POST/PUT/DELETE /api/events/inspections` | Inspections CRUD |
| `GET/POST/PUT/DELETE /api/events/maintenance` | Maintenance CRUD |
| `GET /api/analytics` | Fleet analytics |
| `GET /api/export` | Data export (CSV/XLSX) |
| `POST /api/backup` | Trigger backup to S3 |

## Security Notes

- Passwords are hashed for new users (PBKDF2)
- Login is rate-limited (5 attempts/15 min)
- Sessions stored in localStorage (consider HTTP-only cookies for production)
- RLS is OFF - access control is in API routes

## Maintenance

- **Backups**: Automatic weekly via GitHub Actions
- **Logs**: Check Vercel and Supabase dashboards
- **Database**: Run migration file for upgrades

---

See `IMPROVEMENTS_LOG.md` for detailed changelog.
