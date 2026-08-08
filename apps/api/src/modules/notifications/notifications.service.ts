import { prisma } from '../../lib/prisma';
import { getPlan } from '../billing/plans';

const DAY_MS = 24 * 60 * 60 * 1000;

// Notify tenants ahead of expiry at these day-offsets (0 = expired today).
const EXPIRY_MILESTONES = [7, 3, 1, 0] as const;

const EXPIRY_TYPES = [
  'trial_expiring',
  'subscription_expiring',
  'trial_expired',
  'subscription_expired',
] as const;

type ExpiryType = (typeof EXPIRY_TYPES)[number];

function daysLeft(periodEnd: Date, now: Date): number {
  return Math.ceil((periodEnd.getTime() - now.getTime()) / DAY_MS);
}

function milestoneType(status: string, milestone: number): ExpiryType {
  if (milestone <= 0) return status === 'TRIAL' ? 'trial_expired' : 'subscription_expired';
  return status === 'TRIAL' ? 'trial_expiring' : 'subscription_expiring';
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function titleFor(type: ExpiryType, planName: string, periodEnd: Date): string {
  switch (type) {
    case 'trial_expiring':
      return 'Your trial ends soon';
    case 'subscription_expiring':
      return `${planName} plan renews soon`;
    default:
      return 'Your subscription has ended';
  }
}

function bodyFor(type: ExpiryType, planName: string, periodEnd: Date): string {
  switch (type) {
    case 'trial_expiring':
      return `Your trial ends on ${formatDate(periodEnd)}. Choose a plan to avoid interruption.`;
    case 'subscription_expiring':
      return `Your ${planName} subscription renews on ${formatDate(periodEnd)}.`;
    default:
      return 'Your access has been suspended. Renew now to continue.';
  }
}

/**
 * Generates expiry reminder notifications for the given tenant (or every tenant
 * when called without an id). Idempotent: each (tenant, user, type, milestone)
 * combination is only ever created once, keyed off the milestoneDays stored in
 * the notification `data`. Safe to run on boot, on a timer, and per-request.
 */
export async function runExpirySweep(tenantId?: string): Promise<number> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['TRIAL', 'ACTIVE'] },
      periodEnd: { not: null },
      ...(tenantId ? { tenantId } : {}),
    },
    include: {
      tenant: {
        include: { users: { where: { isActive: true }, select: { id: true } } },
      },
    },
  });

  let created = 0;

  for (const sub of subscriptions) {
    if (!sub.periodEnd) continue;
    const dl = daysLeft(sub.periodEnd, new Date());

    const milestones: number[] = [];
    if (dl <= 0) {
      milestones.push(0);
    } else {
      for (const m of EXPIRY_MILESTONES) {
        if (m > 0 && dl <= m) milestones.push(m);
      }
    }
    if (!milestones.length) continue;

    const existing = await prisma.notification.findMany({
      where: { tenantId: sub.tenantId, type: { in: [...EXPIRY_TYPES] } },
      select: { userId: true, type: true, data: true },
    });
    const seen = new Set<string>();
    for (const n of existing) {
      const milestone = (n.data as { milestoneDays?: number } | null)?.milestoneDays;
      if (milestone !== undefined) seen.add(`${n.type}:${n.userId}:${milestone}`);
    }

    const plan = getPlan(sub.plan);
    for (const user of sub.tenant.users) {
      for (const milestone of milestones) {
        const type = milestoneType(sub.status, milestone);
        const key = `${type}:${user.id}:${milestone}`;
        if (seen.has(key)) continue;
        await prisma.notification.create({
          data: {
            tenantId: sub.tenantId,
            userId: user.id,
            type,
            title: titleFor(type, plan.name, sub.periodEnd),
            body: bodyFor(type, plan.name, sub.periodEnd),
            data: {
              milestoneDays: milestone,
              planName: plan.name,
              planKey: plan.key,
              periodEnd: sub.periodEnd.toISOString(),
              status: sub.status,
            },
          },
        });
        seen.add(key);
        created++;
      }
    }
  }

  return created;
}

export async function listNotifications(
  tenantId: string,
  userId: string,
  limit = 30
) {
  const where = { tenantId, userId };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { items, total, unread };
}

export async function unreadCount(tenantId: string, userId: string) {
  return prisma.notification.count({ where: { tenantId, userId, readAt: null } });
}

export async function markRead(tenantId: string, userId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, tenantId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

export async function markAllRead(tenantId: string, userId: string) {
  const result = await prisma.notification.updateMany({
    where: { tenantId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

let sweepTimer: NodeJS.Timeout | null = null;

/** Starts the in-process expiry sweep (runs once on boot, then every 6h). */
export function startNotificationScheduler(): void {
  if (sweepTimer) return;
  runExpirySweep().catch((err) => {
    console.error('[notifications] initial expiry sweep failed:', err);
  });
  sweepTimer = setInterval(() => {
    runExpirySweep().catch((err) => {
      console.error('[notifications] expiry sweep failed:', err);
    });
  }, 6 * 60 * 60 * 1000);
}
