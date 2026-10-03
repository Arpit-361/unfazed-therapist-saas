import { formatInTimeZone } from 'date-fns-tz';
import { BellPlus } from 'lucide-react';

/** Renders open slots grouped by day, with all times converted to `timezone`. */
export default function SlotPicker({ slots, timezone, dayKeys, selected, onSelect, onJoinWaitlist }) {
  const byDay = {};
  for (const slot of slots) {
    const key = formatInTimeZone(new Date(slot.start), timezone, 'yyyy-MM-dd');
    (byDay[key] ||= []).push(slot);
  }
  const todayKey = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {dayKeys.map((key) => {
        const daySlots = byDay[key] || [];
        const date = new Date(`${key}T12:00:00Z`);
        const past = key < todayKey;
        return (
          <div key={key} className="min-w-0">
            <div className={`mb-2 rounded-xl px-2 py-2 text-center ${key === todayKey ? 'bg-brand-50' : 'bg-slate-50'}`}>
              <p className="text-xs font-medium uppercase text-slate-500">{date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}</p>
              <p className="text-sm font-semibold text-slate-900">{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</p>
            </div>
            <div className="space-y-1.5">
              {daySlots.map((slot) => {
                const active = selected?.start === slot.start;
                return (
                  <button
                    key={slot.start}
                    onClick={() => onSelect(slot)}
                    className={`w-full rounded-lg border px-2 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50'
                    }`}
                  >
                    {formatInTimeZone(new Date(slot.start), timezone, 'h:mm a')}
                  </button>
                );
              })}
              {daySlots.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 px-2 py-3 text-center text-xs text-slate-400">
                  {past ? '—' : 'No slots'}
                  {!past && onJoinWaitlist && (
                    <button onClick={() => onJoinWaitlist(key)} className="mt-1.5 flex w-full items-center justify-center gap-1 font-medium text-brand-700 hover:text-brand-800">
                      <BellPlus className="h-3.5 w-3.5" /> Waitlist
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
