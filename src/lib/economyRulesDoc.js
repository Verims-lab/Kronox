// Runtime mirror of docs/KRONOX_ECONOMY_RULES.md.
//
// Why a JS mirror?
//   Vite's `?raw` import cannot reach outside of `src/` on this host, so
//   importing markdown directly from `docs/` (`.md?raw`) fails at build time.
//   Mirroring the doc as a JS module keeps the Health Center static-contract
//   checks alive while the canonical doc lives under `docs/`.
//   When you change one, change the other — the Health cases cross-check
//   required phrases against this string.

export const ECONOMY_RULES_DOC_PATH = 'docs/KRONOX_ECONOMY_RULES.md';

export const ECONOMY_RULES_DOC = `# Kronox Diamond Economy Rules

Status: Active product contract.

## Canonical balance
The canonical Diamond balance lives on User.diamonds. It is never derived from
stars, score, or completed levels.

## Ledger and idempotency
Every grant is recorded in DiamondTransaction with balance_before,
balance_after, source, and a durable idempotency_key. One logical row should
exist per idempotency_key.

## Active sources
- starter_bonus (one-time, guarded by User.starter_bonus_granted_at)
- daily_login (guarded by User.last_daily_diamond_reward_date)
- daily_wheel (server-backed Daily Wheel claim; Diamonds only, no Kronox Puan)

Daily Wheel is separate from the existing +20 daily login reward, grants once
per UTC server day, uses idempotency_key daily_wheel:<normalizedEmail>:<YYYY-MM-DD>,
records a DailyWheelSpin row plus DiamondTransaction.source = daily_wheel, and
grants a 7-day streak bonus: +100 diamonds. It grants no Kronox Puan and does
not affect leaderboard sorting or rank.

First authenticated entry grants +100 once. Same-day daily login grants +20 once.

## Admin reset and account deletion
Admin reset sets \`daily_wheel_last_spin_date\` to the current UTC day, clears
Daily Wheel guard fields, and removes target \`DailyWheelSpin\` rows. Retained
OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the
deleted user.

Future sources (wheel_spin, rewarded_ad, quest_reward, purchase, achievement,
special_event) are schema-ready but not active yet.
`;