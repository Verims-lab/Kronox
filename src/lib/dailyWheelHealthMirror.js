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
10 common
15 common
20 common
25 uncommon
30 uncommon
40 rare
50 rare
100 very_rare
STREAK_BONUS_AMOUNT = 100
streakAfter % 7 === 0
DailyWheelSpin.create
DiamondTransaction.create
source: DAILY_WHEEL_SOURCE
direction: 'earn'
noKronoxPuan: true
daily_wheel_last_spin_date
daily_wheel_next_available_at
daily_wheel_streak
daily_wheel_spin_count
Base44 uniqueness is platform/manual proof
`;
