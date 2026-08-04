# 9. Coding Standards

## 9.1 Folder Structure (NestJS & React)
We follow **Feature-Sliced Design**. Code is grouped by domain/feature, not by technical type.
*   **Bad**: `controllers/`, `services/`, `repositories/`
*   **Good**: `features/orders/`, `features/products/`

## 9.2 Naming Conventions
*   **Files**: `kebab-case.ts` (e.g., `order-service.ts`)
*   **Classes/Interfaces**: `PascalCase` (e.g., `OrderService`)
*   **Variables/Functions**: `camelCase` (e.g., `calculateTotal`)
*   **Database Tables**: `snake_case`, plural (e.g., `order_lines`)

## 9.3 Dependency Rules (Clean Architecture)
1.  **Domain Layer** (Types, Entities) has no dependencies.
2.  **Use Case Layer** (Services) depends only on Domain.
3.  **Infrastructure Layer** (Controllers, Prisma) depends on Use Cases.

## 9.4 Error Handling
Do not `throw` generic `Error` instances. Use custom Domain Exceptions (e.g., `InsufficientStockException`). Controllers catch these and map them to appropriate HTTP status codes (e.g., `409 Conflict`).

## 9.5 Logging
Use structured JSON logging (Winston or Pino) in production.
Required fields: `timestamp`, `level`, `traceId`, `tenantId`, `userId`, `message`.

## 9.6 Testing Conventions
*   **Unit Tests**: Logic heavy functions (tax calculation, discount engines). Vitest.
*   **Integration Tests**: API endpoints querying a test database (Testcontainers). Supertest.
*   Coverage target: > 80% on core domain logic.
