# Composite spray products (v1.6)

## Concept
Customer bill line: **one** item — e.g. `Zabaya Spray 10ml · ₹150`.

Internal stock on **bill complete** deducts three catalog items:
| Component | Example | Qty for 10 ml @ 50% oil |
|-----------|---------|-------------------------|
| Oil (PER_ML) | Zabaya Attar | 5 ml |
| Water | Spray Water | 5 ml |
| Bottle | 10 ml Spray Bottle | 1 piece |

## Schema (`Product`)
| Field | Where | Purpose |
|-------|--------|---------|
| `oilProductId` | Parent group | Oil SKU |
| `waterProductId` | Parent group | Water SKU |
| `oilRatioPercent` | Parent group | Default **50** (editable) |
| `bottleProductId` | Size child | Empty bottle SKU |
| `bottleSizeMl` | Size child | 10 / 20 / 30 / 40 / 50 / 100 |

## Stock rules
- Deduct **only** when the invoice is successfully completed (not on cart add).
- If a spray size has a recipe (oil linked via parent), finished size `stockQty` is **not** decremented.
- Standalone sprays without recipe still decrement their own `stockQty`.
- Oversell is allowed (stock may go negative).

## Invoice / history
- Customer-facing fields unchanged (name, size, price).
- `sprayBottleMl`, `sprayOilMl`, `sprayLiquidMl` are stored on the line for admin audit.
- Old invoices remain valid (snapshot data).

## Admin setup
1. Accessories: **Spray Water** (unit `ml`) + **10–100 ml Spray Bottle** (piece).
2. Create spray **group** → select oil, water, oil %.
3. Add **size children** under the group → bottle size + bottle SKU + selling price.

## Migration (existing DB)
```bash
cd backend
npx prisma migrate deploy
npx prisma generate
# restart API
```

Optional full reset + seed:
```bash
npx prisma migrate reset
npm run db:seed
```

## Changing the mix
Edit the spray **group** → Oil ratio (%). New bills use the new ratio; past invoices keep their snapshots.
