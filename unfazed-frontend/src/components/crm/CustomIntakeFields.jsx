import { Field, Input, Select, TextArea } from '../common/Field';

const fieldName = (id) => `custom_answers.${id}`;

/** Maps stored custom_responses to react-hook-form default values. */
export function customAnswerDefaults(responses = []) {
  return Object.fromEntries(
    responses.map((r) => [r.field_id, r.type === 'yes_no' ? (r.value ? 'yes' : 'no') : String(r.value ?? '')])
  );
}

/** Renders a therapist's custom intake questions inside a react-hook-form form. */
export default function CustomIntakeFields({ fields, register, errors = {} }) {
  return (
    <div className="grid gap-4">
      {fields.map((f) => {
        const error = errors.custom_answers?.[f.id]?.message;
        const rules = f.required ? { required: 'This question is required' } : {};
        return (
          <Field key={f.id} label={f.label} required={f.required} error={error} hint={f.help}>
            {f.type === 'short_text' && <Input maxLength={300} {...register(fieldName(f.id), rules)} />}
            {f.type === 'long_text' && <TextArea rows={3} maxLength={3000} {...register(fieldName(f.id), rules)} />}
            {f.type === 'number' && <Input type="number" step="any" {...register(fieldName(f.id), rules)} />}
            {f.type === 'date' && <Input type="date" {...register(fieldName(f.id), rules)} />}
            {f.type === 'select' && (
              <Select {...register(fieldName(f.id), rules)}>
                <option value="">Select…</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            )}
            {f.type === 'yes_no' && (
              <div className="flex gap-5 pt-1">
                {['yes', 'no'].map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="radio" value={v} className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500" {...register(fieldName(f.id), rules)} />
                    {v === 'yes' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            )}
          </Field>
        );
      })}
    </div>
  );
}

/** Read-only display of stored answers for the therapist. */
export function CustomResponsesList({ responses = [] }) {
  const display = (r) => {
    if (r.type === 'yes_no') return r.value ? 'Yes' : 'No';
    return String(r.value ?? '—');
  };
  return (
    <dl className="divide-y divide-slate-100">
      {responses.map((r) => (
        <div key={r.field_id} className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-slate-500">{r.label}</dt>
          <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-800 sm:col-span-2 sm:mt-0">{display(r)}</dd>
        </div>
      ))}
    </dl>
  );
}
