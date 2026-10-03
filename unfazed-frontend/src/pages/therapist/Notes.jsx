import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, FileText, Lock, Plus, Save, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { StatusBadge } from '../../components/common/Badge';
import { Field, Input, Select } from '../../components/common/Field';
import { PageLoader } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import NoteEditor from '../../components/notes/NoteEditor';
import SoapTemplate from '../../components/notes/SoapTemplate';
import { clientsApi, notesApi, schedulingApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useEntitlement, { FEATURES } from '../../hooks/useEntitlement';
import { fmtDateTime, fmtShortDate } from '../../utils/format';

const EMPTY = { id: null, client_id: '', session_id: '', type: 'private', format: 'freeform', title: '', content: '', structured: {} };

export default function Notes() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const templates = useEntitlement(FEATURES.NOTE_TEMPLATES);
  const notes = useApi(() => notesApi.list(), []);
  const clients = useApi(() => clientsApi.list({ status: 'active,invited,inactive' }), []);
  const [filter, setFilter] = useState({ client: '', type: '' });
  const [draft, setDraft] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [saving, setSaving] = useState(false);

  // Deep links: ?note=<id>, ?client=<id>&session=<id>
  useEffect(() => {
    if (!notes.data) return;
    const noteId = params.get('note');
    const clientId = params.get('client');
    if (noteId) {
      const note = notes.data.notes.find((n) => n.id === noteId);
      if (note) setDraft({ ...note, session_id: note.session_id || '' });
    } else if (clientId && !draft) {
      setDraft({ ...EMPTY, client_id: clientId, session_id: params.get('session') || '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes.data, params]);

  useEffect(() => {
    if (!draft?.client_id) return setSessions([]);
    schedulingApi
      .sessions({ client_id: draft.client_id, status: 'confirmed,completed,no_show', order: 'desc', limit: 30 })
      .then((r) => setSessions(r.sessions))
      .catch(() => setSessions([]));
  }, [draft?.client_id]);

  const visible = useMemo(
    () => (notes.data?.notes || []).filter((n) => (!filter.client || n.client_id === filter.client) && (!filter.type || n.type === filter.type)),
    [notes.data, filter]
  );

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const chooseFormat = (format) => {
    if (format !== 'freeform' && !templates.requireAccess()) return;
    set({ format });
  };

  const save = async () => {
    if (!draft.client_id) return toast.error('Select a client for this note');
    setSaving(true);
    const body = {
      client_id: draft.client_id,
      session_id: draft.session_id || undefined,
      type: draft.type,
      format: draft.format,
      title: draft.title,
      content: draft.format === 'freeform' ? draft.content : '',
      structured: draft.format === 'freeform' ? undefined : draft.structured,
    };
    try {
      const res = draft.id ? await notesApi.update(draft.id, body) : await notesApi.create(body);
      toast.success(draft.id ? 'Note updated' : 'Note saved', draft.type === 'shared' ? 'Visible in the client portal.' : 'Private - only you can see this.');
      setDraft({ ...res.note, session_id: res.note.session_id || '' });
      notes.setData((d) => ({ notes: draft.id ? d.notes.map((n) => (n.id === res.note.id ? res.note : n)) : [res.note, ...d.notes] }));
      setParams({ note: res.note.id }, { replace: true });
    } catch (err) {
      if (err.code !== 'UPGRADE_REQUIRED') toast.error('Could not save note', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft.id || !window.confirm('Delete this note permanently?')) return;
    try {
      await notesApi.remove(draft.id);
      notes.setData((d) => ({ notes: d.notes.filter((n) => n.id !== draft.id) }));
      setDraft(null);
      setParams({}, { replace: true });
      toast.success('Note deleted');
    } catch (err) {
      toast.error('Could not delete note', err.message);
    }
  };

  if (notes.loading || clients.loading) return <PageLoader />;
  if (notes.error) return <ErrorState error={notes.error} onRetry={notes.reload} />;

  const clientList = clients.data?.clients || [];

  return (
    <div>
      <PageHeader
        title="Clinical notes"
        description="Private notes stay with you. Shared notes appear in your client's portal."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setDraft({ ...EMPTY, client_id: filter.client });
              setParams({}, { replace: true });
            }}
          >
            New note
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={filter.client} onChange={(e) => setFilter({ ...filter, client: e.target.value })}>
              <option value="">All clients</option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
              <option value="">All types</option>
              <option value="private">Private</option>
              <option value="shared">Shared</option>
            </Select>
          </div>
          <div className="card max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {visible.length === 0 && <EmptyState compact icon={FileText} title="No notes" description="Create your first note." />}
            {visible.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setDraft({ ...n, session_id: n.session_id || '' });
                  setParams({ note: n.id }, { replace: true });
                }}
                className={`block w-full p-4 text-left transition hover:bg-slate-50 ${draft?.id === n.id ? 'bg-brand-50/60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{n.title || 'Untitled note'}</p>
                  {n.type === 'private' ? <EyeOff className="h-4 w-4 shrink-0 text-violet-500" /> : <Eye className="h-4 w-4 shrink-0 text-brand-600" />}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {n.client?.name} · {fmtShortDate(n.created_at)} · <span className="uppercase">{n.format}</span>
                </p>
              </button>
            ))}
          </div>
        </div>

        {draft ? (
          <div className="card space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" required>
                <Select value={draft.client_id} onChange={(e) => set({ client_id: e.target.value, session_id: '' })} disabled={Boolean(draft.id)}>
                  <option value="">Select a client</option>
                  {clientList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Linked session (optional)">
                <Select value={draft.session_id} onChange={(e) => set({ session_id: e.target.value })} disabled={!draft.client_id}>
                  <option value="">Not linked to a session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {fmtDateTime(s.start_time)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div>
              <p className="label">Visibility</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: 'private', icon: EyeOff, title: 'Private', text: 'Only you. Never returned by any client-facing API.' },
                  { value: 'shared', icon: Eye, title: 'Shared with client', text: 'Visible in the client portal.' },
                ].map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set({ type: o.value })}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${draft.type === o.value ? 'border-brand-600 bg-brand-50/60 ring-4 ring-brand-500/10' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <o.icon className={`mt-0.5 h-4 w-4 ${o.value === 'private' ? 'text-violet-600' : 'text-brand-600'}`} />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
                      <span className="block text-xs text-slate-500">{o.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Format</p>
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {['freeform', 'soap', 'dap'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => chooseFormat(f)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${draft.format === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {f === 'freeform' ? 'Freeform' : f.toUpperCase()}
                    {f !== 'freeform' && !templates.allowed && <Lock className="h-3 w-3 text-amber-500" />}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Title">
              <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Session 4 - CBT thought records" />
            </Field>

            {draft.format === 'freeform' ? (
              <NoteEditor value={draft.content} onChange={(content) => set({ content })} />
            ) : (
              <SoapTemplate format={draft.format} value={draft.structured} onChange={(structured) => set({ structured })} />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <StatusBadge status={draft.type} />
                {draft.updated_at && <span>Last saved {fmtDateTime(draft.updated_at)}</span>}
              </div>
              <div className="flex gap-2">
                {draft.id && (
                  <Button variant="ghost" icon={Trash2} onClick={remove}>
                    Delete
                  </Button>
                )}
                <Button icon={Save} onClick={save} loading={saving}>
                  Save note
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <EmptyState icon={FileText} title="Select or create a note" description="Choose a note from the list, or start a new one." action={<Button icon={Plus} onClick={() => setDraft({ ...EMPTY })}>New note</Button>} />
          </div>
        )}
      </div>
    </div>
  );
}
