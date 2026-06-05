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

Rules:

* never commit the VAPID private key
* rotate VAPID keys if exposure is suspected
* deploy secrets through the secret manager
* missing VAPID config must not break in-app invite flow

If VAPID config is missing:

```text
sendGameInvitePush -> missing_vapid_config
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
* Shared backend guard: `base44/functions/_shared/adminAuth.ts`.
* A caller is admin only when their authenticated email matches an
  `AdminUser.email` row with `status === "active"` and `role` of `owner` or
  `admin`.
* Admin email allowlists are not read from environment variables for
  authorization. Legacy admin email env allowlists must not be used as admin
  authorization secrets.
* To add new admins, create `AdminUser` rows manually in Base44 Data or through
  future admin-only tooling. Required row shape: normalized lowercase `email`,
  `role: "admin"`, `status: "active"`.
* Bootstrap is manual: the project owner must create the first `owner`/`admin`
  row in Base44 Data. There is no unsafe "if no admin exists, everyone is
  admin" fallback.

Client-side admin UI gating may use:

```text
isAdminUser(user)
```

The authenticated app must first enrich the current user through the
backend-only current-user admin status check. Current deployed route:
`getQuestions` with `action: "admin_status"`; this returns only the current
user's `AdminUser` authorization status and never question rows. The dedicated
`getAdminStatus` function mirror remains in repo, but the deployed platform
route must be verified before switching the frontend to it. The client must
not query or list `AdminUser` rows directly.

Accepted admin indicators:

* `role === "admin"`
* `is_admin === true`
* `permissions` containing `admin`

Backend admin-only functions must still enforce authorization server-side with
the shared AdminUser guard.

Rules:

* do not commit personal admin emails to source code
* do not use env-based admin email allowlists for authorization
* keep `AdminUser` rows private/admin-only
* never rely only on client-side admin UI visibility
* unauthenticated admin-only calls should return 401
* authenticated non-admin admin-only calls should return 403
* disabled `AdminUser` rows must receive 403

Admin-only maintenance helpers must also fail closed. The legacy one-off
test-account progress reset helper requires both admin authorization and a
deployment allowlist:

```text
KRONOX_TEST_RESET_EMAILS
TEST_RESET_EMAILS
```

Use these only for explicitly approved test accounts. Do not add a normal
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
* no personal admin email is committed

## Admin

* unauthenticated admin-only calls return 401
* authenticated non-admin admin-only calls return 403
* authorized admins can still use intended admin tools
* newly added admins can access the intended admin tools after active
  `AdminUser` rows are created
* disabled `AdminUser` rows cannot access admin tools
* normal users still cannot access Settings admin tools, `/test-suite`, Health
  Simulator, admin maintenance functions, or the question analytics report
  trigger by direct route

## Questions

* unauthenticated `/getQuestions` returns 401
* authenticated normal user receives minimal playable projection
* normal users cannot fetch raw/full question-bank metadata
* direct entity reads do not expose full question bank

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
* `sendQuestionAnalyticsReportEmail` is manual/admin-triggered only, sends a
  question-focused aggregate HTML/table/bar formatted report to the
  authenticated admin email, and must not expose user-level surveillance data
  to normal users
* admin reset retains question analytics rows because the report is
  question-focused aggregate data, not a progress/economy balance; identity
  cleanup belongs to account deletion
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
