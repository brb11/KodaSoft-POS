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
import { heldOrdersRouter } from './modules/heldOrders/held-orders.router';
import { zatcaRouter } from './modules/zatca/zatca.router';
import { billingWebhookRouter } from './modules/billing/billing.webhook.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { expensesRouter } from './modules/expenses/expenses.router';
import { suppliersRouter } from './modules/suppliers/suppliers.router';
import { purchasesRouter } from './modules/purchases/purchases.router';
import { startNotificationScheduler } from './modules/notifications/notifications.service';

const app = express();

// The API is only reachable through nginx reverse proxies (the web container,
// and optionally host nginx in front of it), which set X-Forwarded-For. Tell
// Express to trust them so rate limiting identifies real client IPs and
// express-rate-limit does not reject every proxied request.
app.set('trust proxy', true);

// Security & Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Payment gateway webhooks need the RAW body for signature verification, so the
// router is mounted before the JSON body parser consumes the stream.
app.use('/api/v1/billing/webhook', billingWebhookRouter);

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
app.use('/api/v1/held-orders', heldOrdersRouter);
app.use('/api/v1/zatca', zatcaRouter);
app.use('/api/v1/saas', saasRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/suppliers', suppliersRouter);
app.use('/api/v1/purchases', purchasesRouter);

// Error Handling
app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    startNotificationScheduler();
    app.listen(env.PORT, () => {
      console.log(`🚀 KodaSoft-POS API server running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
