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
