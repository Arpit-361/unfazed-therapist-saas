import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { enIN } from 'date-fns/locale';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-IN': enIN },
});

const STATUS_COLORS = {
  confirmed: { background: '#0d7e74', color: '#fff' },
  pending_payment: { background: '#fef3c7', color: '#92400e', border: '1px dashed #f59e0b' },
  completed: { background: '#d1fae5', color: '#065f46' },
  no_show: { background: '#ffe4e6', color: '#9f1239' },
  cancelled: { background: '#f1f5f9', color: '#94a3b8', textDecoration: 'line-through' },
  blocked: { background: 'repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 6px,#f1f5f9 6px,#f1f5f9 12px)', color: '#475569' },
};

export default function Calendar({ events, date, view, onNavigate, onView, onSelectEvent, height = 680 }) {
  return (
    <div className="card p-3 sm:p-4" style={{ height }}>
      <BigCalendar
        localizer={localizer}
        culture="en-IN"
        events={events}
        date={date}
        view={view}
        onNavigate={onNavigate}
        onView={onView}
        views={['month', 'week', 'day', 'agenda']}
        startAccessor="start"
        endAccessor="end"
        min={new Date(1970, 0, 1, 7, 0)}
        max={new Date(1970, 0, 1, 22, 0)}
        step={30}
        timeslots={2}
        popup
        onSelectEvent={onSelectEvent}
        eventPropGetter={(event) => ({ style: STATUS_COLORS[event.status] || STATUS_COLORS.confirmed })}
      />
    </div>
  );
}
