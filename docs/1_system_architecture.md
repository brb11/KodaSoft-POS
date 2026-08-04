# 1. System Architecture Specification

## 1.1 Overall Architecture

Casheer follows a **Modular Monolith** architecture on the backend, paired with a **Smart Offline** (Local-First) Progressive Web Application (PWA) on the frontend. 

**Key Architectural Principles:**
1. **Strict Multi-Tenancy**: The system utilizes Logical Isolation within a shared PostgreSQL database. **PostgreSQL Row-Level Security (RLS) acts as the primary security boundary** to enforce tenant isolation at the database engine level, with Prisma middleware acting only as a secondary safeguard.
2. **Hardware Abstraction Layer**: The frontend interacts with peripherals (printers, scanners) via a strict abstraction layer. This ensures that while Phase 1 relies on Browser APIs, future implementations (e.g., native Electron bridges or local hardware daemons) can be swapped in without altering core business logic.

## 1.2 C4 Diagrams

### Level 1: System Context Diagram
```mermaid
C4Context
    title System Context diagram for Casheer POS
    
    Person(cashier, "Cashier", "Processes sales and returns at the branch")
    Person(manager, "Store Manager", "Manages inventory, shifts, and reports")
    
    System(casheer, "Casheer POS System", "Manages point of sale, inventory, and multi-branch operations")
    
    System_Ext(payment_gateway, "Payment Gateway", "Processes credit card transactions (e.g., Stripe, Mada)")
    System_Ext(erp, "External ERP / Accounting", "Optional third-party sync (e.g., Odoo, Xero)")
    
    Rel(cashier, casheer, "Uses for sales")
    Rel(manager, casheer, "Uses for management")
    Rel(casheer, payment_gateway, "Sends payment intents, receives status")
    Rel(casheer, erp, "Syncs daily summaries")
```

### Level 2: Container Diagram
```mermaid
C4Container
    title Container diagram for Casheer POS
    
    Person(user, "User", "Cashier or Manager")
    
    Container(pwa, "Web Application (PWA)", "React, Vite, Dexie.js", "Provides POS UI and offline capabilities")
    Container(api, "API Application", "NestJS, Node.js", "Handles business logic, validation, and sync")
    ContainerDb(db, "Primary Database", "PostgreSQL", "Stores all tenant data")
    ContainerDb(cache, "Cache / Queue", "Redis", "Session state, rate limiting, background jobs")
    
    Rel(user, pwa, "Interacts with")
    Rel(pwa, api, "Makes API calls & Syncs data", "JSON/HTTPS")
    Rel(api, db, "Reads/Writes", "Prisma/TCP")
    Rel(api, cache, "Pub/Sub, Caching", "TCP")
```

### Level 3: Component Diagram (API Application)
```mermaid
C4Component
    title Component diagram for API Application
    
    Container(pwa, "Web Application (PWA)", "React", "")
    
    Component(auth_module, "Auth Module", "NestJS Module", "Handles JWT and sessions")
    Component(sync_module, "Sync Module", "NestJS Module", "Handles offline outbox processing")
    Component(core_pos, "Core POS Module", "NestJS Module", "Orders, Shifts, Cash Drawer")
    Component(inventory, "Inventory Module", "NestJS Module", "Stock movements, tracking")
    
    ComponentDb(db, "Database", "PostgreSQL", "")
    
    Rel(pwa, auth_module, "Authenticates")
    Rel(pwa, sync_module, "Pushes offline transactions")
    Rel(pwa, core_pos, "Real-time orders (if online)")
    
    Rel(sync_module, core_pos, "Forwards synced orders")
    Rel(core_pos, inventory, "Triggers stock reduction")
    Rel(core_pos, db, "Persists orders")
    Rel(inventory, db, "Persists stock")
```

## 1.3 Data Flow (Offline Sync Request Lifecycle)

1.  **Action**: Cashier completes an order while offline.
2.  **Local Persistence**: PWA saves the order to IndexedDB (Dexie.js) via a local transaction.
3.  **Outbox Queue**: Order is appended to a local `sync_outbox` table.
4.  **UI Update**: User sees "Sale Complete" immediately.
5.  **Background Sync**: Service Worker detects internet restoration.
6.  **Transmission**: Payload is sent to `/api/v1/sync` endpoint with idempotency keys.
7.  **Backend Processing**:
    *   API verifies token and tenant.
    *   Extracts UUIDs from payload.
    *   Checks if UUID already exists (Idempotency).
    *   Executes Prisma transaction: Inserts Order, Deducts Inventory, Updates Shift totals.
8.  **Acknowledgment**: API returns `200 OK`. Client removes item from local outbox.

## 1.4 Deployment Architecture

*   **Frontend**: Hosted on Vercel/Netlify or served via Nginx globally via CDN.
*   **Backend**: Deployed as Docker containers via AWS ECS or Kubernetes.
*   **Database**: Managed PostgreSQL (e.g., AWS RDS).
*   **Cache**: Managed Redis (e.g., ElastiCache).
