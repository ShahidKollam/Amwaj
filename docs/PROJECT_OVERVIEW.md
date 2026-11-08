# Amwaj POS — Project Overview

Premium internal Point of Sale application for an attar, oud, perfume, bakhoor and accessories shop.

## Brand & Design
- Name: **Amwaj POS**
- Primary: Deep Emerald `#064B3C`
- Secondary: Champagne Gold `#C69A50`
- Background: Warm Ivory `#FAF8F3`
- Mobile-first PWA with adaptive tablet/desktop layouts
- Reference layout matches the supplied Scently-style billing screen

## Stack
- Frontend: React 18 + Vite + Tailwind CSS + Lucide icons + PWA
- Backend: Node.js + Express + Prisma + PostgreSQL
- Auth: Simple username + password, JWT, bcrypt
- Money: Stored in integer paise (minor units)

## Core Modules
1. Authentication (internal staff only)
2. Billing / POS (primary screen)
3. Product catalog
4. Customers
5. Invoice history + WhatsApp share
6. Settings + basic sales reports

## Out of scope (v1)
Inventory/stock, purchase orders, suppliers, accounting, loyalty, customer portal, complex UPI auto-verification.
