import React, { useEffect, useState } from 'react';

// Codex474 — Admin inactive guest username cleanup:
//   • Adds AdminUser-gated cleanupInactiveGuestUsernames with dry-run preview, SİL confirmation, server-side recheck, audit log, and username release.
//   • Adds Admin card for inactive zero-score guest-only username cleanup without exposing private/internal IDs.
//   • Updates reporting/Health/docs mirrors for the manual cleanup contract.
//
// Codex473 — Admin Kullanıcı Raporu:
//   • Adds AdminUser-gated aggregate-only getUserReport for username/logged-in/score/inactive/platform counts.
//   • Adds recordAppOpen server-time last_app_open_at / last_seen_at and coarse app_platform tracking.
//   • Wires a read-only Admin Kullanıcı Raporu card plus reporting docs/Health contracts.
//
// Codex472 — Security Cleanup Health blocker (KRONOX-MQXSBA4X):
//   • Root package.json @base44/sdk pin changed from "^0.8.34" to exact "0.8.34".
//   • package-lock.json root dependency spec de-carated to "0.8.34" (resolved 0.8.34 tarball preserved; no version bump).
//   • Critical Base44 functions already align to npm:@base44/sdk@0.8.34; Health source left strict/unchanged. Dependency/version alignment only — no product behavior change.
//
// Codex471 — Presence Health blockers (KRONOX-MQXRO5ZO):
//   • getFriendPresence adds a bounded PRESENCE_SCAN_LIMIT per-friend scan (Math.max(limit, PRESENCE_SCAN_LIMIT)) and returns last_heartbeat_at/presence_expires_at freshness.
//   • PlayerPresence / updatePlayerPresence / getFriendPresence Health mirror strings re-synced to the live owner-bound (auth.me or token-proven GuestProfile), accepted-friend-scoped, privacy-safe contract.
//   • Freshness contract locked: 75s backend TTL, 25s visible heartbeat, 12s visible Online refresh. No gameplay/lobby/invite behavior change.
//
// Codex469 — Health blocker fix:
//   • Profile Info screen title is visibly "Profil Bilgileri" and owns category selection.
//   • Route ownership Health expects Profile subroutes including /profile/edit.
//   • Root @base44/sdk dependency is exact-pinned to 0.8.34.
//
// Codex468 — Reliable Online presence:
//   • Presence heartbeat uses a runtime session id, 25s visible heartbeat, and 75s backend TTL.
//   • updatePlayerPresence supports token-proven GuestProfile actors and server-owned heartbeat expiry aliases.
//   • Online player selection/friend presence refetch while visible and keep previous safe rows through transient failures.
//
// Codex467 — Profile menu navigation + Profile Info / Settings split:
//   • Profile menu keeps Profil Bilgileri, Arkadaşlarım, and Ayarlar as screen navigation rows.
//   • Settings owns Gizlilik Politikası and guarded Hesap Silme flow.
//   • Profile Info adds canonical category preference access beside Takma Ad, Cinsiyet, and Yaş grubu.
//
// Codex466 — Profile name click opens edit profile screen:
//   • Adds /profile/edit as a Kronox-style private-safe edit surface.
//   • Profile identity/name area opens Takma Ad, Cinsiyet, and Yaş grubu edits.
//   • Stores current age-group edits as private age_group instead of exact age.
//
// Codex465 — Profile redesign + login sheet + first-login reward:
//   • Adds Kronox-style Profile landing, grouped real menu actions, and a Google/Apple/Email login sheet.
//   • Grants a one-time server-backed first_login_reward through linkGuestAccount and DiamondTransaction.
//   • Refreshes Settings list rows, economy docs/mirrors, and targeted Health coverage.
//
// Codex464 — Performance pass:
//   • Removes duplicate app/game auth bootstrap reads from App.jsx and Game.jsx.
//   • Defers optional service worker, invite notifier, and category modal startup work.
//   • Keeps Home reward panels visible from a short-lived cache while revalidating and memoizes question text fit tokens.
//

const BUILD_MARKER = 'Codex474';
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
