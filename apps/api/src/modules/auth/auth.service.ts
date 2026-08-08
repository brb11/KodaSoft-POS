import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { getPlan, PLANS } from '../billing/plans';
import { refreshTokenTtlSeconds } from './auth.cookies';
import type { LoginDto, PinLoginDto, SignupDto } from './auth.schema';

function signAccessToken(payload: object): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

// ─────────────────────────────────────────────
// REFRESH TOKENS
//
// Refresh tokens are opaque (random, non-JWT) values. Only their SHA-256 hash
// is persisted, so a database leak cannot be replayed as tokens. They are
// delivered to the browser in an httpOnly cookie (never reachable from JS) and
// rotated on every refresh, with reuse detection: presenting a token that is
// no longer the active one revokes the user's whole session family.
// ─────────────────────────────────────────────

function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function createRefreshSession(
  userId: string,
  req?: Request,
): Promise<string> {
  const token = generateRefreshToken();
  await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + refreshTokenTtlSeconds() * 1000),
      userAgent: req?.headers['user-agent'] ?? null,
      ip: req?.ip ?? null,
    },
  });
  return token;
}

async function issueTokens(
  user: { id: string; tenantId: string; branchId: string | null; role: string; email: string },
  req?: Request,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    role: user.role,
    email: user.email,
  });
  const refreshToken = await createRefreshSession(user.id, req);
  return { accessToken, refreshToken };
}

export async function revokeUserSessions(userId: string, at: Date = new Date()): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: at },
  });
}

export async function signup(dto: SignupDto, req?: Request) {
  const existing = await prisma.user.findFirst({ where: { email: dto.email.toLowerCase() } });
  if (existing) throw new AppError(409, 'An account with this email already exists');

  const planKey = dto.plan ?? 'starter';
  if (!PLANS.some((p) => p.key === planKey)) throw new AppError(422, 'Invalid plan selected');
  const plan = getPlan(planKey);
  const periodEnd = new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000);
  const slug = await generateUniqueSlug(dto.storeName);
  const passwordHash = await bcrypt.hash(dto.password, 10);
  const branchName = dto.branchName?.trim() || 'Main Branch';

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: dto.storeName.trim(),
        slug,
        plan: plan.key,
      },
    });

    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: branchName,
        address: dto.branchAddress,
        phone: dto.phone,
      },
    });

    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: plan.key,
        status: plan.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
        trialStarted: new Date(),
        periodStart: new Date(),
        periodEnd,
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: dto.ownerName.trim(),
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        role: 'OWNER',
      },
    });

    return { tenant, branch, user };
  });

  const { accessToken, refreshToken } = await issueTokens(result.user, req);

  return {
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      tenantId: result.tenant.id,
      branchId: result.user.branchId,
      tenant: { name: result.tenant.name, slug: result.tenant.slug },
    },
    accessToken,
    refreshToken,
    subscription: {
      plan: plan.key,
      status: plan.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
      periodEnd,
    },
  };
}

export async function loginWithEmail(dto: LoginDto, req?: Request) {
  const user = await prisma.user.findFirst({
    where: { email: dto.email, isActive: true },
    include: { tenant: true },
  });

  if (!user || !user.tenant?.isActive) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  const { accessToken, refreshToken } = await issueTokens(user, req);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
      tenant: { name: user.tenant.name, slug: user.tenant.slug },
    },
    accessToken,
    refreshToken,
  };
}

export async function loginWithPin(dto: PinLoginDto, req?: Request) {
  const users = await prisma.user.findMany({
    where: { branchId: dto.branchId, isActive: true, pinHash: { not: null }, tenant: { isActive: true } },
  });

  let matched = null;
  for (const user of users) {
    if (user.pinHash && (await bcrypt.compare(dto.pin, user.pinHash))) {
      matched = user;
      break;
    }
  }

  if (!matched) throw new AppError(401, 'Invalid PIN');

  const { accessToken, refreshToken } = await issueTokens(matched, req);

  return {
    user: {
      id: matched.id,
      name: matched.name,
      role: matched.role,
      tenantId: matched.tenantId,
      branchId: matched.branchId,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(req: Request) {
  const presented = req.cookies?.refresh_token as string | undefined;
  if (!presented) throw new AppError(401, 'No refresh token provided');

  const now = new Date();
  const tokenHash = hashToken(presented);
  const session = await prisma.refreshSession.findUnique({ where: { tokenHash } });

  // Missing, revoked, or expired token — treat as token reuse/theft and revoke
  // the user's entire session family so the stolen token cannot be replayed.
  if (!session || session.revokedAt || session.expiresAt < now) {
    if (session?.userId) await revokeUserSessions(session.userId, now);
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { tenant: true },
  });
  if (!user || !user.isActive || !user.tenant?.isActive) {
    await revokeUserSessions(session.userId, now);
    throw new AppError(401, 'User not found or inactive');
  }

  // Rotation: revoke the presented session and mint a fresh one.
  const newToken = generateRefreshToken();
  await prisma.$transaction([
    prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: now },
    }),
    prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newToken),
        expiresAt: new Date(now.getTime() + refreshTokenTtlSeconds() * 1000),
        userAgent: session.userAgent,
        ip: session.ip,
      },
    }),
  ]);

  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    role: user.role,
    email: user.email,
  });

  return { accessToken, refreshToken: newToken };
}

export async function logout(req: Request): Promise<void> {
  const presented = req.cookies?.refresh_token as string | undefined;
  if (!presented) return;
  const session = await prisma.refreshSession.findUnique({ where: { tokenHash: hashToken(presented) } });
  if (session) {
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
      branchId: true,
      tenant: { select: { name: true, slug: true } },
      branch: { select: { name: true } },
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

async function generateUniqueSlug(storeName: string): Promise<string> {
  const base = storeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'store';

  const existing = await prisma.tenant.findUnique({ where: { slug: base } });
  if (!existing) return base;

  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    const taken = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}
