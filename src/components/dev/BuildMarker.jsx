import React, { useEffect, useState } from 'react';

// Codex083 — Host black-screen on online start fixed. Codex082 added URL
// recovery params but the host still stalled because handleStart navigated
// using the function-response lobby (sometimes incomplete) instead of the
// SAME live server lobby Player 2 sees via subscription. Codex083 changes:
//   1. WaitingRoomPanel.handleStart re-fetches Lobby.get(lobbyId) AFTER
//      startLobbyGame succeeds and navigates with that authoritative copy.
//      Function-response is only used as a fallback if the re-fetch fails.
//   2. useLobbySync retries the initial Lobby.get with light backoff so a
//      slow-network race against the post-start write does not leave the
//      host stranded on the loading screen.
//   3. Game.jsx routes the not-ready state through OnlineGameBootstrapFallback
//      which exposes a "Tekrar Dene" button after ~3s instead of spinning
//      forever — black-screen is recoverable without leaving the route.
// updateLobbyGameState authority logic, Timeline, QuestionCard, placement
// rules, Friends, and RLS schemas are intentionally untouched.
const BUILD_MARKER = 'Codex083';
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