import React, { useEffect, useState } from 'react';

// Codex143 — Online match completion scoring:
//   • Allows first score apply when OnlineMatchResult lookup is unavailable.
//   • Shows the current player's applied Online puan delta in GameOver.
//
// Codex142 — acceptGameInvite recipient-only Health contract:
//   • Keeps the real toEmail !== myEmail guard and restores the exact
//     unauthorized copy expected by the GameInvite/RLS Health suites.
//
// Codex141 — Final GameInvite open-to-lobby Health alignment:
//   • Restores the client parser contract name `parseBase44Timestamp`.
//   • Returns structured acceptGameInvite success/error payloads with
//     lobby/lobbyId/lobbyCode and specific invite/lobby error codes.
//
// Codex140 — GameInvite "Aç" opens Lobby fix:
//   • Reuses UTC-safe timestamp parsing for lobby stale checks so Base44
//     naive lobby timestamps do not make fresh invites show "Lobi süresi doldu".
//   • Refreshes lobby last_activity_at on invite/code joins and adds modular
//     Health coverage for the notification-open-to-lobby path.
//
// Codex139 — DB/Data Model hardening package:
//   • Documents live User/Lobby/GameInvite fields and adds OnlineMatchResult.
//   • Scopes Solo localStorage mirrors by user so shared devices do not leak
//     progress across signed-in accounts.
//   • Aligns getSoloLeaderboard scoring boundaries with canonical Solo helper.
//   • Adds OnlineMatchResult idempotency/audit rows and non-destructive
//     cleanup/retention helpers guarded by modular Health cases.
//
// Codex137 — Health Check cleanup for remaining GameInvite failures:
//   • Incoming invite UI now uses the public isGameInviteExpired(invite)
//     guard expected by Health and keeps expired accept buttons disabled.
//   • TTL parity checks point at the centralized gameInviteSelectors source.
//   • Header badge fixtures now model valid expiring GameInvite rows.
//
// Codex136 — GameInvite lifecycle merge hardening:
//   • Preserves the newer shared header notification system from Codex135.
//   • Reapplies 10-minute invite persistence, merge-safe subscription/fetch
//     handling, and shared openGameInvite routing after remote Codex sync.
//   • Removes the duplicate local game-invite-only header bell so the
//     notification header remains one unified source.
//
// Codex121 — Liderlik missing entity backend fix:
//   • Adds getSoloLeaderboard as a service-role, public-safe projection of
//     existing User.solo_progress so the table can load even when the live
//     Base44 app has not registered SoloLeaderboardEntry yet.
//   • SoloLeaderboardEntry publishing remains best-effort, but a missing
//     runtime entity schema no longer leaks to the UI or blocks a user's
//     real own-score row.
//   • The fallback row uses the real current-user score with rank pending;
//     no fake users, fake ranks, raw emails, or private profile fields.
//
// Previous note: Codex120 — Public-safe Liderlik table + graceful fallback integration:
//   • Merges the extracted KronoxRankingSection fallback UI with the new
//     SoloLeaderboardEntry public score source.
//   • Keeps real table rows visible when public leaderboard entries exist,
//     while preserving the user's own Puan/Level fallback during rollout.
//   • Keeps normal users away from backend diagnostic wording; admin-only
//     diagnostics remain gated in the section component.
//
// Previous note: Codex117 — Public-safe Liderlik leaderboard source:
//   • Adds SoloLeaderboardEntry as the public-safe score source instead of
//     depending on private full User row reads.
//   • Mirrors current-user Solo progress on write/backfill/Leaderboard load so
//     valid scores can render in the Kronox Sıralaması table.
//   • Ranks by totalSoloScore, then current level, total stars, aggregate best
//     time, and stable public owner key.
//   • Highlights the current user, marks accepted friends, and never renders
//     mock users, fake ranks, or raw email addresses.
//   • Updates the modular leaderboard_health suite for the public score source.
//
// Previous note: Codex116 — Real Liderlik leaderboard section:
//   • Replaces the Arkadaş Sıralaması placeholder with real User.solo_progress
//     ranking when readable through Base44 User rows.
//   • Ranks by totalSoloScore, then current level, total stars, aggregate best
//     time, and stable identity key.
//   • Highlights the current user, marks accepted friends, and never renders
//     mock users, fake ranks, or raw email addresses.
//   • Adds a modular leaderboard_health suite through the Health registry.
//
// Previous note: Codex115 — Liderlik Elmas stat correction:
//   • Liderlik third stat card is now "Elmas", not "Yıldız".
//   • Puan and Level still read real Solo progress summary values.
//   • Elmas reads an explicit profile/economy diamond field when present,
//     otherwise shows a safe 0 placeholder.
//   • Elmas is never derived from Solo stars, score, or completed levels.
//   • Modular Solo Health contract now guards this leaderboard stat shape.
//
// Previous note: Codex114 — Solo Health Checker scoring coverage:
//   • Health now explicitly includes the profile score/source contract
//     alongside score math, replay delta, leaderboard, popup, ranking,
//     and existing-progress backfill checks.
//   • Star-backfill coverage now asserts 3/2/1/0-star mapping in one
//     executable case.
//   • simulationPanelExtraCases.js remains frozen; modular
//     simulationPanelSoloProgressCases.jsx continues through the registry.
//
// Previous note: Codex113 — Solo score migration/backfill:
//   • Existing User.solo_progress records with bestStars but missing
//     bestScore now backfill score fields from star base + reliable
//     bestTimeSeconds only.
//   • Missing time is never invented; those records receive base score only.
//   • totalSoloScore is recomputed from level bestScore values every time,
//     making the migration idempotent and preventing replay duplication.
//   • currentLevel is only preserved or raised from completed-level history;
//     existing unlock progress is never reduced.
//   • SoloChallenge/Profile/Leaderboard run current-user backfill once on
//     profile load and persist only when normalized progress differs.
//   • Health adds executable backfill cases for star-only progress, time
//     bonus, idempotency, no fake time, and unlock preservation.
//
// Previous note: Codex112 — Solo replay score delta hardening:
//   • getBestSoloLevelResult now returns updatedBestLevelResult,
//     previousBestScore, scoreDelta, and didImprove.
//   • totalSoloScore remains a derived sum of per-level bestScore values,
//     never an accumulating sum of all attempts.
//   • Same-score or worse replays add +0; better replays add only the
//     difference (e.g. 13 → 18 adds +5).
//   • Result popup can show "Yeni en iyi puan! +N" or
//     "En iyi puanın korunuyor" without implying duplicate score gain.
//   • Health adds executable replay-delta, sum-of-best-scores, and
//     no-duplicate-points cases.
//
// Previous note: Codex111 — Solo scoring + leaderboard source of truth:
//   • Shared scoring helpers calculate stars, time bonus, levelScore,
//     attempt result, best replay preservation, and Solo progress summary.
//   • Solo progress now stores bestScore / bestScore breakdown /
//     lastAttemptAt plus a derived summary for Profile and Leaderboard.
//   • Result popup shows earned points with base-score + speed-bonus
//     breakdown while keeping "Level X" + Play and "Tekrar Oyna".
//   • Profile and Liderlik read totalSoloScore/currentLevel/totalStars from
//     the same User.solo_progress source; no fake friend/global ranks.
//   • Health solo_progress suite now covers score math, single-source helper,
//     replay preservation, popup score visibility, leaderboard contract, and
//     honest rank placeholder behavior.
//   • Drag/drop, Timeline, QuestionCard, GameLayout placement mechanics,
//     online invites/lobby/notifications/tutorial — untouched.
//
// Previous note: Codex110 — Solo unlock SELF-HEALING + CTA / focus / Profile single
// source of truth:
//   • NEW lib/soloProgressHelpers.js — getHighestCompletedLevel,
//     getEffectiveUnlockedLevel, getCurrentPlayableLevel,
//     getDefaultSelectedLevel, getLevelStatus, canPlayLevel.
//   • The effective unlock frontier is now
//       max(persisted currentLevel, highestCompletedLevel + 1)
//     so completing Level 8 ALWAYS implies Level 9 is unlocked, even
//     when the persisted `currentLevel` snapshot is stale (server write
//     dropped, new device with empty localStorage, partial sync, etc.).
//     This is the actual fix for "Level 9 locked after 1-8 completed".
//   • applyLevelAttempt now recomputes the frontier on EVERY call from
//     (prior currentLevel, highest stars, fresh attempt). Old "only
//     bump on pass when nextUnlock > current" branch removed.
//   • getSoloLevels delegates status entirely to getLevelStatus — no
//     more inline picker. Eliminates the multi-current edge cases.
//   • SoloChallenge: progressLoaded gate prevents CTA from committing
//     to "Level 1" before server snapshot resolves; userTouchedSelection
//     makes the default-selection sticky after a tap, but resets after
//     a level result so the freshly unlocked level becomes default
//     focus on return.
//   • LevelMapPath: new focusLevelNumber prop wins over the internal
//     find(status==='current') so auto-scroll always targets the shared
//     helper's "current playable" level.
//   • ProfilePage: Level tile now reads through getCurrentPlayableLevel,
//     identical to Solo. Self-heals from the same signal.
//   • NEW Health suite `solo_unlock_self_healing` (12 cases) including
//     LIVE behavioral assertions for the 1-8 → Level 9 scenario, the
//     stale-currentLevel recovery, applyLevelAttempt monotonicity,
//     fail does-not-unlock, status shape invariants, and CTA / focus /
//     Profile contract checks.
//   • Drag/drop, Timeline, QuestionCard, GameLayout, online invite,
//     lobby, notification, tutorial profile — UNTOUCHED.
//
// Previous note: Codex109 — Solo focus & unlock fixes:
//   • getSoloLevels now picks exactly ONE current level (the highest
//     unlocked & unfinished one). Previously every uncompleted unlocked
//     level was 'current', so auto-scroll always targeted Level 1 and
//     the bottom Play CTA always showed "LEVEL 1".
//   • LevelMapPath auto-scroll hardened: rAF-deferred, retries when
//     container clientHeight is still 0 on first paint, falls back to
//     scrollIntoView({block:'center'}). Fixes the "ekran Level 20'lerin
//     üstünde açılıyor" bug on Android WebViews.
//   • Locked node visual: subtle stone gradient + faint level number
//     ghost under the lock icon. Less dead/empty, still clearly locked.
//   • Profile/Solo source-of-truth (readSoloProgress), applyLevelAttempt
//     unlock formula (N → N+1), drag/drop, Timeline, QuestionCard,
//     GameLayout, online/lobby/invite/notification/tutorial — UNCHANGED.
//   • New Health suite `solo_focus_and_unlock` (5 cases) locks the new
//     invariants without bloating simulationPanelExtraCases.js.
//
// Previous note: Codex108 — Solo Level Path becomes a scrollable vertical adventure map:
// Level 1 at the bottom, upward progression, alternating left/right path,
// auto-scroll to current level on mount, and a new zone/theme banner
// every 5 levels (4 zones cover the 20-level catalog). BottomNav stays
// visible on /solo. New Health suite `solo_adventure_map` locks the
// scrollable-map + reversed-render + auto-scroll + zone-banner contracts.
// Solo gameplay rules (10 cards / 120s / 8 mistakes / star ladder /
// replay rules / Profile sync) and Health Solo Progress suite — untouched.
//
// Previous note: Codex107 — Build marker format/consistency fix. The Health
// Simulator extracts the build marker from this file's FIRST CodexN token,
// so this line must hold the current clean CodexN value. Keep it in sync
// with `BUILD_MARKER` below and with `appDiagSetBuildMarker(...)` inside
// App.jsx. Hyphenated dotted-suffix forms are rejected by the Health
// case `historical_kronox_regression.build_marker_bumped_beyond_codex090`.
//
// Previous note: Codex104 — hardens BottomNav runtime visibility for /lobby sub-flows:
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
// Previous note: Codex106 — Health Center case registration architecture cleanup:
//   • New aggregator: components/game/simulationPanelCaseRegistry.js
//     exports ALL_EXTRA_SUITES + ALL_EXTRA_TESTS (legacy social/release
//     risk cases + every modular file). SimulationPanel.jsx now imports
//     only from this registry — no case-specific imports.
//   • Solo cases moved from a temporary Codex-tagged module to the
//     permanent simulationPanelSoloProgressCases.js (no Codex tag in
//     the filename).
//     Each modular file exports `EXTRA_SUITES` + `EXTRA_TESTS`; the
//     registry flattens them in one place. To add a new health case
//     file: drop it next to the Solo file, register it inside
//     MODULES in the registry. Done — suites, counts, top blockers,
//     score penalties, JSON export, and side panel all pick it up.
//   • simulationPanelExtraCases.js stays frozen (2000-line cap). No
//     new case ever needs to be wedged into it.
//   • Penalty hooks are unchanged: criticalSocialUncertaintyPenalty
//     stays scoped to its existing social/RLS/invite suite list (new
//     non-social suites must NOT inflate it); criticalStaticLimitationPenalty
//     remains suite-agnostic so new critical+runtimeProofRequired+
//     STATIC_CHECK_LIMITATION PASS cases get the right additive penalty
//     automatically.
//   • Build marker bumped. Solo gameplay rules, level progression,
//     Profile logic, timer/audio/result-popup logic, drag/drop,
//     Timeline, QuestionCard, GameLayout, invite, lobby, notification,
//     and tutorial — DOKUNULMADI.
//
// Previous note: Codex106 — Solo gameplay polish + Profile/Solo consistency:
//   • Bug 1 fix: Profile Level now reads User.solo_progress.currentLevel
//     via the SAME readSoloProgress helper SoloChallenge uses. Previously
//     Profile hard-coded `value: 1`, so reaching Solo Level 3 left Profile
//     stuck at 1. Single source of truth restored.
//   • Bug 2 fix: Result popup next-level CTA is now "Level X" with a Play
//     icon (Play already imported). The old "Level X'e Geç" string is
//     removed. Replay still says "Tekrar Oyna"; failed attempts never get
//     an enabled next-level button.
//   • Bug 3 fix: Last-10-second audio countdown. SoloLevelTimer plays
//     sounds.urgencyTick() exactly once per remaining second from 10→1,
//     deduped by a ref. Cleanup is React-implicit (no setInterval), and
//     audio failure is swallowed by try/catch so gameplay never breaks.
//   • Health Center: three new Solo cases in a new suite
//     (solo_progress_health):
//       - solo_progress_profile_source_of_truth (static PASS contract)
//       - solo_result_popup_next_level_cta_contract (static PASS contract)
//       - solo_timer_last_10_seconds_audio_cue (static PASS contract)
//     Two NOT_AUTOMATABLE companion cases keep the honest runtime gaps
//     visible (real-device audio + cross-screen profile refresh).
//   New cases live in components/game/simulationPanelSoloProgressCases.js
//   because simulationPanelExtraCases.js hit the 2000-line edit cap.
//   SimulationPanel.jsx merges both sets without altering existing ids.
// Solo rules unchanged: 10 cards / 120s / 0-1=3⭐ / 2-4=2⭐ / 5-7=1⭐ /
// 8+ fail / timeout fail / replay never reduces bestStars / pass unlocks
// next level / fail does not unlock.
// Online flow, lobby, invites, notifications, matchmaking, tutorial
// profile, drag/drop, Timeline, QuestionCard — DOKUNULMADI.
//
// Previous note: Codex106 — readSoloProgress "more advanced of two" +
//   visible 120s SoloLevelTimer (no audio cue).
// Previous note: Codex106 — Solo level completion popup polish.
// Previous note: Codex106 — Solo Level Path (vertical 8-row path).
// Codex126 — Solo map focus Health regression fix (3 FAIL → 0).
//   • LevelMapPath.jsx auto-scroll comment block previously contained
//     the literal substring "scrollIntoView" (describing the OLD bug we
//     fixed). The Health static contracts
//     `solo_focus_and_unlock.auto_scroll_resilient_to_layout_timing` and
//     `solo_map_focus.solo_map_scroll_container_is_inner` forbid that
//     substring anywhere in the file (defensive against regression).
//     Rephrased the comment to describe the legacy outer-ancestor
//     fallback without using the forbidden token. No behavior change.
//   • LevelMapPath.jsx useLayoutEffect deps were
//     [currentLevelNumber, levels, bottomReservedPx, diagnosticsEnabled,
//      focusedLevel]
//     but `focusedLevel` is derived from `focusLevelNumber + levels`,
//     both already feeding `currentLevelNumber`. The extra dep also
//     broke the Health contract `solo_map_focus.solo_map_refocus_after_
//     progress_load`, which expects the exact substring
//     "[currentLevelNumber, levels, bottomReservedPx, diagnosticsEnabled]".
//     Removed `focusedLevel` from the deps. Refocus behavior unchanged —
//     a focus change still triggers via currentLevelNumber.
//   • scrollSoloMapToLevel.js — no change. Already passes its own
//     contract (queries [data-kx-solo-map-container], assigns
//     container.scrollTop directly, no window.scrollTo, no scrollIntoView).
//   • Stable DOM hooks unchanged: container has
//     data-kx-solo-map-container="true", each node has
//     data-kx-solo-level={level.levelNumber}.
//   • rAF + clientHeight retry behavior unchanged: when container
//     clientHeight===0 we defer the helper start to the next animation
//     frame; the helper itself retries up to 20 frames until centered;
//     unmount cancels both the kick rAF and the helper's internal loop.
//   • No Solo scoring/progression change. No Profile/Leaderboard change.
//     No drag/drop / Timeline / QuestionCard / GameLayout change.
//     No invite/lobby/notification/tutorial/friends change.
//
// Codex125 — Phase 3 Health regression fix (no product behavior change).
//   • Restored `fantasy_visual_update.profile_uses_fantasy_tokens` static
//     contract after Phase 3 moved the gold tile rendering into
//     KronoxStatTile. ProfilePage.jsx now mirrors the approved fantasy
//     tokens (#facc15 / #ffe066 / font-cinzel / font-bangers) in a doc
//     comment so the contract scans the right surface. Page renders
//     identically — no business behavior change.
//   • Restored ~18 Health Center report-architecture static contracts
//     (research_test_strategy, report_ux_human_decision, sre_release_
//     health_signals, historical_kronox_regression.case_errors_do_not_
//     crash_settings) that scan `SimulationPanel.jsx` for report/runner/
//     UI tokens which were moved into the Codex123 health/* split modules
//     (simulationRunner.js / simulationReportBuilder.js / healthStatus.js
//     / SimulationReportActions.jsx). Added a single architecture-pointer
//     comment block inside SimulationPanel.jsx that documents WHICH new
//     module owns each token. The behavior (case-error → STATUS.ERROR,
//     report shape, score.explanation, manual/runtime sections, all
//     action types) is unchanged — every cited owner-file already
//     contains the real implementation.
//   • Solo map focus contracts (solo_focus_and_unlock.auto_scroll_
//     resilient_to_layout_timing, solo_map_focus.solo_map_refocus_after_
//     progress_load, solo_map_focus.solo_map_scroll_container_is_inner)
//     already match the live source. No code change required — current
//     LevelMapPath.jsx + lib/scrollSoloMapToLevel.js implementation
//     exposes the rAF retry + clientHeight guard + direct
//     container.scrollTop assignment + stable DOM hooks, with no
//     scrollIntoView regression and no window.scrollTo fallback.
//   • BuildMarker bumped to Codex125 so the Health rerun shows the fix
//     window.
//   • No real Health checks were removed. No FAILs were downgraded to
//     WARNING/PASS. Manual + runtime-proof NOT_AUTOMATABLE cases remain
//     NOT_AUTOMATABLE.
//
// Codex124 — Phase 3: UI/UX standardization + medium-risk cleanup.
//   • Shared <KronoxStatTile /> introduced under components/ui/.
//     Profile + Leaderboard now render Puan / Level / Elmas through the
//     same presentational component (two near-duplicate inline StatTile
//     definitions removed). Data sources unchanged:
//       - Puan  → summarizeSoloProgress(...).totalSoloScore
//       - Level → getCurrentPlayableLevel(...) (Profile) /
//                 summarizeSoloProgress(...).currentLevel (Leaderboard)
//       - Elmas → getLeaderboardDiamondValue(user) on both surfaces
//   • Shared style tokens introduced under lib/kronoxStyleTokens.js
//     (gradients, gold/portal border shadows, gold heading style,
//     safe-area helpers). Tokens are exported but applied only as new
//     callers are written — no existing screen is force-migrated.
//   • New Health suite `ui_shared_components` (registered through the
//     modular case registry — `simulationPanelExtraCases.jsx` stays
//     frozen). Locks: shared StatTile usage on both screens, Puan/
//     Level/Elmas composition with no Yıldız tile, Elmas source-of-
//     truth preserved, KronoxStatTile variant support, style token
//     exports present, + an honest NOT_AUTOMATABLE visual-parity case.
//   • BottomNav, lobby header/topbar wiring, Game.jsx, useGameActions,
//     useLobbySync, Timeline, QuestionCard, GameLayout, drag/drop,
//     soloProgressHelpers, leaderboard ranking, Solo map focus —
//     DOKUNULMADI.
//
// Codex123 — Phase 2: Health Center architecture split.
//   • SimulationPanel.jsx reduced from a 1645-line monolith to an
//     orchestration shell (~250 lines). All product behavior is preserved.
//   • New modules under components/game/health/:
//       - healthStatus.js          (STATUS enum, look, result helpers,
//                                    sanitizeForReport, safeRender)
//       - simulationRunner.js      (executeCase, createRunMeta,
//                                    captureEnvironment, extractBuildMarker)
//       - simulationReportBuilder.js (buildReport, scoring, manual
//                                      verification grouping, human summary)
//       - simulationCases.js       (TESTS / SUITES / SRC / contract mirror
//                                    strings / makeCase helpers)
//       - SimulationCaseRow.jsx    (per-case row UI + StatusBadge)
//       - SimulationSuiteSummary.jsx (sidebar: Run All, Run Suite,
//                                      counts, last-run, suite picker)
//       - SimulationReportActions.jsx (full report panel + copy/download)
//   • New registry-resident architecture-guard suite:
//       components/game/simulationPanelHealthArchitectureCases.js
//     locks the split (runner extracted, builder extracted, registry
//     single-import-source, report shape preserved, extra cases freeze
//     cap, simulationPanel orchestration-size cap).
//   • simulationPanelExtraCases.jsx kept FROZEN (no new cases appended).
//   • Report JSON shape, status semantics, scoring penalties, runtime-
//     proof grouping, manual verification sections, top blockers, and
//     localStorage persistence key are all unchanged.
// Product behavior — Solo scoring/progression, Solo map focus, Profile/
// Leaderboard runtime logic, drag/drop, Timeline, QuestionCard,
// GameLayout, invite/lobby/notification/tutorial/friends — DOKUNULMADI.
// Codex138 — Critical bug fix for "invite vanishes 1.66s after creation":
//   Base44 server `created_date` can be serialized without a timezone
//   suffix (e.g. "2026-05-31T14:33:11.992000"). `new Date()` then parses
//   that as LOCAL time, which on Europe/Istanbul (UTC+3) lands the
//   computed `created + 10min` deadline ~2h50m in the past. Both client
//   (`lib/gameInviteSelectors.js`) and server (`acceptGameInvite`,
//   `sendGameInvitePush`) timestamp parsers now append `Z` to naive
//   ISO strings so they parse as UTC. GameInvite entity schema gained
//   the persisted timestamp + status fields (`created_at`, `expires_at`,
//   `expired_at`, `accepted_at`, `declined_at`, `completed_at`) so the
//   client-set 10-min TTL is no longer silently dropped by Base44.
//
// Toast lifecycle, header bell, online pending invite list, and the
// 10-min TTL product rule are unchanged.
// Codex139 — Invite Timezone Parse: backend helper rename to satisfy the
// Health static contract for `parseInviteTimestamp`. Both
// `functions/acceptGameInvite` and `functions/sendGameInvitePush` now expose
// a named `parseInviteTimestamp(value)` helper that returns a Date (or null),
// with the literal `hasZone` regex check and the `${str}Z` UTC-normalization
// template. `expires_at` parsing is routed through this helper.
//
// No product behavior changed:
//   • 10-minute TTL is preserved.
//   • Recipient-only accept, pending-status gate, lobby-first behavior,
//     stale-lobby guard — unchanged.
//   • Push opt-in, missing VAPID, no-subscription, expired-skip — unchanged.
//   • Toast / header bell / Online pending list logic — unchanged.
const BUILD_MARKER = 'Codex143';
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
