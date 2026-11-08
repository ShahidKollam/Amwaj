# Amwaj POS — Development Progress

**Project:** Amwaj POS  
**Purpose:** Internal mobile-first Point of Sale for fragrance shop (attar, oud, spray, bakhoor, accessories)

## Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Monorepo structure | DONE | frontend/ + backend/ + docs/ |
| Backend foundation | DONE | Express, Prisma schema, health, CORS, Helmet |
| Authentication | DONE | Login, JWT, bcrypt, seed admin, protected routes |
| Products & categories | DONE | CRUD, categories, product types |
| Customers | DONE | Lookup, create, unique mobile |
| Billing engine | DONE | Per-ml, spray, fixed, discounts, additional, split payments, transaction-safe |
| Invoice history | DONE | List, detail, WhatsApp share link |
| Settings & reports | DONE | Shop profile, basic sales report |
| Frontend design system | DONE | Emerald + Gold + Ivory, Tailwind tokens |
| Mobile billing UI | DONE | Matches reference structure (header, categories, products, cart, payments) |
| Bottom navigation | DONE | Bill, Products, Customers, History, Settings |
| Desktop sidebar | DONE | Adaptive layout |
| PWA | PARTIAL | Manifest + vite-plugin-pwa configured; icons basic |
| PDF / thermal print | NOT STARTED | Invoice data ready; print CSS / PDF lib can be added |
| Full product edit UI | PARTIAL | Create works; edit/delete can be extended |
| Tests | NOT STARTED | Core calculation logic is in backend services |
| Production deploy docs | PARTIAL | README has overview |

## Database Models
User, Category, Product, Customer, Invoice, InvoiceItem, Payment, ShopSettings

## Key APIs
- POST /api/v1/auth/login
- GET /api/v1/auth/me
- GET/POST /api/v1/products, categories
- GET/POST /api/v1/customers
- POST /api/v1/billing/complete
- GET /api/v1/billing/history, /:id
- GET/PUT /api/v1/settings
- GET /api/v1/settings/reports/sales

## Default login
Username: `admin`  
Password: `amwaj2024`

## How to run
See root README.md

## Known limitations
- No real PDF generation library yet (data structure supports it)
- UPI is amount-entry only (no provider verification)
- No offline queue
- Spray pricing is operator-entered base price (no automatic oil formula)

## Recommended next steps
1. Connect real PostgreSQL and run migrations + seed
2. Add PDF invoice (e.g. pdfkit or react-pdf)
3. Thermal print CSS / window.print layout
4. Product edit & soft-hide
5. More robust mobile qty input for ml
6. Deploy frontend (Vercel) + backend (Render) + Neon DB
