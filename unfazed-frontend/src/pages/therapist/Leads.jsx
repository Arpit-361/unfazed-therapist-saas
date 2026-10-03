import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Mail, Phone, UserCheck } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Badge, { StatusBadge } from '../../components/common/Badge';
import Tabs from '../../components/common/Tabs';
import { Select } from '../../components/common/Field';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import InviteLinkModal from '../../components/crm/InviteLinkModal';
import { leadsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useEntitlementContext } from '../../context/EntitlementContext';
import useApi from '../../hooks/useApi';
import { fmtRelative } from '../../utils/format';

const FILTERS = [
  { value: 'open', label: 'Open', statuses: ['new', 'contacted'] },
  { value: 'converted', label: 'Converted', statuses: ['converted'] },
  { value: 'closed', label: 'Closed', statuses: ['closed'] },
  { value: 'all', label: 'All', statuses: null },
];

export default function Leads() {
  const toast = useToast();
  const entitlements = useEntitlementContext();
  const [filter, setFilter] = useState('open');
  const [converting, setConverting] = useState(null);
  const [invite, setInvite] = useState(null);
  const { data, setData, loading, error, reload } = useApi(() => leadsApi.list(), []);

  const leads = data?.leads || [];
  const statuses = FILTERS.find((f) => f.value === filter).statuses;
  const visible = statuses ? leads.filter((l) => statuses.includes(l.status)) : leads;
  const countFor = (f) => (f.statuses ? leads.filter((l) => f.statuses.includes(l.status)).length : leads.length);

  const replace = (lead) => setData((d) => ({ leads: d.leads.map((l) => (l.id === lead.id ? lead : l)) }));

  const setStatus = async (lead, status) => {
    try {
      const res = await leadsApi.update(lead.id, { status });
      replace(res.lead);
    } catch (err) {
      toast.error('Could not update lead', err.message);
    }
  };

  const convert = async (lead) => {
    setConverting(lead.id);
    try {
      const res = await leadsApi.convert(lead.id);
      replace(res.lead);
      setInvite({ url: res.invite_url, name: res.client.name });
      entitlements?.refresh();
    } catch (err) {
      if (err.code !== 'UPGRADE_REQUIRED') toast.error('Could not convert lead', err.message);
    } finally {
      setConverting(null);
    }
  };

  return (
    <div>
      <PageHeader title="Leads" description="Enquiries from your public profile and the Unfazed directory." />
      <Tabs value={filter} onChange={setFilter} tabs={FILTERS.map((f) => ({ value: f.value, label: f.label, count: countFor(f) }))} />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <CardSkeleton rows={4} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState icon={Inbox} title="No leads here" description="New enquiries from your branded profile will appear here instantly." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((lead) => (
            <div key={lead.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{lead.name}</p>
                  <p className="text-xs text-slate-500">
                    {fmtRelative(lead.created_at)} · via {lead.source === 'directory' ? 'Unfazed directory' : 'your profile'}
                  </p>
                </div>
                <StatusBadge status={lead.status} />
              </div>
              {lead.message && <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{lead.message}</p>}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                  <Mail className="h-3.5 w-3.5" /> {lead.email}
                </a>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                    <Phone className="h-3.5 w-3.5" /> {lead.phone}
                  </a>
                )}
              </div>
              {(lead.preferences?.language || lead.preferences?.specialization) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {lead.preferences.language && <Badge tone="blue">{lead.preferences.language}</Badge>}
                  {lead.preferences.specialization && <Badge tone="brand">{lead.preferences.specialization}</Badge>}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                {lead.status === 'converted' ? (
                  <Button size="sm" variant="soft" to={`/dashboard/clients/${lead.converted_client_id}`}>
                    View client
                  </Button>
                ) : (
                  <>
                    <Select className="!h-8 w-36 !py-0 text-xs" value={lead.status} onChange={(e) => setStatus(lead, e.target.value)} aria-label="Lead status">
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="closed">Closed</option>
                    </Select>
                    <Button size="sm" icon={UserCheck} loading={converting === lead.id} onClick={() => convert(lead)}>
                      Convert to client
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-center text-xs text-slate-400">
        Converting a lead creates a client record and emails a portal invitation. Manage clients in <Link to="/dashboard/clients" className="underline">Clients</Link>.
      </p>
      <InviteLinkModal open={Boolean(invite)} onClose={() => setInvite(null)} inviteUrl={invite?.url} clientName={invite?.name} />
    </div>
  );
}
