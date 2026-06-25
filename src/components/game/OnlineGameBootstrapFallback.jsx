import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Codex083 — Defensive fallback shown while /game is waiting for its first
 * playable state (live lobby + questions + current question).
 *
 * Previous behavior: an infinite spinner would render forever for the host
 * if anything in the bootstrap chain (Lobby.get / subscription / question
 * cache) silently stalled. From the user's perspective this looked like a
 * "black/loading screen" on the host while Player 2 entered fine via the
 * subscription path.
 *
 * This component keeps showing the spinner for the first ~3 seconds (so the
 * normal happy path is visually unchanged), then surfaces a "Tekrar Dene"
 * manual recovery button that triggers a fresh Lobby.get and/or a fresh
 * questions fetch. It also gives the user a way back home.
 *
 * It is UI-only — no gameplay or sync authority logic lives here.
 */
export default function OnlineGameBootstrapFallback({
  isOnline,
  hasLobbyData,
  hasQuestions,
  lobbyId,
  lobbyCode,
  onRefetchLobby,
  onRetryQuestions,
  retryQuestionsWhenNotReady = false,
  onBackHome,
}) {
  const [showRetry, setShowRetry] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowRetry(true), 3000);
    return () => window.clearTimeout(t);
  }, []);

  const message = !hasLobbyData && isOnline
    ? 'Lobi durumu yükleniyor...'
    : !hasQuestions
      ? 'Sorular yükleniyor...'
      : 'Oyun başlatılıyor...';

  const canRetryLobby = isOnline && (!!lobbyId || !!lobbyCode);
  const canRetryQuestions = !hasQuestions || retryQuestionsWhenNotReady;

  const handleRetry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (canRetryLobby) {
        await onRefetchLobby?.();
      }
      if (canRetryQuestions) {
        onRetryQuestions?.();
      }
    } finally {
      // Keep the button briefly disabled to prevent double taps.
      window.setTimeout(() => setBusy(false), 600);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div role="status" aria-live="polite" aria-label={message}>
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" aria-hidden="true" />
          <p className="font-inter text-foreground">{message}</p>
        </div>
        {showRetry && (
          <>
            <p className="font-inter text-xs text-muted-foreground">
              Bağlantı uzun sürüyor. Lütfen tekrar dene.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleRetry}
                disabled={busy || (!canRetryLobby && !canRetryQuestions)}
                className="w-full"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Yenileniyor…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" aria-hidden="true" /> Tekrar Dene
                  </span>
                )}
              </Button>
              <Button onClick={onBackHome} variant="outline" className="w-full">
                Ana Menüye Dön
              </Button>
            </div>
          </>
        )}
        {!showRetry && (
          <Button onClick={onBackHome} variant="outline">Geri Dön</Button>
        )}
      </div>
    </div>
  );
}
