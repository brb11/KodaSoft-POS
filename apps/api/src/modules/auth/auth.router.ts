import { Router, Request, Response } from 'express';
import { loginSchema, pinLoginSchema, refreshSchema, signupSchema } from './auth.schema';
import * as authService from './auth.service';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';

export const authRouter: Router = Router();

// POST /api/v1/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const dto = loginSchema.parse(req.body);
  const result = await authService.loginWithEmail(dto);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/signup
// Self-service onboarding: provisions a tenant, branch, owner, and trial subscription.
authRouter.post('/signup', async (req: Request, res: Response) => {
  const dto = signupSchema.parse(req.body);
  const result = await authService.signup(dto);
  res.status(201).json({ success: true, data: result });
});

// POST /api/v1/auth/pin-login
authRouter.post('/pin-login', async (req: Request, res: Response) => {
  const dto = pinLoginSchema.parse(req.body);
  const result = await authService.loginWithPin(dto);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await authService.refreshAccessToken(refreshToken);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/logout
authRouter.post('/logout', authenticate, (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/v1/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await authService.getMe(req.user!.sub);
  res.json({ success: true, data: user });
});
