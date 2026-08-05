import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { connectDB } from './lib/prisma';
import { errorHandler, notFound } from './middleware/error.middleware';

import { authRouter } from './modules/auth/auth.router';
import { productsRouter } from './modules/products/products.router';
import { categoriesRouter } from './modules/categories/categories.router';
import { ordersRouter } from './modules/orders/orders.router';
import { shiftsRouter } from './modules/shifts/shifts.router';
import { reportsRouter } from './modules/reports/reports.router';
import { branchesRouter } from './modules/branches/branches.router';
import { usersRouter } from './modules/users/users.router';
import { settingsRouter } from './modules/settings/settings.router';
import { customersRouter } from './modules/customers/customers.router';
import { saasRouter } from './modules/saas/saas.router';
import { plansRouter } from './modules/plans/plans.router';
import { billingRouter } from './modules/billing/billing.router';
import { inventoryRouter } from './modules/inventory/inventory.router';
import { debtsRouter } from './modules/debts/debts.router';

const app = express();

// Security & Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'KodaSoft-POS API', company: 'KodaSoft', timestamp: new Date() });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/shifts', shiftsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/branches', branchesRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/plans', plansRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/debts', debtsRouter);
app.use('/api/v1/saas', saasRouter);

// Error Handling
app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(env.PORT, () => {
      console.log(`🚀 KodaSoft-POS API server running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
