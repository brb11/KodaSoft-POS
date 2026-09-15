import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { assertPlanLimit, getPlan } from '../billing/plans';
import { serializeCSV, csvRowsToObjects, field } from './products.csv';
import type { CreateProductDto, UpdateProductDto } from './products.schema';

export const PRODUCT_CSV_HEADER = [
  'name',
  'category',
  'sku',
  'barcode',
  'description',
  'price',
  'cost',
  'unit',
  'trackInventory',
  'type',
  'isActive',
];

// Normalize the free-text base unit label so the same unit written differently
// (e.g. "KG ", "kg") always maps to one canonical value.
function normalizeUnitLabel(value?: string | null): string | null {
  const v = (value ?? '').trim();
  return v ? v.toLowerCase() : null;
}

// Ensure no barcode in the final set (product base barcode + selling-unit
// barcodes) duplicates another barcode in the same set or an existing
// product/unit/variant barcode owned by the tenant.
// The DB now enforces a per-tenant unique index on each of the three tables,
// so this guard both imports that constraint and extends cross-table ambiguity
// (a product, a unit and a variant must never be scannable under one code).
async function assertBarcodesAvailable(
  tenantId: string,
  barcodes: Array<string | null | undefined>,
  opts: { ignoreProductId?: string; ignoreUnitIds?: string[]; ignoreVariantIds?: string[] } = {},
): Promise<void> {
  const codes = barcodes.map((b) => (b ?? '').trim());
  // Same code in the set means the product and one of its units would share a
  // barcode — ambiguous to scan, so reject it up front.
  const nonEmpty = codes.filter((b) => Boolean(b));
  if (new Set(nonEmpty).size !== nonEmpty.length) {
    throw new AppError(409, 'Duplicate barcode — a product and its units cannot share the same code', 'BARCODE_EXISTS');
  }
  if (nonEmpty.length === 0) return;

  const [productClash, unitClash, variantClash] = await Promise.all([
    prisma.product.findFirst({
      where: { tenantId, barcode: { in: nonEmpty }, ...(opts.ignoreProductId ? { id: { not: opts.ignoreProductId } } : {}) },
      select: { id: true },
    }),
    prisma.productUnit.findFirst({
      where: {
        tenantId,
        barcode: { in: nonEmpty },
        // No isActive filter: soft-deleted rows still own their barcode in the
        // DB (the unique index covers every row), so they must stay reserved.
        ...(opts.ignoreUnitIds?.length ? { id: { notIn: opts.ignoreUnitIds } } : {}),
      },
      select: { id: true },
    }),
    prisma.productVariant.findFirst({
      where: { tenantId, barcode: { in: nonEmpty }, ...(opts.ignoreVariantIds?.length ? { id: { notIn: opts.ignoreVariantIds } } : {}) },
      select: { id: true },
    }),
  ]);
  if (productClash || unitClash || variantClash) {
    throw new AppError(409, 'Barcode already exists for another product, unit, or variant', 'BARCODE_EXISTS');
  }
}

type UnitInput = { name: string; barcode?: string; factor: number; price: number; cost: number };

// Replace-all strategy for a product's selling units. Ids change on every
// save; carts/orders snapshot unit data so nothing breaks.
async function syncProductUnits(tenantId: string, productId: string, units: UnitInput[]) {
  await assertBarcodesAvailable(tenantId, units.map((u) => u.barcode));
  await prisma.$transaction([
    prisma.productUnit.deleteMany({ where: { productId } }),
    ...units.map((u) =>
      prisma.productUnit.create({
        data: {
          tenantId,
          productId,
          name: u.name.trim(),
          barcode: u.barcode?.trim() || null,
          factor: u.factor,
          price: u.price,
          cost: u.cost,
        },
      }),
    ),
  ]);
}

export async function getProducts(
  tenantId: string,
  query: { page: number; limit: number; search?: string; categoryId?: string; isActive?: boolean },
) {
  const { page, limit, search, categoryId, isActive } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (search) where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { sku: { contains: search, mode: 'insensitive' } },
    { barcode: { contains: search, mode: 'insensitive' } },
  ];
  if (categoryId) where.categoryId = categoryId;
  if (isActive !== undefined) where.isActive = isActive;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      include: { category: true, taxRate: true, inventory: true, units: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getProductById(tenantId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, tenantId },
    include: {
      category: true,
      taxRate: true,
      variants: true,
      inventory: true,
      units: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

export async function getProductByBarcode(tenantId: string, barcode: string) {
  const code = barcode.trim();

  // Selling-unit barcodes take priority: the scan means "sell one of this
  // unit" (e.g. a whole carton), not one base piece.
  const unit = await prisma.productUnit.findFirst({
    where: { tenantId, barcode: code, isActive: true },
    include: {
      product: { include: { category: true, taxRate: true, variants: true, inventory: true } },
    },
  });
  if (unit && unit.product.isActive) {
    const p = unit.product;
    return {
      ...p,
      soldUnit: { id: unit.id, name: unit.name, factor: Number(unit.factor), price: Number(unit.price) },
    };
  }

  const product = await prisma.product.findFirst({
    where: { barcode: code, tenantId, isActive: true },
    include: { category: true, taxRate: true, variants: true, inventory: true },
  });
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

export async function createProduct(tenantId: string, dto: CreateProductDto) {
  await assertPlanLimit(tenantId, 'products');
  if (dto.sku) {
    const existing = await prisma.product.findFirst({ where: { tenantId, sku: dto.sku } });
    if (existing) throw new AppError(409, 'SKU already exists');
  }
  const { units, ...rest } = dto;
  // The product's own barcode and its units' barcodes must all be different
  // and free in the tenant.
  if (units?.length || dto.barcode) {
    await assertBarcodesAvailable(
      tenantId,
      [...(units ?? []).map((u) => u.barcode), ...(dto.barcode ? [dto.barcode] : [])],
    );
  }
  const product = await prisma.product.create({
    data: {
      ...rest,
      unit: normalizeUnitLabel(dto.unit) ?? undefined,
      tenantId,
      units: units?.length
        ? { create: units.map((u) => ({ tenantId, name: u.name.trim(), barcode: u.barcode?.trim() || null, factor: u.factor, price: u.price, cost: u.cost })) }
        : undefined,
    },
    include: { units: true },
  });
  return product;
}

export async function updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
  const existing = await getProductById(tenantId, id);
  const { units, ...rest } = dto;
  const scalarData = rest as any;
  if (scalarData.unit !== undefined) {
    scalarData.unit = normalizeUnitLabel(scalarData.unit ?? null);
  }

  // Final state of the barcodes after this save: the product's own code plus
  // every selling unit that will exist. When units are omitted they stay as-is,
  // so their codes are part of the set too and must not collide with a new
  // product barcode. Existing rows being replaced/kept are ignored so their
  // own codes can be reused.
  const baseBarcode = dto.barcode !== undefined ? dto.barcode : (existing.barcode ?? undefined);
  const incomingUnitBarcodes = units !== undefined ? units.map((u) => u.barcode) : [];
  const keptUnitBarcodes = units === undefined ? existing.units.map((u) => u.barcode ?? '') : [];
  await assertBarcodesAvailable(
    tenantId,
    [...keptUnitBarcodes, ...incomingUnitBarcodes, ...(baseBarcode ? [baseBarcode] : [])],
    { ignoreProductId: id, ignoreUnitIds: existing.units.map((u) => u.id) },
  );

  if (units !== undefined) {
    // Full replace: the product's own current unit rows are deleted first.
    return prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: scalarData });
      await tx.productUnit.deleteMany({ where: { productId: id } });
      if (units.length) {
        await tx.productUnit.createMany({
          data: units.map((u) => ({
            tenantId,
            productId: id,
            name: u.name.trim(),
            barcode: u.barcode?.trim() || null,
            factor: u.factor,
            price: u.price,
            cost: u.cost,
          })),
        });
      }
      return tx.product.findUniqueOrThrow({
        where: { id },
        include: { category: true, taxRate: true, variants: true, inventory: true, units: { orderBy: { createdAt: 'asc' } } },
      });
    });
  }

  return prisma.product.update({ where: { id }, data: scalarData, include: { units: { orderBy: { createdAt: 'asc' } } } });
}

export async function deleteProduct(tenantId: string, id: string) {
  await getProductById(tenantId, id);

  try {
    // Attempt hard delete inside a transaction to maintain integrity
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated inventory records
      await tx.inventory.deleteMany({ where: { productId: id } });
      // 2. Delete product variants
      await tx.productVariant.deleteMany({ where: { productId: id } });
      // 3. Delete the product itself
      await tx.product.delete({ where: { id, tenantId } });
    });
    return { success: true, mode: 'hard' };
  } catch (err) {
    // Fall back to soft delete if we have historical transactions/orderItems/movements
    return prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export async function exportProductsCsv(tenantId: string): Promise<{ filename: string; csv: string }> {
  const products = await prisma.product.findMany({
    where: { tenantId },
    include: { category: true },
    orderBy: { name: 'asc' },
    take: 5000,
  });

  const rows = products.map((p) => ({
    name: p.name,
    category: p.category?.name ?? '',
    sku: p.sku ?? '',
    barcode: p.barcode ?? '',
    description: p.description ?? '',
    price: Number(p.price),
    cost: Number(p.cost),
    unit: p.unit ?? 'pcs',
    trackInventory: p.trackInventory ? 'true' : 'false',
    type: p.type ?? 'retail',
    isActive: p.isActive ? 'true' : 'false',
  }));

  return {
    filename: `products-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: serializeCSV(PRODUCT_CSV_HEADER, rows),
  };
}

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export async function importProducts(tenantId: string, csv: string): Promise<ImportSummary> {
  const objects = csvRowsToObjects(csv);
  const errors: ImportSummary['errors'] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  if (objects.length === 0) {
    return { imported: 0, updated: 0, skipped: 0, errors: [] };
  }

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { tenantId } }),
    prisma.product.findMany({ where: { tenantId }, select: { id: true, sku: true, barcode: true } }),
  ]);

  const catByName = new Map<string, string>();
  for (const c of categories) {
    catByName.set(c.name.toLowerCase(), c.id);
    if (c.nameAr) catByName.set(c.nameAr.toLowerCase(), c.id);
  }
  const slugs = new Set(categories.map((c) => c.slug));
  const productBySku = new Map<string, string>();
  for (const p of products) {
    if (p.sku) productBySku.set(p.sku.toLowerCase(), p.id);
  }
  // Barcodes already present in the tenant, keyed by code → product id.
  const productByBarcode = new Map<string, string>();
  for (const p of products) {
    if (p.barcode) productByBarcode.set(p.barcode.trim(), p.id);
  }
  // Barcodes claimed by rows earlier in the same file.
  const claimedBarcodes = new Set<string>();

  const resolveCategory = async (name: string): Promise<string | null> => {
    const n = (name || '').trim();
    if (!n) return null;
    const key = n.toLowerCase();
    const existing = catByName.get(key);
    if (existing) return existing;
    let slug =
      n
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'category';
    let candidate = slug;
    let counter = 2;
    while (slugs.has(candidate)) candidate = `${slug}-${counter++}`;
    slugs.add(candidate);
    const cat = await prisma.category.create({ data: { tenantId, name: n, slug: candidate } });
    catByName.set(key, cat.id);
    return cat.id;
  };

  // Pre-check plan limit for newly created products
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant) throw new AppError(404, 'Tenant not found');
  if (tenant.subscription?.status !== 'TRIAL') {
    const plan = getPlan(tenant.plan ?? tenant.subscription?.plan);
    const limit = plan.limits.products;
    if (limit !== -1) {
      const toCreate = objects.filter((r) => {
        const sku = field(r, 'sku').trim().toLowerCase();
        return sku && !productBySku.has(sku);
      }).length;
      if (products.length + toCreate > limit) {
        throw new AppError(
          403,
          `Your ${plan.name} plan allows up to ${limit} products. Importing these rows would exceed the limit.`,
          'PLAN_LIMIT_REACHED'
        );
      }
    }
  }

  for (let i = 0; i < objects.length; i++) {
    const r = objects[i];
    const lineNo = i + 2;
    try {
      const name = field(r, 'name').trim();
      if (!name) {
        errors.push({ row: lineNo, message: 'Missing name' });
        skipped++;
        continue;
      }
      const priceRaw = field(r, 'price');
      if (priceRaw === '' || isNaN(Number(priceRaw)) || Number(priceRaw) <= 0) {
        errors.push({ row: lineNo, message: 'Invalid price' });
        skipped++;
        continue;
      }
      const costRaw = field(r, 'cost');
      const cost = costRaw === '' ? 0 : Number(costRaw);
      if (isNaN(cost)) {
        errors.push({ row: lineNo, message: 'Invalid cost' });
        skipped++;
        continue;
      }

      const sku = field(r, 'sku').trim() || undefined;
      const categoryName = field(r, 'category').trim();
      const categoryId = categoryName ? await resolveCategory(categoryName) : undefined;
      const barcode = field(r, 'barcode').trim() || undefined;
      const data = {
        name,
        categoryId,
        barcode,
        description: field(r, 'description').trim() || undefined,
        price: Number(priceRaw),
        cost,
        unit: normalizeUnitLabel(field(r, 'unit')) ?? 'pcs',
        trackInventory: field(r, 'trackInventory').toLowerCase() !== 'false',
        type: field(r, 'type').toLowerCase() === 'fnb' ? 'fnb' : 'retail',
        isActive: field(r, 'isActive').toLowerCase() !== 'false',
      };

      let productId: string | undefined;
      if (sku) productId = productBySku.get(sku.toLowerCase());

      // A barcode may not be reused within the file, nor collide with another
      // product already in the tenant. A product keeping its own barcode on an
      // update is fine.
      if (barcode) {
        const owner = productByBarcode.get(barcode);
        if (claimedBarcodes.has(barcode) || (owner && owner !== productId)) {
          errors.push({ row: lineNo, message: `Barcode "${barcode}" already exists` });
          skipped++;
          continue;
        }
      }

      if (productId) {
        if (barcode) {
          productByBarcode.set(barcode, productId);
          claimedBarcodes.add(barcode);
        }
        await prisma.product.update({ where: { id: productId }, data: { ...data, sku } });
        updated++;
      } else {
        const created = await prisma.product.create({ data: { ...data, tenantId, sku } });
        if (barcode) {
          productByBarcode.set(barcode, created.id);
          claimedBarcodes.add(barcode);
        }
        if (sku) productBySku.set(sku.toLowerCase(), created.id);
        imported++;
      }
    } catch (err: any) {
      errors.push({ row: lineNo, message: err?.message || 'Failed to import row' });
      skipped++;
    }
  }

  return { imported, updated, skipped, errors };
}
