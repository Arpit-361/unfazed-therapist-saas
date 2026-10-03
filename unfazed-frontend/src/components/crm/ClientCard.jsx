import { Link } from 'react-router-dom';
import Avatar from '../common/Avatar';
import { StatusBadge } from '../common/Badge';
import { fmtDate } from '../../utils/format';

export default function ClientCard({ client }) {
  return (
    <Link to={`/dashboard/clients/${client.id}`} className="card flex items-center gap-3 p-4 transition hover:shadow-pop">
      <Avatar name={client.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium text-slate-900">{client.name}</p>
          <StatusBadge status={client.status} />
        </div>
        <p className="truncate text-xs text-slate-500">{client.email}</p>
        <p className="mt-1 text-xs text-slate-500">Last session: {client.last_session ? fmtDate(client.last_session) : '—'}</p>
      </div>
    </Link>
  );
}
