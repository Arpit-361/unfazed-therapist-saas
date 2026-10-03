import { useEffect, useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { entitlementsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { formatINR } from '../../utils/format';

/** Shown whenever a blocked action is attempted (opened by API 403s or useEntitlement). */
export default function UpgradePrompt({ open, detail, onClose, onUpgraded }) {
  const toast = useToast();
  const [tiers, setTiers] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (open && !tiers.length) entitlementsApi.tiers().then((r) => setTiers(r.tiers)).catch(() => {});
  }, [open, tiers.length]);

  const suggested = detail?.upgradeTo?.key;
  const currentKey = detail?.tier?.key;
  const currentOrder = tiers.find((t) => t.key === currentKey)?.sort_order ?? 0;
  const options = tiers.filter((t) => t.sort_order > currentOrder);

  const upgrade = async (tier) => {
    setBusy(tier.key);
    try {
      await entitlementsApi.changeTier(tier.key);
      toast.success(`You're now on ${tier.name}`, 'Plan billing is simulated in this demo.');
      await onUpgraded?.();
    } catch (err) {
      toast.error('Could not change plan', err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Upgrade to unlock this feature">
      <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
        <Lock className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{detail?.label || 'This feature'} isn't available on your current plan</p>
          {detail?.message && <p className="mt-0.5 text-sm text-amber-800">{detail.message}</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((tier) => (
          <div key={tier.key} className={`relative rounded-2xl border p-5 ${tier.key === suggested ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-slate-200'}`}>
            {tier.key === suggested && (
              <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                <Sparkles className="h-3 w-3" /> Recommended
              </span>
            )}
            <p className="font-semibold text-slate-900">{tier.name}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatINR(tier.monthly_price)}
              <span className="text-sm font-normal text-slate-500">/month</span>
            </p>
            <ul className="mt-3 space-y-1.5">
              {tier.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-sm text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {h}
                </li>
              ))}
            </ul>
            <Button className="mt-4 w-full" variant={tier.key === suggested ? 'primary' : 'secondary'} loading={busy === tier.key} onClick={() => upgrade(tier)}>
              Switch to {tier.name}
            </Button>
          </div>
        ))}
        {!options.length && <p className="text-sm text-slate-500">You're already on the highest plan.</p>}
      </div>
      <p className="mt-4 text-xs text-slate-400">Demo: plan changes apply instantly and no card is charged.</p>
    </Modal>
  );
}
