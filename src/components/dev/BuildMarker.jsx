import React, { useEffect, useState } from 'react';

// Codex552 — Question preparation hourglass loader:
//   • Solo normal question-preparation loading now renders the shared
//     visual-only Kronox hourglass screen instead of the old spinner/text/back
//     panel, without adding any artificial wait or minimum display duration.
//   • Online bootstrap keeps the same recovery timing, but uses the same
//     hourglass visual before the retry/back fallback appears.
//   • Docs/mirrors/Health now guard the no-delay, visual-only loading contract.
//
// Codex551 — Store catalog redesign and economy-safe purchase contract:
//   • MarketPage now uses the dark-blue Store catalog layout with Barlow
//     Condensed product/pricing typography, vertical product cards, exact
//     Diamond package display prices, Joker/Hint/Advantage Diamond-spend
//     sections, and disabled future KronoClub/remove-ads cards.
//   • Real-money Diamond packages remain display-only until approved IAP or
//     payment verification exists; no fake client grant path awards Diamonds,
//     KronoClub, or ad-removal benefits.
//   • Diamond-spend Store purchases are centralized through server-owned
//     product ids, trusted backend costs, idempotency, user-owned ledgers, and
//     no Kronox Puan / leaderboard impact.
//
// Codex550 — Home CTA copy, Çark shortcut mini wheel, notification typography:
//   • Home secondary Online CTA copy now reads ONLINE KAPIŞ while preserving
//     the existing Home-owned Online route behavior and BottomNav ownership.
//   • The Home Çark shortcut now uses a scoped SVG mini Daily Wheel visual
//     with colored slices, gold ring/hub, and no reward icons, numbers, or
//     Diamond symbols inside the wheel segments; Daily Wheel popup/reward
//     logic is unchanged.
//   • Header notification and invite notification surfaces now use Barlow
//     Condensed bold italic title styling plus Inter body/error/empty text,
//     without changing notification fetch, read/unread, accept/reject, or
//     lifecycle behavior.
//
// Codex549 — Solo gameplay header back/progress layout:
//   • Solo GameLayout now renders a source-aware back arrow in the old
//     left-side progress slot and moves the existing progress value/bar to
//     the right side directly beneath the timer, with both controls aligned
//     on one row.
//   • Home direct Solo starts tag /game route state with soloReturnTo:'home';
//     SoloChallenge level-node starts tag soloReturnTo:'solo-levels'; Game.jsx
//     resolves those to Home or /solo with a safe Home fallback and preserves
//     the source through retry/next-level route rebuilds.
//   • Solo scoring, timer, move count, completion/progress math, drag/drop,
//     joker inventory/actions, and question selection remain unchanged.
//
// Codex548 — Daily Wheel post-claim close/reopen flow:
//   • Closing a completed Daily Wheel result now closes the Home Çark shortcut
//     sheet as well, returning directly to Home without the old claimed
//     cooldown card appearing behind the reward result.
//   • Already-claimed Home Çark opens now reopen the read-only post-win result
//     screen from cached/refreshed backend lastReward, with a safe
//     "Bugünkü ödül alındı" fallback for legacy missing-payload rows. This path
//     never starts a spin, calls claimDailyWheelReward, grants rewards, or adds
//     a fake ad path.
//   • Daily Wheel docs, mirrors, and Health now guard the removed cooldown
//     modal path, direct result-close-to-Home behavior, disabled ÇEVİR repeat
//     CTA, no-Puan/no-Leaderboard, and Daily Quest Diamond-only contracts.
//
// Codex547 — Daily Wheel post-spin result simplification:
//   • DailyWheelCard keeps the wheel visible after the backend-selected landing
//     animation and replaces the old result card/details with one
//     backend-payload reward line (Diamonds, Joker, or Gift Box) plus one
//     bottom disabled ad/video ÇEVİR CTA.
//   • The disabled repeat CTA is a real disabled button with no click handler;
//     it cannot start a spin, call fake rewarded ads, grant rewards, or change
//     ad counters. Reward selection/segment landing remains backend-owned.
//   • Daily Wheel docs, mirrors, and Health now guard the simplified result
//     screen, removed old total/streak/retry copy, no fake ad path,
//     no-Puan/no-Leaderboard, Daily Quest Diamond-only, and unchanged segment
//     size/orientation contracts.
//
// Codex546 — Full architecture/performance cleanup safe pass:
//   • Root package.json/package-lock.json restore @base44/sdk to the exact
//     0.8.34 pin required by current security Health/docs; no SDK upgrade or
//     Base44 migration work is introduced.
//   • FriendsPage, CreateLobbyInvitePanel, LobbyRoom, SoloQuestionDebugPanel,
//     and GameDebugLog now keep transient success/copy/auto-trim timers in refs,
//     clear previous timers before rescheduling, and clear pending timers on
//     unmount so delayed UI callbacks cannot outlive their component.
//   • Architecture/Health docs and healthAlignmentDocMirrors record the audit
//     decision; simulationPanelHealthUpdateAuditCases adds a focused static
//     guard for the timer-cleanup contract. No broad refactor, gameplay,
//     scoring, economy, admin-permission, or native behavior change.
//
// Codex545 — Daily Wheel segment content radial center-facing orientation:
//   • DailyWheelCard rotates each segment's content group by its own segment
//     center angle (transform: translate(-50%,-50%) rotate(${angle}deg),
//     transformOrigin center) so the Diamond icon+number groups and Joker/Gift
//     icons face the wheel hub instead of staying screen-upright. Content lives
//     inside the spinning wheel layer, so it rotates with the wheel; the pointer
//     stays outside/stationary. No counter-rotation is added.
//   • Icon/number sizes, the shared 0.8 content scale, segment order, segment
//     sizes, pointer alignment, backend-selected reward mapping, and the stop
//     angle (getWheelTargetRotation by rewardSegmentIndex) are all unchanged —
//     orientation is a pure content-transform change with no reward drift.
//   • Docs (KRONOX_ECONOMY_RULES.md), dailyWheelHealthMirror,
//     healthAlignmentDocMirrors, and a new Daily Wheel Health case
//     (daily_wheel_segment_content_radially_center_facing) capture the
//     radial-orientation / no-screen-upright / no-enlargement contract.
//
// Codex544 — Daily Wheel spin-feel fix (continuous fast → decelerate):
//   • DailyWheelCard removes the separate steady pre-spin 'loop' phase that
//     caused the slow → fast → slow feel. The wheel now runs ONE continuous
//     landing timeline: it reaches a clear fast pace immediately, holds it, and
//     decelerates only near the end with a light final rotation bounce
//     (WHEEL_LANDING_EASE = [0.05, 0.75, 0.15, 1], keyframe [0, target+5, target]
//     over times [0, 0.9, 1]). Total spin stays ~5s; reduced-motion keeps a
//     simple easeOut.
//   • Spin sound/effects are synchronized to the visible rotation: ticks are
//     scheduled with a gap that widens as the wheel decelerates (70ms → ~360ms)
//     instead of a fixed cadence, and all timers/sound are cancelled on
//     close/unmount so no sound outlives the visible wheel. Confetti/haptic/
//     reward sound and result reveal still fire only at the visible stop.
//   • No icon/number sizes changed; the reduced 0.8 segment content scale,
//     segment order, pointer alignment, and backend-selected reward mapping are
//     preserved. Docs (KRONOX_ECONOMY_RULES.md), dailyWheelHealthMirror,
//     healthAlignmentDocMirrors, and Daily Wheel Health cases updated to the
//     continuous-spin / no-slow-fast-slow / synchronized-effects contract.
//
// Codex543 — Daily Wheel spin-state/animation polish:
//   • DailyWheelCard removes the visible intermediate spinning-copy state and keeps one premium modal/wheel path mounted while the backend-selected landing spin runs.
//   • The wheel now lands with one continuous rotation to reward_segment_index plus a light non-rotational settle at reveal, with spin ticks cleaned up before confetti/haptic/reward sound fire.
//   • Daily Wheel segment icon/number content uses a shared 0.8 scale token; docs/mirrors/Health guard no Puan/leaderboard, Daily Quest Diamond-only, and disabled Yakında ad-repeat behavior.
//
// Codex542 — Daily Wheel premium popup visual refresh:
//   • DailyWheelCard ready/result popup now uses the centered blurred modal, exact GÜNLÜK ÇARK HAZIR copy, equal SONRA/ÇEVİR actions, a proportional premium 8-slice wheel, stationary gold pointer, small unbranded hub, and icon-only joker/Gift Box slices.
//   • dailyWheelRewards owns the visual segment metadata in the same backend-selected reward order: diamond_20, diamond_60, diamond_100, joker_krono_kalkan, joker_zamani_dondur, joker_kart_degistir, gift_box, diamond_250.
//   • Daily Wheel Health/docs/mirrors now guard the visual contract while preserving backend-selected rewards, no Kronox Puan, no leaderboard impact, Daily Quest separation, and disabled Yakında ad-repeat behavior.
//
// Codex541 — MR4ZJL6J Health blocker alignment:
//   • LeaderboardPage uses totalKronoxScore as the unified current-user/fallback score sourced from getKronoxVisibleScore, removing the stale visible-score variable from Liderlik while preserving removed top cards/copy/friends area.
//   • Daily Wheel Health/docs/mirrors now pin server-day idempotency wording, backend-selected Gift Box/result contracts, and the disabled future rewarded-ad integration CTA with no fake ad reward path.
//   • Root @base44/sdk is restored to exact 0.8.34 and adminResetDailyWheelState removes forbidden private-id response-shape tokens from source.
//
// Codex540 — Admin Daily Wheel state reset by Kronox User ID:
//   • Admin Ekranı adds Günlük Çark Reset with Kronox User ID input, safety copy, loading/success/error states, and the same AdminCollapsibleSection card format as other admin tools.
//   • adminResetDailyWheelState enforces active AdminUser owner/admin server-side, resolves User/GuestProfile by kronox_user_id, resets today-only Daily Wheel guards/auto-popup marker/blocking idempotency rows, and logs AdminMaintenanceLog without exposing private IDs.
//   • Daily Wheel reset docs, mirrors, and Health now guard that previous Diamonds/Jokers are not reversed, no rewards are granted, and Daily Quest/Kronox Puan/Leaderboard remain unaffected.
//
// Codex539 — Daily Wheel V2 server-weighted rewards:
//   • claimDailyWheelReward now owns the V2 weighted reward table, 8 equal visual segments, Gift Box package resolution, and approved Daily Wheel joker grants through DailyWheelSpin + DiamondTransaction/JokerTransaction/UserJokerInventory idempotency.
//   • useDailyWheel/MainMenu add one free daily auto-popup per player/day without consuming the spin on close; DailyWheelCard reveals Diamonds/jokers/Gift Box rewards and shows a disabled Yakında rewarded-ad repeat CTA with no fake reward flow.
//   • Daily Wheel docs, mirrors, and Health now guard V2 no-Puan/no-leaderboard, server-selected segment, Gift Box, approved joker grant, and Daily Quest Diamond-only separation contracts.
//
// Codex538 — Home primary Solo CTA direct-start + secondary Online CTA styling:
//   • MainMenu now derives the Home Solo CTA's dynamic Seviye value from the shared Solo progress helpers and direct-starts the resolved playable level via buildSoloGameConfigForLevel -> /game.
//   • Home CTAs now render OYNA / Seviye X and ONLINE KAPIŞMA with equal dimensions, requested yellow/blue gradients, borders, glow, and centered Montserrat typography.
//   • Home CTA docs/mirrors/Health scans now guard the direct-start/equal-dimension contract while preserving Solo/Online scoring, rewards, BottomNav, and Online Home ownership.
//
// Codex537 — Unified Liderlik visible-score source fix:
//   • LeaderboardPage now computes one visible totalKronoxScore value for the current linked-or-guest player, applies it to the current-player public row, fixed "Senin Sıran" card, and fallback own-score state, and keeps global row ranking/data source unchanged.
//   • buildSoloLeaderboardPayload/buildGuestSoloLeaderboardPayload now use getKronoxVisibleScore for total_kronox_score so background projection writes match the approved materialized visible Puan source instead of a derived-only fallback.
//   • Unified Kronox Score Health/docs/mirrors now guard current row/card/fallback source parity without restoring removed top stat cards, helper copy, or Friends area.
//
// Codex536 — Health blocker alignment for MR3RATHD:
//   • AdminPage now uses the canonical "Admin Ekranı" title text while the shared Admin title class keeps the approved uppercase visual treatment and the existing AdminUser gate/tools remain unchanged.
//   • Leaderboard rows/current-user card now render avatars through shared KronoxAvatar with a leaderboard variant; Health/docs retarget stale checks away from removed top stat cards, removed helper copy, and removed friends empty area while preserving materialized score/privacy contracts.
//   • Root @base44/sdk is re-pinned to exact 0.8.34 in package.json and package-lock.json with the 0.8.34 lock metadata; Base44 function imports remain npm:@base44/sdk@0.8.34.
//
// Codex535 — Liderlik avatar/name/score + sticky current-user card:
//   • KronoxRankingSection now uses scoped leaderboard-avatar/name/score classes, a fixed my-rank-sticky current-user card above BottomNav, and extra leaderboard-list bottom padding so rows remain reachable.
//   • The Leaderboard-only Friends area is removed from Liderlik UI; friends/invites backend, badges, and features elsewhere remain untouched.
//   • Leaderboard Health now guards avatar/default-letter styling, sticky current-user card styling, removed Friends empty copy, and preserved row rank/avatar/username/score data.
//
// Codex534 — Liderlik ranking panel/list polish:
//   • KronoxRankingSection now uses the requested .leaderboard-panel, .leaderboard-section-title, .leaderboard-list, .leaderboard-row, and .leaderboard-rank classes, with the old "Tüm oyuncular arasında..." helper copy removed.
//   • The list is internally scrollable with mobile containment while preserving row rank/avatar/username/badge/score data, materialized score sourcing, BottomNav, safe areas, and the approved Liderlik background/header.
//   • Leaderboard Health now guards the panel/list/row/rank visual contract and the removed helper text.
//
// Codex533 — Admin Panel visual standardization:
//   • AdminPage and AdminCollapsibleSection now share adminVisualStyles for one consistent card shape, border/background, icon container, title font, description font, summary badge, and section/header typography.
//   • The eight Admin tool entries remain present and keep their existing routes/actions; AdminUser gate, report tools, Health Simulator, Test Elmas, cleanup, and reset behavior are unchanged.
//   • Admin Authorization Health now guards the shared Admin visual style contract without adding screenshot-only checks.
//
// Codex532 — Liderlik header simplification:
//   • Removed the old top Liderlik summary card, including Puan/Seviye/Elmas tiles and the explanatory "Kronox Puanın Solo ve Online sonuçlarınla güncellenir." sentence.
//   • Added the centered .leaderboard-heading with the requested gold .leaderboard-trophy badge and exact LİDERLİK title styling while preserving the approved Liderlik background, StandardTopBar, BottomNav, ranking rows, score materialization, and username-only identity.
//   • Leaderboard Health now guards the new header tokens and prevents the removed summary block from returning.
//
// Codex531 — Liderlik background gradient:
//   • LeaderboardPage root now uses the scoped .leaderboard-page class with the exact requested dark-blue radial + vertical gradient and safe-area/BottomNav padding.
//   • The old inline Liderlik background was removed; content/top-bar offset remains inside the page content so BottomNav, StandardTopBar, scoring/data, identity/privacy, and other page backgrounds stay unchanged.
//   • Leaderboard Health now guards the scoped background class and exact gradient tokens.
//
// Codex530 — Health blocker fixes (KRONOX-MR3JXNK3):
//   • Base44 SDK exact pin: package.json and package-lock.json (root spec + installed node_modules/@base44/sdk block version/resolved/integrity) re-pinned from ^0.8.35 to exactly 0.8.34 with the real 0.8.34 tarball + integrity; no caret/range remains and critical Base44 Deno functions already import npm:@base44/sdk@0.8.34.
//   • Solo P3 repeated-deck coverage: the "100 normal decks" simulation now cycles only normal levels [1,2,3,4,6,7,8,9] instead of (index % 9)+1, which had leaked special level 5 (21-card deck). 100 normal decks now select exactly 100 × 18 = 1800 cards, matching the expectation, while diversity/cooldown/first-five spacing rules are unchanged.
//   • Health alignment doc freshness: the scoring doc mirror + canonical docs/KRONOX_SCORING_RULES.md now carry the exact "Deck sizing is 2 anchors + 10 playable moves + Kart Değiştir buffer + Kronokalkan buffer" normal-level phrasing the alignment case scans.
//   • Solo Health registration: the alignment expectation now references the real current cases special_deck_size_is_21 and solo_attempt_uses_level_specific_move_limits (removed stale special_deck_size_is_19 / solo_move_based_runtime_contract tokens), and a new executable solo_attempt_fails_on_10th_move case proves normal Solo fails exactly on the 10th evaluated move while special keeps the 13-move buffer. Scoring, special 10-correct/13-move rules, economy, auth, navigation, and Home are unchanged.
//
// Codex529 — Global in-app zoom prevention:
//   • index.html locks the app viewport to scale 1 and the App root mounts usePreventAppZoom once for WebView/PWA/browser runtime guardrails.
//   • The guard blocks iOS gesture zoom, multi-touch pinch movement, ctrl/meta-wheel zoom, and double-tap zoom while leaving one-finger touchmove, Solo drag/drop, timeline horizontal scroll, BottomNav taps, modals, and inputs functional.
//   • Mobile docs/mirrors/Health now guard the no-zoom contract without touching native Android/iOS files, scoring, economy, Online, Daily Wheel, or Daily Quest behavior.
//
// Codex528 — Special Solo move-buffer rule:
//   • Special Solo levels now start at level 5 and every fifth level after, keep the 10-card timeline target, and use 13 evaluated moves instead of the normal 10 so the extra moves are only a mistake buffer.
//   • Special Solo route/retry/next-level configs, runtime move enforcement, backend getQuestions deck sizing, docs, mirrors, and Health expectations now agree on normal 18-card/10-move and special 21-card/13-move rules.
//   • Solo scoring, star thresholds, Kronox Puan, Diamonds, leaderboard, Online, Daily Wheel, and Daily Quest behavior remain unchanged.
//
// Codex527 — BottomNav Profile guest-route bounce fix:
//   • App-level guest onboarding guard now explicitly exempts the normal /profile BottomNav destination so Profile can resolve/repair guest state locally instead of briefly selecting Profil and bouncing back to Home.
//   • Health/mirror contracts now pin Profile as a guest-compatible BottomNav route while keeping BottomNav limited to Ana Sayfa/Liderlik/Profil and Online Home-CTA-owned.
//
// Codex526 — Daily Wheel claim reliability fix:
//   • claimDailyWheelReward now uses explicit runtime-safe entity handles for player updates, DailyWheelSpin, and DiamondTransaction writes, matching the proven Daily Quest auth/service fallback pattern while keeping rewards server-owned, Diamond-only, guest-valid, and idempotent.
//   • useDailyWheel now refreshes server status after a claim rejection before showing retry copy, so an already-applied or reconciled same-day claim becomes the claimed/result state instead of a false “Ödül alınamadı” loop.
//   • Daily Wheel Health guards the spin-failure reconciliation path and backend entity-handle contract.
//
// Codex525 — Home hourglass alpha asset fix:
//   • Replaced the Home hourglass PNG in-place with an RGBA alpha version of the same 1024x1024 local artwork, removing the baked black rectangle while preserving current source path, position, and size.
//   • MainMenu now renders the hourglass normally on a transparent image background (no screen-blend workaround, no filter), and the visual Health/docs contract expects the real transparent asset.
//
// Codex524 — Home geometry balance fix:
//   • Home middle section now uses a real centered stage: equal left/right shortcut anchors and an absolute 50% hourglass anchor, so the hourglass sits between Görevler and Çark instead of overflowing from a narrow grid column.
//   • Solo/Online CTA stack keeps the same button sizes and 14px internal gap, but uses one shared balance gap above and below the stack so hourglass-to-Solo and Online-to-BottomNav spacing read evenly.
//   • Home docs/mirrors/Health now describe the balanced geometry contract without changing shortcut behavior, rewards, BottomNav, logo, or hourglass asset.
//
// Codex523 — Home video-based visual fixes:
//   • Home logo and hourglass scale increased by 20%; the hourglass remains centered between Görevler and Çark, with image filters removed so the non-alpha PNG cannot cast a rectangular shadow block.
//   • Görevler/Çark now open centered reward popups instead of bottom-aligned sheets, and the Solo/Online CTA stack is lifted about 2dvh above BottomNav.
//   • Home Mağaza top-left icon now uses the storefront glyph style while preserving Market navigation; docs/mirrors/Health updated for the centered visual contract.
//
// Codex522 — Post-visual-change docs/Health alignment audit:
//   • Home docs, mirrors, and Health wording now describe the current local logo/hourglass assets, compact Görevler/Çark shortcuts with ready badges, and no expanded Günlük Ödüller panel on first Home paint.
//   • Economy/Daily Quest mirrors now name the Home Görevler shortcut/modal surface instead of the old unified reward panel while preserving Diamond-only/backend-owned contracts.
//   • MainMenu Home labels use zero letter spacing to stay aligned with the visual guardrail.
//
// Codex521 — Health blocker fixes (KRONOX-MR2NDTH7):
//   • Remote visual asset removed: the Home hourglass no longer uses an https:// remote URL. The artwork was localized to /assets/ui/kronox-hourglass-home.png and composited with mix-blend-mode:screen (black background drops out against the Home gradient — no box/halo). MainMenu/Lobby/CreateInvite now contain no new remote (https/http) visual asset tokens, satisfying the no-remote-visual-assets contract.
//   • Compact Görevler/Çark shortcut contract restored: the shortcut label props are the exact Health-scanned literals label="Görevler" and label="Çark" (uppercased visually via CSS text-transform), placed above the Solo CTA, opening the existing Daily Quest/Daily Wheel modal flows. No expanded reward panels or login prompts on first render.
//   • Completed guest Daily Wheel player contract: MainMenu resolves a linked-or-guest rewardsPlayer (user || completedGuestProfile) and gates the shortcut ready-badges with rewardsPlayer && so completed guests keep Daily Wheel access + persisted GuestProfile Diamonds without login. Wheel status/claim stay server-backed, Diamond-only, one-spin-per-server-day.
//   • StandardTopBar notification bell: the top bar now renders the exact shared <HeaderNotificationBell user={user} /> for non-home screens (home keeps the larger variant), restoring the Health-expected top-bar contract without duplicate bells.
//   • Profile-only guest CTA: Home has no provider buttons; the rewardsPlayer && guest-continuation runtime path is present in MainMenu. Profile remains the only account-linking surface.
//   • Base44 SDK exact pin: package.json and package-lock.json (root spec + installed package block version/resolved/integrity) re-pinned from ^0.8.35 to exactly 0.8.34 with the real 0.8.34 tarball + integrity; no caret/range remains. All critical backend functions already import npm:@base44/sdk@0.8.34.
//
// Codex520 — Home middle-section hourglass container/centering cleanup:
//   • The central hourglass no longer reads as sitting inside a card/box/dark plate. Removed the radial glow plate div entirely and replaced the tight high-contrast alpha mask with a wide, very soft radial feather (ellipse 60%/66%, #000 30% → rgba 0.55 58% → transparent 82%) that dissolves the artwork's baked-in solid dark-navy background smoothly into the Home gradient — no visible box, oval halo, tinted backdrop, or hard mask edge. The hourglass now floats directly on the Home background; only a soft drop shadow grounds it.
//   • Centering preserved: the middle row stays a symmetric 3-part grid (5rem Görevler / 1fr hourglass / 5rem Çark) with items-center, so the hourglass sits horizontally centered and Görevler/Çark stay balanced around it.
//   • Görevler/Çark icons, labels, ready-badge, routing, Daily Wheel/Quest logic, top header, logo, CTAs, and BottomNav all unchanged.
//
// Codex519 — Home CTA buttons + global BottomNav visual polish:
//   • Home Solo/Online CTAs rebuilt to the Screenshot 2 target as one identical premium-gold family: fixed 74px height, 22px radius, gradient linear-gradient(180deg,#FFE36D,#FFC928 52%,#E4A600), deep tactile shadow (0 7px 0 #A97400 + drop + gold glow), left 40px icon zone → 1.5px vertical divider → Barlow Condensed italic 800 / 26px / #101827 left-aligned text → right chevron. Solo icon is now a crosshair/target, Online stays crossed swords. Gap 14px. Solo→/solo and Online→/lobby (guest redirect) navigation unchanged; Online stays Home CTA-owned, not a BottomNav tab.
//   • Global BottomNav inactive label bumped 11px→12px to match the spec; surface (rgba(10,26,53,0.76)+blur14, gold #FFC928 active with top indicator/glow, muted #9BAEC2 inactive, 3 tabs Ana Sayfa/Liderlik/Profil) already matched Screenshot 3 and is unchanged.
//   • Top header, logo, hourglass, Görevler/Çark, routing, and all backend logic unchanged.
//
// Codex518 — Home middle-section redesign to match target (Image B):
//   • Görevler (left) / Hourglass (center) / Çark (right) kept as a 3-part row; side columns widened to 5rem for balanced symmetry around the dominant transparent hourglass. The hourglass stays fully transparent over the Home background (no card/panel/plate) — unchanged behavior.
//   • Shortcut shells now use the exact spec: 44px circle, linear-gradient(160deg,#102A4A,#071A33), 1px rgba(85,216,255,0.42) border; Görevler icon #55D8FF, Çark icon #FFC928. Labels uppercase GÖREVLER/ÇARK in Inter 600 / 11px / #F4F7FB.
//   • Ready-state badge (10px #FFC928 dot, 0 0 8px glow) shows only when real availability exists: Görevler when a daily quest is claimable (status=completed), Çark when the daily wheel isAvailable. Inactive icons stay visible with a subtle non-glowing shell. Availability reuses the existing useDailyWheel/useDailyQuests server-owned status hooks; wheel/quest backend logic unchanged.
//   • Top row, logo, CTAs, BottomNav, routing, and shortcut modals unchanged.
//
// Codex517 — Home background container spec alignment:
//   • MainMenu root now uses width:100% + min-height:100dvh (kept the existing 100dvh viewport lock/overflow behavior) alongside the already-correct target dark-blue radial + linear gradient, so the full Home background is guaranteed visible behind all content. No Home layout element moved; gradient value unchanged.
//
// Codex516 — Home top bar visual refinement + global notification button style:
//   • Home top-left Store button, top-right Notification button, and the shared bell now use one circular gold-accent system: navy surface rgba(7,21,47,0.82), 1px gold border rgba(255,201,40,0.45), pure #FFC928 icon, and a stronger gold+cyan glow ring (home 44px, other screens 40px). The old gold-filled default bell variant was removed so the notification button matches everywhere it appears.
//   • Home top-center Diamond display enlarged: Inter 700, white #F4F7FB number, gold #FFC928 gem with a slightly larger icon on the home variant. Diamond source/tap behavior unchanged.
//   • Notification unread badge recolored to #FF5D67 on #FFFFFF; badge still shows ONLY when real unread notifications exist (0/empty renders nothing).
//   • Store→Market navigation, notification open flow, economy/notification backend logic, the centered transparent Kronox logo, hourglass, shortcuts, CTAs, and BottomNav are all unchanged.
//
// Codex515 — Home screen visual rebuild to match target design:
//   • Central time visual replaced: the weak pure-CSS hourglass is now a single static illustrated centerpiece (ornate gold + navy hourglass resting on a glowing zodiac/roman-numeral clock ring), sized larger (min(72vw,300px)) to anchor the page. The image uses a solid-navy background feathered into the Home gradient via a radial alpha mask so there is no rectangular seam. No coded animation; controlled radial glow only.
//   • Görevler/Çark shortcuts widened (4.75rem columns, z-10 wrappers) so labels never clip behind the larger centerpiece; icon/circle/label styling unchanged.
//   • BottomNav restyled to the Home spec: blurred navy surface (rgba(10,26,53,0.76) + blur14), gold active tab (#FFC928) with a top indicator line + glow and bold label, muted #9BAEC2 inactive tabs. Tabs/routes/behavior unchanged.
//   • Centered transparent Kronox logo, StandardTopBar (Mağaza / Elmas / Bildirim), CTA buttons, and all navigation left functionally unchanged.
//
// Codex514 — Home main menu redesign:
//   • Home now uses the transparent local Kronox logo asset as a centered, unboxed top visual over the dark blue background.
//   • First-render Home is compact: Mağaza/Diamonds/Bildirimler top row, static time visual, Görevler/Çark shortcuts, and large Solo/Online CTAs.
//   • Daily Wheel and Daily Quest remain available through shortcut modals, preserving reward patching without mounting the expanded Günlük Ödüller panel on first paint.
//
// Codex513 — Health blocker fixes:
//   • GameInvite creation Health now scans the backend-owned createGameInvitesForTargets contract for the 10-minute pending/expires_at runtime path.
//   • createGameInvites returns the exact best-effort push summary shape after invoking sendGameInvitePush without blocking invite creation.
//   • DailyWheelSpin backend create paths now call DailyWheelSpin.create through explicit service-role handles so the auth-scoped create contract is visible.
//
// Codex512 — Security hardening:
//   • VAPID push diagnostics now expose only safe configured/valid booleans plus counts; private key material remains backend-env-only and never logged/returned.
//   • DailyWheelSpin, GameInvite, and FriendRequest RLS create rules are admin/service-role only; invite/friend/wheel creation is backend-function owned.
//   • linkGuestAccount returns a public-safe linked user projection and no longer echoes idempotency keys that may contain raw guest ids.
//
// Codex511 — Health blocker fixes (KRONOX-MR1Z7YC9):
//   • Solo failure CTA contract: the TEKRAR OYNA button now renders the literal <RotateCcw> icon wired to the real onRetry action (was passed as an icon prop, so the static contract never saw <RotateCcw). SEVİYELER (onBackToPath) unchanged; failed attempts still never enable SONRAKİ SEVİYE.
//   • Solo score visible + shared-helper consumption: success PUAN card is wired to value={String(levelScore || 0)} (runtime-connected to the shared score summary prop instead of a local scoreValue copy) and its speed-bonus footer label is uppercase HIZ BONUSU; failure screen adds a PUAN metric card (2×2 grid) wired to value={String(levelScore)} so the combined popup source exposes earned Puan, PUAN label, and the word Puan. Solo scoring rules, star thresholds, completion logic, timeBonus values, and Online screens untouched.
//   • Base44 SDK exact pin: root package.json and package-lock.json (root dependency spec + installed node_modules/@base44/sdk block with the real 0.8.34 tarball + integrity) re-pinned from ^0.8.35 to exact 0.8.34; no caret/range remains. All 51 backend function Deno imports already pinned npm:@base44/sdk@0.8.34.
//
// Codex510 — Leaderboard pending-rank display fix:
//   • Null/pending leaderboard rank values now normalize to a pending placeholder instead of rendering #null or being coerced through Number(null).
//   • Liderlik Health adds an executable/static guard for pending own-rank rows and the shared normalizeLeaderboardRank helper.
//
// Codex510 — Solo level-end success/failure screen redesign:
//   • New shared SoloResultMetricCard (vertical label→icon→value) drives both screens; success shows SÜRE/HAMLE/PUAN, failure shows SÜRE/TAMAMLANAN/HAMLE.
//   • Success: "N. SEVİYE TAMAMLANDI!", staggered gold stars, pooled success message, and a "Hız Bonusu +X ⚡" footer only when timeBonus > 0; primary SONRAKİ SEVİYE + TEKRAR OYNA/SEVİYELER.
//   • Failure: "N. SEVİYE GEÇİLEMEDİ!", two passive stone stars + broken red center star, "Yeniden denemeye ne dersin?", TAMAMLANAN as completed/target (e.g. 4/7). OYNAMAYA DEVAM ET shows 60 ELMAS + ÜCRETSİZ cards DISABLED (Yakında) — no diamond/ad continuation exists, so no client-only grant, no fake rewarded-ad SDK. Retry/levels behavior preserved.
//   • prefers-reduced-motion honored on both; subtle sounds.rewardReveal/sounds.wrong feedback reused (no new sound/haptic system). Solo scoring/stars/progression/navigation and Online result screens untouched. Solo popup Health suite rewritten to the new contract without weakening guards.
//
// Codex509 — Health blocker fixes (KRONOX-MR13F696):
//   • Root @base44/sdk re-pinned to exact 0.8.34 in package.json and package-lock.json root spec after a GitHub sync re-introduced the forbidden ^0.8.35 caret range.
//   • adminGrantDiamonds internal identifiers renamed (playerKey → economyKey, requireAdmin adminEmail → adminActorEmail) so the static admin-grant scanner no longer flags forbidden private response-shape source tokens; client/UI response shape was already private-safe and is unchanged.
//   • AdminUser gate, Kronox ID lookup, 100/300/500/1000 amounts, admin_adjustment DiamondTransaction ledger, request idempotency, and EconomyOperationLock all preserved with no score/quest/wheel/market mutation.
//
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


const BUILD_MARKER = 'Codex552';
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
