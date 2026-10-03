import { Copy, MailCheck } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Input } from '../common/Field';
import { copyToClipboard } from '../../utils/download';
import { useToast } from '../../context/ToastContext';

export default function InviteLinkModal({ open, onClose, inviteUrl, clientName }) {
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Invitation sent" footer={<Button onClick={onClose}>Done</Button>}>
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm">
          We emailed {clientName || 'your client'} an invitation to set up their portal, complete intake and give consent. You can also share this link directly (valid for 7 days):
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <Input value={inviteUrl || ''} readOnly onFocus={(e) => e.target.select()} />
        <Button
          variant="secondary"
          icon={Copy}
          onClick={async () => {
            if (await copyToClipboard(inviteUrl)) toast.success('Invite link copied');
          }}
        >
          Copy
        </Button>
      </div>
    </Modal>
  );
}
