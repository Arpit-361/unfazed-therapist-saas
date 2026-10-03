import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import { Field, Input } from '../../components/common/Field';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import { FullScreenLoader } from '../../components/common/Loader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { publicApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import { browserTimeZone } from '../../utils/format';
import NotFound from '../public/NotFound';

export default function ClientRegister() {
  const { slug } = useParams();
  const { clientRegister } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const profile = useApi(() => publicApi.profile(slug), [slug]);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm();

  if (profile.loading) return <FullScreenLoader />;
  if (profile.error) return <NotFound message={profile.error.message} />;
  const therapist = profile.data.therapist;

  const onSubmit = async (values) => {
    try {
      await clientRegister({ ...values, slug, timezone: browserTimeZone() });
      toast.success('Account created', 'Next: a short intake form and consent.');
      navigate('/portal/onboarding', { replace: true });
    } catch (err) {
      setError('root', { message: err.message });
    }
  };

  return (
    <AuthLayout
      title={`Book with ${therapist.name}`}
      subtitle="Create your private client account to complete intake and choose a time."
      aside={
        <div className="flex items-center gap-4">
          <Avatar name={therapist.name} src={therapist.photo_url} size="lg" />
          <div>
            <p className="text-2xl font-semibold">{therapist.name}</p>
            <p className="text-brand-100">{therapist.title}</p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {errors.root && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.root.message}</div>}
        <Field label="Full name" error={errors.name?.message} required>
          <Input {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email?.message} required>
            <Input type="email" {...register('email', { required: 'Email is required' })} />
          </Field>
          <Field label="Phone" hint="For WhatsApp reminders">
            <Input {...register('phone')} placeholder="+91" />
          </Field>
        </div>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters with a letter and a number." required>
          <Input
            type="password"
            autoComplete="new-password"
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'At least 8 characters' },
              validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || 'Include a letter and a number',
            })}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Continue
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already a client?{' '}
        <Link to={`/portal/login?slug=${slug}`} className="font-semibold text-brand-700">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
