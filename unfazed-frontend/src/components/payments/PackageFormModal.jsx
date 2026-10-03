import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Field, Input, Select, TextArea, Toggle } from '../common/Field';
import { formatINR } from '../../utils/format';

export default function PackageFormModal({ open, onClose, onSubmit, initial, config }) {
  const sizes = config?.package_sizes || [3, 6, 12];
  const durations = config?.session_durations || [30, 45, 60, 90];
  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset(
      initial
        ? { ...initial, per_session_rate: initial.per_session_rate / 100 }
        : { name: '', description: '', session_count: sizes[1] || sizes[0], per_session_rate: 2000, duration_minutes: 60, validity_days: 90, active: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const count = Number(watch('session_count')) || 0;
  const rate = Number(watch('per_session_rate')) || 0;
  const active = watch('active');

  const submit = async (values) => {
    try {
      await onSubmit({
        name: values.name,
        description: values.description,
        session_count: Number(values.session_count),
        per_session_rate: Math.round(Number(values.per_session_rate) * 100),
        duration_minutes: Number(values.duration_minutes),
        validity_days: Number(values.validity_days),
        active: Boolean(values.active),
      });
    } catch (err) {
      if (err.code !== 'UPGRADE_REQUIRED') setError('root', { message: err.message });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit package' : 'New session package'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {errors.root && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.root.message}</div>}
        <Field label="Package name" error={errors.name?.message} required>
          <Input placeholder="e.g. Steady Growth" {...register('name', { required: 'Name is required' })} />
        </Field>
        <Field label="Description">
          <TextArea rows={2} {...register('description')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sessions" required>
            <Select {...register('session_count')}>
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s} sessions
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Session length" required>
            <Select {...register('duration_minutes')}>
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Price per session (₹)" error={errors.per_session_rate?.message} required>
            <Input type="number" min="1" step="1" {...register('per_session_rate', { required: 'Required', min: { value: 1, message: 'Must be positive' } })} />
          </Field>
          <Field label="Valid for (days)" error={errors.validity_days?.message} required>
            <Input type="number" min="7" max="730" {...register('validity_days', { required: 'Required', min: { value: 7, message: 'At least 7 days' } })} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm text-slate-500">Package total (before GST)</p>
            <p className="text-lg font-bold text-slate-900">{formatINR(count * rate * 100)}</p>
          </div>
          <Toggle checked={Boolean(active)} onChange={(v) => setValue('active', v)} label={active ? 'Visible to clients' : 'Hidden'} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {initial ? 'Save changes' : 'Create package'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
