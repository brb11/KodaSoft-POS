import { prisma } from '../../lib/prisma';

export interface StoreSettings {
  storeName: string;
  vatNumber: string;
  receiptFooter: string;
  trackInventory: boolean;
}

export const SETTING_KEYS = ['storeName', 'vatNumber', 'receiptFooter', 'trackInventory'] as const;

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'KODASOFT',
  vatNumber: '300000000000003',
  receiptFooter: 'Thank you for your visit!',
  trackInventory: true,
};

export async function getSettings(tenantId: string): Promise<StoreSettings> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const rows = await prisma.setting.findMany({
    where: { tenantId, branchId: null, key: { in: [...SETTING_KEYS] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    storeName: String(map.get('storeName') ?? '') || tenant?.name || DEFAULT_SETTINGS.storeName,
    vatNumber: String(map.get('vatNumber') ?? '') || DEFAULT_SETTINGS.vatNumber,
    receiptFooter: String(map.get('receiptFooter') ?? '') || DEFAULT_SETTINGS.receiptFooter,
    trackInventory: map.has('trackInventory') ? Boolean(map.get('trackInventory')) : DEFAULT_SETTINGS.trackInventory,
  };
}

export async function isInventoryEnabled(tenantId: string): Promise<boolean> {
  const settings = await getSettings(tenantId);
  return settings.trackInventory;
}
