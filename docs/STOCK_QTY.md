# Product total quantity (stock)

## Column
`Product.stockQty` — `DECIMAL(14,3)`, default `0`.

- **PER_ML** (attar/oud): stock in **ml**
- **SPRAY / FIXED**: stock in **pieces**
- **Groups** (spray parent headings): always `0`

## Behaviour
When a bill is completed, each line with a `productId` runs:
`stockQty = stockQty - quantity sold`

Stock may go negative if you sell more than on hand (no hard block).

## Local / server setup
```bash
cd backend
npx prisma migrate deploy
# alternative if you don't use migrate history:
# npx prisma db push
npx prisma generate
# restart the API process
```

Manual SQL (if needed):
```sql
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
```
