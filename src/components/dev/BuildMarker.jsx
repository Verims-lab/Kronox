import React, { useEffect, useState } from 'react';

// Codex397 — Per-player question exposure architecture:
//   • Adds PlayerQuestionExposure and PlayerQuestionDailyExposure projections
//     for Solo per-player anti-repeat selection and anonymous coverage reports.
//   • Records exposure only for actual shown active/replacement/tutorial cards,
//     never candidate pools or unused deck buffers.
//   • Keeps guest exposure token-verified, merges recent exposure on account
//     linking, and keeps Question Analytics at exactly 9 top-level sections.

// Codex393 — Guest onboarding resume/category P0 fix:
//   • GuestProfile onboarding step resolution is monotonic so stale
//     tutorial_in_progress cannot send profile/category users back to
//     Eğitime Devam.
//   • Superseded by Codex395: guest category onboarding must use current
//     Category metadata, not stale hardcoded fallback rows.
//   • Category load failures show a retryable UI instead of a silent empty list.

// Codex392 — Onboarding profile category-transition unblock:
//   • Separates profile-save and category-save loading state from the shared
//     tutorial/onboarding busy flag so Kategorilere Geç cannot inherit a
//     background auth/tutorial spinner.
//   • Guided tutorial completion refreshes auth/GuestProfile state in the
//     background after moving to profile setup.
//   • Profile save failures render a retryable in-form error near the button.

// Codex391 — Demo/tutorial runtime crash fix:
//   • Moves the current timeline player derivation before guided tutorial
//     correct-slot calculation so production builds do not hit a minified
//     temporal-dead-zone error ("Cannot access 'se' before initialization").
//   • Tutorial hand guidance, joker demos, timer popup, and profile/category
//     routing behavior are preserved.

// Codex390 — Guided tutorial/profile transition fix:
//   • First two guided tutorial cards point the hand hint at the computed
//     correct timeline slot without moving the real card.
//   • Cards 3/4/5 teach Zaman Dondur, Kart Değiştir, and Kronokalkan through
//     tutorial-only demos, popup pauses, and repeating tap hints.
//   • Onboarding profile save avoids broad GuestProfile scans and cannot leave
//     Kategorilere Geç in an indefinite spinner state.

// Codex389 — Scoring/economy/Daily Quest Health alignment:
//   • Documents the unified visible Puan/Kronox Puan contract in the Health
//     scoring mirror while preserving internal Solo/Online components.
//   • Aligns Diamond first-day 100 + 20 = 120 wording without changing economy
//     grants.
//   • Fixes Daily Quest runtime entity detection and docs/mirrors for
//     Diamond-only, no-leaderboard, Daily Wheel-separated reward lanes.

// Codex388 — VAPID secret-management classification:
//   • sendGameInvitePush now carries an explicit static Health marker that
//     server-env-sourced VAPID_PRIVATE_KEY findings are MANUAL_REQUIRED
//     deployment secret-manager verification, not CRITICAL source exposure by
//     themselves.
//   • CRITICAL remains reserved for hardcoded, logged, returned, client-exposed,
//     or insecure-default VAPID private-key material.

// Codex378 — Onboarding Phase 2:
//   • Replaces the old standalone tutorial entry with `/onboarding` guided
//     first Solo level flow.
//   • Adds GuestProfile onboarding state updates for tutorial, profile setup,
//     category setup, and onboarding completion.
//   • Tutorial joker guidance uses a tutorial-only demo and does not spend
//     real UserJokerInventory.

// Codex300 — Keep Question.description for SEO + align schema/Health/docs:
//   • Question.description is now an approved, optional SEO/content-metadata
//     field on the Question entity and is NOT removed.
//   • The question_schema_preparation_health case
//     question_entity_contains_only_target_dataset_fields now includes
//     description in the approved field list, so it PASSes while still
//     failing on any other unapproved/unknown field or missing target field.
//   • Question data model doc records description as approved SEO metadata
//     that does not affect gameplay, question selection, difficulty, scoring,
//     timeline year logic, or leaderboard.
//   • No gameplay/economy/online/admin/system behavior changed.
//
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
//   • Support contact is now supplied by deployment config rather than a
//     committed address literal.
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
// Codex224 — Solo joker spacing and locked-state fix:
//   • Tightens Solo joker spacing and reduces circle/icon footprint by about
//     30% while keeping the circle, icon, count badge, and label structure.
//   • Replaces persistent used-joker highlight with a short recently-used
//     pulse, then locks all three jokers at count 0 for the rest of the level.
//   • Preserves one-use attempt rule, joker effects, gameplay background,
//     drag/drop, timer, scoring, Online, and Daily Wheel.
//
// Codex225 — Solo gameplay parchment card surfaces:
//   • Adds a shared old-paper/aged-parchment surface style for Solo gameplay
//     question cards and year-only placed timeline cards.
//   • Keeps card dimensions, rounded shapes, placement, drag/drop, timer,
//     scoring, joker behavior, and Online/media card behavior unchanged.
//   • Tunes only paper-surface text contrast so the main question and year
//     remain readable on mobile.
//
// Codex226 — Timeline card aspect-ratio update:
//   • TimelineCard content surfaces now use the same 2:3 width-to-height
//     ratio as the main question card.
//   • Keeps the main question card, timeline frame, fonts, year placement,
//     drag/drop, timer, scoring, jokers, and gameplay logic unchanged.
//
// Codex227 — VAPID private-key exposure hardening:
//   • Removes the backend VITE_KRONOX_VAPID_PUBLIC_KEY fallback from
//     sendGameInvitePush getVapidConfig so server push config uses only
//     non-VITE VAPID env names.
//   • Adds Health/static guard coverage against backend VITE_* VAPID reads
//     and documents that VITE_ values must never be backend private-key
//     fallbacks.
//
// Codex228 — Matte parchment question-card refinement:
//   • Softens the shared gameplay old-paper surface from glossy gold/orange
//     toward muted beige aged parchment.
//   • Reduces highlight saturation, inset shine, and prompt-bar warmth while
//     preserving paper identity and text contrast.
//   • Keeps card layout, borders, sizing, spacing, drag/drop, timeline,
//     scoring, timer, jokers, and gameplay behavior unchanged.
//
// Codex229 — Health final fail + Last Run summary fix:
//   • SoloJokerBar now exposes a truthful grid grid-cols-3 transparent
//     layout wrapper while keeping rectangular joker containers removed.
//   • Health Last Run summary now displays the report FAIL count from
//     counts/cases/suiteSummary instead of score.value.
//   • Keeps circle/icon/badge/label joker contract, one-use behavior,
//     gameplay logic, scoring, timer, and manual Health proof status intact.
//
// Codex230 — Premium aged parchment card surface:
//   • Refines the shared gameplay paper background toward a museum/archive
//     parchment palette with a softer center, muted midtones, darker aged
//     edges, and subtle low-opacity fiber/grain overlays.
//   • Keeps the Solo bottom prompt on the same paper surface instead of a
//     separate old-paper visual band.
//   • Preserves card dimensions, gold borders, timeline rectangle, drag/drop,
//     scoring, timer, jokers, and gameplay behavior.
//
// Codex231 — First-open question loading race fix:
//   • useOfflineQuestions now waits for auth/session settle and retries the
//     protected getQuestions call once before declaring no-cache failure on a
//     cold start.
//   • Retry re-runs the same guarded fetch/cache initialization path instead
//     of requiring the user to leave and re-enter the game route.
//   • Keeps stale/fresh cache usable until a network replacement succeeds and
//     preserves Solo deck, timer, scoring, joker, and drag/drop rules.
//
// Codex232 — Solo active-category whitelist health fix:
//   • Normalizes active category whitelist values and question category fields
//     before comparison, covering numeric/string IDs and Category-shaped rows
//     without accepting a missing whitelist.
//   • Reserves enough spaced years for the first five active Solo cards plus
//     visible seed/preplaced timeline cards so valid whitelists build cleanly.
//   • Keeps missing whitelist clean-fail behavior, Solo deck rules, no
//     mid-attempt fetches, and first-open question loading behavior intact.
//
// Codex233 — getQuestions projection fairness:
//   • Replaces the ordered newest/category projection slice with deterministic
//     pool-proportional category/subcategory sampling before the gameplay cap.
//   • Broadens the protected minimal runtime projection while preserving
//     active category/status guards and admin-only aggregate diagnostics.
//   • Keeps Solo deck rules, scoring, UI, analytics writes, and no mid-attempt
//     fetch behavior unchanged.
//
// Codex234 — Solo first-five spacing search robustness:
//   • Replaces the final greedy first-five ordering pass with a deterministic
//     alternative search before clean-failing.
//   • Restores normal 16-card deck builds for valid large unique-year pools
//     while preserving first-five 5-year spacing and seed/preplaced context.
//   • Leaves getQuestions projection fairness, gameplay UI, scoring, timer,
//     jokers, and mid-attempt fetch behavior unchanged.
//
// Codex235 — Solo exposure cooldown and runtime rotation:
//   • Adds timestamp/count-aware local question history and feeds those stats
//     into the Solo deck builder before an attempt starts.
//   • Downweights high/recent shown cards and prefers never/low-shown cards
//     as a soft signal, preserving pool-proportional balance and hard rules.
//   • Keeps analytics writes best-effort, no backend fetch mid-attempt, and
//     existing Solo scoring/timer/joker/gameplay behavior unchanged.
//
// Codex236 — Solo proportional diversity balancing:
//   • Adds pool-proportional category, subcategory, theme, and year-band
//     scoring inside the Solo deck builder without equal-count balancing.
//   • Exposes Health/admin-only diversity diagnostics comparing eligible-pool
//     shares with selected-deck distributions.
//   • Preserves P1 exposure cooldown, first-five spacing, deck sizes, no
//     backend fetch mid-attempt, Kart Değiştir reserve, and gameplay rules.
//
// Codex237 — Question exposure fairness Health/report guardrails:
//   • Adds P3 Health coverage for getQuestions projection metadata,
//     projection diagnostics, repeated Solo deck diversity, exposure
//     cooldown/rotation, and category/subcategory/year-band concentration.
//   • Clarifies the admin analytics report so active pool, Solo-eligible
//     pool, and runtime projection diagnostics are not conflated.
//   • Keeps fairness pool-proportional, manual runtime proof manual, and
//     gameplay/deck behavior unchanged.
//
// Codex238 — Question exposure Health fail fix:
//   • Makes getQuestions admin diagnostic seeds explicit as
//     admin-provided:<seed> while normal projection remains UTC-day rotated.
//   • Preserves recent-history rank through Solo deck scoring so the cooldown
//     prefers least-recent/lower-exposure cards when the whole pool is warm.
//   • Aligns the P3 Health guardrail with soft cooldown reality by checking
//     selected-vs-candidate ratios instead of impossible zero-recent decks.
//
// Codex239 — Health Last Run summary freshness fix:
//   • Health run metadata now parses the actual BUILD_MARKER constant instead
//     of the first historical Codex note in this file.
//   • Last Run restore chooses the newest usable completed report and ignores
//     malformed storage without destructive clearing.
//   • Last Run card labels FAIL count explicitly and derives build marker from
//     report build metadata with a clear unavailable fallback.
//
// Codex240 — Global numeric typography split:
//   • Adds shared kronox-number and kronox-timeline-number tokens.
//   • Timeline-visible gameplay years now use Bebas Neue; general numeric UI
//     values use Inter SemiBold for clearer 7/1 readability.
//   • Adds Health/static coverage for gameplay, result, economy, leaderboard,
//     Daily Wheel, and Health numeric surfaces while leaving visual proof
//     manual.
//
// Codex241 — SubCategory entity preparation:
//   • Adds the SubCategory DB entity with numeric id, main_category_1,
//     main_category_2, name, A/P status, and description fields.
//   • Documents main_category_1/main_category_2 as Category.category_id
//     references while leaving Question.sub_category unchanged.
//   • Adds static Health coverage for the schema-only migration boundary.
//
// Codex242 — Health UI contract cleanup:
//   • Restores exact Solo success/failure result title contracts while keeping
//     current SÜRE/PUAN/HATA/HIZ BONUSU detail grids and CTAs.
//   • Makes Online GameOver show the visible "Galibiyet: +N" score breakdown
//     from the persisted Online result payload.
//   • Keeps Daily Wheel reward, streak bonus, total reward, and Last Run FAIL
//     count strings statically visible without changing backend reward logic.
//
// Codex243 — Settings SubCategory preferences:
//   • Adds UserSubCategoryPreference as a per-user Settings-only preference
//     entity for active SubCategory interests.
//   • Adds the Settings "İlgi Alanlarım" section with active-only loading,
//     selected chips, minimum 5 validation, and no maximum selection limit.
//   • Adds static Health coverage while keeping question selection,
//     onboarding, and gameplay algorithms unchanged.
//
// Codex244 — User SubCategory preference Health coverage:
//   • Expands Health guardrails for SubCategory readiness,
//     UserSubCategoryPreference persistence, min/no-max selection rules,
//     active/passive filtering, and Settings mobile static contracts.
//   • Keeps user-scoped RLS and mobile visual proof manual/NOT_AUTOMATABLE.
//   • Locks the no-gameplay/no-onboarding connection boundary for this phase.
//
// Codex245 — Settings main Category preferences:
//   • Replaces the Settings İlgi Alanlarım source from SubCategory rows to
//     active main Category rows and persists UserCategoryPreference rows.
//   • Changes the minimum selection rule from 5 SubCategories to 3 Categories
//     with no maximum selection cap.
//   • Leaves SubCategory/UserSubCategoryPreference data untouched and keeps
//     question selection plus onboarding unconnected.
//
// Codex246 — First-login Category preference onboarding:
//   • Adds a rollout-aware first-login popup for new users to choose at least
//     3 active main Category interests, with no maximum selection cap.
//   • Saves UserCategoryPreference rows before marking the user profile
//     onboarding flag complete so the popup does not repeat.
//   • Keeps existing users without preferences unblocked and leaves question
//     selection algorithms untouched.
//
// Codex247 — Category preference popup below-3 trigger:
//   • Replaces the new-user rollout gate with a count-based check for any
//     authenticated user with fewer than 3 active valid Category preferences.
//   • Completion flags remain advisory only; active UserCategoryPreference rows
//     that reference active Category rows are the popup source of truth.
//   • Keeps Settings editable, no maximum selection cap, and no question
//     selection connection.
//
// Codex248 — Category preference Health coverage cleanup:
//   • Updates Health guardrails to assert Category preferences, the below-3
//     popup count matrix, active/passive Category filtering, and no max cap.
//   • Keeps SubCategory as future metadata only and removes stale minimum-5
//     SubCategory preference assumptions from active Settings coverage.
//   • Leaves question selection, Settings behavior, and onboarding behavior
//     unchanged.
//
// Codex249 — Solo Category preference weighting:
//   • Solo deck building now uses current-user active valid Category
//     preferences as a soft 70% selected / 30% global-pool target.
//   • Normal decks target 11/5 and special decks target 13/6, with global
//     fallback when selected categories cannot supply enough valid cards.
//   • First-five spacing, exposure cooldown, diversity scoring, prebuilt
//     reserve behavior, and Online question selection stay intact.
//
// Codex250 — Question Analytics category breakdown:
//   • Admin report now shows per-category question pool counts, selected-user
//     preference counts, shown counts, and category-internal over/low/never
//     shown question samples.
//
// Codex251 — Category preference active selection sanitization:
//   • Settings and onboarding intersect selected Category IDs with active
//     Category rows before display, count, and save.
//   • Passive/removed previous selections no longer count toward minimum 3 or
//     get resaved as active preferences.
//
// Codex252 — Question analytics reset/report robustness:
//   • Earlier function-based analytics reset attempt is superseded by the
//     Codex259 manual DB reset path.
//   • Report generation skips stale/deleted question IDs with diagnostics,
//     handles empty analytics state, and keeps large sections bounded.
//
// Codex253 — Category preference shared save contract:
//   • Settings and onboarding both call saveUserCategoryPreferences(user,
//     selectedIds, activeCategories).
//   • The shared helper filters raw selectedIds through activeIdSet.has(id),
//     enforces minimum 3, and excludes passive/removed categories from saves.
//
// Codex254 — Question Analytics report completion:
//   • The actual sent report body now includes category pool, preference,
//     exposure, within-category, and fairness-signal sections.
//   • Report sections render through a safe wrapper, stale/deleted question
//     IDs stay diagnostic-only.
//
// Codex255 — Question Analytics admin runtime invocation:
//   • The Settings admin report tool calls sendQuestionAnalyticsReportEmail
//     through Base44 functions.invoke first, with JSON fetch fallback and
//     backend error codes surfaced in the UI.
//   • Function-based reset handling is superseded by Codex259 manual DB
//     maintenance guidance.
//
// Codex256 — Question Analytics function registration:
//   • Adds function.jsonc manifest for sendQuestionAnalyticsReportEmail so
//     Base44 can resolve the exact functions.invoke name used by Settings.
//   • The admin tool now maps 404/missing function responses to a clear
//     function-name/deployment mismatch message.
//
// Codex257 — Question Analytics callable root functions:
//   • Adds deployed-root functions/sendQuestionAnalyticsReportEmail.js so
//     functions.invoke can resolve the actual callable report name used by
//     Settings.
//   • Verifies the sent report body contains the category analytics sections.
//
// Codex258 — Solo global difficulty preference:
//   • Keeps the 70% selected-category Solo lane unchanged.
//   • The 30% global lane now prefers difficulty 1 from the full eligible pool
//     where possible and safely falls back when difficulty-1 global candidates
//     are insufficient.
//
// Codex259 — Manual question analytics reset + report output:
//   • Removes the broken interactive reset function path from Settings and
//     documents manual DB reset for QuestionAttemptEvent plus any projection
//     rows that exist at reset time.
//   • Keeps the actual sent report body on the category pool, preference,
//     exposure, within-category, and fairness-signal sections with stale-row
//     and empty-state guards.
//
// Codex260 — Static category pool report:
//   • Kategori Bazında Soru Havuzu now comes directly from current Question
//     rows, independent of empty analytics event/projection tables.
//   • The table includes active question count, difficulty 1-5/unknown
//     distribution, and oldest/newest year per category.
//
// Codex261 — Health coverage alignment:
//   • Updates Question Analytics Health to inspect the actual Base44 sent
//     report body for category sections and static Question-table pool data.
//   • Keeps manual DB reset as the supported analytics cleanup path and
//     refreshes guardrails for Category preferences plus Solo 70/30 difficulty.
//
// Codex262 — Strict VAPID push config:
//   • Removes empty/default VAPID fallbacks from sendGameInvitePush and
//     requires backend public key, private key, and subject validation.
//   • Missing/invalid VAPID config now returns explicit push diagnostics while
//     leaving persisted in-app invites functional.
//
// Codex263 — Registered question pool report:
//   • Adds Kategori Bazında Kayıtlı Soru Havuzu to the actual sent Question
//     Analytics email body.
//   • The new static section groups active Question rows by Category and
//     difficulty with count plus oldest/newest year, independent of analytics.
//
// Codex264 — Question Analytics admin guard + text fallback:
//   • sendQuestionAnalyticsReportEmail gained AdminUser-backed authorization;
//     later Codex276/Codex278 kept that contract inline for Base44 deployability.
//   • The rich HTML report remains primary and keeps a bounded plain-text
//     fallback generated with textLines.join('\n').
//
// Codex265 — Registered category/difficulty question counts:
//   • The actual Question Analytics email labels the static Question-table
//     registered pool as Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı.
//   • The section counts active asked and never-asked questions by category
//     and difficulty, with the same bounded HTML and text fallback rows.
//
// Codex266 — VAPID private-key scanner classification:
//   • Health now proves VAPID_PRIVATE_KEY is backend-env-only, not VITE_,
//     hardcoded, logged, or returned from sendGameInvitePush.
//   • Docs classify env-var-name-only scanner findings as deployment-secret
//     management notes unless real key material appears in source/logs.
//
// Codex267 — Question Analytics report ordering + completion marker:
//   • Static Question DB pool sections now render near the top before long
//     event-detail tables, with a Rapor Bölümleri checklist.
//   • The email/text report ends with Rapor Tamamlandı so clipping or
//     truncation is diagnosable if the marker is missing.
//
// Codex268 — Email-safe registered question distribution chart:
//   • Adds Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı near the top of
//     the actual Question Analytics email body.
//   • The chart is inline HTML/CSS stacked bars plus numeric Zorluk 1-5 and
//     Bilinmiyor counts from active Question rows; no JavaScript charting.
//
// Codex269 — Static question pool chart visibility:
//   • Moves Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı directly after
//     Key Insights in the actual sent email body, before every long event table.
//   • Keeps the existing event-based category/showing distribution separate
//     from the static Question-table category/difficulty chart.
//
// Codex270 — Branch audit report chart dedupe:
//   • Removes a merge-created duplicate Sistemdeki Soru Havuzu chart section
//     from the actual Question Analytics email HTML/text/report metadata.
//   • Health now checks that the static chart appears exactly once before long
//     event-based sections.
//
// Codex271 — Question analytics deploy entrypoint restore:
//   • Restores root functions/sendQuestionAnalyticsReportEmail.js as a deploy
//     compatibility wrapper to the canonical base44 report implementation.
//   • Keeps the Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı chart in
//     the actual invoked report path when deployments resolve root functions.
//
// Codex272 — Flat deploy report mirror:
//   • Replaces the root report wrapper with a complete flat deploy mirror plus
//     local shared AdminUser guard so root-only function packaging cannot serve
//     the old event-detail-first report.
//   • Adds visible Kaynak: Question tablosu and Toplam aktif kayıtlı soru
//     diagnostics inside the static category/difficulty section.
//
// Codex273 — Deploy branch report path fix:
//   • Reapplies the root flat report mirror after the main migration deleted
//     root functions, preventing stale deployed flat handlers from surviving.
//   • Restores the nested Base44 report import to ../_shared/adminAuth.ts while
//     keeping the root mirror on ./_shared/adminAuth.js.
//
// Codex274 — Runtime report template marker:
//   • Adds visible Rapor Şablonu: static-pool-v2 marker near the top of the
//     actual Question Analytics email body.
//   • SendEmail now uses explicit emailHtml/emailText variables and returns
//     admin-safe body diagnostics proving the static pool section was present.
//
// Codex275 — Report recipient diagnostics:
//   • Question Analytics reports now default the recipient to the authenticated
//     requesting admin and reject mismatched recipient overrides.
//   • Function responses include requestedBy, recipientEmail, dispatch status,
//     template marker, and safe SendEmail diagnostics.
//
// Codex276 — Report deployability marker:
//   • The callable Question Analytics function now inlines the DB-backed
//     AdminUser guard for the Base44 function runtime and keeps the report
//     recipient/dispatch diagnostics.
//   • Health deployability checks inspect the current Base44 function path
//     instead of the deleted root mirror.
//
// Codex277 — Health fail cleanup:
//   • Removes stale broken-import literals from the callable report function
//     and keeps the exact owner/admin inline role guard contract.
//   • Aligns backend invocation Health with real Daily Wheel and lobby
//     functions.
//
// Codex278 — Base44 admin guard Health alignment:
//   • General admin authorization Health now accepts the verified inline
//     AdminUser guard for sendQuestionAnalyticsReportEmail only, because the
//     shared import path broke Base44 callable deployment.
//   • Shared AdminUser guard imports remain preferred for functions where they
//     deploy cleanly; hardcoded admin allowlists remain forbidden.
//
// Codex279 — Joker inventory Phase 1 foundation:
//   • Adds UserJokerInventory and JokerTransaction plus a backend starter
//     grant function that gives 3 Kronokalkan, 3 Kart Değiştir, and 3 Zaman
//     Dondur once per authenticated user.
//   • Profile shows owned balances under Joker Çantası; Market and Solo
//     joker spending remain later phases.
//
// Codex280 — Solo joker inventory spend:
//   • Solo joker buttons read UserJokerInventory balances and display owned
//     counts instead of attempt-local free counts.
//   • Adds spendUserJoker for Solo solo_use ledger rows, one-joker-per-card
//     guard, no refunds on fail/exit, and keeps Market future-only.
//
// Codex281 — Solo joker inventory Health cleanup:
//   • Makes the persistent balance pass-through, non-negative minimum
//     contract, and no-refund sentence explicit for Phase 2 Health.
//
// Codex282 — Mobile gameplay pull-to-refresh guard:
//   • Adds a scoped gameplay card-drag lock with passive:false native
//     touchmove prevention, cancellation cleanup, and Health/docs coverage
//     while preserving Timeline scrollLeft auto-scroll and hit-testing.
//
// Codex283 — Mağaza Phase 1:
//   • Adds Home top-left Mağaza entry, /market page, and server-backed
//     Diamond-to-Solo-joker purchases for Zaman Dondur, Kart Değiştir, and
//     Kronokalkan with DiamondTransaction + JokerTransaction ledgers.
//   • Keeps Online and Daily Wheel unaffected; no bundles, subscriptions,
//     cosmetics, random boxes, ads, or external payments.
//
// Codex284 — Mağaza Health hardening:
//   • Expands Market, Diamond, Joker, Solo, Daily Wheel, backend security,
//     deployability, and alignment Health around server-authoritative prices,
//     dual ledgers, idempotency, and cross-mode economy boundaries.
//   • Documents source/sink balance, double-tap/network retry/manual race
//     proof, and partial-failure reconciliation for Market Phase 1.
//
// Codex285 — Health fail cleanup:
//   • Aligns the mobile overflow guard Health rule with scoped gameplay drag
//     locks, keeps the explicit SoloJokerBar persistent-balance pass-through,
//     and mirrors Diamond earn/spend direction wording for Health.
//   • Makes the Solo joker no-refund contract exact in docs/helper mirrors.
//
// Codex286 — Solo joker balance wiring cleanup:
//   • Restores the direct SoloJokerBar balance prop contract
//     balances={soloJokers?.balances || null} in the render path.
//   • Makes Game.jsx visibly pass soloJokers only for Solo level mode so
//     Online never receives joker inventory wiring.
//
// Codex287 — Explicit Solo joker balance prop contract:
//   • Makes Game.jsx pass balances={soloJokers?.balances || null} through
//     GameLayout so Health can statically prove Mağaza purchases flow into
//     the persistent SoloJokerBar inventory display.
//   • Keeps the Solo-only joker gate and Online null wiring intact.
//
// Codex288 — Günlük Ödüller panel and Daily Wheel rebalance:
//   • Updates Daily Wheel rewards to 30/40/50/60/75/100/150/250 with +150
//     seven-day streak bonus, keeping server-side selection and idempotency.
//   • Replaces the standalone Home wheel row with a Günlük Ödüller panel that
//     sets up Daily Wheel plus Daily Quest v1 placement.
//
// Codex289 — Daily Quest Definition Phase 1:
//   • Adds DailyQuestDefinition templates plus admin-only Settings management
//     for listing, creating, status toggling, and idempotent seed definitions.
//   • Keeps admin copy display-only: quest_type + target_value drive future
//     Solo progress, reward_diamonds is Diamond-only, and no Kronox Puan,
//     leaderboard, Daily Wheel, Mağaza, or Solo runtime path is changed.
//
// Codex290 — VAPID push secret hardening:
//   • sendGameInvitePush keeps VAPID_PRIVATE_KEY backend-env-only, removes
//     env-name diagnostics from client responses, and returns safe
//     pushSent:false / pushSkipped:true config-missing status.
//   • Push provider failures are summarized without returning raw provider
//     messages; in-app GameInvite flow remains best-effort when push skips.
//
// Codex291 — Daily Quest / push Health contract cleanup:
//   • Mirrors reserved Daily Quest User fields and exact non-runtime wording:
//     no Diamond/Puan grant yet, no Kronox Puan, and no leaderboard impact.
//   • createDailyQuestDefinition exposes the exact inline requireAdmin(base44)
//     guard contract; push summaries include safe missingConfig diagnostics.
//
// Codex292 — Daily Quest Runtime v1:
//   • Adds UserDailyQuestProgress plus getDailyQuestStatus,
//     recordDailyQuestProgress, and claimDailyQuestReward backend functions.
//   • Wires Solo-only Daily Quest progress events and the Günlük Ödüller /
//     Günlük Görev claim UI while keeping rewards Diamonds-only, no
//     Kronox Puan, no leaderboard impact, and Daily Wheel separate.
//
// Codex293 — Günlük Ödüller text contract:
//   • MainMenu passes an accessible label that explicitly includes Günlük Çark
//     and Günlük Görev while keeping the panel above Solo/Online CTAs.
//
// Codex294 — Daily Quest runtime seed/empty-state fix:
//   • getDailyQuestStatus and recordDailyQuestProgress seed fixed default
//     DailyQuestDefinition templates only when no definition rows exist.
//   • Günlük Görev now shows a real no-active-definition empty state
//     instead of a permanent hazırlanan fallback; ensure still grants no
//     Diamonds and claimDailyQuestReward remains the only reward path.
//
// Codex295 — Daily Quest runtime progress ensure fix:
//   • getDailyQuestStatus and recordDailyQuestProgress now prefer the
//     authenticated user-owned UserDailyQuestProgress entity for runtime rows.
//   • ensureTodayDailyQuests preserves newly created rows when the immediate
//     Base44 refresh is stale, preventing a false "Görevler yenilenemedi" state.
//
// Codex296 — Daily Quest Runtime v1 one-quest simplification:
//   • getDailyQuestStatus and recordDailyQuestProgress now select 1 active
//     DailyQuestDefinition per UTC day, ordered by sort_order/created_at/quest_key.
//   • Günlük Ödüller renders one compact Günlük Görev while retaining older
//     same-day extra progress rows without displaying a crowded list.
//
// Codex297 — Daily rewards / economy alignment audit:
//   • Confirms Daily Quest Runtime v1 stays singular at 1 selected UTC-day
//     quest, claim remains the only Diamond reward path, and no Kronox Puan or
//     leaderboard writes are introduced.
//   • Normalizes game-invite push skip summaries with skippedReasons,
//     failedReasons, missingConfig, missing_vapid_config, and subscriptionCount
//     while keeping VAPID_PRIVATE_KEY backend-env-only.
//
// Codex298 — Daily Quest claim reward fix:
//   • Completed Günlük Görev claims now call claimDailyQuestReward with an id
//     or questKey/questDate fallback so a missing progress id cannot silently
//     skip the Diamond reward.
//   • Claim responses return diamondBalanceAfter and questStatus: claimed,
//     reconcile visible User.diamonds for idempotent retries, and surface
//     claim errors in the Günlük Ödüller panel.
//
// Codex304 — iOS/mobile compatibility polish:
//   • Adds scoped PullToRefresh for Friends, Liderlik, and Admin Ekranı
//     maintenance lists without touching gameplay drag/drop surfaces.
//   • Adds independent BottomNav tab stacks with scroll/subroute restore and
//     replaces targeted admin native selects with Kronox bottom-sheet selectors.
//
// Codex305 — BottomNav/Admin Ekranı Health cleanup:
//   • Restores the three-tab BottomNav contract: Ana Sayfa, Liderlik, Profil.
//     Online remains reachable from Home via Online Kapışma, not as a bottom tab.
//   • Mounts Günlük Görev Yönetimi under active-admin-only Admin Ekranı with the
//     exact DailyQuestDefinitionManager static contract while preserving list refresh.
//
// Codex306 — iOS AppIcon no-alpha release fix:
//   • Adds an opaque RGB iOS AppIcon asset catalog generated from the existing
//     Kronox icon flattened onto the approved navy background.
//   • Adds npm run check:ios-icons to catch App Store Connect 90717
//     alpha-channel failures before native archive upload.
//
// Codex307 — simulateOnlineGame admin auth hardening:
//   • Moves simulateOnlineGame and runTestSuite off profile-role checks and
//     onto the shared AdminUser active owner/admin guard before service-role writes.
//   • Adds Health/docs coverage for the en_core_news_sm scanner regression.
//
// Codex308 — final WixOneApp AppIcon source hardening:
//   • Moves manifest/head/splash app-icon references off the old transparent
//     remote PNG and onto local opaque RGB PNG sources under /assets/icons.
//   • Expands npm run check:ios-icons to validate manifest icon sources,
//     forbidden transparent icon references, and final archive/IPA proof limits.
//
// Codex309 — Base44 App logo no-alpha upload source:
//   • Adds public/assets/icons/base44-app-logo-1024-no-alpha.png for the
//     Base44 Generate App Store files App logo upload field.
//   • Documents that Base44 must regenerate files after replacing the upload
//     logo, because old IPA/archive files can preserve App Store 90717.
//
// Codex310 — Full architecture audit alignment:
//   • Refreshes DB architecture docs/Health mirrors from the old Codex183
//     baseline to current runtime contracts without changing product behavior.
//   • Expands platform/manual unique-key and hot-path index guardrails for
//     Daily Quest, Daily Wheel, Joker/Market, social, question analytics, and
//     admin authorization data.
//   • Aligns mobile navigation Health wording with the current three-tab
//     BottomNav contract: Ana Sayfa, Liderlik, Profil.
//
// Codex311 — iOS AppIcon 90717 release gate alignment:
//   • Makes the release checklist and Health mirror explicitly name the final
//     `WixOneApp.app` icon asset as the App Store 90717 validation target.
//   • Updates npm run check:ios-icons output to document Base44 App logo
//     regeneration and the manual final archive/IPA proof boundary.
//
// Codex312 — public App Store privacy policy:
//   • Adds public /privacy with Turkish Gizlilik Politikası content for Apple
//     App Store review, including data categories, deletion/support, push,
//     cache, social, gameplay, analytics, and economy disclosures.
//   • Keeps /privacy outside auth, onboarding, and BottomNav while adding a
//     Settings link plus docs/Health App Store privacy alignment.
//
// Codex303 — Joker Çantası user-specific self-heal:
//   • ensureUserJokerInventory now repairs missing/partial/mixed-owner
//     UserJokerInventory rows for the authenticated user without overwriting
//     valid balances or refunding spent jokers.
//   • Profile Joker Çantası adds retry-safe loading/error handling, and the
//     shared helper can still display readable own balances if ensure has a
//     transient backend failure.
//
// Codex302 — False offline/no-cache question bootstrap fix:
//   • First Solo start and refreshed question sets now attempt authenticated
//     online getQuestions before any no-cache fallback; empty cache alone is
//     not treated as offline.
//   • Question cache is versioned so stale local question banks are invalidated,
//     retry clears transient question-load errors, and Daily Quest
//     start_solo_attempt still records only after the Solo deck actually starts.
//
// Codex301 — Mağaza purchase runtime entity binding:
//   • purchaseJokerWithDiamonds now explicitly binds entities.UserJokerInventory,
//     entities.DiamondTransaction, and entities.JokerTransaction with service-role
//     preference plus authenticated current-user fallback for owner-scoped writes.
//   • Market purchase failures use safe retry copy, while success still spends
//     Diamonds, grants the selected joker, writes both market_purchase ledgers,
//     and returns refreshed Diamond/Joker balances.
//
// Codex299 — Profile Admin Ekranı split + Daily Quest claim deployability:
//   • Adds a Profile-only Admin Ekranı action for active AdminUser owner/admin
//     users and keeps normal users on the two standard Profile actions.
//   • Moves Settings maintenance tools into the guarded /admin screen while
//     preserving AdminUser-backed backend guards for the actual admin actions.
//   • Daily Quest runtime functions explicitly bind entities.UserDailyQuestProgress
//     so getDailyQuestStatus, recordDailyQuestProgress, and claimDailyQuestReward
//     are deployable against the progress entity.
//   • Günlük Görev claim errors use "Ödül alınamadı. Tekrar dene." instead of
//     raw HTTP status text, and Home copy says "Günlük Görevleri Yap, Elmasları Kazan!".
//
// Codex201 — AdminUser UI status invocation fix:
//   • withAdminStatus now calls getAdminStatus through Base44 functions.invoke
//     first, matching the project JSON function convention, with direct fetch
//     kept as a fallback.
//   • Settings/TestSuite/Profile/Leaderboard admin UI visibility stays based
//     on the current-user AdminUser status hint; AdminUser rows remain private
//     and are never listed by the client.
//
// Codex223 — Admin Health contract fix:
//   • getAdminStatus now imports and uses the shared AdminUser
//     getAdminAuthorization helper instead of duplicating local lookup logic.
//   • Health doc mirror now includes the lowercase disabled-admin handling
//     contract required by the AdminUser source-of-truth case.
//   • Keeps getAdminStatus callable for authenticated non-admin users,
//     returning current-user-only isAdmin:false without exposing AdminUser rows.
//
// Codex222 — Solo joker area simplification:
//   • Removes the large outer joker panel and individual rectangular joker
//     card surfaces from Solo gameplay.
//   • Keeps the three horizontal circular joker visuals with centered icons,
//     top-right remaining-count badges, and labels below.
//   • Preserves joker behavior, one-use attempt rule, gameplay background,
//     drag/drop, timer, scoring, Online, and Daily Wheel.
//
// Codex221 — Health Center alignment after recent changes:
//   • Refreshes the Health doc mirror for DB-backed AdminUser authorization,
//     /getAdminStatus, no env admin allowlist, and no unsafe bootstrap
//     fallback.
//   • Keeps AdminDebug-v4 absent from production Settings while Health checks
//     the real backend status gate and current Solo/Daily Wheel contracts.
//   • Leaves gameplay, economy, analytics data shape, drag/drop, scoring, and
//     backend admin guards unchanged.
//
// Codex220 — Solo joker naming update:
//   • Renames the mistake-shield joker from Hata Affı to Kronokalkan across
//     Solo gameplay labels, active/protection messages, docs, and Health
//     contracts.
//   • Keeps Kart Değiştir and Zaman Dondur names, joker type keys,
//     functionality, counts, styling, scoring, timer, drag/drop, and Timeline
//     behavior unchanged.
//
// Codex219 — Solo result stat card alignment:
//   • Shared SoloStatCard now normalizes the label row height so SÜRE/PUAN
//     and HATA/HIZ BONUSU align consistently across success and failure.
//   • Puan/Hata values are nudged closer to their unit labels without
//     changing scoring, timer, result calculation, buttons, or popup flow.
//
// Codex218 — Solo joker visual redesign:
//   • Solo joker controls now render as vertical circular badge items with
//     larger centered icons, per-item remaining-use badges, and labels below.
//   • Keeps the one-free-joker-per-attempt rule, disabled/used state wiring,
//     drag/drop, Timeline, scoring, timer, Online, and other gameplay logic
//     unchanged.
//
// Codex217 — Solo question card text tracking:
//   • Solo-readable gameplay question text now uses a small positive
//     letter-spacing bump for readability while preserving the existing
//     card size, bottom prompt, icon removal, and text wrapping safeguards.
//   • Drag/drop, Timeline, Solo rules, scoring, jokers, timer, Online, and
//     unrelated UI remain unchanged.
//
// Codex216 — Solo result popup stat cleanup:
//   • Solo success/failure result stat cards now use the shorter SÜRE,
//     PUAN, and HATA labels.
//   • Failure timeout state no longer shows a non-record "Maksimum" time
//     footer, while success still reserves time footer copy for record badges.
//   • Tightens Puan/Hata value-to-unit spacing without changing scoring,
//     timer, stars, buttons, or Solo flow.
//
// Codex215 — Solo timeline duplicate year cleanup:
//   • Solo placed timeline cards no longer show the duplicate year label
//     above the card; the larger centered year inside the card remains.
//   • Keeps timeline spacing, card size, drag/drop, placement logic, scoring,
//     timers, jokers, Online, and other screens unchanged.
//
// Codex214 — Solo card readability + timeline cleanup:
//   • Solo active question text is slightly larger while staying inside the
//     question card with the bottom timing prompt preserved.
//   • Solo placed timeline cards hide event/title text and show only a
//     larger centered year inside the existing card bounds.
//   • Timeline placement logic, drag/drop, scoring, timers, jokers, Online,
//     and popups are unchanged.
//
// Codex213 — Solo question card readability:
//   • Solo gameplay question cards now use a cleaner text-first layout with
//     larger Inter SemiBold question copy and no category icon below the
//     question text.
//   • Keeps the bottom "Bu olay ne zaman gerçekleşti?" prompt, drag/drop,
//     timeline hit-testing, scoring, timers, jokers, and question selection
//     unchanged.
//   • Online question cards retain their prior category-icon treatment.
//
// Codex212 — Daily Wheel spin UX upgrade:
//   • Enlarges the modal wheel with brighter reward slices, a stronger fixed
//     top pointer, premium rim lighting, and a raised hub while preserving
//     the Kronox navy/gold reward moment.
//   • Keeps the backend-selected Daily Wheel reward as the source of truth,
//     then lands the wheel on result.rewardAmount with a 4.6s physical spin,
//     reduced-motion shortcut, locked controls, and clear result reveal.
//   • Leaves Daily Wheel Diamond-only economy, one-spin-per-server-day
//     idempotency, reward weights, Kronox Puan, and leaderboard behavior
//     unchanged.
//
// Codex211 — Admin debug removal + Health contract alignment:
//   • Removes the temporary AdminDebug-v4 panel and visible current-user
//     admin-status diagnostic rows from production Settings.
//   • Keeps Settings admin tools gated by backend AdminUser status and keeps
//     normal users hidden while backend functions enforce requireAdmin.
//   • Aligns admin/security Health contracts on entities.AdminUser,
//     /getAdminStatus, no unsafe bootstrap fallback, and no debug UI required.
//
// Codex210 — Admin status root callable hard fix:
//   • Adds the deployed root callable implementation at
//     functions/getAdminStatus.js, matching the legacy functions/*.js
//     deployment/search convention while keeping the Base44 mirror under
//     base44/functions/getAdminStatus/entry.ts.
//   • Both implementations read AdminUser through service role, normalize
//     email/role/status, and return the exact isAdmin/role/status/source/
//     statusFunction/debug response shape without exposing AdminUser rows.
//   • Health now imports the root callable source too, so repo search must
//     find getAdminStatus in backend, frontend, and contract references.
//
// Codex209 — Admin status stale function-catalog fix:
//   • Removes the client-side functionsVersion pin passed into the Base44 SDK
//     so functions.invoke("getAdminStatus") can resolve the current deployed
//     callable catalog instead of a stale one that returns 404.
//   • Clears the persisted base44_functions_version browser value during app
//     param bootstrap to retire older URLs/builds that pinned function calls.
//   • Keeps the callable getAdminStatus function under
//     base44/functions/getAdminStatus/entry.ts with function.jsonc and keeps
//     Settings invoking exactly getAdminStatus; no getQuestions fallback exists.
//
// Codex208 — Admin status callable registration fix:
//   • Adds base44/functions/getAdminStatus/function.jsonc so Base44 has an
//     explicit callable name/entry pair for getAdminStatus.
//   • Makes base44/config.jsonc explicitly point at ./functions.
//   • Settings now invokes exactly getAdminStatus through functions.invoke;
//     no manual /getAdminStatus fetch path or getQuestions fallback remains.
//
// Codex207 — Admin status dedicated endpoint fix:
//   • Removes the Codex206 getQuestions admin-status workaround after runtime
//     proved it still returned the normal question projection shape.
//   • withAdminStatus again calls only /getAdminStatus and getAdminStatus; a
//     getQuestions-shaped response remains response_parse_error.
//   • Clears stale stored Base44 functions_version when no fresh URL/build
//     value is present so the SDK is not pinned to an old function catalog
//     that predates getAdminStatus.
//
// Codex206 — Admin status registered route attempt:
//   • Runtime showed /getAdminStatus returned 404 in that deployed build.
//   • Tried routing status through getQuestions admin_status, but runtime proof
//     showed the deployed getQuestions function still returned question rows.
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
//     copy instead of exposing raw HTTP 500 status text.
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
//   • Originally added a compact Home DailyWheelCard above Solo; Codex288
//     moves it into the Günlük Ödüller panel while keeping prompt/result,
//     passive claimed state, and immediate Home Elmas refresh.
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
//
// Codex313 — No-preference Solo question fallback:
//   • getQuestions serves a minimal gameplay projection while keeping
//     admin/full-bank diagnostics AdminUser-gated.
//   • No login, no saved preferences, or empty/insufficient preferences use
//     all active categories; saved preferences remain optional 70/30 weighting.
//   • Category preference save validation stays separate from gameplay start.
//
// Codex314 — Question Analytics report cleanup:
//   • sendQuestionAnalyticsReportEmail now sends a compact executive-summary
//     email and attaches the cleaned detailed report as a PDF.
//   • Removed report sections are validated out of generated email/PDF output.
//   • Health/docs require real admin email delivery and PDF receipt as manual proof.
//
// Codex315 — Reset auth + VAPID secret hardening:
//   • resetTestAccountProgress no longer uses KRONOX_TEST_RESET_EMAILS /
//     TEST_RESET_EMAILS for runtime authorization.
//   • The legacy reset path uses AdminUser owner/admin active status plus exact
//     target-email confirmation.
//   • VAPID docs/Health distinguish server-only private key handling from
//     public-by-design key and subject metadata handling.
//
// Codex316 — Question Analytics PDF attachment + product intelligence report:
//   • sendQuestionAnalyticsReportEmail uses product-intel-pdf-v2, creates a real
//     PDF payload, and passes it to SendEmail with base64 attachment fields.
//   • The email remains summary-only while the PDF keeps decision sections for
//     Solo algorithm, question quality, jokers, play-time, retention, and missing instrumentation.
//   • Health/docs require live Gmail PDF receipt as manual release proof.
//
// Codex317 — Profile Joker Çantası performance path:
//   • getUserJokerBalances reads complete UserJokerInventory rows through a
//     fast current-balance path before invoking starter/self-heal.
//   • Profile Joker Çantası keeps local loading/error/retry state while
//     Market purchase and Solo spend update the shared user-scoped cache.
//   • Health/docs lock JokerTransaction as ledger-only for render-time
//     balances and keep live Profile load timing as manual proof.
//
// Codex318 — Question Analytics full email-body report:
//   • sendQuestionAnalyticsReportEmail no longer generates or sends a PDF
//     attachment and no longer mentions an attachment in the email body.
//   • The email body now contains the full useful product-intelligence report
//     for Solo algorithm, content quality, jokers, play-time, retention, actions,
//     and missing measurement without restoring removed static inventory sections.
//   • Health/docs now treat real inbox receipt and body readability as the
//     manual runtime proof.
//
// Codex319 — Question Analytics exact nine-section email:
//   • sendQuestionAnalyticsReportEmail now renders exactly the requested 9
//     sections in order inside the email body and sends no PDF attachment.
//   • Executive Summary uses metric cards; category, question, joker, and
//     play-rhythm sections are table-based with structured no-data rows.
//   • Health/docs now enforce nine-section-email-v1 diagnostics and manual
//     live inbox proof.
//
// Codex320 — Solo preference + nine-section report Health contract fix:
//   • Game.jsx explicitly calls getValidActiveSelectedCategoryIds(preferences,
//     activeCategories) in the Solo-only preference path while empty/no-auth
//     preferences continue to use all active categories.
//   • sendQuestionAnalyticsReportEmail adds hidden nine-section markers,
//     title-case metric labels, Runtime Projection / Solo-eligible wording,
//     and the generic top-shown concentration guardrail.
//
// Codex321 — Solo question distribution audit:
//   • getQuestions no longer treats the original 1-6 seed IDs as the canonical
//     runtime category boundary; active Category rows drive the projection.
//   • Health/docs record the remaining explicit risks: local-only repeat
//     avoidance, no global exposure balancing, and no hard low-correct cooldown.
//
// Codex322 — Question analytics reset scope audit:
//   • Admin reset copy moved reset guidance into Admin Ekranı and kept
//     Joker/economy ledgers plus current content/user data outside reset scope.
//   • sendQuestionAnalyticsReportEmail now uses the exact getQuestions
//     diagnostics wording for Runtime Projection while preserving 9 sections.
//
// Codex323 — Question analytics projection table audit:
//   • Admin reset copy clarifies QuestionAttemptEvent is the active report
//     source and the 9-section report computes history from raw events.
//   • QuestionStatsProjection and CategoryStatsProjection are documented as
//     optional manual aggregateQuestionStats outputs that may be empty.
//   • Health/docs now require clearing projection rows only if populated and
//     keep content/user/economy tables outside question analytics reset.
//
// Codex324 — Daily Quest definition duplicate hardening:
//   • Admin list is read-only and no longer seeds default definitions on
//     refresh; explicit seed/create paths skip or reject existing quest_key.
//   • Backend/runtime groups duplicate DailyQuestDefinition rows by quest_key
//     and selects one canonical active definition.
//   • Admin UI shows one logical row per quest_key with duplicate warnings and
//     manual cleanup guidance; no automatic delete is enabled.
//
// Codex325 — Full audit + performance/DB/platform alignment:
//   • Health Center long runs batch report rebuilds and yield around the
//     long-task budget instead of rebuilding the full report after every case.
//   • Release/DB/security/mobile docs and Health mirrors now lock the
//     performance, object-authorization, idempotency, and platform manual gates.
//   • Solo global exposure balancing remains an explicit future architecture
//     change; no gameplay/scoring/economy rules changed in this pass.
//
// Codex326 — Runtime refactor and admin performance cleanup:
//   • DailyQuestDefinitionManager now owns data/form/backend actions while the
//     repeated definition list/card rendering lives in DailyQuestDefinitionList.
//   • Health Center stores case results through a mutable local accumulator and
//     publishes batched state snapshots instead of copying a growing object
//     after every case.
//   • Health contracts were kept aligned with the split; no product rules,
//     gameplay, scoring, economy, or Base44 function deploy paths changed.
//
// Codex327 — Health Center result-state batching fix:
//   • Health run state now tracks unpublished result count and avoids
//     publishing full growing result snapshots after every single slow case.
//   • Final Health report JSON shape, localStorage persistence, export/copy
//     behavior, and report batching/yield timing remain unchanged.
//   • Health architecture static checks now guard both report batching and
//     result-state snapshot batching without running Health suites.
//
// Codex328 — Daily Quest admin UI Health alignment:
//   • Daily Quest Definition Health now recognizes the split manager/list UI
//     path and verifies the visible "Tanımlı Görevler" contract in the list.
//   • DailyQuestDefinitionManager still mounts DailyQuestDefinitionList under
//     Profile / Admin Ekranı; duplicate grouping and runtime rules unchanged.
//
// Codex329 — Solo category projection full-pool fix:
//   • getQuestions and category helpers accept live active-status aliases and
//     no longer clamp active category IDs to the original seed set.
//   • Solo diagnostics/Health now prove categories 6,7,8,9,11 can enter rich
//     preference pools, and the question cache was bumped to invalidate stale
//     narrow projections.
//
// Codex330 — Solo global-lane full eligible correction:
//   • The global difficulty-1 candidate pool now uses the full eligible Solo
//     pool, while selected-vs-non-selected 70/30 pressure remains soft.
//   • Health simulation now fails if categories 6,7,8,9,11 are absent from
//     selected-lane, global-lane, or full eligible difficulty-1 diagnostics.
//
// Codex331 — Solo category coverage Health normalization:
//   • The categories 6-11 coverage assertion now normalizes distribution keys
//     like "cat:6" and "category:6" before computing missing-category arrays.
//   • Runtime Solo selection remains unchanged; this removes contradictory
//     Health diagnostics when the product candidate pools already include IDs.
//
// Codex332 — Solo real query diagnostic:
//   • Adds an AdminUser-gated, read-only diagnoseSoloQuestionStartQuery
//     function that snapshots the fresh getQuestions-compatible per-category
//     Question query for the owner account and up to 10 users with active
//     category preferences.
//   • Admin Ekranı now renders a copyable "Solo Soru Motoru Query Diagnostiği"
//     JSON tool that enriches the backend query snapshot with the real frontend
//     buildSoloAttemptDeck dry-run result, including category 6/7/8/9/11
//     presence/removal proof.
//
// Codex333 — Solo query diagnostic direct runner:
//   • Removes the broken production Admin Ekranı diagnostic button so users do
//     not hit a function-not-found path before Base44 deployment.
//   • Adds scripts/diagnoseSoloQuestionStartQuery.mjs as the direct
//     service-role read-only runner for owner + 10 preference users, with Vite
//     SSR loading of the actual frontend buildSoloAttemptDeck implementation.
//
// Codex334 — Solo diagnostic Base44 app config fix:
//   • The direct diagnostic runner now requires the app-specific
//     BASE44_APP_BASE_URL / VITE_BASE44_APP_BASE_URL instead of falling back to
//     the generic base44.app host, and classifies App-not-found as a safe
//     token/app-id/base-url mismatch diagnostic.
//   • Adds backend-function transport support for deployed admin callable
//     diagnostic runs with an admin access token.
//
// Codex335 — Solo diagnostic safe config summary:
//   • The direct diagnostic runner now emits a safe Base44 config summary
//     showing app id/base URL/token presence without printing token values.
//   • The runner mirrors frontend appBaseUrl in createClient and keeps
//     service-role SDK plus backend-function transports explicit.
//
// Codex336 — Solo runtime query copy debug:
//   • Adds owner/admin-gated in-game Solo query debug output assembled from the
//     real getQuestions -> buildSoloAttemptDeck runtime path, with copyable
//     JSON for category 6-11 candidate/deck proof.
//
// Codex337 — Health blocker JSON copy:
//   • Health Center clipboard JSON now exports a compact blocker-only payload;
//     full report remains available through download/raw preview.
//
// Codex338 — Solo per-category runtime projection:
//   • Gameplay question fetches now request the v2 per-category projection,
//     bumps the runtime cache, and exposes category-source/debug proof so
//     category 6+ starvation cannot be hidden by a single global 500-row cap.
//
// Codex339 — Solo end screen stat-card polish:
//   • Removes repeated Puan/Hata mini footer labels from Solo result stat
//     cards and keeps the 2x2 card headings aligned without touching scoring.
//
// Codex340 — getQuestions active-category projection fix:
//   • Adds the getQuestions function manifest, removes stale 1-6 Question
//     category schema caps, and makes gameplay v2 projection diagnostics
//     return with live active Category rows before any final cap.
//
// Codex341 — hardcoded email security cleanup:
//   • Removes committed diagnostic/support email literals, gates Solo query
//     diagnostics through AdminUser/request-env targeting with generic masking,
//     and sources public support contact from VITE_KRONOX_SUPPORT_EMAIL.
//
// Codex343 — getQuestions callable wiring proof:
//   • Bumps backend getQuestionsRuntimeMarker to
//     getQuestions-live-per-category-v7-Codex343, moves the local question
//     cache to v7, and surfaces an explicit backendFunctionWiringBlocker when
//     Base44 serves stale/different deployed getQuestions code.
//
// Codex344 — getQuestions request handler logging:
//   • Adds safe request, payload-shape, and projection-branch logs inside the
//     getQuestions Deno.serve handler without logging bodies, headers, tokens,
//     service config, or personal data.
//
// Codex345 — Inline Base44 admin auth guards:
//   • Removes the deploy-blocking shared adminAuth dependency from Base44
//     functions and keeps AdminUser email/role/status authorization local to
//     each protected function bundle.
//   • Preserves getQuestions request/branch logs and backend runtime marker
//     getQuestions-live-per-category-v7-Codex343.
//
// Codex346 — App Store Apple sign-in option:
//   • Adds visible Base44-managed Apple and Google provider buttons to the
//     unauthenticated login entry while preserving hosted email/other login.
//   • Uses base44.auth.loginWithProvider('apple'|'google') with safe fallback
//     error copy and no native iOS code or committed provider secrets.
//
// Codex347 — Question Analytics category/year table:
//   • Adds a category-based Top 10 answer year/count table inside the existing
//     Kategori Bazında Soru Havuzu section.
//   • Keeps the email-body-only, no-PDF, exactly-nine-section report contract.
//
// Codex348 — Health deployment/auth/report coverage refresh:
//   • Adds static Health checks for Base44 deploy-risk imports, getQuestions
//     runtime markers/diagnostics, blocker-only Health copy JSON, Apple login
//     compliance, and hardcoded email cleanup.
//   • Keeps Health execution non-destructive and leaves gameplay/report
//     business behavior unchanged.
//
// Codex349 — Base44 function compile gate:
//   • Fixes the getQuestions request/response payload redeclaration that
//     blocked Base44 Save & Deploy.
//   • Adds npm run check:base44-functions to catch function syntax,
//     duplicate-declaration, deploy-risk import, email-literal, and
//     getQuestions marker regressions before manual backend deploy.
//
// Codex350 — MainMenu HomeCTA icon import hotfix:
//   • Imports ChevronRight for the HomeCTA chevron so MainMenu no longer
//     crashes with a ReferenceError at runtime.
//   • Leaves Home CTA layout, navigation, BottomNav, and gameplay behavior
//     unchanged.
//
// Codex351 — getQuestions runtime guard/log hardening:
//   • Reads request JSON through req.clone(), catches Base44 client creation
//     failures with marker diagnostics, and guards service-role entity access.
//   • Adds safe category/candidate step logs without exposing question content,
//     user data, tokens, or request bodies.
//
// Codex352 — getQuestions ping branch cleanup:
//   • Keeps Base44 Test Function ping lightweight and marker-only instead of
//     running the full question projection.
//   • Adds selectedBranch diagnostics so logs distinguish real Solo gameplay
//     projection from default public projection.
//
// Codex353 — getQuestions production log cleanup:
//   • Removes temporary request/payload/branch/category/candidate info logs
//     after real payload proof succeeded.
//   • Keeps ping, runtime marker, and projectionDiagnostics in the response.
//
// Codex354 — FriendRequest RLS drift guard:
//   • Syncs local Codex with latest origin/Codex/main state before security
//     review.
//   • Adds a parser-backed Health guard for FriendRequest sender/recipient/admin
//     read/update/delete RLS, including the delete branch.
//
// Codex355 — Health manual proof cleanup and Solo debug gate:
//   • Keeps manual-only Health verification visible but removes it from real
//     blocker counts and Copy Blocker JSON.
//   • Hides Solo Query Debug during normal gameplay unless admin/owner also
//     supplies the explicit soloDebug flag.
//
// Codex356 — Codex355 Health blocker cleanup:
//   • Tightens email literal scanning so npm package specifiers are not
//     reported as personal/admin/support addresses.
//   • Aligns Health static checks with typed AdminUser guards and the current
//     getQuestions Category service-entity path.
//
// Codex357 — Final admin function email-literal hotfix:
//   • Removes email-shaped npm name@version import specifiers from the
//     admin-only document/category functions flagged by Health.
//   • Keeps AdminUser-backed authorization unchanged.
//
// Codex358 — Exact admin email literal offender cleanup:
//   • Removes the remaining runTestSuite quoted fixture email literal.
//   • Adds masked file/line offender details to the admin authorization
//     Health blocker output so future triage is not blind.
//
// Codex359 — getQuestions authentication hardening:
//   • Requires an authenticated user for gameplay question projection while
//     keeping admin/full-bank diagnostics AdminUser-gated.
//   • Keeps v2 per-category projection diagnostics and runtime marker intact.
//
// Codex360 — Joker economy/inventory audit hardening:
//   • Makes Solo joker spend deploy-safe with UserJokerInventory /
//     JokerTransaction entity fallback, Solo-context validation, and safe UI
//     error mapping.
//   • Keeps Market prices server-owned while making starter self-heal
//     best-effort during purchase and adding inventory/ledger reconciliation
//     helper coverage.
//
// Codex361 — FriendRequest RLS and Solo preference fallback Health hotfix:
//   • Adds the FriendRequest create.created_by_id={{user.id}} RLS guard while
//     preserving sender/recipient/admin read-update-delete branches.
//   • Aligns Solo Health/docs with authenticated getQuestions fetches: missing
//     auth is auth-required, while authenticated no-preference users use all
//     active categories without raw Question.list fallback.
//
// Codex362 — Solo active-attempt loading timeout guard:
//   • Resolves active Solo questions from the frozen attempt deck before the
//     refreshed global question projection.
//   • Keeps full-screen question loading/error fallbacks scoped to bootstrap,
//     with safe non-visible breadcrumbs for active attempt diagnostics.
//
// Codex363 — VAPID private-key security triage classification:
//   • Keeps hardcoded/logged/exposed VAPID private key findings as blockers.
//   • Reclassifies env-var-name-only VAPID_PRIVATE_KEY findings as manual
//     deployment secret verification instead of source-code blockers.
//
// Codex364 — Category preference phase docs alignment:
//   • Aligns docs/mirrors on authenticated no-preference Solo fallback,
//     below-3 optional popup, Settings/Profile editability, and Solo-only
//     soft weighting.
//   • Removes guest/raw question-pool wording while preserving getQuestions
//     authentication and the no raw Question.list gameplay fallback contract.
//
// Codex365 — Leaderboard row cleanup:
//   • Removes the row-level "Seviye X" sublabel from Liderlik ranking rows
//     while preserving rank, avatar, badges, row highlight, and Kronox Puan.
//
// Codex366 — Leaderboard/Profile performance P0:
//   • getSoloLeaderboard reads SoloLeaderboardEntry projection first for the
//     main Liderlik table; User.list remains only for optional per-level
//     record fallback until that data has its own projection.
//   • Liderlik no longer waits on own-row publish before first render.
//   • Profile renders from auth.me first; Joker Çantası reads current
//     UserJokerInventory rows before background self-heal.
//
// Codex367 — Leaderboard/Profile performance P1:
//   • getSoloLeaderboard returns a compact SoloLeaderboardEntry snapshot:
//     topRows, currentUserRow/rank, friend owner keys, and rankScope metadata.
//   • Leaderboard consumes the server snapshot directly, without a separate
//     client friend query or broad User rows in the primary path.
//   • Entity docs/static guards record logical unique/index contracts for
//     SoloLeaderboardEntry, UserJokerInventory, JokerTransaction, and
//     FriendRequest while write paths keep query-before-write protection.
//
// Codex368 — Leaderboard projection completeness repair:
//   • getSoloLeaderboard keeps SoloLeaderboardEntry projection-first, but now
//     compares a bounded server-side User.kronox_puan_total repair window so
//     incomplete/stale projection rows cannot falsely rank the current user #1.
//   • Missing/stale high-score projection rows are repaired best-effort without
//     returning broad User rows to the client.
//   • Adds rankScope/rankConfidence and projection/score row diagnostics for
//     manual leaderboard proof.
//
// Codex369 — Leaderboard score-source safety:
//   • Treats User.kronox_puan_total as a projection that can be reconstructed
//     from User.solo_progress + online_progress when the field was zeroed.
//   • Keeps projection-above-User score mismatches as manual recovery signals
//     instead of automatically down-writing possible historical score data.
//
// Codex370 — Leaderboard Health contract closure:
//   • Makes current-user SoloLeaderboardEntry publishing, projection repair
//     rank-scope diagnostics, accepted friend owner_key matching, and
//     PullToRefresh reload wiring explicit for static Health without changing
//     scoring or leaderboard ranking rules.
//
// Codex371 — Guest Solo capped question deck:
//   • Adds explicit guest_gameplay_runtime getQuestions mode so first-time
//     logged-out Solo users get a small mixed active-category deck without
//     reopening public bulk question-bank access or raw Question.list fallback.
//   • Keeps signed-in gameplay on the authenticated per_category_projection_v2
//     path and blocks guest diagnostics/full-bank/admin knobs.
//
// Codex372 — Server-side Solo attempt buffer:
//   • Removes the fixed 1200 authenticated gameplay source-pool cap from
//     getQuestions and returns a bounded server attempt candidate buffer.
//   • Keeps guest Solo on the explicit small guest_gameplay_runtime deck and
//     keeps diagnostics/full-bank paths AdminUser-gated.
//   • Bumps question cache to v8 so stale broad projections are ignored.
//
// Codex373 — First Solo start question readiness:
//   • Applies valid cached bounded question buffers immediately when Solo
//     readiness flips on, while still revalidating through getQuestions.
//   • Retries empty first getQuestions responses before showing no-question
//     failure so question-pool refresh/import timing can recover.
//   • Makes Solo bootstrap retry rebuild the unstarted attempt state without
//     returning to Main Menu and bumps question cache to v9.
//
// Codex374 — Solo question architecture alignment:
//   • Enforces the signed-in 70/30 preference lanes as selected categories
//     difficulty 1/2 plus all-active global fallback difficulty 1.
//   • Keeps guest Solo capped and difficulty-1-first, bumps question cache to
//     v10, and extends diagnostics/docs/Health around bounded responses.
//
// Codex375 — Solo deck fallback and raw-bank proof:
//   • Selected-category shortage and global difficulty-1 shortage now fall
//     through to the broader active global pool before clean failure.
//   • Adds static proof that Direct Question.list fallback remains removed and
//     callers never receive the raw question bank.
//
// Codex376 — Online shared deck start fix:
//   • startLobbyGame persists a bounded selected-category difficulty-1/2
//     online_question_deck before the lobby enters gameplay.
//   • Game reads Online current/next questions from the shared Lobby deck
//     instead of Solo getQuestions buffers, preventing partial starts.
//
// Codex377 — GuestProfile identity foundation:
//   • Adds app-owned GuestProfile entity and createGuestProfile backend
//     function; Kronox does not use Firebase or Base44 anonymous auth for
//     guest identity.
//   • Raw guest token is stored only on the local client/device; DB stores
//     guest_token_hash and verifies guest_id + token proof server-side.
//   • Default public guest username uses KronoxUser#### / KronoxUser#####
//     and is not derived from email, Google ID, Apple ID, or provider UID.
//
// Codex378 — Guided first Solo onboarding:
//   • Routes first-time guests through `/onboarding`, starts a forgiving
//     guided first Solo level, then sequences profile setup and category setup.
//   • Keeps Apple/Google/email login optional and leaves normal Solo/Online
//     gameplay rules unchanged.
//
// Codex379 — Guest account linking Phase 3:
//   • Adds linkGuestAccount + AccountLinkTransaction for one-time,
//     idempotent guest-to-authenticated account merge.
//   • Syncs token-proven guest Solo progress into GuestProfile, publishes guest
//     leaderboard projection rows, and migrates/passivates them on link.
//   • Keeps leaderboard identity username/display_name-first and presents
//     login as "secure your progress" with guest continue still available.
//
// Codex380 — Editable Profile Settings:
//   • Adds Profile > Ayarlar editing for username/display_name plus optional
//     private age/gender for guest and registered users.
//   • Adds updateProfileSettings with auth-user verification, guest token
//     proof, case-insensitive username uniqueness, and leaderboard display
//     refresh without exposing age/gender.
//
// Codex381 — Codex379 Health blocker contract alignment:
//   • Restores the Solo success CTA disabled={!hasNextLevel} static/runtime
//     contract while preserving guided tutorial success routing.
//   • Keeps active Solo attempts out of loading/error fallback during question
//     refetch and makes /privacy + tutorial_in_progress contracts explicit.
//
// Codex382 — Codex381 Profile/Settings Health contract alignment:
//   • Restores ProfilePage authenticated identity fields full_name/email while
//     keeping GuestProfile username/display_name as guest public identity.
//   • Keeps Settings Hesabı Sil on the shared confirmed deletion request and
//     restores the StandardTopBar user={user} contract without moving admin tools.
//
// Codex383 — Base44/Vite raw Markdown import fix:
//   • Removes remaining live docs Markdown raw Health imports that crash Base44
//     import analysis and uses existing in-src doc mirrors instead.
//   • Leaves vite.config unchanged; no assetsInclude workaround is used.
//
// Codex384 — Guided tutorial drag hint:
//   • Adds a tutorial-only animated hand cue on the first Solo onboarding
//     drag step, repeating until the player starts dragging or completes it.
//   • Keeps the cue pointer-events:none so normal drag/drop hit-testing,
//     Online, and regular Solo gameplay stay untouched.
//
// Codex385 — Guided tutorial timer and joker demo:
//   • Restores guided first Solo level timer to the shared 180-second Solo
//     limit instead of the stale 20x tutorial override.
//   • Adds a tutorial-only Zaman Dondur hand/tap demo that waits for one use
//     without spending UserJokerInventory or writing a solo_use ledger row.
//
// Codex386 — Onboarding profile username-only fix:
//   • Removes separate Görünen Ad UI from onboarding/profile settings.
//   • Mirrors legacy display_name from username for existing projections.
//   • Lets profile save advance to category setup without stale auth refresh
//     blocking the Kategorilere Geç transition.
//
// Codex387 — Public createGuestProfile abuse/bloat hardening:
//   • Keeps guest creation public by design while adding request size/shape
//     validation, source-hash throttling, and GuestCreationThrottle rows.
//   • Adds client install id hashing for bloat control without trusting it as
//     identity proof or storing raw IP/header/token data.
//   • Blocks public request bodies from setting trusted score/economy/link fields.
//
// Codex395 — Onboarding category source/routing P0 fix:
//   • Guided tutorial success now writes profile_setup_pending from the game
//     completion handoff before returning to onboarding, while the onboarding
//     page keeps its route-state fallback.
//   • Guest category onboarding loads current Category metadata through
//     getCategoryMetadata and no longer renders the old hardcoded seed
//     fallback when DB metadata is unavailable.
//   • Blank age is an explicit optional profile value and cannot block
//     Kategorilere Geç.
//
// Codex394 — Solo v3 move-based scoring:
//   • Replaces visible Solo HATA limit with remaining HAMLE counter and
//     move-based stars, while keeping legacy mistake metadata compatible.
//   • Counts moves only after evaluated timeline placements; invalid drops,
//     touch/drag, tutorial hints/popups, and joker activation do not decrement.
//   • Updates Solo result popups, deck sizing, docs, and Health/static checks
//     for HAMLE / 10 evaluated moves without changing Online gameplay.
//
// Codex396 — Public guest/category endpoint classification:
//   • Keeps createGuestProfile public-by-design with documented throttle and
//     token-hash proof while classifying runtime monitoring as manual proof.
//   • Hardens getCategoryMetadata request shape and documents its public,
//     metadata-only Category response scope for guest onboarding.
//   • Adds Health/static proof that public category metadata is allowed only
//     when it exposes no questions, answers, years, full bank, or stale fallbacks.
const BUILD_MARKER = 'Codex397';
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
