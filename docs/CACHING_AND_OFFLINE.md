# Amwaj POS — Caching, Persistence & Offline Sync

## Architecture

| Layer | Responsibility |
|-------|----------------|
| **TanStack Query** | Server state: products, categories, customers, history, settings. staleTime 24h, gcTime 7d. |
| **IndexedDB (Dexie)** | Persistent product/category cache; current cart; pending bill queue. |
| **Zustand** | Current bill/cart UI state; debounced write to IndexedDB. |
| **localStorage** | Auth token + user only (not cart/bills). |
| **billSync** | Queue bills offline; retry on online/focus; same idempotency key on retry. |

## Flow

1. **Startup**  
   - Hydrate products/categories from IndexedDB into Query cache (instant UI).  
   - Background fetch from API; update Query + IndexedDB.  
   - Hydrate unfinished cart from IndexedDB.  
   - Start bill sync listeners.

2. **Products**  
   - Bill screen reads Query cache (already warm from IDB).  
   - Mutations (create/update product) update Query + IDB after server success.

3. **Cart**  
   - Every change (items, customer, discount, payments fields) persisted to IndexedDB within ~120ms.  
   - Survives refresh, PWA close, restart.

4. **Complete bill**  
   - Online: POST with `idempotencyKey`; backend returns existing invoice if key already used.  
   - Offline / network error: save to `pendingBills` with status `pending_sync`; clear cart; message to staff.  
   - On reconnect: process queue; mark `synced` or `sync_failed`.  
   - **Never** claims UPI verified offline.

## Backend

- `Invoice.idempotencyKey` unique optional field.  
- `POST /billing/complete` accepts `idempotencyKey`; returns prior invoice on duplicate.

After pull:  
```bash
cd backend && npx prisma db push
```

## Frontend install

```bash
cd frontend && npm install
```

New deps: `@tanstack/react-query`, `dexie`, `zustand`.

## Testing checklist

- [ ] Open app online → products load → close → reopen offline → products still visible  
- [ ] Add cart items → refresh page → cart restored  
- [ ] Complete bill online → invoice in History  
- [ ] Kill network → complete bill → pending message → restore network → sync  
- [ ] Retry same pending bill → no duplicate invoice (idempotency)  
- [ ] Create product → appears on Bill without full reload  

## Limitations

- Offline bill is **not** a server-confirmed invoice until synced.  
- UPI is amount-entry only; never auto-verified offline.  
- No multi-device realtime; catalog refreshes on focus/startup/reconnect.  
- Service worker does not cache POST /billing (by design).
