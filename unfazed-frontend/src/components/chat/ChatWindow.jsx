import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Wifi, WifiOff } from 'lucide-react';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import { Spinner } from '../common/Loader';
import { EmptyState, ErrorState } from '../common/States';
import MessageBubble from './MessageBubble';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { fmtDayLabel } from '../../utils/format';

/**
 * Real-time conversation between one therapist and one client.
 * Socket.io is used when connected; REST is the fallback for loading and sending.
 *
 * props:
 *   role        'therapist' | 'client' (the viewer)
 *   clientId    conversation key (the client's id)
 *   title       counterpart display name
 *   loadMessages() => Promise<{messages}>
 *   sendMessage(body) => Promise<{message}>
 */
export default function ChatWindow({ role, clientId, title, subtitle, loadMessages, sendMessage, onActivity }) {
  const { socket, connected } = useSocket();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const typingSent = useRef(false);
  const loaderRef = useRef(loadMessages);
  loaderRef.current = loadMessages;

  const append = useCallback((msg) => {
    setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loaderRef.current();
      setMessages(res.messages);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [clientId, load]);

  useEffect(() => {
    if (!socket || !clientId) return undefined;
    if (role === 'therapist') socket.emit('chat:join', { clientId });

    const onMessage = (msg) => {
      if (msg.client_id !== clientId) return;
      append(msg);
      if (msg.sender_role !== role) {
        socket.emit('chat:read', { clientId });
        setOtherTyping(false);
      }
      onActivity?.(msg);
    };
    const onTyping = (evt) => {
      if (evt.client_id === clientId && evt.role !== role) setOtherTyping(evt.typing);
    };
    const onRead = (evt) => {
      if (evt.client_id !== clientId || evt.reader_role === role) return;
      setMessages((list) => list.map((m) => (m.sender_role === role && !m.read_at ? { ...m, read_at: evt.read_at } : m)));
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:read', onRead);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:read', onRead);
      if (role === 'therapist') socket.emit('chat:leave', { clientId });
    };
  }, [socket, clientId, role, append, onActivity]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, otherTyping]);

  const emitTyping = (typing) => {
    if (!socket || !connected || typingSent.current === typing) return;
    typingSent.current = typing;
    socket.emit('chat:typing', { clientId, typing });
  };

  const onChange = (e) => {
    setText(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1800);
  };

  const sendViaRest = async (body) => {
    const res = await sendMessage(body);
    append(res.message);
    onActivity?.(res.message);
  };

  const submit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    clearTimeout(typingTimer.current);
    emitTyping(false);
    try {
      if (socket && connected) {
        const ack = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve({ ok: false }), 5000);
          socket.emit('chat:send', { clientId, body }, (reply) => {
            clearTimeout(timer);
            resolve(reply || { ok: false });
          });
        });
        if (ack.ok) {
          append(ack.message);
          onActivity?.(ack.message);
        } else {
          // REST gives a consistent error path (including the upgrade prompt).
          await sendViaRest(body);
        }
      } else {
        await sendViaRest(body);
      }
      setText('');
    } catch (err) {
      if (err.code !== 'UPGRADE_REQUIRED') toast.error('Message not sent', err.message);
    } finally {
      setSending(false);
    }
  };

  let lastDay = null;

  return (
    <div className="card flex h-[calc(100vh-13rem)] min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={title} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
            <p className="truncate text-xs text-slate-500">{otherTyping ? 'typing…' : subtitle}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs ${connected ? 'text-emerald-600' : 'text-slate-400'}`} title={connected ? 'Real-time connected' : 'Offline - messages send via the API'}>
          {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50/60 px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={load} />
        ) : messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No messages yet" description="Say hello - messages are private between you two." />
        ) : (
          messages.map((m) => {
            const day = fmtDayLabel(m.created_at);
            const divider = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id}>
                {divider && (
                  <div className="my-3 text-center">
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">{day}</span>
                  </div>
                )}
                <MessageBubble message={m} mine={m.sender_role === role} />
              </div>
            );
          })
        )}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
        <textarea
          rows={1}
          value={text}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          placeholder="Write a message…"
          maxLength={2000}
          className="input max-h-32 min-h-[42px] flex-1 resize-none"
        />
        <Button type="submit" size="icon" loading={sending} disabled={!text.trim()} aria-label="Send">
          {!sending && <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
