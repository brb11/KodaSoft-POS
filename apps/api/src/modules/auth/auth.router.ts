import { Router, Request, Response } from 'express';
import { loginSchema, pinLoginSchema, signupSchema } from './auth.schema';
import * as authService from './auth.service';
import { clearRefreshCookie, setRefreshCookie } from './auth.cookies';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';

export const authRouter: Router = Router();

// Strips the one-time refresh token out of the JSON body after handing it to
// the browser as an httpOnly cookie. The token never reaches client JS.
function attachRefreshCookie(res: Response, result: { refreshToken: string }) {
  setRefreshCookie(res, result.refreshToken);
  delete (result as { refreshToken?: string }).refreshToken;
}

// POST /api/v1/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const dto = loginSchema.parse(req.body);
  const result = await authService.loginWithEmail(dto, req);
  attachRefreshCookie(res, result);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/signup
// Self-service onboarding: provisions a tenant, branch, owner, and trial subscription.
authRouter.post('/signup', async (req: Request, res: Response) => {
  const dto = signupSchema.parse(req.body);
  const result = await authService.signup(dto, req);
  attachRefreshCookie(res, result);
  res.status(201).json({ success: true, data: result });
});

// POST /api/v1/auth/pin-login
authRouter.post('/pin-login', async (req: Request, res: Response) => {
  const dto = pinLoginSchema.parse(req.body);
  const result = await authService.loginWithPin(dto, req);
  attachRefreshCookie(res, result);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/refresh
// Reads the refresh token from the httpOnly cookie, rotates it, and returns a
// fresh access token. No auth header required (the access token may be expired).
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const result = await authService.refreshAccessToken(req);
  setRefreshCookie(res, result.refreshToken);
  res.json({ success: true, data: { accessToken: result.accessToken } });
});

// POST /api/v1/auth/logout
// Revokes the refresh session server-side and clears the cookie. Deliberately
// not behind `authenticate` so it works even after the access token has expired.
authRouter.post('/logout', async (req: Request, res: Response) => {
  await authService.logout(req);
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/v1/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await authService.getMe(req.user!.sub);
  res.json({ success: true, data: user });
});
