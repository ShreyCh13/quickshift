# Contributing to QuickShift

Quick start guide for developers and AI assistants working on this codebase.

## 🚀 Quick Start

1. **Read these in order**:
   - `README.md` - Full project documentation
   - `ARCHITECTURE.md` - Architecture patterns and conventions
   - `.cursorrules` - Code style guide

2. **Set up locally**:
   ```bash
   npm install
   cp env.example .env.local
   # Fill in .env.local with your credentials
   npm run dev
   ```

3. **Set up database**:
   - Run `supabase/schema.sql` in Supabase SQL Editor
   - Run `supabase/migration_improvements.sql`
   - (Optional) Run `supabase/seed.sql` for test data

## 📁 Where to Find Things

| Need to... | Look at... |
|------------|-----------|
| Add a new page | `src/app/[name]/page.tsx` |
| Add a new API endpoint | `src/app/api/[name]/route.ts` |
| Add a shared component | `src/components/[Name].tsx` |
| Add a feature | `src/features/[name]/` |
| Add types | `src/lib/types.ts` |
| Add validation | `src/lib/validation.ts` |
| Add React Query hooks | `src/hooks/useQueries.ts` |
| Modify database | `supabase/migration_improvements.sql` |

## 🎯 Common Tasks

### Adding a New API Endpoint

```bash
# 1. Create route file
touch src/app/api/my-endpoint/route.ts

# 2. Add validation schema
# Edit src/lib/validation.ts

# 3. Add types
# Edit src/lib/types.ts

# 4. Implement handlers (see ARCHITECTURE.md for template)

# 5. Add React Query hook
# Edit src/hooks/useQueries.ts

# 6. Use in component
```

### Adding a New Page

```bash
# 1. Create feature folder
mkdir -p src/features/my-feature
touch src/features/my-feature/page.tsx
touch src/features/my-feature/components.tsx

# 2. Create page route
touch src/app/my-feature/page.tsx

# 3. Add navigation link
# Edit src/components/BottomNav.tsx

# 4. Add API routes if needed
```

### Modifying Database

```bash
# 1. Test locally first!
# Edit supabase/migration_improvements.sql

# 2. Add transaction wrapper
BEGIN;
-- Your changes
COMMIT;

# 3. Update types
# Edit src/lib/types.ts

# 4. Update validation
# Edit src/lib/validation.ts

# 5. Run migration in Supabase SQL Editor
```

## 🧪 Testing Your Changes

### Frontend
```bash
# 1. Visual check
npm run dev
# Open http://localhost:3000

# 2. Test mobile view
# Chrome DevTools → Device toolbar (Cmd+Shift+M)

# 3. Test with invalid data
# Submit forms with missing/invalid fields

# 4. Check React Query cache
# React DevTools → Query tab
```

### API
```bash
# 1. Check Vercel function logs
# Vercel dashboard → Functions

# 2. Use debug page
# Navigate to http://localhost:3000/debug

# 3. Test rate limiting
# Make multiple requests quickly

# 4. Test without session
# Clear localStorage, try API call
```

### Database
```sql
-- 1. Check indexes
\d+ tablename

-- 2. Test query performance
EXPLAIN ANALYZE SELECT ...

-- 3. Test constraints
INSERT INTO ... VALUES (invalid_data);

-- 4. Test triggers
UPDATE tablename SET ...
-- Verify updated_at changed
```

## ✅ Pre-Commit Checklist

Before committing:
- [ ] Code follows `.cursorrules` style guide
- [ ] TypeScript types are correct (no `any`)
- [ ] Zod validation added for new inputs
- [ ] Error handling comprehensive
- [ ] Loading states shown in UI
- [ ] Mobile responsive (test with DevTools)
- [ ] No `console.log` (use `console.error` for errors)
- [ ] Cache invalidated after mutations
- [ ] Authentication checked on API routes
- [ ] Database queries optimized (no N+1)

## 🐛 Debugging

### "Nothing works after my change"

1. Check Vercel function logs for errors
2. Check browser console for errors
3. Check network tab for failed requests
4. Navigate to `/debug` page for diagnostics

### "Database query is slow"

1. Run `EXPLAIN ANALYZE` on the query
2. Check if indexes exist: `\d+ tablename`
3. Look for N+1 patterns in code
4. Consider adding composite indexes

### "Cache not invalidating"

1. Check if `invalidateCache()` is called after mutation
2. Verify cache prefix matches
3. Check React Query invalidation in DevTools
4. Consider clearing cache and restarting

### "Rate limit always triggers"

1. In development, restart server to reset limits
2. Check IP extraction in rate-limit.ts
3. Consider adjusting limits for development

## 📖 Learning Resources

### Understanding the Codebase
1. Start with `README.md` - High-level overview
2. Read `ARCHITECTURE.md` - Patterns and conventions
3. Look at existing features in `src/features/`
4. Follow a request through the stack (see ARCHITECTURE.md)

### Key Concepts
- **Soft Delete**: Records never truly deleted, just marked `is_deleted=true`
- **Audit Trail**: All records track who/when created/updated/deleted
- **React Query**: Manages server state, caching, refetching
- **Rate Limiting**: Protects endpoints from abuse
- **Pagination**: All lists use pagination to handle scale

## 🤝 Workflow

1. **Create feature branch**: `git checkout -b feature/my-feature`
2. **Make changes**: Follow patterns in existing code
3. **Test thoroughly**: Use checklist above
4. **Commit**: Use conventional commits (`feat:`, `fix:`, etc.)
5. **Push**: `git push origin feature/my-feature`
6. **Deploy**: Vercel auto-deploys on push to main

## 🆘 Getting Help

1. **Check documentation**: README.md, ARCHITECTURE.md, .cursorrules
2. **Check debug page**: Navigate to `/debug`
3. **Check logs**: Vercel function logs, Supabase logs
4. **Search codebase**: Use grep/search to find similar implementations

## 💡 Tips

### For AI Assistants
- Always read README.md first to understand the system
- Follow patterns in ARCHITECTURE.md
- Check .cursorrules for code style
- Look at existing code for examples
- When unsure, ask for clarification

### For Humans
- Use `/debug` page to diagnose issues
- Check Vercel and Supabase dashboards
- Use browser DevTools extensively
- Test on real mobile devices when possible
- Keep documentation updated

## 🚀 Production Deployment

1. **Prepare**:
   - Run migration on production database
   - Test migration on staging first
   - Update environment variables in Vercel
   - Change default passwords

2. **Deploy**:
   - Push to main branch
   - Vercel auto-deploys
   - Monitor function logs

3. **Verify**:
   - Test all critical paths
   - Check `/debug` page
   - Monitor error rates
   - Test mobile experience

4. **Monitor**:
   - Vercel Analytics
   - Supabase logs
   - Error tracking (if set up)

## 📝 Documentation Updates

When making significant changes:
- Update README.md if adding features
- Update ARCHITECTURE.md if changing patterns
- Update .cursorrules if changing conventions
- Add comments for complex logic

## 🔒 Security

Never commit:
- API keys or secrets
- `.env.local` file
- Passwords or credentials
- Database connection strings

Always:
- Validate all inputs with Zod
- Check authentication on API routes
- Rate limit sensitive endpoints
- Hash passwords before storage
- Use soft deletes to preserve data

## 📊 Performance

Keep in mind:
- Target: 100+ vehicles, 1000s of records
- Paginate all lists (20-50 items)
- Batch database queries (no N+1)
- Use indexes on frequently queried fields
- Cache expensive operations
- Monitor query performance

---

**Questions?** Check the documentation or inspect existing code for examples.

**Found a bug?** Use the `/debug` page to diagnose, then fix following the patterns in ARCHITECTURE.md.

**Want to add a feature?** Follow the "Adding a New Feature" section in ARCHITECTURE.md.
