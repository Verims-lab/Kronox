# Kronox Diamond Economy Rules

## Purpose

This document defines the Kronox Diamond / Elmas economy contract.

Diamonds are a persisted user-owned balance.

Diamonds are separate from Kronox Puan.

---

# 1. Source Of Truth

Canonical balance field:

```text
User.diamonds
```

Display helper:

```text
getDiamondBalance(user)
```

Existing UI adapter:

```text
getLeaderboardDiamondValue(user)
```

Rules:

* Header, Home, Solo, Online, Profile, and Liderlik Elmas surfaces must agree.
* Diamonds must never be calculated from Kronox Puan.
* Diamonds must never be calculated from Solo stars.
* Diamonds must never be calculated from Solo level.
* Diamonds must never be calculated from Online score.
* Diamonds must never be calculated from leaderboard rank.
* Visible Elmas surfaces must not use placeholder values after authenticated user data is loaded.

---

# 2. Transaction Ledger

`DiamondTransaction` is the economy ledger/audit entity.

Required fields:

```text
user_email
amount
balance_before
balance_after
source
direction
idempotency_key
metadata
created_at
```

Purpose:

* audit balance changes
* protect idempotency
* support future reward sources
* support recovery from partial write states

---

# 3. Active Sources

Current active sources:

```text
starter_bonus
daily_login
daily_wheel
market_purchase
daily_quest_reward
```

Future schema-ready sources are intentionally inactive:

```text
daily_quest_future
rewarded_ad_future
quest_reward_future
purchase_future
achievement_future
special_event_future
```

Daily Quest / Günün Görevi Runtime v1 is active inside the Home `Günlük
Ödüller` panel. `DailyQuestDefinition` templates remain admin-managed and
display-only for title/description; `quest_type + target_value` drives runtime
progress. `UserDailyQuestProgress` stores 1 selected UTC-day quest per user,
with copied target/reward, progress, completion, and claim state.

Daily Quest grants diamonds only through the server-backed
`claimDailyQuestReward` callable. Claims write
`DiamondTransaction.source = daily_quest_reward` with `direction = earn` and an
idempotency key shaped like
`daily_quest_reward:<normalizedEmail>:<YYYY-MM-DD>:<questKey>`. The client must
not control reward amount. Daily Quest does not grant Kronox Puan and has no
leaderboard impact.

Do not implement client-side quest reward diamond grants, Kronox Puan rewards,
Online quest progress, or leaderboard scoring from Daily Quest.

---

# 3A. Daily Reward Wheel / Günlük Çark

Daily Wheel is an active Diamond-only retention reward.

Rules:

* grants Diamonds only
* grants no Kronox Puan
* does not affect leaderboard sorting or rank
* is separate from the existing +20 daily login reward
* claim requires authenticated user
* one claim per user per UTC server day
* reward is selected server-side by `claimDailyWheelReward`
* UI animates to the backend-selected reward
* localStorage/sessionStorage may only hide the once-per-session popup, never grant rewards

Reward table and weights:

```text
30 diamonds — high — weight 24
40 diamonds — high — weight 22
50 diamonds — high — weight 20
60 diamonds — medium — weight 12
75 diamonds — medium — weight 10
100 diamonds — low — weight 7
150 diamonds — rare — weight 4
250 diamonds — very rare — weight 1
```

7-day streak:

```text
7-day streak bonus: +150 diamonds
```

If the user misses a UTC day, the next successful spin resets the streak to 1.

Result copy:

```text
+25 Elmas kazandın
7 günlük seri bonusu: +150 elmas
Toplam: +200 elmas
```

The Home claimed-state countdown must not show a Diamond icon next to the
countdown. Use `Yarın hazır` or compact time text such as `11 sa 24 dk`.

Dedicated spin ledger:

```text
DailyWheelSpin
```

Daily idempotency key:

```text
daily_wheel:<normalizedEmail>:<YYYY-MM-DD>
```

User guard fields:

```text
daily_wheel_last_spin_at
daily_wheel_last_spin_date
daily_wheel_next_available_at
daily_wheel_streak
daily_wheel_spin_count
```

Diamond audit ledger:

```text
DiamondTransaction.source = daily_wheel
```

Concurrency note:

Base44 schema-level uniqueness is not assumed for `DailyWheelSpin.idempotency_key`
or `DiamondTransaction.idempotency_key`. The current backend uses
query-before-write, User guard fields, reserve-first `DailyWheelSpin` rows, and
recovery from existing spin rows. True two-device duplicate-proofing still
requires a live runtime/platform unique-key probe.

---

# 4. Starter Bonus

Amount:

```text
+100 Diamonds
```

Grant timing:

```text
after authenticated user/profile is loaded at app entry
```

Idempotency key:

```text
starter_bonus:<normalizedEmail>
```

Persistent guard:

```text
User.starter_bonus_granted_at
```

Rules:

* grant only once per user
* must not duplicate on refresh
* must not duplicate across devices as far as platform allows
* must create or recover ledger row where possible

---

# 5. Daily Login Reward

Amount:

```text
+20 Diamonds
```

Grant timing:

```text
after authenticated user/profile is loaded on a new day
```

Day boundary:

```text
UTC
```

Daily key format:

```text
YYYY-MM-DD
```

Idempotency key:

```text
daily_login:<normalizedEmail>:<YYYY-MM-DD>
```

Persistent guard:

```text
User.last_daily_diamond_reward_date
```

Rules:

* grant at most once per user per UTC day
* refresh/reopen on same UTC day must not duplicate
* next UTC day may grant again
* must create or recover ledger row where possible

---

# 6. First-Day Total

A brand-new authenticated user can receive both rewards on the same UTC day:

```text
starter bonus = +100
daily login = +20
first-day total = 120
```

First-day total: `120` Diamonds.

Refreshing the app after that must not grant another starter or daily reward.

---

# 7. Grant Flow

The app bootstrap calls:

```text
ensureDiamondEconomyForUser(user)
```

after:

```text
base44.auth.me()
```

resolves.

For each reward:

1. normalize user email with trim/lowercase
2. build source idempotency key
3. check persisted User guard field
4. check `DiamondTransaction` by `user_email + idempotency_key`
5. refresh current user profile before writing
6. update `User.diamonds` and guard field through `base44.auth.updateMe`
7. create `DiamondTransaction` ledger row
8. recover ledger if guard exists but ledger is missing
9. recover guard if ledger exists but guard is missing
10. do not grant again during recovery

---

# 8. Recovery Behavior

If User guard exists but ledger row is missing:

* create a recovery ledger row
* do not grant again
* do not increase balance again

If ledger row exists but User guard is missing:

* restore the guard
* keep balance at least as high as the recorded transaction balance
* do not grant again

If ledger creation fails after balance update:

* do not repeatedly grant on refresh
* report diagnostic error
* allow recovery path to create ledger later

---

# 9. Concurrency Notes

Base44 schema-level uniqueness is not assumed for `idempotency_key`.

Current protection is best-effort using:

* persisted User guard fields
* transaction query-before-write
* user profile refresh before update
* stable idempotency keys
* recovery paths

True multi-device duplicate-proofing should still be verified with a runtime probe.

If Base44 later supports unique constraints, add a unique constraint on:

```text
DiamondTransaction.idempotency_key
```

---

# 10. Account Deletion Retention

Account deletion rules:

* `User.diamonds` is removed with the user profile.
* retained `DiamondTransaction` audit rows must anonymize `user_email` and any email-bearing idempotency key.
* retained `DailyWheelSpin` audit rows must anonymize `user_email`, `owner_key`, and any email-bearing idempotency key.
* Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
* account deletion must not grant or spend Diamonds.

Daily Wheel deletion cleanup contract:

* Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
* retained economy/gameplay rows must not expose the deleted user identity.

---

# 11. Admin Progress Reset

Admin maintenance reset is not available to normal users.

Backend function:

```text
adminResetUserProgress
```

Modes:

```text
hard_zero
new_player
```

`hard_zero`:

* sets `User.diamonds = 0`
* sets `starter_bonus_granted_at` so starter bonus is not immediately re-granted
* sets `last_daily_diamond_reward_date` to the current UTC day so same-day daily reward is not immediately re-granted
* sets `daily_wheel_last_spin_date` to the current UTC day so same-day Daily Wheel is not immediately re-granted
* clears Daily Wheel guard fields, including streak/count values
* removes target `DailyWheelSpin` rows
* writes an `admin_adjustment` DiamondTransaction audit row when possible

`new_player`:

* sets `User.diamonds = 0`
* clears starter/daily reward guard fields
* clears Daily Wheel guard fields
* removes target `DailyWheelSpin` rows
* allows the normal app-entry economy bootstrap to grant starter + daily Diamonds again

Both modes write `User.progress_reset_at` so local user progress mirrors are invalidated and server state wins after refresh/reopen.

Daily Wheel admin reset cleanup contract:

* clears Daily Wheel guard fields
* removes target `DailyWheelSpin` rows
* prevents stale Daily Wheel availability/countdown state without granting duplicate Diamonds
* does not affect Kronox Puan
* does not affect leaderboard sorting or rank
* reset must not delete the user account or authentication identity
* admin reset remains admin-only, previewed, confirmed, and logged

---

# 3B. Mağaza / Joker Purchases

Mağaza Phase 1 sells only Solo jokers for Diamonds:

```text
Zaman Dondur = 40 Diamonds
Kart Değiştir = 50 Diamonds
Kronokalkan = 60 Diamonds
```

Purchase rules:

* Diamond source/sink balance: Daily Wheel remains a Diamond source and Daily
  Wheel remains Diamond-only, while Mağaza purchase is a Diamond sink
* `purchaseJokerWithDiamonds` owns the trusted price table
* purchase validation is server-authoritative; Client is not trusted for price
  and client-provided price/cost is ignored
* authenticated user can purchase only for self
* sufficient `User.diamonds` is validated server-side
* successful purchase writes `DiamondTransaction.source = market_purchase`
  with `direction = spend`
* successful purchase writes `JokerTransaction.reason = market_purchase`
* insufficient Diamonds do not decrease Diamonds, increase joker balance, or
  write successful purchase ledgers
* purchase uses an idempotency key; double-tap, network retry, and two
  tabs/devices live race proof remains manual
* Partial failure reconciliation: ledger write failure uses best-effort rollback
  of the Diamond and joker balances, but live provider/backend consistency proof
  remains manual

---

# 12. Not Implemented Yet

The following are not implemented:

* Rewarded ads
* Daily Quest / Günün Görevi
* Real-money purchases
* Achievement rewards
* Special event rewards
* Non-joker spending/cost flows

Do not implement these without explicit product approval.

---

# 13. Health Coverage Expectations

Health should cover:

```text
diamond_balance_display_uses_real_field
diamond_starter_bonus_once
diamond_daily_login_once_per_utc_day
diamond_first_day_total_120
diamond_transaction_idempotency_key_used
diamond_reward_retry_safe
diamond_balance_ledger_consistency_contract
diamond_multi_device_runtime_probe_visible
daily_wheel_exists_on_home
daily_wheel_diamonds_only_no_puan
daily_wheel_one_spin_per_server_day
daily_wheel_streak_bonus_contract
```

Rules:

* do not fake PASS for multi-device runtime race tests
* keep runtime-only checks NOT_AUTOMATABLE unless actually proven
* do not derive Elmas from score/stars/level in tests or UI

---

# 14. Manual Proof

Manual/release proof should verify:

* first login grants +100
* daily login grants +20
* first day can total 120
* refresh does not duplicate
* same-day reopen does not duplicate
* next UTC day grants once
* Daily Wheel grants once per UTC server day
* Daily Wheel does not grant Kronox Puan
* 7th consecutive Daily Wheel spin grants +100 extra Diamonds
* two-device duplicate prevention is probed
* ledger recovery does not double grant
