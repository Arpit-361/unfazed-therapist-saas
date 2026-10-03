import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import Logo from '../common/Logo';
import { systemApi } from '../../api/endpoints';

export function DemoCredentials({ accounts, onPick }) {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    systemApi.health().then((h) => setDemo(Boolean(h.demo_mode))).catch(() => {});
  }, []);
  if (!demo) return null;
  return (
    <div className="mt-6 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-800">
        <FlaskConical className="h-3.5 w-3.5" /> Demo mode accounts
      </p>
      <div className="mt-2 space-y-1.5">
        {accounts.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => onPick(a)}
            className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left text-xs ring-1 ring-brand-100 transition hover:ring-brand-300"
          >
            <span>
              <span className="block font-medium text-slate-800">{a.label}</span>
              <span className="text-slate-500">{a.email}</span>
            </span>
            <span className="font-medium text-brand-700">Use</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Password for all demo accounts: Demo@1234</p>
    </div>
  );
}

export default function AuthLayout({ title, subtitle, children, aside }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-800 to-brand-600 lg:block">
        <div className="absolute -right-20 top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-brand-300/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          {aside || (
            <>
              <p className="text-3xl font-semibold leading-snug">“Unfazed gave me back the hours I used to spend on WhatsApp, spreadsheets and payment follow-ups.”</p>
              <p className="mt-4 text-brand-100">Clinical psychologist, Mumbai</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
