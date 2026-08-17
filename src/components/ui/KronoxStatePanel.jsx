import React from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';

export default function KronoxStatePanel({
  kind = 'error',
  title,
  message,
  actionLabel = 'Tekrar dene',
  onAction,
  compact = false,
}) {
  const Icon = kind === 'loading' ? Loader2 : kind === 'empty' ? Inbox : AlertCircle;
  const role = kind === 'error' ? 'alert' : 'status';
  const tone = kind === 'error'
    ? { color: '#fecaca', border: 'rgba(248,113,113,0.32)', bg: 'rgba(127,29,29,0.16)' }
    : { color: '#dbeafe', border: 'rgba(125,211,252,0.22)', bg: 'rgba(30,64,175,0.12)' };

  return (
    <div
      role={role}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className={`w-full min-w-0 rounded-2xl text-center ${compact ? 'px-3 py-3' : 'px-4 py-5'}`}
      style={{ color: tone.color, background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.border}` }}
    >
      <Icon className={`mx-auto h-5 w-5 ${kind === 'loading' ? 'animate-spin text-amber-200' : ''}`} aria-hidden="true" />
      {title && <p className="mt-2 font-inter text-sm font-black text-white">{title}</p>}
      {message && <p className="mt-1 break-words font-inter text-xs leading-relaxed text-blue-100/70">{message}</p>}
      {onAction && kind !== 'loading' && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 font-inter text-xs font-black text-amber-950"
          style={{ background: 'linear-gradient(180deg,#ffe066,#b97a06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)' }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}