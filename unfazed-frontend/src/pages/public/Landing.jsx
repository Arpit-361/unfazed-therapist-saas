import { ArrowRight, BarChart3, CalendarCheck, CreditCard, FileLock2, Link2, MessageSquare, ShieldCheck } from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Button from '../../components/common/Button';
import useDocumentMeta from '../../hooks/useDocumentMeta';

const FEATURES = [
  { icon: Link2, title: 'One branded link', text: 'unfazed.in/your-name - a beautiful profile where clients learn about you, enquire and book.' },
  { icon: CalendarCheck, title: 'Timezone-smart scheduling', text: 'Weekly availability, buffers and overrides. Clients see slots in their own timezone. No double-bookings, ever.' },
  { icon: CreditCard, title: 'Payments & packages', text: 'Advance payments via Razorpay, 3/6/12-session packages and automatic GST invoices.' },
  { icon: FileLock2, title: 'Private & shared notes', text: 'Write SOAP/DAP or freeform notes. Private notes never leave your dashboard - enforced by the API.' },
  { icon: MessageSquare, title: 'Secure chat & reminders', text: 'Real-time messaging with clients plus automatic booking, reminder and follow-up notifications.' },
  { icon: BarChart3, title: 'Practice analytics', text: 'Revenue trends, active clients and no-show rates computed from your real data.' },
];

export default function Landing() {
  useDocumentMeta({
    title: 'Unfazed - Practice management for therapists in India',
    description: 'Run your private practice end-to-end with one branded link: scheduling, payments, notes, chat and analytics.',
  });

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] bg-gradient-to-b from-brand-50 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Built for therapists in India
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Your whole practice, <span className="text-brand-600">one calm link.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Client acquisition, scheduling, payments, clinical notes and business analytics - so you can focus on the work that matters.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/register" size="lg" icon={ArrowRight}>
              Create your practice
            </Button>
            <Button to="/dr-sharma" size="lg" variant="secondary">
              See a live profile
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} Unfazed · Made for mental health professionals</footer>
    </div>
  );
}
