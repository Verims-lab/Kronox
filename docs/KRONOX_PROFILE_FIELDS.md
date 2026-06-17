# Kronox Profile Fields

Profile displays persisted user/account values and must avoid synthetic economy
placeholders after authentication.

## Economy Surfaces

* `Puan` uses the shared visible Kronox Puan helper.
* `Seviye` uses the same Solo progress helper as the Solo level path.
* `Elmas` uses persisted `User.diamonds` through the shared Diamond display
  helper.
* `Joker Çantası` uses `UserJokerInventory` current balances through
  `getUserJokerBalances`.
* `JokerTransaction` is ledger/audit only and is not a Profile render-time
  balance source.

## Joker Çantası Performance Contract

* Load all three joker balances through the shared helper path.
* Do not run starter/self-heal on every Profile render.
* Missing/partial inventory can trigger idempotent self-heal and then refresh.
* Profile has local Joker loading, safe error, and retry states.
* Mağaza purchase and Solo spend update/invalidate the shared balance cache.
* Logout clears cached joker balances so another user cannot see stale counts.
* Runtime proof remains manual: login, open Profile, confirm fast Joker Çantası
  load, buy/spend a joker, and confirm Profile/Solo counts stay consistent.

## Category Preferences

* `İlgi Alanlarım` remains editable from Profile / Settings for authenticated
  users and persists user-owned `UserCategoryPreference` rows.
* Authenticated users with fewer than 3 active valid Category preferences may
  see the optional personalization popup; it can be deferred and must not block
  normal authenticated Solo gameplay.
* Authenticated users with no saved preferences or empty preferences use all
  active categories for Solo; missing authentication uses the explicit capped
  guest Solo projection and must not expose raw questions.
* Saved preferences are Solo-only soft 70/30 weighting input, not a hard filter.
* The selected-category lane uses difficulty 1 and 2; the global fallback lane
  prefers all-active difficulty 1 and broadens safely if that pool is short.
* Online question selection is not affected by Category preferences.
## GuestProfile Public Identity

Unauthenticated players are represented by app-owned `GuestProfile`, not
Firebase and not Base44 anonymous auth. Public guest identity uses `username` and
`display_name`, initially generated as `KronoxUser####` /
`KronoxUser#####`.

Profile and leaderboard surfaces should prefer `display_name` / `username` for
public identity. Email, Google ID, Apple ID, provider UID, and internal
`owner_key` values are not public display names.

Account linking is implemented through `linkGuestAccount`. Guest users can
choose Apple / Google / Email to secure progress, while "Şimdilik misafir devam
et" remains available. The Profile guest card says the user is playing as guest
and presents account linking as progress protection, not as a mandatory gate.

## Guest Onboarding Phase 2

`GuestProfile.onboarding_status` carries the guided onboarding state machine:
`guest_created`, `tutorial_in_progress`, `tutorial_completed`,
`profile_setup_pending`, `category_setup_pending`, and `onboarding_complete`.

The profile setup step follows the guided first Solo level. It may update
`username`, `display_name`, optional `age`, and optional `gender` through the
token-proven `createGuestProfile` update path.

The category setup step stores optional guest `selected_category_ids`. Fewer
than 3 selections should show guidance, but guest play remains possible. Empty
guest selections mean all active Solo categories are eligible.

## Guest Account Linking Phase 3

`GuestProfile` can be linked once to an authenticated Google / Apple / Email
account. The link path verifies `guest_id + raw guest token` and the
authenticated user, then writes `AccountLinkTransaction` with an idempotency key.

Merge rules are user-benefit oriented:

* public `username` / `display_name` is preserved when safe and unique
* Solo progress keeps the better per-level record
* Online progress keeps user-beneficial counters without duplicate rewards
* `User.kronox_puan_total` keeps the safest higher total projection
* guest category selections become authenticated `UserCategoryPreference` rows
* guest leaderboard projection migrates to the authenticated owner row and the
  old guest row is passivated

Provider ids and email are never public leaderboard identity.
