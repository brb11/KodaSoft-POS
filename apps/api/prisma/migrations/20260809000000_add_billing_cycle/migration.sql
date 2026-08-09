-- Add billing cycle support (monthly | yearly) to subscriptions and payments.
ALTER TABLE "subscriptions" ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "subscription_payments" ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'monthly';
