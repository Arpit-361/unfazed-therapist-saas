import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, ClipboardList, CreditCard, Download, FileText, Mail, MessageSquare, Package, Phone, Send, ShieldCheck } from 'lucide-react';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Tabs from '../../components/common/Tabs';
import TagInput from '../../components/common/TagInput';
import StatCard from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/Badge';
import { Select } from '../../components/common/Field';
import { PageLoader } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import InviteLinkModal from '../../components/crm/InviteLinkModal';
import { BookForClientModal } from './Schedule';
import { clientsApi, paymentsApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useEntitlementContext } from '../../context/EntitlementContext';
import { saveBlobResponse } from '../../utils/download';
import { fmtDate, fmtDateTime, formatINR } from '../../utils/format';

function InfoRow({ label, value }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-800 sm:col-span-2 sm:mt-0">{value || '—'}</dd>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const entitlements = useEntitlementContext();
  const { data, loading, error, reload, setData } = useApi(() => clientsApi.get(id), [id]);
  const [tab, setTab] = useState('overview');
  const [invite, setInvite] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} title={error.status === 404 ? 'Client not found' : undefined} />;

  const { client, sessions, payments, notes, packages, summary } = data;

  const update = async (body) => {
    try {
      const res = await clientsApi.update(client.id, body);
      setData({ ...data, client: res.client });
      entitlements?.refresh();
      toast.success('Client updated');
    } catch (err) {
      if (err.code !== 'UPGRADE_REQUIRED') toast.error('Could not update client', err.message);
    }
  };

  const resendInvite = async () => {
    try {
      const res = await clientsApi.resendInvite(client.id);
      setInvite(res.invite_url);
    } catch (err) {
      toast.error('Could not send invite', err.message);
    }
  };

  const intake = client.intake || {};
  const demo = intake.demographics || {};
  const history = intake.history || {};

  return (
    <div>
      <Link to="/dashboard/clients" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      <div className="card mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-4">
            <Avatar name={client.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
                <StatusBadge status={client.status} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {client.email}
                </span>
                {client.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {client.phone}
                  </span>
                )}
                <span>Client since {fmtDate(client.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={CalendarPlus} onClick={() => setBookOpen(true)}>
              Book session
            </Button>
            <Button size="sm" variant="secondary" icon={MessageSquare} onClick={() => navigate(`/dashboard/messages?client=${client.id}`)}>
              Message
            </Button>
            <Button size="sm" variant="secondary" icon={FileText} onClick={() => navigate(`/dashboard/notes?client=${client.id}`)}>
              New note
            </Button>
            {!client.portal_access && (
              <Button size="sm" variant="ghost" icon={Send} onClick={resendInvite}>
                Resend invite
              </Button>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-[1fr_200px]">
          <div>
            <p className="label">Tags</p>
            <TagInput value={client.tags} onChange={(tags) => update({ tags })} />
          </div>
          <div>
            <p className="label">Status</p>
            <Select value={client.status === 'invited' ? 'invited' : client.status} onChange={(e) => update({ status: e.target.value })} disabled={client.status === 'invited'}>
              {client.status === 'invited' && <option value="invited">Invited</option>}
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Completed sessions" value={summary.completed_sessions} />
        <StatCard label="Upcoming" value={summary.upcoming_sessions} tone="blue" />
        <StatCard label="No-shows" value={summary.no_shows} tone="rose" />
        <StatCard label="Total paid" value={formatINR(summary.total_paid)} tone="violet" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Intake & consent', icon: ClipboardList },
          { value: 'sessions', label: 'Sessions', icon: CalendarPlus, count: sessions.length },
          { value: 'payments', label: 'Payments', icon: CreditCard, count: payments.length },
          { value: 'notes', label: 'Notes', icon: FileText, count: notes.length },
          { value: 'packages', label: 'Packages', icon: Package, count: packages.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold text-slate-900">Intake form</h3>
            {client.intake_completed ? (
              <dl className="mt-2 divide-y divide-slate-100">
                <InfoRow label="Submitted" value={fmtDateTime(intake.submitted_at)} />
                <InfoRow label="Presenting concern" value={intake.presenting_concern} />
                <InfoRow label="Goals" value={intake.goals} />
                <InfoRow label="Date of birth" value={demo.date_of_birth} />
                <InfoRow label="Gender" value={demo.gender} />
                <InfoRow label="Occupation" value={demo.occupation} />
                <InfoRow label="City" value={demo.city} />
                <InfoRow label="Emergency contact" value={[demo.emergency_contact_name, demo.emergency_contact_phone].filter(Boolean).join(' · ')} />
                <InfoRow label="Previous therapy" value={history.previous_therapy} />
                <InfoRow label="Medications" value={history.medications} />
                <InfoRow label="Medical conditions" value={history.medical_conditions} />
                <InfoRow label="Family history" value={history.family_history} />
              </dl>
            ) : (
              <EmptyState compact icon={ClipboardList} title="Intake not completed yet" description="The client completes intake from their portal before their first session." />
            )}
          </div>
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Consent record
            </h3>
            {client.consent_records.length ? (
              <ul className="mt-3 space-y-3">
                {client.consent_records.map((r, i) => (
                  <li key={i} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">Version {r.version} · accepted</p>
                    <p className="mt-1">{fmtDateTime(r.accepted_at)}</p>
                    <p className="mt-1 text-slate-400">IP {r.ip_address || '—'}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-amber-700">Consent has not been given yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="card divide-y divide-slate-100">
          {sessions.length === 0 && <EmptyState compact title="No sessions yet" />}
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{fmtDateTime(s.start_time)}</p>
                <p className="text-xs text-slate-500">
                  {s.service_title} · {s.duration_minutes} min · {formatINR(s.price)}
                </p>
              </div>
              <div className="flex gap-2">
                <StatusBadge status={s.status} />
                <StatusBadge status={s.payment_status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card divide-y divide-slate-100">
          {payments.length === 0 && <EmptyState compact title="No payments yet" />}
          {payments.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{p.description}</p>
                <p className="text-xs text-slate-500">
                  {fmtDate(p.paid_at || p.created_at)} · {p.invoice_number || 'No invoice'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{formatINR(p.amount)}</span>
                <StatusBadge status={p.status} />
                {p.invoice_number && (
                  <Button size="icon" variant="ghost" onClick={() => saveBlobResponse(paymentsApi.invoice(p.id)).catch((e) => toast.error('Download failed', e.message))} aria-label="Download invoice">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3">
          {notes.length === 0 && (
            <div className="card">
              <EmptyState compact icon={FileText} title="No notes yet" action={<Button size="sm" onClick={() => navigate(`/dashboard/notes?client=${client.id}`)}>Write a note</Button>} />
            </div>
          )}
          {notes.map((n) => (
            <Link key={n.id} to={`/dashboard/notes?note=${n.id}`} className="card block p-4 transition hover:shadow-pop">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{n.title || 'Untitled note'}</p>
                <div className="flex gap-2">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs uppercase text-slate-600">{n.format}</span>
                  <StatusBadge status={n.type} />
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">{fmtDateTime(n.created_at)}</p>
            </Link>
          ))}
        </div>
      )}

      {tab === 'packages' && (
        <div className="card divide-y divide-slate-100">
          {packages.length === 0 && <EmptyState compact icon={Package} title="No packages purchased" />}
          {packages.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.sessions_used}/{p.sessions_total} used · expires {fmtDate(p.expires_at)}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </div>
      )}

      <InviteLinkModal open={Boolean(invite)} onClose={() => setInvite(null)} inviteUrl={invite} clientName={client.name} />
      <BookForClientModal open={bookOpen} onClose={() => setBookOpen(false)} presetClientId={client.id} onBooked={() => reload({ silent: true })} />
    </div>
  );
}
