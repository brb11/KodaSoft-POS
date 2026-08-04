# Casheer — Enterprise POS System: Implementation Plan

## Overview

**Casheer** is a modern, production-ready, multi-branch Point of Sale system designed for retail and restaurant businesses. It is built with a **Local-First** architecture to guarantee business continuity even during internet outages, backed by a cloud sync layer for analytics, reporting, and multi-branch coordination.

---

## User Review Required

> [!IMPORTANT]
> Before I start scaffolding the project, I need your answers to the following critical design decisions. Your choices will directly impact the database schema, folder structure, and API surface.

> [!WARNING]
> **Primary Business Type**: Is Casheer targeting **Retail** (products with SKUs/barcodes), **Restaurant/F&B** (menu items, modifiers, kitchen display), or **Both**? This affects schema design significantly (e.g., kitchen orders, modifiers, tables).

> [!IMPORTANT]
> **Offline-First Depth**: Should the cashier terminal work **100% offline indefinitely** (full local DB on device), or is a **short-term offline buffer** (queue transactions for up to 24hrs) acceptable? Full offline requires Electron/Tauri or SQLite on device.

---

## Open Questions

1. **Deployment target**: Web browser only (SaaS), or also a desktop app (Electron/Tauri) for the cashier terminal?
2. **Scale**: Single store MVP, or must immediately support multi-branch with centralized reporting?
3. **Language / Localization**: Arabic (RTL) + English bilingual from day one? (I see `ar.json` in your other projects.)
4. **Payment gateways**: Local (e.g., Fawry, Mada, Tap Payments) or international (Stripe)?
5. **Receipt printing**: Browser Print API (thermal via web), or direct ESC/POS command integration?
6. **Existing DB**: Start fresh with PostgreSQL, or must integrate with an existing database?

---

## Architectural Decision Records (ADRs)

### ADR-1: Monorepo with Turborepo
**Decision**: Use a **monorepo** with `apps/` and `packages/` separation.  
**Why**: POS systems share types, validation schemas, and business logic between backend and frontend. A monorepo eliminates drift between shared contracts without a separate package registry.  
**Alternatives considered**: Polyrepo (rejected — type drift risk), nx (rejected — heavier tooling).

### ADR-2: Backend — Node.js + NestJS + TypeScript
**Decision**: NestJS as the backend framework.  
**Why**: NestJS enforces Clean Architecture natively (modules, services, repositories, guards). Its dependency injection container makes unit testing trivial. TypeScript is shared with the frontend, enabling end-to-end type safety via shared packages.  
**Alternatives**: Go (rejected — no shared types with frontend), Django (rejected — team context, slower iteration).

### ADR-3: Primary Database — PostgreSQL
**Decision**: PostgreSQL with **Prisma ORM**.  
**Why**: ACID compliance is non-negotiable for financial transactions. PostgreSQL's row-level security, JSONB columns (for flexible receipt data), and robust partitioning (for large `transactions` tables) make it the right choice. Prisma provides type-safe queries and migration management.

### ADR-4: Local-First / Offline — IndexedDB + Dexie.js + Background Sync
**Decision**: Use **Dexie.js** (IndexedDB wrapper) on the frontend for offline storage, with a **Web Worker + Outbox Pattern** for sync.  
**Why**: Avoids the need for Electron for basic offline capability. Each sale is first written to the local IndexedDB outbox, confirmed to the user immediately (optimistic UI), then synced in the background. For full offline (Electron), this can be upgraded to SQLite without changing business logic.

### ADR-5: Frontend — React + Vite + TypeScript
**Decision**: Vite + React + TypeScript for the frontend SPA.  
**Why**: Fast HMR during development, small bundle size. React's component model suits the complex, interactive cashier UI. Not Next.js — SSR provides no benefit for an authenticated, real-time POS terminal.

### ADR-6: State Management — Zustand + React Query
**Decision**: **React Query (TanStack Query)** for server state, **Zustand** for local UI state (active cart, shift state, drawer state).  
**Why**: React Query handles caching, background refetch, optimistic updates, and stale-while-revalidate perfectly. Zustand is lightweight and boilerplate-free for ephemeral terminal state.

### ADR-7: Authentication — JWT + Refresh Token Rotation
**Decision**: Short-lived **Access Tokens (15min)** + long-lived **Refresh Tokens (7 days)** stored in **httpOnly cookies**.  
**Why**: Prevents XSS token theft. Refresh token rotation invalidates stolen tokens. PIN-based quick login for cashiers after initial session establishment.

### ADR-8: API Design — REST with OpenAPI
**Decision**: REST over GraphQL for this domain.  
**Why**: POS operations are well-defined CRUD + business actions (open shift, void sale, apply discount). GraphQL's flexibility adds complexity without benefit here. OpenAPI spec is auto-generated from NestJS decorators (Swagger), enabling frontend SDK generation.

---

## Tech Stack Summary

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | 22 LTS |
| **Backend Framework** | NestJS | 11.x |
| **ORM** | Prisma | 6.x |
| **Primary DB** | PostgreSQL | 16 |
| **Cache / Queue** | Redis | 7 |
| **Frontend** | React + Vite | React 19, Vite 6 |
| **UI Components** | shadcn/ui + Radix UI | latest |
| **Styling** | Tailwind CSS v4 | 4.x |
| **State (server)** | TanStack Query | v5 |
| **State (local)** | Zustand | v5 |
| **Offline DB** | Dexie.js (IndexedDB) | v4 |
| **Validation** | Zod | v3 |
| **Monorepo** | Turborepo | v2 |
| **Package Manager** | pnpm | v9 |
| **Containerization** | Docker + Docker Compose | latest |
| **Testing** | Vitest + Supertest | latest |

---

## Folder Structure

```
casheer/
├── apps/
│   ├── api/                        # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── branches/
│   │   │   │   ├── products/
│   │   │   │   ├── categories/
│   │   │   │   ├── inventory/
│   │   │   │   ├── orders/
│   │   │   │   ├── payments/
│   │   │   │   ├── customers/
│   │   │   │   ├── suppliers/
│   │   │   │   ├── purchase-orders/
│   │   │   │   ├── discounts/
│   │   │   │   ├── taxes/
│   │   │   │   ├── shifts/
│   │   │   │   ├── expenses/
│   │   │   │   ├── returns/
│   │   │   │   ├── reports/
│   │   │   │   ├── notifications/
│   │   │   │   ├── audit-logs/
│   │   │   │   └── settings/
│   │   │   ├── common/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   ├── filters/
│   │   │   │   ├── decorators/
│   │   │   │   └── pipes/
│   │   │   ├── prisma/
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── Dockerfile
│   │
│   └── web/                        # React Frontend
│       ├── src/
│       │   ├── app/                # Route-level page components
│       │   │   ├── (auth)/
│       │   │   ├── (cashier)/      # POS Terminal UI
│       │   │   ├── (dashboard)/    # Admin/Manager
│       │   │   └── (settings)/
│       │   ├── features/           # Feature slices (collocated)
│       │   │   ├── cart/
│       │   │   ├── products/
│       │   │   ├── orders/
│       │   │   ├── customers/
│       │   │   └── ...
│       │   ├── components/
│       │   │   ├── ui/             # shadcn base components
│       │   │   └── shared/         # App-wide composites
│       │   ├── hooks/
│       │   ├── stores/             # Zustand stores
│       │   ├── lib/
│       │   │   ├── api/            # API client (generated)
│       │   │   ├── offline/        # Dexie DB + sync worker
│       │   │   └── utils/
│       │   └── locales/            # i18n (en, ar)
│       └── index.html
│
├── packages/
│   ├── shared-types/               # Zod schemas + TS types (shared)
│   ├── shared-utils/               # Pure utility functions
│   └── ui/                         # Optional shared UI lib
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## Database Schema Design (Core Tables)

```sql
-- TENANTS / ORGANIZATIONS
tenants (id, name, slug, plan, created_at)

-- BRANCHES
branches (id, tenant_id, name, address, phone, timezone, is_active)

-- USERS & ROLES
users (id, tenant_id, name, email, phone, password_hash, pin_hash, role, is_active, created_at)
roles (id, tenant_id, name, permissions jsonb)  -- RBAC

-- PRODUCTS
categories (id, tenant_id, name, slug, image_url, parent_id, sort_order)
products (id, tenant_id, category_id, name, sku, barcode, description, image_url,
          price, cost, tax_rate_id, unit, is_active, track_inventory, is_composite)
product_variants (id, product_id, name, sku, barcode, price_modifier, cost)
product_modifiers (id, product_id, name, options jsonb, required, max_select) -- F&B

-- INVENTORY
inventory (id, product_id, variant_id, branch_id, quantity, low_stock_threshold, updated_at)
inventory_movements (id, branch_id, product_id, variant_id, type, quantity, 
                     reference_id, reference_type, note, created_by, created_at)

-- PRICING
tax_rates (id, tenant_id, name, rate, is_compound, is_active)
discount_rules (id, tenant_id, name, type, value, min_qty, min_amount, 
                applies_to, conditions jsonb, valid_from, valid_until, is_active)

-- CUSTOMERS
customers (id, tenant_id, name, email, phone, address, loyalty_points, 
           credit_balance, notes, created_at)

-- SHIFTS
shifts (id, branch_id, user_id, opened_at, closed_at, opening_cash, 
        closing_cash, expected_cash, status, notes)

-- ORDERS (Core transaction table)
orders (id, tenant_id, branch_id, shift_id, customer_id, cashier_id,
        order_number, status, type, subtotal, discount_amount, tax_amount, 
        total, paid_amount, change_amount, notes, receipt_data jsonb,
        is_synced, created_at, updated_at)

order_items (id, order_id, product_id, variant_id, name, sku, quantity,
             unit_price, discount_amount, tax_amount, subtotal, modifiers jsonb)

-- PAYMENTS
payments (id, order_id, method, amount, reference, status, gateway_response jsonb, created_at)
payment_methods (id, tenant_id, name, type, is_active, config jsonb)

-- RETURNS & REFUNDS
returns (id, order_id, branch_id, cashier_id, reason, refund_method, 
         refund_amount, status, created_at)
return_items (id, return_id, order_item_id, quantity, reason)

-- SUPPLIERS & PURCHASE ORDERS
suppliers (id, tenant_id, name, contact_name, email, phone, address)
purchase_orders (id, branch_id, supplier_id, status, total, notes, expected_at, created_at)
purchase_order_items (id, po_id, product_id, variant_id, quantity, unit_cost, received_qty)

-- EXPENSES
expenses (id, branch_id, shift_id, category, amount, description, receipt_url, 
          created_by, created_at)

-- AUDIT LOGS
audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, 
            old_value jsonb, new_value jsonb, ip_address, created_at)

-- NOTIFICATIONS
notifications (id, tenant_id, user_id, type, title, body, data jsonb, read_at, created_at)

-- SETTINGS
settings (id, tenant_id, branch_id, key, value jsonb, updated_at)
```

---

## API Endpoints (Phase 1 — Core)

### Auth
```
POST   /api/v1/auth/login
POST   /api/v1/auth/pin-login       # Quick PIN for cashiers
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### Products
```
GET    /api/v1/products             # paginated, filterable, searchable
POST   /api/v1/products
GET    /api/v1/products/:id
PUT    /api/v1/products/:id
DELETE /api/v1/products/:id
GET    /api/v1/products/barcode/:barcode   # cashier barcode lookup
GET    /api/v1/categories
POST   /api/v1/categories
```

### Orders
```
POST   /api/v1/orders               # Create & complete sale
GET    /api/v1/orders
GET    /api/v1/orders/:id
POST   /api/v1/orders/:id/void
POST   /api/v1/orders/:id/refund
GET    /api/v1/orders/:id/receipt
```

### Shifts
```
POST   /api/v1/shifts/open
POST   /api/v1/shifts/:id/close
GET    /api/v1/shifts/current
GET    /api/v1/shifts/:id/summary
```

### Reports
```
GET    /api/v1/reports/sales-summary
GET    /api/v1/reports/top-products
GET    /api/v1/reports/inventory-valuation
GET    /api/v1/reports/cashier-performance
GET    /api/v1/reports/daily-transactions
```

---

## Security Strategy

| Concern | Mitigation |
|---|---|
| XSS | httpOnly cookies for tokens, CSP headers |
| CSRF | SameSite=Strict cookies + CSRF token for mutations |
| SQLi | Prisma parameterized queries (no raw SQL) |
| IDOR | Tenant-scoped queries on every resolver |
| Brute Force | Redis rate limiting (5 attempts / 15min) |
| PCI Compliance | Never store raw card data; tokenize via payment gateway |
| Audit Trail | Immutable `audit_logs` table, append-only |
| Secrets | Environment variables, never in source code |

---

## Delivery Phases

### Phase 1 — Foundation & Core POS (Weeks 1–3)
- [ ] Monorepo scaffold (Turborepo + pnpm)
- [ ] NestJS API with Prisma + PostgreSQL
- [ ] Docker Compose (postgres, redis, api, web)
- [ ] Auth module (JWT, PIN login, RBAC guards)
- [ ] Users & Roles module
- [ ] Branches module
- [ ] Products & Categories module
- [ ] Cashier terminal UI (cart, product grid, barcode scan)
- [ ] Orders module (create sale, apply discount, tax calculation)
- [ ] Payments module (cash, split payment)
- [ ] Shift open/close
- [ ] Receipt generation (browser print)

### Phase 2 — Inventory & Customers (Week 4–5)
- [ ] Inventory management (stock levels, movements, low-stock alerts)
- [ ] Customer management (loyalty points, credit)
- [ ] Returns & Refunds module
- [ ] Purchase Orders & Suppliers

### Phase 3 — Reporting & Dashboard (Week 6)
- [ ] Admin dashboard with KPI cards
- [ ] Sales reports (daily, weekly, by product, by cashier)
- [ ] Inventory reports
- [ ] Shift reports

### Phase 4 — Offline Capability & Sync (Week 7)
- [ ] Dexie.js offline store
- [ ] Outbox pattern sync worker
- [ ] Conflict resolution strategy

### Phase 5 — Advanced Features (Week 8–9)
- [ ] Discounts & Promotions engine
- [ ] Expense management
- [ ] Notifications (in-app + push)
- [ ] Audit logs viewer
- [ ] Multi-branch management UI

### Phase 6 — Polish & Production (Week 10)
- [ ] i18n (Arabic RTL + English)
- [ ] Docker production build + Nginx
- [ ] Performance optimization (DB indexes, query analysis)
- [ ] Automated tests (unit + e2e)
- [ ] Backup & recovery scripts
- [ ] Deployment guide (VPS / cloud)

---

## Verification Plan

### Automated Tests
- `pnpm test` — Vitest unit tests for business logic (tax calc, discount engine, inventory deduction)
- `pnpm test:e2e` — Supertest API integration tests for all order flows
- Browser automation for cashier UI critical paths

### Manual Verification
- Full sale flow: scan barcode → add to cart → apply discount → split payment → print receipt
- Offline sale: disable network → complete sale → re-enable → verify sync
- Shift close: verify cash reconciliation accuracy
- Multi-branch: verify tenant isolation (Branch A cannot see Branch B data)
