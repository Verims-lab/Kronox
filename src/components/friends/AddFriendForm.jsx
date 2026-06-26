import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AtSign, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { parseFriendRequestTarget } from '@/lib/friendsApi';

/**
 * Add a friend by email or Kronox username. Backend resolves the target and
 * never returns a username lookup target email to the requester.
 */
export default function AddFriendForm({ onSubmit }) {
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    // Empty-target client guard: trim, block submit, and show the exact
    // canonical message without ever calling the backend on empty input.
    const trimmed = String(target || '').trim();
    if (!trimmed) {
      setError('E-posta veya kullanıcı adı gir.');
      return;
    }
    const parsed = parseFriendRequestTarget(trimmed);
    if (parsed.kind === 'empty' || parsed.error) {
      setError(parsed.error || 'E-posta veya kullanıcı adı gir.');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      // Codex129 — Parent (FriendsPage) now owns the precise success/warning
      // copy because it knows whether the email actually went out and
      // whether the recipient is registered. We just clear our local field
      // on success and let the parent show the honest banner.
      await onSubmit(parsed.value);
      setTarget('');
    } catch (err) {
      setError(err.message || 'İstek gönderilemedi.');
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.92), rgba(10,16,36,0.96))',
        boxShadow:
          'inset 0 0 0 1.5px rgba(250,204,21,0.35), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px rgba(250,204,21,0.18), 0 8px 16px rgba(2,6,23,0.5)',
      }}
    >
      <label className="block">
        <span className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/80">
          E-posta veya kullanıcı adı ile arkadaş ekle
        </span>
        <div
          className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{
            background: 'rgba(4,8,22,0.6)',
            boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.25)',
          }}
        >
          <AtSign className="h-4 w-4 text-blue-100/60 flex-shrink-0" />
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="E-posta veya kullanıcı adı"
            className="min-w-0 flex-1 bg-transparent font-inter text-sm text-white placeholder:text-blue-100/40 focus:outline-none"
            disabled={busy}
          />
        </div>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-inter text-sm font-black text-amber-950 disabled:opacity-60"
        style={{
          background: 'linear-gradient(180deg,#ffe066,#b97a06)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 14px rgba(250,204,21,0.45), 0 6px 14px rgba(2,6,23,0.45)',
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        İstek Gönder
      </button>

      <AnimatePresence>
        {error && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}
          >
            <AlertCircle className="h-4 w-4 text-rose-300 flex-shrink-0 mt-0.5" />
            <p className="font-inter text-xs text-rose-100/90">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
