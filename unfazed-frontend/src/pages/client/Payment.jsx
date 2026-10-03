import { useState } from 'react';
import { Download, Package, Receipt } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import PackageCard from '../../components/payments/PackageCard';
import CheckoutForm from '../../components/payments/CheckoutForm';
import { portalApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import { usePortal } from '../../components/layout/PortalLayout';
import { saveBlobResponse } from '../../utils/download';
import { fmtDate, formatINR } from '../../utils/format';

export default function Payment() {
  const toast = useToast();
  const { client } = usePortal();
  const packages = useApi(() => portalApi.packages(), []);
  const payments = useApi(() => portalApi.payments(), []);
  const [checkout, setCheckout] = useState(null);
  const [busy, setBusy] = useState(null);

  const buy = async (pkg) => {
    setBusy(pkg.id);
    try {
      const res = await portalApi.purchasePackage(pkg.id);
      setCheckout(res.checkout);
    } catch (err) {
      toast.error('Could not start purchase', err.message);
    } finally {
      setBusy(null);
    }
  };

  const retry = async (p) => {
    setBusy(p.id);
    try {
      const res = await portalApi.retryCheckout(p.id);
      setCheckout(res.checkout);
    } catch (err) {
      toast.error('Could not start payment', err.message);
    } finally {
      setBusy(null);
    }
  };

  const mine = packages.data?.my_packages || [];

  return (
    <div className="space-y-8">
      <PageHeader title="Payments & packages" description="Prices are shown before GST. GST is added at checkout and itemised on your invoice." />

      {packages.data?.enabled && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Session packages</h2>
          {packages.loading ? (
            <CardSkeleton rows={2} />
          ) : packages.data.packages.length === 0 ? (
            <div className="card">
              <EmptyState compact icon={Package} title="No packages offered right now" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.data.packages.map((p, i) => (
                <PackageCard key={p.id} pkg={p} highlight={i === 1} onAction={buy} loading={busy === p.id} />
              ))}
            </div>
          )}
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Your packages</h2>
          <div className="card divide-y divide-slate-100">
            {mine.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.sessions_remaining} of {p.sessions_total} sessions left · expires {fmtDate(p.expires_at, client.timezone)}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Payment history</h2>
        {payments.error ? (
          <ErrorState error={payments.error} onRetry={payments.reload} />
        ) : payments.loading ? (
          <CardSkeleton rows={3} />
        ) : payments.data.payments.length === 0 ? (
          <div className="card">
            <EmptyState compact icon={Receipt} title="No payments yet" />
          </div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {payments.data.payments.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{p.description}</p>
                  <p className="text-xs text-slate-500">
                    {fmtDate(p.paid_at || p.created_at, client.timezone)}
                    {p.invoice_number && ` · ${p.invoice_number}`} · incl. GST {formatINR(p.tax_amount)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatINR(p.amount)}</span>
                  <StatusBadge status={p.status} />
                  {p.invoice_number && (
                    <Button size="sm" variant="ghost" icon={Download} onClick={() => saveBlobResponse(portalApi.invoice(p.id), `${p.invoice_number}.pdf`).catch((e) => toast.error('Download failed', e.message))}>
                      Invoice
                    </Button>
                  )}
                  {p.purpose === 'package' && ['created', 'failed'].includes(p.status) && (
                    <Button size="sm" loading={busy === p.id} onClick={() => retry(p)}>
                      Pay
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CheckoutForm
        open={Boolean(checkout)}
        checkout={checkout}
        onClose={() => {
          setCheckout(null);
          payments.reload({ silent: true });
        }}
        onResult={(payment) => {
          setCheckout(null);
          if (payment.status === 'paid') toast.success('Payment successful', 'Your credits are ready to use. Invoice sent to your email.');
          else toast.error('Payment failed', 'You can retry from your payment history.');
          payments.reload({ silent: true });
          packages.reload({ silent: true });
        }}
      />
    </div>
  );
}
