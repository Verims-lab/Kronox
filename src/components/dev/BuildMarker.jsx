import React, { useEffect, useState } from 'react';

// Codex578 — Profile subpage navigation root/back fix:
//   • BottomNav taps now open tab roots only: Ana Sayfa, Liderlik, Profil.
//   • Profile/Friends/Settings/Admin/Profile Edit subpages carry explicit
//     parentRoute/returnTo state so top-left back returns to the parent/root.
//   • Shared top-bar fallback uses parent route or current tab root instead of
//     blind browser history, preventing sticky Profile subpage reopen.
//
// Codex577 — Onboarding move allowance, before_after slots, Store modal safety:
//   • Levels 1-6 keep a 6-correct onboarding progress target while using
//     the 10-HAMLE evaluated move allowance and larger prepared attempt decks.
//   • before_after Timeline renders a full-slot grid so ÖNCESİ/SONRASI do not
//     inherit the regular edge-peek clipping treatment.
//   • Mağaza Diamond-spend package popup is centered, safe-area bounded, and
//     kept above BottomNav without changing server-owned purchase behavior.
//


const BUILD_MARKER = 'Codex578';
export const KRONOX_BUILD_MARKER = BUILD_MARKER;

// eslint-disable-next-line no-unused-vars
const _CODEX086_NOTE = 'Codex086: overlays opt-in only via ?diag=1 / localStorage';
// eslint-disable-next-line no-unused-vars
const _CODEX087_NOTE = 'Codex087: invite notifications are opt-in and best-effort';

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
