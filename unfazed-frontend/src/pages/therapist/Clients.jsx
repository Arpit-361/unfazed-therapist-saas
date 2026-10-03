import { useEffect, useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/Field';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import ClientTable from '../../components/crm/ClientTable';
import AddClientModal from '../../components/crm/AddClientModal';
import InviteLinkModal from '../../components/crm/InviteLinkModal';
import { clientsApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import useEntitlement, { FEATURES } from '../../hooks/useEntitlement';
import { useEntitlementContext } from '../../context/EntitlementContext';

export default function Clients() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState({ sort: 'name', order: 'asc' });
  const [addOpen, setAddOpen] = useState(false);
  const [invite, setInvite] = useState(null);
  const clientCap = useEntitlement(FEATURES.ACTIVE_CLIENTS);
  const entitlements = useEntitlementContext();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, reload } = useApi(
    () => clientsApi.list({ search: debounced || undefined, status: status || undefined, tag: tag || undefined, ...sort }),
    [debounced, status, tag, sort.sort, sort.order]
  );

  const capacity = data?.capacity;
  const openAdd = () => {
    if (clientCap.requireAccess()) setAddOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        description={capacity ? `${capacity.usage} active${capacity.limit ? ` of ${capacity.limit} on your plan` : ' · unlimited on your plan'}` : 'Your client relationships in one place.'}
        actions={
          <Button icon={UserPlus} onClick={openAdd}>
            Add client
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All (excl. archived)</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </Select>
        <Select className="sm:w-44" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {(data?.tags || []).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <CardSkeleton rows={6} />
      ) : data.clients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={debounced || status || tag ? 'No clients match your filters' : 'No clients yet'}
            description={debounced || status || tag ? 'Try a different search or filter.' : 'Add your first client or share your booking link to get started.'}
            action={!debounced && !status && !tag && <Button icon={UserPlus} onClick={openAdd}>Add client</Button>}
          />
        </div>
      ) : (
        <ClientTable clients={data.clients} sort={sort.sort} order={sort.order} onSort={(s, o) => setSort({ sort: s, order: o })} />
      )}

      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(res) => {
          setAddOpen(false);
          setInvite({ url: res.invite_url, name: res.client.name });
          reload({ silent: true });
          entitlements?.refresh();
        }}
      />
      <InviteLinkModal open={Boolean(invite)} onClose={() => setInvite(null)} inviteUrl={invite?.url} clientName={invite?.name} />
    </div>
  );
}
