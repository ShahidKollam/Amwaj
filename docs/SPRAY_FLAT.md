# Flat sprays (no size children)

## Product page
- Add spray like attar: **name**, **selling price (₹ per ml)**, optional stock (usually 0 on spray itself).
- Link **oil**, **water**, **oil ratio %** (default 50).
- **Do not** create child size products.

## Bill page
- 2-column grid (same as attar).
- Tap spray → size sheet: 10 / 20 / 30 / 40 / 50 / 100 ml.
- Line price = size × ₹/ml.
- On Generate Bill: deduct oil ml, water ml, matching Accessories bottle (by ml).

## Accessories
Keep `10 ml Spray Bottle` … `100 ml Spray Bottle` for stock.

## Reset
```bash
cd backend && npx prisma migrate reset --force
```
