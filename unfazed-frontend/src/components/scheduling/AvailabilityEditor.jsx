import { useEffect, useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import { Field, Input, Select } from '../common/Field';
import { schedulingApi, systemApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { fmtDateTime, timezoneOptions } from '../../utils/format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function AvailabilityEditor({ availability, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(availability);
  const [durationsAllowed, setDurationsAllowed] = useState([30, 45, 60, 90]);
  const [saving, setSaving] = useState(false);
  const [block, setBlock] = useState({ start: '', end: '', reason: '' });

  useEffect(() => setForm(availability), [availability]);
  useEffect(() => {
    systemApi.paymentConfig().then((c) => setDurationsAllowed(c.session_durations)).catch(() => {});
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const windowsFor = (day) => form.weekly.filter((w) => w.day_of_week === day);
  const setDayWindows = (day, windows) => set({ weekly: [...form.weekly.filter((w) => w.day_of_week !== day), ...windows] });

  const save = async () => {
    setSaving(true);
    try {
      const { weekly, overrides, buffer_minutes, session_durations, min_notice_hours, booking_window_days, timezone } = form;
      const res = await schedulingApi.updateAvailability({
        weekly: weekly.map(({ day_of_week, start, end }) => ({ day_of_week, start, end })),
        overrides: overrides.map(({ date, unavailable, windows, note }) => ({ date, unavailable, windows: unavailable ? [] : windows, note })),
        buffer_minutes: Number(buffer_minutes),
        session_durations,
        min_notice_hours: Number(min_notice_hours),
        booking_window_days: Number(booking_window_days),
        timezone,
      });
      toast.success('Availability saved', 'Clients now see your updated slots.');
      onSaved(res.availability);
    } catch (err) {
      toast.error('Could not save availability', err.message);
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async () => {
    if (!block.start || !block.end) return toast.error('Choose a start and end time for the block');
    try {
      const res = await schedulingApi.addBlock({ start: new Date(block.start).toISOString(), end: new Date(block.end).toISOString(), reason: block.reason });
      setBlock({ start: '', end: '', reason: '' });
      onSaved(res.availability);
      toast.success('Time blocked');
    } catch (err) {
      toast.error('Could not block time', err.message);
    }
  };

  const removeBlock = async (id) => {
    try {
      onSaved((await schedulingApi.removeBlock(id)).availability);
    } catch (err) {
      toast.error('Could not remove block', err.message);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="card p-5 xl:col-span-2">
        <h3 className="font-semibold text-slate-900">Weekly hours</h3>
        <p className="text-sm text-slate-500">Your recurring availability, in {form.timezone}.</p>
        <div className="mt-4 divide-y divide-slate-100">
          {ORDER.map((day) => {
            const windows = windowsFor(day);
            return (
              <div key={day} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                <label className="flex w-36 shrink-0 items-center gap-2 pt-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={windows.length > 0}
                    onChange={(e) => setDayWindows(day, e.target.checked ? [{ day_of_week: day, start: '10:00', end: '18:00' }] : [])}
                  />
                  {DAYS[day]}
                </label>
                <div className="flex-1 space-y-2">
                  {windows.length === 0 && <p className="pt-2 text-sm text-slate-400">Unavailable</p>}
                  {windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" value={w.start} className="max-w-[140px]" onChange={(e) => setDayWindows(day, windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                      <span className="text-slate-400">–</span>
                      <Input type="time" value={w.end} className="max-w-[140px]" onChange={(e) => setDayWindows(day, windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                      <Button variant="ghost" size="icon" onClick={() => setDayWindows(day, windows.filter((_, j) => j !== i))} aria-label="Remove range">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {windows.length > 0 && (
                    <button className="inline-flex items-center gap-1 text-xs font-medium text-brand-700" onClick={() => setDayWindows(day, [...windows, { day_of_week: day, start: '14:00', end: '17:00' }])}>
                      <Plus className="h-3.5 w-3.5" /> Add time range
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div className="card space-y-4 p-5">
          <h3 className="font-semibold text-slate-900">Session settings</h3>
          <Field label="Session lengths offered">
            <div className="flex flex-wrap gap-2">
              {durationsAllowed.map((d) => {
                const on = form.session_durations.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ session_durations: on ? form.session_durations.filter((x) => x !== d) : [...form.session_durations, d] })}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'}`}
                  >
                    {d} min
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buffer between sessions">
              <Select value={form.buffer_minutes} onChange={(e) => set({ buffer_minutes: Number(e.target.value) })}>
                {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Minimum notice">
              <Select value={form.min_notice_hours} onChange={(e) => set({ min_notice_hours: Number(e.target.value) })}>
                {[0, 2, 4, 12, 24, 48].map((h) => (
                  <option key={h} value={h}>
                    {h} hours
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Booking window">
            <Select value={form.booking_window_days} onChange={(e) => set({ booking_window_days: Number(e.target.value) })}>
              {[14, 30, 45, 60, 90].map((d) => (
                <option key={d} value={d}>
                  Up to {d} days ahead
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Timezone">
            <Select value={form.timezone} onChange={(e) => set({ timezone: e.target.value })}>
              {timezoneOptions(form.timezone).map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
          <Button className="w-full" onClick={save} loading={saving}>
            Save availability
          </Button>
        </div>

        <div className="card space-y-3 p-5">
          <h3 className="font-semibold text-slate-900">Date overrides</h3>
          <p className="text-xs text-slate-500">Take a day off or set special hours for a specific date. Save to apply.</p>
          {form.overrides.map((o, i) => (
            <div key={o._id || i} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Input type="date" value={o.date} onChange={(e) => set({ overrides: form.overrides.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} />
                <Button variant="ghost" size="icon" onClick={() => set({ overrides: form.overrides.filter((_, j) => j !== i) })} aria-label="Remove override">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={o.unavailable} onChange={(e) => set({ overrides: form.overrides.map((x, j) => (j === i ? { ...x, unavailable: e.target.checked, windows: x.windows?.length ? x.windows : [{ start: '10:00', end: '14:00' }] } : x)) })} />
                Unavailable all day
              </label>
              {!o.unavailable &&
                (o.windows || []).map((w, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <Input type="time" value={w.start} onChange={(e) => set({ overrides: form.overrides.map((x, j) => (j === i ? { ...x, windows: x.windows.map((y, m) => (m === k ? { ...y, start: e.target.value } : y)) } : x)) })} />
                    <span>–</span>
                    <Input type="time" value={w.end} onChange={(e) => set({ overrides: form.overrides.map((x, j) => (j === i ? { ...x, windows: x.windows.map((y, m) => (m === k ? { ...y, end: e.target.value } : y)) } : x)) })} />
                  </div>
                ))}
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => set({ overrides: [...form.overrides, { date: '', unavailable: true, windows: [] }] })}>
            Add override
          </Button>
        </div>

        <div className="card space-y-3 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <CalendarOff className="h-4 w-4" /> Blocked time
          </h3>
          {(availability.blocked_slots || []).map((b) => (
            <div key={b._id} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{b.reason || 'Blocked'}</p>
                <p className="text-xs text-slate-500">
                  {fmtDateTime(b.start)} → {fmtDateTime(b.end)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeBlock(b._id)} aria-label="Remove block">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Input type="datetime-local" value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} />
          <Input type="datetime-local" value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} />
          <Input placeholder="Reason (optional)" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
          <Button variant="secondary" size="sm" onClick={addBlock}>
            Block this time
          </Button>
        </div>
      </div>
    </div>
  );
}
