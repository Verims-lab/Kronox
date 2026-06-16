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
* Online question selection is not affected by Category preferences.
