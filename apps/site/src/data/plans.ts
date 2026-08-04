export interface SitePlan {
  key: 'starter' | 'pro' | 'enterprise';
  priceMonthly: number;
  priceYearly: number;
  limits: { users: number; branches: number; products: number };
  features: { zatca: boolean; offline: boolean; advancedReports: boolean; multiBranch: boolean };
  popular?: boolean;
}

export const plans: SitePlan[] = [
  {
    key: 'starter',
    priceMonthly: 29,
    priceYearly: 290,
    limits: { users: 5, branches: 1, products: 500 },
    features: { zatca: true, offline: false, advancedReports: false, multiBranch: false },
  },
  {
    key: 'pro',
    priceMonthly: 79,
    priceYearly: 790,
    limits: { users: 20, branches: 3, products: 5000 },
    features: { zatca: true, offline: true, advancedReports: true, multiBranch: true },
    popular: true,
  },
  {
    key: 'enterprise',
    priceMonthly: 199,
    priceYearly: 1990,
    limits: { users: -1, branches: -1, products: -1 },
    features: { zatca: true, offline: true, advancedReports: true, multiBranch: true },
  },
];

export const featureOrder = ['zatca', 'offline', 'advancedReports', 'multiBranch'] as const;

export function limitLabel(value: number, key: 'users' | 'branches' | 'products'): string {
  if (value === -1) return 'unlimited';
  return `${value} ${key}`;
}
