import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { isValidEmail } from '@/lib/friendsApi';

/**
 * Add a friend by email. Validates client-side and surfaces server errors clearly.
 */
export default function AddFriendForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const candidate = email.trim();
    if (!candidate) {
      setError('E-posta adresi gir.');
      return;
    }
    if (!isValidEmail(candidate)) {
      setError('Geçerli bir e-posta adresi gir.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(candidate);
      setSuccess('Arkadaşlık isteği gönderildi.');
      setEmail('');
    } catch (err) {
      setError(err.message || 'İstek gönderilemedi.');
    } finally {
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
          E-posta ile arkadaş ekle
        </span>
        <div
          className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{
            background: 'rgba(4,8,22,0.6)',
            boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.25)',
          }}
        >
          <Mail className="h-4 w-4 text-blue-100/60 flex-shrink-0" />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="arkadas@ornek.com"
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
        {success && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(74,222,128,0.10)', boxShadow: 'inset 0 0 0 1px rgba(74,222,128,0.35)' }}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-300 flex-shrink-0 mt-0.5" />
            <p className="font-inter text-xs text-emerald-100/90">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}