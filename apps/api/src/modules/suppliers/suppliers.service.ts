import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import type { CreateSupplierDto, UpdateSupplierDto } from './suppliers.schema';

export async function getSuppliers(
  tenantId: string,
  query: { page: number; limit: number; search?: string; isActive?: boolean }
) {
  const { page, limit, search, isActive } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameAr: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { purchaseInvoices: true, supplierPayments: true } },
      },
    }),
    prisma.supplier.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSupplierById(tenantId: string, id: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId },
    include: {
      purchaseInvoices: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          branch: { select: { id: true, name: true } },
          items: true,
          payments: true,
        },
      },
      supplierPayments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!supplier) throw new AppError(404, 'Supplier not found');
  return supplier;
}

export async function createSupplier(tenantId: string, dto: CreateSupplierDto) {
  return prisma.supplier.create({
    data: {
      tenantId,
      name: dto.name,
      nameAr: dto.nameAr || null,
      email: dto.email || null,
      phone: dto.phone || null,
      address: dto.address || null,
      city: dto.city || null,
      vatNumber: dto.vatNumber || null,
      contactPerson: dto.contactPerson || null,
      notes: dto.notes || null,
    },
  });
}

export async function updateSupplier(tenantId: string, id: string, dto: UpdateSupplierDto) {
  const existing = await prisma.supplier.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');

  return prisma.supplier.update({
    where: { id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
      ...(dto.address !== undefined ? { address: dto.address || null } : {}),
      ...(dto.city !== undefined ? { city: dto.city || null } : {}),
      ...(dto.vatNumber !== undefined ? { vatNumber: dto.vatNumber || null } : {}),
      ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson || null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
    },
  });
}

export async function deleteSupplier(tenantId: string, id: string) {
  const existing = await prisma.supplier.findFirst({
    where: { id, tenantId },
    select: { id: true, balance: true },
  });
  if (!existing) throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');

  const invoiceCount = await prisma.purchaseInvoice.count({ where: { supplierId: id } });
  if (invoiceCount > 0) {
    throw new AppError(400, 'Supplier has purchase invoices and cannot be deleted', 'SUPPLIER_HAS_INVOICES');
  }

  if (Number(existing.balance) > 0) {
    throw new AppError(400, 'Supplier has an outstanding balance and cannot be deleted', 'SUPPLIER_HAS_BALANCE');
  }

  await prisma.supplier.deleteMany({ where: { id, tenantId } });
  return { id };
}
