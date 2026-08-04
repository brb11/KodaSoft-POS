import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { getPlan, PLANS } from '../billing/plans';
import type { LoginDto, PinLoginDto, SignupDto } from './auth.schema';

function signAccessToken(payload: object): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function signRefreshToken(payload: object): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export async function signup(dto: SignupDto) {
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

  const tokenPayload = {
    sub: result.user.id,
    tenantId: result.tenant.id,
    branchId: result.user.branchId,
    role: result.user.role,
    email: result.user.email,
  };

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
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken({ sub: result.user.id }),
    subscription: {
      plan: plan.key,
      status: plan.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
      periodEnd,
    },
  };
}
export async function loginWithEmail(dto: LoginDto) {
  const user = await prisma.user.findFirst({
    where: { email: dto.email, isActive: true },
    include: { tenant: true },
  });

  if (!user || !user.tenant?.isActive) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  const tokenPayload = {
    sub: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    role: user.role,
    email: user.email,
  };

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
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken({ sub: user.id }),
  };
}

export async function loginWithPin(dto: PinLoginDto) {
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

  const tokenPayload = {
    sub: matched.id,
    tenantId: matched.tenantId,
    branchId: matched.branchId,
    role: matched.role,
    email: matched.email,
  };

  return {
    user: {
      id: matched.id,
      name: matched.name,
      role: matched.role,
      tenantId: matched.tenantId,
      branchId: matched.branchId,
    },
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken({ sub: matched.id }),
  };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: any;
  try {
    payload = jwt.verify(refreshToken, env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Invalid refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { tenant: true },
  });
  if (!user || !user.isActive || !user.tenant?.isActive) throw new AppError(401, 'User not found');

  const tokenPayload = {
    sub: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    role: user.role,
    email: user.email,
  };

  return { accessToken: signAccessToken(tokenPayload) };
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
