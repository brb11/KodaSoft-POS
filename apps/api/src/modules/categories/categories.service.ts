import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import type { CreateCategoryDto, UpdateCategoryDto } from './categories.schema';

export async function getCategories(tenantId: string) {
  return prisma.category.findMany({
    where: { tenantId, isActive: true },
    include: { children: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getCategoryById(tenantId: string, id: string) {
  const cat = await prisma.category.findFirst({
    where: { id, tenantId },
    include: { children: true, products: { where: { isActive: true } } },
  });
  if (!cat) throw new AppError(404, 'Category not found');
  return cat;
}

export async function createCategory(tenantId: string, dto: CreateCategoryDto) {
  const existing = await prisma.category.findFirst({ where: { tenantId, slug: dto.slug } });
  if (existing) throw new AppError(409, 'Slug already exists');
  return prisma.category.create({ data: { ...dto, tenantId } });
}

export async function updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
  await getCategoryById(tenantId, id);
  return prisma.category.update({ where: { id }, data: dto });
}

export async function deleteCategory(tenantId: string, id: string) {
  await getCategoryById(tenantId, id);
  return prisma.category.update({ where: { id }, data: { isActive: false } });
}
