# Kronox Diamond Economy Rules

This document defines the first production Diamond / Elmas economy contract.
Diamonds are a persisted user-owned balance and are separate from Kronox Puan.

## Source Of Truth

- Canonical balance field: `User.diamonds`.
- Display helper: `getDiamondBalance(user)`.
- Existing UI adapter: `getLeaderboardDiamondValue(user)` delegates to the
  same canonical helper so Header, Home, Solo, Online, Profile, and Liderlik
  surfaces agree.
- Diamonds must never be calculated from Kronox Puan, Solo stars, Solo level,
  Online score, or leaderboard rank.

## Transaction Ledger

`DiamondTransaction` is the economy ledger/audit entity.

Required fields:

- `user_email`
- `amount`
- `balance_before`
- `balance_after`
- `source`
- `direction`
- `idempotency_key`
- `metadata`
- `created_at`

The ledger supports future sources without one-off balance logic. Current
active sources are only:

- `starter_bonus`
- `daily_login`

Future schema-ready sources are intentionally inactive:

- `wheel_spin_future`
- `rewarded_ad_future`
- `quest_reward_future`
- `purchase_future`
- `achievement_future`
- `special_event_future`
- `admin_adjustment`

Daily Quest / Günün Görevi remains paused. Do not implement
`DailyQuestProgress` or quest rewards until that product work resumes.

## Starter Bonus

- Amount: `+100` Diamonds.
- Grant timing: after an authenticated user/profile is loaded at app entry.
- Idempotency key: `starter_bonus:<normalizedEmail>`.
- Persistent guard: `User.starter_bonus_granted_at`.
- Must only grant once per user across refreshes/devices.

## Daily Login Reward

- Amount: `+20` Diamonds.
- Grant timing: after an authenticated user/profile is loaded on a new day.
- Day boundary: UTC.
- Daily key: `YYYY-MM-DD` from UTC date.
- Idempotency key: `daily_login:<normalizedEmail>:<YYYY-MM-DD>`.
- Persistent guard: `User.last_daily_diamond_reward_date`.
- Must grant at most once per user per UTC day.

## First-Day Total

A brand-new authenticated user can receive both rewards on the same day:

- Starter bonus: `+100`
- Daily login reward: `+20`
- First-day total: `120` Diamonds

Refreshing the app after that must not grant another starter or daily reward.

## Grant Flow

The app bootstrap calls `ensureDiamondEconomyForUser(user)` after
`base44.auth.me()` resolves.

For each reward:

1. Normalize user email with trim/lowercase.
2. Build the source idempotency key.
3. Check the persisted User guard field.
4. Check `DiamondTransaction` by `user_email + idempotency_key`.
5. Refresh the current user profile before writing.
6. Update `User.diamonds` and the guard field through `base44.auth.updateMe`.
7. Create a `DiamondTransaction` ledger row.
8. If a later run finds a guard without a ledger row, create a recovery
   ledger row without granting again.
9. If a later run finds a ledger row without the matching User guard, restore
   the guard and preserve the highest known balance without granting again.

The User guard field is written with the balance update so a transient ledger
write failure does not cause repeated grants on refresh. The helper reports the
ledger error for diagnostics.

## Concurrency Notes

Base44 schema-level uniqueness is not assumed for `idempotency_key`. The
current guard is best-effort durable protection:

- persisted User guard fields,
- transaction query-before-write,
- user profile refresh before update,
- same computed balance when two first-entry sessions race from the same base.

The helper now includes self-healing for partial states:

- `starter_bonus_granted_at` / `last_daily_diamond_reward_date` exists but
  the ledger row is missing -> recover the ledger row only.
- `DiamondTransaction.idempotency_key` exists but the User guard is missing
  -> recover the guard and keep the balance at least as high as the recorded
  transaction balance.

True multi-device duplicate-proofing should still be verified with a runtime
probe. If Base44 exposes unique constraints later, add a unique constraint on
`DiamondTransaction.idempotency_key`.

## Not Implemented Yet

- Wheel spin rewards.
- Rewarded ads.
- Daily Quest / Günün Görevi.
- Purchases.
- Achievement and special event rewards.
- Spending/cost flows.
