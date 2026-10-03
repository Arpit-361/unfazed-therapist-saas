import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout, { DemoCredentials } from '../../components/layout/AuthLayout';
import { Field, Input } from '../../components/common/Field';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { firstName } from '../../utils/format';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (values) => {
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${firstName(user.name)}`);
      navigate(location.state?.from?.startsWith('/dashboard') ? location.state.from : '/dashboard', { replace: true });
    } catch (err) {
      setError('root', { message: err.message });
    }
  };

  return (
    <AuthLayout title="Therapist login" subtitle="Manage your practice, clients and schedule.">
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
        New to Unfazed?{' '}
        <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800">
          Create your practice
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        Are you a client?{' '}
        <Link to="/portal/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Client login
        </Link>
      </p>
      <DemoCredentials
        accounts={[
          { label: 'Dr. Ananya Sharma · Professional plan', email: 'dr.sharma@unfazed.demo' },
          { label: 'Dr. Rohan Iyer · Starter plan (at client cap)', email: 'dr.iyer@unfazed.demo' },
        ]}
        onPick={(a) => {
          setValue('email', a.email);
          setValue('password', 'Demo@1234');
        }}
      />
    </AuthLayout>
  );
}
