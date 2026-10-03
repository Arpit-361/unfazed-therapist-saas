import { Clock } from 'lucide-react';
import { formatINR } from '../../utils/format';
import Button from '../common/Button';

export default function ServiceCard({ service, onBook }) {
  return (
    <div className="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{service.title}</h3>
        <span className="shrink-0 text-lg font-bold text-slate-900">{formatINR(service.price)}</span>
      </div>
      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
        <Clock className="h-4 w-4" /> {service.duration_minutes} minutes · Online
      </p>
      {service.description && <p className="mt-3 flex-1 text-sm text-slate-600">{service.description}</p>}
      {onBook && (
        <Button variant="soft" size="sm" className="mt-4 self-start" onClick={() => onBook(service)}>
          Book this session
        </Button>
      )}
    </div>
  );
}
