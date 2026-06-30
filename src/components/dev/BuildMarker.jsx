import React, { useEffect, useState } from 'react';

// Codex508 — Solo joker inventory zeroing re-audit:
//   • spendUserJoker responses now report balancePayloadTypes/balancesComplete so partial or under-populated snapshots cannot masquerade as authoritative zero counts.
//   • Game.jsx applies spend responses through the pure mergeJokerSpendMutationBalances helper with functional state updates, preserving untouched joker badges after Kart Değiştir, Kronokalkan, and Zaman Dondur.
//   • Joker Inventory Health adds an executable A-G merge matrix for selected-joker decrement, partial response safety, idempotent retry no-double-spend, and tutorial no-spend separation.
//
// Codex507 — Admin screen collapsible operations cleanup:
//   • Major Admin Ekranı operations now use a shared collapsed-by-default section pattern so reports, cleanup, reset, and test Diamond grant do not fill the first viewport.
//   • Soru Analiz Raporu keeps report sending separate from the destructive/manual analytics reset details: report group opens when the section opens, reset group stays closed.
//   • Kullanıcı Raporu now lazy-loads on expansion and shows compact grouped stats with lightweight CSS bars; admin server-side gates and destructive confirmations stay unchanged.
//
// Codex506 — Admin test Diamond grant by Kronox ID:
//   • Admin Ekranı adds Test Elmas Yükleme for active AdminUser roles only, using immutable kronox_user_id instead of email/provider/raw guest identifiers.
//   • adminGrantDiamonds resolves User/GuestProfile server-side, validates 100/300/500/1000 amounts, writes admin_adjustment DiamondTransaction rows, and updates only diamonds.
//   • Per-click request_id idempotency plus the shared EconomyOperationLock protects double taps/retries; Health statically guards no Kronox Puan, leaderboard, Daily Wheel, Daily Quest, Market, or private-ID UI leakage.
//
// Codex505 — Health blocker correction:
//   • The executable BUILD_MARKER constant is bumped in the real source used by Health/buildChecker; comments alone do not count.
//   • App diagnostics now reads KRONOX_BUILD_MARKER instead of a stale hardcoded Codex500 value.
//   • Current startup, Solo move, and Base44 SDK Health blockers are verified against live source contracts after syncing origin/main into Codex.
//
// Codex504 — Solo Kronokalkan active visual state:
//   • The real Solo mistakeShieldActive state now drives a blue/cyan active glow on the Kronokalkan button while the shield is armed.
//   • The active Solo question card switches its yellow/gold border and glow to Kronokalkan blue while the shield is active, without changing layout or hit-testing.
//   • Online remains isolated from the Solo shield card glow, and Health now guards the button/card visual-state wiring plus removed text overlays.
//
// Codex503 — Solo joker inventory audit:
//   • Solo spend responses now merge partial backend balance payloads into the current real inventory object, so untouched joker counts are never zeroed as a disabled-state shortcut.
//   • Normal Solo selected-joker count still uses server balanceAfter as authoritative; other joker badges preserve their real counts after Kronokalkan, Kart Değiştir, and Zaman Dondur.
//   • Failed spend responses no longer synthesize a missing backend balanceAfter into zero, avoiding false badge drops after transient request errors.
//   • spendUserJoker also reconciles duplicate inventory rows on already-applied/idempotent retry responses, keeping refresh/reopen counts aligned.
//   • Health now guards partial-payload merge behavior, duplicate-row repair, and UI badge preservation.
//
// Codex502 — Health blocker fixes (KRONOX-MR0KZQBY):
//   • App-shell presence heartbeat now calls usePresenceHeartbeat with inline nonCriticalModulesEnabled gates, so Home first render stays ahead of presence startup and Health scans the live contract.
//   • Solo move Health now protects Kronokalkan move preservation without requiring the removed visible joker success/status overlay text.
//   • Root @base44/sdk is restored to exact 0.8.34 in package.json and package-lock.json, including the lockfile package entry.
//
// Codex501 — Solo joker spend/runtime polish:
//   • Normal Solo joker use now treats spendUserJoker balanceAfter as authoritative for the used joker in UI/cache, so badges decrement immediately after a successful server-backed spend.
//   • spendUserJoker reconciles duplicate same-user/same-joker UserJokerInventory rows to the post-spend balance, preventing refresh/reopen from restoring stale higher counts.
//   • Guided/tutorial joker demos still use attempt-local demo balances and never call the real inventory spend path.
//   • Solo joker rail renders only safe error text; normal success/status overlays such as timer-freeze completion or shield protection copy are removed from gameplay.
//   • The Solo joker rail is centered in the right gutter beside the active question card while preserving drag locks and Online isolation.
//


const BUILD_MARKER = 'Codex508';
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
