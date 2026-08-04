import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { createCustomerSchema, updateCustomerSchema, customerQuerySchema } from './customers.schema';
import * as customersService from './customers.service';

export const customersRouter: Router = Router();
customersRouter.use(authenticate);
customersRouter.use(requireActiveSubscription);

customersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const query = customerQuerySchema.parse(req.query);
  const data = await customersService.getCustomers(req.user!.tenantId, query);
  res.json({ success: true, data });
});

customersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const data = await customersService.getCustomerById(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

customersRouter.post('/', async (req: AuthRequest, res: Response) => {
  const dto = createCustomerSchema.parse(req.body);
  const data = await customersService.createCustomer(req.user!.tenantId, dto);
  res.status(201).json({ success: true, data });
});

customersRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const dto = updateCustomerSchema.parse(req.body);
  const data = await customersService.updateCustomer(req.user!.tenantId, req.params.id, dto);
  res.json({ success: true, data });
});

customersRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const data = await customersService.deleteCustomer(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});
