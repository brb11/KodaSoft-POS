## Objective
- Turn Casheer into a real SaaS under the brand **KodaSoft-Casheir**: self-service signup with plan choice, trial→pay flow, subscription guard, and a public bilingual marketing site.
- Remove the `free` plan; users pick a paid plan at signup (14-day free trial), then must "pay/renew" that same plan after expiry, and may change plans from the dashboard.

## Important Details
- **Branding**: System name is **KodaSoft-POS** (displayed as `KodaSoft-` + accent `POS`). Package identifiers remain `@casheer/*` (technical, unchanged). User-facing strings updated across: web `index.html` title, `languageStore.ts` (loginTitle/newHere EN+AR), `reportExport.ts` (title + brand-name block), `DashboardLayout.tsx`/`PosTerminal.tsx`/`SaasConsole.tsx` brand text, api `main.ts` (health service + startup log), `prisma/seed.ts` (log + platform tenant/admin names — existing DB rows still say old names, update manually if needed), site `Header.astro`/`Footer.astro` (brand + copyright), site `i18n.ts` (meta/hero/cta EN+AR), site page titles. `dist/` regenerated. Existing DB rows and docs/ still use old name.

## Important Details
- Monorepo: pnpm 9.0.0 + turbo (`apps/*`, `packages/*`); Prisma 6.19.3 / Postgres; Express API (:3001), React web (:5173), Astro 7 + Tailwind v4 marketing site in `apps/site` (:4321). API runs via `ts-node-dev` watch (PID varies; see `Get-NetTCPConnection` on 3001) — auto-reloads on file changes.
- Plan catalog (`apps/api/src/modules/billing/plans.ts`): free plan **deleted**; starter (5/1/500, $29, ZATCA), pro (20/3/5000, $79, +offline/advancedReports/multiBranch), enterprise (-1 unlimited, $199). `getPlan(key)`; `-1` = unlimited; `assertPlanLimit` gates creation (403 `PLAN_LIMIT_REACHED`, skipped during TRIAL).
- Signup (`auth.service.ts` / `auth.schema.ts`): `plan` optional (defaults `starter`), validated against `PLANS` (422 `Invalid plan selected`); 14-day TRIAL of chosen plan; `POST /api/v1/auth/signup`.
- Billing guard (`subscription.guard.ts`): 402 `SUBSCRIPTION_INACTIVE` for PAST_DUE/CANCELED/expired-TRIAL; auto-flips expired trial → PAST_DUE; legacy tenants grandfathered. Mounted on products/categories/orders/shifts/reports/branches/users/customers routers.
- Billing service (`billing.service.ts`): `getBillingOverview`, `changePlan(tenantId, planKey)` (409 `PLAN_DOWNGRADE_BLOCKED`; reactivates inactive sub on upgrade), `renewSubscription(tenantId)` (reactivates PAST_DUE/CANCELED on same `tenant.plan`, +30d).
- Billing router: `GET /billing/plan`, `PUT /billing/plan` (OWNER only, 403 else), `POST /billing/renew` (OWNER only).
- Web: `billingStore.ts`, `api.ts` interceptor dispatches `casheer:subscription-inactive` on 402, `SubscriptionGuard`, `PaywallScreen` (now has OWNER renew button → `POST /billing/renew` then `refresh()`), `SettingsPage` (renew banner + button when PAST_DUE/CANCELED; `PLAN_ORDER = ['starter','pro','enterprise']`; `planLabel` has no `free` case), `RegisterPage` (plan picker: `SIGNUP_PLANS` starter/pro/enterprise with icons+price, sends `plan` in POST body), `SaasConsole` PLAN_ORDER updated.
- `apps/site`: bilingual `/en`+`/ar` home + pricing pages; `src/data/plans.ts` has no `free`; `SitePlan['key']` = starter|pro|enterprise; `PricingCard.astro` no free branch; `i18n.ts` EN+AR: no `planFree`/`freeCta`, FAQ1 rewritten ("Is there really a free trial?" / "Every new account gets a 14-day free trial of your chosen plan — no credit card required"), pricingSubtitle updated. Zero client-side JS. SiteLayout imports `../styles/global.css` via frontmatter.
- Web translations (`languageStore.ts`): removed `saasFree`; added `signupPlanTitle/signupPlanDesc/signupTrialNote` + `renewTitle/renewDesc/renewNow/renewing/renewSuccess/renewFailed` (AR + EN + interface).
- SMOKE TEST (dev DB): signup `{plan:'pro'}` → TRIAL/periodEnd+14d; expired periodEnd → GET /products = 402 `SUBSCRIPTION_INACTIVE`; `POST /billing/renew` → ACTIVE/periodEnd+30d + products OK; signup `{plan:'gold'}` → 422; signup no plan → defaults starter TRIAL; MANAGER `PUT /billing/plan` → 403. Test tenants left in dev DB: Smoke Store (b7f1d0e8-431d-4db6-9fc3-81fd40df778e), NoPlan, Bad.
- Full `pnpm build` (3/3), `npx tsc --noEmit` in api+web, and `pnpm astro check` all green.

## Work State
### Completed
- Backend SaaS foundation: SUPER_ADMIN role, `Subscription` model, manual migration, super admin `admin@casheer.app`/`admin123`, platform tenant, seeded subscriptions.
- Signup multi-tenant provisioning + plan choice, billing module + guard + renew.
- Frontend plan picker + renew UI + paywall + guards; `free` removed everywhere in web + site.
- Free plan fully removed: backend catalog, signup, billing overview plans list, web PLAN_ORDER/planLabel/saasFree, site data/i18n/cards/tables.
- Live smoke test of full trial→expire→renew→guard→permissions flow — all passing.
- **Product CSV Import/Export** (`apps/api/src/modules/products/products.csv.ts` + `products.service.ts` + `products.router.ts`):
  - `GET /api/v1/products/export` → CSV download (Content-Disposition attachment, BOM for Excel). Columns: `name,nameAr,category,sku,barcode,description,price,cost,unit,trackInventory,type,isActive`.
  - `POST /api/v1/products/import` (body `{ csv: string }`) → upsert-by-SKU, auto-creates categories matched by name (slug auto-generated, dedup `-2`, `-3`), plan-limit pre-check (403 PLAN_LIMIT_REACHED), per-row errors → summary `{imported,updated,skipped,errors[]}`.
  - Hand-rolled CSV parse/serialize (no dep) in `products.csv.ts` — handles quoted fields/commas/escaped quotes, BOM, blank lines. Header case-insensitive via `field()` helper.
  - Routes registered BEFORE `GET /:id`; `main.ts` json/urlencoded limit bumped to 10mb.
  - Web: `ProductsPage.tsx` Export button (blob download) + Import button (hidden file input) + result banner; new i18n keys `importProducts/exportProducts/importCreated/importUpdated/importSkipped/importFailed` (AR+EN; `exportFailed` already existed for reports). `languageStore.ts` duplicate-identifier pitfall: check for existing keys before adding.
  - Smoke-tested live: import 2 create + 1 skip(Invalid price row 4); re-import updates by SKU; export round-trips nameAr/category/price and quoted fields; Content-Type/Disposition headers correct.
- **Stock Adjustment** (`apps/api/src/modules/inventory/` + `apps/web/src/app/dashboard/InventoryPage.tsx`):
  - `POST /api/v1/inventory/adjustments` (body `{ items: [{ productId, branchId, quantity(signed, non-zero), note? }] }`, OWNER/MANAGER only else 403) — transaction: product/branch validated against tenant (400 PRODUCT_NOT_FOUND/BRANCH_NOT_FOUND), negative delta guarded by `updateMany` quantity `gte` (400 INSUFFICIENT_STOCK), positive delta `updateMany`-then-`create` (Prisma compound-unique `where` rejects null variantId, so no upsert), each item writes `inventoryMovement` (type `adjustment`, referenceType `adjustment`, referenceId = shared `adj-<uuid>` batch, note, createdBy). Returns `{batchId, count, items}`.
  - `GET /api/v1/inventory/adjustments` (`page/limit/branchId`) — type `adjustment` movements scoped via `branch.tenantId`, newest first, with product (name/nameAr/sku) + branch name + `createdByName` (resolved by id lookup). Returns `{items,total,page,limit}`.
  - Router mounted at `/api/v1/inventory` in `main.ts` behind `authenticate` + `requireActiveSubscription`; `GET` any role, `POST` requires OWNER/MANAGER via `requireRole`.
  - Web `InventoryPage.tsx`: per-branch stock table (branch selector, defaults to `user.branchId` else first branch; stock from `product.inventory.find(branch)`), "Adjust Stock" button (hidden for CASHIER) opening a modal (product/branch/type increase|decrease/quantity/current-stock/note) → POST then refetch products+history, and a "Stock Adjustment History" table (date, product+sku, branch, signed quantity badge, note, adjusted-by). New i18n keys added (AR+EN): `adjustStock/selectProduct/selectBranch/adjustmentType/increaseStock/decreaseStock/adjustmentQuantity/adjustmentReason/adjustmentReasonPlaceholder/confirmAdjust/adjustSuccess/adjustFailed/adjustmentHistory/adjustmentHistoryDesc/adjustedQuantity/adjustedBy/noAdjustments/currentStock`.
  - Smoke-tested live (Smoke Store, owner email `smoke1785763975@test.com` — password reset to `Test1234!`): increase 5 created inventory row, decrease 2 → quantity 3, over-decrease → 400 INSUFFICIENT_STOCK, random branch → 400 BRANCH_NOT_FOUND, history returns signed entries with createdByName. `npx tsc --noEmit` api+web and `pnpm build` (3/3) green.
- **Branch CRUD (completed delete)** (`branches.service.ts` / `branches.router.ts` / `BranchesPage.tsx`):
  - `DELETE /api/v1/branches/:id` — `deleteBranch` loads branch with `_count` of users/orders/inventory/shifts/expenses/inventoryMovements; any > 0 → 400 `BRANCH_IN_USE`; empty branch hard-deleted via `deleteMany` (404 `BRANCH_NOT_FOUND` if missing). Cross-tenant safe (`where { id, tenantId }`).
  - Web: trash button on each branch card → confirm modal (interpolates branch name via `translate()`) → `api.delete` → success/error banner; refetches. New i18n keys (AR+EN): `deleteBranch/confirmDeleteBranch/confirmDeleteBranchMsg/deleteBranchSuccess/deleteBranchFailed`.
  - Smoke-tested live: create → delete empty branch ok; delete Main (has users/orders/inventory) → 400 BRANCH_IN_USE; random id → 404. Typecheck + `pnpm build` green.
- **Users CRUD (delete added)** (`users.service.ts` / `users.router.ts` / `UsersPage.tsx`):
  - `DELETE /api/v1/users/:id` (OWNER/MANAGER only, existing `requireAdmin`): guards — 400 `CANNOT_DELETE_SELF` (acting user), 404 `USER_NOT_FOUND`, 400 `LAST_OWNER` (only active OWNER), 400 `USER_HAS_HISTORY` (orders+shifts+expenses > 0 — deactivate instead); deletes ephemeral notifications then user in a transaction.
  - Web: trash button per row (disabled for own row), confirm modal (interpolated name), success/error banner. New i18n keys (AR+EN): `deleteUser/confirmDeleteUser/confirmDeleteUserMsg/deleteUserSuccess/deleteUserFailed`.
  - Smoke-tested: self-delete → 400 CANNOT_DELETE_SELF; MANAGER deleting sole OWNER → 400 LAST_OWNER; temp cashier/manager create→delete OK.
- **Customers CRUD (completed)** (`customers.service.ts` / `customers.router.ts` / new `CustomersPage.tsx`):
  - Added `PUT /api/v1/customers/:id` (`updateCustomer`, partial via `updateCustomerSchema`) and `DELETE /api/v1/customers/:id` (`deleteCustomer` — 404 `CUSTOMER_NOT_FOUND`; 400 `CUSTOMER_HAS_ORDERS` if any order references it).
  - Web: new dashboard page at `/dashboard/customers` (nav item in `DashboardLayout`, route in `App.tsx`) — server-side search, table (name/phone/email/address), add/edit modal (name/phone/email/address/notes), delete confirm modal, success/error banner. New i18n keys (AR+EN): `customers/customersTitle/customersDesc/editCustomer/createCustomer/customerEmail/customerAddress/customerNotes/searchCustomers/loadingCustomers/noCustomers/saveCustomer/deleteCustomer/confirmDeleteCustomer/confirmDeleteCustomerMsg/deleteCustomerSuccess/deleteCustomerFailed/failedSaveCustomer` (reuses existing `addCustomer/customerName/customerPhone`).
  - Smoke-tested live: create/update/get/search/delete OK, 404 for unknown. Typecheck + `pnpm build` green.

### Blocked
- (none)

## Next Move
- (optional) Clean up smoke-test tenants/products from dev DB.
- (optional) Add real payment provider (Stripe/PayPal) behind `POST /billing/renew`, billing history endpoint, email notifications, webhook.
- (optional) Import/export template download + row-error detail list in UI.
- (optional) Stock adjustment: undo/delete an adjustment, filter history by product, include adjustments in the inventory report's movement breakdown, per-branch low-stock badges in the products page.

## Relevant Files
- `apps/api/src/modules/billing/plans.ts`, `billing.service.ts`, `billing.router.ts`, `subscription.guard.ts`.
- `apps/api/src/modules/auth/auth.schema.ts` (signupSchema `plan` optional), `auth.service.ts` (`getPlan(dto.plan??'starter')`, 422).
- `apps/api/prisma/schema.prisma` (postgresql), migrations.
- `apps/web/src/app/auth/RegisterPage.tsx` (plan picker cards).
- `apps/web/src/app/dashboard/SettingsPage.tsx` (renew banner, no free).
- `apps/web/src/components/guards/PaywallScreen.tsx` (renew button for OWNER).
- `apps/web/src/stores/languageStore.ts` (new keys, no saasFree).
- `apps/site/src/data/plans.ts`, `src/lib/i18n.ts`, `src/components/PricingCard.astro`, `src/pages/[lang]/pricing.astro`.
- `apps/api/src/modules/inventory/inventory.router.ts` / `inventory.service.ts` / `inventory.schema.ts` (stock adjustment; mounted in `main.ts`).
- `apps/api/src/modules/orders/orders.service.ts` (sale/void/refund movement pattern `type: 'sale'|'adjustment'|'return'`), `apps/api/src/modules/reports/reports.service.ts` (`inventoryMovement.groupBy`).
- `apps/web/src/app/dashboard/InventoryPage.tsx` (branch filter + adjust modal + history), `apps/web/src/stores/languageStore.ts` (stock-adjustment keys).
- `apps/api/src/modules/branches/branches.service.ts` / `branches.router.ts` (full CRUD incl. `deleteBranch`), `apps/web/src/app/dashboard/BranchesPage.tsx` (add/edit/delete modals + banner).
- `apps/api/src/modules/users/users.service.ts` / `users.router.ts` (deleteUser + LAST_OWNER/self/history guards), `apps/web/src/app/dashboard/UsersPage.tsx` (delete button/modal/banner).
- `apps/api/src/modules/customers/customers.service.ts` / `customers.router.ts` / `customers.schema.ts` (updateCustomer/deleteCustomer), `apps/web/src/app/dashboard/CustomersPage.tsx` (new page, route + nav item in `App.tsx`/`DashboardLayout.tsx`).
