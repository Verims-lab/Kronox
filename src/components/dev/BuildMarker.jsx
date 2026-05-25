import React, { useEffect, useState } from 'react';

// Codex079 — Friends accept regression fixed. The client was passing the
// full FriendRequest object to base44.functions.invoke('acceptFriendRequest', {requestId: ...}),
// which got String()-coerced to "[object Object]" → backend 404 →
// "Arkadaşlık isteği kabul edilemedi" on every accept tap. acceptIncomingRequest
// now accepts both bare id strings and full request objects, and the
// backend's existing service-role mirrored-rows path (already correct)
// finally runs end-to-end. Both users now see each other after accept.
const BUILD_MARKER = 'Codex079';

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