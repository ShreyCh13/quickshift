# State Fleet - Fleet Management System

A production-ready, mobile-first fleet vehicle inspection and maintenance tracking application built for State Express. Handles hundreds of vehicles with thousands of entries per month.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Quick Start](#quick-start)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Frontend Structure](#frontend-structure)
7. [Core Systems](#core-systems)
8. [Security](#security)
9. [Performance & Scale](#performance--scale)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, TypeScript, Tailwind CSS 4
- **State Management**: TanStack React Query (server state), localStorage (session)
- **Data Fetching**: Custom hooks with retry logic, caching, and offline support

### Backend
- **API**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL 15+)
- **Storage**: AWS S3 (backups)
- **Caching**: In-memory cache with TTL (ready for Redis)
- **Rate Limiting**: In-memory (ready for Redis)

### DevOps
- **Hosting**: Vercel (Edge Functions)
- **CI/CD**: GitHub Actions (weekly backups)
- **Monitoring**: Vercel Analytics, Supabase Logs

---

## Architecture Overview

### Request Flow

```
User (Mobile/Desktop)
    ↓
Next.js Frontend (React + TanStack Query)
    ↓
API Routes (Next.js)
    ↓ ← Cache Layer (in-memory)
    ↓ ← Rate Limiter
    ↓
Supabase Client (PostgreSQL)
```

### Data Flow

1. **Client**: React Query manages cache, retries, and optimistic updates
2. **Server**: API routes validate, rate-limit, cache, and query database
3. **Database**: Soft deletes preserve audit trail, indexes optimize queries
4. **Backups**: Weekly automated S3 backups via GitHub Actions

### File Structure

```
state-fleet/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/login/             # Authentication pages
│   │   ├── (main)/                   # Main app pages
│   │   │   ├── page.tsx              # Dashboard (/)
│   │   │   ├── vehicles/             # Vehicle management
│   │   │   ├── inspections/          # Inspection logging
│   │   │   ├── maintenance/          # Maintenance tracking
│   │   │   ├── analytics/            # Analytics dashboard
│   │   │   └── admin/                # Admin panel
│   │   └── api/                      # Backend API routes
│   │       ├── auth/                 # Login/logout
│   │       ├── vehicles/             # Vehicle CRUD + import
│   │       ├── events/               # Inspections + maintenance
│   │       ├── analytics/            # Analytics queries
│   │       ├── export/               # CSV/Excel export
│   │       ├── backup/               # S3 backup trigger
│   │       ├── users/                # User management
│   │       ├── alerts/               # Fleet alerts
│   │       ├── suppliers/            # Suppliers CRUD
│   │       ├── drivers/              # Drivers CRUD
│   │       └── config/               # Checklist, remarks
│   ├── components/                   # Shared UI components
│   │   ├── MobileShell.tsx           # Mobile app wrapper
│   │   ├── BottomNav.tsx             # Mobile navigation
│   │   ├── TopBar.tsx                # Page header
│   │   ├── DataTable.tsx             # Responsive table
│   │   ├── FormField.tsx             # Form inputs
│   │   ├── Modal.tsx                 # Dialog/modal
│   │   ├── Toast.tsx                 # Notifications
│   │   ├── Skeleton.tsx              # Loading states
│   │   ├── ErrorBoundary.tsx         # Error handling
│   │   ├── QueryProvider.tsx         # React Query setup
│   │   └── ServiceWorkerRegistration.tsx # PWA registration
│   ├── features/                     # Feature modules
│   │   ├── vehicles/                 # Vehicle feature
│   │   │   ├── page.tsx              # Main page logic
│   │   │   ├── components.tsx        # Feature-specific components
│   │   │   └── api.ts                # Feature-specific API calls
│   │   ├── inspections/              # Inspection feature
│   │   ├── maintenance/              # Maintenance feature
│   │   ├── analytics/                # Analytics feature
│   │   └── admin/                    # Admin feature
│   ├── hooks/                        # React hooks
│   │   ├── useQueries.ts             # React Query hooks
│   │   ├── useDebounce.ts            # Debounce hook
│   │   ├── useSession.ts             # Session management
│   │   ├── useOnlineStatus.ts        # Network status
│   │   └── index.ts                  # Hook exports
│   └── lib/                          # Core utilities
│       ├── db.ts                     # Supabase client
│       ├── auth.ts                   # Authentication logic
│       ├── cache.ts                  # Server-side caching
│       ├── rate-limit.ts             # Rate limiting
│       ├── password.ts               # Password hashing (PBKDF2)
│       ├── validation.ts             # Zod schemas
│       ├── types.ts                  # TypeScript types
│       ├── constants.ts              # App constants
│       ├── api-utils.ts              # API helpers
│       ├── excel.ts                  # Excel/CSV export
│       ├── storage.ts                # S3 operations
│       └── offline.ts                # Offline queue (IndexedDB)
├── supabase/                         # Database files
│   ├── schema.sql                    # Full schema (fresh install)
│   ├── migration_improvements.sql    # Production enhancements (existing DB)
│   ├── migration_v2.sql              # Suppliers, drivers, supplier_invoice_number
│   ├── migration_v3.sql              # maintenance_vehicle_summary view, RLS for Sheets sync
│   ├── migration_v4.sql              # checklist_items table
│   ├── migration_v5.sql              # dev role + dev user
│   └── seed.sql                      # Sample data
├── data/                             # Sample data files
│   └── vehicles.csv                  # Vehicle import template
├── public/                           # Static assets & PWA
│   ├── manifest.json                 # Web App Manifest
│   └── sw.js                         # Service Worker
└── .github/workflows/                # CI/CD
    └── weekly-backup.yml             # Automated backups
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase account
- (Optional) AWS S3 for backups

### Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd Maintainence

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp env.example .env.local
# Edit .env.local with your credentials

# 4. Set up database (in Supabase SQL Editor)
#   a. Fresh install: Run supabase/schema.sql (includes suppliers, drivers)
#   b. Existing DB: Run migration_improvements.sql, migration_v2.sql, migration_v3.sql, migration_v4.sql, migration_v5.sql
#   c. (optional) Run supabase/seed.sql for sample data

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Default Credentials (after running seed.sql)

```
Admin: admin / admin123
Staff: mandu / mandu123
```

**⚠️ Change these immediately in production!**

---

## Database Schema

### Core Tables

#### `users`
User accounts with role-based access control.

```sql
- id: uuid (PK)
- username: text (unique, required)
- password: text (hashed with PBKDF2)
- display_name: text
- role: text ('admin' | 'staff')
- created_at: timestamptz
- updated_at: timestamptz
```

#### `vehicles`
Fleet vehicles with soft delete support.

```sql
- id: uuid (PK)
- vehicle_code: text (unique, indexed)
- plate_number: text (indexed)
- brand: text
- model: text
- year: integer
- notes: text
- is_active: boolean (soft delete)
- created_at: timestamptz
- updated_at: timestamptz
```

**Indexes**: `vehicle_code`, `plate_number`, `is_active`, `brand`

#### `inspections`
Daily vehicle inspection records with customizable remarks.

```sql
- id: uuid (PK)
- vehicle_id: uuid (FK → vehicles, ON DELETE RESTRICT)
- odometer_km: integer
- driver_name: text
- remarks_json: jsonb (custom fields)
- is_deleted: boolean (soft delete)
- deleted_at: timestamptz
- deleted_by: uuid (FK → users)
- created_at: timestamptz
- created_by: uuid (FK → users, ON DELETE SET NULL)
- updated_at: timestamptz
- updated_by: uuid (FK → users)
```

**Indexes**: `vehicle_id+created_at`, `created_at`, `is_deleted`, `odometer_km`, `remarks_json` (GIN)

#### `maintenance`
Maintenance/repair records with cost tracking.

```sql
- id: uuid (PK)
- vehicle_id: uuid (FK → vehicles, ON DELETE RESTRICT)
- odometer_km: integer
- bill_number: text (indexed)
- supplier_name: text (full-text indexed)
- supplier_invoice_number: text (indexed)
- amount: numeric(12,2)
- remarks: text
- is_deleted: boolean (soft delete)
- deleted_at: timestamptz
- deleted_by: uuid (FK → users)
- created_at: timestamptz
- created_by: uuid (FK → users, ON DELETE SET NULL)
- updated_at: timestamptz
- updated_by: uuid (FK → users)
```

**Indexes**: `vehicle_id+created_at`, `created_at`, `is_deleted`, `odometer_km`, `bill_number`, `supplier_name` (trigram), `amount`

#### `checklist_items`
Admin-configurable inspection checklist (categories: exterior, interior, road_test).

```sql
- id: uuid (PK)
- category_key: text
- category_label: text
- item_key: text (unique, matches remarks_json keys)
- item_label: text
- sort_order: integer
- is_active: boolean
- created_at: timestamptz
```

#### `suppliers` / `drivers`
Reference tables for maintenance suppliers and inspection drivers.

```sql
- id: uuid (PK)
- name: text (unique)
- is_active: boolean
- created_at, updated_at, created_by
```

### Database Views

#### `maintenance_vehicle_summary` (migration_v3)
Pre-aggregated maintenance cost per vehicle. Used by Google Sheets sync.

#### `vehicle_stats`
Pre-aggregated vehicle analytics (created by migration_improvements).

```sql
SELECT 
  vehicle_id,
  vehicle_code,
  plate_number,
  brand,
  model,
  COUNT(DISTINCT inspections) as inspection_count,
  COUNT(DISTINCT maintenance) as maintenance_count,
  SUM(maintenance.amount) as total_cost,
  MAX(inspections.created_at) as last_inspection,
  MAX(maintenance.created_at) as last_maintenance
FROM vehicles
LEFT JOIN inspections ON ... WHERE is_deleted = false
LEFT JOIN maintenance ON ... WHERE is_deleted = false
GROUP BY vehicle_id
```

### Key Design Decisions

1. **Soft Deletes**: `is_deleted`, `deleted_at`, `deleted_by` preserve audit trail
2. **Foreign Keys**: `ON DELETE RESTRICT` on vehicles prevents accidental data loss
3. **User Deletion**: `ON DELETE SET NULL` on `created_by` allows user removal without losing records
4. **Audit Trail**: `created_by`, `updated_by`, `created_at`, `updated_at` on all tables
5. **Indexing**: Composite indexes on `(vehicle_id, created_at)` for efficient pagination
6. **JSONB**: Flexible `remarks_json` field for dynamic inspection checklist
7. **Google Sheets Sync**: `maintenance_vehicle_summary` view + anon RLS (migration_v3) for external sync

---

## API Reference

All API routes require authentication via `x-sf-session` header (managed automatically by frontend).

### Authentication

#### `POST /api/auth/login`
**Rate Limit**: 5 attempts / 15 minutes

```json
// Request
{
  "username": "admin",
  "password": "admin123"
}

// Response (200)
{
  "user": {
    "id": "uuid",
    "username": "admin",
    "displayName": "Admin User",
    "role": "admin"
  },
  "loginAt": 1234567890
}
```

#### `POST /api/auth/logout`
Clears session (client-side).

---

### Vehicles

#### `GET /api/vehicles`
List vehicles with pagination and search.

**Query Params**:
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 200)
- `search`: Search by vehicle code, plate, brand, or model
- `isActive`: Filter by active status (`true` | `false`)

```json
// Response
{
  "vehicles": [...],
  "total": 100
}
```

#### `POST /api/vehicles`
Create new vehicle (admin only).

```json
// Request
{
  "vehicle_code": "HR38-1234",
  "plate_number": "HR38-1234",
  "brand": "TOYOTA",
  "model": "FORTUNER",
  "year": 2024,
  "notes": "Optional notes",
  "is_active": true
}
```

#### `PUT /api/vehicles`
Update vehicle (admin only).

#### `DELETE /api/vehicles`
Soft delete vehicle (admin only). **Always** soft deletes to preserve data integrity.

```json
// Request
{
  "id": "uuid"
}

// Response
{
  "success": true,
  "soft": true,
  "relatedRecords": {
    "inspectionCount": 10,
    "maintenanceCount": 5
  }
}
```

#### `POST /api/vehicles/import`
Bulk import vehicles from CSV/Excel (admin only).
**Rate Limit**: 5 imports / 5 minutes

```
Content-Type: multipart/form-data
file: CSV/Excel file with columns: vehicle_code, brand, model, year
```

---

### Inspections

#### `GET /api/events/inspections`
List inspections with filters and pagination.

**Query Params**:
- `page`, `pageSize`: Pagination
- `filters`: Base64-encoded JSON filter object:
  ```json
  {
    "vehicle_id": "uuid",
    "vehicle_query": "search text",
    "brand": "TOYOTA",
    "date_from": "2024-01-01",
    "date_to": "2024-12-31",
    "odometer_min": 0,
    "odometer_max": 100000
  }
  ```

**Response**: Returns inspections with nested vehicle data (batched query, no N+1).

```json
{
  "inspections": [{
    "id": "uuid",
    "vehicle_id": "uuid",
    "odometer_km": 50000,
    "driver_name": "John Doe",
    "remarks_json": {
      "engine": "Good",
      "brakes": "Fair"
    },
    "created_at": "2024-01-15T10:30:00Z",
    "vehicles": {
      "vehicle_code": "HR38-1234",
      "plate_number": "HR38-1234",
      "brand": "TOYOTA",
      "model": "FORTUNER"
    }
  }],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

#### `POST /api/events/inspections`
Create inspection (admin/staff).

```json
{
  "vehicle_id": "uuid",
  "odometer_km": 50000,
  "driver_name": "John Doe",
  "remarks_json": {
    "engine": "Good",
    "brakes": "Fair"
  }
}
```

#### `PUT /api/events/inspections`
Update inspection (admin/staff, staff can only edit own records).

#### `DELETE /api/events/inspections`
Soft delete inspection (admin only). Sets `is_deleted=true`, `deleted_at`, `deleted_by`.

---

### Maintenance

Same structure as inspections, with additional fields:

```json
{
  "vehicle_id": "uuid",
  "odometer_km": 50000,
  "bill_number": "INV-2024-001",
  "supplier_name": "Auto Service Center",
  "amount": 5000.00,
  "remarks": "Oil change and brake service"
}
```

---

### Analytics

#### `GET /api/analytics`
Fleet-wide statistics.

**Query Params**:
- `brand`: Filter by brand
- `vehicle_id`: Filter by vehicle

```json
{
  "summary": {
    "totalVehicles": 50,
    "totalInspections": 1500,
    "totalMaintenance": 500,
    "totalMaintenanceCost": 250000.00
  },
  "byVehicle": [{
    "vehicle_id": "uuid",
    "vehicle_code": "HR38-1234",
    "brand": "TOYOTA",
    "inspections": 30,
    "maintenance": 10,
    "cost": 50000.00
  }]
}
```

---

### Export

#### `GET /api/export`
Export data to CSV or Excel.
**Rate Limit**: 10 exports / 5 minutes

**Query Params**:
- `type`: `vehicles` | `inspections` | `maintenance`
- `format`: `csv` | `xlsx` (default: xlsx)
- `filters`: Base64-encoded filter object (same as list endpoints)

**Response**: File download

---

### Backup

#### `POST /api/backup`
Trigger S3 backup (requires `BACKUP_SECRET`).

```bash
curl -X POST https://your-app.vercel.app/api/backup \
  -H "Authorization: Bearer YOUR_BACKUP_SECRET"
```

**Response**:
```json
{
  "success": true,
  "uploads": [...],
  "counts": {
    "vehicles": 50,
    "inspections": 1500,
    "maintenance": 500
  }
}
```

---

### Users

#### `GET /api/users`
List all users (admin only), paginated.

#### `POST /api/users`
Create user (admin only). Password is automatically hashed.

```json
{
  "username": "newuser",
  "password": "SecureP@ssw0rd",
  "display_name": "New User",
  "role": "staff"
}
```

#### `PUT /api/users`
Update user (admin only).

#### `DELETE /api/users`
Delete user with cascade check (admin only).

```json
// Request
{
  "id": "uuid",
  "force": false  // Set true to delete despite related records
}

// Response (409 if has related records)
{
  "error": "User has related records",
  "inspectionCount": 50,
  "maintenanceCount": 20
}
```

---

### Configuration

#### `GET /api/config/checklist`
Get inspection checklist items (admin-configurable).

#### `POST/PUT/DELETE /api/config/checklist`
Manage checklist items (admin only). DELETE soft-deactivates.

#### `GET /api/config/remarks`
Get legacy remark fields (if using remark_fields table).

---

### Alerts

#### `GET /api/alerts`
Fleet alerts (overdue inspections, maintenance due, odometer gaps, recurring failures).

**Response**: `{ summary: { critical, warning }, alerts: FleetAlert[] }`

---

### Suppliers & Drivers

#### `GET/POST/PUT/DELETE /api/suppliers`
Manage maintenance suppliers (admin only).

#### `GET/POST/PUT/DELETE /api/drivers`
Manage drivers for inspections (admin only).

---

## Frontend Structure

### Component Hierarchy

```
App
├── QueryProvider (React Query)
├── Layout (Shell + Navigation)
└── Pages
    ├── Dashboard (/) - Quick stats + recent activity
    ├── Vehicles (/vehicles)
    │   ├── Vehicle List (infinite scroll)
    │   ├── Vehicle History (/vehicles/history?vehicle=uuid)
    │   └── Import Modal
    ├── Inspections (/inspections)
    │   ├── Inspection List (infinite scroll)
    │   └── New Inspection (/inspections/new)
    ├── Alerts (/alerts) - Overdue inspections, maintenance due, recurring failures
    ├── Maintenance (/maintenance)
    │   ├── Maintenance List (infinite scroll)
    │   └── New Maintenance (/maintenance/new)
    ├── Analytics (/analytics) - Charts + filters
    ├── Admin (/admin) - User + config management
    └── Settings (/settings) - User preferences
```

### Key Patterns

#### 1. Feature Module Pattern
Each feature has:
- `page.tsx`: Main page logic (uses hooks)
- `components.tsx`: Feature-specific UI components
- `api.ts`: Feature-specific API calls (optional)

#### 2. Data Fetching Pattern
```typescript
// Using React Query hooks
import { useInspectionsInfinite } from "@/hooks/useQueries";

const { data, fetchNextPage, hasNextPage, isLoading } = 
  useInspectionsInfinite(filters);
```

#### 3. Mutation Pattern
```typescript
import { useCreateInspection } from "@/hooks/useQueries";

const createMutation = useCreateInspection();

await createMutation.mutateAsync({
  vehicle_id,
  odometer_km,
  remarks_json
});
// React Query automatically invalidates and refetches
```

#### 4. Mobile-First UI
- All pages use `<MobileShell>` wrapper
- Bottom navigation for main sections
- Touch-friendly buttons (44px minimum)
- Responsive tables collapse on mobile

---

## 7. Core Systems

### 0. PWA & Installability

**Location**: `public/manifest.json`, `public/sw.js`, `src/components/ServiceWorkerRegistration.tsx`

The app is a fully installable Progressive Web App (PWA). 

**Features**:
- **Manifest**: Defines app identity and theme colors.
- **Service Worker**: Enables browser install prompts and basic asset caching.
- **iOS Support**: Includes Apple-specific meta tags for "Add to Home Screen" functionality.

### 1. Authentication System

**Location**: `src/lib/auth.ts`

**Flow**:
1. User submits credentials to `/api/auth/login`
2. Server validates password (PBKDF2 hash comparison)
3. Server generates session object with user data and timestamp
4. Client stores session in localStorage
5. Client includes `x-sf-session` header on all requests
6. Server validates session TTL (24 hours)

**Session Object**:
```typescript
{
  user: {
    id: string
    username: string
    displayName: string
    role: 'admin' | 'staff'
  },
  loginAt: number  // Unix timestamp
}
```

**Security Notes**:
- Sessions stored in localStorage (consider httpOnly cookies for production)
- No CSRF protection (stateless sessions)
- Rate limiting on login endpoint (5 attempts / 15 minutes)
- Passwords hashed with PBKDF2 (100k iterations, SHA-256)

---

### 2. Caching System

**Location**: `src/lib/cache.ts`

**Features**:
- In-memory cache with TTL
- Automatic cleanup (every 5 minutes)
- Race condition prevention (promise deduplication)
- Max size enforcement (1000 entries)
- Cache statistics

**Usage**:
```typescript
import { getOrSetCache, invalidateCache } from "@/lib/cache";

// Get or fetch data
const data = await getOrSetCache(
  "vehicles:all",
  5 * 60 * 1000,  // 5 minutes TTL
  async () => {
    // Fetch from database
    return await db.from("vehicles").select();
  }
);

// Invalidate on mutation
invalidateCache("vehicles:");  // Clears all vehicle-* keys
```

**Cache Invalidation**:
- Vehicles: Create/update/delete → invalidate `vehicles:*` and `analytics:*`
- Inspections: Create/update/delete → invalidate `analytics:*`
- Maintenance: Create/update/delete → invalidate `analytics:*`

**Ready for Redis**: Replace `Map` with Redis client, no API changes needed.

---

### 3. Rate Limiting System

**Location**: `src/lib/rate-limit.ts`

**Implementation**:
- In-memory store (resets on server restart)
- Sliding window algorithm
- IP-based tracking
- Automatic cleanup (every 5 minutes)

**Presets**:
```typescript
{
  login: { limit: 5, windowMs: 15 * 60 * 1000 },
  import: { limit: 5, windowMs: 5 * 60 * 1000 },
  export: { limit: 10, windowMs: 5 * 60 * 1000 }
}
```

**Usage**:
```typescript
import { checkRateLimit, getClientIp, rateLimitPresets } from "@/lib/rate-limit";

const ip = getClientIp(req);
const result = checkRateLimit(ip, rateLimitPresets.login.limit, rateLimitPresets.login.windowMs);

if (!result.allowed) {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429 }
  );
}
```

**Ready for Redis**: Replace `Map` with Redis, no API changes needed.

---

### 4. Offline Support System

**Location**: `src/lib/offline.ts`

**Features**:
- IndexedDB-based queue for offline mutations
- Automatic retry with exponential backoff
- Network status detection
- Queue persistence across sessions

**Not yet integrated into UI** - infrastructure is ready.

---

### 5. Export System

**Location**: `src/lib/excel.ts`, `src/app/api/export/route.ts`

**Features**:
- CSV and Excel (.xlsx) export
- Filtered exports (same filters as list views)
- 10,000 row limit per export
- Rate limited (10 exports / 5 minutes)

**Formats**:
```typescript
// CSV: Simple comma-separated
vehicle_code,brand,model,year
HR38-1234,TOYOTA,FORTUNER,2024

// Excel: Multiple sheets with formatting
Sheet 1: Summary
Sheet 2: Data
```

---

### 6. Alerts System

**Location**: `src/app/api/alerts/route.ts`, `src/features/alerts/`

Fleet-wide alerts: overdue inspections, maintenance due, odometer gaps, recurring checklist failures. Thresholds configurable in route.

### 7. Backup System

**Location**: `src/app/api/backup/route.ts`, `.github/workflows/weekly-backup.yml`

**Features**:
- Automated weekly backups to S3
- Paginated fetching (5000 rows/batch) to prevent memory issues
- Backs up: vehicles, inspections, maintenance
- Trigger via webhook with secret authentication

**GitHub Action**:
```yaml
schedule:
  - cron: '0 2 * * 0'  # Every Sunday at 2 AM UTC
```

---

## Security

### Current Implementation

1. **Password Hashing**: PBKDF2 with 100k iterations
2. **Rate Limiting**: Login (5/15min), Import (5/5min), Export (10/5min)
3. **Session TTL**: 24 hours
4. **Soft Deletes**: Preserve audit trail
5. **Role-Based Access**: Admin vs Staff permissions
6. **Input Validation**: Zod schemas on all inputs

### Known Limitations

1. **Session Storage**: localStorage (vulnerable to XSS)
   - **Mitigation**: Consider httpOnly cookies
2. **No CSRF Protection**: Stateless sessions
   - **Mitigation**: Add CSRF tokens for state-changing operations
3. **RLS Disabled**: Access control in API routes only
   - **Mitigation**: Enable Row Level Security in Supabase
4. **Rate Limiting**: In-memory (resets on deploy)
   - **Mitigation**: Use Redis for production

### Recommendations for Production

1. **Move to httpOnly cookies** for session storage
2. **Enable RLS** in Supabase for defense-in-depth
3. **Add CSRF tokens** for mutations
4. **Use Redis** for rate limiting
5. **Add request signing** for sensitive operations
6. **Implement audit logging** for all mutations

---

## Performance & Scale

### Current Capacity

Tested and optimized for:
- **100+ vehicles**
- **Hundreds of entries per day**
- **Growing to 50K+ records** without degradation

### Optimizations Applied

#### 1. Database

**Indexes**:
- Composite indexes on `(vehicle_id, created_at)` for efficient pagination
- Partial indexes on `is_deleted=false` to exclude soft-deleted rows
- Full-text indexes (pg_trgm) on `supplier_name` and `remarks`
- GIN index on `remarks_json` for JSONB queries
- B-tree indexes on `odometer_km` for range queries

**Queries**:
- **N+1 Prevention**: Batched vehicle lookups (1 query instead of N)
- **Pagination**: Limit 20-50 rows per page, infinite scroll
- **Soft Deletes**: Filter at query level, preserve data
- **Analytics View**: Pre-aggregated stats for dashboard

**Performance Gains**:
- Inspection list: **96% fewer queries** (51 → 2)
- Maintenance list: **96% fewer queries** (51 → 2)
- Vehicle import: **10x faster** (parallel batching)

#### 2. API

**Caching**:
- Server-side cache with 5-minute TTL
- React Query cache with 30-second stale time
- Automatic invalidation on mutations

**Rate Limiting**:
- Prevents abuse and resource exhaustion
- Protects database from concurrent spikes

**Pagination**:
- All list endpoints paginated
- Default: 20 items, max: 200 items
- Backup endpoint: 5000 items/batch

#### 3. Frontend

**React Query**:
- Automatic caching and deduplication
- Background refetching
- Optimistic updates
- Retry with exponential backoff

**Infinite Scroll**:
- Loads data on-demand
- Reduces initial page load
- Skeleton loaders for perceived performance

**Code Splitting**:
- Next.js automatic code splitting
- Feature modules loaded on-demand

---

## Deployment

### Environment Variables

```bash
# Supabase (required)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Backup (optional, for S3 backups)
BACKUP_SECRET=random-secret-string
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET=state-fleet-backups
S3_REGION=us-east-1
```

### Vercel Deployment

1. **Connect GitHub repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy**: Vercel auto-deploys on push to main

### Database Setup

Run these in Supabase SQL Editor **in order**:

```sql
-- 1. Fresh install: Run supabase/schema.sql
-- 2. Existing DB: Run migration_improvements.sql, then migration_v2.sql, migration_v3.sql, migration_v4.sql
-- 3. Seed data (optional): supabase/seed.sql
```

### Post-Deployment Checklist

- [ ] Change default user passwords
- [ ] Test login rate limiting
- [ ] Verify S3 backup webhook
- [ ] Check Vercel function logs
- [ ] Monitor Supabase connection pool
- [ ] Test mobile responsiveness
- [ ] Verify export functionality

---

## Troubleshooting

### Common Issues

#### 1. "Database connection failed"
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Verify Supabase project is not paused
- Check Vercel function logs for detailed error

#### 2. "Session expired" on every request
- Check client system time (must be synchronized)
- Verify `SESSION_TTL_MS` in `src/lib/auth.ts`
- Clear localStorage and re-login

#### 3. "Rate limit exceeded"
- Wait for rate limit window to expire (15 minutes for login)
- Check IP in rate limit store (admin debug endpoint)
- In development, restart server to reset rate limits

#### 4. "Import failed" with no error
- Check CSV format (columns: vehicle_code, brand, model, year)
- Verify no duplicate vehicle codes
- Check Vercel function logs for validation errors

#### 5. Slow query performance
- Run `EXPLAIN ANALYZE` on slow queries
- Verify indexes exist: `\d+ tablename` in psql
- Check Supabase connection pool usage
- Consider adding materialized views for analytics

### Debug Endpoints

#### `GET /debug`
System diagnostics page showing:
- Session status
- Database record counts
- Latest inspections/maintenance
- API endpoint tests

**Access**: Navigate to `/debug` in browser

---

## Development Workflow

### Local Development

```bash
# Start dev server with hot reload
npm run dev

# Run linter
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

### Database Changes

1. **Update schema**: Edit `supabase/schema.sql`
2. **Create migration**: Add to `supabase/migration_improvements.sql`
3. **Test migration**: Run on dev database first
4. **Update types**: Update `src/lib/types.ts`
5. **Update validation**: Update Zod schemas in `src/lib/validation.ts`

### Adding a Feature

1. **Create feature folder**: `src/features/my-feature/`
2. **Add page logic**: `page.tsx`
3. **Add components**: `components.tsx`
4. **Add API route**: `src/app/api/my-feature/route.ts`
5. **Add queries**: Add hooks to `src/hooks/useQueries.ts`
6. **Add types**: Update `src/lib/types.ts`
7. **Add validation**: Add schemas to `src/lib/validation.ts`

---

## Code Style & Conventions

### TypeScript
- Strict mode enabled
- Explicit types preferred
- No `any` types
- Use Zod for runtime validation

### React
- Functional components only
- Hooks for state management
- React Query for server state
- Controlled components for forms

### CSS
- Tailwind utility classes
- No custom CSS except globals
- Mobile-first responsive design
- 44px minimum touch targets

### API Routes
- RESTful conventions
- Consistent error responses
- Always log errors with `console.error`
- Return proper HTTP status codes

### Database
- Snake_case for column names
- Soft deletes with `is_deleted`, `deleted_at`, `deleted_by`
- Audit fields on all tables
- Foreign keys with explicit `ON DELETE` behavior

---

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Database**:
   - Connection pool usage
   - Slow query log (>100ms)
   - Index usage (pg_stat_user_indexes)
   - Table sizes (pg_total_relation_size)

2. **API**:
   - Response times (p50, p95, p99)
   - Error rate (5xx responses)
   - Rate limit hits
   - Cache hit rate

3. **Frontend**:
   - Page load time
   - Core Web Vitals (LCP, FID, CLS)
   - React Query cache hit rate

### Maintenance Tasks

**Weekly**:
- Review Vercel function logs
- Check Supabase disk usage
- Verify backup success

**Monthly**:
- Analyze slow queries
- Review rate limit effectiveness
- Check for unused indexes
- Update dependencies

**Quarterly**:
- Database performance tuning
- Consider archiving old soft-deleted records
- Review and update documentation

---

## Future Enhancements

### Short-Term
- [ ] Add data export scheduling
- [ ] Implement full-text search UI
- [ ] Add vehicle photo uploads
- [ ] Email notifications for maintenance due

### Medium-Term
- [ ] Real-time dashboard with WebSockets
- [ ] Mobile app (React Native)
- [ ] Advanced analytics (charts, trends)
- [ ] Multi-tenant support

### Long-Term
- [ ] Machine learning for predictive maintenance
- [ ] GPS tracking integration
- [ ] Fuel consumption tracking
- [ ] Driver behavior analysis

---

## License

Proprietary - All rights reserved

---

## Support

For issues or questions:
1. Check this README
2. Review `/debug` endpoint
3. Check Vercel function logs
4. Check Supabase logs

---

**Last Updated**: 2026-02-19  
**Version**: 1.2.0  
**Status**: Production Ready ✅
