# State Fleet — Complete Diagnostics Report

**Date:** February 2026  
**Scope:** Codebase health, scalability (5–8 year horizon), data safety, PWA, offline support, documentation

---

## Executive Summary

The codebase is in **good shape** with solid foundations. A few gaps need addressing for long‑term growth, data safety, and offline/PWA experience. Critical items are prioritized below.

### Overall Health

| Area | Status | Notes |
|------|--------|-------|
| Code cleanliness | ✅ Good | Minor dead code (RemarkFieldsForm) |
| Scalability | ✅ Good | DB well structured; minor server cache gaps |
| Efficiency | ⚠️ Fair | Server read cache underused; offline queue not wired |
| Useless files | ⚠️ Minor | 1 dead component, 1 redundant export |
| Documentation | ⚠️ Fair | migration_v5, session TTL, Next.js version |
| Naming | ⚠️ Fair | QuickShift vs State Fleet inconsistency |

---

## 1. Code Cleanliness

### Strengths

- Clear feature-based structure (`src/features/`, `src/app/`)
- Consistent API patterns (auth → role → validation → DB → cache invalidation)
- Zod validation on all inputs
- TypeScript strict mode, no `any`
- `.cursorrules` for consistent conventions

### Issues

| Issue | Location | Action |
|-------|----------|--------|
| **Dead component** | `RemarkFieldsForm` in `inspections/components.tsx` | Remove or keep only if planned for reuse |
| **Redundant export** | `useOnlineStatus` in `lib/offline.ts` | Remove; real implementation is in `hooks/useOnlineStatus.ts` |
| **Dual fetch paths** | `features/*/api.ts` vs `useQueries.ts` | Both used; consider consolidating to `useQueries.ts` only over time |

---

## 2. Scalability & Efficiency (5–8 Year Horizon)

### Database Architecture ✅

- **Indexes:** Composite indexes on `(vehicle_id, created_at)`, trigram search on names, partial indexes on `is_active`, `is_deleted`
- **Soft deletes:** `is_deleted`, `deleted_at`, `deleted_by` on inspections/maintenance
- **Referential safety:** `ON DELETE RESTRICT` on vehicles (no accidental deletion)
- **Views:** `vehicle_stats`, `maintenance_vehicle_summary` for analytics
- **Pagination:** 20–50 items; infinite scroll for lists

**Future considerations:**

- At 1M+ rows: consider table partitioning for `inspections` and `maintenance` by `created_at` (e.g., yearly/monthly)
- Archive old data after N years if needed; keep recent data hot
- Add `LIMIT` on unbounded queries where missing

### Caching

| Layer | Status | Notes |
|-------|--------|-------|
| **Client (React Query)** | ✅ Good | staleTime 30s–5min, gcTime 5min, infinite queries |
| **Server (lib/cache.ts)** | ⚠️ Partial | `invalidateCache` used; `getOrSetCache` **not used** in API routes |
| **Vehicles API** | ❌ No read cache | Every request hits DB |
| **Analytics API** | ❌ No read cache | Every request hits DB |
| **Config APIs** (remarks, checklist) | ❌ No read cache | Every request hits DB |

**Recommendation:** Use `getOrSetCache` for GET handlers on vehicles, analytics, remark fields, and checklist items.

### Performance Rules

- Pagination: 20–50 per page ✅
- No N+1: single queries with joins ✅
- Cache invalidation on mutations: vehicles, inspections, maintenance, analytics ✅
- React Query retry with backoff ✅

---

## 3. Data Safety (No Accidental Deletion or Corruption)

### Current Protections ✅

- **Soft deletes:** inspections and maintenance use `is_deleted`; data retained
- **ON DELETE RESTRICT:** vehicles cannot be deleted if referenced
- **ON DELETE SET NULL:** users → `deleted_by`, `created_by` for audit trail
- **Migrations in transactions:** `migration_improvements.sql` wrapped in `BEGIN/COMMIT`
- **Constraints:** length, range, and referential integrity enforced
- **Weekly S3 backups:** via GitHub Actions

### Gaps / Risks

| Issue | Risk | Action |
|-------|------|--------|
| **Plaintext dev passwords** | `migration_v5` and `seed.sql` have plaintext passwords | Hash before production; dev-only env for plaintext |
| **No confirmation on bulk delete** | Import/delete flows | Ensure destructive actions have confirmation UI |
| **Rate limit store in-memory** | Resets on deploy | For production, use Redis or similar external store |

---

## 4. PWA & Downloadable Web App

### Current Setup ✅

- **Manifest:** `manifest.json` with name, icons, display standalone
- **Service worker:** `sw.js` caches `/` and `/manifest.json`
- **Layout:** `manifest`, `appleWebApp`, `themeColor`, `icons` in metadata
- **ServiceWorkerRegistration** component for SW registration
- **Icon API:** `/api/icon` for dynamic icons (192, 512)

### Gaps

| Issue | Action |
|-------|--------|
| **SW fetch strategy** | Uses cache-then-network; API calls always hit network and fail offline |
| **Limited cached assets** | Only `/` and `/manifest.json`; add critical JS/CSS for shell if needed |
| **No offline fallback** | No offline placeholder page for when `/` fails |

---

## 5. Offline Support & Upload Queue

### Implemented ✅

- **IndexedDB:** `state_fleet_offline` with `cache` and `retry_queue` stores
- **Retry queue:** `addToRetryQueue`, `processRetryQueue`, `getRetryQueue`, etc.
- **`useOnlineStatus`:** Tracks online/offline, runs `processRetryQueue` on reconnect
- **Offline banner:** Shown in `MobileShell` when offline

### ✅ Implemented (Feb 2026)

- **`src/lib/api-client.ts`** — Central `fetchWithSession` with offline queue support
- Mutations (POST/PUT/DELETE) are queued when offline or on network failure
- `useQueries.ts` and feature `api.ts` (inspections, maintenance) use the shared client
- `useOnlineStatus` invalidates React Query cache after `processRetryQueue` succeeds
- Forms show “Saved locally. Will sync when you’re back online.” when queued

### Remaining

- `saveToCache` and `getFromCache` (IndexedDB read cache) are still unused — optional for future offline read support

---

## 6. Sync Strategy (“Almost Live”)

### Current

- **React Query:** `refetchOnWindowFocus: false`, `staleTime` 30s–5min
- **No `refetchInterval`:** No polling for near-live updates

### Recommendations

- **Keep as-is for baseline performance:** No aggressive polling
- **Optional:** Add `refetchInterval: 60_000` (or similar) only for specific high-importance queries if needed
- **Optional:** Consider Server-Sent Events or WebSockets for real-time updates in future; not critical for current scope
- **Offline-first:** Prioritize wiring the retry queue and optional IndexedDB read cache before adding more sync logic

---

## 7. Documentation

### README.md

- ✅ Clear structure, API reference, troubleshooting
- ⚠️ Says "Next.js 14" but package uses 16.1.2
- ⚠️ migration_v5 not in migration list

### ARCHITECTURE.md

- ✅ Good patterns and conventions
- ⚠️ Session TTL: docs say "24 hours", code uses `SESSION_TTL_DAYS = 30` (30 days)
- ⚠️ migration_v5 not listed

### env.example

- Missing: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required for Google Sheets sync in SyncSettings)

### Migration Order

Documented sequence should be:

1. `schema.sql` (fresh install)
2. `migration_improvements.sql`
3. `migration_v2.sql`
4. `migration_v3.sql`
5. `migration_v4.sql`
6. `migration_v5.sql`

---

## 8. Naming Conventions

### Consistency

- Files: PascalCase for components (`useQueries.ts`, `MobileShell.tsx`)
- DB: snake_case ✅
- API JSON: camelCase for client, snake_case in DB ✅

### Inconsistencies

| Context | Value | Notes |
|---------|-------|-------|
| manifest.json | "QuickShift State Fleet" | |
| layout metadata | "QuickShift State Fleet" | |
| constants.ts | `APP_NAME = "State Fleet"` | Different from manifest |
| Workspace folder | "Maintainence" | Typo vs "Maintenance" |

Recommendation: Standardize on one brand (e.g. "QuickShift State Fleet") and use it in manifest, layout, and constants.

---

## 9. Validation & Type Gaps

| Issue | Location | Fix |
|-------|----------|-----|
| `userCreateSchema` / `userUpdateSchema` | Missing `"dev"` in role enum | Add `"dev"` |
| `UserPublic.role` in api-types.ts | `"admin" \| "staff"` only | Add `"dev"` |
| `LoginResponse` | May have `token`, `expiresAt` but login route doesn't return them | Align types with actual API response |

---

## 10. Useless or Low-Value Code

| Item | Type | Action |
|------|------|--------|
| `RemarkFieldsForm` | Unused export | Remove or comment as deprecated |
| `useOnlineStatus` in `lib/offline.ts` | Redundant (not a real hook) | Remove |
| `saveToCache`, `getFromCache`, `addToRetryQueue` | Unused | Wire into fetch layer |
| `remark_fields` vs `checklist_items` | Legacy + new | Plan deprecation of `remark_fields` if checklist fully replaces it |

---

## Implementation Priority

### High

1. Wire offline queue into mutations (queue POST/PUT/DELETE when offline)
2. Add `dev` to validation schemas and types
3. Document migration_v5 and correct migration order
4. Fix ARCHITECTURE.md session TTL (24h → 30 days)
5. Add `NEXT_PUBLIC_SUPABASE_*` to env.example

### Medium

6. Use `getOrSetCache` for vehicles, analytics, remarks, checklist GET handlers
7. Remove dead code (RemarkFieldsForm, redundant useOnlineStatus)
8. Update README Next.js version (14 → 16)

### Low

9. Standardize app name (QuickShift vs State Fleet)
10. Consider centralizing role arrays for `requireRole`
11. Plan `remark_fields` deprecation if checklist fully replaces it
