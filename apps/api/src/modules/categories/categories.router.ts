import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import * as categoriesService from './categories.service';

export const categoriesRouter: Router = Router();
categoriesRouter.use(authenticate);
categoriesRouter.use(requireActiveSubscription);

categoriesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const data = await categoriesService.getCategories(req.user!.tenantId);
  res.json({ success: true, data });
});

categoriesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const data = await categoriesService.getCategoryById(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

categoriesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const dto = createCategorySchema.parse(req.body);
  const data = await categoriesService.createCategory(req.user!.tenantId, dto);
  res.status(201).json({ success: true, data });
});

categoriesRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const dto = updateCategorySchema.parse(req.body);
  const data = await categoriesService.updateCategory(req.user!.tenantId, req.params.id, dto);
  res.json({ success: true, data });
});

categoriesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  await categoriesService.deleteCategory(req.user!.tenantId, req.params.id);
  res.json({ success: true, message: 'Category deactivated' });
});
