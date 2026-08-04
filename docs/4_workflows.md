# 4. Business Workflows

## 4.1 Sales Workflow
1. Cashier scans barcode or taps UI.
2. Item added to Cart (local state).
3. If online, fetch live price/discounts. If offline, use local DB cache.
4. Cashier selects Payment Method.
5. Exact amount tendered -> Order mapped to payload.
6. Order stored to Local IndexedDB Outbox.
7. Receipt prints.
8. UI clears for next customer.
9. Sync worker pushes outbox to cloud.

## 4.2 Returns Workflow
1. Customer presents receipt.
2. Cashier scans receipt barcode (Order ID).
3. System retrieves immutable `Order`.
4. Cashier selects items to return and specifies condition (Return to Stock or Write-off).
5. System creates a `ReturnOrder` linked to original `Order`.
6. Triggers `RefundPayment` logic.
7. Triggers `StockMovement` (if returned to stock).

## 4.3 Shift Management Workflow
1. Cashier logs in (PIN).
2. Prompted to "Open Shift".
3. Enters opening float (cash in drawer).
4. Shift status becomes `OPEN`.
5. All transactions during this period link to this `Shift ID`.
6. End of day: Cashier selects "Close Shift".
7. Cashier blind-counts the drawer and enters total.
8. System calculates Variance (Expected vs. Actual).
9. Shift status becomes `CLOSED`. Manager notified if variance exceeds threshold.

## 4.4 Offline Synchronization Workflow (Outbox Pattern)
1. Device loses internet.
2. Service Worker intercepts API calls. Mutating calls (POST/PUT) are saved to Dexie.js `outbox_table` with a UUID, timestamp, and payload.
3. Network returns.
4. Background worker reads `outbox_table` chronologically.
5. Sends payload to `/api/v1/sync/batch`.
6. Server processes batch inside a database transaction to ensure ACID compliance.
7. Server returns success array. Local outbox items are deleted.
