# State Fleet Architecture Reference

Quick reference for AI assistants working on this codebase.

## Tech Stack
- **Frontend**: Next.js 14 App Router, React 19, TypeScript, Tailwind CSS 4, PWA (Manifest + SW)
- **State**: TanStack React Query (server), localStorage (session)
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL 15+)
- **Storage**: AWS S3 (backups)

## Key Patterns

### 1. File Organization
```
src/
├── app/                    # Next.js pages + API routes
│   ├── [page]/page.tsx    # Page UI (client component)
│   └── api/[route]/route.ts  # API endpoint (server)
├── components/            # Shared UI (MobileShell, DataTable, SW registration, etc.)
├── features/              # Feature modules (vehicles, inspections, etc.)
│   └── [feature]/
│       ├── page.tsx       # Feature page logic
│       ├── components.tsx # Feature-specific UI
│       └── api.ts         # Feature-specific API calls
├── hooks/                 # React hooks (useQueries, useSession, etc.)
└── lib/                   # Core utilities (auth, cache, db, etc.)
```

### 2. Data Flow
```
User Action
  ↓
React Component (client)
  ↓
React Query Hook (useQueries.ts)
  ↓
API Route (app/api/.../route.ts)
  ↓
Validation (lib/validation.ts)
  ↓
Cache Check (lib/cache.ts)
  ↓
Database Query (lib/db.ts → Supabase)
```

### 3. Mutation Flow
```
User Submits Form
  ↓
useMutation (from useQueries.ts)
  ↓
POST/PUT/DELETE to API route
  ↓
Rate Limit Check (lib/rate-limit.ts)
  ↓
Validation (lib/validation.ts)
  ↓
Database Write
  ↓
Cache Invalidation (invalidateCache)
  ↓
React Query Auto-Refetch
```

## Core Principles

### 1. Data Integrity
- **Always soft delete**: Set `is_deleted=true`, `deleted_at`, `deleted_by`
- **Never hard delete vehicles**: Preserves referential integrity
- **Cascade checks**: Warn before deleting records with dependencies
- **Audit trail**: `created_by`, `updated_by`, `created_at`, `updated_at` on all tables

### 2. Performance
- **Pagination**: 20-50 items per page, infinite scroll
- **Batching**: Single query for related data (no N+1)
- **Caching**: 5-minute server cache, 30-second client cache
- **Indexes**: Composite indexes on `(vehicle_id, created_at)`

### 3. Security
- **Rate limiting**: Login (5/15min), Import (5/5min), Export (10/5min)
- **Password hashing**: PBKDF2 with 100k iterations
- **Session TTL**: 24 hours
- **Role-based access**: Admin vs Staff permissions
- **Input validation**: Zod schemas on all inputs

## Common Tasks

### Adding a New API Endpoint

1. Create route file: `src/app/api/[name]/route.ts`
2. Add validation schema: `src/lib/validation.ts`
3. Add types: `src/lib/types.ts`
4. Implement GET/POST/PUT/DELETE handlers:
   ```typescript
   export async function POST(req: Request) {
     // 1. Auth check
     const session = requireSession(req);
     if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     
     // 2. Rate limit (if needed)
     const rateLimit = checkRateLimit(...);
     if (!rateLimit.allowed) return NextResponse.json({ error: "Rate limit" }, { status: 429 });
     
     // 3. Validate input
     const input = mySchema.parse(await req.json());
     
     // 4. Database operation
     const { data, error } = await supabase.from("table").insert(input);
     if (error) return NextResponse.json({ error: error.message }, { status: 400 });
     
     // 5. Invalidate cache
     invalidateCache("prefix:");
     
     // 6. Return response
     return NextResponse.json({ data });
   }
   ```
5. Add React Query hook: `src/hooks/useQueries.ts`
6. Use in component

### Adding a New Database Table

1. Add to `supabase/schema.sql`:
   ```sql
   CREATE TABLE my_table (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     -- fields
     is_deleted boolean NOT NULL DEFAULT false,
     deleted_at timestamptz,
     deleted_by uuid REFERENCES users(id),
     created_at timestamptz NOT NULL DEFAULT now(),
     created_by uuid REFERENCES users(id) ON DELETE SET NULL,
     updated_at timestamptz NOT NULL DEFAULT now(),
     updated_by uuid REFERENCES users(id)
   );
   
   -- Indexes
   CREATE INDEX my_table_created_idx ON my_table(created_at DESC) WHERE is_deleted = false;
   
   -- Trigger
   CREATE TRIGGER my_table_set_updated_at
     BEFORE UPDATE ON my_table
     FOR EACH ROW
     EXECUTE FUNCTION set_updated_at();
   ```
2. Add migration to `supabase/migration_improvements.sql` or new `migration_v*.sql`
3. Add TypeScript type to `src/lib/types.ts`
4. Add Zod schema to `src/lib/validation.ts`
5. Create API route
6. Create React Query hooks

### Adding a New Feature

1. Create feature folder: `src/features/my-feature/`
2. Add `page.tsx` (main logic)
3. Add `components.tsx` (UI components)
4. Add `api.ts` (optional, if complex API logic)
5. Create page route: `src/app/my-feature/page.tsx` (imports from features/)
6. Add navigation link to `src/components/BottomNav.tsx`
7. Add API routes if needed

## Database Schema Conventions

### Table Structure
```sql
-- All tables must have
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
created_by uuid REFERENCES users(id) ON DELETE SET NULL,
updated_by uuid REFERENCES users(id),

-- For soft delete support
is_deleted boolean NOT NULL DEFAULT false,
deleted_at timestamptz,
deleted_by uuid REFERENCES users(id)
```

### Indexing Strategy
- Primary key: uuid (auto-generated)
- Foreign keys: Always index
- Timestamps: Index on `created_at DESC`
- Soft deletes: Partial index `WHERE is_deleted = false`
- Search fields: GIN index for JSONB, trigram for text
- Composite: `(foreign_key, created_at)` for pagination

### Foreign Key Rules
- **Vehicles → Events**: `ON DELETE RESTRICT` (prevent deletion if has events)
- **Users → Events**: `ON DELETE SET NULL` (preserve events if user deleted)
- **Config → Usage**: Check usage before delete, or soft delete

## API Response Conventions

### Success Response
```json
{
  "data": [...] | {...},
  "total": 100,      // For paginated lists
  "page": 1,         // For paginated lists
  "pageSize": 20,    // For paginated lists
  "hasMore": true    // For infinite scroll
}
```

### Error Response
```json
{
  "error": "User-friendly error message",
  "details": "Technical details (optional)"
}
```

### HTTP Status Codes
- 200: Success
- 400: Bad request (validation error)
- 401: Unauthorized (no session)
- 403: Forbidden (no permission)
- 404: Not found
- 409: Conflict (e.g., duplicate, has dependencies)
- 429: Rate limited
- 500: Server error

## React Query Conventions

### Query Keys
```typescript
// Centralized in useQueries.ts
{
  vehicles: ["vehicles", "list", filters],
  inspections: ["inspections", "infinite", filters],
  maintenance: ["maintenance", "list", filters]
}
```

### Cache Invalidation
```typescript
// Invalidate all related queries
queryClient.invalidateQueries({ queryKey: ["vehicles"] });

// Invalidate specific query
queryClient.invalidateQueries({ queryKey: ["vehicles", "list", { search: "term" }] });
```

### Mutation Pattern
```typescript
export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => fetchWithSession("/api/vehicles", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  });
}
```

## Styling Conventions

### Tailwind Classes
- **Mobile-first**: Base styles are mobile, use `sm:`, `md:`, `lg:` for larger
- **Touch targets**: Minimum 44px (`py-3`, `min-h-11`)
- **Colors**: Use theme colors (blue, emerald, slate, etc.)
- **Spacing**: Use Tailwind spacing scale (4, 6, 8, 12, 16, 24)

### Component Structure
```tsx
// Always wrap pages in MobileShell
<MobileShell title="Page Title">
  <div className="space-y-4 p-4 pb-24">
    {/* Content */}
  </div>
</MobileShell>
```

## Error Handling

### API Routes
```typescript
try {
  // Operation
} catch (err) {
  console.error("Descriptive error message:", err);
  return NextResponse.json(
    { error: "User-friendly message" },
    { status: 500 }
  );
}
```

### React Components
```tsx
if (error) {
  return <Toast message={error} tone="error" />;
}

if (isLoading) {
  return <Skeleton />;
}
```

## Testing Strategy

### Database
1. Check indexes: `\d+ tablename` in psql
2. Verify constraints: Try inserting invalid data
3. Test triggers: Update record, check `updated_at`

### API
1. Test rate limiting: Exceed limits
2. Test validation: Send invalid data
3. Test auth: Call without session
4. Test soft delete: Verify records hidden but exist

### Frontend
1. Test infinite scroll: Scroll to bottom
2. Test offline: Disable network, check behavior
3. Test mobile: Use Chrome DevTools responsive mode
4. Test forms: Submit with invalid data

## Debugging

### Tools
- **Database**: Supabase SQL Editor
- **API**: Vercel function logs
- **Frontend**: Browser DevTools
- **Debug page**: Navigate to `/debug`

### Common Issues
1. **"Session expired"**: Check client time, re-login
2. **"Rate limit"**: Wait or restart server (dev)
3. **Slow queries**: Run EXPLAIN ANALYZE, check indexes
4. **N+1 queries**: Use batching, check console logs

## Production Checklist

- [ ] Run migrations in order: `migration_improvements.sql`, `migration_v2.sql`, `migration_v3.sql`, `migration_v4.sql`
- [ ] Change default user passwords
- [ ] Set all environment variables in Vercel
- [ ] Test S3 backup webhook
- [ ] Verify rate limiting works
- [ ] Check mobile responsiveness
- [ ] Monitor Vercel function logs
- [ ] Set up alerts for errors

## Quick Reference

### File Purposes
- `lib/auth.ts`: Session validation, role checks
- `lib/cache.ts`: In-memory cache with TTL
- `lib/rate-limit.ts`: Request rate limiting
- `lib/password.ts`: PBKDF2 hashing
- `lib/validation.ts`: Zod schemas
- `lib/db.ts`: Supabase client
- `lib/types.ts`: TypeScript types
- `hooks/useQueries.ts`: React Query hooks & fetch helpers

### Environment Variables
```bash
SUPABASE_URL=                    # Required
SUPABASE_SERVICE_ROLE_KEY=       # Required
BACKUP_SECRET=                   # Optional (S3)
S3_ENDPOINT=                     # Optional (S3)
S3_ACCESS_KEY_ID=                # Optional (S3)
S3_SECRET_ACCESS_KEY=            # Optional (S3)
S3_BUCKET=                       # Optional (S3)
S3_REGION=                       # Optional (S3)
```

### NPM Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm start            # Production server
npm run lint         # Run ESLint
```

---

**For full documentation, see README.md**
