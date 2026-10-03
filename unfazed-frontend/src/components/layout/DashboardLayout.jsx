import { BarChart3, CalendarDays, CreditCard, FileText, Inbox, LayoutDashboard, MessageSquare, Settings, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppShell from './AppShell';
import { EntitlementProvider, useEntitlementContext } from '../../context/EntitlementContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/dashboard/clients', label: 'Clients', icon: Users },
  { to: '/dashboard/notes', label: 'Clinical notes', icon: FileText },
  { to: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { to: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { to: '/dashboard/leads', label: 'Enquiries', icon: Inbox },
  { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function PlanCard() {
  const { summary } = useEntitlementContext() || {};
  if (!summary) return null;
  const clients = summary.features?.['clients.active'];
  const pct = clients?.limit ? Math.min(100, Math.round((clients.usage / clients.limit) * 100)) : 0;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-4 text-white">
      <div className="flex items-center gap-2 text-xs font-medium text-brand-100">
        <Sparkles className="h-3.5 w-3.5" /> Current plan
      </div>
      <p className="mt-1 text-base font-semibold">{summary.tier.name}</p>
      {clients && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-brand-100">
            <span>Active clients</span>
            <span>
              {clients.usage}
              {clients.limit ? ` / ${clients.limit}` : ' · unlimited'}
            </span>
          </div>
          {clients.limit && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-amber-300' : 'bg-brand-300'}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}
      <Link to="/dashboard/settings?tab=plan" className="mt-3 inline-block text-xs font-semibold text-white underline-offset-2 hover:underline">
        Manage plan →
      </Link>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <EntitlementProvider>
      <AppShell nav={NAV} homePath="/dashboard" sidebarFooter={<PlanCard />} />
    </EntitlementProvider>
  );
}
