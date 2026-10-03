const TONES = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
};

export default function Badge({ tone = 'gray', children, className = '', dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_MAP = {
  // sessions
  confirmed: ['blue', 'Confirmed'],
  pending_payment: ['amber', 'Awaiting payment'],
  completed: ['green', 'Completed'],
  cancelled: ['gray', 'Cancelled'],
  no_show: ['red', 'No-show'],
  // payments
  paid: ['green', 'Paid'],
  created: ['amber', 'Pending'],
  failed: ['red', 'Failed'],
  refund_pending: ['violet', 'Refund pending'],
  refunded: ['gray', 'Refunded'],
  unpaid: ['amber', 'Unpaid'],
  package: ['brand', 'Package'],
  waived: ['gray', 'Waived'],
  // clients
  active: ['green', 'Active'],
  invited: ['blue', 'Invited'],
  inactive: ['gray', 'Inactive'],
  archived: ['gray', 'Archived'],
  // leads
  new: ['blue', 'New'],
  contacted: ['amber', 'Contacted'],
  converted: ['green', 'Converted'],
  closed: ['gray', 'Closed'],
  // packages
  exhausted: ['gray', 'Used up'],
  expired: ['red', 'Expired'],
  // notes
  private: ['violet', 'Private'],
  shared: ['brand', 'Shared with client'],
};

export function StatusBadge({ status, className }) {
  const [tone, label] = STATUS_MAP[status] || ['gray', status];
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}
