import React, { useEffect, useState } from 'react';

// Codex584 — Daily Wheel task and tutorial popup contract fix:
//   • claimDailyWheelReward records Çark çevir Daily Calendar progress
//     backend-side from the idempotent DailyWheelSpin claim/recovery path.
//   • Daily Wheel SONRA/no-spin close now uses modal cleanup without
//     consuming a spin, starting a hidden spin, or completing the task.
//   • Gift Box results show backend-resolved contents, and Level 1 tutorial
//     video autoplays muted/loop/inline with ANLADIM close/reset behavior.
//   • Restored the frontend @base44/sdk exact 0.8.34 package/lock contract
//     after syncing the latest main branch.
//
// Codex583 — Health KRONOX-MRDZUHVL route/pin alignment:
//   • Retargeted Profile/Settings/Home route Health guards to the real
//     state-carrying navigate('/route', ...) handlers instead of stale
//     one-argument tokens.
//   • Restored the frontend @base44/sdk exact 0.8.34 package and lockfile
//     contract while critical Base44 function imports already matched.
//
// Codex582 — Level 1 tutorial popup video/copy update:
//   • Level 1 start popup uses local /assets/tutorials/Seviye1tutorial.mp4.
//   • Level 1 copy is "Önce mi, Sonra mı" / "Kartı doğru tarafa sürükle".
//   • Docs/Health guard the local video, no remote/autoplay path, unchanged
//     later tutorial popups, and timer pause contract.
//
// Codex581 — Solo slot guidance animation removal:
//   • Disabled beginner/correct-slot guidance and removed the old Timeline
//     slot pulse CSS plus guided target halos from drop slots.
//   • Guided tutorial finger is generic drag teaching only, not correct-slot
//     targeted.
//   • Docs/Health now guard static drop slots across before_after,
//     timeline_basic, and normal timeline.
//
// Codex580 — Daily Calendar task event refresh/reconciliation pass:
//   • Daily Wheel successful claim now marks Daily status stale immediately
//     and getDailyQuestStatus reconciles Çark çevir from same-day
//     DailyWheelSpin rows when the progress event write was missed.
//   • Daily task progress events invalidate/refresh the Daily Calendar status
//     cache and useDailyQuests ignores stale status responses.
//   • Docs/Health now guard wheel-claim completion, event-source coverage,
//     training Joker/Hint exclusions, and no Puan/Leaderboard side effects.
//
// Codex579 — Freeze/Hint/Home shortcut visual token pass:
//   • Zamanı Dondur display copy stays stable while time_freeze remains the
//     internal inventory id; game/store icon color is #e31717.
//   • Store İpucu packages use the in-game yellow hammer treatment without
//     changing prices, quantities, grants, or purchase semantics.
//   • Home Çark shortcut keeps the same outer circle and enlarges only the
//     mini wheel artwork by 30%.
//
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


const BUILD_MARKER = 'Codex584';
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
