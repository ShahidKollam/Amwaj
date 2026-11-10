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

## Products page cache (2026-11-09) — v1.3.6

| Item | Status |
|------|--------|
| Products page instant IDB hydrate | DONE |
| Background full-catalog refresh | DONE |
| Mutations → Query + IDB | DONE |
| Bill active-only filter | DONE |

No new dependencies. Restart frontend after deploy.

## Bill items UI (2026-11-10) — v1.3.7

| Item | Status |
|------|--------|
| Collapse label → close (X) button | DONE |
| Qty − / input / + on one line | DONE |
| Shared CartLine on sheet, review, desktop | DONE |
| Less vertical space (phone + tablet) | DONE |

Only `frontend/src/pages/BillPage.jsx` changed. Restart frontend after deploy.

## Bill qty merge + staff edit (2026-11-10) — v1.3.8

| Item | Status |
|------|--------|
| Same product → increase qty | DONE |
| PER_ML +3 ml steps | DONE |
| Owner edit staff | DONE |
| Staff no self password change | DONE |

Files: BillPage.jsx, SettingsPage.jsx, api.js, auth.js
