import React, { useEffect, useState } from 'react';

// Codex644 — Restore SDK/queue/guest-link compatibility, confirm live authenticated Online join/cancel, preserve failed-response evidence, and align Base44 Health/docs/DB guidance without route, scoring, reward, or pricing changes.
// Codex643 — Restore live valid-actor Online admission through scoped Base44 queue-read fallback, preserve fail-closed errors, and add safe waiting/reconciliation diagnostics without route or scoring changes.
// Codex642 — Restore the exact Base44 SDK pin, add bounded queue-read fallback for production matchmaking, and align cancel/timeout Health proof with explicit cleanup reasons.
// Codex641 — Remove no-opponent matchmaking lock churn, classify shared Online/Duello backend failures safely, harden caller-only cleanup/presence pressure, and extend Runtime E2E/Health/docs without scoring or lobby changes.
// Codex640 — Deduplicate Duello suite/case registration while preserving direct-start and Full Health/Runtime E2E separation coverage without product changes.
// Codex639 — Stabilize two-device Duello reciprocal pairing, classified search/retry/cancel state, direct no-lobby handoff, two-context Runtime E2E proof, Health, and docs without scoring changes.
// Codex638 — Clear SDK, transient-timer, and Health catalog identity blockers; harden the Solo in-game exit/tutorial Runtime E2E proof while preserving gameplay and the lobby-free Online/Duello journey.
// Codex637 — Remove the active Online/Duello lobby journey, add backend-authoritative same-screen match-found direct start, and align focused Health, Runtime E2E, docs, and mirrors without scoring changes.
// Codex636 — Fix the legacy /Game versus canonical /game route collision,
// move protected profile/leaderboard access behind authorized backend paths,
// and add action-scoped bounded Runtime E2E response/permission evidence.
// Codex635 — Repair Solo direct/map Runtime E2E entry proof, preserve request-only Online evidence, add safe critical permission correlation, restore exact Base44 SDK 0.8.34, and align targeted Health/docs without gameplay, scoring, or backend-function changes.
// Codex634 — Production custom-domain Runtime E2E target classification, direct-vs-runtime backend proof, safe service/console evidence, targeted Health, and docs without product or backend-function changes.
// Codex633 — Runtime E2E V2 capability preflight, honest App-not-found/setup-gap classification, diagnostic Solo probing, report/UI exports, targeted Health, and docs without gameplay or backend-function changes.
// Codex632 — Repair shared Online/Duello queue lock starvation and poll reconciliation, add timeout-safe matched handoff, App-not-found E2E preflight, targeted Health, and docs without changing gameplay or scoring.
// Codex631 — Add the separate Runtime E2E Automation Health Suite, real browser harness, evidence-safe reporting, and 10 screen scenarios.
// Codex629 — Health proof and Base44 automation audit: evidence classification, manifest/argument/cleanup/logging gates, Phase 1 hygiene reflection, docs/mirrors, and no product or cleanup behavior change.
// Codex628 — Notification artifact recovery proof: Admin-only dry-run/report-only backend flags, bounded fingerprint UI, explicit non-destructive/Yürütme engelli state, Health, and docs; no cleanup or notification behavior change.
// Codex627 — Data Hygiene P0 deep eligibility review: Admin-only fingerprinted reconciliation previews, confidence/conflict classification, blocked three-stage cleanup boundary, Health, and docs; no data mutation or cleanup execution.
// Codex626 — Restore source-connected navigation Health contracts: explicit /game BottomNav hiding, route-derived root re-taps, and backend-snapshot/adaptive-poll-confirmed canonical /game? Online navigation; runtime behavior is unchanged.
// Codex625 — Finalize the user-facing Online mode name as Duello across active UI, backend-safe error copy, Health labels, docs, and mirrors while preserving the stable same_question_duel key and all gameplay/matchmaking/scoring/DB contracts.
// Codex624 — Duello V1: mode-scoped two-player random matchmaking, identical server-authored opening context/shared card sequence, backend first-correct idempotent claims, first-to-10 result, focused gameplay UI, Health, and docs; existing Online and +15/-6 scoring remain unchanged.
// Codex623 — Zero KRONOX-MSZSZ4YL source blockers: exact-pin package.json/package-lock/Base44 SDK 0.8.34, remove BottomNav's optimistic switchTab setter while preserving route-root re-tap, and retarget source-connected Health/docs. No gameplay, scoring, economy, DB, Online, Daily, or visible BottomNav contract changes.
// Codex622 — Close KRONOX-MSZSJKQA Base44-owned Health blockers with source-connected Admin dry-run proof, immediate Wheel Diamond propagation proof, VAPID/Admin/current-contract docs, BottomNav root re-tap, and blocked Data Hygiene execution; no package/backend/product-rule changes.
// Codex621 — Remove the static Admin Release Readiness panel, preserve B1/B3, and retarget release gating to active HealthCenter packs plus canonical manual/external proof docs without product/backend behavior changes.
// Codex620 — VAPID security: migrate sendGameInvitePush to request-time Base44 runtime secrets, preserve fail-closed best-effort invites, and retarget Health/docs without exposing values or changing push UI/Online behavior.
// Codex619 — BottomNav route-sync regression: derive active tab only from committed pathname and remove overlapping global route exits so lazy/root content cannot appear under another tab; add source-connected Health/docs without product behavior changes.
// Codex618 — Data Hygiene P0: extend the guarded Integrity Snapshot with a read-only duplicate cleanup plan, canonical candidate fingerprints, risk/eligibility summaries, and source-connected Health/docs; no cleanup or product behavior changes.
// Codex617 — Base44 Health blocker alignment: retarget Friends actor-scoped social snapshot proof, executable notification suppression, shared wheel Diamond propagation, and explicit Daily cache-preservation branches without changing product rules.
// Codex616 — Notification flood hardening: suppress historical/explicit test invite accept replays, collapse fresh lobby accepts into one bounded toast, cap the global toast stack, and add Admin dry-run plus Health coverage without changing Online authority or scoring.
// Codex615 — Friends reliability: load the Friends snapshot without unrelated game-invite hydration, resolve leaderboard projection usernames to registered users server-side, and report unlinked guest identities honestly; privacy and authorization remain unchanged.
// Codex614 — Restore deployed page-name compatibility for /TestSuite and /AdminPage by redirecting them to the existing guarded canonical routes; Health packs, admin authorization, and product behavior are unchanged.
// Codex613 — Solo Level 1 guest bootstrap: preserve distinct-year coverage before capping the guest question candidate buffer and version the local cache key so stale narrow samples cannot block gameplay; scoring and rewards are unchanged.
// Codex613 — Solo start recovery: invalidate stale question buffers, reject cached pools below the requested distinct-year deck size, and redirect reported /SoloChallenge and /Game URLs to canonical Solo entry; gameplay/scoring/joker rules are unchanged.
// Codex612 — Automated Online entry recovery: preserve the Daily Wheel dismissal fix and redirect the reported /LobbyRoom URL to the canonical /lobby route; multiplayer, scoring, and leaderboard logic are unchanged.
// Codex611 — Daily Wheel modal dismissal: X/SONRA clear both the live auto-open state and per-day marker before unmount, preventing an immediate reopen that blocked Home navigation; reward and Daily task behavior are unchanged.
// Codex610 — Paket B6 HealthCenter intelligence: retire obsolete/duplicate checks with stronger replacements, add grouped on-demand packs, executable catalog self-audit, proof/owner/action reporting, latest completed summaries, and run cleanup without product behavior changes.
// Codex609 — Paket B5 closure: align SDK source policy while keeping lock proof external, remove stale preload/Online docs, harden public username fallback, add Paket B Closure Health, and preserve every manual release gate without product behavior changes.
// Codex608 — Paket B4 release readiness: add an Admin-only read-only manual proof tracker, explicit Health/manual/external boundaries, deployability blockers, source-connected Health, and docs alignment without product behavior changes.
// Codex607 — Paket B3 question quality: extend the existing Admin-only report with bounded category/difficulty/year/duplicate/metadata/readiness QA, add a compact read-only panel, Health proof, and docs alignment without question mutation or gameplay changes.
// Codex606 — Paket B2 performance cleanup: demand-load diagnostics/wheel UI, dedupe Daily status reads, harden Online/Health async cleanup, scope tutorial media, and add source-connected performance Health without changing product behavior.
// Codex605 — Paket B1 read-only integrity: extend the existing admin duplicate report with bounded economy/Daily/Solo/Online proof, add one guarded Integrity Snapshot, source-connected Health, and docs alignment without adding functions or changing product behavior.
// Codex604 — Base44 deployability fix: consolidate exposure-stat reads into recordPlayerQuestionExposure/read_stats, retire the duplicate callable, preserve linked/guest response contracts, and align source-connected Health/docs at the 50-function ceiling. Gameplay, scoring, economy, DB schemas, Online/Daily rules, Solo Streak, and BottomNav are unchanged.
// Codex603 — Paket A post-A1-A4 audit: exact Base44 SDK lock alignment, fixed-copy friend-request cancellation errors, source-connected A2 Health coverage, and honest 51/50 backend deployability documentation. Gameplay, scoring, economy, DB, Online/Daily rules, Solo Streak, and BottomNav are unchanged.
// Codex602 — A4 Health proof hardening: per-source A3 modal/route assertions, rendered-private-key false-positive control, independently scoped A2 retry checks, active Online all-category/shared-deck/join-code proof, exact BottomNav extraction, and current docs/mirror alignment. Product behavior is unchanged.
//
// Codex601 — A3 mobile safety pass: 320/360/390px width containment, BottomNav/safe-area clearance, short-height modal scrolling, reachable 44px actions, WebView 100dvh bounds, and source-connected mobile guards. Gameplay, scoring, economy, DB, Online/Daily behavior, Solo Streak, and BottomNav items are unchanged.
//
// Codex600 — A2 Health blocker repair: explicit local Tekrar Dene actions for Profile Joker Çantası and Online player selection, completed-guest-safe selection retry, safe fixed error copy, and explicit previous-row preservation during transient presence refresh failure. Gameplay, scoring, economy, DB, matching, Daily, Solo Streak, and BottomNav are unchanged.
//
// Codex599 — A2 error/empty/loading standardization: shared mobile-safe state panels, local scoped retries, safe Turkish action copy, cached-row preservation, nonblocking Online social and Leaderboard enrichment failures, and source-connected Health guards. Gameplay, scoring, economy, DB, Online/Daily rules, Solo Streak, and BottomNav are unchanged.
//
// Codex598 — Fix A1 Health regression: restore the exact Leaderboard root className="leaderboard-page text-white", keep A1 card polish scoped beneath .leaderboard-page, and restore package.json to exact @base44/sdk 0.8.34. Base44 still exposes no package-lock.json, so the lockfile half of the SDK Health gate remains unresolved; Leaderboard data/scoring/friend/avatar behavior is unchanged.
//
// Codex597 — A1 visual polish pass: shared navy/cyan/gold depth tokens, tactile cards/buttons, restrained finite decorative motion, and safe-area/mobile refinements across Home, Solo, Online, Daily, Wheel, Store, Profile, and Liderlik. Gameplay, scoring, economy, data, backend authority, routes, and product rules are unchanged.
//
// Codex596 — Health blocker repair: Solo move Health now follows executable evaluated-feedback mapping, the frontend Base44 SDK package returns to exact 0.8.34, and Daily Calendar 200-Diamond ledger source/direction proof is explicit and separate from Solo Streak. Base44 did not expose/generate package-lock.json, so that strict lockfile gate remains unresolved; Online scoring and product rules are unchanged.
//
// Codex595 - Solo Streak V1 hardening: placement/receipt dedupe, exact level
// proof, bounded receipt/lock retry, explicit assistance persistence,
// fail-closed guest/training copy, mobile/reduced-motion guards, and expanded
// source-connected Health coverage without Online/Daily/Puan impact.
//
// Codex594 — Solo-only Kronox Seri Sistemi V1: clean-answer 2/3/4/5 feedback,
// assisted-answer neutrality, level 1-6 visual-only protection, and locked/idempotent
// authenticated Diamond milestone rewards with source-connected Health coverage.
//
// Codex593 - Daily Goals runtime source-proof completion:
//   - Real Joker/Hint spends retry and verify exact ledger receipts; Time
//     Freeze requires its exact type and token-proven guests remain supported.
//   - Solo completion/jokerless bind the exact persisted passed attempt;
//     answer streaks use real uninterrupted QuestionAttemptEvent rows.
//   - Profile/Friend event callers, shared cache refresh, receipt idempotency,
//     canonical task cycle, docs/mirrors, and 18 executable Health simulations
//     are aligned without changing Puan, Leaderboard, or BottomNav.
//
// Codex592 — Fix Health FAIL KRONOX-MRUC9UZE:
//   - Retarget stale Online category source/deck Health checks to the current
//     no-selector contract: Category-row metadata source, all-active-random
//     Online policy, and compatibility-only selected_category_ids.
//   - Online shared deck Health now follows the real
//     online_shared_all_active_random_deck_v1 metadata written by
//     startLobbyGame and consumed through normalizeOnlineQuestionDeck while
//     Solo question fetching stays disabled for Online.
//   - Question data model docs now name all active Online-eligible Category
//     rows instead of stale selected lobby categories.
//
// Codex591 — Fix Health FAIL KRONOX-MRT8YU8S after main sync:
//   - Retarget stale Online category Health contracts to current no-selector
//     Online flow: all active categories are used randomly, with no
//     selectedCategories or UI selected_category_ids propagation.
//   - startLobbyGame/findLobbyByCode ignore legacy selected category inputs
//     for current Online; random matchmaking and invite/create/join entry
//     points stay independent from category/social-list failure.
//   - Restore exact @base44/sdk 0.8.34 package/lock contract after main sync.
//   - Docs and mirrors now describe Online all-active-random deck ownership.
//
// Codex590 — Fix Health FAIL KRONOX-MRHQNT85 final blockers:
//   - WaitingRoomPanel renders the real invite-centric section title
//     "Davet edilen arkadaşların" while keeping lobby code as "Yedek kod".
//   - acceptFriendRequest has an explicit accept-only receiver guard returning
//     403 "Only the receiver can accept this request"; reject remains
//     receiver-only with the existing update message.
//   - No invite/lobby logic, Online scoring, BottomNav, or public identity
//     payload shape changed.
//   - package-lock root @base44/sdk spec is exact 0.8.34 again after main sync.
//
// Codex589 — Fix Health FAIL KRONOX-MRHQ7K50 (post-Hamle 3):
//   - acceptFriendRequest now guards accept/reject with a single
//     receiver-only check (403 "Only the receiver can update this request").
//   - Waiting room copy is invite-centric ("Daveti kabul eden arkadaşların
//     buraya katılır."), keeping "Yedek kod" and "Oyuncular (" as backup UX.
//   - @base44/sdk is exact-pinned to 0.8.34 in package.json (no caret),
//     matching critical Base44 function Deno imports.
//   - Question analytics "does not change gameplay rules" Health contract
//     now follows calculateSoloAttemptResult through its real Hamle 3
//     location (soloRuntimeModel/soloAttemptEffects), not a stale Game.jsx-only
//     expectation.
//   - Added Health suites offline_solo, waiting_room_start, and
//     route_bootstrap, proving (from real current source): Daily Quest
//     solo_level_complete only fires after a passed+persisted Solo attempt;
//     Online waiting-room start uses backend snapshot + adaptive fallback
//     poll (not route state alone); and live Lobby data outranks stale route
//     snapshots via visibility/focus/poll refresh.
//   - No scoring, Online flow, Daily task cycle, Store prices, or BottomNav
//     changed.
//
// Codex588 - Hamle 3 P1 architecture and Health hardening:
//   - Solo runtime now uses the attempt reducer/ViewModel/effect boundary.
//   - Lobby fallback polling is adaptive and scoped waiting/game DTOs reduce
//     payload; social profile hydration is batched; Leaderboard reads are pure.
//   - Auth/Profile mapping is shared and completed guests see token-proven
//     Joker/Hint inventory; typecheck noise falls from 1,260 to 370 errors.
//   - Architecture/DB/mobile docs and runtime-connected Health are aligned.
//
// Codex587 — Pre-Hamle 3 Health stabilization:
//   • Live Lobby polling/focus refresh wins over route snapshots; host start
//     and waiting-room invite UX use current sanitized backend contracts.
//   • Friend/invite RLS, Leaderboard enrichment/avatar, Online result audit,
//     Diamond/Daily/DB, and backend-security Health scan active source owners.
//   • Backend-authoritative Online scoring and guest/public DTO boundaries are
//     preserved; no Hamle 3 P1 refactor is included.
//
// Codex586 — Hamle 2 P0 authority, integrity, and deployability pass:
//   • Online Lobby/result mutations are backend-owned for linked and
//     token-proven guest actors, lock/revision guarded, and privacy-sanitized.
//   • Daily assignments require canonical distinct keys and progress requires
//     persisted same-actor/day provenance; notification open is nonterminal.
//   • Base44 deploy gate caps 50 functions and exact-pins SDK 0.8.34; stale
//     Health cases and docs now point at active source contracts.
//
// Codex585 — Daily Wheel Health exact close/reopen contract alignment:
//   • Source-connected no-spin close comments guard that closing the
//     auto-popup does not consume the free spin or complete Çark çevir.
//   • getDailyQuestStatus reconciliation explicitly documents that opening
//     or reopening the wheel does not create Daily progress.
//   • Docs/mirrors use the exact Health-visible contract wording.
//
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


const BUILD_MARKER = 'Codex644';
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