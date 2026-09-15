-- AlterTable
ALTER TABLE "purchase_items" ADD COLUMN     "unitId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_items_unitId_idx" ON "purchase_items"("unitId");

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "product_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;