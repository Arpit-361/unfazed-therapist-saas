import { useCallback } from 'react';
import { useEntitlementContext } from '../context/EntitlementContext';

export const FEATURES = Object.freeze({
  ACTIVE_CLIENTS: 'clients.active',
  CHAT: 'communication.chat',
  NOTE_TEMPLATES: 'notes.templates',
  PACKAGES: 'payments.packages',
  WAITLIST: 'scheduling.waitlist',
  ANALYTICS_ADVANCED: 'analytics.advanced',
});

/**
 * UI hint for a feature. The backend remains the authority: every gated API re-checks
 * canAccess(therapistId, featureKey) and answers 403 UPGRADE_REQUIRED, which also opens the prompt.
 */
export default function useEntitlement(featureKey) {
  const ctx = useEntitlementContext();
  const info = ctx?.summary?.features?.[featureKey];
  const allowed = info ? info.allowed : false;

  const requireAccess = useCallback(() => {
    // Summary not loaded yet: let the request through, the backend will answer 403 if blocked.
    if (allowed || !ctx?.summary) return true;
    ctx.openUpgrade(info || { featureKey });
    return false;
  }, [allowed, ctx, info, featureKey]);

  return {
    allowed,
    loading: ctx?.loading ?? true,
    info,
    tier: ctx?.summary?.tier,
    requireAccess,
    openUpgrade: () => ctx?.openUpgrade(info || { featureKey }),
  };
}
