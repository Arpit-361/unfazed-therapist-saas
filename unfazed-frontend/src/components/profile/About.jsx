import { GraduationCap } from 'lucide-react';

export default function About({ therapist }) {
  return (
    <section className="card p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-slate-900">About {therapist.name.split(' ').slice(0, 2).join(' ')}</h2>
      <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600">{therapist.bio || 'This therapist has not added a bio yet.'}</p>
      {therapist.qualifications && (
        <p className="mt-4 flex items-start gap-2 text-sm text-slate-600">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {therapist.qualifications}
        </p>
      )}
      {therapist.specializations?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Areas of focus</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {therapist.specializations.map((s) => (
              <span key={s} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
