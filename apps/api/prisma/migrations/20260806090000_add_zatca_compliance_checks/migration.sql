-- AlterTable
ALTER TABLE "zatca_credentials" ADD COLUMN     "complianceChecksAt" TIMESTAMP(3),
ADD COLUMN     "complianceChecksResults" JSONB,
ADD COLUMN     "complianceChecksStatus" TEXT;
