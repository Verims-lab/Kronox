import React, { useEffect, useState } from 'react';

// Codex104 — hardens BottomNav runtime visibility for /lobby sub-flows:
// LobbyRoom now publishes hide/show in a layout effect and resets only on
// unmount, preventing visible-frame flicker in create/join/waiting states.
//
// Previous note: Codex101 — Health Center case audit for current tutorial, invite expiry,
// notification preference, VAPID, lobby-routing, matchmaking, and online
// random-question product decisions. Adds/updates only Health coverage.
//
// Previous note: Codex100 — final regression pass after Codex099 UI polish: expired
// incoming game invites can no longer present an active accept affordance,
// and outgoing status rows reuse the complete invite/friend status pill.
//
// Previous note: Codex098 — aligns profile tutorial state, invite expiration/deep-link
// routing, notification preferences, bottom-nav hiding, and Health contracts
// with the latest Online/Friends/Notification product decisions.
//
// Previous note: Codex097 — integrates Profile -> Ayarlar notification settings with
// closed-app invite push readiness: public users now see clean permission /
// subscription state while admin-only device diagnostics stay gated, and
// Health locks the Settings-to-PushSubscription contract.
//
// Previous note: Codex096 — hardens closed/background invite push readiness:
// Settings now distinguishes permission from an actual browser subscription
// and saved PushSubscription row, lets users renew a missing/stale subscription
// even when permission is already granted, and the push backend/client summary
// now preserves skipped/failure reasons such as missing VAPID config or no
// active recipient subscription. Root PWA manifest is shipped from /public.
//
// Previous note: Codex095 — remote gameplay UI marker retained while rebasing
// this notification fix onto the current Codex branch.
//
// Previous note: Codex093 — fixes sticky foreground GameInvite toasts blocking gameplay:
// invite toasts now auto-dismiss, their close button is wired to the toast
// store, non-pending invite updates dismiss active invite toasts, and entering
// /game clears active invite notifications so gameplay stays visible/touchable.
//
// Previous note: Codex092 — hardens real system invite notification routing/copy:
// Web Push payloads now use the product-specific Turkish invite text, app-open
// invite toasts route to the concrete invite/lobby URL, and notification clicks
// are constrained to same-origin Kronox routes before focusing/opening a client.
// Push delivery still requires deployment VAPID secrets plus real subscribed
// device proof; in-app invites remain the fallback when push is unavailable.
//
// Previous note: Codex090 — Health Simulator refresh for recent Online/Friends/Notification/
// Email/Category work. Adds higher-signal release-risk contracts around
// friend-request email/deep links, invite push readiness, category handoff,
// and SRE-style report/proof grouping. Simulator honesty is preserved:
// static checks remain static, real device/backend proof remains visible,
// and scoring is not weakened.
//
// Previous note (Codex087 — Online invite notification support). Adds user-controlled
// Settings opt-in, Web Push subscription storage, a service worker push/click
// handler, app-open invite toasts, and a best-effort sendGameInvitePush backend
// path. Push delivery is intentionally gated by VAPID environment secrets and
// real device/PWA support; invite creation and in-app invites continue even if
// push is unsupported or fails.
//
// Previous note (Codex086 — Gate diagnostics overlays strictly to ?diag=1 / localStorage):
// Codex085 left role==='admin' as an auto-enable, which kept the overlay
// permanently visible for admins and blocked gameplay. The host black
// screen is confirmed fixed (host screenshot showed renderStage=ready with
// timeline/cards behind the overlay). With Codex086, normal gameplay never
// shows the overlay; devs can still flip it on with ?diag=1.
//
// Untouched: updateLobbyGameState authority, Timeline, QuestionCard,
// placement, lobby auth, Friends, RLS, Health Simulator scoring. The
// AppErrorBoundary fallback (visible error card instead of black screen)
// is intentionally kept.
//
// Previous note (Codex085 — App/router-level diagnostics + AnimatePresence bypass for /game):
// User reported the Codex084 in-Game diagnostics overlay NEVER appeared on
// the host black screen. That means the issue is ABOVE Game.jsx: either the
// host never reached /game OR the route mounted but the page never painted
// (likely AnimatePresence mode="wait" stalling the new route at opacity:0).
// Codex085 fixes both:
//   1. AppDiagnostics overlay rendered at AuthenticatedApp shell level,
//      OUTSIDE AnimatePresence and Suspense, so it paints regardless of
//      what /game does. Pushes state via a module-level pub/sub bus
//      (lib/appDiagBus.js), so it survives render crashes inside Game.
//   2. AppErrorBoundary wraps every Route renderer so a render crash shows
//      a visible bright fallback instead of black, and emits to the bus.
//   3. /game is now rendered OUTSIDE the AnimatePresence wrapper. This was
//      the most likely cause of the host black screen: with mode="wait",
//      the previous route's exit animation must complete before the new
//      route's enter animation starts; on a slow transition the host stays
//      at { opacity: 0 } indefinitely. Other routes keep the transition.
//   4. handleStart + Game mount/unmount + renderStage are all wired into
//      the diag bus so the overlay shows: route, prevRoute, navTarget,
//      navPayloadKeys, startFired, startReturned, startLobby{id,status,rev},
//      gameMounted, gameRenderStage, lastError + a derived blackScreenReason.
// updateLobbyGameState authority logic, Timeline, QuestionCard, placement,
// Friends, RLS, and visual assets are untouched.
// Codex106-23 — Solo level completion popup polish: completion time +
// level number stat + ranking line (real-rank-ready, placeholder copy
// today via lib/soloRanking.js), "Tekrar Oyna" + "Level X'e Geç" CTAs
// (next-level only on pass and within catalog), clear fail-reason copy
// on timeout / 8+ mistakes, 0-star fail state, animated stars, mobile
// no-scroll fit. Game.jsx adds handleSoloNextLevel and passes
// hasNextLevel / isNextLevelComingSoon to the popup. solo_progress
// best-result merge, drag/drop, Timeline, online/lobby, notifications,
// tutorial profile — DOKUNULMADI.
//
// Previous note: Codex106 — Solo Level Path (vertical 8-row path, per-user
// solo_progress persistence with localStorage fallback, 10 kart / 120sn /
// 8-mistake fail rule).
const BUILD_MARKER = 'Codex106-23';
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