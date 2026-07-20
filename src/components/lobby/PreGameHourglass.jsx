import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Hourglass, X } from 'lucide-react';

// Codex591 — Pre-game Hourglass: shared visual for both Online matchmaking
// waits (Invite = 60s, Rastgele Eşleş = 30s). Purely presentational; the
// parent screen drives when to unmount it (matched / cancelled) and is
// notified via onTimeout when the countdown reaches zero.
export default function PreGameHourglass({
  title,
  subtitle,
  durationMs = 30000,
  expiresAt = null,
  errorMessage = '',
  onTimeout,
  onCancel,
}) {
  const startRef = useRef(Date.now());
  const firedRef = useRef(false);
  const totalMs = expiresAt ? Math.max(1000, (Date.parse(expiresAt) || 0) - startRef.current) : durationMs;
  const [remainingMs, setRemainingMs] = useState(totalMs);

  useEffect(() => {
    firedRef.current = false;
    startRef.current = Date.now();
    const intervalId = window.setInterval(() => {
      const next = expiresAt
        ? Math.max(0, (Date.parse(expiresAt) || 0) - Date.now())
        : Math.max(0, durationMs - (Date.now() - startRef.current));
      setRemainingMs(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        window.clearInterval(intervalId);
        onTimeout?.();
      }
    }, 250);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, durationMs]);

  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 text-white"
      style={{
        background:
          'radial-gradient(ellipse at 50% 20%, rgba(59,130,246,0.30), transparent 48%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
      }}
    >
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Hourglass
          style={{ width: 64, height: 64, color: '#facc15', filter: 'drop-shadow(0 0 16px rgba(250,204,21,0.5))' }}
          strokeWidth={1.6}
        />
      </motion.div>

      <p className="mt-6 font-cinzel text-xl font-black tracking-widest text-amber-200 text-center">{title}</p>
      <p className="mt-2 font-inter text-sm text-blue-100/70 text-center max-w-xs">{subtitle}</p>

      <p className="mt-5 font-bebas text-5xl tracking-widest text-white kronox-timeline-number">{seconds}s</p>

      {errorMessage && (
        <p
          className="mt-4 rounded-xl px-3 py-2 font-inter text-xs text-rose-100/90"
          style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}
        >
          {errorMessage}
        </p>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-9 flex items-center gap-2 rounded-2xl px-5 py-2.5 font-inter text-sm font-bold text-blue-100/80"
          style={{ background: 'rgba(148,163,184,0.12)', boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.28)' }}
        >
          <X className="w-4 h-4" /> Vazgeç
        </button>
      )}
    </div>
  );
}