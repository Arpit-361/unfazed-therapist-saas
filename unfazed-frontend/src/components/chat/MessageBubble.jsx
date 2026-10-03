import { Check, CheckCheck } from 'lucide-react';
import { fmtTime } from '../../utils/format';

export default function MessageBubble({ message, mine }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[65%] ${
          mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
          {fmtTime(message.created_at)}
          {mine && (message.read_at ? <CheckCheck className="h-3.5 w-3.5" aria-label="Read" /> : <Check className="h-3.5 w-3.5" aria-label="Sent" />)}
        </div>
      </div>
    </div>
  );
}
