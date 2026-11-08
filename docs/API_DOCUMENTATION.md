# Amwaj POS API

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <token>`

## Auth
- `POST /auth/login` — `{ username, password }` → `{ token, user }`
- `GET /auth/me` — current user

## Products
- `GET /products/categories`
- `GET /products?categoryId=&search=`
- `POST /products`
- `PUT /products/:id`

## Customers
- `GET /customers?search=`
- `GET /customers/:id`
- `POST /customers` — `{ name, mobile, notes? }`

## Billing
- `POST /billing/complete` — full bill payload with items, payments (must equal total)
- `GET /billing/history?search=&from=&to=`
- `GET /billing/:id`

## Settings
- `GET /settings`
- `PUT /settings`
- `GET /settings/reports/sales?from=&to=`

Money amounts are in **paise** (integer).  
Invoice numbers generated server-side.
