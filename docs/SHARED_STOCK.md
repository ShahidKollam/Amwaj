# Shared stock (Attar + Oud + Spray)

When **Also add to Attar, Oud & Spray** is checked:

1. Three products are created/updated with the **same `stockGroupId`**.
2. Spray’s `oilProductId` points at the **Attar** row (oil used in composite sprays).
3. Selling **any** of them reduces stock on **all three**.

## Migration

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Or full reset (wipes data):

```bash
npx prisma migrate reset --force
```
