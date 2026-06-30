import React, { useEffect, useState } from 'react';

// Codex501 — Solo joker spend/runtime polish:
//   • Normal Solo joker use now treats spendUserJoker balanceAfter as authoritative for the used joker in UI/cache, so badges decrement immediately after a successful server-backed spend.
//   • spendUserJoker reconciles duplicate same-user/same-joker UserJokerInventory rows to the post-spend balance, preventing refresh/reopen from restoring stale higher counts.
//   • Guided/tutorial joker demos still use attempt-local demo balances and never call the real inventory spend path.
//   • Solo joker rail renders only safe error text; normal success/status overlays such as timer-freeze completion or shield protection copy are removed from gameplay.
//   • The Solo joker rail is centered in the right gutter beside the active question card while preserving drag locks and Online isolation.
//
// Codex500 — Health blocker fixes (KRONOX-MR0J17RW), no product behavior change:
//   • AuthContext bootstrap restores the exact source contract: setUser(currentUser || null), setIsAuthenticated(!!currentUser), and currentGuestProfile = await repairGuestOnboardingCompletionIfNeeded(currentGuestProfile); guest bootstrap still works without login.
//   • Lazy init for existing authenticated users runs through ensureDiamondEconomyForUser(currentUser) + ensureStarterJokers(currentUser), keyed once per identity so refresh/re-render never re-grants.
//   • App shell registers one presence heartbeat (usePresenceHeartbeat(user, guestProfile)); deferred until non-critical startup, runtime-session safe.
//   • Online result popup state carries persisted proof (scoreAfter + saved: true) only after persistence; save failure stays a non-saved error/pending state.
//   • Daily Wheel result reveal/landing both derive from the backend reward amount (highlightAmount={revealReady ? result.rewardAmount : null}); already-claimed branch sits after a dedicated ) : hasReward ? ( branch and shows direct status copy with no fake spin.
//   • Guided tutorial joker demo marker (data-kronox-guided-joker-single-copy) is runtime-connected from Game.jsx; demos never spend real UserJokerInventory.
//   • @base44/sdk exact-pinned to 0.8.34 in package.json and package-lock.json root spec (no caret).
//
// Codex499 — Solo gameplay layout: question-card joker rail + proportional scale:
//   • Solo joker buttons now render as a right-side rail beside the active question card, removing the old bottom joker strip so the timeline/CTA area reclaims vertical space.
//   • Active question card, timeline cards, drop slots, and timeline line are driven by Solo-scoped CSS variables with safe fallbacks; Online gameplay remains on the old render path.
//   • Joker use is blocked during active card drag plus a 160ms post-drag guard, while the usable tap feedback uses the requested 0.26s scale sequence and one-shot 0.42s activation ring.
//   • Health visual guardrail protects the right-rail layout, proportional sizing variables, drag-safe joker lock, and tap/ring animation tokens.
//
// Codex498 — App startup fast path after Android video review:
//   • Auth bootstrap now releases Home after minimal identity readiness; profile hydration, Kronox ID ensure, Diamond economy grant, starter joker repair, guest account-link merge, admin status, app-open activity, and guest verification run as guarded background maintenance.
//   • Home is part of the initial app shell instead of a lazy route chunk; presence, invite notifier, category modal, Market/Liderlik warm-up, Daily Wheel status, and Daily Quest status are deferred until after paint/idle.
//   • Health/docs now protect the startup split: critical identity bootstrap, first Home render, then non-critical background refresh. Low-end Android/WebView timing proof remains manual.
//
// Codex497 — Daily Wheel UX/visual/motion redesign (no security/economy change):
//   • Spin now starts immediately on tap. Opening the wheel (card tap or modal "Çevir") opens the result and calls claim() in one motion — the visible "Ödül hazırlanıyor..." prepare wait is removed; the button locks with "Çevriliyor...".
//   • RewardWheel motion replaced with one coherent loop→landing model: a steady continuous pre-spin loop while the server reward is in-flight, then a SINGLE cubic-bezier deceleration (WHEEL_LANDING_EASE) to the winning slice. Removes the old 6-keyframe array with linear-then-overshoot-then-bounce that produced the 2–3 perceived speed phases.
//   • Result reveal still waits for the wheel to visually land (4.6s landing, reduced-motion 0.9s). Transform-only animation for smooth Android/iOS WebView.
//   • Reward stays 100% server-authoritative + idempotent: client animation only visualizes the already-decided reward; once-per-day guard, Diamond-only, no Kronox Puan, no leaderboard effect all unchanged. Daily Quest / Market untouched.
//   • Health: added daily_wheel_single_coherent_spin_motion; updated daily_wheel_spin_duration_and_button_lock for the new disableClose contract.
//
// Codex496 — Health blocker fix (KRONOX-MQZDODAC): materialized Kronox Puan is the primary visible read path:
//   • kronoxScore.js getMaterializedKronoxScore now documents the direct visible-score contract (kronoxPuan = kronox_puan_total) so the materialized current-score projection is unambiguously the PRIMARY read path; getKronoxVisibleScore still prefers materialized and only derives Solo+Online for older rows missing the projection. Runtime score logic and values unchanged.
//   • Unified Solo + Online stays one materialized score (User/GuestProfile.kronox_puan_total, SoloLeaderboardEntry.total_kronox_score legacy projection name includes Online writes). Leaderboard reads sorted materialized projection rows, not historical transaction recomputation.
//   • Online winner +15 / loser -6, no speed bonus; Daily Quest / Daily Wheel remain Diamond-only and never write Kronox Puan.
//
// Codex495 — Health blocker fixes (KRONOX-MQZDE2V6): visible Puan composition + SDK exact pin:
//   • kronoxScore.js visible Puan helper re-documents the UNIFIED Online + Solo composition (solo_progress.totalSoloScore + online_progress.score), preferring materialized kronox_puan_total; SoloLeaderboardEntry.total_kronox_score is a legacy projection name, not a Solo-only score model. Runtime score logic unchanged.
//   • Daily Quest / Daily Wheel remain Diamond-only and never write Kronox Puan.
//   • Re-pinned @base44/sdk to exact 0.8.34 in root package.json + package-lock.json (root spec, resolved node, integrity); critical Base44 functions already import npm:@base44/sdk@0.8.34.
//
// Codex494 — Liderlik performance + materialized score projection:
//   • Home idles the Liderlik chunk and projection-only leaderboard snapshot; Liderlik renders cached rows while refetching.
//   • getSoloLeaderboard supports fast projection reads with repairMode: 'skip' and deferred friend badges, while bounded repair remains available off the hot path.
//   • Visible Kronox Puan reads prefer materialized kronox_puan_total and fall back to Solo+Online derivation for older rows.
//
// Codex493 — Health blocker fixes (KRONOX-MQZBZ0FS): Market refresh + readiness + admin pull-to-refresh:
//   • MarketPage post-purchase setUser((current) => ({...})) patches the shared auth Diamond total so Home/Profile refresh without reload.
//   • Purchase CTA derives from explicit readiness: const disabled = readiness.disabled / const buttonLabel = readiness.label (no broad page/inventory loading gate).
//   • ResetUserProgressTool consumes useContext(AdminRefreshContext) so admin PullToRefresh reloads a previewed user inside the AdminUser-gated page.
//
// Codex492 — Market post-purchase balance sync + CTA states:
//   • MarketPage pushes the authoritative post-purchase Diamond total into shared auth via setUser so Home/Profile refresh without reload.
//   • Product card CTA is explicit "Satın Al" with an "İşleniyor" in-flight state; catalog falls back to MARKET_JOKER_PRODUCTS.
//   • Admin maintenance lists keep the existing AdminRefreshContext pull-to-refresh wiring.
//
// Codex491 — Mağaza performance/readiness pass:
//   • Market opens from AuthContext and static catalog immediately; Home idles in the Market chunk and fast joker inventory cache.
//   • Satın Al readiness is explicit and no longer waits on non-critical inventory count refresh/starter self-heal.
//   • purchaseJokerWithDiamonds keeps server-price/idempotency/economy-lock guards and parallelizes starter inventory repair.
//
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

const BUILD_MARKER = 'Codex500';
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
