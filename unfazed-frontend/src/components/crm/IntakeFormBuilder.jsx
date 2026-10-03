import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowDown, ArrowUp, Braces, Eye, GripVertical, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import TagInput from '../common/TagInput';
import { Field, Input, Select, Toggle } from '../common/Field';
import { PageLoader } from '../common/Loader';
import { EmptyState, ErrorState } from '../common/States';
import CustomIntakeFields from './CustomIntakeFields';
import { therapistApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import { fmtDateTime } from '../../utils/format';

let keySeq = 0;
const withKey = (field) => ({ ...field, _key: `k${++keySeq}` });
const stripKeys = (fields) => fields.map(({ _key, ...f }) => f);

function Preview({ fields }) {
  const { register } = useForm();
  const ready = fields.filter((f) => f.label.trim().length >= 2 && (f.type !== 'select' || f.options.length >= 2));
  return (
    <div className="card p-5 lg:sticky lg:top-4">
      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
        <Eye className="h-4 w-4 text-brand-600" /> Client preview
      </h3>
      <p className="mt-1 text-xs text-slate-500">Shown after the standard intake questions in the client portal.</p>
      <div className="mt-4">
        {ready.length ? (
          <CustomIntakeFields fields={ready.map((f) => ({ ...f, id: f._key }))} register={register} />
        ) : (
          <p className="text-sm text-slate-400">Add a question to see how clients will answer it.</p>
        )}
      </div>
    </div>
  );
}

function FieldCard({ field, index, count, types, armed, setArmed, onChange, onRemove, onMove, dnd }) {
  return (
    <div
      draggable={armed}
      onDragStart={(e) => dnd.start(e, index)}
      onDragOver={(e) => dnd.over(e, index)}
      onDragEnd={dnd.end}
      className={`card p-4 transition ${dnd.dragging === index ? 'opacity-50 ring-2 ring-brand-300' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={() => setArmed(true)}
          onPointerUp={() => setArmed(false)}
          className="mt-8 cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="grid flex-1 gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
            <Field label={`Question ${index + 1}`}>
              <Input value={field.label} maxLength={160} placeholder="e.g. How would you rate your sleep?" onChange={(e) => onChange({ label: e.target.value })} />
            </Field>
            <Field label="Answer type">
              <Select value={field.type} onChange={(e) => onChange({ type: e.target.value, options: e.target.value === 'select' ? field.options : [] })}>
                {types.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {field.type === 'select' && (
            <Field label="Options" hint="Press Enter after each option (at least 2).">
              <TagInput value={field.options} max={20} placeholder="Add an option" onChange={(options) => onChange({ options })} />
            </Field>
          )}
          <Field label="Help text (optional)">
            <Input value={field.help} maxLength={240} onChange={(e) => onChange({ help: e.target.value })} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Toggle checked={field.required} onChange={(required) => onChange({ required })} label="Required" />
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" icon={ArrowUp} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="Move up" />
              <Button size="sm" variant="ghost" icon={ArrowDown} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label="Move down" />
              <Button size="sm" variant="ghost" icon={Trash2} className="!text-rose-600" onClick={onRemove}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntakeFormBuilder() {
  const toast = useToast();
  const { data, setData, loading, error, reload } = useApi(() => therapistApi.intakeForm(), []);
  const [fields, setFields] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [armed, setArmed] = useState(null);
  const [dragging, setDragging] = useState(null);
  const dragFrom = useRef(null);

  useEffect(() => {
    if (data) {
      setFields(data.fields.map(withKey));
      setDirty(false);
    }
  }, [data]);

  if (loading || (!fields && !error)) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const update = (next) => {
    setFields(next);
    setDirty(true);
  };
  const move = (from, to) => {
    if (to < 0 || to >= fields.length || from === to) return;
    const next = [...fields];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  };

  const dnd = {
    dragging,
    start: (e, index) => {
      dragFrom.current = index;
      setDragging(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    over: (e, index) => {
      e.preventDefault();
      if (dragFrom.current === null || dragFrom.current === index) return;
      move(dragFrom.current, index);
      dragFrom.current = index;
      setDragging(index);
    },
    end: () => {
      dragFrom.current = null;
      setDragging(null);
      setArmed(null);
    },
  };

  const discard = () => {
    setFields(data.fields.map(withKey));
    setDirty(false);
  };

  const add = (type) => update([...fields, withKey({ label: '', type, required: false, help: '', options: [] })]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await therapistApi.updateIntakeForm(stripKeys(fields));
      setData(res);
      toast.success('Intake form saved', 'New clients will see these questions during onboarding.');
    } catch (err) {
      if (err.code !== 'UPGRADE_REQUIRED') toast.error('Could not save form', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Custom intake questions</h3>
            <p className="text-sm text-slate-500">
              Added after the standard demographics, concern and history sections. {fields.length}/{data.max_fields} questions
              {data.updated_at && <> · saved {fmtDateTime(data.updated_at)}</>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={RotateCcw} disabled={!dirty || saving} onClick={discard}>
              Discard
            </Button>
            <Button icon={Save} loading={saving} disabled={!dirty} onClick={save}>
              Save form
            </Button>
          </div>
        </div>

        {fields.length === 0 && (
          <EmptyState compact icon={Plus} title="No custom questions yet" description="Clients will only see the standard intake form until you add questions." />
        )}

        {fields.map((field, index) => (
          <FieldCard
            key={field._key}
            field={field}
            index={index}
            count={fields.length}
            types={data.field_types}
            armed={armed === index}
            setArmed={(on) => setArmed(on ? index : null)}
            onChange={(patch) => update(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))}
            onRemove={() => update(fields.filter((_, i) => i !== index))}
            onMove={move}
            dnd={dnd}
          />
        ))}

        <div className="card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add a question</p>
          <div className="flex flex-wrap gap-2">
            {data.field_types.map((t) => (
              <Button key={t.key} size="sm" variant="secondary" icon={Plus} disabled={fields.length >= data.max_fields} onClick={() => add(t.key)}>
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        <details className="card p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <Braces className="h-4 w-4 text-brand-600" /> Saved JSON schema
          </summary>
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{JSON.stringify(data.json_schema, null, 2)}</pre>
        </details>
      </div>
      <Preview fields={fields} />
    </div>
  );
}
