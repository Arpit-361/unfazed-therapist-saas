import { FileText } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import { StructuredNoteView } from '../../components/notes/SoapTemplate';
import { usePortal } from '../../components/layout/PortalLayout';
import { portalApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import { fmtDateTime } from '../../utils/format';

export default function SharedNotes() {
  const { therapist, client } = usePortal();
  const { data, loading, error, reload } = useApi(() => portalApi.notes(), []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Shared notes" description={`Notes and resources ${therapist.name} has chosen to share with you.`} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <CardSkeleton rows={3} />
      ) : data.notes.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileText} title="Nothing shared yet" description="When your therapist shares session summaries or exercises, they'll appear here." />
        </div>
      ) : (
        <div className="space-y-4">
          {data.notes.map((n) => (
            <article key={n.id} className="card p-5 sm:p-6">
              <header className="mb-3 border-b border-slate-100 pb-3">
                <h2 className="font-semibold text-slate-900">{n.title || 'Session note'}</h2>
                <p className="text-xs text-slate-500">{fmtDateTime(n.created_at, client.timezone)}</p>
              </header>
              {n.format === 'freeform' ? (
                // Content is sanitized server-side with an allow-list of formatting tags.
                <div className="prose-note" dangerouslySetInnerHTML={{ __html: n.content }} />
              ) : (
                <StructuredNoteView format={n.format} structured={n.structured} />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
