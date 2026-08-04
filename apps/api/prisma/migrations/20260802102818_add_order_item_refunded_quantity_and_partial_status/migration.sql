-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "refundedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0;
