ALTER TABLE "orders" ADD COLUMN "invoiceSignature" TEXT;
ALTER TABLE "orders" ADD COLUMN "zatcaStatus" TEXT;

CREATE TABLE "zatca_credentials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "privateKeyPem" TEXT,
    "selfSignedCertPem" TEXT,
    "csrPem" TEXT,
    "complianceToken" TEXT,
    "complianceSecret" TEXT,
    "complianceRequestId" TEXT,
    "complianceSerialNumber" TEXT,
    "productionToken" TEXT,
    "productionSecret" TEXT,
    "productionRequestId" TEXT,
    "productionSerialNumber" TEXT,
    "lastInvoiceHash" TEXT,
    "lastInvoiceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "zatca_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "zatca_credentials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "zatca_credentials_tenantId_mode_key" ON "zatca_credentials"("tenantId", "mode");

CREATE TABLE "invoice_submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "invoiceUuid" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL DEFAULT 'SIMPLIFIED',
    "invoiceXml" TEXT NOT NULL,
    "invoiceHash" TEXT NOT NULL,
    "invoiceSignature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "faturaResponse" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),
    CONSTRAINT "invoice_submissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_submissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_submissions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "invoice_submissions_tenantId_status_idx" ON "invoice_submissions"("tenantId", "status");
CREATE INDEX "invoice_submissions_orderId_idx" ON "invoice_submissions"("orderId");
