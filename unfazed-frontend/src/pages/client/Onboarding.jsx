import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CheckCircle2, ClipboardList, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { Field, Input, Select, TextArea } from '../../components/common/Field';
import { PageLoader } from '../../components/common/Loader';
import { usePortal } from '../../components/layout/PortalLayout';
import { portalApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import { fmtDateTime } from '../../utils/format';

function Steps({ step }) {
  const items = [
    { n: 1, label: 'Intake form', icon: ClipboardList },
    { n: 2, label: 'Informed consent', icon: ShieldCheck },
  ];
  return (
    <div className="mb-6 flex items-center gap-3">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${step === it.n ? 'bg-brand-600 text-white' : step > it.n ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {step > it.n ? <CheckCircle2 className="h-4 w-4" /> : <it.icon className="h-4 w-4" />}
            {it.label}
          </div>
          {i < items.length - 1 && <div className="h-px w-8 bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

function IntakeForm({ client, onDone }) {
  const toast = useToast();
  const intake = client.intake || {};
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      demographics: intake.demographics || {},
      presenting_concern: intake.presenting_concern || '',
      history: intake.history || {},
      goals: intake.goals || '',
    },
  });

  const submit = async (values) => {
    try {
      await portalApi.submitIntake(values);
      toast.success('Intake saved');
      onDone();
    } catch (err) {
      toast.error('Could not save intake', err.details?.[0]?.message || err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      <div className="card space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold text-slate-900">About you</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth">
            <Input type="date" {...register('demographics.date_of_birth')} />
          </Field>
          <Field label="Gender">
            <Select {...register('demographics.gender')}>
              <option value="">Prefer not to say</option>
              <option>Female</option>
              <option>Male</option>
              <option>Non-binary</option>
              <option>Other</option>
            </Select>
          </Field>
          <Field label="Occupation">
            <Input {...register('demographics.occupation')} />
          </Field>
          <Field label="City">
            <Input {...register('demographics.city')} />
          </Field>
          <Field label="Emergency contact name">
            <Input {...register('demographics.emergency_contact_name')} />
          </Field>
          <Field label="Emergency contact phone">
            <Input {...register('demographics.emergency_contact_phone')} />
          </Field>
        </div>
      </div>

      <div className="card space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold text-slate-900">What brings you to therapy?</h3>
        <Field label="Presenting concern" error={errors.presenting_concern?.message} required>
          <TextArea rows={4} placeholder="In your own words, what would you like help with?" {...register('presenting_concern', { required: 'Please share a little about what brings you here', minLength: { value: 5, message: 'Please add a little more detail' } })} />
        </Field>
        <Field label="Goals for therapy">
          <TextArea rows={3} {...register('goals')} />
        </Field>
      </div>

      <div className="card space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold text-slate-900">Health history</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Previous therapy or counselling">
            <TextArea rows={2} {...register('history.previous_therapy')} />
          </Field>
          <Field label="Current medications">
            <TextArea rows={2} {...register('history.medications')} />
          </Field>
          <Field label="Medical conditions">
            <TextArea rows={2} {...register('history.medical_conditions')} />
          </Field>
          <Field label="Family mental-health history">
            <TextArea rows={2} {...register('history.family_history')} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isSubmitting}>
          Save & continue
        </Button>
      </div>
    </form>
  );
}

function ConsentStep({ client, onDone }) {
  const toast = useToast();
  const { data, loading } = useApi(() => portalApi.consentText(), []);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) return <PageLoader />;

  const submit = async () => {
    setSaving(true);
    try {
      await portalApi.giveConsent({ accepted: true, version: data.version });
      toast.success('Consent recorded', 'Thank you - you can now book sessions.');
      onDone();
    } catch (err) {
      toast.error('Could not record consent', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Informed consent for therapy</h3>
        <span className="text-xs text-slate-400">Version {data.version}</span>
      </div>
      <div className="mt-4 max-h-80 overflow-y-auto whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{data.text}</div>
      {client.consent.given ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> You accepted this on {fmtDateTime(client.consent.accepted_at, client.timezone)}.
        </p>
      ) : (
        <>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            I have read and understood the above, and I consent to receive therapy services from my therapist through Unfazed.
          </label>
          <p className="mt-2 text-xs text-slate-400">We record the date, time, IP address and form version as an audit trail.</p>
          <div className="mt-5 flex justify-end">
            <Button size="lg" disabled={!accepted} loading={saving} onClick={submit}>
              I agree
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { client, reload } = usePortal();
  const [step, setStep] = useState(client.intake_completed ? 2 : 1);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Getting started" description="This helps your therapist prepare for your first session. Your answers are private to your therapist." />
      <Steps step={client.intake_completed && client.consent.given ? 3 : step} />
      {step === 1 ? (
        <IntakeForm
          client={client}
          onDone={async () => {
            await reload();
            setStep(2);
          }}
        />
      ) : (
        <>
          <ConsentStep
            client={client}
            onDone={async () => {
              await reload();
              navigate('/portal/book');
            }}
          />
          <button onClick={() => setStep(1)} className="mt-4 text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Edit intake form
          </button>
        </>
      )}
    </div>
  );
}
