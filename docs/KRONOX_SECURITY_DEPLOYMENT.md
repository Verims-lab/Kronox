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

Client-side admin UI gating may use:

```text
isAdminUser(user)
```

Accepted admin indicators:

* `role === "admin"`
* `is_admin === true`
* `permissions` containing `admin`

Backend admin-only functions must still enforce authorization server-side.

Backend guard may also read deployment-secret allowlists:

```text
ADMIN_EMAILS
KRONOX_ADMIN_EMAILS
```

Rules:

* do not commit personal admin emails to source code
* prefer role/permission based admin authorization
* use email allowlists only as deployment fallback
* never rely only on client-side admin UI visibility
* unauthenticated admin-only calls should return 401
* authenticated non-admin admin-only calls should return 403

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
seedQuestionCategories
```

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
