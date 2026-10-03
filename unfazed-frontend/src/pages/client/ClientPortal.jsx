import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Circle, Clock, CreditCard, MessageSquare, Package, Video } from 'lucide-react';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Tabs from '../../components/common/Tabs';
import { StatusBadge } from '../../components/common/Badge';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import CheckoutForm from '../../components/payments/CheckoutForm';
import { usePortal } from '../../components/layout/PortalLayout';
import { portalApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import { firstName, fmtDateTime, fmtTime, formatINR, tzAbbrev } from '../../utils/format';

function OnboardingChecklist({ client }) {
  const steps = [
    { done: true, label: 'Create your portal account' },
    { done: client.intake_completed, label: 'Complete your intake form' },
    { done: client.consent.given, label: 'Review and accept informed consent' },
  ];
  return (
    <div className="card border-amber-200 bg-amber-50/50 p-5">
      <h3 className="font-semibold text-slate-900">Finish setting up before your first session</h3>
      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className={`flex items-center gap-2 text-sm ${s.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
            {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-amber-500" />}
            {s.label}
          </li>
        ))}
      </ul>
      <Button className="mt-4" to="/portal/onboarding">
        Continue setup
      </Button>
    </div>
  );
}

export default function ClientPortal() {
  const toast = useToast();
  const { client, therapist, features, onboarded } = usePortal();
  const sessions = useApi(() => portalApi.sessions(), []);
  const packages = useApi(() => portalApi.packages(), []);
  const [tab, setTab] = useState('upcoming');
  const [checkout, setCheckout] = useState(null);
  const [busy, setBusy] = useState(null);
  const tz = client.timezone;

  const now = new Date();
  const all = sessions.data?.sessions || [];
  const upcoming = all.filter((s) => new Date(s.start_time) > now && ['confirmed', 'pending_payment'].includes(s.status)).reverse();
  const past = all.filter((s) => !upcoming.includes(s));
  const credits = (packages.data?.my_packages || []).filter((p) => p.status === 'active' && p.sessions_remaining > 0);

  const cancel = async (s) => {
    if (!window.confirm(`Cancel your session on ${fmtDateTime(s.start_time, tz)}?`)) return;
    setBusy(s.id);
    try {
      await portalApi.cancel(s.id);
      toast.success('Session cancelled', s.payment_status === 'package' ? 'Your package credit has been restored.' : s.payment_status === 'paid' ? 'Your refund will be processed by your therapist.' : undefined);
      sessions.reload({ silent: true });
      packages.reload({ silent: true });
    } catch (err) {
      toast.error('Could not cancel', err.message);
    } finally {
      setBusy(null);
    }
  };

  const pay = async (s) => {
    setBusy(s.id);
    try {
      const res = await portalApi.retryCheckout(s.payment_id);
      setCheckout({ ...res.checkout, holdExpiresAt: s.hold_expires_at });
    } catch (err) {
      toast.error('Could not start payment', err.message);
      sessions.reload({ silent: true });
    } finally {
      setBusy(null);
    }
  };

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-6">
      <div className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={therapist.name} src={therapist.photo_url} size="lg" />
        <div className="flex-1">
          <p className="text-sm text-slate-500">Welcome back, {firstName(client.name)}</p>
          <h1 className="text-xl font-bold text-slate-900">Your care with {therapist.name}</h1>
          <p className="text-sm text-slate-500">
            {therapist.title} · times shown in {tz} ({tzAbbrev(tz)})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={CalendarPlus} to="/portal/book">
            Book a session
          </Button>
          {features.chat && (
            <Button variant="secondary" icon={MessageSquare} to="/portal/messages">
              Message
            </Button>
          )}
        </div>
      </div>

      {!onboarded && <OnboardingChecklist client={client} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
              { value: 'past', label: 'Past & cancelled', count: past.length },
            ]}
          />
          {sessions.error ? (
            <ErrorState error={sessions.error} onRetry={sessions.reload} />
          ) : sessions.loading ? (
            <CardSkeleton rows={3} />
          ) : list.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={CalendarPlus}
                title={tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions yet'}
                action={tab === 'upcoming' && <Button to="/portal/book">Book a session</Button>}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((s) => (
                <div key={s.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{fmtDateTime(s.start_time, tz)}</p>
                      <p className="text-xs text-slate-500">
                        {s.service_title} · {s.duration_minutes} min · {s.payment_status === 'package' ? 'Package credit' : formatINR(s.price)}
                      </p>
                      {s.status === 'pending_payment' && s.hold_expires_at && (
                        <p className="mt-1 text-xs font-medium text-amber-700">Slot held until {fmtTime(s.hold_expires_at, tz)} - complete payment to confirm.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={s.status} />
                    {s.status === 'confirmed' && s.meeting_link && tab === 'upcoming' && (
                      <Button size="sm" variant="soft" icon={Video} href={s.meeting_link} target="_blank" rel="noreferrer">
                        Join
                      </Button>
                    )}
                    {s.status === 'pending_payment' && s.payment_id && (
                      <Button size="sm" icon={CreditCard} loading={busy === s.id} onClick={() => pay(s)}>
                        Pay now
                      </Button>
                    )}
                    {tab === 'upcoming' && (
                      <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => cancel(s)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <Package className="h-4 w-4 text-brand-600" /> Session credits
            </h3>
            {packages.loading ? (
              <div className="mt-3 h-16 animate-pulse rounded-xl bg-slate-100" />
            ) : credits.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No active packages.{' '}
                {packages.data?.enabled && (
                  <Link to="/portal/payments" className="font-medium text-brand-700">
                    Save with a package →
                  </Link>
                )}
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {credits.map((p) => (
                  <li key={p.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-800">{p.name}</span>
                      <span className="text-slate-600">{p.sessions_remaining} left</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(p.sessions_remaining / p.sessions_total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900">Your privacy</h3>
            <p className="mt-1 text-sm text-slate-500">Your therapist's private clinical notes stay private. You'll only see notes they choose to share with you.</p>
            <Button className="mt-3" size="sm" variant="secondary" to="/portal/notes">
              Shared notes
            </Button>
          </div>
        </div>
      </div>

      <CheckoutForm
        open={Boolean(checkout)}
        checkout={checkout}
        holdExpiresAt={checkout?.holdExpiresAt}
        onClose={() => setCheckout(null)}
        onResult={(payment) => {
          setCheckout(null);
          if (payment.status === 'paid') toast.success('Payment successful', 'Your session is confirmed. Invoice sent to your email.');
          else toast.error('Payment failed', 'The slot was released. Please book again.');
          sessions.reload({ silent: true });
        }}
      />
    </div>
  );
}
