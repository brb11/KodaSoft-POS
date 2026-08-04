import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { assertPlanLimit, getPlan } from '../billing/plans';
import { serializeCSV, csvRowsToObjects, field } from './products.csv';
import type { CreateProductDto, UpdateProductDto } from './products.schema';

export const PRODUCT_CSV_HEADER = [
  'name',
  'nameAr',
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
      include: { category: true, taxRate: true, inventory: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getProductById(tenantId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, tenantId },
    include: { category: true, taxRate: true, variants: true, inventory: true },
  });
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

export async function getProductByBarcode(tenantId: string, barcode: string) {
  const product = await prisma.product.findFirst({
    where: { barcode, tenantId, isActive: true },
    include: { category: true, taxRate: true, variants: true },
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
  return prisma.product.create({ data: { ...dto, tenantId } });
}

export async function updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
  await getProductById(tenantId, id);
  return prisma.product.update({ where: { id }, data: dto });
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
    nameAr: p.nameAr ?? '',
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
    prisma.product.findMany({ where: { tenantId }, select: { id: true, sku: true } }),
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
      const data = {
        name,
        nameAr: field(r, 'nameAr').trim() || undefined,
        categoryId,
        barcode: field(r, 'barcode').trim() || undefined,
        description: field(r, 'description').trim() || undefined,
        price: Number(priceRaw),
        cost,
        unit: field(r, 'unit').trim() || 'pcs',
        trackInventory: field(r, 'trackInventory').toLowerCase() !== 'false',
        type: field(r, 'type').toLowerCase() === 'fnb' ? 'fnb' : 'retail',
        isActive: field(r, 'isActive').toLowerCase() !== 'false',
      };

      if (sku && productBySku.has(sku.toLowerCase())) {
        const id = productBySku.get(sku.toLowerCase())!;
        await prisma.product.update({ where: { id }, data: { ...data, sku } });
        updated++;
      } else {
        const created = await prisma.product.create({ data: { ...data, tenantId, sku } });
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
