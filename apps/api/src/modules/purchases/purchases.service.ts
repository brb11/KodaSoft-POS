import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import type {
  CreatePurchaseDto,
  UpdatePurchaseDto,
  CreateSupplierPaymentDto,
} from './purchases.schema';

const roundCents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Purchase Invoices ────────────────────────────────────────────────────────

export async function listPurchases(
  tenantId: string,
  query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    supplierId?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const { page, limit, search, status, supplierId, branchId, dateFrom, dateTo } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (branchId) where.branchId = branchId;
  if (dateFrom || dateTo) {
    where.invoiceDate = {};
    if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
    if (dateTo) where.invoiceDate.lte = new Date(dateTo + 'T23:59:59.999Z');
  }
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
      { supplier: { nameAr: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, nameAr: true } },
        branch: { select: { id: true, name: true } },
        items: true,
        payments: true,
      },
    }),
    prisma.purchaseInvoice.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPurchaseById(tenantId: string, id: string) {
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id, tenantId },
    include: {
      supplier: true,
      branch: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, nameAr: true, sku: true } },
        },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!invoice) throw new AppError(404, 'Purchase invoice not found');
  return invoice;
}

export async function createPurchase(tenantId: string, userId: string, dto: CreatePurchaseDto) {
  // Validate supplier and branch
  const [supplier, branch] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId }, select: { id: true } }),
    prisma.branch.findFirst({ where: { id: dto.branchId, tenantId }, select: { id: true } }),
  ]);
  if (!supplier) throw new AppError(400, 'Supplier not found', 'SUPPLIER_NOT_FOUND');
  if (!branch) throw new AppError(400, 'Branch not found', 'BRANCH_NOT_FOUND');

  // Check invoice number uniqueness
  const existing = await prisma.purchaseInvoice.findFirst({
    where: { tenantId, invoiceNumber: dto.invoiceNumber },
    select: { id: true },
  });
  if (existing) throw new AppError(400, 'Invoice number already exists', 'DUPLICATE_INVOICE_NUMBER');

  // Validate products
  const productIds = dto.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId },
    select: { id: true, name: true, sku: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const item of dto.items) {
    if (!productMap.has(item.productId)) {
      throw new AppError(400, `Product not found: ${item.productId}`, 'PRODUCT_NOT_FOUND');
    }
  }

  // Calculate line totals
  const lineItems = dto.items.map((item) => {
    const lineSubtotal = roundCents(item.quantity * item.unitPrice);
    const lineDiscount = roundCents(item.discountAmount);
    const taxable = roundCents(lineSubtotal - lineDiscount);
    const lineTax = roundCents((taxable * item.taxRate) / 100);
    return {
      productId: item.productId,
      variantId: item.variantId || null,
      name: item.name,
      sku: item.sku || productMap.get(item.productId)?.sku || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: lineDiscount,
      taxAmount: lineTax,
      subtotal: roundCents(taxable + lineTax),
    };
  });

  const subtotal = roundCents(lineItems.reduce((s, l) => s + l.subtotal, 0));
  const discountAmount = roundCents(Math.min(dto.discountAmount, subtotal));
  const taxAmount = roundCents(lineItems.reduce((s, l) => s + l.taxAmount, 0));
  const total = roundCents(subtotal - discountAmount);

  const invoice = await prisma.purchaseInvoice.create({
    data: {
      tenantId,
      branchId: dto.branchId,
      supplierId: dto.supplierId,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      notes: dto.notes || null,
      createdBy: userId,
      items: {
        create: lineItems,
      },
    },
    include: {
      items: true,
      supplier: { select: { id: true, name: true, nameAr: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  return invoice;
}

export async function updatePurchase(tenantId: string, id: string, dto: UpdatePurchaseDto) {
  const existing = await prisma.purchaseInvoice.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) throw new AppError(404, 'Purchase invoice not found');
  if (existing.status === 'CONFIRMED') {
    throw new AppError(400, 'Cannot edit a confirmed invoice', 'INVOICE_CONFIRMED');
  }
  if (existing.status === 'CANCELLED') {
    throw new AppError(400, 'Cannot edit a cancelled invoice', 'INVOICE_CANCELLED');
  }

  const updateData: any = {};
  if (dto.supplierId) updateData.supplierId = dto.supplierId;
  if (dto.invoiceDate) updateData.invoiceDate = new Date(dto.invoiceDate);
  if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
  if (dto.discountAmount !== undefined) updateData.discountAmount = dto.discountAmount;
  if (dto.notes !== undefined) updateData.notes = dto.notes || null;

  if (dto.items) {
    // Delete old items and recreate
    await prisma.purchaseItem.deleteMany({ where: { purchaseInvoiceId: id } });

    const lineItems = dto.items.map((item) => {
      const lineSubtotal = roundCents(item.quantity * item.unitPrice);
      const lineDiscount = roundCents(item.discountAmount);
      const taxable = roundCents(lineSubtotal - lineDiscount);
      const lineTax = roundCents((taxable * item.taxRate) / 100);
      return {
        purchaseInvoiceId: id,
        productId: item.productId,
        variantId: item.variantId || null,
        name: item.name,
        sku: item.sku || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: lineDiscount,
        taxAmount: lineTax,
        subtotal: roundCents(taxable + lineTax),
      };
    });

    await prisma.purchaseItem.createMany({ data: lineItems });

    const subtotal = roundCents(lineItems.reduce((s, l) => s + l.subtotal, 0));
    const discountAmount = roundCents(Math.min(dto.discountAmount ?? 0, subtotal));
    const taxAmount = roundCents(lineItems.reduce((s, l) => s + l.taxAmount, 0));
    const total = roundCents(subtotal - discountAmount);
    updateData.subtotal = subtotal;
    updateData.discountAmount = discountAmount;
    updateData.taxAmount = taxAmount;
    updateData.total = total;
  }

  return prisma.purchaseInvoice.update({
    where: { id },
    data: updateData,
    include: {
      items: true,
      supplier: { select: { id: true, name: true, nameAr: true } },
      branch: { select: { id: true, name: true } },
    },
  });
}

export async function cancelPurchase(tenantId: string, id: string) {
  const existing = await prisma.purchaseInvoice.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, paidAmount: true },
  });
  if (!existing) throw new AppError(404, 'Purchase invoice not found');
  if (existing.status === 'CANCELLED') {
    throw new AppError(400, 'Invoice is already cancelled');
  }
  if (existing.status === 'CONFIRMED') {
    throw new AppError(400, 'Cannot cancel a confirmed invoice. Please create a return.', 'INVOICE_CONFIRMED');
  }

  return prisma.purchaseInvoice.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}

export async function confirmPurchase(tenantId: string, userId: string, id: string, branchId: string) {
  const existing = await prisma.purchaseInvoice.findFirst({
    where: { id, tenantId },
    include: { items: true, supplier: true },
  });
  if (!existing) throw new AppError(404, 'Purchase invoice not found');
  if (existing.status === 'CONFIRMED') {
    throw new AppError(400, 'Invoice is already confirmed');
  }
  if (existing.status === 'CANCELLED') {
    throw new AppError(400, 'Cannot confirm a cancelled invoice');
  }

  // Update inventory and supplier balance in a transaction
  await prisma.$transaction(async (tx) => {
    // Update stock for each item
    for (const item of existing.items) {
      const delta = Number(item.quantity);

      // Increment stock or create new inventory record
      const updated = await tx.inventory.updateMany({
        where: { productId: item.productId, variantId: item.variantId, branchId },
        data: { quantity: { increment: delta } },
      });
      if (updated.count === 0) {
        await tx.inventory.create({
          data: {
            productId: item.productId,
            variantId: item.variantId,
            branchId,
            quantity: delta,
            lowStockThreshold: 5,
          },
        });
      }

      // Create stock movement
      await tx.inventoryMovement.create({
        data: {
          branchId,
          productId: item.productId,
          variantId: item.variantId,
          type: 'purchase',
          quantity: delta,
          referenceId: id,
          referenceType: 'purchase',
          note: `Purchase invoice ${existing.invoiceNumber}`,
          createdBy: userId,
        },
      });
    }

    // Update supplier balance (increase debt)
    await tx.supplier.update({
      where: { id: existing.supplierId },
      data: { balance: { increment: Number(existing.total) } },
    });

    // Mark invoice as confirmed
    await tx.purchaseInvoice.update({
      where: { id },
      data: { status: 'CONFIRMED', paidAmount: 0 },
    });
  });

  return getPurchaseById(tenantId, id);
}

// ─── Supplier Payments ────────────────────────────────────────────────────────

export async function createSupplierPayment(tenantId: string, userId: string, dto: CreateSupplierPaymentDto) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: dto.supplierId, tenantId },
    select: { id: true, balance: true },
  });
  if (!supplier) throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');

  // Validate linked invoice if provided
  let invoice = null;
  if (dto.purchaseInvoiceId) {
    invoice = await prisma.purchaseInvoice.findFirst({
      where: { id: dto.purchaseInvoiceId, tenantId, supplierId: dto.supplierId },
      select: { id: true, total: true, paidAmount: true, status: true },
    });
    if (!invoice) throw new AppError(404, 'Purchase invoice not found', 'PURCHASE_INVOICE_NOT_FOUND');
    if (invoice.status !== 'CONFIRMED') {
      throw new AppError(400, 'Can only pay confirmed invoices', 'INVOICE_NOT_CONFIRMED');
    }
    const remaining = roundCents(Number(invoice.total) - Number(invoice.paidAmount));
    if (dto.amount > remaining) {
      throw new AppError(400, `Payment exceeds remaining balance of ${remaining}`, 'PAYMENT_EXCEEDS_BALANCE');
    }
  }

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.supplierPayment.create({
      data: {
        tenantId,
        supplierId: dto.supplierId,
        purchaseInvoiceId: dto.purchaseInvoiceId || null,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference || null,
        note: dto.note || null,
        createdBy: userId,
      },
    });

    // Decrease supplier balance
    await tx.supplier.update({
      where: { id: dto.supplierId },
      data: { balance: { decrement: dto.amount } },
    });

    // Update invoice paid amount if linked
    if (dto.purchaseInvoiceId && invoice) {
      const newPaidAmount = roundCents(Number(invoice.paidAmount) + dto.amount);
      await tx.purchaseInvoice.update({
        where: { id: dto.purchaseInvoiceId },
        data: { paidAmount: newPaidAmount },
      });
    }

    return p;
  });

  return payment;
}

export async function listSupplierPayments(
  tenantId: string,
  query: { page: number; limit: number; supplierId?: string }
) {
  const { page, limit, supplierId } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (supplierId) where.supplierId = supplierId;

  const [items, total] = await Promise.all([
    prisma.supplierPayment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, nameAr: true } },
        purchaseInvoice: { select: { id: true, invoiceNumber: true } },
      },
    }),
    prisma.supplierPayment.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
