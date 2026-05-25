import React, { useEffect, useState } from 'react';

// Codex080 — Friends accept root-cause fix. Mirrored Friendship rows were
// blocked by RLS even under service role (data.user_email === {{user.email}}
// is enforced for service role on this app), so every prior accept attempt
// returned 403 Permission denied on Friendship.create and the UI showed
// "Arkadaşlık isteği kabul edilemedi". Switched to a normalized model:
// the accepted FriendRequest itself IS the friendship. The friend list now
// reads both sides of accepted FriendRequests (sender+recipient). This
// auto-repairs old "accepted-without-friendship" rows — both users now see
// each other immediately after accept, with no Friendship row required.
const BUILD_MARKER = 'Codex080';
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
