import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, CalendarCheck, IndianRupee, UserX, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import RevenueChart from '../../components/analytics/RevenueChart';
import LockedFeature from '../../components/entitlements/LockedFeature';
import { analyticsApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import useEntitlement, { FEATURES } from '../../hooks/useEntitlement';
import { fmtMonth, formatCompactINR, formatINR, titleCase } from '../../utils/format';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PIE_COLORS = { active: '#0d9488', invited: '#0ea5e9', inactive: '#94a3b8', archived: '#cbd5e1' };
const fmtHour = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

const axis = { tick: { fontSize: 12, fill: '#64748b' }, axisLine: false, tickLine: false };

function AdvancedAnalytics() {
  const { data, loading, error, reload } = useApi(() => analyticsApi.advanced(), []);
  if (loading) return <CardSkeleton rows={4} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Revenue by source" subtitle="Single sessions vs packages, last 12 months" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.revenue_by_purpose}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tickFormatter={fmtMonth} {...axis} />
            <YAxis tickFormatter={formatCompactINR} width={56} {...axis} />
            <Tooltip formatter={(v) => formatINR(v)} labelFormatter={fmtMonth} />
            <Legend />
            <Bar dataKey="session" name="Sessions" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} />
            <Bar dataKey="package" name="Packages" stackId="a" fill="#7c3aed" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="No-show rate trend" subtitle="% of past sessions marked no-show">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.no_show_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tickFormatter={fmtMonth} {...axis} />
            <YAxis unit="%" width={44} {...axis} />
            <Tooltip formatter={(v, n, p) => [`${v}% (${p.payload.no_shows}/${p.payload.sessions})`, 'No-show rate']} labelFormatter={fmtMonth} />
            <Line type="monotone" dataKey="rate" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="New clients" subtitle="Clients added per month">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.new_clients}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tickFormatter={fmtMonth} {...axis} />
            <YAxis allowDecimals={false} width={32} {...axis} />
            <Tooltip labelFormatter={fmtMonth} />
            <Bar dataKey="count" name="New clients" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top clients by revenue">
        {data.top_clients.length === 0 ? (
          <EmptyState compact title="No paid sessions yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.top_clients.map((c, i) => (
              <li key={c.client_id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                  <span className="font-medium text-slate-800">{c.name}</span>
                </span>
                <span className="text-slate-600">
                  {formatINR(c.revenue)} <span className="text-xs text-slate-400">· {c.payments} payments</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>

      <ChartCard title="Busiest time slots" subtitle="Most-booked day & hour (your timezone)">
        {data.busiest_slots.length === 0 ? (
          <EmptyState compact title="Not enough sessions yet" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.busiest_slots.slice(0, 12).map((s) => {
              const max = data.busiest_slots[0].count;
              return (
                <div
                  key={`${s.day_of_week}-${s.hour}`}
                  className="rounded-xl px-3 py-2 text-xs"
                  style={{ background: `rgba(13,148,136,${0.12 + (s.count / max) * 0.6})`, color: s.count / max > 0.6 ? 'white' : '#134e4a' }}
                >
                  <p className="font-semibold">
                    {DAYS[s.day_of_week]} {fmtHour(s.hour)}
                  </p>
                  <p>{s.count} sessions</p>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>

      <ChartCard title="Package utilisation" className="lg:col-span-2">
        {data.package_utilisation.length === 0 ? (
          <EmptyState compact title="No packages sold yet" />
        ) : (
          <div className="space-y-3">
            {data.package_utilisation.map((p) => (
              <div key={p.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-slate-800">
                    {p.name} <span className="text-xs text-slate-400">· {p.sold} sold</span>
                  </span>
                  <span className="text-slate-600">
                    {p.sessions_used}/{p.sessions_total} sessions · {p.utilisation}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, p.utilisation)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

export default function Analytics() {
  const advanced = useEntitlement(FEATURES.ANALYTICS_ADVANCED);
  const { data, loading, error, reload } = useApi(() => analyticsApi.overview(), []);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const pieData = data ? Object.entries(data.clients_by_status).map(([name, value]) => ({ name, value })) : [];
  const sessions = data?.sessions_last_30d || {};

  return (
    <div>
      <PageHeader title="Analytics" description={data ? `All figures in your timezone (${data.timezone}).` : 'Practice performance at a glance.'} />

      {loading ? (
        <CardSkeleton rows={6} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active clients" value={data.stats.active_clients} hint={`${data.stats.recently_active_clients} seen in last 30 days`} icon={Users} />
            <StatCard label="Revenue this month" value={formatINR(data.stats.revenue_this_month)} hint={`Net ${formatINR(data.stats.net_this_month)}`} icon={IndianRupee} tone="violet" />
            <StatCard label="No-show rate (90d)" value={`${data.stats.no_show_rate}%`} hint={`Across ${data.stats.no_show_sample} sessions`} icon={UserX} tone="rose" />
            <StatCard label="Upcoming (7 days)" value={data.stats.upcoming_sessions_7d} hint={`${data.stats.new_leads} new leads`} icon={CalendarCheck} tone="blue" />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <ChartCard title="Revenue trend" subtitle="Collected vs net payout, last 6 months" className="lg:col-span-2">
              <RevenueChart data={data.revenue_trend} />
            </ChartCard>
            <ChartCard title="Clients by status">
              {pieData.length === 0 ? (
                <EmptyState compact title="No clients yet" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={PIE_COLORS[d.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, titleCase(n)]} />
                    <Legend formatter={(v) => titleCase(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="card mb-8 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <Activity className="h-4 w-4 text-brand-600" /> Sessions in the last 30 days
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {['completed', 'confirmed', 'no_show', 'cancelled', 'pending_payment'].map((k) => (
                <div key={k} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{titleCase(k)}</p>
                  <p className="text-xl font-bold text-slate-900">{sessions[k] || 0}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Advanced insights</h2>
      </div>
      {advanced.loading ? (
        <CardSkeleton rows={3} />
      ) : advanced.allowed ? (
        <AdvancedAnalytics />
      ) : (
        <LockedFeature
          featureKey={FEATURES.ANALYTICS_ADVANCED}
          title="Advanced analytics"
          description="12-month revenue by source, no-show trends, client growth, top clients, busiest slots and package utilisation."
        >
          <div className="grid h-64 grid-cols-3 gap-4">
            <div className="rounded-xl bg-brand-100" />
            <div className="rounded-xl bg-violet-100" />
            <div className="rounded-xl bg-sky-100" />
          </div>
        </LockedFeature>
      )}
    </div>
  );
}
