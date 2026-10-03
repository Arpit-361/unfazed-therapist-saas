import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { AlertTriangle, CalendarCheck, ChevronLeft, ChevronRight, CreditCard, Globe, Package } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { Select } from '../../components/common/Field';
import { CardSkeleton } from '../../components/common/Loader';
import { ErrorState } from '../../components/common/States';
import SlotPicker from '../../components/scheduling/SlotPicker';
import CheckoutForm from '../../components/payments/CheckoutForm';
import { usePortal } from '../../components/layout/PortalLayout';
import { portalApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import { fmtDateTime, formatINR, timezoneOptions, tzAbbrev } from '../../utils/format';

export default function BookingPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { client, therapist, features, onboarded } = usePortal();
  const [serviceId, setServiceId] = useState(therapist.services[0]?.id || '');
  const [tz, setTz] = useState(client.timezone || 'Asia/Kolkata');
  const [week, setWeek] = useState(0);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('pay_now');
  const [booking, setBooking] = useState(false);
  const [checkout, setCheckout] = useState(null);

  const service = therapist.services.find((s) => s.id === serviceId);

  const { dayKeys, from, to } = useMemo(() => {
    const todayKey = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
    const start = addDays(fromZonedTime(`${todayKey}T00:00:00`, tz), week * 7);
    const keys = Array.from({ length: 7 }, (_, i) => formatInTimeZone(addDays(start, i), tz, 'yyyy-MM-dd'));
    return { dayKeys: keys, from: start < new Date() ? new Date() : start, to: addDays(start, 7) };
  }, [tz, week]);

  const slots = useApi(
    () => portalApi.slots({ service_id: serviceId, from: from.toISOString(), to: to.toISOString() }),
    [serviceId, from.getTime(), to.getTime()]
  );
  const packages = useApi(() => portalApi.packages(), []);

  const credits = (packages.data?.my_packages || []).filter(
    (p) => p.status === 'active' && p.sessions_remaining > 0 && p.duration_minutes === service?.duration_minutes
  );
  const effectiveMode = mode === 'package' && credits.length ? 'package' : 'pay_now';

  const joinWaitlist = async (dayKey) => {
    const therapistDay = formatInTimeZone(fromZonedTime(`${dayKey}T12:00:00`, tz), therapist.timezone, 'yyyy-MM-dd');
    try {
      const res = await portalApi.joinWaitlist(therapistDay);
      toast.success('Added to waitlist', res.message);
    } catch (err) {
      if (err.code !== 'UPGRADE_REQUIRED') toast.error('Could not join waitlist', err.message);
    }
  };

  const book = async () => {
    setBooking(true);
    try {
      const res = await portalApi.book({ service_id: serviceId, start_time: selected.start, client_timezone: tz, payment_mode: effectiveMode });
      if (res.checkout) {
        setCheckout({ ...res.checkout, holdExpiresAt: res.session.hold_expires_at });
      } else {
        toast.success('Session booked', `${fmtDateTime(res.session.start_time, tz)} - paid with a package credit.`);
        navigate('/portal');
      }
    } catch (err) {
      if (err.status === 409) {
        toast.error('That slot was just taken', 'Please choose another time.');
        setSelected(null);
        slots.reload({ silent: true });
      } else if (err.code === 'INTAKE_REQUIRED' || err.code === 'CONSENT_REQUIRED') {
        toast.error('Finish your setup first', err.message);
        navigate('/portal/onboarding');
      } else {
        toast.error('Booking failed', err.message);
      }
    } finally {
      setBooking(false);
    }
  };

  if (!onboarded) {
    return (
      <div>
        <PageHeader title="Book a session" />
        <div className="card flex flex-col items-center p-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-slate-900">Complete intake and consent first</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">Your therapist needs your intake form and informed consent before your first session.</p>
          <Button className="mt-4" to="/portal/onboarding">
            Continue setup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Book a session" description={`With ${therapist.name}`} />

      <div className="card mb-4 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_260px]">
        <div className="grid gap-2 sm:grid-cols-2">
          {therapist.services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServiceId(s.id);
                setSelected(null);
              }}
              className={`rounded-xl border p-3 text-left transition ${s.id === serviceId ? 'border-brand-600 bg-brand-50/60 ring-4 ring-brand-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <p className="text-sm font-semibold text-slate-900">{s.title}</p>
              <p className="text-xs text-slate-500">
                {s.duration_minutes} min · {formatINR(s.price)} + GST
              </p>
            </button>
          ))}
        </div>
        <div>
          <label className="label flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Show times in
          </label>
          <Select
            value={tz}
            onChange={(e) => {
              setTz(e.target.value);
              setSelected(null);
            }}
          >
            {timezoneOptions(tz).map((z) => (
              <option key={z} value={z}>
                {z} ({tzAbbrev(z)})
              </option>
            ))}
          </Select>
          {tz !== therapist.timezone && <p className="mt-1.5 text-xs text-slate-500">Your therapist is in {therapist.timezone}. Times are converted for you.</p>}
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={week === 0} onClick={() => setWeek((w) => w - 1)}>
            Earlier
          </Button>
          <p className="text-sm font-medium text-slate-700">{week === 0 ? 'This week' : `${dayKeys[0]} → ${dayKeys[6]}`}</p>
          <Button size="sm" variant="secondary" disabled={week >= 7} onClick={() => setWeek((w) => w + 1)}>
            Later <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {slots.error ? (
          <ErrorState error={slots.error} onRetry={slots.reload} />
        ) : slots.loading ? (
          <CardSkeleton rows={3} />
        ) : (
          <SlotPicker slots={slots.data.slots} timezone={tz} dayKeys={dayKeys} selected={selected} onSelect={setSelected} onJoinWaitlist={features.waitlist ? joinWaitlist : undefined} />
        )}
      </div>

      {selected && service && (
        <div className="card sticky bottom-4 mt-4 flex flex-col gap-4 border-brand-200 p-4 shadow-pop sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-8 w-8 text-brand-600" />
            <div>
              <p className="font-semibold text-slate-900">{fmtDateTime(selected.start, tz)}</p>
              <p className="text-xs text-slate-500">
                {service.title} · {service.duration_minutes} min
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {credits.length > 0 && (
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm">
                <button onClick={() => setMode('pay_now')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${effectiveMode === 'pay_now' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
                  <CreditCard className="h-4 w-4" /> Pay {formatINR(service.price)} + GST
                </button>
                <button onClick={() => setMode('package')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${effectiveMode === 'package' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
                  <Package className="h-4 w-4" /> Use credit ({credits.reduce((n, c) => n + c.sessions_remaining, 0)} left)
                </button>
              </div>
            )}
            <Button size="lg" loading={booking} onClick={book}>
              {effectiveMode === 'package' ? 'Confirm booking' : 'Continue to payment'}
            </Button>
          </div>
        </div>
      )}

      <CheckoutForm
        open={Boolean(checkout)}
        checkout={checkout}
        holdExpiresAt={checkout?.holdExpiresAt}
        onClose={() => {
          setCheckout(null);
          toast.info('Slot held for you', 'Complete payment from your portal home before the hold expires.');
          navigate('/portal');
        }}
        onResult={(payment) => {
          setCheckout(null);
          if (payment.status === 'paid') {
            toast.success('Session confirmed!', 'Payment received. Your invoice has been emailed.');
            navigate('/portal');
          } else {
            toast.error('Payment failed', 'The slot was released. Please pick a time again.');
            setSelected(null);
            slots.reload({ silent: true });
          }
        }}
      />
    </div>
  );
}
