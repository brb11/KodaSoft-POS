import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, pinLoginSchema, signupSchema } from './auth.schema';
import * as authService from './auth.service';
import { clearRefreshCookie, setRefreshCookie } from './auth.cookies';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';

// Strict limiter for PIN login: 10 failed attempts per 15 min per IP+branch.
// Scoped by branchId so one branch's failures don't block another.
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => `pin:${req.ip}:${String(req.body?.branchId ?? '')}`,
  message: { success: false, message: 'Too many PIN attempts. Please wait 15 minutes and try again.', code: 'PIN_RATE_LIMITED' },
});

// Limiter for Email Login: 5 failed attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Only punish failures
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes and try again.', code: 'LOGIN_RATE_LIMITED' },
});

// Limiter for Signup: 3 attempts per hour per IP.
// Prevents bot spam from creating thousands of dummy tenants.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many accounts created from this IP. Please try again later.', code: 'SIGNUP_RATE_LIMITED' },
});

export const authRouter: Router = Router();

// Strips the one-time refresh token out of the JSON body after handing it to
// the browser as an httpOnly cookie. The token never reaches client JS.
function attachRefreshCookie(res: Response, result: { refreshToken: string }) {
  setRefreshCookie(res, result.refreshToken);
  delete (result as { refreshToken?: string }).refreshToken;
}

// POST /api/v1/auth/login
authRouter.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const dto = loginSchema.parse(req.body);
  const result = await authService.loginWithEmail(dto, req);
  attachRefreshCookie(res, result);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/signup
// Self-service onboarding: provisions a tenant, branch, owner, and trial subscription.
authRouter.post('/signup', signupLimiter, async (req: Request, res: Response) => {
  const dto = signupSchema.parse(req.body);
  const result = await authService.signup(dto, req);
  attachRefreshCookie(res, result);
  res.status(201).json({ success: true, data: result });
});

// POST /api/v1/auth/pin-login
authRouter.post('/pin-login', pinLimiter, async (req: Request, res: Response) => {
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
