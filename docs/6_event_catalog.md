# 6. Event Catalog

Casheer uses domain events to decouple logic between bounded contexts.

| Event Name | Publisher | Payload (Key Data) | Consumers | Action Taken |
| :--- | :--- | :--- | :--- | :--- |
| `Order.Completed` | Sales Domain | `orderId`, `branchId`, `total`, `items[]` | Inventory, Ops, CRM | Reduce stock, update shift float, add loyalty points |
| `Order.Voided` | Sales Domain | `orderId`, `branchId`, `items[]` | Inventory, Ops | Re-increment stock, reverse shift totals |
| `Shift.Opened` | Ops Domain | `shiftId`, `branchId`, `userId` | Audit, Analytics | Log action, flag branch as active |
| `Shift.Closed` | Ops Domain | `shiftId`, `variance`, `totals` | Audit, Notifications | Log action, email manager if variance > threshold |
| `Inventory.LowStock` | Inventory Domain | `productId`, `variantId`, `currentQty` | Notifications | Send push/email to Branch Manager |
| `Customer.Created` | CRM Domain | `customerId`, `tenantId` | Sync Engine | Push to offline clients |
