import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { createProductSchema, updateProductSchema, productQuerySchema } from './products.schema';
import * as productsService from './products.service';

export const productsRouter: Router = Router();

productsRouter.use(authenticate);
productsRouter.use(requireActiveSubscription);

// GET /api/v1/products
productsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const query = productQuerySchema.parse(req.query);
  const result = await productsService.getProducts(req.user!.tenantId, query);
  res.json({ success: true, data: result });
});

// GET /api/v1/products/export (CSV download)
productsRouter.get('/export', async (req: AuthRequest, res: Response) => {
  const { filename, csv } = await productsService.exportProductsCsv(req.user!.tenantId);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv);
});

// POST /api/v1/products/import (CSV text body)
const importProductsSchema = z.object({ csv: z.string().min(1) });
productsRouter.post('/import', async (req: AuthRequest, res: Response) => {
  const { csv } = importProductsSchema.parse(req.body);
  const result = await productsService.importProducts(req.user!.tenantId, csv);
  res.json({ success: true, data: result });
});

// GET /api/v1/products/barcode/:barcode
productsRouter.get('/barcode/:barcode', async (req: AuthRequest, res: Response) => {
  const product = await productsService.getProductByBarcode(req.user!.tenantId, req.params.barcode);
  res.json({ success: true, data: product });
});

// GET /api/v1/products/:id
productsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const product = await productsService.getProductById(req.user!.tenantId, req.params.id);
  res.json({ success: true, data: product });
});

// POST /api/v1/products
productsRouter.post('/', async (req: AuthRequest, res: Response) => {
  const dto = createProductSchema.parse(req.body);
  const product = await productsService.createProduct(req.user!.tenantId, dto);
  res.status(201).json({ success: true, data: product });
});

// PUT /api/v1/products/:id
productsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const dto = updateProductSchema.parse(req.body);
  const product = await productsService.updateProduct(req.user!.tenantId, req.params.id, dto);
  res.json({ success: true, data: product });
});

// DELETE /api/v1/products/:id (soft delete)
productsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  await productsService.deleteProduct(req.user!.tenantId, req.params.id);
  res.json({ success: true, message: 'Product deactivated' });
});
