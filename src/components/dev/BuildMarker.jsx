import React, { useEffect, useState } from 'react';

// Codex081 — Friends regression mop-up on top of the Codex080 normalized
// model fix. Codex080 already removed the RLS-blocked sender-mirror insert
// from acceptFriendRequest (every prior accept attempt was returning 403 on
// that write). Codex081 adds two honest closure items:
//   1. friendsApi sendFriendRequest now declares an explicit `existingFriend`
//      named marker so the duplicate-friend guard is greppable and the
//      Health Simulator can verify the contract by exact token.
//   2. The contract mirror in simulationPanelContractStrings was rewritten
//      so its prose comments no longer accidentally contain the forbidden
//      "Friendship.create" literal — that was a false positive triggering
//      two FAIL cases even though the real function has no such call.
const BUILD_MARKER = 'Codex081';
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