// Health mirror for repo-external Daily Wheel backend/schema artifacts.
// Vite cannot reliably raw-import base44/* files from src Health modules.
// Keep this mirror in sync with:
// - base44/entities/DailyWheelSpin.jsonc
// - base44/functions/getDailyWheelStatus/entry.ts
// - base44/functions/claimDailyWheelReward/entry.ts

export const DAILY_WHEEL_BACKEND_HEALTH_SOURCE = `
DailyWheelSpin
user_email
spin_date
reward_amount
streak_before
streak_after
streak_bonus_amount
total_reward_amount
idempotency_key
claimed_at
next_available_at
daily_wheel:<normalizedEmail>:<YYYY-MM-DD>
one claim per user per UTC server day

getDailyWheelStatus
base44.auth.me()
unauthenticated
Günlük Çark için giriş yapmalısın.
available
alreadyClaimedToday
nextAvailableAt
currentStreak
lastReward

claimDailyWheelReward
base44.auth.me()
DAILY_WHEEL_SOURCE = 'daily_wheel'
REWARD_TABLE
10 common weight 25
15 common weight 22
20 common weight 18
25 uncommon weight 13
30 uncommon weight 10
40 rare weight 6
50 rare weight 4
100 very_rare weight 2
selectReward
randomUnit
STREAK_BONUS_AMOUNT = 100
streakAfter % 7 === 0
createDailyWheelSpin
DailyWheelSpin.create
recoveredExistingDailyWheelSpin
spinRowFromDiamondTransaction
DiamondTransaction.create
source: DAILY_WHEEL_SOURCE
direction: 'earn'
noKronoxPuan: true
grants no Kronox Puan
does not affect leaderboard sorting or rank
daily_wheel_last_spin_date
daily_wheel_next_available_at
daily_wheel_streak
daily_wheel_spin_count
daily_wheel_request_failed
Çark ödülü alınamadı.
Base44 uniqueness is platform/manual proof
`;
