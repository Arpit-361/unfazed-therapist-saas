import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, Camera, Check, CheckCircle2, ClipboardList, Plug, Plus, Save, Sparkles, Trash2, User, XCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Tabs from '../../components/common/Tabs';
import TagInput from '../../components/common/TagInput';
import Badge from '../../components/common/Badge';
import { Field, Input, Select, TextArea, Toggle } from '../../components/common/Field';
import { PageLoader } from '../../components/common/Loader';
import { ErrorState } from '../../components/common/States';
import { entitlementsApi, systemApi, therapistApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useEntitlementContext } from '../../context/EntitlementContext';
import useApi from '../../hooks/useApi';
import useEntitlement, { FEATURES } from '../../hooks/useEntitlement';
import LockedFeature from '../../components/entitlements/LockedFeature';
import IntakeFormBuilder from '../../components/crm/IntakeFormBuilder';
import { formatINR, timezoneOptions } from '../../utils/format';

const toForm = (t) => ({
  name: t.name,
  title: t.title || '',
  bio: t.bio || '',
  slug: t.slug,
  specializations: t.specializations || [],
  languages: t.languages || [],
  qualifications: t.qualifications || '',
  experience_years: t.experience_years ?? 0,
  city: t.city || '',
  phone: t.phone || '',
  timezone: t.timezone,
  gstin: t.gstin || '',
  accepting_clients: t.accepting_clients,
  services: (t.services || []).map((s) => ({ ...s, price: s.price / 100 })),
});

function ProfileTab({ form, set, therapist, onPhoto }) {
  const [slugState, setSlugState] = useState(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!form.slug || form.slug === therapist.slug) return setSlugState(null);
    const t = setTimeout(() => {
      therapistApi
        .checkSlug(form.slug)
        .then(setSlugState)
        .catch(() => setSlugState(null));
    }, 350);
    return () => clearTimeout(t);
  }, [form.slug, therapist.slug]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onPhoto(file);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="card flex flex-col items-center p-6 text-center">
        <Avatar name={form.name} src={therapist.photo_url} size="xl" />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />
        <Button className="mt-4" size="sm" variant="secondary" icon={Camera} loading={uploading} onClick={() => fileRef.current?.click()}>
          Change photo
        </Button>
        <p className="mt-2 text-xs text-slate-400">JPG, PNG or WebP · max 2 MB</p>
        <div className="mt-6 w-full border-t border-slate-100 pt-4 text-left">
          <Toggle checked={form.accepting_clients} onChange={(v) => set({ accepting_clients: v })} label="Accepting new clients" description="Shown on your public profile" />
        </div>
      </div>

      <div className="card space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Professional title">
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Counsellor" />
          </Field>
        </div>
        <Field
          label="Profile link"
          error={slugState && !slugState.available ? slugState.reason : undefined}
          hint={slugState?.available ? '✓ Available' : 'Lowercase letters, numbers and hyphens'}
        >
          <div className="flex items-center overflow-hidden rounded-xl border border-slate-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
            <span className="bg-slate-50 px-3 py-2.5 text-sm text-slate-500">{window.location.host}/</span>
            <input className="flex-1 border-0 px-2 py-2.5 text-sm outline-none" value={form.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
          </div>
        </Field>
        <Field label="About you" hint="Shown on your public profile">
          <TextArea rows={5} value={form.bio} onChange={(e) => set({ bio: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Specializations">
            <TagInput value={form.specializations} onChange={(v) => set({ specializations: v })} />
          </Field>
          <Field label="Languages">
            <TagInput value={form.languages} onChange={(v) => set({ languages: v })} />
          </Field>
        </div>
        <Field label="Qualifications">
          <Input value={form.qualifications} maxLength={300} onChange={(e) => set({ qualifications: e.target.value })} placeholder="Your degrees and registration details" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Experience (years)">
            <Input type="number" min="0" max="70" value={form.experience_years} onChange={(e) => set({ experience_years: Number(e.target.value) })} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Phone (private)">
            <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Timezone">
            <Select value={form.timezone} onChange={(e) => set({ timezone: e.target.value })}>
              {timezoneOptions(form.timezone).map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
          <Field label="GSTIN (optional)" hint="Printed on invoices" className="sm:col-span-2">
            <Input value={form.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} placeholder="29ABCDE1234F1Z5" />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ServicesTab({ form, set, durations }) {
  const update = (i, patch) => set({ services: form.services.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  return (
    <div className="space-y-4">
      {form.services.map((s, i) => (
        <div key={s.id || i} className="card grid gap-4 p-5 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end">
          <div className="space-y-3">
            <Field label="Service title" required>
              <Input value={s.title} onChange={(e) => update(i, { title: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input value={s.description || ''} onChange={(e) => update(i, { description: e.target.value })} />
            </Field>
          </div>
          <Field label="Duration">
            <Select value={s.duration_minutes} onChange={(e) => update(i, { duration_minutes: Number(e.target.value) })}>
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Price (₹, excl. GST)">
            <Input type="number" min="0" value={s.price} onChange={(e) => update(i, { price: e.target.value })} />
          </Field>
          <Button variant="ghost" size="icon" aria-label="Remove service" disabled={form.services.length <= 1} onClick={() => set({ services: form.services.filter((_, idx) => idx !== i) })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {form.services.length < 10 && (
        <Button variant="secondary" icon={Plus} onClick={() => set({ services: [...form.services, { title: '', description: '', duration_minutes: durations.includes(60) ? 60 : durations[0], price: 2000 }] })}>
          Add service
        </Button>
      )}
    </div>
  );
}

function PlanTab() {
  const toast = useToast();
  const ent = useEntitlementContext();
  const tiers = useApi(() => entitlementsApi.tiers(), []);
  const [busy, setBusy] = useState(null);

  if (tiers.loading || !ent?.summary) return <PageLoader />;
  if (tiers.error) return <ErrorState error={tiers.error} onRetry={tiers.reload} />;

  const current = ent.summary.tier;
  const featureInfo = ent.summary.features;

  const change = async (tier) => {
    setBusy(tier.key);
    try {
      await entitlementsApi.changeTier(tier.key);
      await ent.refresh();
      toast.success(`Switched to ${tier.name}`, 'Plan billing is simulated in this build.');
    } catch (err) {
      toast.error('Could not change plan', err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.data.tiers.map((tier) => {
          const isCurrent = tier.key === current.key;
          const clientLimit = tier.limits?.max_active_clients;
          return (
            <div key={tier.key} className={`card relative flex flex-col p-6 ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}>
              {isCurrent && (
                <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Sparkles className="h-3 w-3" /> Current plan
                </span>
              )}
              <p className="text-lg font-semibold text-slate-900">{tier.name}</p>
              <p className="text-sm text-slate-500">{tier.description}</p>
              <p className="mt-4 text-3xl font-bold text-slate-900">
                {formatINR(tier.monthly_price)}
                <span className="text-sm font-normal text-slate-500">/month</span>
              </p>
              <p className="text-xs text-slate-500">{tier.platform_fee_percent}% platform fee per client payment</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                <li className="flex gap-2 text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {clientLimit ? `Up to ${clientLimit} active clients` : 'Unlimited active clients'}
                </li>
                {Object.entries(featureInfo)
                  .filter(([key]) => key !== 'clients.active')
                  .map(([key, info]) => {
                    const included = tier.features.includes(key);
                    return (
                      <li key={key} className={`flex gap-2 ${included ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                        {included ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                        {info.label}
                      </li>
                    );
                  })}
              </ul>
              <Button className="mt-6" variant={isCurrent ? 'secondary' : 'primary'} disabled={isCurrent} loading={busy === tier.key} onClick={() => change(tier)}>
                {isCurrent ? 'Current plan' : `Switch to ${tier.name}`}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Plans and limits come from <code>SubscriptionTierConfig</code>. Every gated API is enforced on the server through the entitlement service. Recurring plan billing is simulated: switching applies immediately.
      </p>
    </div>
  );
}

function IntakeTab() {
  const { allowed, loading } = useEntitlement(FEATURES.INTAKE_FORM_BUILDER);
  if (loading) return <PageLoader />;
  if (!allowed) {
    return (
      <LockedFeature
        featureKey={FEATURES.INTAKE_FORM_BUILDER}
        title="Build your own intake questions"
        description="Add custom questions (dropdowns, yes/no, dates and more) to the intake form your clients complete before their first session."
      />
    );
  }
  return <IntakeFormBuilder />;
}

function IntegrationsTab() {
  const { data, loading, error, reload } = useApi(() => systemApi.health(), []);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const rows = [
    { label: 'Database', value: data.database, ok: data.database === 'connected', note: data.demo_mode ? 'In-memory MongoDB fallback when MONGO_URI is empty' : 'MongoDB' },
    { label: 'Payments', value: data.integrations.payments, ok: data.integrations.payments !== 'unavailable', note: data.integrations.payments === 'demo' ? 'Simulated Razorpay with real HMAC signature verification' : 'Razorpay test mode' },
    { label: 'Email', value: data.integrations.email, ok: true, note: data.integrations.email === 'smtp' ? 'Nodemailer via SMTP' : 'Emails logged to the server console (no SMTP configured)' },
    { label: 'WhatsApp', value: data.integrations.whatsapp, ok: true, note: 'Messages queued by a stub provider' },
    { label: 'File storage', value: data.integrations.storage, ok: true, note: data.integrations.storage === 's3' ? 'AWS S3' : 'Local disk storage' },
  ];
  return (
    <div className="card divide-y divide-slate-100">
      <div className="flex items-center justify-between p-5">
        <div>
          <p className="font-semibold text-slate-900">Environment</p>
          <p className="text-sm text-slate-500">Integrations are isolated behind service interfaces and configured with environment variables.</p>
        </div>
        {data.demo_mode && <Badge tone="violet">DEMO_MODE</Badge>}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-slate-900">{r.label}</p>
            <p className="text-xs text-slate-500">{r.note}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${r.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
            {r.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Settings() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'profile';
  const { data, setData, loading, error, reload } = useApi(() => therapistApi.me(), []);
  const config = useApi(() => systemApi.paymentConfig(), []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(toForm(data.therapist));
  }, [data]);

  if (loading || !form) return error ? <ErrorState error={error} onRetry={reload} /> : <PageLoader />;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (form.services.some((s) => !s.title.trim())) return toast.error('Every service needs a title');
    setSaving(true);
    try {
      const res = await therapistApi.update({
        ...form,
        services: form.services.map((s) => ({
          ...(s.id ? { _id: s.id } : {}),
          title: s.title,
          description: s.description,
          duration_minutes: Number(s.duration_minutes),
          price: Math.round(Number(s.price) * 100),
        })),
      });
      setData(res);
      await refreshUser();
      toast.success('Profile saved');
    } catch (err) {
      toast.error('Could not save', err.details?.[0]?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file) => {
    try {
      const res = await therapistApi.uploadPhoto(file);
      setData(res);
      toast.success('Photo updated');
    } catch (err) {
      toast.error('Upload failed', err.message);
    }
  };

  const editable = tab === 'profile' || tab === 'services';

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Your profile, services, intake form and plan."
        actions={
          editable && (
            <Button icon={Save} loading={saving} onClick={save}>
              Save changes
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'profile', label: 'Profile', icon: User },
          { value: 'services', label: 'Services & pricing', icon: Briefcase },
          { value: 'intake', label: 'Intake form', icon: ClipboardList },
          { value: 'plan', label: 'Plan', icon: Sparkles },
          { value: 'integrations', label: 'Integrations', icon: Plug },
        ]}
      />
      {tab === 'profile' && <ProfileTab form={form} set={set} therapist={data.therapist} onPhoto={uploadPhoto} />}
      {tab === 'services' && <ServicesTab form={form} set={set} durations={config.data?.session_durations || [30, 45, 60, 90]} />}
      {tab === 'intake' && <IntakeTab />}
      {tab === 'plan' && <PlanTab />}
      {tab === 'integrations' && <IntegrationsTab />}
    </div>
  );
}
