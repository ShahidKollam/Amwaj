# Prisma — wipe data, push schema, seed (testing)

Use from the **backend** folder (`amwaj-pos/backend`).

## 1. Full clean (delete all tables data + re-apply schema)

**Option A — recommended for local/dev PostgreSQL**

```bash
cd backend

# Apply schema (includes purchasePrice columns from v1.4.0)
npx prisma db push

# Wipe ALL rows in all tables (keeps schema)
npx prisma db execute --stdin <<'SQL'
TRUNCATE TABLE
  "Payment",
  "InvoiceItem",
  "Invoice",
  "Product",
  "Category",
  "Customer",
  "User",
  "ShopSettings"
RESTART IDENTITY CASCADE;
SQL

# Seed admin, staff, categories, products, customers (no invoices)
npm run db:seed
# or: node prisma/seed.js
```

**Option B — nuclear (drop & recreate schema)**

```bash
cd backend
npx prisma db push --force-reset
npm run db:seed
```

Warning: `--force-reset` drops the entire database schema and data.

## 2. Only reseed products/users (keep existing bills)

```bash
cd backend
npm run db:seed
```

Seed **upserts** admin/staff and products by name. It does **not** delete invoices.

## 3. After every code update that changes `schema.prisma`

```bash
cd backend
npx prisma generate
npx prisma db push
# restart backend server
```

## 4. Test logins

| User   | Password   | Role  |
|--------|------------|-------|
| admin  | amwaj2024  | OWNER |
| staff  | staff1234  | STAFF |

## 5. Test P&L

1. Login as **admin**
2. Products → open a product → confirm **Purchase rate** is set (seed has costs on most items)
3. Create a few bills (attar ml + spray + bakhoor)
4. History → day **Est. cost / Est. profit** (owner only)
5. Settings → Reports → date range → **Est. cost / Est. profit**

Staff login: no purchase rate on products, no P&L on history/reports.

## 6. Environment

Ensure `backend/.env` has a valid:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
```
