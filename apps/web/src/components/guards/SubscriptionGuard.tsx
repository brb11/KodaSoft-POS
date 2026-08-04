import React, { useEffect } from 'react';
import { useBillingStore } from '../../stores/billingStore';
import { PaywallScreen } from './PaywallScreen';

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const data = useBillingStore((s) => s.data);
  const isActive = useBillingStore((s) => s.isActive);
  const fetch = useBillingStore((s) => s.fetch);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (data && !isActive) return <PaywallScreen />;
  return <>{children}</>;
};
