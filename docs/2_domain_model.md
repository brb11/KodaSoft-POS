# 2. Domain Model

Casheer follows Domain-Driven Design (DDD) principles. The system is divided into distinct Bounded Contexts.

## 2.1 Bounded Contexts & Responsibilities

### 1. Identity & Access Management (IAM)
*   **Responsibility**: Handles authentication, authorization, multi-tenancy grouping, and API key management.
*   **Key Entities**: Tenant, User, Role, Permission.

### 2. Core Catalog
*   **Responsibility**: The central repository of what is being sold.
*   **Key Entities**: Product, Variant, Category, ModifierGroup, ModifierOption.

### 3. Sales & Execution (POS)
*   **Responsibility**: Handling the actual transaction lifecycle, pricing calculations, and cart management.
*   **Key Entities**: Order, OrderLine, Payment, DiscountApplication, TaxApplication.

### 4. Operations & Cash Management
*   **Responsibility**: Managing the physical retail environment and cash drawer.
*   **Key Entities**: Branch, Terminal, Shift, CashMovement (Pay In/Out).

### 5. Inventory & Supply
*   **Responsibility**: Tracking physical goods, stock valuation, and supplier relationships.
*   **Key Entities**: StockLevel, StockMovement, PurchaseOrder, Supplier.

### 6. Customer Relations (CRM)
*   **Responsibility**: Tracking customer data, loyalty, and store credit.
*   **Key Entities**: Customer, StoreCreditTransaction, LoyaltyPointLedger.

### 7. Finance & Accounting (Foundation)
*   **Responsibility**: Core financial ledgers, tracking exact cash/digital movements, and providing hooks for future ERP integrations.
*   **Key Entities**: TransactionLedger, CashMovement, Account.

### 8. Device & Terminal Management
*   **Responsibility**: Tracking physical POS hardware, sync states, versions, and capabilities.
*   **Key Entities**: Device, TerminalSession, SyncLog, HardwareProfile.

### 9. Reporting & Analytics
*   **Responsibility**: Aggregating data for dashboards and exports. Consumes events to build read-optimized models (CQRS foundation).
*   **Key Entities**: DailySalesAggregate, ShiftSummaryReadModel.

## 2.2 Domain Communication

Domains communicate asynchronously via **Domain Events** and synchronously via strict Interfaces/Services.

**Crucial Rule on Transactional Consistency**: 
Core operations (Order Creation, Payment Processing, initial Stock Deduction) must be transactionally consistent to prevent data anomalies. Domain events are published *only after* the database transaction commits successfully. They are not replacements for core atomicity.

*   **Example 1**: The Sales Domain executes a single database transaction to save the `Order`, save the `Payment`, and reserve/deduct the `Inventory`. Only after this commits does it fire the `OrderCompletedEvent`.
    *   The **Operations Domain** listens to the event to increment the `Shift` cash/card totals.
    *   The **CRM Domain** listens to the event to award Loyalty Points.
    *   The **Reporting Domain** listens to update the materialized views.
*   **Example 2**: The Sales Domain synchronously calls the Catalog Domain service to fetch current pricing and tax rates before finalizing a cart.
