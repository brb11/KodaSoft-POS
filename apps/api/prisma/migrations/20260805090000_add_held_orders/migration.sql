-- CreateTable
CREATE TABLE "held_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "customer" JSONB,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "held_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "held_orders_tenantId_idx" ON "held_orders"("tenantId");

-- CreateIndex
CREATE INDEX "held_orders_branchId_createdAt_idx" ON "held_orders"("branchId", "createdAt");
