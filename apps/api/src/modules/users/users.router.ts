import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import * as usersService from './users.service';

export const usersRouter: Router = Router();
usersRouter.use(authenticate);
usersRouter.use(requireActiveSubscription);

// Only managers/owners should manage users (simplified for MVP)
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
  try {
    const data = await usersService.createUser(req.user!.tenantId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    res.status(status).json({ success: false, message: error.message });
  }
});

usersRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = await usersService.updateUser(req.user!.tenantId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    res.status(status).json({ success: false, message: error.message });
  }
});

usersRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = await usersService.deleteUser(req.user!.tenantId, req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    res.status(status).json({ success: false, message: error.message });
  }
});
