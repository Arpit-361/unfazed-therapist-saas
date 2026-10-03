import { Lock } from 'lucide-react';
import Button from '../common/Button';
import useEntitlement from '../../hooks/useEntitlement';

/** Inline locked-state card with an upgrade call to action. */
export default function LockedFeature({ featureKey, title, description, children }) {
  const { openUpgrade, info } = useEntitlement(featureKey);
  return (
    <div className="card relative overflow-hidden">
      {children && <div className="pointer-events-none select-none p-5 opacity-40 blur-[3px]">{children}</div>}
      <div className={`${children ? 'absolute inset-0' : ''} flex flex-col items-center justify-center bg-white/60 p-8 text-center`}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-slate-600">{description || info?.message}</p>
        <Button className="mt-4" onClick={openUpgrade}>
          {info?.upgradeTo ? `Upgrade to ${info.upgradeTo.name}` : 'View plans'}
        </Button>
      </div>
    </div>
  );
}
