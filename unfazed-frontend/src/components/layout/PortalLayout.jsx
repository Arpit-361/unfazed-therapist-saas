import { createContext, useContext } from 'react';
import { CalendarPlus, ClipboardCheck, CreditCard, FileText, Home, MessageSquare } from 'lucide-react';
import AppShell from './AppShell';
import useApi from '../../hooks/useApi';
import { portalApi } from '../../api/endpoints';
import { FullScreenLoader } from '../common/Loader';
import { ErrorState } from '../common/States';

const PortalContext = createContext(null);
export const usePortal = () => useContext(PortalContext);

export default function PortalLayout() {
  const portal = useApi(() => portalApi.me(), []);

  if (portal.loading && !portal.data) return <FullScreenLoader />;
  if (portal.error && !portal.data) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState error={portal.error} onRetry={portal.reload} />
      </div>
    );
  }

  const { client, therapist, features } = portal.data;
  const onboarded = client.intake_completed && client.consent.given;
  const nav = [
    { to: '/portal', label: 'Home', icon: Home, end: true },
    { to: '/portal/book', label: 'Book a session', icon: CalendarPlus },
    ...(!onboarded ? [{ to: '/portal/onboarding', label: 'Intake & consent', icon: ClipboardCheck, badge: <span className="h-2 w-2 rounded-full bg-amber-500" /> }] : []),
    { to: '/portal/payments', label: 'Payments & packages', icon: CreditCard },
    { to: '/portal/notes', label: 'Shared notes', icon: FileText },
    ...(features.chat ? [{ to: '/portal/messages', label: 'Messages', icon: MessageSquare }] : []),
  ];

  return (
    <PortalContext.Provider value={{ ...portal.data, onboarded, reload: () => portal.reload({ silent: true }) }}>
      <AppShell nav={nav} homePath="/portal" subtitle={`Client of ${therapist.name}`} />
    </PortalContext.Provider>
  );
}
