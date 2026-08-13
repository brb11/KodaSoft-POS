import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { createUserSchema, updateUserSchema } from './users.schema';
import * as usersService from './users.service';

export const usersRouter: Router = Router();
usersRouter.use(authenticate);
usersRouter.use(requireActiveSubscription);

// Only managers/owners should manage users (simplified for MVP).
// Role assignment (OWNER) and OWNER-account management are further restricted
// inside the service (see assertCanAssignRole / FORBIDDEN_TARGET guards).
const requireAdmin = (req: AuthRequest, res: Response, next: any) => {
  if (req.user?.role !== 'OWNER' && req.user?.role !== 'MANAGER') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

usersRouter.use(requireAdmin);

usersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const data = await usersService.getUsers(req.user!.tenantId);
  res.json({ success: true, data });
});

usersRouter.post('/', async (req: AuthRequest, res: Response) => {
  const dto = createUserSchema.parse(req.body);
  const data = await usersService.createUser(req.user!.tenantId, req.user!.role, dto);
  res.status(201).json({ success: true, data });
});

usersRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const dto = updateUserSchema.parse(req.body);
  const data = await usersService.updateUser(req.user!.tenantId, req.params.id, req.user!.sub, req.user!.role, dto);
  res.json({ success: true, data });
});

usersRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const data = await usersService.deleteUser(req.user!.tenantId, req.params.id, req.user!.sub, req.user!.role);
  res.json({ success: true, data });
});
