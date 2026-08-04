import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import type { CreateCustomerDto, UpdateCustomerDto } from './customers.schema';

export async function getCustomers(
  tenantId: string,
  query: { page: number; limit: number; search?: string }
) {
  const { page, limit, search } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCustomerById(tenantId: string, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId },
  });
  if (!customer) throw new AppError(404, 'Customer not found');
  return customer;
}

export async function createCustomer(tenantId: string, dto: CreateCustomerDto) {
  return prisma.customer.create({
    data: {
      tenantId,
      name: dto.name,
      phone: dto.phone || null,
      email: dto.email || null,
      address: dto.address || null,
      notes: dto.notes || null,
    },
  });
}

export async function updateCustomer(tenantId: string, id: string, dto: UpdateCustomerDto) {
  const existing = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');

  return prisma.customer.update({
    where: { id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email || null } : {}),
      ...(dto.address !== undefined ? { address: dto.address || null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
    },
  });
}

export async function deleteCustomer(tenantId: string, id: string) {
  const existing = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');

  const orderCount = await prisma.order.count({ where: { customerId: id } });
  if (orderCount > 0) {
    throw new AppError(400, 'Customer has orders and cannot be deleted', 'CUSTOMER_HAS_ORDERS');
  }

  await prisma.customer.deleteMany({ where: { id, tenantId } });
  return { id };
}
