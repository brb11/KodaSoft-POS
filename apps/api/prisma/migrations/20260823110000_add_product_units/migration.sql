-- Product selling units (multi-barcode) + unit-aware order/purchase lines.

CREATE TABLE "product_units" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "factor" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_units_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_units_tenantId_productId_idx" ON "product_units"("tenantId", "productId");
CREATE INDEX "product_units_barcode_idx" ON "product_units"("barcode");

ALTER TABLE "product_units" ADD CONSTRAINT "product_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Order items: snapshot of the selling unit the line was sold in.
ALTER TABLE "order_items" ADD COLUMN "unitId" TEXT;
ALTER TABLE "order_items" ADD COLUMN "unitName" TEXT;
ALTER TABLE "order_items" ADD COLUMN "unitFactor" DECIMAL(12,3) NOT NULL DEFAULT 1;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "product_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Purchase items: snapshot of the unit the goods were received in.
ALTER TABLE "purchase_items" ADD COLUMN "unitName" TEXT;
ALTER TABLE "purchase_items" ADD COLUMN "unitFactor" DECIMAL(12,3) NOT NULL DEFAULT 1;
