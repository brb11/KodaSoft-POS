-- AlterTable
ALTER TABLE "orders" ADD COLUMN "invoiceUuid" TEXT;
ALTER TABLE "orders" ADD COLUMN "invoiceHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoiceUuid_key" ON "orders"("invoiceUuid");