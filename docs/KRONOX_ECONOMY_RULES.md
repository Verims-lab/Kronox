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

# 3. Active Reward Sources

Current active sources:

```text
starter_bonus
daily_login
```

Future schema-ready sources are intentionally inactive:

```text
wheel_spin_future
rewarded_ad_future
quest_reward_future
purchase_future
achievement_future
special_event_future
admin_adjustment
```

Daily Quest / Günün Görevi remains paused.

Do not implement:

```text
DailyQuestProgress
quest rewards
quest reward diamond grants
```

until Daily Quest product work resumes.

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
* account deletion must not grant or spend Diamonds.

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
* writes an `admin_adjustment` DiamondTransaction audit row when possible

`new_player`:

* sets `User.diamonds = 0`
* clears starter/daily reward guard fields
* allows the normal app-entry economy bootstrap to grant starter + daily Diamonds again

Both modes write `User.progress_reset_at` so local user progress mirrors are invalidated and server state wins after refresh/reopen.

---

# 12. Not Implemented Yet

The following are not implemented:

* Wheel spin rewards
* Rewarded ads
* Daily Quest / Günün Görevi
* Purchases
* Achievement rewards
* Special event rewards
* Spending/cost flows

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
* two-device duplicate prevention is probed
* ledger recovery does not double grant
