import { Package as PackageIcon } from 'lucide-react';
import Button from '../common/Button';
import { formatINR } from '../../utils/format';

export default function PackageCard({ pkg, onAction, actionLabel = 'Buy package', loading, footer, highlight }) {
  const fullPrice = pkg.total_price;
  return (
    <div className={`card flex flex-col p-5 ${highlight ? 'ring-2 ring-brand-500' : ''}`}>
      <div className="flex items-center gap-2 text-brand-700">
        <PackageIcon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{pkg.session_count} sessions</span>
      </div>
      <h3 className="mt-2 font-semibold text-slate-900">{pkg.name}</h3>
      {pkg.description && <p className="mt-1 text-sm text-slate-500">{pkg.description}</p>}
      <p className="mt-4 text-2xl font-bold text-slate-900">{formatINR(fullPrice)}</p>
      <p className="text-xs text-slate-500">
        {formatINR(pkg.per_session_rate)} per {pkg.duration_minutes}-min session · valid {pkg.validity_days} days
      </p>
      {footer}
      {onAction && (
        <Button className="mt-4" onClick={() => onAction(pkg)} loading={loading}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
