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
Firebase and not Base44 anonymous auth. Public guest identity uses `username`,
initially generated as `KronoxUser####` / `KronoxUser#####`. The stored
`display_name` field is a legacy/projection mirror of `username`, not a separate
editable profile field.

Profile and leaderboard surfaces must use `username` for public identity.
`display_name` may be stored only as an internal compatibility mirror for old
rows and must not be used as the public fallback identity or returned as the
public leaderboard identity field. Email, Google ID, Apple ID, provider UID,
raw guest id, internal `owner_key`, and internal `player_key` values are not
public display names.

`createGuestProfile` is public by design because unauthenticated players must be
able to start as guests. It still generates `guest_id`, raw guest token, token
hash, and default username server-side; request bodies cannot set trusted
identity, account-link, score/economy, token-hash, role, or admin fields. The
function also records privacy-safe `GuestCreationThrottle` buckets with hashed
source metadata for bloat monitoring; raw IP, raw headers, and raw guest tokens
are not stored in those rows.

## Editable Profile Settings

Profile > Ayarlar includes editable profile fields for both guest and
authenticated users:

* `username`
* optional `age`
* optional `gender`

`updateProfileSettings` is the server-authoritative update path. Authenticated
users are verified with `base44.auth.me()`. Guest users are verified with
`guest_id + raw guest token`; `guest_id` alone is not trusted and raw guest
tokens are never stored server-side.

The UI exposes only `username`; `display_name` is mirrored from that username by
the server so existing projections keep working. Username uniqueness is checked
case-insensitively through
`username_normalized`, with a `KronoxUser####` / `KronoxUser#####` fallback for
missing or provider-like public names. Username changes refresh the existing
`SoloLeaderboardEntry` internal projection mirror when a row exists, and
`getSoloLeaderboard` returns sanitized `username` plus opaque `leaderboard_id`
instead of `display_name` or `owner_key`. `age` and `gender` are private
optional profile fields only; they must not appear in leaderboard rows, public
projections, scoring, matchmaking, Solo category weighting, or Online game
selection.

Account linking is implemented through `linkGuestAccount`. Guest users can
choose Apple / Google / Email from Profile to secure progress. Home / Ana Sayfa
must not render Google, Apple, email, or `Hesabını bağla` / progress-protection
account-link prompts. The Profile guest card says the user is playing as guest,
presents account linking as progress protection, and keeps Apple visible
wherever Google is visible. Guest users can ignore the optional Profile CTA and
continue playing without login.

## Guest Onboarding Phase 2

`GuestProfile.onboarding_status` carries the guided onboarding state machine:
`guest_created`, `tutorial_in_progress`, `tutorial_completed`,
`profile_setup_pending`, `category_setup_pending`, and `onboarding_complete`.
The `Eğitime Devam` resume screen is valid only for a true resumable
`tutorial_in_progress` state: `tutorial_status = in_progress` and no later
profile/category step has been completed. Stale `tutorial_in_progress` values
must not override `tutorial_completed`, `profile_setup_pending`,
`category_setup_pending`, or `onboarding_complete`.

The profile setup step follows the guided first Solo level. It shows only
`username`, optional `age`, and optional `gender`; `display_name` is mirrored
from `username` through the token-proven `createGuestProfile` update path.
The `Kategorilere Geç` action must either advance to `category_setup_pending`
after a successful save or show a visible retryable error; it must not remain in
an indefinite spinner state.

The category setup step stores optional guest `selected_category_ids`. Fewer
than 3 selections should show guidance, but guest play remains possible. Empty
guest selections mean all active Solo categories are eligible. Guest users do
not need Google / Apple / Email login to load or save this step; category
loading uses current safe `Category` metadata directly or through the
`getCategoryMetadata` callable, never raw question-bank reads and never a stale
hardcoded seed fallback. If category metadata cannot be loaded, the UI shows a
retryable error instead of rendering legacy categories.
The category completion CTA label is exactly `Ana Sayfa`. A successful guest
category save writes `category_setup_status = completed` and
`onboarding_status = onboarding_complete`, then routes directly to Ana Sayfa.
Onboarding completion must not show Google / Apple / Email account-link buttons;
guests can later open Profile if they want to secure/link progress.
On app restart, `onboarding_complete` or a safely repairable completed
category/profile state opens Ana Sayfa instead of returning to the blue
onboarding shell.
`getCategoryMetadata` is public by design but metadata-only; it returns
`category_id`, `name`, `description`, and `status` only. Category preference
save remains a separate token-proven GuestProfile write and must not trust
`guest_id` alone.

## Guest Account Linking Phase 3

`GuestProfile` can be linked once to an authenticated Google / Apple / Email
account. The link path verifies `guest_id + raw guest token` and the
authenticated user, then writes `AccountLinkTransaction` with an idempotency key.

Merge rules are user-benefit oriented:

* public `username` is preserved when safe and unique, while `display_name`
  remains a mirrored legacy/internal projection field only
* optional `age` / `gender` are preserved with a user-friendly preference for
  the more recent non-empty profile value
* Solo progress keeps the better per-level record
* Online progress keeps user-beneficial counters without duplicate rewards
* `User.kronox_puan_total` keeps the safest higher total projection
* guest category selections become authenticated `UserCategoryPreference` rows
* guest leaderboard projection migrates to the authenticated owner row and the
  old guest row is passivated

Provider ids and email are never public leaderboard identity.
