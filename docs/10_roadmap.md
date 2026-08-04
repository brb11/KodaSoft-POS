# 10. Development Roadmap

Implementation is divided into independently testable, production-quality milestones.

## Milestone 1: Core Foundation (Weeks 1-2)
*   Monorepo setup (Turborepo, pnpm).
*   NestJS skeleton + Prisma + PostgreSQL configuration.
*   Vite/React frontend scaffold + Tailwind + shadcn/ui.
*   Auth Module (JWT, Login, Roles).
*   *Test*: User can log in, receive token, and access a protected route.

## Milestone 2: Catalog & Inventory (Weeks 3-4)
*   Products, Categories, Variants CRUD APIs.
*   Basic Inventory ledger (Stock levels).
*   Frontend Catalog Manager UI.
*   *Test*: Manager can create a complex product with variants and add 100 units of stock.

## Milestone 3: The POS Terminal (Weeks 5-6)
*   Cashier UI (Grid layout, Cart, Barcode scanner input handling).
*   Pricing Engine (Taxes, Discounts).
*   Order creation API.
*   *Test*: Cashier can add items to cart, see correct total with taxes, and complete a cash sale. Inventory must reduce correctly.

## Milestone 4: Shift & Cash Management (Week 7)
*   Shift Open/Close flows.
*   Cash Drawer pay in/out APIs.
*   *Test*: Cashier opens shift with $100, makes a $50 sale, closes shift. System expects $150.

## Milestone 5: Offline Sync Engine (Weeks 8-9)
*   Dexie.js integration on frontend.
*   Service Worker caching.
*   Outbox queue and Background Sync API.
*   *Test*: Network disabled in DevTools -> complete sale -> network enabled -> sale syncs to backend seamlessly.

## Milestone 6: Multi-Branch & Dashboard (Week 10)
*   Admin dashboard charts (Sales today, top products).
*   Branch switcher.
*   *Test*: Tenant Owner can view aggregated sales across multiple branches.

## Milestone 7: Production Readiness (Weeks 11-12)
*   Arabic RTL support implementation.
*   Dockerization and CI/CD pipelines.
*   Load testing and final QA.
