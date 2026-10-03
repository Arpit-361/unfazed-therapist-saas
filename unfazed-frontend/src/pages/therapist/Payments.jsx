import { useMemo, useState } from 'react';
import { CreditCard, IndianRupee, Package, Pencil, Plus, Receipt, Wallet } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import StatCard from '../../components/analytics/StatCard';
import Tabs from '../../components/common/Tabs';
import Badge, { StatusBadge } from '../../components/common/Badge';
import { Select } from '../../components/common/Field';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import PackageCard from '../../components/payments/PackageCard';
import PackageFormModal from '../../components/payments/PackageFormModal';
import InvoiceView from '../../components/payments/InvoiceView';
import LockedFeature from '../../components/entitlements/LockedFeature';
import { paymentsApi, systemApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useEntitlement, { FEATURES } from '../../hooks/useEntitlement';
import { fmtDate, formatINR } from '../../utils/format';

function PaymentsTable({ payments, onInvoice }) {
  if (!payments.length) return <EmptyState compact icon={Receipt} title="No payments found" />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount (incl. GST)</th>
              <th className="px-4 py-3 text-right">Platform fee</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(p.paid_at || p.created_at)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{p.client?.name || '—'}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-slate-600" title={p.description}>
                  {p.description}
                  {p.gateway === 'demo' && (
                    <Badge tone="violet" className="ml-2">
                      demo
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatINR(p.amount)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{p.status === 'paid' ? formatINR(p.platform_fee) : '—'}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{p.status === 'paid' ? formatINR(p.net_amount) : '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {p.invoice_number && (
                    <Button size="sm" variant="ghost" icon={Receipt} onClick={() => onInvoice(p)}>
                      Invoice
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{p.client?.name}</p>
              <p className="truncate text-xs text-slate-500">
                {fmtDate(p.paid_at || p.created_at)} · {p.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-semibold">{formatINR(p.amount)}</p>
                <StatusBadge status={p.status} />
              </div>
              {p.invoice_number && (
                <Button size="icon" variant="ghost" onClick={() => onInvoice(p)} aria-label="View invoice">
                  <Receipt className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Payments() {
  const toast = useToast();
  const [tab, setTab] = useState('payments');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const packagesFeature = useEntitlement(FEATURES.PACKAGES);

  const summary = useApi(() => paymentsApi.summary(), []);
  const payments = useApi(() => paymentsApi.list({ status: status || undefined }), [status]);
  const config = useApi(() => systemApi.paymentConfig(), []);
  const packages = useApi(() => (packagesFeature.allowed ? paymentsApi.packages() : Promise.resolve({ packages: [] })), [packagesFeature.allowed]);
  const clientPackages = useApi(() => paymentsApi.clientPackages(), []);

  const s = summary.data?.summary;
  const pending = useMemo(() => s?.by_status?.created?.count || 0, [s]);

  const [invoice, setInvoice] = useState(null);

  const savePackage = async (body) => {
    if (editing?.id) await paymentsApi.updatePackage(editing.id, body);
    else await paymentsApi.createPackage(body);
    toast.success(editing?.id ? 'Package updated' : 'Package created');
    setEditing(null);
    packages.reload({ silent: true });
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description={
          config.data
            ? `Gateway: ${config.data.gateway === 'demo' ? 'Demo (simulated Razorpay)' : config.data.gateway === 'razorpay' ? 'Razorpay test mode' : 'Not configured'} · GST ${config.data.gst_rate_percent}% added to client totals`
            : 'Track revenue, invoices and session packages.'
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.loading ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="card h-[104px] animate-pulse bg-slate-100" />)
        ) : (
          <>
            <StatCard label="Collected this month" value={formatINR(s?.this_month.gross)} hint={`${s?.this_month.count || 0} payments`} icon={IndianRupee} />
            <StatCard label="Net this month" value={formatINR(s?.this_month.net)} hint="After platform fee" icon={Wallet} tone="violet" />
            <StatCard label="Lifetime collected" value={formatINR(s?.lifetime.gross)} hint={`GST collected ${formatINR(s?.lifetime.tax)}`} icon={CreditCard} tone="blue" />
            <StatCard label="Awaiting payment" value={pending} hint={`Platform fees paid ${formatINR(s?.lifetime.fees)}`} icon={Receipt} tone="amber" />
          </>
        )}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'payments', label: 'Transactions', icon: Receipt },
          { value: 'packages', label: 'Packages', icon: Package },
          { value: 'credits', label: 'Client credits', icon: Wallet },
        ]}
      />

      {tab === 'payments' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-3">
            <p className="pl-1 text-sm font-medium text-slate-700">{payments.data?.payments.length ?? 0} transactions</p>
            <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="created">Pending</option>
              <option value="failed">Failed</option>
              <option value="refund_pending,refunded">Refunds</option>
            </Select>
          </div>
          {payments.error ? (
            <ErrorState error={payments.error} onRetry={payments.reload} />
          ) : payments.loading ? (
            <div className="p-4">
              <CardSkeleton rows={5} />
            </div>
          ) : (
            <PaymentsTable payments={payments.data.payments} onInvoice={setInvoice} />
          )}
          <InvoiceView payment={invoice} open={Boolean(invoice)} onClose={() => setInvoice(null)} requestPdf={paymentsApi.invoice} />
        </div>
      )}

      {tab === 'packages' &&
        (!packagesFeature.loading && !packagesFeature.allowed ? (
          <LockedFeature featureKey={FEATURES.PACKAGES} title="Session packages" description="Sell bundles of 3, 6 or 12 sessions at a custom rate. Clients prepay and book using credits." />
        ) : (
          <div>
            <div className="mb-4 flex justify-end">
              <Button icon={Plus} onClick={() => setEditing({})}>
                New package
              </Button>
            </div>
            {packages.loading ? (
              <CardSkeleton rows={3} />
            ) : packages.data.packages.length === 0 ? (
              <div className="card">
                <EmptyState icon={Package} title="No packages yet" description="Create a package that clients can buy from your profile and portal." />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {packages.data.packages.map((p) => (
                  <PackageCard
                    key={p.id}
                    pkg={p}
                    footer={
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <Badge tone={p.active ? 'green' : 'gray'} dot>
                          {p.active ? 'Visible' : 'Hidden'}
                        </Badge>
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(p)}>
                          Edit
                        </Button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ))}

      {tab === 'credits' && (
        <div className="card divide-y divide-slate-100">
          {clientPackages.loading ? (
            <div className="p-4">
              <CardSkeleton rows={4} />
            </div>
          ) : clientPackages.data.client_packages.length === 0 ? (
            <EmptyState compact icon={Wallet} title="No packages sold yet" />
          ) : (
            clientPackages.data.client_packages.map((cp) => (
              <div key={cp.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {cp.client?.name} · {cp.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    Purchased {fmtDate(cp.purchased_at)} · expires {fmtDate(cp.expires_at)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(cp.sessions_used / cp.sessions_total) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {cp.sessions_used}/{cp.sessions_total} used
                    </p>
                  </div>
                  <StatusBadge status={cp.status} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <PackageFormModal open={Boolean(editing)} initial={editing?.id ? editing : null} onClose={() => setEditing(null)} onSubmit={savePackage} config={config.data} />
    </div>
  );
}
