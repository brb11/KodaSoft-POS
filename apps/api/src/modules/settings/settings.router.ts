import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  storeName: z.string().min(1).optional(),
  vatNumber: z.string().optional(),
  receiptFooter: z.string().optional(),
});

const DEFAULTS = {
  storeName: 'KODASOFT',
  vatNumber: '300000000000003',
  receiptFooter: 'Thank you for your visit!',
};

export const settingsRouter: Router = Router();
settingsRouter.use(authenticate);

async function readSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const rows = await prisma.setting.findMany({
    where: { tenantId, branchId: null, key: { in: ['storeName', 'vatNumber', 'receiptFooter'] } },
  });
  const map = new Map(rows.map((r) => [r.key, String(r.value)]));
  return {
    storeName: map.get('storeName') || tenant?.name || DEFAULTS.storeName,
    vatNumber: map.get('vatNumber') || DEFAULTS.vatNumber,
    receiptFooter: map.get('receiptFooter') || DEFAULTS.receiptFooter,
  };
}

settingsRouter.get('/', async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await readSettings(req.user!.tenantId) });
});

settingsRouter.put('/', async (req: AuthRequest, res: Response) => {
  const dto = updateSettingsSchema.parse(req.body ?? {});
  const { tenantId } = req.user!;

  for (const [key, value] of Object.entries(dto)) {
    if (value === undefined) continue;
    const existing = await prisma.setting.findFirst({ where: { tenantId, branchId: null, key } });
    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.setting.create({ data: { tenantId, branchId: null, key, value } });
    }
  }

  res.json({ success: true, data: await readSettings(tenantId) });
});
