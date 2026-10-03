import { useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { StatusBadge } from '../common/Badge';
import { useToast } from '../../context/ToastContext';
import { saveBlobResponse } from '../../utils/download';
import { fmtDateTime, formatINR } from '../../utils/format';

function Row({ label, value, strong, muted }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2 text-sm ${strong ? 'font-semibold text-slate-900' : muted ? 'text-slate-500' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/**
 * Invoice summary for a payment plus the GST invoice PDF download.
 * `requestPdf` returns the blob request (therapist or portal endpoint); platform fee / net payout
 * rows only render when the payment object carries them, which the client-facing API never does.
 */
export default function InvoiceView({ payment, open, onClose, requestPdf, timezone }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  if (!payment) return null;

  const download = async () => {
    setDownloading(true);
    try {
      await saveBlobResponse(requestPdf(payment.id), `${payment.invoice_number}.pdf`);
    } catch (err) {
      toast.error('Download failed', err.message);
    } finally {
      setDownloading(false);
    }
  };

  const hasPayout = payment.platform_fee !== undefined && payment.net_amount !== undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Invoice ${payment.invoice_number}`}
      description={payment.client?.name ? `Billed to ${payment.client.name}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button icon={Download} loading={downloading} onClick={download}>
            Download PDF
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Receipt className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{payment.description}</p>
          <p className="text-xs text-slate-500">Paid {fmtDateTime(payment.paid_at, timezone)}</p>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        <Row label="Fee" value={formatINR(payment.base_amount)} />
        <Row label="GST" value={formatINR(payment.tax_amount)} />
        <Row label="Total paid" value={formatINR(payment.amount)} strong />
        {hasPayout && (
          <>
            <Row label="Platform fee" value={`− ${formatINR(payment.platform_fee)}`} muted />
            <Row label="Your net payout" value={formatINR(payment.net_amount)} strong />
          </>
        )}
      </div>

      <div className="mt-4 space-y-1 text-xs text-slate-500">
        <p>
          Payment reference: <span className="font-mono">{payment.gateway_transaction_id || '—'}</span>
        </p>
        <p>
          Gateway: {payment.gateway === 'demo' ? 'Demo gateway (simulated, no money moved)' : 'Razorpay'}
          {payment.webhook_confirmed && ' · confirmed by webhook'}
        </p>
      </div>
    </Modal>
  );
}
