-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('SIMPLIFIED', 'TAX');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'MADA';
ALTER TYPE "PaymentMethod" ADD VALUE 'VISA';
ALTER TYPE "PaymentMethod" ADD VALUE 'MASTERCARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'APPLE_PAY';
ALTER TYPE "PaymentMethod" ADD VALUE 'STC_PAY';
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "expiryDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "invoiceType" "InvoiceType" NOT NULL DEFAULT 'SIMPLIFIED';
