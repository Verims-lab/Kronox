import React, { useEffect, useState } from 'react';

// Codex490 — Global avatar propagation and bundled icon set:
//   • Public leaderboard, friend, player-select, lobby, invite, request, and header surfaces now render the shared KronoxAvatar.
//   • Public projections carry only sanitized avatar_type/icon/color/url visual metadata while username remains the public identity.
//   • Avatar picker groups a broader app-local lucide icon set into Kronox categories; no runtime icon hotlinks.
//
// Codex489 — Health blocker alignment for Settings delete, Daily Quest v1, Admin visibility, SDK pin:
//   • Settings exposes one "Hesabı Sil" row that opens the existing two-step shared requestAccountDeletion flow.
//   • Daily Quest Health/docs now protect Runtime v1: canonical solo_level_complete, no admin definition UI, no DB definition bloat.
//   • Root @base44/sdk is exact-pinned again and Admin visibility checks target current AdminUser-gated tools.
//
// Codex488 — Daily Quest Runtime v1 reset:
//   • Home/runtime now use one canonical solo_level_complete quest: "Solo’da Seviye Geç" / "Bugün 1 Solo seviyesini tamamla." / 20 Diamonds.
//   • Progress advances only after passed Solo level completion; Solo start/correct-card/joker events are no-ops for Daily Quest.
//   • Runtime ignores DailyQuestDefinition rows and Admin Ekranı no longer mounts Günlük Görev Yönetimi.
//
// Codex487 — Friends screen back button returns to Profile:
//   • FriendsPage top-left back arrow now navigates to /profile (Profile-owned route) instead of Home.
//   • Route-ownership Health case extended to require the Friends→/profile back contract and forbid the old back-to-Home handler.
//   • No friend data, invite, presence, BottomNav, or Online route ownership changes.
//
// Codex486 — Settings duplicate account-delete row cleanup:
//   • Removes the duplicate lower "HESAP → Hesabı Sil" section so Settings shows a single account deletion entry under "Ayarlar ve Güvenlik".
//   • The remaining "Hesabı Sil" row opens the existing two-step confirm (İptal / Evet, Sil) inline; no backend, confirmation, or safety logic changed.
//   • Health account-deletion tokens (Hesabı Sil description, confirmDelete guard, irreversible warning) preserved.
//
// Codex485 — VAPID secret validation hardening (sendGameInvitePush):
//   • isInvalidVapidValue now rejects placeholder/default VAPID values by exact match, marker substring (placeholder/replace_me/your_vapid/example/todo), and dummy/sample/test_ prefix so invalid config fails closed before webpush.setVapidDetails.
//   • Missing/invalid VAPID config still skips push with safe non-secret diagnostics while the persisted in-app invite remains valid; no secrets logged or returned.
//   • Security Cleanup Health requires the strengthened placeholder rejection; VAPID_PRIVATE_KEY production secret verification stays MANUAL_REQUIRED.
//
// Codex479 — Runtime Kronox ID Profile display + Health blockers:
//   • Unwraps nested Base44 function responses so ensured kronox_user_id reaches Auth/Profile state.
//   • Profile Info actively ensures/backfills the current player's ID and shows retryable failure instead of permanent loading copy.
//   • Re-pins root @base44/sdk to exact 0.8.34 and removes Math.random from the Kronox ID Health source path.
//
// Codex478 — Immutable Kronox user ID foundation:
//   • Adds backend-assigned/backfilled kronox_user_id with KX-XXXX-XXXX-XXXX format and tombstone non-reuse.
//   • Preserves the guest Kronox ID through account linking and rejects client profile edits to the ID.
//   • Adds Profile Info read-only/copy display plus internal friend/Online/reporting dual-write fields while public UI stays username-only.
//
// Codex477 — Unified Kronox Puan scoring:
//   • Online winner delta is exactly +15 and loser delta is exactly -6 with checkpoint protection.
//   • Removes Online speed bonus from scoring, result popup copy, Health expectations, docs, and mirrors.
//   • Preserves Solo time bonus and OnlineMatchResult idempotent write/projection pattern.
//
// Codex476 — Health blocker alignment (KRONOX-MQXVGC0M):
//   • Aligns AuthProvider source with the null-safe current-user contract and exact-pins the root @base44/sdk dependency.
//   • Hardens inactive guest username cleanup Health tokens for explicit execute mode and privacy-safe reason labels.
//   • Re-syncs recent public-identity, Timeline visual safety, and UX guardrail doc mirrors without broad product behavior changes.
//
// Codex475 — Health Center recent-contract audit:
//   • Adds a modular Health suite for recent Profile/Settings, Leaderboard, presence/invite, admin, performance, visual, UX, and SDK coverage inventory.
//   • Adds a runtime mirror for UX quality guardrails and updates Health gap docs from candidate-only to static coverage plus manual proof gates.
//   • No product behavior changes; full Health remains user-run/manual.
//
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
//   • Settings owns Gizlilik Politikası and guarded Hesabı Sil flow.
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

const BUILD_MARKER = 'Codex490';
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
