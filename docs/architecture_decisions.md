# Casheer — Enterprise POS Architecture Decisions

This document outlines the foundational Architectural Decision Records (ADRs) for Casheer, an enterprise-grade Point of Sale system.

## 1. Primary Business Type

**Decision**: Support **Both** (Retail and Restaurant/Food & Beverage).

**Reasoning**: Modern enterprise POS systems (like Odoo, Square, or Lightspeed) cannot afford to ignore either sector. While F&B introduces complexity (modifiers, kitchen routing, table management), designing for it from day one ensures the data model is robust enough to handle complex retail items (composites, variants) as well.
**Alternatives considered**: Retail only (simpler, but limits market), F&B only (limits market).
**Advantages**: Maximum market reach; core architecture handles complexity natively.
**Disadvantages**: Increased initial development time; schema complexity.
**Future scalability impact**: Allows seamless onboarding of hybrid businesses (e.g., a bookstore with a cafe).
**Implementation recommendation**: Core tables (`products`, `orders`) must support `type` discriminators. Mandatory modules: Core POS, Inventory. Optional modules (feature-flagged per tenant): Kitchen Display System (KDS), Table Management.

## 2. Offline Strategy

**Decision**: **Smart Offline Mode** (Local persistence with background synchronization).

**Reasoning**: A 100% full offline system requires thick clients (Electron/Tauri) and heavy local databases (SQLite), complicating deployment and updates. Smart Offline uses the browser's IndexedDB to queue transactions (Outbox Pattern) and cache necessary data (catalog, prices). It allows the terminal to survive network drops without the overhead of a full desktop app.
**Alternatives considered**: Full Offline-First (high maintenance, deployment friction), Cloud-only (unacceptable for POS).
**Sync strategy**: Background Web Workers ping the server. If online, flush the outbox queue.
**Conflict resolution**: Client-generated UUIDv7 for all primary keys. Last-write-wins for mutable entities, but transactions/orders are immutable and append-only.
**Recovery strategy**: On catastrophic local failure, re-sync from cloud.
**Data integrity guarantees**: Transactions are stored locally before clearing the UI.
**Limitations**: Cannot query historical data not in the local cache while offline.
**Implementation recommendation**: Use Dexie.js for IndexedDB management and a custom Sync Engine.

## 3. Deployment Targets

**Decision**: **Web (Browser-based PWA)** for Phase 1. Desktop (Electron) and Mobile (React Native) postponed.

**Reasoning**: A Progressive Web App (PWA) delivers 90% of the value with 10% of the deployment friction. It bypasses app store approvals and OS-specific installers, allowing instant updates. Modern browsers support hardware access (USB/Bluetooth) via Web APIs.
**Alternatives considered**: Desktop first (slower iteration), Mobile first (screen size too small for complex POS).
**Advantages**: Single codebase, instant deployments.
**Disadvantages**: Limited low-level hardware access compared to native.
**Implementation recommendation**: Build a responsive React SPA and configure a robust Service Worker for caching assets and PWA installation.

## 4. Scalability

**Decision**: **Multi-Tenant SaaS** with Logical Isolation (Shared Database, Tenant ID column).

**Reasoning**: Row-level tenant isolation is the most cost-effective and manageable approach for a SaaS targeting thousands of businesses. Database-per-tenant is too expensive and complex to migrate.
**Alternatives considered**: Database-per-tenant (complex migrations), Single Store (not scalable).
**Tenant isolation**: Enforced via PostgreSQL Row Level Security (RLS) and Prisma middleware/extensions injecting `where: { tenantId }`.
**Branch isolation**: Data belongs to a Tenant, but is scoped to Branches. RBAC controls branch access.
**Permission inheritance**: Roles are defined at the Tenant level, assigned to Users globally or per-Branch.
**Implementation recommendation**: Every table (except system catalogs) must have a `tenant_id` column.

## 5. Localization

**Decision**: **Arabic RTL + English** native support from Day One, using ICU Message Format.

**Reasoning**: Retrofitting RTL and i18n into a complex UI is notoriously difficult and error-prone. It must be foundational.
**Alternatives considered**: English only MVP (unacceptable for MENA market).
**Currency/Number/Date formatting**: Rely strictly on `Intl.NumberFormat` and `Intl.DateTimeFormat` passing the tenant's configured locale and timezone.
**Time zones**: Store all dates in UTC. Convert to Tenant/Branch timezone only on the client or during report generation.
**Implementation recommendation**: Use `react-i18next` or `next-intl`. Design UI components with logical CSS properties (`margin-inline-start` instead of `margin-left`).

## 6. Payment Integration

**Decision**: **Strategy Pattern Payment Gateway Abstraction**.

**Reasoning**: Payment providers change constantly and vary by region. The core order engine should not know about Stripe or Mada.
**Alternatives considered**: Hardcoding one gateway (limits market).
**Architecture**: An `IPaymentProvider` interface. The backend determines the active provider for the tenant/branch and routes the payload.
**Supported types**: Cash, Card (External Terminal), Card (Integrated), Split Payments, Store Credit.
**Implementation recommendation**: Create a `payments` micro-module in NestJS using the Strategy pattern to easily plug in new gateways.

## 7. Receipt Printing

**Decision**: **Browser Printing (Phase 1) + Network ESC/POS (Phase 2)**.

**Reasoning**: Browser printing (generating HTML/PDF and calling `window.print()`) works immediately on any OS with any installed printer. It removes the largest friction point in POS adoption: hardware setup.
**Alternatives considered**: Direct USB/Bluetooth ESC/POS (complex browser permissions, unreliable).
**Implementation recommendation**: Design receipts using HTML/CSS. Provide an optional local utility (e.g., a lightweight Go/Node daemon) for businesses requiring silent, raw ESC/POS printing over LAN.

## 8. Database Strategy

**Decision**: **PostgreSQL** (Fresh Database).

**Reasoning**: PostgreSQL is the gold standard for relational, transactional data. It supports JSONB (crucial for flexible configurations, modifiers, and receipt snapshots) and RLS (crucial for SaaS).
**Alternatives considered**: MySQL (less robust JSON/RLS), NoSQL (unsuitable for financial relationships).
**Migration strategy**: Prisma Migrate.
**Backup strategy**: Daily full dumps + WAL (Write-Ahead Logging) archiving to AWS S3 (Point-in-Time Recovery).
**High availability**: Managed PostgreSQL (e.g., AWS RDS or Supabase) with read replicas.
**Implementation recommendation**: Use Prisma ORM.

## 9. Future Expansion

**Decision**: Build core as a monolith; design extensibility via **Webhooks and APIs (Plugin Architecture)**.

**Core Modules**: Inventory, Customers, Cashier, Reports, Settings.
**Plugins/Integrations**: Accounting, CRM, HR, ERP, E-commerce.
**Reasoning**: Trying to build a full ERP will kill the project. Focus on being the best POS and integrate with the best ERPs (Odoo, Xero, QuickBooks).
**Implementation recommendation**: Implement an Event Emitter in NestJS. Expose a robust REST API and Webhook subscription system for external integrations.

## 10. Additional Enterprise Decisions

*   **Architecture**: Modular Monolith (NestJS). Easy to split into microservices later if needed, but simple to deploy now.
*   **CQRS**: No. Overkill for Phase 1. Standard Controller-Service-Repository is sufficient until write-load dictates otherwise.
*   **Background Jobs**: Redis + BullMQ for heavy reports, sending emails, and processing webhook deliveries.
*   **Audit Logs**: Mandatory. An append-only table recording `user_id`, `action`, `resource`, and `changes` (JSONB) for sensitive operations (voids, returns, inventory manual adjustments).
*   **Monitoring/Error Tracking**: Sentry for error tracking, Prometheus/Grafana for metrics.
*   **Feature Flags**: Store in DB per tenant to enable/disable modules (e.g., KDS, Loyalty).
*   **API Versioning**: URI Versioning (`/api/v1/...`).
*   **Caching Strategy**: Redis for session data and tenant configurations. Stale-while-revalidate via TanStack Query on the frontend.
*   **Security Policies**: Strict CSP, JWT in HttpOnly cookies, Rate Limiting, standard OWASP mitigations.

---

This document establishes the architectural baseline for Casheer. Proceeding with these decisions ensures a robust, scalable, and maintainable enterprise product.
