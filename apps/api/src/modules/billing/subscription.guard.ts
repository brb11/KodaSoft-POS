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
      include: {
        subscription: true,
        // JWT payload does not carry isActive — re-verify the acting user
        // against the DB so a deactivated account cannot keep using a session.
        users: { where: { id: req.user.sub }, select: { isActive: true } },
      },
    });
    if (!tenant) return next(new AppError(404, 'Tenant not found'));

    // Suspended tenants (SaaS console isActive: false) must be blocked even
    // though their subscription row may still look ACTIVE.
    if (!tenant.isActive) {
      return next(new AppError(403, 'Your account has been suspended. Please contact support.', 'TENANT_SUSPENDED'));
    }

    // Deactivated user still holds a valid JWT until it expires.
    if (tenant.users.length === 0 || !tenant.users[0].isActive) {
      return next(new AppError(403, 'Your account has been deactivated', 'ACCOUNT_DEACTIVATED'));
    }

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
