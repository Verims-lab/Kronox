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
- market_purchase (server-backed Mağaza joker purchase; Diamond spend only)

Daily Wheel is separate from the existing +20 daily login reward, grants once
per UTC server day, uses idempotency_key daily_wheel:<normalizedEmail>:<YYYY-MM-DD>,
records a DailyWheelSpin row plus DiamondTransaction.source = daily_wheel, and
grants a 7-day streak bonus: +100 diamonds. It grants no Kronox Puan and does
not affect leaderboard sorting or rank.

Daily Wheel reward is selected server-side by claimDailyWheelReward and the UI
animates to the backend-selected reward. Reward weights are 10=25%, 15=22%,
20=18%, 25=13%, 30=10%, 40=6%, 50=4%, 100=2%.

Result copy shows +X Elmas kazandın. When the 7-day streak bonus applies it
also shows 7 günlük seri bonusu: +100 elmas and Toplam: +Y elmas. The Home
claimed-state countdown uses Yarın hazır or compact time text such as 11 sa
24 dk without a Diamond icon.

First authenticated entry grants +100 once. Same-day daily login grants +20 once.

## Mağaza / Joker purchases
Mağaza Phase 1 sells only Solo jokers for Diamonds:
Zaman Dondur = 40 Diamonds, Kart Değiştir = 50 Diamonds, Kronokalkan = 60 Diamonds.
purchaseJokerWithDiamonds owns the trusted price table, ignores client-provided price/cost, validates authenticated self-owned user context and sufficient User.diamonds server-side, writes DiamondTransaction.source = market_purchase with direction = spend, and writes JokerTransaction.reason = market_purchase.
Insufficient Diamonds do not decrease Diamonds, increase joker balance, or write successful purchase ledgers. Purchase uses an idempotency key; live double-tap/race proof remains manual.

## Admin reset and account deletion
Admin reset sets \`daily_wheel_last_spin_date\` to the current UTC day, clears Daily Wheel guard fields, and removes target \`DailyWheelSpin\` rows. Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
Admin reset remains admin-only, previewed, confirmed, and logged; it prevents stale Daily Wheel availability/countdown state without granting duplicate Diamonds, changing Kronox Puan, or affecting leaderboard sorting or rank.
Retained economy/gameplay rows do not expose the deleted user identity.

Future sources (wheel_spin, rewarded_ad, quest_reward, real-money purchase,
achievement, special_event) are schema-ready but not active yet.
`;
