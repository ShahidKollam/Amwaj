# Amwaj POS — Development Progress

**Last update:** 2026-11-08 — Caching & offline persistence

## Caching update (this release)

| Item | Status |
|------|--------|
| TanStack Query | DONE |
| IndexedDB products/categories | DONE |
| Zustand + IDB current cart | DONE |
| Pending bill queue + sync | DONE |
| Backend idempotencyKey | DONE (run `prisma db push`) |
| UI redesign | NOT in scope (preserved) |

### New files
- `frontend/src/lib/db.js`
- `frontend/src/lib/queryClient.js`
- `frontend/src/lib/billSync.js`
- `frontend/src/store/cartStore.js`
- `frontend/src/hooks/useCatalog.js`
- `docs/CACHING_AND_OFFLINE.md`

### Changed
- `frontend/src/main.jsx` — QueryClientProvider, hydrate, sync listeners
- `frontend/src/pages/BillPage.jsx` — catalog from Query; cart persist; completeBillSafe
- `frontend/package.json` — react-query, dexie, zustand
- `backend/prisma/schema.prisma` — Invoice.idempotencyKey
- `backend/src/modules/billing.js` — idempotent complete

### Setup after update
```bash
cd frontend && npm install
cd ../backend && npx prisma db push
# restart both servers; log in once
```

## Prior features
Auth (30d JWT), mobile billing workflow, History date filter, Settings menu, modals — unchanged.
