# Kronox Technical Flow

Status: Active technical flow contract.

This document describes the current implementation shape for engineers. It
supersedes old PDF-style technical notes that referenced Codex040-era routing,
login-first assumptions, old tutorial/scoring models, stale category fallbacks,
and incomplete security/economy contracts.

Related contracts:

* `KRONOX_CORE_PROMPT.md`
* `KRONOX.md`
* `docs/KRONOX_PRODUCT_WORKFLOW.md`
* `docs/KRONOX_DB_ARCHITECTURE.md`
* `docs/KRONOX_DATA_MODEL_AUDIT.md`
* `docs/KRONOX_QUESTION_DATA_MODEL.md`
* `docs/KRONOX_SOLO_QUESTION_ENGINE.md`
* `docs/KRONOX_CATEGORY_TAXONOMY.md`
* `docs/KRONOX_SCORING_RULES.md`
* `docs/KRONOX_ECONOMY_RULES.md`
* `docs/KRONOX_PROFILE_FIELDS.md`
* `docs/KRONOX_SECURITY_DEPLOYMENT.md`
* `docs/KRONOX_MOBILE_VISUAL_GUARDRAILS.md`
* `docs/KRONOX_RELEASE_PROOF_CHECKLIST.md`

---

# 1. Platform And App Shell

Kronox is a Vite + React app with Tailwind-style UI, Base44 Functions /
Entities, and mobile-first PWA/WebView constraints.

Platform rules:

* Base44 owns generated Android/iOS packages.
* Do not assume native Android/iOS business logic.
* Frontend build proof is Vite proof only.
* Base44 function deployment and native wrapper behavior require separate
  manual proof.

App shell owner:

* `src/App.jsx`

Primary mobile shell constraints:

* Home is fixed/no-scroll where intended.
* Gameplay avoids page-level vertical scroll where possible.
* timeline horizontal scroll is intentional and contained.
* Settings/Admin/Health/report pages may scroll.
* The root viewport is locked to scale 1 and the App shell owns a centralized
  zoom-prevention guard for pinch, double-tap, iOS gesture events, and
  ctrl/meta-wheel zoom.
* Zoom prevention must not block one-finger drag, timeline horizontal
  scroll/auto-scroll, normal scrollable panels, BottomNav taps, modals, or
  inputs.
* Native Android/iOS wrapper files remain outside this repo scope for the
  zoom-prevention contract.

---

# 2. Routes / Navigation

Important routes:

* `/` - Ana Sayfa
* `/onboarding` - guest onboarding and guided tutorial shell
* `/game` - Solo / Online gameplay shell
* `/solo` - Solo level map
* `/market` - Mağaza
* `/leaderboard` - Liderlik
* `/profile` - Profil
* `/settings` - Settings
* `/friends` - Arkadaşlarım
* `/lobby` - Online lobby
* `/admin` - Admin Ekranı
* `/test-suite` - Health Center / simulator
* `/privacy` - public privacy page
* `/account-deletion` - public account deletion page

BottomNav visible tabs:

* Ana Sayfa
* Liderlik
* Profil

Online is not a BottomNav tab. Online starts from Home.

BottomNav taps are root navigation: Ana Sayfa opens `/`, Liderlik opens
`/leaderboard`, and Profil opens `/profile`. BottomNav must not restore a
cached Profile/Friends/Settings subpage after the user changes tabs.

Subpages opened from a tab root carry explicit parent route state. Their
top-left back arrow returns to that parent/root route, not blindly to Home and
not through browser-history back if that could jump tabs or reopen stale state.

BottomNav is hidden or minimized where the game/onboarding shell requires it.

---

# 3. Base44 Functions / Entities Overview

Base44 Entities used by current product areas include:

* `GuestProfile`
* `GuestCreationThrottle`
* `AccountLinkTransaction`
* `User`
* `AdminUser`
* `Category`
* `UserCategoryPreference`
* `Question`
* `PlayerQuestionExposure`
* `PlayerQuestionDailyExposure`
* `QuestionAttemptEvent`
* `QuestionStatsProjection`
* `CategoryStatsProjection`
* `Lobby`
* `GameInvite`
* `OnlineMatchResult`
* `SoloLeaderboardEntry`
* `DiamondTransaction`
* `DailyWheelSpin`
* `DailyQuestDefinition`
* `UserDailyQuestProgress`
* `UserJokerInventory`
* `JokerTransaction`
* `PushSubscription`
* `AdminMaintenanceLog`

Key Base44 Functions include:

* `createGuestProfile`
* `linkGuestAccount`
* `getCategoryMetadata`
* `getQuestions`
* `startLobbyGame`
* `getDailyWheelStatus`
* `claimDailyWheelReward`
* `getDailyQuestStatus`
* `recordDailyQuestProgress`
* `claimDailyQuestReward`
* `purchaseJokerWithDiamonds`
* `sendQuestionAnalyticsReportEmail`
* `getSoloLeaderboard`
* `getAdminStatus`
* `deleteAccount`
* `adminResetUserProgress`
* `adminResetDailyWheelState`

Service-role functions must bind every user-owned object to authenticated user,
admin, participant, host, recipient, or documented authority fields before read
or mutation.

---

# 4. Guest Identity Architecture

Guest identity is app-owned through `GuestProfile`.

Not used for guest identity:

* Firebase anonymous auth
* Base44 anonymous auth

Core fields:

* `guest_id`
* `guest_token_hash`
* `guest_token_hash_algorithm`
* `username`
* `username_normalized`
* onboarding fields
* optional private profile fields
* optional selected category IDs

`createGuestProfile` is public by design. It creates the guest ID, raw token,
token hash, default username, and monitoring/throttle metadata.

Security rule:

* raw guest token is client-only
* server stores `guest_token_hash`
* `guest_id` alone is not enough for writes
* token-proven writes are required for guest profile/category/onboarding sync

Because `createGuestProfile` is public, it must stay hardened and monitored
with throttle rows and safe request handling.

---

# 5. Account Linking Architecture

Account linking is Profile-only.

Function:

* `linkGuestAccount`

Inputs/authority:

* authenticated user from `base44.auth.me()`
* guest proof from `guest_id + raw guest token`
* idempotency key for link transaction

Writes:

* `AccountLinkTransaction`
* linked `GuestProfile` status
* authenticated `User` progress/economy/category merges where safe
* Daily Wheel/Daily Quest guard fields and history copies under the registered
  owner key
* `User.linked_guest_ids` as duplicate-protection guard

Merge policy:

* keep user-beneficial progress
* combine Diamonds once through documented ledger/guard paths
* preserve same-day Daily Wheel/Daily Quest guards so linking cannot enable a
  duplicate reward claim
* merge category selections without exposing raw IDs publicly
* provider IDs and raw guest token never become public identity

Manual proof required:

* duplicate link retry
* wrong token blocked
* already-linked guest cannot link to another account

---

# 6. Onboarding State Machine

Source of truth:

* `GuestProfile.onboarding_status`

Current states:

* `guest_created`
* `tutorial_in_progress`
* `tutorial_completed`
* `profile_setup_pending`
* `category_setup_pending`
* `onboarding_complete`

Primary modules:

* `src/pages/OnboardingPage.jsx`
* `src/lib/guestProfile.js`
* `src/lib/categoryPreferenceOnboarding.js`
* `src/pages/Game.jsx`

State flow:

1. ensure guest profile
2. start guided tutorial
3. mark `tutorial_in_progress`
4. navigate to `/game` with guided Solo config
5. tutorial completion advances to profile setup
6. profile setup writes username plus optional age/gender
7. category setup writes selected category IDs
8. mark `onboarding_complete`
9. navigate to Ana Sayfa

Repair rule:

* later completed states outrank stale tutorial state
* `Eğitime Devam` is only for true resumable tutorial progress

---

# 7. Category Metadata / Source-Of-Truth

Canonical source:

* live `Category` rows
* current category taxonomy
* `getCategoryMetadata` for guest-safe metadata

Public metadata fields:

* `category_id`
* `name`
* `description`
* `status`

Forbidden runtime behavior:

* hardcoded Chronicle / Flashback / Viral / Arena / Level Up fallback arrays
* old seed-category ID boundary as runtime maximum
* raw `Question.list` for category UI
* exposing questions, answers, years, or full-bank data to category metadata

Authenticated preferences:

* entity: `UserCategoryPreference`
* UI: Profile > Profil Bilgileri > `Kategori seçimi`
* save minimum: 3 active valid categories
* fewer than 3 valid preferences means Solo uses all active categories
* at least 3 valid preferences enables Solo-only soft weighting

Online:

* loads current active categories
* sorts by `category_id` ASC
* does not read Solo preferences

Legacy:

* `SubCategory` is future lookup preparation
* `UserSubCategoryPreference` is retained legacy data
* current Settings UI does not write SubCategory preferences

---

# 8. Solo Engine Architecture

Primary files:

* `src/pages/Game.jsx`
* `src/lib/soloQuestionEngine.js`
* `src/lib/soloLevels.js`
* `src/lib/soloProgressHelpers.js`
* `src/hooks/useOfflineQuestions.js`

Current constants:

* `SOLO_LEVEL_TIME_SECONDS = 180`
* `SOLO_MAX_MOVES = 10` for normal Solo
* `SOLO_SPECIAL_MAX_MOVES = 13` for special Solo
* initial anchors = 2
* normal target = 7 total timeline cards including anchors
* special target = 10 total timeline cards including anchors
* normal deck = 18 questions
* special deck = 21 questions

Deck formula:

* 2 anchors
* 10 normal playable placement moves; 13 special playable placement moves
* Kart Değiştir replacement buffer
* Kronokalkan / Hata Affı buffer

Zamanı Dondur does not add a card requirement.

Runtime consumes `soloAttemptDeck` in order. Active attempts must not be
replaced by refetch/loading fallback.

---

# 9. Move-Based Scoring Implementation

Visible Solo scoring is move-based.

UI language:

* `HAMLE`
* `Puan`
* `Kronox Puan`

Legacy/internal:

* `HATA` is not current visible Solo scoring copy

Move consumption:

* valid timeline placement evaluation consumes one move
* touch, slight drag, drag start, cancelled drag, invalid drop, tutorial hand
  animation, popup reading, and joker activation do not consume a move

Star rules:

* 5-6 used moves = 3 stars
* 7-8 used moves = 2 stars
* 9-10 used moves = 1 star

Failure:

* level-specific evaluated move limit used before target timeline count is reached

---

# 10. Joker Technical Flow

Current inventory:

* `UserJokerInventory`

Ledger:

* `JokerTransaction`

Types:

* `time_freeze` - Zamanı Dondur
* `card_swap` - Kart Değiştir
* `mistake_shield` - Kronokalkan / Hata Affı

Normal Solo:

* spends from `UserJokerInventory`
* writes `JokerTransaction`
* has no free attempt-local fallback

Tutorial:

* demos are tutorial-only
* no real inventory spend
* no real ledger spend

Market:

* function: `purchaseJokerWithDiamonds`
* prices are server-owned
* Zamanı Dondur 40, Kart Değiştir 50, Kronokalkan 60
* validates authenticated user and sufficient Diamonds
* writes `DiamondTransaction` and `JokerTransaction`

---

# 11. Online Engine Architecture

Primary flow:

* `OnlineChallengeScreen` does not load or render category selection metadata
* Online UI does not send `selectedCategories` or `selected_category_ids`
* invite/code join functions merge players by identity and retry after
  concurrent roster writes
* `startLobbyGame` validates host/participants/settings server-side
* `startLobbyGame` reconciles accepted invite recipients into the final roster
  before assigning opening cards
* `startLobbyGame` builds and persists `online_question_deck`,
  `current_question_id`, `players`, `started_at`, and `state_revision` in one
  authoritative start write; repeated starts return the existing started lobby
  once that payload exists
* waiting-room clients transition through backend-sanitized polling plus
  focus/visibility refreshes, and Game can refetch the current Lobby if a route
  snapshot is partial; direct client Lobby subscriptions/reads are not the
  authority path

Online deck contract:

* all active categories = random Online pool
* difficulty 1 and 2 only
* one shared authoritative deck
* no Solo preferences
* no Solo 70/30 weighting
* no guest Solo projection
* no raw client question bank fallback

Online scoring updates the Online component of visible `Kronox Puan`.
Online does not inherit Solo move/star rules unless explicitly designed later.

Manual proof required:

* two-account invite/lobby
* host start
* synchronized deck/gameplay
* persisted result and no duplicate scoring

---

# 12. Question / Deck Selection

Backend projection:

* `getQuestions`

Selection inputs:

* active `Category` rows
* active `Question` rows
* Solo soft category preferences when valid
* difficulty/category/subcategory/theme/year balancing
* per-player exposure stats where available

Solo behavior:

* no raw client `Question.list` fallback
* full question bank must not be exposed
* category preferences are soft weighting only
* empty/unavailable preferences fall back to all active categories
* categories 6,7,8,9,11 remain eligible if active/playable

Question bank security:

* guest and normal gameplay receive bounded minimal projection only
* admin/full-bank diagnostics require active AdminUser authorization
* public assets must not include answer years or full bank data

---

# 13. Per-Player Exposure Architecture

Problem definition:

* same question across different players is acceptable
* same player seeing repeated questions too early is the issue

Entities:

* `PlayerQuestionExposure`
* `PlayerQuestionDailyExposure`
* `QuestionAttemptEvent`

Exposure rules:

* actual-shown-only
* buffered/candidate/reserved cards are not exposure
* unused deck cards are not exposure
* Kart Değiştir replacement counts only when shown
* reports must not expose internal player identifiers

Privacy:

* per-player reporting uses anonymized labels such as `User0001`
* no email, provider UID, raw guest ID/token, owner key, internal player key,
  or username in per-player report output

---

# 14. Question Analytics Report Generation

Callable:

* `sendQuestionAnalyticsReportEmail`

Current delivery:

* email-body-only
* no PDF
* text fallback
* admin-only
* exactly 9 top-level sections when Health enforces the report contract

Primary raw history:

* `QuestionAttemptEvent`

Projection/summary rows:

* `QuestionStatsProjection`
* `CategoryStatsProjection`

Manual analytics reset scope:

* `QuestionAttemptEvent`
* `PlayerQuestionDailyExposure`
* `QuestionStatsProjection`
* `CategoryStatsProjection`

Optional reset:

* `PlayerQuestionExposure`, only when same-player anti-repeat memory should
  restart

Do not reset questions, categories, users, guest profiles, preferences, economy
ledgers, Daily Wheel/Daily Quest rows, leaderboard, score, or level progress.

---

# 15. Economy / Idempotency Model

Diamond balance:

* `User.diamonds`

Diamond ledger:

* `DiamondTransaction`

Daily Wheel:

* entity: `DailyWheelSpin`
* function: `claimDailyWheelReward`
* status function: `getDailyWheelStatus`
* grants server-selected Diamonds, approved Solo jokers, or Gift Box rewards
  only
* grants no Kronox Puan
* no leaderboard impact
* separate from Daily Quest
* completed guests use token-proven `GuestProfile` and `GuestProfile.diamonds`
  before linking
* approved joker portions write `JokerTransaction.reason = daily_wheel` and
  update `UserJokerInventory`; Gift Box package contents are stored on
  `DailyWheelSpin`

Daily Calendar / Streak:

* runtime tasks: 3 `daily_calendar:*` `UserDailyQuestProgress` rows per UTC day
* template cycle: 9-day rotating code-owned cycle
* progress: real-event-based and idempotent
* claim function: `claimDailyQuestReward`
* ledger source: `daily_calendar_streak_reward`
* 7-day streak reward: exactly 200 Diamonds
* grants no Kronox Puan
* no leaderboard impact
* separate from Daily Wheel
* legacy cleanup: `cleanupLegacyDailyQuests` dry-run first
* completed guests use token-proven `GuestProfile` and `GuestProfile.diamonds`
  before linking
* stale/duplicate `DailyQuestDefinition` rows are ignored by runtime and not
  created on app/Home open

Current hardening:

* `DiamondTransaction` has function-level idempotency
* active Diamond writers re-check before create and confirm after create by
  `idempotency_key`
* `DailyWheelSpin` has function-level same-day guard
* Daily Wheel re-checks canonical same-player/same-day spin, User/GuestProfile
  guard, and DiamondTransaction before balance mutation

Not repo-proven:

* DB/entity unique constraint for `DiamondTransaction.idempotency_key`
* DB/entity unique constraint for `DailyWheelSpin.idempotency_key`
* DB/entity unique constraint for `DailyWheelSpin.user_email + spin_date`
* atomic/upsert guarantee

Risk classification:

* DB/entity unique plus function-level guard = Low
* function-level guard only = Medium / P1 hardening
* neither = High

---

# 16. Leaderboard Model

Visible leaderboard score:

* unified `Kronox Puan`

Projection:

* `SoloLeaderboardEntry`

The entity name is historical. Current visible `total_kronox_score` is the
public-safe unified score projection, not a promise that only Solo exists.

User summary:

* `User.kronox_puan_total`

Public identity:

* username-only safe public name
* opaque `leaderboard_id` in public responses
* no email
* no provider ID
* no raw guest ID
* no `owner_key`
* no public `display_name` field
* completed guests can open Liderlik and appear only through username-safe
  public rows

Daily Quest and Daily Wheel do not affect leaderboard.

---

# 17. Security / Public Functions

Admin authority:

* `AdminUser`
* normalized email
* active status
* `owner` or `admin` role

Forbidden authorization:

* hardcoded admin emails
* request-body role trust
* client-side UI hiding as proof

Public by explicit design:

* `createGuestProfile`
* `getCategoryMetadata`

Repo-proven Base44 function manifest format:

* `function.jsonc` files currently declare only `name` and `entry`
* no supported repo example exists for `requireAuth`, `authRequired`,
  `allowUnauthenticated`, `public`, `auth`, or `permissions`
* auth is enforced in `entry.ts`: public-by-design functions are narrow,
  user-owned functions call `base44.auth.me()`, and admin-only functions use
  inline `AdminUser` guards
* configured `function.jsonc` manifests are the platform-published source in
  this repo; extra `entry.ts` directories are compile-checked but need matching
  manifest/deploy proof before being classified as published callables

Admin route UX guard:

* `/admin` waits for AuthContext and AdminUser status before mounting AdminPage
* non-admin/anonymous users are redirected without an admin-tool flash
* this is not security proof; server-side AdminUser guards remain mandatory

`createGuestProfile` public boundary:

* may create app-owned guest identity
* must not trust request-body role/progress/economy/admin fields
* must store token hash, not raw token

`getCategoryMetadata` public boundary:

* metadata-only
* no question bank
* no answer years
* no user data
* no stale hardcoded fallback arrays

VAPID:

* `VAPID_PRIVATE_KEY` is server-side env/secret only
* no `VITE_` private-key fallback
* no logging/returning key material

Account deletion:

* visible/scoped/confirmed
* user-owned destructive path
* retained rows must not expose deleted identity

---

# 18. Health Center Architecture

Health Center is static/simulated release-risk proof.

Status model:

* `PASS` = limited simulated/static contract verified
* `FAIL` / `ERROR` = blocker until fixed
* `WARNING` = automated/static review risk
* `NOT_AUTOMATABLE` / manual required = human/device/platform proof

Manual required does not reduce automated score like a failure, but critical
manual gates can keep `releaseReady=false`.

Report actions:

* Copy Blocker JSON
* Copy Warning JSON
* Download JSON
* Copy Summary
* Last Run uses newest completed report

Static Health cannot prove:

* real-device drag/drop
* low-end Android smoothness
* two-account Online
* RLS/BOLA behavior
* Base44 production deployment
* push delivery
* native wrapper quality

---

# 19. Public Asset Contracts

Public assets must not contain:

* secrets
* tokens
* VAPID private key
* question bank
* answer years
* internal player IDs
* raw guest IDs/tokens
* provider IDs
* private user data

Public category/question media assets must stay public-safe and must not become
an alternate source for protected gameplay data.

Icon/native wrapper assets:

* PWA/web icons may be separate from native iOS assets
* iOS AppIcon sources must be opaque/no-alpha before App Store upload
* final exported IPA/native wrapper proof remains manual

---

# 20. Deployment / Runtime Parity

Local validation:

* `git diff --check`
* `npm run lint`
* `npm run build`
* `npm run check:base44-functions` when available

What local validation does not prove:

* Base44 function Save & Deploy
* live function marker/runtime parity
* AdminUser/RLS behavior in production
* push/VAPID delivery
* real-device safe-area/notch behavior
* App Store / Play Console native wrapper results

Function changes require live Base44 deployment proof. Editing local source,
mirrors, or docs is not proof that the deployed function changed.

PDF artifacts:

* Uploaded `kronox-teknik-dokuman.pdf` is a stale Codex040-era reference.
* Uploaded `kronox-is-akisi.pdf` is a stale Codex040-era reference.
* Current truth is markdown/source plus current code and Health contracts.
* If PDF deliverables are required, regenerate them from current source through
  an explicit safe PDF workflow; do not manually patch old PDFs.

---

# 21. Known Manual Gates / P1 Hardening Items

Manual proof required:

* two-account invite/lobby/start/gameplay/scoring
* RLS/BOLA for user-owned data
* `createGuestProfile` abuse/throttle monitoring
* guest token write protection
* account-link duplicate/wrong-token/relink prevention
* category metadata public boundary
* Online category sorting and stale fallback absence after deploy
* first Solo tutorial timing and gestures on device
* real-device drag/drop and horizontal timeline scroll
* low-end Android blur/glow smoothness
* push/VAPID production secrets and delivery
* account deletion against a safe test account
* final iOS/Android wrapper/icon validation
* Base44 function deployment/runtime markers
* Diamond/Daily Wheel parallel idempotency race probes
* DB/entity unique constraints where the platform supports them
* question analytics email delivery and Gmail rendering

Legacy/stale contracts that must stay removed or explicitly marked legacy:

* `HATA` as visible Solo scoring source
* `display_name` / `Görünen Ad` as current public profile field or public
  leaderboard response field
* old standalone tutorial
* login-first onboarding
* Home login buttons
* hardcoded Chronicle / Flashback / Viral / Arena / Level Up fallbacks
* minimum 5 category preference rule
* current SubCategory preference UI
* full question bank client exposure
* raw `Question.list` gameplay fallback
* Daily Quest giving Kronox Puan
* Daily Quest leaderboard impact
* Online using Solo preferences
* repo-proven DB unique constraints for economy idempotency
