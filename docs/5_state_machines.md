# 5. State Machines

Strict state transitions guarantee data integrity.

## 5.1 Orders State Machine
*   `DRAFT` → (Cart phase, mutable)
*   `PENDING_PAYMENT` → (Awaiting terminal response)
*   `COMPLETED` → (Paid in full, immutable)
*   `VOIDED` → (Cancelled before completion, inventory released)
*   `REFUNDED` → (Fully or partially returned, immutable)

**Rules**: You cannot transition from `COMPLETED` to `VOIDED`. You must create a `REFUNDED` state or child Return entity.

## 5.2 Shifts State Machine
*   `OPEN` → (Currently active, accepting transactions)
*   `CLOSING_PENDING` → (Drawer is being counted, locked from new sales)
*   `CLOSED` → (Reconciled, immutable)

## 5.3 Purchase Orders State Machine
*   `DRAFT` → (Creating list of items to buy)
*   `SENT` → (Emailed to supplier)
*   `PARTIALLY_RECEIVED` → (Some goods arrived, stock updated)
*   `RECEIVED` → (All goods arrived, PO closed)
*   `CANCELLED` → (Voided)
