import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { entitlementsApi } from '../api/endpoints';
import UpgradePrompt from '../components/entitlements/UpgradePrompt';

const EntitlementContext = createContext(null);

/**
 * Loads the therapist's entitlement summary (computed by the backend entitlementService) and
 * hosts the global upgrade prompt. Components never inspect tier names - they ask useEntitlement.
 */
export function EntitlementProvider({ children }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await entitlementsApi.mine());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpgrade = (e) => setPrompt(e.detail || {});
    window.addEventListener('unfazed:upgrade-required', onUpgrade);
    return () => window.removeEventListener('unfazed:upgrade-required', onUpgrade);
  }, []);

  const value = useMemo(
    () => ({
      summary,
      loading,
      refresh,
      openUpgrade: (detail) => setPrompt(detail || {}),
    }),
    [summary, loading, refresh]
  );

  return (
    <EntitlementContext.Provider value={value}>
      {children}
      <UpgradePrompt
        open={Boolean(prompt)}
        detail={prompt}
        onClose={() => setPrompt(null)}
        onUpgraded={async () => {
          setPrompt(null);
          await refresh();
        }}
      />
    </EntitlementContext.Provider>
  );
}

export const useEntitlementContext = () => useContext(EntitlementContext);
