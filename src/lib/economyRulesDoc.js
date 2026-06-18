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
exist per idempotency_key. DiamondTransaction create helpers re-check
user_email + idempotency_key before create and confirm by idempotency_key after
create.
Base44 schema-level uniqueness is not assumed. DB/entity unique plus
function-level guard is Low risk; function-level guard only = Medium/P1 hardening;
neither DB/entity unique nor function-level guard is High.

## Active sources
- starter_bonus (one-time, guarded by User.starter_bonus_granted_at)
- daily_login (guarded by User.last_daily_diamond_reward_date)
- daily_wheel (server-backed Daily Wheel claim; Diamonds only, no Kronox Puan)
- market_purchase (server-backed Mağaza joker purchase; Diamond spend only)

Daily Wheel is separate from the existing +20 daily login reward, grants once
per UTC server day, uses idempotency_key daily_wheel:<normalizedEmail>:<YYYY-MM-DD>,
records a DailyWheelSpin row plus DiamondTransaction.source = daily_wheel, and
grants a 7-day streak bonus: +150 diamonds. It grants no Kronox Puan and does
not affect leaderboard sorting or rank. Daily Wheel same-day duplicate
prevention uses key/date lookup, reserve-first DailyWheelSpin rows, canonical
same-user/same-day re-read, User guard re-check, and DiamondTransaction
re-check before balance mutation. This is not an atomic upsert until DB/entity
unique proof is attached for DailyWheelSpin.idempotency_key,
DailyWheelSpin.user_email + spin_date, and DiamondTransaction.idempotency_key.

Daily Wheel reward is selected server-side by claimDailyWheelReward and the UI
animates to the backend-selected reward. Reward weights are 30 high weight 24,
40 high weight 22, 50 high weight 20, 60 medium weight 12,
75 medium weight 10, 100 low weight 7, 150 rare weight 4,
250 very_rare weight 1.

Result copy shows +X Elmas kazandın. When the 7-day streak bonus applies it
also shows 7 günlük seri bonusu: +150 elmas and Toplam: +Y elmas. The Home
claimed-state countdown uses Yarın hazır or compact time text such as 11 sa
24 dk without a Diamond icon.

Günlük Ödüller panel contains Daily Wheel and Daily Quest Runtime v1 Günlük
Görev. DailyQuestDefinition templates are admin-managed and
title/description are display-only; quest_type + target_value drive runtime
logic. UserDailyQuestProgress stores 1 selected UTC-day user quest.
Fresh DBs seed the four default Solo-focused DailyQuestDefinition rows
idempotently when no definitions exist; if no active definitions remain, Home
shows a safe empty state and does not grant Diamonds. getDailyQuestStatus is
authenticated but not admin-only and preserves newly created progress rows if
immediate refresh is stale.
claimDailyQuestReward grants diamonds only, writes DiamondTransaction.source =
daily_quest_reward with direction = earn, uses
daily_quest_reward:<normalizedEmail>:<YYYY-MM-DD>:<questKey>, and uses
User.daily_quest_* fields instead of Daily Wheel fields. Home copy says
"Günlük Görevleri Yap, Elmasları Kazan!" and runtime backend functions
explicitly bind UserDailyQuestProgress. Daily Quest does not grant Kronox Puan
and has no leaderboard impact.

First authenticated entry grants +100 once. Same-day daily login grants +20 once.
First-day total: \`120\` Diamonds. This combines starter 100 Diamonds plus
daily login 20 Diamonds only; it does not imply Kronox Puan and does not affect
leaderboard rank.

## Mağaza / Joker purchases
Mağaza Phase 1 sells only Solo jokers for Diamonds:
Zaman Dondur = 40 Diamonds, Kart Değiştir = 50 Diamonds, Kronokalkan = 60 Diamonds.
Diamond source/sink balance: Daily Wheel remains a Diamond source and Daily Wheel remains Diamond-only, while Mağaza purchase is a Diamond sink.
purchaseJokerWithDiamonds owns the trusted price table, purchase validation is server-authoritative, Client is not trusted for price, client-provided price/cost is ignored, validates authenticated self-owned user context and sufficient User.diamonds server-side, writes DiamondTransaction.source = market_purchase with direction = spend, and writes JokerTransaction.reason = market_purchase.
purchaseJokerWithDiamonds explicitly binds UserJokerInventory, DiamondTransaction, and JokerTransaction in the Base44 runtime path; deployed proof must confirm Diamond decrease, joker increase, both ledgers, insufficient-Diamond block, and duplicate tap guard.
Insufficient Diamonds do not decrease Diamonds, increase joker balance, or write successful purchase ledgers. Purchase uses an idempotency key; double-tap, network retry, and two tabs/devices live race proof remains manual.
Starter inventory repair during purchase is best-effort; a starter self-heal error must not block a valid purchased joker balance and ledger write.
Partial failure reconciliation: ledger write failure uses best-effort rollback of the Diamond and joker balances, but live provider/backend consistency proof remains manual.
Joker balance read-performance contract: UserJokerInventory is the Profile/Solo current-balance source. JokerTransaction is the ledger/audit trail and must not be summed on Profile open. Profile, Solo, and Mağaza use the shared getUserJokerBalances / mutation-result cache path keyed by normalized user email. Complete inventory rows render through a fast current-balance read; missing or partial rows trigger idempotent starter/self-heal. Mağaza purchase and Solo spend must update or invalidate the shared balance cache so Profile and Solo do not show stale counts. spendUserJoker validates Solo context, uses deploy-safe UserJokerInventory/JokerTransaction entity fallback, and returns safe user-facing errors. Admin/static reconciliation can compare UserJokerInventory.quantity against JokerTransaction summed deltas and latest balance_after without mutating data. Guest/no-login paths must not query user-owned joker inventory. Live performance proof remains manual: login, open Profile, confirm Joker Çantası loads quickly, purchase/spend a joker, and confirm Profile/Solo counts refresh.

## Admin reset and account deletion
Admin reset sets \`daily_wheel_last_spin_date\` to the current UTC day, clears Daily Wheel guard fields, and removes target \`DailyWheelSpin\` rows. Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user.
Admin reset remains admin-only, previewed, confirmed, and logged; it prevents stale Daily Wheel availability/countdown state without granting duplicate Diamonds, changing Kronox Puan, or affecting leaderboard sorting or rank.
Retained economy/gameplay rows do not expose the deleted user identity.

Future sources (daily_quest_future, wheel_spin, rewarded_ad, quest_reward,
real-money purchase, achievement, special_event) are schema-ready but not active
yet.
`;
