# 7. Permission Matrix

Role-Based Access Control (RBAC) governs all actions. Permissions are fine-grained and mapped to Roles.

## 7.1 Standard Roles
*   **Super Admin**: Has access to all tenants (System level, Casheer staff only).
*   **Tenant Owner**: Has access to all branches and billing within their tenant.
*   **Store Manager**: Has access to specific assigned branches. Can edit products, view reports, manage shifts.
*   **Cashier**: Has access to specific assigned branches. Can only create orders and manage their own shift.

## 7.2 Key Permissions (Granular)
*   `pos:sale:create`
*   `pos:sale:void` (Requires Manager Override)
*   `pos:sale:discount_apply` (Requires Manager Override if > max_allowed_percent)
*   `pos:shift:open`
*   `pos:shift:close`
*   `catalog:product:create`
*   `catalog:product:update`
*   `inventory:stock:adjust` (Requires Manager)
*   `report:sales:view`

## 7.3 Branch-Level Restrictions
A user with `report:sales:view` but restricted to `Branch A` will have their API queries automatically intercepted by the Prisma middleware to append `WHERE branch_id = 'A'`.
