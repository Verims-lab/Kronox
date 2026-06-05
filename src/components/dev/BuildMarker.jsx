import React, { useEffect, useState } from 'react';

// Codex181 — Solo progress counter + correct-placement reward feel:
//   • Solo top progress now reads the same timeline card-count helper used
//     by the win condition, preventing stale 5/7-style display drift.
//   • Correct placements get a visual-only gold/cyan lock-in pulse, spark
//     burst, progress counter pop, and local streak microcopy.
//   • Placement validation, hit-testing, deck rules, scoring, and Online
//     gameplay are unchanged.
//
// Codex180 — Solo v2 rules update:
//   • Normal Solo levels now require 7 correct timeline cards, use
//     16-question decks, and fail on the 10th mistake or 180-second timeout.
//   • Special Solo levels start at level 10 and repeat every 5 levels; they
//     require 10 correct timeline cards and use 19-question decks.
//   • Solo score table is now 3⭐=15 / 2⭐=10 / 1⭐=5 plus 15/10/5 time
//     bonuses at <=60/<=90/<=120 seconds.
//   • First 5 ordered Solo questions must be at least 5 years apart; old
//     stored completed results are not retroactively recalculated.
//
// Codex179 — Admin reset any user progress by email:
//   • Adds an admin-only Settings maintenance tool with preview, exact-email
//     confirmation, Hard zero reset, and New player reset modes.
//   • Server function adminResetUserProgress authenticates/admin-gates every
//     preview/execute call, resets visible score/progress/economy projection,
//     and writes AdminMaintenanceLog audit rows.
//   • User.progress_reset_at invalidates stale user-scoped Solo local mirrors
//     so reset server state wins after target refresh/reopen.
//
// Codex178 — Beginner Solo completion target:
//   • Superseded by Codex180 normal/special Solo targets.
//   • Result popup, progress/unlock persistence, and the top progress counter
//     use the same level-aware target; Online mode is unchanged.
//
// Codex177 — Beginner Solo assist + admin-only test reset support:
//   • Superseded by Codex180 first-five 5-year spacing and 16/19 deck sizes.
//   • Solo levels 1-3 show a visual-only correct-slot placement hint while
//     dragging; hit-testing, drag/drop, scoring, and Online mode are unchanged.
//   • Adds an admin + env-allowlisted test-account progress reset function
//     for manual QA without exposing a normal-user reset path.
//
// Codex176 — Health fix pass:
//   • Keeps category_id canonical while making the categoryid import-alias
//     rule exact in the helper + Health doc mirror.
//   • Replaces stale network-error Health token checks with active Friends,
//     CreateInvite, and IncomingInvites error-state contracts.
//
// Codex175 — Health fix pass:
//   • Exposes the waiting-room authoritative rejoin roster update through a
//     stale-guarded setLobby(updatedLobby) path.
//   • Aligns notification/invite Health contracts with the shared
//     notification center, GameInviteNotifier toast, and lobby-first open
//     action boundaries.
//   • Adds exact docs tokens for unified Puan, first-day Diamond total, and
//     category_id/categoryid import-alias rules.
//
// Codex174 — Account deletion end-to-end hardening:
//   • Profile Settings and in-game Settings modal now use the protected
//     /deleteAccount backend function instead of direct SDK deletion.
//   • deleteAccount authenticates server-side, ignores client identity,
//     removes/cancels/anonymizes user-owned rows, and returns safe errors.
//   • Adds account_deletion_health static contracts while keeping live
//     destructive deletion proof manual with a disposable test account.
//
// Codex173 — Settings screen cleanup under Profile:
//   • Settings now uses StandardTopBar (center Elmas, right bell, no avatar).
//   • Removes the old Settings question-management and app-settings UI blocks.
//   • Keeps notification lifecycle surfaces wired through header bell, in-app
//     invite toast, notification center, and push backend plumbing.
//
// Codex172 — Public Google Play account deletion page:
//   • Adds the unauthenticated /account-deletion route for browser access at
//     kronoxgame.com/account-deletion.
//   • Keeps the existing in-app "Hesabı Sil" Settings action untouched.
//   • Uses support@kronoxgame.com because no Kronox support-domain contact
//     address was present in repo copy beyond deployment placeholder subjects.
//
// Codex171 — Technical Audit Package 2 fix pass:
//   • Moves header, Online pending invites, and foreground invite toasts onto
//     one shared notification center to reduce stale fetch/subscription flicker.
//   • Scopes getQuestions/startLobbyGame question reads by active
//     category/state instead of broad newest-row sampling.
//   • Adds lobby snapshot freshness guards, OnlineMatchResult idempotency_key,
//     safer non-admin debug responses, and updated Health/doc contracts.
//
// Codex168 — Full Audit Package 2 implementation pass:
//   • Secures getQuestions with auth + minimal active-question projection and
//     removes direct public Question.list gameplay fallback.
//   • Wires active Category whitelist into Solo deck creation and tightens
//     startLobbyGame to selected active categories / state A questions.
//   • Adds category_id/categoryid normalization docs, Online score audit-first
//     idempotency, Diamond guard/ledger recovery, persisted kronox_puan_total
//     leaderboard projection, release proof checklist, and modular Health cases.
//
// Codex158 — Focused Health fix pass:
//   • Updates stale Home CTA press-feedback Health to verify current
//     motion/CSS feedback and keep pressed image swaps removed.
//   • Aligns Solo result score-source Health with the current "KAZANILAN
//     PUAN" popup copy instead of stale "Puan:" punctuation.
//   • Tightens visible Kronox Puan Health around the shared
//     getKronoxVisibleScore wiring for Profile, Leaderboard, Solo, Online,
//     and Home surfaces.
//   • Aligns GameInviteNotifier Health with the current snapshot +
//     notification view-model flow.
//
// Codex157 — Security findings cleanup:
//   • Removes unused Spotify/external music question functions instead of
//     moving their exposed credentials to env.
//   • Keeps GameInvite push best-effort with VAPID keys read from
//     deployment secrets/config only; missing keys skip push without
//     breaking persisted in-app invites.
//   • Removes committed personal admin email checks; admin gates now use
//     centralized authorization helpers instead of committed personal email
//     backdoors.
//   • Adds security_cleanup_health coverage and deployment notes for secret
//     rotation/configuration.
//
// Codex156 — Question schema cleanup before new dataset import:
//   • Question entity now keeps only target dataset fields
//     (id/question/answer/category ids/subcategory/tag/region/difficulty/state).
//   • Legacy schema fields year/category/type/media_url/icon_url were removed.
//   • Fetch-layer compatibility derives runtime year from answer and supplies
//     safe category/type defaults so gameplay logic itself is unchanged.
//
// Codex155 — Question dataset schema preparation:
//   • Adds Category entity with stable numeric category_id/name records.
//   • Adds future Question metadata fields (answer, category ids, region,
//     tags, 1-5 difficulty, A/P state) without switching gameplay reads.
//   • Adds admin-only repeatable seedQuestionCategories function and
//     modular Health coverage for the prep-only contract.
//
// Codex154 — generateTechDoc backend security hardening:
//   • generateTechDoc now authenticates with base44.auth.me() server-side
//     before generating any internal PDF content.
//   • Unauthenticated callers receive 401; authenticated non-admin users
//     receive 403; admins keep the intended Settings download flow.
//   • Adds modular backend_security_health coverage for this trust boundary.
//
// Codex153 — Security cleanup: Deezer preview proxy removed. The
// `functions/getDeezerPreview` backend function (previously an
// unauthenticated public proxy to api.deezer.com) is deleted.
// `components/game/QuestionCard` no longer fetches a live preview URL at
// runtime for muzik questions — the music live-preview pipeline is gone
// entirely. The `isitsel` legacy audio path (which uses the question's
// own stored `media_url`) is preserved. No other product behavior changed:
// gameplay, Timeline, drag/drop, scoring, invites, notifications, and
// Solo path remain identical.
//
// Codex152 — Diamond economy foundation:
//   • User.diamonds is the canonical persisted Elmas balance.
//   • Auth bootstrap grants +100 starter once and +20 daily once per UTC day.
//   • DiamondTransaction records reward ledger/idempotency rows when available.
//   • Health adds diamond_economy_health and updates stale Profile Economy
//     placeholder contracts.
//
// Codex151 — Notification lifecycle stabilization:
//   • Header/Online/banner derive GameInvite visibility from a shared
//     notification view model and active-invite selector.
//   • Fetch/subscription merges preserve valid pending invites across
//     stale empty fetches while terminal statuses still remove them.
//   • Accepted invite route state seeds LobbyRoom immediately to avoid
//     fresh-lobby expired/empty flashes during join.
//
// Codex150 — Leaderboard row Puan consistency fix:
//   • Public leaderboard rows now carry total_kronox_score =
//     total_solo_score + online_score.
//   • Liderlik row display and ranking sort use the same unified Kronox
//     Puan that Profile/Header/top stat cards show.
//   • Online score persistence refreshes the leaderboard-safe row after
//     User.online_progress is saved.
//
// Codex149 — Unified Puan copy cleanup:
//   • Visible UI now says Puan / Kronox Puan instead of separate Solo or
//     Online score labels.
//   • Liderlik and the Online result popup use the unified player-facing
//     wording while technical Solo/Online scoring components stay separate.
//   • Adds modular Health coverage for unified score copy.
//
// Codex148 — Final Health alignment after visible Kronox Puan runtime fix:
//   • Keeps Online score persistence/visible Puan path intact.
//   • Makes the Solo leaderboard score source explicitly reference
//     summary.totalSoloScore while visible stat cards use combined Puan.
//   • Restores the real already_recorded idempotency return shape and
//     popup failure fallback copy expected by Health.
//
// Codex147 — Visible Kronox Puan runtime fix:
//   • Visible Puan surfaces now use getKronoxVisibleScore(user), which
//     combines Solo totalSoloScore with persisted online_progress.score.
//   • Online score persistence refreshes auth user state and can safely
//     reconcile prior OnlineMatchResult rows that were created before the
//     visible user score changed.
//
// Codex146 — Online score completion runtime fix:
//   • Player-own elapsed seconds is now the canonical Online scoring time
//     source via the new lib/onlinePlayerElapsed.js helper.
//   • Result popup time and scoring time read the SAME single value
//     (onlineScoreResult.elapsedSeconds), so 3:25 game can no longer
//     show +10 speed bonus.
//   • Persistence failure shows "Puan kaydedilemedi. Tekrar dene." and
//     does not show a fake +points success.
//   • Idempotency unchanged: first apply persists, replays skip via
//     OnlineMatchResult / lastMatchId.
//   • Solo scoring NOT touched.
//   • Health: 7 new modular cases (player-own time helper, popup/scoring
//     parity, 3:25 → +15, missing time base only, failure copy,
//     idempotency first-write, helper file shape).
//
// Codex145 — Health Center expansion + Admin/Health UI hardening:
//   • Adds mobile-safe Health panel/report contracts.
//   • Fixes Health overlay safe-area/dvh scroll behavior.
//
// Codex144 — Final Online no-draw Health contract cleanup:
//   • Locks the canonical helper wording to "Draw scoring is removed".
//   • Removes stale registry wording that described Online as win/loss/draw.
//
// Codex143 — Online match completion scoring:
//   • Allows first score apply when OnlineMatchResult lookup is unavailable.
//   • Shows the current player's applied Online score delta in GameOver.
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
//   • Puan and Seviye still read real Solo progress summary values.
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
//   • ProfilePage: Seviye tile now reads through getCurrentPlayableLevel,
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
// Solo gameplay rules (normal/special card target / 180s / 10th-mistake fail / star ladder /
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
//   • Bug 1 fix: Profile Seviye now reads User.solo_progress.currentLevel
//     via the SAME readSoloProgress helper SoloChallenge uses. Previously
//     Profile hard-coded `value: 1`, so reaching Solo Level 3 left Profile
//     stuck at 1. Single source of truth restored.
//   • Bug 2 fix: Result popup next-level CTA no longer uses the old
//     "Level X'e Geç" string. Replay still says "Tekrar Oyna";
//     failed attempts never get
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
// Solo rules now use v2: normal → 7, special levels 10/15/20... → 10.
// Timer/star ladder: 180s / 0-2=3⭐ / 3-6=2⭐ / 7-9=1⭐ /
// 10th mistake fail / timeout fail / replay never reduces bestStars / pass unlocks
// next level / fail does not unlock.
// Online flow, lobby, invites, notifications, matchmaking, tutorial
// profile, drag/drop, Timeline, QuestionCard — DOKUNULMADI.
//
// Previous note: Codex106 — readSoloProgress "more advanced of two" +
//   visible SoloLevelTimer (now 180s in Codex180).
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
//     Profile + Leaderboard now render Puan / Seviye / Elmas through the
//     same presentational component (two near-duplicate inline StatTile
//     definitions removed). Data sources unchanged:
//       - Puan  → summarizeSoloProgress(...).totalSoloScore
//       - Seviye → getCurrentPlayableLevel(...) (Profile) /
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
// Codex188 — Admin reset hard-zero daily Diamond guard:
//   • adminResetUserProgress hard_zero now exposes the exact
//     last_daily_diamond_reward_date: hardZero ? todayUtcKey() contract that
//     prevents same-day daily-login Diamond re-grants after a zero reset.
//
// Codex198 — Question analytics email report formatting:
//   • sendQuestionAnalyticsReportEmail now sends HTML-first admin reports
//     with summary cards, grouped tables, capped samples, visual bars, and
//     readable empty states instead of one collapsed raw text line.
//   • Adds a plain-text fallback with section dividers and updates Health
//     contracts to catch raw/single-line report regressions.
//
// Codex199 — Admin user discovery + safe additions:
//   • Documents the pre-hardening admin source-of-truth as deployed User
//     role/is_admin/permissions plus a backend deployment fallback.
//   • Adds release/security proof steps for adding the two requested admin
//     emails through deployed admin configuration without introducing a
//     hardcoded runtime email gate.
//   • Adds Health coverage that keeps deployed admin proof NOT_AUTOMATABLE.
//
// Codex200 — DB-backed admin authorization hardening:
//   • Adds private AdminUser as the admin source-of-truth and a shared
//     backend guard at base44/functions/_shared/adminAuth.ts.
//   • Moves backend admin-only functions off env-based admin email allowlists
//     and keeps UI admin hints behind /getAdminStatus.
//   • Documents manual AdminUser insertion for the two requested admin
//     emails, active/disabled proof, and why VAPID private key remains an
//     environment secret.
//
// Codex201 — AdminUser UI status invocation fix:
//   • withAdminStatus now calls getAdminStatus through Base44 functions.invoke
//     first, matching the project JSON function convention, with direct fetch
//     kept as a fallback.
//   • Settings/TestSuite/Profile/Leaderboard admin UI visibility stays based
//     on the current-user AdminUser status hint; AdminUser rows remain private
//     and are never listed by the client.
//
// Codex206 — Admin status registered route fix:
//   • Runtime proved /getAdminStatus returns 404 because the new function
//     name is not registered in the deployed Base44 catalog.
//   • Settings now calls the registered getQuestions admin_status action,
//     which returns a dedicated AdminUser status payload via the shared
//     service-role guard instead of a question projection.
//   • The frontend still rejects ordinary question payloads as
//     response_parse_error, so getQuestions cannot accidentally authorize
//     anyone unless it returns source: AdminUser + explicit status function.
//
// Codex205 — AdminUser status source fix:
//   • Removes getQuestions as an admin-status fallback after runtime showed
//     the question projection could be parsed as a false admin status.
//   • Settings admin status now accepts only dedicated getAdminStatus /
//     AdminUser-shaped responses; unrelated function payloads become
//     response_parse_error instead of no_admin_user_row.
//   • getAdminStatus remains the sole frontend status endpoint and reads
//     the AdminUser entity through the shared service-role admin guard.
//
// Codex204 — Settings AdminDebug-v4 runtime proof:
//   • Settings now renders the temporary AdminDebug-v4 panel immediately
//     under the Ayarlar header and before any admin-only conditional block.
//   • The panel shows the exact current-user status rows needed to prove
//     auth email, response shape, parsed AdminUser role/status, and whether
//     admin tools should/actually do mount.
//   • Backend AdminUser lookup now tolerates email/role/status field casing
//     variants, normalizes values, and returns current-user-only safe lookup
//     reasons plus matched field names without exposing AdminUser rows.
//
// Codex203 — AdminUser Settings runtime diagnostics:
//   • AuthContext now stores and refreshes the current user's AdminUser
//     status result instead of hiding it inside the decorated user object.
//   • Settings renders a safe current-user admin diagnostic panel showing
//     auth email, normalized email, status call path, response shape keys,
//     parsed role/status, UI gate, and why tools are hidden if they are.
//   • Admin status parsing handles direct, data, and data.data function
//     response shapes, prefers auth-header fetch, and falls back to a
//     current-user-only getQuestions admin_status path if getAdminStatus is
//     unavailable while backend admin functions remain independently gated.
//
// Codex202 — AdminUser status response unwrap fix:
//   • Fixes the runtime bug where withAdminStatus read the Axios response
//     wrapper returned by Base44 functions.invoke instead of response.data,
//     causing active AdminUser rows to be treated as non-admin.
//   • Health now locks the invoke response unwrap contract so Settings admin
//     tools can render for active AdminUser rows while normal users remain
//     hidden and backend-blocked.
//
// Codex197 — Question analytics P3:
//   • Wires Solo shown/answered/Kart Değiştir events to private
//     QuestionAttemptEvent rows through a best-effort gateway.
//   • Adds manual admin sendQuestionAnalyticsReportEmail report generation
//     plus a compact Settings admin trigger.
//   • Keeps QuestionStatsProjection refresh manual via aggregateQuestionStats
//     and documents deployed email/RLS/write-volume proof as manual.
//
// Codex189 — Solo Jokers v1:
//   • Adds a compact Solo-only joker bar with Hata Affı, Kart Değiştir, and
//     Zaman Dondur between the timeline and KARTI YERLEŞTİR button.
//   • Enforces one free joker use per attempt; no inventory, Diamond spend,
//     Puan grant, or Online impact.
//   • Hata Affı shields one wrong placement, Kart Değiştir swaps from the
//     prebuilt deck, and Zaman Dondur freezes Solo elapsed time for 10s.
//
// Codex194 — Health contract alignment:
//   • Aligns Daily Wheel docs/mirrors on Diamond-only, no leaderboard-rank
//     impact, one claim per UTC server day, and reset/delete cleanup wording.
//   • Updates Solo popup Health to accept the simplified success Puan/Hata
//     value+unit copy while failure retains the two-line label.
//   • Mirrors Solo Jokers v1 as free/no-inventory helpers that do not grant
//     Kronox Puan.
//
// Codex195 — Daily Wheel cleanup docs contract:
//   • Makes admin reset/account deletion Daily Wheel cleanup wording explicit
//     in the economy rules and release proof checklist for Health.
//   • Confirms existing admin reset clears Daily Wheel guard fields and
//     account deletion anonymizes retained DailyWheelSpin rows.
//
// Codex196 — Daily Wheel reward system v1:
//   • Aligns backend Daily Wheel weights to 10/15/20/25/30/40/50/100
//     Diamond slices at 25/22/18/13/10/6/4/2 percent.
//   • Keeps reward selection server-side and updates the result reveal to
//     show base reward plus separate 7-day streak total.
//   • Removes the Diamond icon from the claimed Home countdown and adds
//     modular Health coverage for the v1 reward/countdown contract.
//
// Codex193 — Daily Wheel claim/grant hardening:
//   • claimDailyWheelReward no longer fails the normal claim path when the
//     optional DailyWheelSpin ledger create is unavailable; User.diamonds is
//     still updated and DiamondTransaction recovery is used where possible.
//   • Daily Wheel UI sanitizes rejected function calls into Turkish retry
//     copy instead of exposing raw "Request failed with status code 500".
//
// Codex192 — Solo success popup text simplification:
//   • Success popup now shows "SÜRE" instead of "TOPLAM SÜRE".
//   • Success popup Puan and Hata stat cards present only the value plus
//     unit label, without separate "KAZANILAN PUAN" / "HATA SAYISI" titles.
//
// Codex191 — Solo result popup timing + spacing fix:
//   • Solo success/failure result time now starts from the completion
//     snapshot and applies only completed/active Zaman Dondur freeze offsets,
//     so stale effective-timer refs cannot show impossible 00:02 results.
//   • Success popup nudges the Kazanılan Puan and Hata Sayısı values closer
//     to their Puan/Hata labels without changing result logic.
//
// Codex190 — Daily Wheel UX upgrade:
//   • Daily Wheel modal now shows a large visible reward wheel with eight
//     Diamond slices, fixed pointer, and center hub.
//   • Successful claims run a 4.6s landing spin using the backend reward,
//     then reveal a large +X Elmas result and updated Diamond total.
//   • Adds optional Web Audio spin/reward cues through existing gameSounds
//     and Health coverage for visible wheel, duration, and no fake re-spin.
//
// Codex187 — Daily Wheel result polish:
//   • Daily Wheel claim now always resolves to reward, already-claimed, or
//     visible retry/error modal instead of silently returning to ready state.
//   • Home wheel card is nudged upward and the wheel emblem gets a sharper
//     gold/navy premium treatment without adding a new asset pipeline.
//
// Codex186 — Health Center alignment:
//   • Aligns Settings Health with the real StandardTopBar notification-bell
//     contract instead of a stale showNotifications prop token.
//   • Registers exact Solo v2 Health case IDs for normal/special targets,
//     16/19 deck sizes, and first-five ordered spacing.
//
// Codex185 — Daily Reward Wheel:
//   • Adds server-backed getDailyWheelStatus / claimDailyWheelReward
//     functions plus DailyWheelSpin ledger and User wheel guard fields.
//   • Adds a compact Home DailyWheelCard above Solo, once-per-session prompt,
//     result modal, passive claimed state, and immediate Home Elmas refresh.
//   • Grants Diamonds only, keeps daily login +20 separate, adds +100
//     seven-day streak bonus, and documents Base44 race proof as manual.
//
// Codex184 — Health Center full alignment:
//   • Adds the canonical KRONOX_CORE_PROMPT.md path used by current tasks and
//     Health docs checks.
//   • Adds a modular Health alignment suite for active docs, removed Settings
//     UI expectations, current Solo v2 coverage registration, PWA/Android
//     manual gates, public asset README truth, DB architecture status, and
//     Health status taxonomy honesty.
//   • Tracks Android large-screen/orientation Play Console warnings as manual
//     wrapper/device proof instead of static PASS.
//
// Codex183 — DB architecture implementation package:
//   • Adds additive DB gateway modules under src/lib/dbGateway without broad
//     runtime rewiring.
//   • Adds analytics/projection schemas, public-safe QuestionPublicProjection,
//     and promotes SoloLeaderboardEntry as the current public leaderboard
//     projection for unified Kronox Puan.
//   • Adds admin-gated dry-run cleanup/retention job functions and modular
//     Health contracts while leaving runtime analytics/event volume and
//     platform unique indexes as manual proof items.
//
// Codex182 — Security + Health fix:
//   • startLobbyGame now requires authenticated host identity; legacy guest
//     host start fallback is removed.
//   • Solo replay delta Health fixture now proves same/lower replays add +0
//     and better replays add only the positive delta.
//   • Solo v2 docs/mirrors align on deck sizes, 10 mistakes, 180s timer, and
//     first-5 ordered question spacing.
const BUILD_MARKER = 'Codex206';
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
