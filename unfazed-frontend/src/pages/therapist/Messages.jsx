import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Search } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Avatar from '../../components/common/Avatar';
import { Input } from '../../components/common/Field';
import { CardSkeleton } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/States';
import ChatWindow from '../../components/chat/ChatWindow';
import LockedFeature from '../../components/entitlements/LockedFeature';
import { chatApi } from '../../api/endpoints';
import { useSocket } from '../../context/SocketContext';
import useApi from '../../hooks/useApi';
import useEntitlement, { FEATURES } from '../../hooks/useEntitlement';
import { fmtRelative } from '../../utils/format';

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const activeId = params.get('client');
  const [query, setQuery] = useState('');
  const chat = useEntitlement(FEATURES.CHAT);
  const { socket } = useSocket();
  const { data, setData, loading, error, reload } = useApi(() => chatApi.conversations(), []);

  // Unread badges for conversations that are not open.
  useEffect(() => {
    if (!socket) return undefined;
    const onUnread = ({ client_id: cid, message }) => {
      setData((d) => {
        if (!d) return d;
        const exists = d.conversations.some((c) => c.client.id === cid);
        if (!exists) {
          reload({ silent: true });
          return d;
        }
        const updated = d.conversations.map((c) =>
          c.client.id === cid
            ? { ...c, last_message: message.body, last_sender: message.sender_role, last_at: message.created_at, unread: cid === activeId ? 0 : c.unread + 1 }
            : c
        );
        return { conversations: updated.sort((a, b) => new Date(b.last_at || 0) - new Date(a.last_at || 0)) };
      });
    };
    socket.on('chat:unread', onUnread);
    return () => socket.off('chat:unread', onUnread);
  }, [socket, setData, reload, activeId]);

  const onActivity = useCallback(
    (msg) => {
      setData((d) =>
        d
          ? { conversations: d.conversations.map((c) => (c.client.id === msg.client_id ? { ...c, last_message: msg.body, last_sender: msg.sender_role, last_at: msg.created_at, unread: 0 } : c)) }
          : d
      );
    },
    [setData]
  );

  const open = (id) => {
    setParams({ client: id }, { replace: true });
    setData((d) => (d ? { conversations: d.conversations.map((c) => (c.client.id === id ? { ...c, unread: 0 } : c)) } : d));
  };

  const loadMessages = useCallback(() => chatApi.messages(activeId), [activeId]);
  const sendMessage = useCallback((body) => chatApi.send(activeId, body), [activeId]);

  const conversations = useMemo(
    () => (data?.conversations || []).filter((c) => c.client.name.toLowerCase().includes(query.toLowerCase())),
    [data, query]
  );
  const active = data?.conversations.find((c) => c.client.id === activeId);

  if (!chat.loading && !chat.allowed) {
    return (
      <div>
        <PageHeader title="Messages" />
        <LockedFeature featureKey={FEATURES.CHAT} title="Secure messaging is not on your plan" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Messages" description="Secure, real-time conversations with your clients." />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <CardSkeleton rows={6} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className={`card flex flex-col overflow-hidden ${activeId ? 'hidden lg:flex' : ''}`}>
            <div className="border-b border-slate-200 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[calc(100vh-17rem)] flex-1 divide-y divide-slate-100 overflow-y-auto">
              {conversations.length === 0 && <EmptyState compact icon={MessageSquare} title="No conversations" />}
              {conversations.map((c) => (
                <button
                  key={c.client.id}
                  onClick={() => open(c.client.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${c.client.id === activeId ? 'bg-brand-50/60' : ''}`}
                >
                  <Avatar name={c.client.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${c.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>{c.client.name}</p>
                      {c.last_at && <span className="shrink-0 text-[11px] text-slate-400">{fmtRelative(c.last_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-slate-500">
                        {c.last_message ? `${c.last_sender === 'therapist' ? 'You: ' : ''}${c.last_message}` : 'No messages yet'}
                      </p>
                      {c.unread > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={activeId ? '' : 'hidden lg:block'}>
            {active ? (
              <>
                <button onClick={() => setParams({}, { replace: true })} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 lg:hidden">
                  <ArrowLeft className="h-4 w-4" /> Conversations
                </button>
                <ChatWindow
                  key={active.client.id}
                  role="therapist"
                  clientId={active.client.id}
                  title={active.client.name}
                  subtitle={active.client.email}
                  loadMessages={loadMessages}
                  sendMessage={sendMessage}
                  onActivity={onActivity}
                />
              </>
            ) : (
              <div className="card">
                <EmptyState icon={MessageSquare} title={activeId ? 'Conversation not found' : 'Select a conversation'} description="Choose a client on the left to start chatting." />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
