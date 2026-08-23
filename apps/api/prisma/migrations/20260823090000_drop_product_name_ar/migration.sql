-- Product names are now a single column; drop the separate Arabic name column.

ALTER TABLE "products" DROP COLUMN IF EXISTS "nameAr";
