import { useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import ChatWindow from '../../components/chat/ChatWindow';
import { usePortal } from '../../components/layout/PortalLayout';
import { portalApi } from '../../api/endpoints';

export default function ClientMessages() {
  const { client, therapist, features } = usePortal();
  const loadMessages = useCallback(() => portalApi.messages(), []);
  const sendMessage = useCallback((body) => portalApi.sendMessage(body), []);

  if (!features.chat) return <Navigate to="/portal" replace />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Messages" description="For scheduling and between-session check-ins. In an emergency, call 112 or Tele-MANAS at 14416." />
      <ChatWindow role="client" clientId={client.id} title={therapist.name} subtitle={therapist.title} loadMessages={loadMessages} sendMessage={sendMessage} />
    </div>
  );
}
