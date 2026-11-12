# Full database reset + seed (Amwaj POS)

**Warning:** This deletes **all** bills, customers, products, and users, then loads the new seed catalog.

## What the seed includes

| Area | Content |
|------|---------|
| Users | `admin` / `amwaj2024` (OWNER), `staff` / `staff1234` (STAFF) |
| Categories | Attar, Oud, Spray, Bakhoor, Accessories |
| Spray bottles (Accessories) | **10, 20, 30, 40, 50, 100 ml** Spray Bottle |
| Spray water | Spray Water (ml stock) |
| Spray groups | Zabaya, Amber, Rose, Musk, Oud, Hindi Oud — each size **10–100 ml** linked to oil + water + bottle |
| Other | Attars, ouds, bakhoor, tools, sample customers |

## Copy-paste: full reset (recommended)

From the project root (folder that contains `backend/`):

```bash
cd backend
cp -n .env.example .env
# Edit .env → set DATABASE_URL and a strong JWT_SECRET (32+ chars)

npm install
npx prisma generate
npx prisma migrate reset --force
```

`migrate reset` will:
1. Drop the database schema  
2. Re-apply all migrations  
3. Run `prisma/seed.js` automatically  

Then start the API:

```bash
npm run dev
# or: npm start
```

Frontend (separate terminal):

```bash
cd frontend
npm install
npm run dev
```

## Copy-paste: seed only (no wipe)

Use only if the DB already has the latest migrations and you only want to refresh/upsert catalog:

```bash
cd backend
node prisma/seed.js
```

## Copy-paste: from monorepo root scripts

```bash
npm run db:reset
# same as: cd backend && npx prisma migrate reset --force

npm run db:seed
# same as: cd backend && node prisma/seed.js
```

## Login after seed

| Role | Username | Password |
|------|----------|----------|
| Owner | `admin` | `amwaj2024` |
| Staff | `staff` | `staff1234` |

Change passwords after first login (Settings → Account).
