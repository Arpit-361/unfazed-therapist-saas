import { useState } from 'react';
import { CreditCard, FlaskConical, Lock, ShieldCheck, XCircle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { portalApi } from '../../api/endpoints';
import { formatINR, fmtTime } from '../../utils/format';

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Checkout for a payment order created by the backend.
 * - gateway "razorpay": opens Razorpay Checkout (test mode); the signed response is verified server-side.
 * - gateway "demo": DEMO_MODE simulation; the server signs and verifies a simulated gateway response.
 * onResult(payment) is called with the final payment (status "paid" or "failed").
 */
export default function CheckoutForm({ checkout, open, onClose, onResult, holdExpiresAt }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  if (!checkout) return null;
  const { breakdown } = checkout;

  const finish = (payment) => {
    setBusy(null);
    onResult(payment);
  };

  const payRazorpay = async () => {
    setError(null);
    setBusy('pay');
    const ok = await loadRazorpay();
    if (!ok) {
      setBusy(null);
      return setError('Could not load Razorpay Checkout. Check your connection and try again.');
    }
    const rzp = new window.Razorpay({
      key: checkout.key_id,
      amount: checkout.amount,
      currency: checkout.currency,
      order_id: checkout.order_id,
      name: 'Unfazed',
      description: checkout.description,
      prefill: checkout.prefill,
      theme: { color: '#0d9488' },
      handler: async (response) => {
        try {
          const res = await portalApi.verifyPayment(response);
          finish(res.payment);
        } catch (err) {
          setBusy(null);
          setError(err.message);
        }
      },
      modal: { ondismiss: () => setBusy(null) },
    });
    rzp.on('payment.failed', (resp) => {
      setBusy(null);
      setError(resp.error?.description || 'Payment failed. You can try again.');
    });
    rzp.open();
  };

  const simulate = async (outcome) => {
    setError(null);
    setBusy(outcome);
    try {
      const res = await portalApi.demoComplete(checkout.payment_id, outcome);
      finish(res.payment);
    } catch (err) {
      setBusy(null);
      setError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Complete payment" description={checkout.description}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>Fee</dt>
            <dd>{formatINR(breakdown.base_amount)}</dd>
          </div>
          <div className="flex justify-between text-slate-600">
            <dt>GST ({breakdown.tax_rate_percent}%)</dt>
            <dd>{formatINR(breakdown.tax_amount)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <dt>Total</dt>
            <dd>{formatINR(checkout.amount)}</dd>
          </div>
        </dl>
      </div>

      {holdExpiresAt && (
        <p className="mt-3 text-xs text-amber-700">Your slot is held until {fmtTime(holdExpiresAt)}. Complete payment before then to confirm it.</p>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {checkout.gateway === 'razorpay' ? (
        <Button className="mt-5 w-full" size="lg" icon={CreditCard} loading={busy === 'pay'} onClick={payRazorpay}>
          Pay {formatINR(checkout.amount)}
        </Button>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
            <FlaskConical className="h-4 w-4" /> Demo payment gateway
          </p>
          <p className="mt-1 text-xs text-violet-800">
            Razorpay keys aren't configured, so this server simulates the gateway. No money moves; the simulated response is still HMAC-signed and verified by the server.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button icon={ShieldCheck} loading={busy === 'success'} disabled={Boolean(busy)} onClick={() => simulate('success')}>
              Pay {formatINR(checkout.amount)}
            </Button>
            <Button variant="secondary" loading={busy === 'failure'} disabled={Boolean(busy)} onClick={() => simulate('failure')}>
              Simulate failure
            </Button>
          </div>
        </div>
      )}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <Lock className="h-3 w-3" /> Payments are confirmed server-side. A GST invoice is emailed after payment.
      </p>
    </Modal>
  );
}
