import { Router } from 'express';
import { PLANS, PLAN_FEATURE_LABELS } from '../billing/plans';

export const plansRouter: Router = Router();

// GET /api/v1/plans — public plan catalog for onboarding & upgrades
plansRouter.get('/', (_req, res) => {
  const data = PLANS.map((p) => ({
    key: p.key,
    name: p.name,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    currency: p.currency,
    trialDays: p.trialDays,
    limits: p.limits,
    features: Object.entries(p.features)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => PLAN_FEATURE_LABELS[feature as keyof typeof PLAN_FEATURE_LABELS]),
  }));
  res.json({ success: true, data });
});
