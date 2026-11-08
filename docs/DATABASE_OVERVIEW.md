# Database Overview

PostgreSQL via Prisma.

## Models
- **User** — staff/owner accounts
- **Category** — Attar, Oud, Spray, Bakhoor, Accessories
- **Product** — catalog (PER_ML / SPRAY / FIXED), unitPrice in paise
- **Customer** — unique mobile
- **Invoice** — snapshot totals, status COMPLETED/VOIDED
- **InvoiceItem** — product snapshot (name, type, qty, rates, spray details)
- **Payment** — CASH / UPI amounts
- **ShopSettings** — shop name, invoice prefix, sequence

All money stored as integer **paise**.  
Invoice line items are snapshots so history never changes when products are edited.
