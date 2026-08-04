import { Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

export async function requireActiveSubscription(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) return next();

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      include: { subscription: true },
    });
    if (!tenant) return next(new AppError(404, 'Tenant not found'));

    const sub = tenant.subscription;
    const now = new Date();
    const trialExpired =
      sub?.status === 'TRIAL' && !!sub.periodEnd && sub.periodEnd < now;

    // Tenants without a subscription row are grandfathered (legacy grace).
    const inactive =
      !!sub && (sub.status === 'PAST_DUE' || sub.status === 'CANCELED' || trialExpired);

    if (inactive) {
      if (trialExpired) {
        await prisma.subscription.update({
          where: { tenantId: tenant.id },
          data: { status: 'PAST_DUE' },
        });
      }
      return next(
        new AppError(
          402,
          'Your subscription is inactive. Please renew your plan to continue using the system.',
          'SUBSCRIPTION_INACTIVE'
        )
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}
