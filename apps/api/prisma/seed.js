const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database for KodaSoft Casheer POS...');

  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kodasoft-default' },
    update: {},
    create: {
      name: 'KodaSoft Main Store',
      slug: 'kodasoft-default',
      plan: 'enterprise',
    },
  });

  // Create default branch
  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Branch',
        address: 'Headquarters Main St.',
        phone: '+123456789',
        timezone: 'UTC',
      },
    });
  }

  // Create Admin User
  const passwordHash = await bcrypt.hash('admin123', 10);
  const pinHash = await bcrypt.hash('1234', 10);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@kodasoft.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'KodaSoft Admin',
      email: 'admin@kodasoft.com',
      passwordHash,
      pinHash,
      role: UserRole.OWNER,
    },
  });

  // Create Cashier User
  const cashierPinHash = await bcrypt.hash('0000', 10);
  const cashier = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'cashier@kodasoft.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'John Cashier',
      email: 'cashier@kodasoft.com',
      passwordHash,
      pinHash: cashierPinHash,
      role: UserRole.CASHIER,
    },
  });

  // Ensure the default tenant has an active enterprise subscription
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { plan: 'enterprise', status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      plan: 'enterprise',
      status: 'ACTIVE',
      periodStart: new Date(),
      periodEnd: null,
    },
  });

  // SaaS Platform Tenant + Super Admin (operator console access)
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'casheer-platform' },
    update: {},
    create: {
      name: 'KodaSoft-POS Platform',
      slug: 'casheer-platform',
      plan: 'enterprise',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: platformTenant.id, email: 'admin@casheer.app' } },
    update: {},
    create: {
      tenantId: platformTenant.id,
      name: 'KodaSoft-POS Platform Admin',
      email: 'admin@casheer.app',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
  });

  // Create Categories
  const catBeverages = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'beverages' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Beverages',
      nameAr: 'مشروبات',
      slug: 'beverages',
      sortOrder: 1,
    },
  });

  const catSnacks = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'snacks' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Snacks',
      nameAr: 'وجبات خفيفة',
      slug: 'snacks',
      sortOrder: 2,
    },
  });

  // Create Tax Rate
  let vat15 = await prisma.taxRate.findFirst({
    where: { tenantId: tenant.id, name: 'VAT 15%' },
  });
  if (!vat15) {
    vat15 = await prisma.taxRate.create({
      data: {
        tenantId: tenant.id,
        name: 'VAT 15%',
        rate: 15.0,
      },
    });
  }

  // Create Products
  const prod1 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'BEV-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      categoryId: catBeverages.id,
      taxRateId: vat15.id,
      name: 'Espresso',
      nameAr: 'إسبريسو',
      sku: 'BEV-001',
      barcode: '600000000001',
      price: 3.5,
      cost: 0.8,
      type: 'fnb',
    },
  });

  const prod2 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'BEV-002' } },
    update: {},
    create: {
      tenantId: tenant.id,
      categoryId: catBeverages.id,
      taxRateId: vat15.id,
      name: 'Cappuccino',
      nameAr: 'كابوتشينو',
      sku: 'BEV-002',
      barcode: '600000000002',
      price: 4.5,
      cost: 1.2,
      type: 'fnb',
    },
  });

  const prod3 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'SNK-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      categoryId: catSnacks.id,
      taxRateId: vat15.id,
      name: 'Croissant',
      nameAr: 'كرواسون',
      sku: 'SNK-001',
      barcode: '600000000003',
      price: 2.75,
      cost: 0.9,
      type: 'retail',
    },
  });

  // Seed inventory safely
  for (const prod of [prod1, prod2, prod3]) {
    const existingInv = await prisma.inventory.findFirst({
      where: { productId: prod.id, branchId: branch.id }
    });
    if (!existingInv) {
      await prisma.inventory.create({
        data: {
          productId: prod.id,
          branchId: branch.id,
          quantity: 100,
          lowStockThreshold: 10,
        }
      });
    }
  }

  // ── Suppliers ──────────────────────────────────
  const supplier1 = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: 'Al-Jazeera Coffee Co.' } })
    ?? await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: 'Al-Jazeera Coffee Co.',
        nameAr: 'شركة الجزيرة للقهوة',
        email: 'sales@aljazeera-coffee.sa',
        phone: '+966-11-456-7890',
        address: '123 Roastery Rd, Al-Kharj',
        city: 'Riyadh',
        vatNumber: '310123456700003',
        contactPerson: 'Ahmad Al-Mutairi',
        notes: 'Primary coffee bean supplier – NET 30',
      },
    });

  const supplier2 = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: 'Gulf Bakery Supplies' } })
    ?? await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: 'Gulf Bakery Supplies',
        nameAr: 'إمدادات الخليج للمخابز',
        email: 'orders@gulfbakery.sa',
        phone: '+966-13-321-4567',
        address: '45 Industrial Area, Phase 2',
        city: 'Dammam',
        vatNumber: '300987654300003',
        contactPerson: 'Fatima Al-Zahrani',
      },
    });

  const supplier3 = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: 'Nile Snacks Trading' } })
    ?? await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: 'Nile Snacks Trading',
        nameAr: 'تجارة نايل للوجبات الخفيفة',
        email: 'info@nile-snacks.com',
        phone: '+966-12-654-3210',
        address: '78 King Fahd Rd',
        city: 'Jeddah',
        vatNumber: '312112223300003',
        contactPerson: 'Omar Hassan',
      },
    });

  // ── Purchase Invoices ──────────────────────────
  const existingInv1 = await prisma.purchaseInvoice.findFirst({ where: { tenantId: tenant.id, invoiceNumber: 'PO-2026-001' } });
  if (!existingInv1) {
    const inv1 = await prisma.purchaseInvoice.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        supplierId: supplier1.id,
        invoiceNumber: 'PO-2026-001',
        invoiceDate: new Date('2026-08-01'),
        dueDate: new Date('2026-08-31'),
        status: 'CONFIRMED',
        subtotal: 120.0,
        taxAmount: 18.0,
        total: 138.0,
        paidAmount: 100.0,
        notes: 'Coffee beans order',
        createdBy: admin.id,
        items: {
          create: [
            { productId: prod1.id, name: 'Espresso', sku: 'BEV-001', quantity: 50, unitPrice: 0.8, taxAmount: 6.0, subtotal: 40.0 },
            { productId: prod2.id, name: 'Cappuccino', sku: 'BEV-002', quantity: 50, unitPrice: 1.2, taxAmount: 9.0, subtotal: 60.0 },
          ],
        },
      },
    });

    await prisma.supplierPayment.create({
      data: {
        tenantId: tenant.id,
        supplierId: supplier1.id,
        purchaseInvoiceId: inv1.id,
        amount: 100.0,
        method: 'BANK_TRANSFER',
        reference: 'TRF-20260805-001',
        note: 'Partial payment for PO-2026-001',
        createdBy: admin.id,
      },
    });
  }

  const existingInv2 = await prisma.purchaseInvoice.findFirst({ where: { tenantId: tenant.id, invoiceNumber: 'PO-2026-002' } });
  if (!existingInv2) {
    const inv2 = await prisma.purchaseInvoice.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        supplierId: supplier2.id,
        invoiceNumber: 'PO-2026-002',
        invoiceDate: new Date('2026-08-05'),
        dueDate: new Date('2026-09-04'),
        status: 'CONFIRMED',
        subtotal: 60.0,
        taxAmount: 9.0,
        total: 69.0,
        paidAmount: 69.0,
        notes: 'Bakery supplies restock',
        createdBy: admin.id,
        items: {
          create: [
            { productId: prod3.id, name: 'Croissant', sku: 'SNK-001', quantity: 80, unitPrice: 0.9, taxAmount: 10.8, subtotal: 72.0 },
          ],
        },
      },
    });

    await prisma.supplierPayment.create({
      data: {
        tenantId: tenant.id,
        supplierId: supplier2.id,
        purchaseInvoiceId: inv2.id,
        amount: 69.0,
        method: 'CASH',
        note: 'Full payment for PO-2026-002',
        createdBy: admin.id,
      },
    });
  }

  const existingInv3 = await prisma.purchaseInvoice.findFirst({ where: { tenantId: tenant.id, invoiceNumber: 'PO-2026-003' } });
  if (!existingInv3) {
    await prisma.purchaseInvoice.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        supplierId: supplier3.id,
        invoiceNumber: 'PO-2026-003',
        invoiceDate: new Date('2026-08-18'),
        dueDate: new Date('2026-09-17'),
        status: 'DRAFT',
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        paidAmount: 0,
        notes: 'Pending review – snacks bulk order',
        createdBy: admin.id,
        items: {
          create: [
            { productId: prod3.id, name: 'Croissant', sku: 'SNK-001', quantity: 200, unitPrice: 0.9, taxAmount: 27.0, subtotal: 180.0 },
          ],
        },
      },
    });
  }

  console.log('✅ Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log(`Tenant ID: ${tenant.id}`);
  console.log(`Branch ID: ${branch.id}`);
  console.log(`Admin User: admin@kodasoft.com / admin123 (PIN: 1234)`);
  console.log(`Cashier User: cashier@kodasoft.com / (PIN: 0000)`);
  console.log(`Super Admin (SaaS Console): admin@casheer.app / admin123`);
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
