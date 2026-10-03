import { Field, TextArea } from '../common/Field';

export const TEMPLATE_FIELDS = {
  soap: [
    { key: 'subjective', label: 'Subjective', hint: "Client's reported experience, mood and concerns" },
    { key: 'objective', label: 'Objective', hint: 'Observations, affect, measures (e.g. GAD-7, PHQ-9)' },
    { key: 'assessment', label: 'Assessment', hint: 'Clinical impressions and progress' },
    { key: 'plan', label: 'Plan', hint: 'Interventions, homework, next steps' },
  ],
  dap: [
    { key: 'data', label: 'Data', hint: 'What happened in session - observations and statements' },
    { key: 'assessment', label: 'Assessment', hint: 'Your interpretation and progress' },
    { key: 'plan', label: 'Plan', hint: 'Next steps and follow-up' },
  ],
};

/** Structured SOAP / DAP note template. */
export default function SoapTemplate({ format, value = {}, onChange }) {
  return (
    <div className="space-y-4">
      {TEMPLATE_FIELDS[format].map((f) => (
        <Field key={f.key} label={f.label} hint={f.hint}>
          <TextArea rows={3} value={value[f.key] || ''} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
        </Field>
      ))}
    </div>
  );
}

export function StructuredNoteView({ format, structured }) {
  const fields = TEMPLATE_FIELDS[format] || [];
  return (
    <dl className="space-y-3">
      {fields.map((f) => (
        <div key={f.key}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</dt>
          <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{structured?.[f.key] || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
