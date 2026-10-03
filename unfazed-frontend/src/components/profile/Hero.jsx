import { BadgeCheck, Briefcase, Languages, MapPin } from 'lucide-react';
import Avatar from '../common/Avatar';
import Button from '../common/Button';

export default function Hero({ therapist, onBook, onEnquire }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-brand-300/20 blur-3xl" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center md:py-20">
        <Avatar name={therapist.name} src={therapist.photo_url} size="xl" className="ring-4 ring-white/30" />
        <div className="flex-1 text-center md:text-left">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            <BadgeCheck className="h-3.5 w-3.5" /> Book online with Unfazed
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{therapist.name}</h1>
          <p className="mt-1 text-lg text-brand-100">{therapist.title}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-brand-50 md:justify-start">
            {therapist.city && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {therapist.city} · Online sessions
              </span>
            )}
            {therapist.experience_years > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" /> {therapist.experience_years}+ years experience
              </span>
            )}
            {therapist.languages?.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-4 w-4" /> {therapist.languages.join(', ')}
              </span>
            )}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
            <Button size="lg" className="!bg-white !text-brand-800 hover:!bg-brand-50" onClick={onBook} disabled={!therapist.accepting_clients}>
              {therapist.accepting_clients ? 'Book a session' : 'Not accepting new clients'}
            </Button>
            <Button size="lg" variant="ghost" className="!text-white hover:!bg-white/10 ring-1 ring-white/40" onClick={onEnquire}>
              Send an enquiry
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
