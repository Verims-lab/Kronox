import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Hourglass, X } from 'lucide-react';

// Shared search surface for Online Kapış and Duello. Match-found feedback is
// rendered here as a phase of the same screen before direct game navigation.
export default function PreGameHourglass({
  title,
  subtitle,
  durationMs = 30000,
  expiresAt = null,
  phase = '',
  errorMessage = '',
  errorCategory = null,
  diagnostics = null,
  testId,
  cancelTestId,
  onTimeout,
  onCancel,
  onRetry,
}) {
  const reduceMotion = useReducedMotion();
  const startRef = useRef(Date.now());
  const firedRef = useRef(false);
  const intervalRef = useRef(null);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);
  const totalMs = expiresAt ? Math.max(1000, (Date.parse(expiresAt) || 0) - startRef.current) : durationMs;
  const [remainingMs, setRemainingMs] = useState(totalMs);
  const timerPaused = ['failed', 'timeout', 'matched', 'directStarting', 'cancelled'].includes(phase);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    firedRef.current = false;
    startRef.current = Date.now();
    setRemainingMs(expiresAt
      ? Math.max(0, (Date.parse(expiresAt) || 0) - startRef.current)
      : durationMs);
    if (timerPaused) return undefined;
    intervalRef.current = window.setInterval(() => {
      const next = expiresAt
        ? Math.max(0, (Date.parse(expiresAt) || 0) - Date.now())
        : Math.max(0, durationMs - (Date.now() - startRef.current));
      setRemainingMs(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        onTimeoutRef.current?.();
      }
    }, 250);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [expiresAt, durationMs, timerPaused]);

  const seconds = Math.ceil(remainingMs / 1000);
  const statusTitle = phase === 'starting' || phase === 'searching'
    ? 'Rakip aranıyor'
    : phase === 'matched' || phase === 'directStarting'
      ? 'Rakip bulundu'
      : phase === 'timeout'
        ? 'Rakip bulunamadı'
        : phase === 'failed'
          ? 'Eşleşme başlatılamadı'
          : title;

  return (
    <div
      data-testid={testId}
      data-matchmaking-phase={phase || 'idle'}
      data-matchmaking-error-category={errorCategory || undefined}
      data-matchmaking-function-category={diagnostics?.onlineMatchmakingFunctionCategory || undefined}
      data-matchmaking-mode={diagnostics?.matchmakingMode || undefined}
      data-matchmaking-operation={diagnostics?.matchmakingOperation || undefined}
      data-matchmaking-status-class={diagnostics?.matchmakingStatusClass || undefined}
      data-matchmaking-backend-error-category={diagnostics?.matchmakingErrorCategory || undefined}
      data-matchmaking-actor-kind={diagnostics?.actorKind || undefined}
      data-matchmaking-queue-state-before={diagnostics?.queueStateBefore || undefined}
      data-matchmaking-queue-state-after={diagnostics?.queueStateAfter || undefined}
      data-matchmaking-start-response-shape={diagnostics?.startResponseShape || undefined}
      data-matchmaking-no-opponent-waiting={diagnostics?.noOpponentYetClassifiedAsWaiting ? 'true' : 'false'}
      data-matchmaking-stale-own-row-handled={diagnostics?.staleOwnRowHandled ? 'true' : 'false'}
      data-matchmaking-duplicate-own-row-handled={diagnostics?.duplicateOwnRowHandled ? 'true' : 'false'}
      data-matchmaking-queue-storage={diagnostics?.queueStorageStrategy || undefined}
      data-matchmaking-retry-cleanup-observed={diagnostics?.retryCleanupObserved ? 'true' : 'false'}
      data-matchmaking-cancel-cleanup-observed={diagnostics?.cancelCleanupObserved ? 'true' : 'false'}
      data-matchmaking-direct-start-payload={diagnostics?.directGamePayloadAvailable ? 'true' : 'false'}
      data-matchmaking-match-found-observed={diagnostics?.matchFoundObserved ? 'true' : 'false'}
      className="kx-a1-screen kx-a1-online fixed inset-0 flex w-full max-w-full flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 text-white"
      data-kronox-pre-game-hourglass="mobile-safe"
      style={{
        minHeight: '100dvh',
        maxHeight: '100dvh',
        boxSizing: 'border-box',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
        overscrollBehavior: 'contain',
        background:
          'radial-gradient(ellipse at 50% 20%, rgba(59,130,246,0.30), transparent 48%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
      }}
    >
      <motion.div
        animate={reduceMotion ? { opacity: 1 } : { rotate: [0, 8, -8, 0] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 1.15, repeat: 1, ease: 'easeInOut' }}
      >
        <Hourglass
          style={{ width: 64, height: 64, color: '#facc15', filter: 'drop-shadow(0 0 16px rgba(250,204,21,0.5))' }}
          strokeWidth={1.6}
        />
      </motion.div>

      <p className="mt-6 font-cinzel text-xl font-black tracking-widest text-amber-200 text-center">{statusTitle}</p>
      <p className="mt-2 font-inter text-sm text-blue-100/70 text-center max-w-xs">{subtitle}</p>

      {!timerPaused && (
        <p className="mt-5 font-bebas text-5xl tracking-widest text-white kronox-timeline-number">{seconds}s</p>
      )}

      {errorMessage && ['failed', 'timeout'].includes(phase) && (
        <p
          className="mt-4 rounded-xl px-3 py-2 font-inter text-xs text-rose-100/90"
          style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}
        >
          {errorMessage}
        </p>
      )}

      {onRetry && ['failed', 'timeout'].includes(phase) && (
        <button
          type="button"
          onClick={onRetry}
          className="kx-a1-pressable mt-5 min-h-11 rounded-2xl px-6 py-2.5 font-inter text-sm font-black text-slate-950"
          style={{ background: '#facc15', boxShadow: '0 8px 22px rgba(250,204,21,0.22)' }}
        >
          Tekrar dene
        </button>
      )}

      {onCancel && !['matched', 'directStarting'].includes(phase) && (
        <button
          type="button"
          data-testid={cancelTestId}
          onClick={onCancel}
          className="kx-a1-pressable mt-9 flex min-h-11 items-center gap-2 rounded-2xl px-5 py-2.5 font-inter text-sm font-bold text-blue-100/80"
          style={{ background: 'rgba(148,163,184,0.12)', boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.28)' }}
        >
          <X className="w-4 h-4" /> Vazgeç
        </button>
      )}
    </div>
  );
}
