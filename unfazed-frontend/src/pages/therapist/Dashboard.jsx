import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Copy, ExternalLink, IndianRupee, Inbox, Link2, UserX, Users } from 'lucide-react';
import Button from '../../components/common/Button';
import StatCard from '../../components/analytics/StatCard';
import Avatar from '../../components/common/Avatar';
import { StatusBadge } from '../../components/common/Badge';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import RevenueChart from '../../components/analytics/RevenueChart';
import { analyticsApi, leadsApi, paymentsApi, schedulingApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import { copyToClipboard } from '../../utils/download';
import { firstName, fmtDayLabel, fmtRelative, fmtTime, formatINR } from '../../utils/format';

function Panel({ title, to, linkLabel = 'View all', children }) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
            {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const overview = useApi(() => analyticsApi.overview(), []);
  const upcoming = useApi(() => schedulingApi.sessions({ from: new Date().toISOString(), status: 'confirmed,pending_payment', limit: 6 }), []);
  const payments = useApi(() => paymentsApi.list({ status: 'paid' }), []);
  const leads = useApi(() => leadsApi.list({ status: 'new' }), []);

  const profileUrl = `${window.location.origin}/${user?.slug}`;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const stats = overview.data?.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {firstName(user?.name) || 'there'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening in your practice.</p>
        </div>
        <div className="card flex items-center gap-3 p-3 pl-4">
          <Link2 className="h-4 w-4 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Your booking link</p>
            <p className="truncate text-sm font-medium text-slate-900">{profileUrl.replace(/^https?:\/\//, '')}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Copy link"
            onClick={async () => {
              if (await copyToClipboard(profileUrl)) toast.success('Profile link copied', 'Share it on WhatsApp, Instagram or your website.');
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Open profile" href={profileUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {overview.error ? (
        <ErrorState error={overview.error} onRetry={overview.reload} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {!stats ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="card h-[104px] animate-pulse bg-slate-100" />)
          ) : (
            <>
              <StatCard label="Active clients" value={stats.active_clients} hint={`${stats.recently_active_clients} seen in 30 days`} icon={Users} />
              <StatCard label="Revenue this month" value={formatINR(stats.revenue_this_month)} hint={`Net ${formatINR(stats.net_this_month)}`} icon={IndianRupee} tone="violet" />
              <StatCard label="Sessions next 7 days" value={stats.upcoming_sessions_7d} icon={CalendarCheck} tone="blue" />
              <StatCard label="No-show rate (90d)" value={`${stats.no_show_rate}%`} hint={`${stats.new_leads} new enquiries`} icon={UserX} tone="rose" />
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Upcoming sessions" to="/dashboard/schedule" linkLabel="Calendar">
          {upcoming.loading ? (
            <div className="p-4">
              <CardSkeleton rows={4} />
            </div>
          ) : !upcoming.data?.sessions.length ? (
            <EmptyState compact icon={CalendarCheck} title="No upcoming sessions" description="Share your booking link to fill your calendar." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.data.sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-20 shrink-0 whitespace-nowrap text-center">
                    <p className="text-[11px] font-semibold uppercase text-brand-700">{fmtDayLabel(s.start_time).split(' ')[0]}</p>
                    <p className="text-sm font-bold text-slate-900">{fmtTime(s.start_time)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/dashboard/clients/${s.client_id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                      {s.client?.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {fmtDayLabel(s.start_time)} · {s.service_title}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="card p-5 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Revenue</h3>
            <Link to="/dashboard/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
              Analytics <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {overview.data ? <RevenueChart data={overview.data.revenue_trend} height={240} /> : <div className="h-60 animate-pulse rounded-xl bg-slate-100" />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent payments" to="/dashboard/payments">
          {payments.loading ? (
            <div className="p-4">
              <CardSkeleton rows={4} />
            </div>
          ) : !payments.data?.payments.length ? (
            <EmptyState compact icon={IndianRupee} title="No payments yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.data.payments.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={p.client?.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{p.client?.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {fmtRelative(p.paid_at)} · {p.purpose === 'package' ? 'Package' : 'Session'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{formatINR(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="New enquiries" to="/dashboard/leads">
          {leads.loading ? (
            <div className="p-4">
              <CardSkeleton rows={3} />
            </div>
          ) : !leads.data?.leads.length ? (
            <EmptyState compact icon={Inbox} title="No new enquiries" description="Enquiries from your public profile appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {leads.data.leads.slice(0, 5).map((l) => (
                <li key={l.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{l.name}</p>
                    <span className="text-xs text-slate-400">{fmtRelative(l.created_at)}</span>
                  </div>
                  {l.message && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{l.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
