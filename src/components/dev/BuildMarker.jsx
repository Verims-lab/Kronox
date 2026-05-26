import React, { useEffect, useState } from 'react';

// Codex084 — Evidence-first debugging phase for the persistent host black-
// screen bug. Codex083's three fixes (live re-fetch, useLobbySync retry,
// recoverable fallback) did not fully resolve the symptom. Before another
// assumption-based patch this build adds:
//   1. components/game/GameBootstrapDiagnostics — admin/dev/?diag=1 gated
//      overlay that shows route, lobbyId/Code, lobby.status/state_revision,
//      players, currentPlayerIndex, currentQuestion presence, isGameReady,
//      and live renderStage on EVERY /game render gate.
//   2. components/game/GameRenderErrorBoundary — wraps the playable render
//      so a render-time crash cannot present as a black viewport; instead
//      a visible "Oyun ekranı yüklenemedi" + Tekrar Dene / Geri Dön.
//   3. CRITICAL FIX: hoisted boundaryError useState to the top of Game.jsx.
//      Codex083 introduced it AFTER several early-return gates, violating
//      Rules of Hooks ("Rendered fewer hooks than expected") which can
//      itself produce a blank/black host viewport when a guard flips
//      between renders. This is a real correctness fix, not just diag.
//   4. [Game.bootstrap] tagged debug log on every online render so host
//      vs Player 2 can be compared in runtime logs.
// updateLobbyGameState authority logic, Timeline, QuestionCard, placement
// rules, Friends, and RLS schemas are intentionally untouched.
const BUILD_MARKER = 'Codex084';
export const KRONOX_BUILD_MARKER = BUILD_MARKER;

export default function BuildMarker() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        right: 'calc(0.75rem + env(safe-area-inset-right))',
        bottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        zIndex: 9999,
        padding: '0.25rem 0.55rem',
        borderRadius: '999px',
        background: 'rgba(0, 0, 0, 0.62)',
        color: '#facc15',
        fontSize: '11px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        letterSpacing: '0',
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.22)',
      }}
    >
      {BUILD_MARKER}
    </div>
  );
}