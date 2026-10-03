import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import { Field, Input } from '../../components/common/Field';
import Button from '../../components/common/Button';
import { FullScreenLoader } from '../../components/common/Loader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import { browserTimeZone } from '../../utils/format';
import NotFound from '../public/NotFound';

export default function AcceptInvite() {
  const { token } = useParams();
  const { acceptInvite } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const invite = useApi(() => authApi.getInvite(token), [token]);
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm();

  if (invite.loading) return <FullScreenLoader />;
  if (invite.error) return <NotFound message={invite.error.message} />;
  const { name, email, therapist } = invite.data.invite;

  const onSubmit = async (values) => {
    try {
      await acceptInvite(token, { password: values.password, timezone: browserTimeZone() });
      toast.success('Welcome to Unfazed!', 'Please complete your intake and consent.');
      navigate('/portal/onboarding', { replace: true });
    } catch (err) {
      setError('root', { message: err.message });
    }
  };

  return (
    <AuthLayout title={`Hi ${name.split(' ')[0]}, welcome!`} subtitle={`${therapist.name} invited you to their secure client portal. Set a password to get started.`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {errors.root && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.root.message}</div>}
        <Field label="Email">
          <Input value={email} disabled readOnly />
        </Field>
        <Field label="Create password" error={errors.password?.message} hint="At least 8 characters with a letter and a number.">
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
        <Field label="Confirm password" error={errors.confirm?.message}>
          <Input type="password" {...register('confirm', { validate: (v) => v === watch('password') || 'Passwords do not match' })} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Activate my portal
        </Button>
      </form>
    </AuthLayout>
  );
}
