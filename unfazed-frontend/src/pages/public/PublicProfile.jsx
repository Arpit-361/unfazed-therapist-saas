import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Share2 } from 'lucide-react';
import { publicApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import useDocumentMeta from '../../hooks/useDocumentMeta';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Hero from '../../components/profile/Hero';
import About from '../../components/profile/About';
import ServiceCard from '../../components/profile/ServiceCard';
import PackageCard from '../../components/payments/PackageCard';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Logo from '../../components/common/Logo';
import { Field, Input, TextArea } from '../../components/common/Field';
import { FullScreenLoader } from '../../components/common/Loader';
import { copyToClipboard } from '../../utils/download';
import NotFound from './NotFound';

function EnquiryModal({ open, onClose, slug, therapistName }) {
  const toast = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (values) => {
    try {
      const res = await publicApi.enquire(slug, values);
      toast.success('Enquiry sent', res.message);
      reset();
      onClose();
    } catch (err) {
      toast.error('Could not send enquiry', err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Message ${therapistName}`} description="Your enquiry goes directly to the therapist.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Your name" error={errors.name?.message} required>
          <Input {...register('name', { required: 'Please enter your name', minLength: { value: 2, message: 'Too short' } })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email?.message} required>
            <Input type="email" {...register('email', { required: 'Email is required' })} />
          </Field>
          <Field label="Phone (optional)">
            <Input {...register('phone')} />
          </Field>
        </div>
        <Field label="How can they help?">
          <TextArea rows={4} placeholder="Share a little about what you're looking for..." {...register('message', { maxLength: 2000 })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Send enquiry
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PublicProfile() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isClient } = useAuth();
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const { data, loading, error } = useApi(() => publicApi.profile(slug), [slug]);
  const therapist = data?.therapist;

  useDocumentMeta({
    title: therapist ? `${therapist.name} - ${therapist.title} | Unfazed` : 'Unfazed',
    description: therapist?.bio?.slice(0, 180),
    image: therapist?.photo_url || undefined,
    type: 'profile',
  });

  if (loading) return <FullScreenLoader />;
  if (error?.status === 404 || !therapist) return <NotFound message={error?.message} />;

  const book = () => {
    if (isClient && user.therapist_id === therapist.id) navigate('/portal/book');
    else navigate(`/${slug}/join`);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: therapist.name, url }).catch(() => {});
    } else if (await copyToClipboard(url)) {
      toast.success('Link copied', url);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo light />
          <button onClick={share} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </header>
      <Hero therapist={therapist} onBook={book} onEnquire={() => setEnquiryOpen(true)} />

      <main className="mx-auto -mt-8 max-w-5xl space-y-8 px-4 pb-16 sm:px-6">
        <About therapist={therapist} />

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Sessions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {therapist.services.map((s) => (
              <ServiceCard key={s.id} service={s} onBook={therapist.accepting_clients ? book : undefined} />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Prices exclude GST. Times are shown in your local timezone when booking.</p>
        </section>

        {data.packages.length > 0 && (
          <section>
            <h2 className="mb-1 text-xl font-semibold text-slate-900">Session packages</h2>
            <p className="mb-4 text-sm text-slate-500">Commit to your progress and save on every session.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.packages.map((p) => (
                <PackageCard key={p.id} pkg={p} />
              ))}
            </div>
          </section>
        )}

        <section className="card flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Ready to take the first step?</h2>
            <p className="mt-1 text-sm text-slate-600">Create your secure client account, complete a short intake and pick a time that suits you.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={book} disabled={!therapist.accepting_clients}>
              Book a session
            </Button>
            <Button variant="secondary" to={`/portal/login?slug=${slug}`}>
              Client login
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Powered by <Link to="/" className="font-semibold text-brand-700">Unfazed</Link> · Secure, private practice management
      </footer>

      <EnquiryModal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} slug={slug} therapistName={therapist.name} />
    </div>
  );
}
