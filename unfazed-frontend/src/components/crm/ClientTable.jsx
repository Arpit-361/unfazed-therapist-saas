import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import Avatar from '../common/Avatar';
import { StatusBadge } from '../common/Badge';
import ClientCard from './ClientCard';
import { fmtDate, fmtShortDate } from '../../utils/format';

const COLUMNS = [
  { key: 'name', label: 'Client', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'last_session', label: 'Last session', sortable: true },
  { key: 'next_session', label: 'Next session', sortable: true },
  { key: 'tags', label: 'Tags' },
  { key: 'onboarding', label: 'Onboarding' },
];

export default function ClientTable({ clients, sort, order, onSort }) {
  const navigate = useNavigate();

  const header = (col) => {
    if (!col.sortable) return col.label;
    const active = sort === col.key;
    const Icon = !active ? ChevronsUpDown : order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button className={`inline-flex items-center gap-1 ${active ? 'text-slate-900' : ''}`} onClick={() => onSort(col.key, active && order === 'asc' ? 'desc' : 'asc')}>
        {col.label} <Icon className="h-3.5 w-3.5" />
      </button>
    );
  };

  return (
    <>
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3">
                  {header(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id} onClick={() => navigate(`/dashboard/clients/${c.id}`)} className="cursor-pointer transition hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{c.name}</p>
                      <p className="truncate text-xs text-slate-500">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">{c.last_session ? fmtDate(c.last_session) : '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.next_session ? fmtShortDate(c.next_session) : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex max-w-[200px] flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {c.intake_completed && c.consent.given ? (
                    <span className="text-emerald-700">✓ Complete</span>
                  ) : (
                    <span className="text-amber-700">{!c.intake_completed ? 'Intake pending' : 'Consent pending'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {clients.map((c) => (
          <ClientCard key={c.id} client={c} />
        ))}
      </div>
    </>
  );
}
