# Spray pricing — problem & ideas

## Current behaviour (v1.4.0)

- Each spray is a **product** with type `SPRAY` and a **fixed unit price** (per piece).
- Cart line: `quantity × unitPrice` (2 bottles = 2 × full price).
- UI hardcodes `sprayBottleMl: 100`, `sprayOilMl: 60` for display/notes only — **price does not use ml**.

So if the shop fills custom bottles (30 / 50 / 100 ml) of the **same** fragrance, one fixed product price cannot scale with ml. Raising “quantity” only multiplies whole bottles, not oil ml — which feels inconsistent next to attar (`PER_ML`).

## Recommended approaches (pick one)

### A) One product per bottle size (simplest — no code change)

Example products:

| Name | Type | Sell |
|------|------|------|
| Hindi Oud Spray 30ml | SPRAY | ₹800 |
| Hindi Oud Spray 50ml | SPRAY | ₹1200 |
| Hindi Oud Spray 100ml | SPRAY | ₹2200 |

- Same brand = multiple product rows.
- Quantity still means “number of bottles of that size”.
- Matches how many shops already price ready-made sprays.
- **Pros:** Works today; clear for staff; purchase rate per size for P&L.  
- **Cons:** More product rows; custom “37 ml” needs a custom line or nearest size.

### B) Price by oil ml (like attar) — treat spray oil as PER_ML

- Store **oil cost/sell per ml** on the fragrance.
- Bill: choose bottle size (empty bottle may be a separate FIXED accessory) + oil ml.
- Line total ≈ `(oilMl × oilPricePerMl) + bottleCharge`.
- **Pros:** Consistent with attar; any ml amount.  
- **Cons:** Needs UI (bottle size + oil ml) and pricing formula; more training.

### C) Tier table per brand (ml bands)

For one fragrance:

| Oil ml band | Sell price |
|-------------|------------|
| 1–30        | ₹X |
| 31–50       | ₹Y |
| 51–100      | ₹Z |

- Or exact sizes only: 30 / 50 / 100 only.
- **Pros:** Controlled margins (bigger bottle not always linear).  
- **Cons:** Schema + UI work; harder offline cache.

### D) Hybrid (often best for perfume counters)

1. **Ready spray** products (A): fixed bottle sizes on shelf → type `SPRAY` / `FIXED`.
2. **Custom fill** from concentrate: use existing **attar/oud PER_ML** + sell empty atomizer as accessory.

No special spray math — staff pick oil (per ml) + bottle (fixed). Notes field can say “filled in 50ml spray”.

## Suggestion for Amwaj now

1. **Short term:** use **A** — rename sprays to include size (`… 50ml`, `… 100ml`) and seed one row per size you sell. Quantity = count of that SKU. Already works with purchase rate / P&L.
2. **Later if you fill custom ml often:** implement **D** (PER_ML oil + bottle accessory) or **B** with a small spray builder on the bill screen.

Do **not** multiply a single 100ml fixed price by “ml quantity” without a clear formula — that is what feels inconsistent today.

## If we implement B later (sketch)

- Product fields: `oilPricePerMl`, optional `defaultBottleMl`.
- Cart for SPRAY: `sprayOilMl` editable;  
  `lineTotal = oilMl * oilPricePerMl + (bottle product or fixed bottle fee)`.
- Snapshot oil price on invoice item (same idea as purchase snapshot).

Confirm which model you want before we change bill code.
