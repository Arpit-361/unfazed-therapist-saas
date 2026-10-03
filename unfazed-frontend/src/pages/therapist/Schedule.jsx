import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { CalendarDays, CalendarPlus, Clock, FileText, ListChecks, MessageSquare, SlidersHorizontal } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Tabs from '../../components/common/Tabs';
import Modal from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/Badge';
import { Field, Input, Select } from '../../components/common/Field';
import { PageLoader } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import Calendar from '../../components/scheduling/Calendar';
import AvailabilityEditor from '../../components/scheduling/AvailabilityEditor';
import LockedFeature from '../../components/entitlements/LockedFeature';
import { clientsApi, schedulingApi, therapistApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import useApi from '../../hooks/useApi';
import useEntitlement, { FEATURES } from '../../hooks/useEntitlement';
import { fmtDateTime, fmtTime, formatINR } from '../../utils/format';

function rangeFor(date, view) {
  if (view === 'month') return [addDays(startOfMonth(date), -7), addDays(endOfMonth(date), 7)];
  if (view === 'week') return [startOfWeek(date, { weekStartsOn: 1 }), endOfWeek(date, { weekStartsOn: 1 })];
  if (view === 'day') return [addDays(date, -1), addDays(date, 1)];
  return [date, addDays(date, 30)];
}

function SessionModal({ session, onClose, onChanged }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  if (!session) return null;
  const started = new Date(session.start_time) <= new Date();
  const canMark = started && ['confirmed', 'completed', 'no_show'].includes(session.status);
  const canCancel = !started && ['confirmed', 'pending_payment'].includes(session.status);

  const update = async (status) => {
    setBusy(status);
    try {
      const res = await schedulingApi.updateStatus(session.id, { status });
      toast.success('Session updated', `Marked as ${status.replace('_', ' ')}`);
      onChanged(res.session);
    } catch (err) {
      toast.error('Could not update session', err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={session.client?.name || 'Session'} description={session.service_title}>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={session.status} />
          <StatusBadge status={session.payment_status} />
        </div>
        <p className="flex items-center gap-2 text-slate-700">
          <Clock className="h-4 w-4 text-slate-400" /> {fmtDateTime(session.start_time)} · {session.duration_minutes} min
        </p>
        <p className="text-slate-500">Price: {formatINR(session.price)} · Booked by {session.booked_by}</p>
        {session.status === 'pending_payment' && <p className="rounded-lg bg-amber-50 p-2 text-amber-800">Slot is held until {fmtTime(session.hold_expires_at)} while the client completes payment.</p>}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {canMark && session.status !== 'completed' && (
          <Button size="sm" onClick={() => update('completed')} loading={busy === 'completed'}>
            Mark completed
          </Button>
        )}
        {canMark && session.status !== 'no_show' && (
          <Button size="sm" variant="secondary" onClick={() => update('no_show')} loading={busy === 'no_show'}>
            Mark no-show
          </Button>
        )}
        {canCancel && (
          <Button size="sm" variant="danger" onClick={() => update('cancelled')} loading={busy === 'cancelled'}>
            Cancel session
          </Button>
        )}
        <Button size="sm" variant="soft" icon={FileText} onClick={() => navigate(`/dashboard/notes?client=${session.client_id}&session=${session.id}`)}>
          Write note
        </Button>
        <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => navigate(`/dashboard/messages?client=${session.client_id}`)}>
          Message
        </Button>
        <Button size="sm" variant="ghost" to={`/dashboard/clients/${session.client_id}`}>
          View client
        </Button>
      </div>
    </Modal>
  );
}

export function BookForClientModal({ open, onClose, onBooked, presetClientId }) {
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [tz, setTz] = useState('Asia/Kolkata');
  const [form, setForm] = useState({ client_id: presetClientId || '', service_id: '', date: '', payment_mode: 'unpaid' });
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([clientsApi.list({ status: 'active,invited' }), therapistApi.me()])
      .then(([c, t]) => {
        setClients(c.clients);
        setServices(t.therapist.services);
        setTz(t.therapist.timezone);
        setForm((f) => ({
          ...f,
          client_id: presetClientId || f.client_id,
          service_id: f.service_id || t.therapist.services[0]?.id || '',
          date: f.date || formatInTimeZone(new Date(), t.therapist.timezone, 'yyyy-MM-dd'),
        }));
      })
      .catch((err) => toast.error('Could not load data', err.message));
  }, [open, presetClientId, toast]);

  const service = services.find((s) => s.id === form.service_id);

  useEffect(() => {
    if (!open || !form.date || !service) return;
    setLoadingSlots(true);
    setSlot(null);
    const from = fromZonedTime(`${form.date}T00:00:00`, tz);
    schedulingApi
      .slots({ from: from.toISOString(), to: addDays(from, 1).toISOString(), duration: service.duration_minutes })
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [open, form.date, service, tz]);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await schedulingApi.createSession({ client_id: form.client_id, service_id: form.service_id, start_time: slot.start, payment_mode: form.payment_mode });
      toast.success('Session booked', `${res.session.client?.name} · ${fmtDateTime(res.session.start_time)}`);
      onBooked(res.session);
      onClose();
    } catch (err) {
      toast.error('Could not book session', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Book a session for a client"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!slot || !form.client_id} loading={saving}>
            Book session
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client">
          <Select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.intake_completed || !c.consent.given ? ' (intake pending)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Service">
          <Select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} · {s.duration_minutes} min
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Date (${tz})`}>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Payment">
          <Select value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
            <option value="unpaid">Collect later (unpaid)</option>
            <option value="package">Use client's package credit</option>
            <option value="waived">Waive fee</option>
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <p className="label">Available times</p>
        {loadingSlots ? (
          <p className="text-sm text-slate-500">Loading slots...</p>
        ) : slots.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No open slots on this day.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.start}
                onClick={() => setSlot(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${slot?.start === s.start ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 hover:border-brand-400'}`}
              >
                {formatInTimeZone(new Date(s.start), tz, 'h:mm a')}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function WaitlistTab() {
  const { allowed } = useEntitlement(FEATURES.WAITLIST);
  const { data, loading, error, reload } = useApi(() => schedulingApi.waitlist(), []);
  if (!allowed) return <LockedFeature featureKey={FEATURES.WAITLIST} title="Waitlist" description="Let clients join a waitlist for fully booked days and get notified automatically when a slot opens." />;
  if (loading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.waitlist.length) return <div className="card"><EmptyState icon={ListChecks} title="No one is waiting" description="Clients can join the waitlist from the booking page when a day is full." /></div>;
  return (
    <div className="card divide-y divide-slate-100">
      {data.waitlist.map((w) => (
        <div key={w.id} className="flex items-center justify-between p-4 text-sm">
          <div>
            <p className="font-medium text-slate-900">{w.client?.name}</p>
            <p className="text-slate-500">Waiting for {new Date(`${w.date}T12:00:00Z`).toDateString()}</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${w.status === 'notified' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {w.status === 'notified' ? 'Notified' : 'Waiting'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Schedule() {
  const { socket } = useSocket();
  const [tab, setTab] = useState('calendar');
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(() => (window.matchMedia('(max-width: 639px)').matches ? 'day' : 'week'));
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);
  const availability = useApi(() => schedulingApi.availability(), []);

  const [from, to] = useMemo(() => rangeFor(date, view), [date, view]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await schedulingApi.sessions({ from: from.toISOString(), to: to.toISOString() });
      setSessions(res.sessions);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNotification = (n) => ['booking.confirmed', 'session.cancelled', 'payment.received'].includes(n.type) && load();
    socket.on('notification:new', onNotification);
    return () => socket.off('notification:new', onNotification);
  }, [socket, load]);

  const events = useMemo(() => {
    const list = sessions.map((s) => ({
      id: s.id,
      title: `${s.client?.name || 'Client'} · ${s.service_title}`,
      start: new Date(s.start_time),
      end: new Date(s.end_time),
      status: s.status,
      session: s,
    }));
    for (const b of availability.data?.availability?.blocked_slots || []) {
      list.push({ id: b._id, title: b.reason || 'Blocked', start: new Date(b.start), end: new Date(b.end), status: 'blocked' });
    }
    return list;
  }, [sessions, availability.data]);

  const upsert = (session) => {
    setSessions((list) => (list.some((s) => s.id === session.id) ? list.map((s) => (s.id === session.id ? session : s)) : [...list, session]));
    setSelected(null);
  };

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="Your sessions, availability and waitlist."
        actions={
          <>
            <Button variant="secondary" to="/dashboard/settings" className="max-sm:hidden">
              Services & prices
            </Button>
            <Button icon={CalendarPlus} onClick={() => setBookOpen(true)}>
              Book for client
            </Button>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'calendar', label: 'Calendar', icon: CalendarDays },
          { value: 'availability', label: 'Availability', icon: SlidersHorizontal },
          { value: 'waitlist', label: 'Waitlist', icon: ListChecks },
        ]}
      />

      {tab === 'calendar' &&
        (error ? (
          <ErrorState error={error} onRetry={load} />
        ) : loading ? (
          <PageLoader />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
              {[
                ['bg-brand-600', 'Confirmed'],
                ['bg-amber-200', 'Awaiting payment'],
                ['bg-emerald-200', 'Completed'],
                ['bg-rose-200', 'No-show'],
                ['bg-slate-200', 'Blocked / cancelled'],
              ].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded ${c}`} /> {l}
                </span>
              ))}
            </div>
            <Calendar events={events} date={date} view={view} onNavigate={setDate} onView={setView} onSelectEvent={(e) => e.session && setSelected(e.session)} />
          </>
        ))}

      {tab === 'availability' &&
        (availability.loading ? (
          <PageLoader />
        ) : availability.error ? (
          <ErrorState error={availability.error} onRetry={availability.reload} />
        ) : (
          <AvailabilityEditor availability={availability.data.availability} onSaved={(a) => availability.setData({ availability: a })} />
        ))}

      {tab === 'waitlist' && <WaitlistTab />}

      <SessionModal session={selected} onClose={() => setSelected(null)} onChanged={upsert} />
      <BookForClientModal open={bookOpen} onClose={() => setBookOpen(false)} onBooked={upsert} />
      <p className="mt-4 text-xs text-slate-400">
        Need to share your booking link? <Link to="/dashboard" className="font-medium text-brand-700">Copy it from the dashboard</Link>.
      </p>
    </div>
  );
}
