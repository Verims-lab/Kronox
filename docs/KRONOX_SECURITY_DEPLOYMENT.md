# Kronox Security Deployment Notes

## Purpose

This document defines Kronox security and deployment rules related to secrets, admin authorization, question-bank access, push notifications, and external integrations.

Security rules must be enforced server-side where applicable.

Client-side UI gating is not enough for protected operations.

---

# 1. External Integrations

## Spotify

Kronox does not currently use Spotify.

Legacy Spotify integration has been removed.

Removed/disabled areas include:

* legacy music-question provider search helper
* legacy music-question population helper
* legacy music-question load helper
* legacy music-question seed helper tied to provider workflow

Rules:

* do not reintroduce Spotify code without product approval
* do not commit Spotify credentials
* if any Spotify client ID/secret was ever exposed, rotate/revoke it in Spotify Developer Dashboard
* removing code from the repo does not invalidate already exposed credentials

---

# 2. Web Push Secrets

Game invite push delivery is best-effort.

In-app invite persistence does not depend on push being configured.

Configure these server secrets in Base44/production:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Compatibility names may also be supported:

```text
KRONOX_VAPID_PUBLIC_KEY
KRONOX_VAPID_PRIVATE_KEY
KRONOX_VAPID_SUBJECT
```

Configure this public client build value for browser subscription:

```text
VITE_KRONOX_VAPID_PUBLIC_KEY
```

The backend push sender must read only the non-`VITE_` server names above.
`VITE_` VAPID values are client-exposed by Vite and must never be used as
backend VAPID private-key fallbacks.

Rules:

* never commit the VAPID private key
* rotate VAPID keys if exposure is suspected
* deploy secrets through the secret manager
* reading `VAPID_PRIVATE_KEY` from backend environment/secret storage is the
  required secure practice; scanner findings that only identify the env var
  name are deployment-secret management notes, not source-code exposure
* `VAPID_PRIVATE_KEY` is server-only and must never be logged, returned, sent to
  the client, exposed through `VITE_`, or included in raw error/stack responses
* VAPID public key, private key, and subject are all required backend config
* `VAPID_PUBLIC_KEY` is public by design for browser subscriptions, but it
  should still be deployment/config managed rather than hardcoded in source
* `VAPID_SUBJECT` is deployment-controlled metadata and must be a valid
  configured contact subject, not a source fallback; it may contain contact
  metadata and should not be logged unnecessarily
* `VAPID_SUBJECT` should use a `mailto:` or `https://` subject; VAPID key
  values must be non-empty base64url-style deployment values
* missing, blank, whitespace-only, or placeholder VAPID config must fail
  explicitly as push-not-configured
* no empty-string, dummy, hardcoded, or client `VITE_` fallback is allowed for
  backend push sending
* the VAPID private key value must never be logged, returned in API responses,
  printed in Health reports, or exposed through frontend `VITE_` variables
* safe push-skip diagnostics may return `vapid_config_missing`,
  `missing_vapid_config`, `pushSent: false`, `pushSkipped: true`,
  `missingConfig: true`, `skippedReasons`, `failedReasons`,
  `subscriptionCount`, and counts, but never VAPID values or private-key
  material
* missing VAPID config must not break in-app invite flow
* `npm run build` validates the frontend bundle only; it does not prove backend
  VAPID secrets are configured in deployment
* real push delivery requires a subscribed device plus deployed backend secrets

If VAPID config is missing:

```text
sendGameInvitePush -> vapid_config_missing / missing_vapid_config
```

The following must still work without push:

* persisted GameInvite
* header notification
* Online pending invite list
* invite accept flow

---

# 3. Admin Authorization

Current source of truth:

* Backend admin authority is the `AdminUser` entity.
* Shared backend guard: `base44/functions/_shared/adminAuth.ts`, preferred
  wherever the Base44 function deployment supports it.
* Base44 callable/flat functions may inline the same AdminUser-backed guard
  only when local shared imports are known to break deployment. This is a
  runtime deployability exception, not a security exception.
* A caller is admin only when their authenticated email matches an
  `AdminUser.email` row with `status === "active"` and `role` of `owner` or
  `admin`.
* Inline guards must enforce the same normalized email, active status, and
  `owner`/`admin` role contract. Hardcoded admin allowlists are forbidden.
* Admin email allowlists are not read from environment variables for
  authorization. Legacy admin email env allowlists must not be used as admin
  authorization secrets.
* To add new admins, create `AdminUser` rows manually in Base44 Data or through
  future admin-only tooling. Required row shape: normalized lowercase `email`,
  `role: "admin"`, `status: "active"`.
* Bootstrap is manual: the project owner must create the first `owner`/`admin`
  row in Base44 Data. There is no unsafe "if no admin exists, everyone is admin" fallback.

Client-side admin UI gating may use:

```text
isAdminUser(user)
```

The authenticated app must first enrich the current user through the
backend-only current-user admin status check: `getAdminStatus`. The
`getQuestions` question projection endpoint must never be used as an admin
status source. The client must not query or list `AdminUser` rows directly.
Runtime proof must verify the app is not pinned to a stale Base44
`functions_version` that predates the `getAdminStatus` function. The client
does not pass `functionsVersion` into `createClient`, and app bootstrap clears
the stale `base44_functions_version` browser value before function calls.
Callable paths: deployed root function `functions/getAdminStatus.js`, plus
the Base44 mirror `base44/functions/getAdminStatus/entry.ts` with
`base44/functions/getAdminStatus/function.jsonc` (`name: "getAdminStatus"`,
`entry: "entry.ts"`). Frontend invocation is
`base44.functions.invoke("getAdminStatus", {})`.

Accepted admin indicators:

* `role === "admin"`
* `is_admin === true`
* `permissions` containing `admin`

Backend admin-only functions must still enforce authorization server-side with
the shared AdminUser guard.

Question loading / offline fallback:

* gameplay question content remains protected behind the backend `getQuestions`
  projection; guests/normal users receive only the public-safe minimal runtime
  projection, while admin/full-bank diagnostics require active AdminUser
  owner/admin authorization
* Game startup must attempt online question fetch when the browser is online or
  network state is unknown
* empty local question cache alone is not an offline condition
* stale question cache is versioned and invalidated after question-set/runtime
  changes
* the offline/no-cache screen is reserved for known offline state or failed
  online fetch with no usable cache; retry re-fetches online and does not
  require back navigation

Rules:

* do not commit personal admin emails to source code
* do not use env-based admin email allowlists for authorization
* keep `AdminUser` rows private/admin-only
* never rely only on client-side admin UI visibility
* unauthenticated admin-only calls should return 401
* authenticated non-admin admin-only calls should return 403
* disabled `AdminUser` rows must receive 403
* the Question Analytics Report can be triggered by any active `AdminUser`
  with role `admin` or `owner`; it is sent to the requesting authenticated
  admin's normalized email by default
* the report recipient must not be hardcoded, must not come from `created_by`,
  and mismatched recipient overrides are rejected server-side
* the report trigger returns only admin-safe diagnostics such as `requestedBy`,
  `recipientEmail`, template version, and email dispatch status; it must not
  return report body content, secrets, or stack traces

Daily Quest Definition management:

* Profile / `Admin Ekranı` may show `Günlük Görev Yönetimi` only after
  the current user is enriched by `getAdminStatus` as active `AdminUser`
  `owner`/`admin`
* definition writes go through `createDailyQuestDefinition`, a Base44 callable
  with an inline AdminUser-backed guard so flat function deployment does not
  depend on a local shared import
* normal users and disabled/passive admins must receive 401/403 before list,
  seed, create, or status updates
* no hardcoded admin email allowlists are allowed
* admin-entered `title` and `description` are display-only; free text, AI/NLP,
  regex, or scripts must never become executable quest logic
* only supported `quest_type` enum values plus `target_value` define runtime
  progress logic
* rewards are Diamonds only; Daily Quest definitions must not grant Kronox
  Puan and must not affect leaderboard
* Daily Quest Runtime v1 grants diamonds only through `claimDailyQuestReward`
  and `DiamondTransaction.source = daily_quest_reward`
* Daily Quest does not grant Kronox Puan and has no leaderboard impact
* Home `getDailyQuestStatus` ensures 1 selected `UserDailyQuestProgress` row
  per UTC day and may seed fixed default `DailyQuestDefinition` templates only
  when the definition table is empty. This idempotent seed does not grant
  Diamonds.
* `getDailyQuestStatus` is authenticated runtime, not admin-only; it derives
  the user from backend auth context, writes only that user's progress rows,
  and treats no active definitions as a safe empty state.
* Loading or ensuring today’s quests does not grant Diamonds;
  `claimDailyQuestReward` remains the only reward path.
* Completing progress alone does not grant Diamonds; completed and unclaimed
  quests expose an `Al` claim action.
* User-facing Daily Quest copy is
  `Günlük Görevleri Yap, Elmasları Kazan!`; the security contract remains
  Diamonds-only, no Kronox Puan, and no leaderboard impact.
* Successful `claimDailyQuestReward` writes `daily_quest_reward`, updates
  visible `User.diamonds`, returns `diamondBalanceAfter`, and only then marks
  the progress row claimed.
* Daily Quest runtime functions explicitly bind `UserDailyQuestProgress` for
  status, progress, and claim; `claimDailyQuestReward` must not fall back to a
  missing progress entity registry or expose raw HTTP 500 text to users.
* `daily_quest_last_claim_date` and `daily_quest_next_available_at` are
  active summary/availability fields; duplicate-claim prevention is enforced
  by `UserDailyQuestProgress` and `DiamondTransaction` idempotency
* One claim per quest per UTC day is the runtime contract; duplicate claim
  attempts return a safe already-claimed result without another Diamond grant
* `getDailyQuestStatus`, `recordDailyQuestProgress`, and
  `claimDailyQuestReward` derive the user from backend auth context; the client
  cannot choose another user, set reward amount, or grant Kronox Puan

Admin-only maintenance helpers must also fail closed. The legacy one-off
test-account progress reset helper now uses only the centralized AdminUser
authorization guard plus exact target-email confirmation. It must not read a
deployment email allowlist for authorization.

```text
KRONOX_TEST_RESET_EMAILS
TEST_RESET_EMAILS
```

These legacy env vars are deprecated after the AdminUser migration and should
be removed from deployment environments if present. Do not add a normal
user-facing reset button and do not commit personal test-account emails to
source code.

Reusable admin maintenance reset:

```text
POST /adminResetUserProgress
```

Rules:

* requires authenticated admin context server-side
* unauthenticated callers receive 401
* authenticated non-admin callers receive 403
* target email is normalized server-side
* preview mode reads only safe summary values and does not mutate data
* execute mode requires `confirmEmail` to exactly match the normalized target email
* reset never deletes the User account or authentication identity
* reset writes `User.progress_reset_at` so client-side user progress mirrors are invalidated
* admin/target/mode/timestamp/result are recorded in `AdminMaintenanceLog`

Supported modes:

```text
hard_zero
new_player
```

`hard_zero` keeps the account at 0 Diamonds after reset by marking starter
bonus and the current UTC daily reward as already handled. `new_player`
clears those reward guards so the normal app-entry economy bootstrap may
grant starter/daily Diamonds again.

---

# 4. Question Bank Access

Normal gameplay must load questions through authenticated backend access.

Expected function:

```text
POST /getQuestions
```

Security contract:

* unauthenticated callers receive 401
* normal authenticated callers receive only minimal playable projection
* gameplay rows must satisfy `Question.state === "A"`
* passive categories are excluded
* raw full-bank/admin requests require admin authorization
* authenticated non-admin users receive 403 for full-bank/admin access
* client code must not fall back to direct `Question.list` for normal gameplay

Normal gameplay response should include only what gameplay needs.

Do not expose raw admin metadata unnecessarily, such as:

* full tags
* full source metadata
* hidden fields
* raw audit fields
* unpublished/passive rows

Direct `Question` entity read policy should not expose the full question bank to public users.

If direct entity reads are admin-only, keep this documented and enforced.

If platform limitations prevent full enforcement, document the risk and keep it visible in Health/release proof.

---

# 5. Service Role Rules

Service-role functions must be narrow and justified.

Rules:

* authenticate before service-role reads/writes when user context matters
* authorize by role, player, recipient, sender, or owner as needed
* return minimal safe output
* do not return raw DB dumps to normal users
* do not leak service-role debug payloads
* gate debug details behind admin/dev mode if needed
* normal production users must not be able to enable invite/lobby debug
  payload logging with URL parameters or localStorage flags

Functions requiring careful review include:

```text
getQuestions
startLobbyGame
updateLobbyGameState
acceptGameInvite
sendGameInvitePush
getSoloLeaderboard
getDailyWheelStatus
claimDailyWheelReward
seedQuestionCategories
```

`startLobbyGame` must require an authenticated user. Unauthenticated callers
receive 401, authenticated non-host/non-authorized callers receive 403, and
client-provided email/name fields must never override the authenticated
identity. Legacy guest-host start fallback is not part of the current product
contract.

Daily Wheel functions must require authenticated user context. `claimDailyWheelReward`
must select rewards server-side, use the authenticated user's email for the
daily idempotency key, grant Diamonds only, and never grant Kronox Puan.

---

# 6. Account Deletion

Account deletion is a user-owned destructive operation.

Expected function:

```text
POST /deleteAccount
```

Security contract:

* deletion requires an authenticated user
* client-provided email, user id, role, or admin flags are ignored
* service-role cleanup is scoped to the authenticated user's account id/email
* push subscriptions are removed
* pending invites involving the user are cancelled
* friend/friend-request rows involving the user are removed
* public leaderboard rows are removed
* retained economy/scoring audit rows must anonymize the deleted user's identity
* waiting/starting hosted lobbies are cancelled or scrubbed so deleted users do not remain actionable
* raw backend errors must not be exposed to the user

Manual release proof is required with a safe test account. Do not run destructive deletion probes against production accounts.

---

# 7. Backend Error Shape

Backend errors should be safe and structured.

Recommended shapes:

```text
401 unauthenticated
403 forbidden
404 not_found
409 conflict
410 expired
422 invalid_or_insufficient_content
500 internal_error
```

Rules:

* user-facing messages should be Turkish and safe
* raw `error.message` should not be exposed to normal users
* debug details should be gated/redacted
* frontend must recover loading state after error
* retryable errors should be clear

---

# 8. RLS / Ownership Expectations

Protected resources must enforce ownership or participant access.

Required release probes:

* wrong user cannot accept/mutate another user’s GameInvite
* wrong user cannot see/mutate another user’s FriendRequest
* non-player cannot mutate Lobby game state
* user cannot update another user’s PushSubscription
* user cannot read or update another user's `UserCategoryPreference` rows
* normal user cannot fetch raw question-bank metadata
* non-admin cannot call admin-only functions

Static source checks are not enough.

Two-account or three-account runtime probes are required before release.

---

# 9. Security Verification

After deployment, verify:

## External Secrets

* no Spotify helper functions are deployed
* no Spotify credentials are present
* no VAPID private key is committed
* `VAPID_PRIVATE_KEY` exists only as a backend deployment secret/env value;
  env-var-name scanner findings are tracked as deployment-secret management
  notes unless real key material is found in source or logs
* `VAPID_PUBLIC_KEY` is public-by-design for browser subscription and remains
  config-managed
* `VAPID_SUBJECT` is contact/config metadata, is not a cryptographic secret,
  and is not logged or returned unnecessarily
* no personal admin email is committed

## Admin

* unauthenticated admin-only calls return 401
* authenticated non-admin admin-only calls return 403
* authorized admins can still use intended admin tools
* `resetTestAccountProgress` no longer uses `KRONOX_TEST_RESET_EMAILS` or
  `TEST_RESET_EMAILS`; remove those legacy env vars after deploy
* runtime reset proof checks unauthenticated blocked, normal user blocked,
  disabled admin blocked, and active owner/admin allowed only with exact target
  email confirmation
* Profile shows normal users only `Sosyal / Arkadaşlarım` and `Hesap / Ayarlar`
* active `AdminUser` role `owner`/`admin` users additionally see `Admin Ekranı`
* `Admin Ekranı` contains admin-only maintenance/report tools; Settings remains
  normal-user account/help/preferences UI
* BottomNav visible items are `Ana Sayfa`, `Liderlik`, and `Profil`; Online is
  launched from Home through `Online Kapışma`, not exposed as a bottom tab
* direct `/admin` access by normal users is blocked or redirected safely
* newly added admins can access the intended admin tools after active
  `AdminUser` rows are created
* disabled `AdminUser` rows cannot access admin tools
* normal users still cannot access Profile / `Admin Ekranı`, `/test-suite`, Health
  Simulator, admin maintenance functions, or the question analytics report
  trigger by direct route
* admin selection controls may use Kronox bottom-sheet selectors, but UI
  controls are not authorization; backend admin functions must still derive
  the current user from auth and enforce active `AdminUser` owner/admin status
* Admin Ekranı list refresh uses scoped Pull-to-Refresh only after the admin UI
  gate has passed; it must not expose admin maintenance data to normal users
* `simulateOnlineGame` and `runTestSuite` are admin-only backend tools. They
  must call the shared AdminUser guard before any service-role simulation/test
  writes; `user.role`, request-body role fields, hardcoded admin emails, and
  typo role strings such as `en_core_news_sm` are not valid authorization.
* Runtime auth proof for `simulateOnlineGame` must verify unauthenticated,
  normal user, and disabled/passive admin calls are blocked, while active
  `owner`/`admin` AdminUser rows succeed. `npm run build` does not prove this
  deployed backend behavior.

## Questions

* unauthenticated `/getQuestions` returns 401
* authenticated normal user receives minimal playable projection
* normal users cannot fetch raw/full question-bank metadata
* direct entity reads do not expose full question bank

## User Category Preferences

* `UserCategoryPreference` rows are user-scoped Settings data
* normal users can read/update only their own preference rows
* passive `Category.status = P/p` rows are not selectable
* Category preference selection UI is a custom touch selector; raw native
  selects are not required for the targeted Settings surface, and save
  validation remains server/user scoped
* Category preference popup prompts any authenticated user with fewer than 3
  active valid Category preferences, including existing users
* active valid `UserCategoryPreference` count is the popup source of truth
* passive Category rows and passive preference rows do not count toward the
  minimum
* passive or removed Category selections are filtered from UI/save state and
  must not be resaved as active preferences
* There is no maximum selection.
* onboarding/completion profile flags are advisory only and cannot bypass the
  below-3 rule
* completing the popup saves `UserCategoryPreference` rows before marking the
  user profile onboarding flag complete
* users can later change selections under Profile / Settings /
  `İlgi Alanlarım`
* Solo question selection reads current-user active valid Category preferences
  before attempt start and targets 70% selected categories / 30% full eligible
  pool as soft weighting with fallback
* the selected-category 70% lane is not difficulty-1 restricted; the global
  30% lane prefers difficulty 1 from the full eligible pool where possible,
  with safe fallback if difficulty-1 global candidates are insufficient
* Online question selection, `getQuestions`, and analytics do not read
  preferences for question selection
* two-account preference RLS proof remains manual/NOT_AUTOMATABLE
* old `UserSubCategoryPreference` rows are retained but not used by the
  current Settings preference UI

## Invites / Lobby / Push

* wrong user cannot mutate another user’s invite
* wrong user cannot mutate another user’s lobby
* wrong user cannot update another user’s push subscription
* missing VAPID does not break in-app invite flow

## Account Deletion

* authenticated account deletion only deletes/anonymizes the caller's own data
* account deletion clears push subscriptions and cancels pending invites involving the deleted user
* retained score/economy rows no longer contain the deleted user's email
* public `/account-deletion` copy matches the in-app deletion flow

## Privacy Policy

* Public privacy URL is `https://kronoxgame.com/privacy`.
* `/privacy` must load without login, admin status, backend data, or redirect.
* The policy is Turkish-first, titled `Gizlilik Politikası`, includes a
  last-updated date and support contact, and must disclose account/profile,
  gameplay/progress/leaderboard, friends/invites/social, preferences,
  optional push subscription, local storage/cache, economy/ledger, and question
  analytics/reporting data.
* The policy must state Kronox does not sell personal data for third-party
  advertising and must not claim that no data is collected.
* App Store Connect privacy answers must match the `/privacy` page and must be
  updated when data collection, push notifications, social features, analytics,
  or economy behavior changes.
* Account deletion/access/correction requests may use the in-app deletion flow
  where available or the listed support email.

## Joker Inventory

Joker inventory is user-owned data:

* `UserJokerInventory` stores current balances for `mistake_shield`,
  `card_swap`, and `time_freeze`
* `JokerTransaction` stores the append-only grant/spend ledger
* users may read only their own balances; other-user reads/mutations require
  runtime two-account proof
* starter grants are created by `ensureUserJokerInventory` using authenticated
  user context and per-joker idempotency keys
* missing or partial `UserJokerInventory` rows self-heal for authenticated
  users; repair preserves existing balances, normalizes owner email, and uses
  latest `JokerTransaction.balance_after` when rows must be reconstructed
* duplicate, unknown, or malformed inventory rows must not expose raw errors or
  crash Profile/Solo `Joker Çantası` loading
* Solo joker usage is spent by `spendUserJoker` using authenticated user
  context, positive-balance validation, `solo_use` ledger rows, and
  idempotency keys
* Mağaza Phase 1 purchases use `purchaseJokerWithDiamonds`; users purchase
  only for themselves, the backend owns the trusted joker price table, and
  sufficient Diamonds are validated server-side
* successful Mağaza purchases write both `DiamondTransaction` and
  `JokerTransaction` with `market_purchase`; insufficient Diamonds must not
  change balances or write successful purchase ledgers
* `purchaseJokerWithDiamonds` explicitly binds `UserJokerInventory`,
  `DiamondTransaction`, and `JokerTransaction` in the deployed runtime path,
  preferring service role while falling back to authenticated current-user
  entity access for owner-scoped writes
* Mağaza purchases are server-authoritative economy actions: the client is not
  trusted for price, cost, user identity, or target account; service-role writes
  stay scoped to the authenticated user
* Mağaza purchase idempotency keys protect double-tap and retry flows; real
  two-device/backend race proof remains manual unless Base44 uniqueness is
  proven
* Home `Günlük Ödüller` includes Daily Wheel and Daily Quest Runtime v1
  `Günlük Görev`; Daily Quest claims grant diamonds only through
  server-backed, user-bound `claimDailyQuestReward`
* Daily Wheel and Daily Quest rewards use separate guard fields and
  idempotency keys so a quest claim cannot unlock or duplicate a wheel spin:
  `daily_wheel:<email>:<YYYY-MM-DD>` vs
  `daily_quest_reward:<email>:<YYYY-MM-DD>:<quest_key>`
* normal users must not be able to arbitrarily grant themselves jokers
* Profile shows only `Joker Çantası` balances, not ledger rows
* Mağaza Phase 1 must not expose bundles, subscriptions, cosmetics, random
  boxes, ads, external payments, or Online-mode joker purchases

## Admin Maintenance Jobs

Codex183 adds protected maintenance/cleanup backend functions:

```text
expireOldGameInvites
cancelStaleLobbies
expirePushSubscriptions
refreshLeaderboardProjection
aggregateQuestionStats
sendQuestionAnalyticsReportEmail
cleanupAdminMaintenanceLog
spendUserJoker
```

Security contract:

* every job must require authenticated admin/service authorization
* unauthenticated calls return 401
* authenticated non-admin calls return 403
* every job supports `dryRun` and returns a safe summary
* jobs must not expose raw private user rows or secrets in normal responses
* cleanup jobs are status-transition-first and do not hard delete production
  data by default
* job execution is logged to `AdminMaintenanceLog` when not dry-run
* automatic scheduling is a deployment/platform decision and is not enabled by
  repo code alone
* `sendQuestionAnalyticsReportEmail` is manual/admin-triggered only, sends the
  full 9-section question analytics report inside the authenticated admin email
  body, does not send or claim a PDF attachment for now, and must not expose
  user-level surveillance data to normal users. It is registered at
  `base44/functions/sendQuestionAnalyticsReportEmail/entry.ts` with
  `base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc`. This
  callable report function inlines the DB-backed AdminUser guard for the
  current Base44 function runtime. Frontend build success does not prove the
  Base44 backend function was redeployed; live proof must trigger the function
  as an active admin and confirm `templateVersion: nine-section-email-v1`,
  `emailBodyMode: nine_section_email_body`, `reportDeliveryMode:
  email_body_only`, `bodyContainsExactlyRequiredSections: true`,
  `requiredSectionOrderValid: true`, `renderedSectionHeaderCount: 9`,
  `reportBuildMarker: Codex323`, and that the received email body is readable,
  non-empty, and does not mention a PDF attachment. Runtime Projection is a
  diagnostic/admin proof concept and must not be faked in email output; top-shown
  concentration notes must be compared with the Solo-eligible pool before any
  fairness conclusion.
* every active `AdminUser` row with role `admin` or `owner` can request the
  report; the recipient is the requesting admin's authenticated normalized
  email, not a hardcoded owner address or `created_by`
* the function response and Admin Ekranı UI surface safe `requestedBy`,
  `recipientEmail`, `emailDispatchStatus`, template, full-body section, and body
  validation diagnostics so a failed dispatch is not shown as generic success
* sent question analytics reports contain exactly: `Executive Summary`,
  `Kategori Bazında Soru Havuzu`, `Kategori Tercihleri`, `Kategori Bazında
  Gösterim`, `En Çok Gösterilen Sorular`, `Az ya da Hiç Gösterilmeyen Sorular`,
  `En Çok Yanlış Yapılan Sorular`, `Joker Kullanımı Analizi`, and `Oynanma
  Zamanı ve Kullanım Ritmi`; Joker/time sections must be table-based and
  preference/user data stays aggregate-only
* function-based question analytics reset is currently not used because the
  callable reset path was not reliable in the current Base44 setup
* after a question pool replacement, question analytics reset is a manual DB
  maintenance operation: clear `QuestionAttemptEvent` and, if populated, the
  optional manual `aggregateQuestionStats` projection tables
  `QuestionStatsProjection` and `CategoryStatsProjection`. These projection
  tables may be empty because the active 9-section report computes history from
  raw `QuestionAttemptEvent` rows.
* manual question analytics reset must not delete questions, categories,
  subcategories, category preferences, user stats, score/progress/economy rows,
  leaderboard rows, Daily Wheel rows, gameplay records, users, or `AdminUser`
  rows
* question analytics reports must handle stale/deleted question references with
  a diagnostic count, section-level warnings, and bounded tables instead of
  crashing, rendering partially, or producing unbounded email content
* unrelated progress/economy/admin resets retain question analytics rows; the
  manual question analytics DB reset is the explicit maintenance operation for
  clearing the three analytics entities after a question pool replacement
* user-owned `QuestionAttemptEvent` analytics rows must be deleted or
  anonymized during account deletion; retained analytics rows must no longer
  contain the deleted user's email/key

---

# 10. Health Coverage Expectations

Health should cover:

```text
backend_security_health
security_cleanup_health
admin_authorization_hardening
question_schema_preparation_health
no_public_question_bank_fallback
get_questions_requires_auth
get_questions_returns_minimal_projection
service_role_functions_scoped
account_deletion_health
```

Rules:

* do not fake PASS for runtime security
* keep RLS/cross-user probes NOT_AUTOMATABLE unless actually executed
* external scanner findings should be resolved and rechecked
