import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { DemoCredentials } from '../../components/layout/AuthLayout';
import { Field, Input } from '../../components/common/Field';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { firstName } from '../../utils/format';

export default function ClientLogin() {
  const { clientLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slug = params.get('slug') || undefined;
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (values) => {
    try {
      const user = await clientLogin({ ...values, slug });
      toast.success(`Welcome back, ${firstName(user.name)}`);
      navigate('/portal', { replace: true });
    } catch (err) {
      setError('root', { message: err.message });
    }
  };

  return (
    <AuthLayout
      title="Client portal"
      subtitle="Book sessions, pay securely, read shared notes and message your therapist."
      aside={<p className="text-3xl font-semibold leading-snug">A calm, private space for your therapy journey.</p>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {errors.root && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.root.message}</div>}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email', { required: 'Email is required' })} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password', { required: 'Password is required' })} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        New client? Use the invitation link from your therapist, or sign up from their profile page.
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        Therapist?{' '}
        <Link to="/login" className="font-semibold text-brand-700">
          Therapist login
        </Link>
      </p>
      <DemoCredentials
        accounts={[
          { label: 'Aarav Mehta · client of Dr. Sharma', email: 'aarav@client.demo' },
          { label: 'Kavya Menon · client of Dr. Iyer', email: 'kavya@client.demo' },
        ]}
        onPick={(a) => {
          setValue('email', a.email);
          setValue('password', 'Demo@1234');
        }}
      />
    </AuthLayout>
  );
}
