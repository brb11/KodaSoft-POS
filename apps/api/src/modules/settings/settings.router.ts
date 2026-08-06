import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import { getSettings } from './settings.service';

const updateSettingsSchema = z.object({
  storeName: z.string().min(1).optional(),
  vatNumber: z.string().optional(),
  receiptFooter: z.string().optional(),
  trackInventory: z.boolean().optional(),
});

export const settingsRouter: Router = Router();
settingsRouter.use(authenticate);

settingsRouter.get('/', async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await getSettings(req.user!.tenantId) });
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

  res.json({ success: true, data: await getSettings(tenantId) });
});
