# 3. Complete Entity Relationship Diagram (ERD)

## 3.1 ERD Diagram (Mermaid)

```mermaid
erDiagram
    TENANT ||--o{ USER : contains
    TENANT ||--o{ BRANCH : owns
    TENANT ||--o{ PRODUCT : owns
    TENANT ||--o{ CUSTOMER : owns
    
    BRANCH ||--o{ SHIFT : hosts
    BRANCH ||--o{ INVENTORY_LEVEL : tracks
    BRANCH ||--o{ TERMINAL : contains
    
    USER }|..|{ ROLE : has
    ROLE }|..|{ PERMISSION : includes
    
    PRODUCT ||--o{ PRODUCT_VARIANT : has
    PRODUCT ||--o{ MODIFIER_GROUP : uses
    MODIFIER_GROUP ||--o{ MODIFIER_OPTION : contains
    PRODUCT ||--o{ BATCH_SERIAL : tracks
    
    PRODUCT }o--|| CATEGORY : belongs_to
    PRODUCT }o--|| TAX_RATE : applies
    
    SHIFT ||--o{ ORDER : records
    SHIFT ||--o{ FINANCIAL_LEDGER : logs
    
    ORDER ||--o{ ORDER_LINE : contains
    ORDER ||--o{ PAYMENT : receives
    ORDER }o--|| CUSTOMER : belongs_to (optional)
    
    ORDER_LINE }o--|| PRODUCT : references
    ORDER_LINE }o--|| PRODUCT_VARIANT : references
    
    INVENTORY_LEVEL ||--o{ STOCK_MOVEMENT : history
    PRODUCT ||--o{ STOCK_MOVEMENT : tracked_by
    
    SUPPLIER ||--o{ PURCHASE_ORDER : receives
    PURCHASE_ORDER ||--o{ PO_LINE : contains
    
    PAYMENT ||--o{ FINANCIAL_LEDGER : records
```

## 3.2 Standard Audit Metadata & Soft Deletes
Every business entity table contains standard audit and concurrency columns:
*   `created_at` (TIMESTAMPTZ, DEFAULT NOW())
*   `created_by` (UUID, FK to Users)
*   `updated_at` (TIMESTAMPTZ)
*   `updated_by` (UUID, FK to Users)
*   `deleted_at` (TIMESTAMPTZ, NULL)
*   `deleted_by` (UUID, FK to Users)
*   `is_deleted` (BOOLEAN, DEFAULT FALSE)
*   `version` (INTEGER, DEFAULT 1) - Used for Optimistic Concurrency Control on frequently edited tables (Products, Customers, Settings).

**Soft Delete Policy**: Physical `DELETE` operations are strictly forbidden via DB roles. Application queries must globally filter `WHERE is_deleted = false`.

## 3.3 Data Types & Precision
*   **Money**: All monetary values (price, tax, discount, total, cost) use `NUMERIC(15,4)` in PostgreSQL. Floating-point types (`REAL`, `DOUBLE PRECISION`) are completely prohibited to prevent rounding errors.
*   **Keys**: `UUIDv7` for all primary keys to ensure global uniqueness and chronological sorting (crucial for offline sync).

## 3.4 Advanced Inventory Schema
The `inventory_levels` table is separated into states rather than a single number:
*   `on_hand_qty` (Physical count in store)
*   `reserved_qty` (Held for pending orders/quotes)
*   `available_qty` (Calculated: `on_hand - reserved`)
*   `incoming_qty` (Expected from pending Purchase Orders)

**Batch / Lot / Serial Support**: A `batch_serials` table tracks expiration dates and exact serial numbers, linking to specific `stock_movements`. This is optional per product but structurally supported from day one.

## 3.5 Financial Ledger Foundation
A lightweight, immutable `financial_ledger` table acts as the source of truth for accounting.
*   **Columns**: `id`, `tenant_id`, `branch_id`, `account_type` (Asset, Liability, Revenue, Expense), `transaction_type` (Sale, Refund, Pay-In, Pay-Out), `amount` (NUMERIC), `reference_id` (e.g., Order ID, Expense ID).
*   Every Payment, Cash Drawer action, or Refund inserts balanced entries here.

## 3.6 Database Constraints & Integrity
We rely on PostgreSQL engine constraints, not just ORM validations:
*   **CHECK Constraints**: `CHECK (price >= 0)`, `CHECK (quantity >= 0)`.
*   **UNIQUE Constraints**: `UNIQUE(tenant_id, sku) WHERE is_deleted = false` (Partial Unique Index to support soft deletes).
*   **Foreign Keys**: Explicit `ON DELETE RESTRICT` for core relationships (e.g., cannot delete a category if products use it). `ON DELETE SET NULL` for optional references.
*   **Indexes**: B-Tree indexes on all foreign keys, composite indexes on `(tenant_id, branch_id, created_at)` for reporting queries, and GIN indexes for JSONB columns like `modifiers` or `receipt_snapshot`.
