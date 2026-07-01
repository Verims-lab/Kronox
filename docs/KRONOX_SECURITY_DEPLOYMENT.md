# Kronox Security Deployment Notes

## Purpose

This document defines Kronox security and deployment rules related to secrets, admin authorization, question-bank access, push notifications, and external integrations.

Security rules must be enforced server-side where applicable.

Client-side UI gating is not enough for protected operations.

---

# 0. Object-Level Authorization Rule

Kronox treats object-level authorization as a backend contract.

Rules:

* Every service-role function that touches user-owned data must derive the
  actor from trusted backend auth context.
* The function must scope each object by owner, recipient, participant, host,
  active admin row, or another documented authority field before it returns or
  mutates data.
* Request-body `user`, `email`, `role`, or owner fields are not trusted for
  authorization.
* UI hiding is a convenience only; it is never the authorization boundary.
* Two-account probes remain mandatory for user-owned surfaces such as
  category preferences, friends, invites, lobbies, Daily Quest progress, Daily
  Wheel, Diamond/Joker economy, push subscriptions, and analytics cleanup.

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

## Friend and Online invite delivery privacy

`sendFriendRequest` must validate the current user, resolve email/username
targets server-side, check self/friend/open-pending guards under
`FriendRequestOperationLock`, require deletion of expired outgoing invites
before resend, set `FriendRequest.expires_at` at least 72 hours after creation,
keep open reverse-pending requests actionable through Gelen İstekler,
ignore/expire stale reverse-pending rows, create the `FriendRequest` row first,
and only then attempt email delivery. SendEmail failure is a soft delivery
failure: it must not roll back or delete the pending request. The lock is a
function-level race guard, not DB unique/index proof.

Online non-friend game invites use opaque `target_ref` values in the client.
`createGameInvitesForTargets` resolves those refs backend-side to routable
recipients. Public player-selection, lobby, invite, notification, and push
payloads must use username-safe labels and must not expose target email,
provider IDs, owner keys, raw guest IDs, or internal player keys.

## Base44 SDK alignment

Security Pass 1 pins the frontend `@base44/sdk` dependency exactly at
`0.8.34` and aligns Base44 Deno function imports to
`npm:@base44/sdk@0.8.34`. Do not reintroduce `^` on the frontend SDK package
or older `npm:@base44/sdk@0.8.25` function imports unless a Base44 runtime
compatibility incident requires an explicit documented split.

`@base44/vite-plugin` remains unchanged in this pass; it is build/runtime
tooling, not the SDK auth/entity/function client.

## Markdown and raw HTML

Kronox does not support rendering user/admin/question markdown as raw HTML.
`react-markdown` is not a runtime dependency in Security Pass 1, and
`rehype-raw` must not be added for user/content markdown.

Rules:

* do not render question, admin, user, notification, lobby, invite, or profile
  content with raw HTML
* do not use `dangerouslySetInnerHTML` for user-generated, backend-provided, or
  markdown-provided content
* if static framework code needs generated CSS, prefer a text child and narrow
  identifier/value guards over `dangerouslySetInnerHTML`
* do not add a heavy sanitization dependency unless product scope introduces a
  real markdown feature that cannot be removed

The remaining Base44 `access_token` URL/localStorage pattern is a known
Base44-managed auth pattern. Current mitigation is to remove `access_token`
from the URL immediately, avoid token logging/rendering, and avoid inventing a
custom token store in app code.

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
* Health/security triage must classify env-sourced `VAPID_PRIVATE_KEY`
  deployment verification as `MANUAL_REQUIRED`/warning; it is a blocker only
  if key material is hardcoded, exposed through `VITE_`, logged, returned, or
  included in raw errors
* Required triage wording: `VAPID_PRIVATE_KEY is server-side env/secret sourced.
  Production secret manager verification is MANUAL_REQUIRED.`
* Release operators must verify the Base44 production secret manager/env
  contains the current `VAPID_PRIVATE_KEY`, confirm no default or placeholder
  value is active, and record any rotation/manual proof before release
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
  `missingConfig: true`, `vapidConfigured`, `vapidConfigValid`,
  `skippedReasons`, `failedReasons`,
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
* Inline backend guard: Base44 functions carry the AdminUser-backed guard
  locally because individual function deploy bundles do not reliably include
  shared helper modules.
* Do not import `_shared/adminAuth.ts` from Base44 functions. Shared local
  helpers are a deployability risk, not an authorization source.
* A caller is admin only when their authenticated email matches an
  `AdminUser.email` row with `status === "active"` and `role` of `owner` or
  `admin`.
* Inline guards must enforce normalized email, active status, and
  `owner`/`admin` role. Hardcoded admin allowlists are forbidden.
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
their inline AdminUser guard.

Question loading / offline fallback:

* gameplay question content remains protected behind the backend `getQuestions`
  projection; authenticated normal users receive only the minimal runtime
  projection, while admin/full-bank diagnostics require active AdminUser
  owner/admin authorization; unauthenticated gameplay projection calls return 401
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

Daily Quest runtime and legacy definition management:

* Profile / `Admin Ekranı` must not mount `Günlük Görev Yönetimi`; Daily Quest
  definitions are not added or monitored through app UI.
* Legacy definition writes, if called directly, go through
  `createDailyQuestDefinition`, a Base44 callable with an inline
  AdminUser-backed guard so flat function deployment does not depend on a local
  shared import.
* normal users and disabled/passive admins must receive 401/403 before legacy
  list, seed, create, or status updates.
* no hardcoded admin email allowlists are allowed
* admin-entered `title` and `description` are display-only; free text, AI/NLP,
  regex, or scripts must never become executable quest logic
* current runtime progress logic is the canonical `solo_level_complete` quest
  plus `target_value`.
* `DailyQuestDefinition.quest_key` is the logical unique key for legacy/manual
  cleanup paths. Runtime does not list, seed, or select definition rows; any
  explicit legacy seed/create flow must skip/reject existing keys.
* duplicate definition rows require manual cleanup after backup; runtime and
  legacy management must not auto-delete duplicate DB rows
* rewards are Diamonds only; Daily Quest definitions must not grant Kronox
  Puan and must not affect leaderboard
* Daily Quest Runtime v1 grants diamonds only through `claimDailyQuestReward`
  and `DiamondTransaction.source = daily_quest_reward`
* Daily Quest does not grant Kronox Puan and has no leaderboard impact
* Daily Quest does not affect leaderboard
* Home `getDailyQuestStatus` ensures 1 canonical `solo_level_complete`
  `UserDailyQuestProgress` row per UTC day and must not read, create, seed, or
  select active `DailyQuestDefinition` rows. Definition rows are ignored by
  runtime, and loading/ensuring the canonical row does not grant Diamonds.
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

Signed-in normal gameplay must load questions through authenticated backend
access. First-time guests may start Solo only through the explicit capped
`guest_gameplay_runtime` path.

Expected function:

```text
POST /getQuestions
```

Security contract:

* unauthenticated `gameplay_runtime` callers receive 401
* unauthenticated `guest_gameplay_runtime` callers receive only a small,
  minimal mixed Solo deck from active categories
* normal authenticated callers receive only a bounded minimal server attempt
  candidate buffer, not the full active question universe
* guest callers cannot request diagnostics, full-bank/admin scope, inactive
  rows, or large projection limits
* gameplay rows must satisfy `Question.state === "A"`
* passive categories are excluded
* raw full-bank/admin requests require admin authorization
* authenticated non-admin users receive 403 for full-bank/admin access
* client code must not fall back to direct `Question.list` for normal or guest
  gameplay
* production code must not log request headers, Authorization/Bearer values,
  guest tokens, or raw request bodies; runtime markers are allowed only as
  safe scalar diagnostics

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
```

Base44 function config proof:

* repo `function.jsonc` files currently use the supported `name` + `entry`
  shape only
* no repo-supported `requireAuth`, `authRequired`, `allowUnauthenticated`,
  `public`, `auth`, or `permissions` function declaration format is proven
* do not add invented manifest auth fields; enforce auth in each `entry.ts`
  guard and keep public-by-design functions narrow
* public-by-design: `createGuestProfile`, `getCategoryMetadata`
* guest-token required: guest profile update/progress/category/exposure paths
  including `updateProfileSettings`, Daily Quest/Wheel guest reward paths,
  `getSoloLeaderboard` guest current-row access, `getPlayerQuestionExposureStats`,
  and `recordPlayerQuestionExposure` guest mode
* registered-auth required: `getQuestions` normal gameplay,
  `updateProfileSettings`, `linkGuestAccount`, Mağaza purchases, and registered
  economy/Daily Quest/Wheel functions
* admin-only/internal reporting: AdminUser-guarded report, diagnostic,
  simulation, maintenance, and reset functions
* configured manifests currently present for 22 functions; additional
  `entry.ts` directories are compile-checked but must not be assumed
  platform-published unless a matching `function.jsonc` or Base44 deploy proof
  exists

Configured function auth/public matrix:

| Function | Classification | Authority proof |
| --- | --- | --- |
| `createGuestProfile` | Public by design | Scope-limited guest create/verify, throttle, token hash, no role/body trust. |
| `getCategoryMetadata` | Public by design | Metadata-only active categories; no questions/answers/user data. |
| `getQuestions` | Capped guest gameplay mode + authenticated normal/admin mode | Guest requests forbid diagnostics/full bank; normal gameplay requires auth; diagnostics/full bank require AdminUser. |
| `getPlayerQuestionExposureStats` | Guest-token or authenticated user | Guest path verifies `guest_id + guest_token`; auth path derives user from `base44.auth.me()`. |
| `recordPlayerQuestionExposure` | Guest-token or authenticated user | Same player proof model as exposure stats; no request-body identity trust. |
| `updateProfileSettings` | Guest-token or authenticated user | Guest path verifies token; auth path derives current user. |
| `linkGuestAccount` | Authenticated user + guest-token | Auth user from `base44.auth.me()` and guest ownership from token hash. |
| `sendFriendRequest` | Authenticated user | Current user from `base44.auth.me()`; email or username target is resolved server-side, self/open-pending/expired-outgoing guards run under `FriendRequestOperationLock`, new rows get 72-hour `expires_at`, creates `FriendRequest` only through the backend service/admin path, and username add responses return username-safe labels without target email. |
| `updatePlayerPresence` | Authenticated user | Current user from `base44.auth.me()`; request body cannot mark another actor online; rows store anonymized owner_key_hash plus backend-private user_email for invite routing, never returned by public presence/selection responses. |
| `getFriendPresence` | Authenticated accepted-friend lookup | Current user from `base44.auth.me()`; response is restricted to accepted FriendRequest relationships and returns username-safe presence rows plus safe avatar fields only. |
| `getOnlinePlayerSelection` | Authenticated player selection lookup | Current user from `base44.auth.me()`; returns online friends, fresh online non-friends, and offline friends as username + opaque target_ref plus safe avatar fields only; excludes current user and unroutable rows. |
| `createGameInvitesForTargets` | Authenticated lobby host | Current user from `base44.auth.me()` and `Lobby.host_email`; opaque target refs resolve backend-side only when accepted friend or fresh online presence; creates `GameInvite` only through the backend service/admin path; response returns invite ids for push/open operations, not recipient email. |
| `getSoloLeaderboard` | Authenticated user or completed guest-token | Public-safe rows only; guest path verifies token and strips owner_key/raw guest_id/display_name while allowing safe avatar fields. |
| `getAdminStatus` | Authenticated status check | Uses current authenticated email and AdminUser row; normal users receive non-admin status. |
| `ensureUserJokerInventory` | Authenticated user | Current user from `base44.auth.me()`. |
| `spendUserJoker` | Authenticated user | Current user from `base44.auth.me()`, Solo joker context enforced. |
| `purchaseJokerWithDiamonds` | Authenticated user | Current user from `base44.auth.me()`, backend price and balance checks. |
| `getDailyWheelStatus` | Authenticated user or completed guest-token | Same player proof model; no reward grant during status read. |
| `claimDailyWheelReward` | Authenticated user or completed guest-token | Same player proof model; server reward selection and once-per-UTC-day idempotency. |
| `getDailyQuestStatus` | Authenticated user or completed guest-token | Auth path uses `base44.auth.me()`; guest path verifies `guest_id + guest_token` and completed GuestProfile. |
| `recordDailyQuestProgress` | Authenticated user or completed guest-token | Same player proof model; Solo-only progress event. |
| `claimDailyQuestReward` | Authenticated user or completed guest-token | Same player proof model; reward amount from stored quest progress. |
| `createDailyQuestDefinition` | Admin-only | Inline AdminUser active owner/admin guard. |
| `diagnoseSoloQuestionStartQuery` | Admin-only diagnostic | Inline AdminUser active owner/admin guard. |
| `sendQuestionAnalyticsReportEmail` | Admin-only reporting | Inline AdminUser active owner/admin guard, email-body-only output. |

Frontend route guards are UX only. `/admin` waits for AuthContext plus
`getAdminStatus`/AdminUser status before mounting `AdminPage`, and redirects
non-admins without flashing admin tools. Backend AdminUser guards remain the
security boundary for every admin/report/maintenance callable.

Dependency cleanup result:

* removed unused direct dependencies after source/dynamic-import search:
  `@stripe/react-stripe-js`, `@stripe/stripe-js`, `three`, `react-leaflet`,
  `react-quill`, `moment`, `jspdf`, `html2canvas`, and `lodash`
* retained `recharts` and `embla-carousel-react` because local UI primitives
  import them directly
* package-lock changes must remain committed with package.json changes

`startLobbyGame` must require an authenticated user. Unauthenticated callers
receive 401, authenticated non-host/non-authorized callers receive 403, and
client-provided email/name fields must never override the authenticated
identity. Legacy guest-host start fallback is not part of the current product
contract.

Daily Wheel functions must require authenticated user context or token-proven
completed GuestProfile context. `claimDailyWheelReward` must select rewards
server-side, use the derived player key for the daily idempotency key, grant
Diamonds only, and never grant Kronox Puan. Before mutating `User.diamonds` or
`GuestProfile.diamonds`, the claim path must check existing same-day
`DailyWheelSpin` rows by `idempotency_key` and `user_email + spin_date`,
reserve a spin row, re-read the canonical same-player/same-UTC-day spin,
re-check the User/GuestProfile guard, and re-check
`DiamondTransaction.idempotency_key`. This is a function-level guard, not a DB
atomic upsert; parallel two-device proof remains manual unless Base44 unique
constraints are configured.

`DailyWheelSpin`, `GameInvite`, and `FriendRequest` direct client create is not
part of the secure product contract. Their RLS `create` rules must allow only
admin/service-role writes; callers must use `claimDailyWheelReward`,
`linkGuestAccount`, `createGameInvitesForTargets`, or `sendFriendRequest` so
the backend derives the actor, validates guest-token proof where applicable,
and returns only privacy-safe response shapes.

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
* normal client cannot directly create DailyWheelSpin, GameInvite, or
  FriendRequest rows; backend service/admin functions own these creates
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
* Profile shows normal users screen-navigation rows for `Profil Bilgileri`,
  `Arkadaşlarım`, and `Ayarlar`; privacy/account-deletion actions live under
  Settings
* active `AdminUser` role `owner`/`admin` users additionally see `Admin Ekranı`
* `Admin Ekranı` contains admin-only maintenance/report tools; Settings remains
  normal-user account/security UI
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
  must call the inline AdminUser guard before any service-role simulation/test
  writes; `user.role`, request-body role fields, hardcoded admin emails, and
  typo role strings such as `en_core_news_sm` are not valid authorization.
* Runtime auth proof for `simulateOnlineGame` must verify unauthenticated,
  normal user, and disabled/passive admin calls are blocked, while active
  `owner`/`admin` AdminUser rows succeed. `npm run build` does not prove this
  deployed backend behavior.

## Questions

* unauthenticated `/getQuestions` `gameplay_runtime` returns 401
* unauthenticated `/getQuestions` `guest_gameplay_runtime` returns only a
  capped minimal mixed Solo deck
* authenticated normal user receives a bounded minimal server attempt candidate
  buffer
* normal users cannot fetch raw/full question-bank metadata
* direct entity reads do not expose full question bank

## User Category Preferences

* `UserCategoryPreference` rows are user-scoped Profile Info data
* normal users can read/update only their own preference rows
* passive `Category.status = P/p` rows are not selectable
* Category preference selection UI is a custom touch selector; raw native
  selects are not required for the targeted Profile Info surface, and save
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
* users can later change selections under Profile > Profil Bilgileri >
  `Kategori seçimi`
* first-time guest onboarding can load category-selection metadata without
  login; the allowed surface is current `Category` id/name/description/status
  metadata from entity read or `getCategoryMetadata`, never raw `Question.list`,
  full question rows, or stale hardcoded seed category fallbacks
* `getCategoryMetadata` is public by design for unauthenticated guest category
  selection. Its response scope is metadata-only: `category_id`, `name`,
  `description`, and normalized active `status`. It must not return questions,
  answers, years, full question-bank rows, user data, admin/internal fields,
  hidden notes, deleted/passive categories, or stale hardcoded seed arrays.
  Category preference writes remain separate and still require
  `guest_id + guest_token` ownership proof.
* guest onboarding category save uses the token-proven `GuestProfile`
  `guest_id + guest_token` path and stores `selected_category_ids`; `guest_id`
  alone is not sufficient
* after a successful guest category save, the server/client state must mark
  `category_setup_status = completed` and
  `onboarding_status = onboarding_complete`, and the client routes to `Ana
  Sayfa`. A completed or safely repairable completed category/profile state on
  restart must not route back to an empty onboarding shell.
* Solo question selection reads current-user active valid Category preferences
  before attempt start and targets 70% selected categories / 30% full eligible
  pool as soft weighting with fallback
* Authenticated users with no saved preferences or empty preferences use all
  active categories for Solo; missing authentication uses the explicit capped
  guest Solo projection and must not expose raw questions
* authenticated `getQuestions` remains required for normal gameplay, the guest
  mode is small/minimal/no-diagnostics, and raw `Question.list` gameplay
  fallback is not allowed
* the selected-category 70% lane uses selected user categories with difficulty
  1 and 2 eligible; the global 30% lane first uses all active categories with
  difficulty 1, then selected-category shortage or global difficulty-1
  shortage fills from the broader active global pool before clean failure
* Online question selection, `getQuestions`, and analytics do not read
  preferences for question selection
* Online game start uses the authenticated `startLobbyGame` path, not Solo
  `getQuestions`: the function persists a bounded shared `online_question_deck`
  on the Lobby before clients enter gameplay. The deck is selected 100% from
  the lobby's selected active categories, allows difficulty 1 and 2 only, and
  participants must read the same persisted deck/current question. `updateLobbyGameState`
  must reject next-question IDs outside that shared deck when the deck exists.
  Online selected categories are live `Category.category_id` values from
  current metadata; missing/invalid selections or Category read failures must
  not fall back to legacy category names, `Lobby.category`, or hardcoded seeded
  category arrays.
* two-account preference RLS proof remains manual/NOT_AUTOMATABLE
* old `UserSubCategoryPreference` rows are retained but not used by the
  current Profile Info preference UI

## Invites / Lobby / Push

* wrong user cannot mutate another user’s invite
* wrong user cannot mutate another user’s lobby
* wrong user cannot update another user’s push subscription
* missing VAPID does not break in-app invite flow
* friend/game invite notification UI uses public username labels only and must
  not fall back to email, provider ids, owner keys, raw guest ids, or internal
  player keys
* valid pending friend/game invite notifications survive transient empty
  refreshes and close only on explicit user action, terminal status, expiry, or
  confirmed source invalidation

## Account Deletion

* authenticated account deletion only deletes/anonymizes the caller's own data
* account deletion clears push subscriptions and cancels pending invites involving the deleted user
* retained score/economy rows no longer contain the deleted user's email
* public `/account-deletion` copy matches the in-app deletion flow

## Privacy Policy

* Public privacy URL is `https://kronoxgame.com/privacy`.
* `/privacy` must load without login, admin status, backend data, or redirect.
* Static route contract: /privacy must be publicly accessible without login.
* The policy is Turkish-first, titled `Gizlilik Politikası`, includes a
  last-updated date and configured support contact, and must disclose
  account/profile, gameplay/progress/leaderboard, friends/invites/social,
  preferences, optional push subscription, local storage/cache, economy/ledger,
  and question analytics/reporting data.
* Public support contact email is supplied by `VITE_KRONOX_SUPPORT_EMAIL`.
  Do not commit personal/admin/support email literals in privacy, account
  deletion, or diagnostic code. If the env value is missing, public pages must
  show safe configured-contact copy without exposing an email literal.
* The policy must state Kronox does not sell personal data for third-party
  advertising and must not claim that no data is collected.
* App Store Connect privacy answers must match the `/privacy` page and must be
  updated when data collection, push notifications, social features, analytics,
  or economy behavior changes.
* App Store Guideline 4.8: when third-party login is offered, the Profile login
  surface must expose `Sign in with Apple` / `Apple ile devam et` through
  Base44 auth alongside Google. Base44 Settings → Authentication → Apple toggle
  is a manual deployment step; no Apple client secret or native credential
  belongs in source.
* Manual Required / P0 release gate: physical Apple parity must be proven on a
  physical iOS/TestFlight/App Store build before iOS/App Store release. `Sign
  in with Apple` must be visible wherever Google login is offered; static repo
  checks are not enough and must not be treated as automated proof.
* Account deletion/access/correction requests may use the in-app deletion flow
  where available or the configured support contact.

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
* DiamondTransaction writers must re-check `user_email + idempotency_key` before
  create and confirm by `idempotency_key` after create. Without a DB/entity
  unique constraint this remains function-level guard only / Medium P1
  hardening, not Low risk.
* Home `Günlük Ödüller` includes Daily Wheel and Daily Quest Runtime v1
  `Günlük Görev`; Daily Quest claims grant diamonds only through
  server-backed, player-bound `claimDailyQuestReward`
* Daily Wheel and Daily Quest rewards use separate guard fields and
  idempotency keys so a quest claim cannot unlock or duplicate a wheel spin:
  `daily_wheel:<playerKey>:<YYYY-MM-DD>` vs
  `daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<quest_key>`
* Daily Wheel remains separate from Daily Quest definitions
* Daily Wheel and Daily Quest are separate
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
  `reportBuildMarker: Codex347`, and that the received email body is readable,
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
  Zamanı ve Kullanım Ritmi`; `Kategori Bazında Soru Havuzu` includes the
  category-based Top 10 answer year/count table without adding a tenth report
  section, Joker/time sections must be table-based, and preference/user data
  stays aggregate-only
* function-based question analytics reset is currently not used because the
  callable reset path was not reliable in the current Base44 setup
* after a question pool replacement, question analytics reset is a manual DB
  maintenance operation: clear `QuestionAttemptEvent`,
  `PlayerQuestionDailyExposure`, and, if populated, the
  optional manual `aggregateQuestionStats` projection tables
  `QuestionStatsProjection` and `CategoryStatsProjection`. These projection
  tables may be empty because the active 9-section report computes history from
  raw `QuestionAttemptEvent` rows.
* clearing `PlayerQuestionExposure` is optional and should only be done when the
  per-player anti-repeat/freshness memory should also restart; it resets the
  system's memory for avoiding the same question for the same player
* manual question analytics reset must not delete questions, categories,
  subcategories, user/guest/player profiles, category preferences, joker
  inventory, joker/diamond ledgers, Daily Wheel/Daily Quest rows, user stats,
  score/progress/economy rows, leaderboard rows, gameplay records, users, or
  `AdminUser` rows
* question analytics reports must handle stale/deleted question references with
  a diagnostic count, section-level warnings, and bounded tables instead of
  crashing, rendering partially, or producing unbounded email content
* unrelated progress/economy/admin resets retain question analytics rows; the
  manual question analytics DB reset is the explicit maintenance operation for
  clearing the analytics/history/projection entities after a question pool
  replacement
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
* Base44 deploy-safety checks are static: `_shared/adminAuth`, `../_shared`,
  and `file:///__shared` imports in critical functions should fail Health, but
  live markers still require Base44 Test Function/deploy proof
* `npm run check:base44-functions` is the pre-deploy static gate for Base44
  function sources. It catches TypeScript syntax/duplicate-declaration blockers,
  deploy-risk `_shared` imports, committed email literals, and missing
  `getQuestions` runtime marker/projection diagnostics before manual Save &
  Deploy.
* Health `Copy Blocker JSON` should export real blocker/failing/static-critical
  items and summary counts only, not manual-only proof reminders or the full raw
  PASS payload
## GuestProfile Security Boundary

Kronox guest identity is app-owned. Do not add Firebase anonymous auth, do not
depend on Base44 anonymous auth, and do not treat local-only ids as trusted
identity.

`createGuestProfile` is the only Phase 1 write/verify path. It generates
`guest_id`, raw guest token, and a public `KronoxUser####` /
`KronoxUser#####` username. The raw guest token is returned to the client once
and stored only on the local device. The database stores only
`guest_token_hash` and `guest_token_hash_algorithm=sha256:kronox_guest_v1`.
The function is public by design because first-open guest onboarding must work
without Google, Apple, email, Firebase anonymous auth, or Base44 anonymous auth.
That public access is allowed only with the hardening controls in the deployed
function: request bodies are size-limited, top-level and patch fields are
allowlisted, guest ids/tokens/usernames are server-generated, and trusted fields
such as role/admin state, linked account fields, token hashes, Diamonds, joker
balances, and direct score totals are rejected rather than copied from public
requests.

Guest creation also writes privacy-safe `GuestCreationThrottle` rows when the
runtime exposes enough request metadata. The throttle source key is a server-side
hash of coarse source metadata plus optional client install id; raw IP, raw
headers, raw guest token, auth headers, provider credentials, and full request
bodies must never be stored. Hour/day buckets are used for bloat monitoring and
rate limiting. If runtime metadata or entity deployment is unavailable, release
proof must record the limitation and manually monitor GuestProfile growth.

`getCategoryMetadata` is the public-by-design category metadata companion for
guest onboarding. It must remain callable without login so new guests can choose
Solo preferences after profile setup, but it is not an authorization boundary
for user data. The function reads the current `Category` source of truth and
returns only active category metadata fields: `category_id`, `name`,
`description`, and `status`. It rejects oversized or unexpected request bodies,
does not read `Question`, does not expose answer/year/full-bank data, does not
return admin/internal fields, and must not fall back to old hardcoded category
names such as Chronicle, Flashback, or Viral unless those names are active rows
in the current category source. If category metadata cannot be loaded, the app
must show a retryable error instead of rendering stale fallback categories.
The old `seedQuestionCategories` deployable seed function has been removed; do
not restore hardcoded category arrays as runtime fallbacks or admin shortcuts.
Category creation/backfill is manual/admin content management against the live
`Category` table followed by runtime proof.

Guest ownership requires `guest_id + raw guest token`; `guest_id` alone must not
authorize reads/writes. Never log raw guest token, auth headers, provider
credentials, or full request bodies. Existing Google / Apple / Email login stays
Base44-managed. Account linking is optional and Profile-only after onboarding;
Home / Ana Sayfa and onboarding completion must not render provider buttons or
progress-link cards. The first-launch welcome may show `Hesabım Var` only as a
route to the Profile account-connection card, without inline provider buttons.
Apple must remain visible wherever Google login is offered.

Onboarding Phase 2 may update only non-sensitive GuestProfile onboarding fields
through the same `guest_id + raw guest token` proof. The server path must allow
only the guided state machine, username setup, optional age/gender, and selected
category IDs. `display_name` is mirrored from username for legacy projections.
It must not trust guest_id alone, request-body role claims, auth-provider IDs,
or client-provided admin state.

Profile > Profil Bilgileri post-onboarding edits use `updateProfileSettings`.
Authenticated users are verified server-side with `base44.auth.me()` and guest
users are verified with `guest_id + raw guest token`. The endpoint enforces
case-insensitive public username uniqueness via `username_normalized`, rejects
email/provider-like public names, and never logs raw guest tokens, auth headers,
provider credentials, or full request bodies. Optional `age_group` and `gender` are
private profile fields and must not be returned in public leaderboard/projection
payloads.

The guided first Solo level is a guest-safe gameplay route. It must not expose
diagnostics/full-bank data and must not spend real `UserJokerInventory` while
teaching the joker concept.

Account linking is implemented by `linkGuestAccount`. It must verify both the
GuestProfile token proof and `base44.auth.me()`, never trust request-body role
or provider ids, use an idempotency key, mark the guest row `linked` once, and
write `AccountLinkTransaction`. The merge path must not log raw guest tokens,
auth headers, provider credentials, or full request bodies.

The only provider-bearing guest account-link CTA is the Profile guest card
(`Misafir olarak oynuyorsun` / `İlerlemeni kaybetmemek için hesabını bağla`)
with Apple, Google, and email options together. The first-launch `Hesabım Var`
entry may route to that Profile card but must not start auth or duplicate
providers inline. Opening Profile must not run the merge by itself; linking
starts only when the user chooses a provider.

The link merge preserves user-beneficial progress, combines additive economy
only once, and copies Daily Wheel/Daily Quest guard fields/history to the
registered owner key so same-day guest rewards cannot be claimed again after
linking. `User.linked_guest_ids` and `AccountLinkTransaction.idempotency_key`
are duplicate guards; `UserJokerInventory` remains the current joker balance
source and `JokerTransaction` remains the immutable ledger.

## Player Question Exposure Privacy Boundary

## Public Identity / Leaderboard Privacy Boundary

Public identity is `username` only. `display_name` is a legacy/internal
projection mirror and must not be used as the public fallback identity for old
rows; it must not be returned as the public leaderboard identity field.
`getSoloLeaderboard` returns sanitized `username`, opaque `leaderboard_id`,
score/rank fields, boolean friend/current-user markers, and safe avatar
metadata (`avatar_type`, `avatar_icon_id`, `avatar_color_id`, `avatar_url`).
It must not return email, provider ids, raw guest id, internal `owner_key`,
internal `player_key`, raw storage metadata, auth IDs, or public
`display_name`. Direct `SoloLeaderboardEntry` entity reads are admin-only in
the repo schema because the projection row stores internal `owner_key`.

## Player Question Exposure Privacy Boundary

`PlayerQuestionExposure` and `PlayerQuestionDailyExposure` are private
projections. They may be read/written only through server-side helpers or admin
maintenance/reporting paths. They store internal `player_key` values and must
never store or return email, provider UID, raw guest id, raw guest token, auth
headers, public username, or leaderboard display name.

Guest exposure writes and reads require `guest_id + raw guest token`
verification against `GuestProfile.guest_token_hash`; `guest_id` alone is not
enough. Authenticated exposure reads/writes use `base44.auth.me()`. Gameplay
treats exposure writes as best-effort and non-blocking.

Question Analytics may include anonymized per-player distinct coverage only as
`User0001` / `User0002` labels scoped to the report period. Reports must not
print `player_key`, `owner_key`, email, provider ids, raw guest id, raw guest
token, or username in that subsection. Production release proof should verify
the projection entities are deployed and RLS/admin access does not make these
rows public.
