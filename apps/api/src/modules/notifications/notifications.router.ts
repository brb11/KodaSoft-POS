import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import * as notificationsService from './notifications.service';

export const notificationsRouter: Router = Router();
notificationsRouter.use(authenticate);
notificationsRouter.use(requireActiveSubscription);

// Lists the user's notifications. The sweep runs lazily so reminders are
// generated even if the server was started long ago (and are deduped, so
// repeated calls are cheap and never duplicate entries).
notificationsRouter.get('/', async (req: AuthRequest, res: Response) => {
  await notificationsService.runExpirySweep(req.user!.tenantId);
  const data = await notificationsService.listNotifications(
    req.user!.tenantId,
    req.user!.sub
  );
  res.json({ success: true, data });
});

notificationsRouter.get('/unread-count', async (req: AuthRequest, res: Response) => {
  await notificationsService.runExpirySweep(req.user!.tenantId);
  const count = await notificationsService.unreadCount(req.user!.tenantId, req.user!.sub);
  res.json({ success: true, data: { count } });
});

notificationsRouter.post('/read-all', async (req: AuthRequest, res: Response) => {
  const data = await notificationsService.markAllRead(req.user!.tenantId, req.user!.sub);
  res.json({ success: true, data });
});

notificationsRouter.post('/:id/read', async (req: AuthRequest, res: Response) => {
  const data = await notificationsService.markRead(
    req.user!.tenantId,
    req.user!.sub,
    req.params.id
  );
  res.json({ success: true, data });
});
