import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import { Field, Input } from '../../components/common/Field';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function Register() {
  const { register: registerTherapist } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm();
  const slug = watch('slug');

  const onSubmit = async (values) => {
    try {
      const user = await registerTherapist({ ...values, slug: values.slug || undefined });
      toast.success('Your practice is ready!', `Your branded link is ${window.location.host}/${user.slug}`);
      navigate('/dashboard/settings', { replace: true });
    } catch (err) {
      setError('root', { message: err.message });
    }
  };

  return (
    <AuthLayout
      title="Create your practice"
      subtitle="Start free. Your branded booking link is ready in under a minute."
      aside={
        <ul className="space-y-4 text-lg">
          <li>✓ Branded profile at unfazed.in/your-name</li>
          <li>✓ Online booking with automatic reminders</li>
          <li>✓ Payments, packages & GST invoices</li>
          <li>✓ Private clinical notes, secure chat</li>
        </ul>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {errors.root && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.root.message}</div>}
        <Field label="Full name" error={errors.name?.message} required>
          <Input placeholder="Dr. Priya Menon" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Name is too short' } })} />
        </Field>
        <Field label="Email" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" {...register('email', { required: 'Email is required' })} />
        </Field>
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
        <Field label="Profile link (optional)" error={errors.slug?.message} hint={slug ? `${window.location.host}/${slug}` : 'Leave empty to generate from your name.'}>
          <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
            <span className="pl-3.5 text-sm text-slate-400">unfazed.in/</span>
            <input
              className="w-full rounded-r-xl border-0 bg-transparent py-2.5 pl-1 pr-3 text-sm outline-none"
              placeholder="dr-priya"
              {...register('slug', {
                pattern: { value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Lowercase letters, numbers and hyphens only' },
                minLength: { value: 3, message: 'At least 3 characters' },
              })}
            />
          </div>
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
